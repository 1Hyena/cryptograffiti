#include <unistd.h>
#include <fstream>

#include "decoder.h"
#include "utils.h"
#include "json.h"
#include "program.h"

bool DECODER::decode(const std::string &data, nlohmann::json *result) {
    nlohmann::json buf = nlohmann::json();

    if (result == nullptr) result = &buf;

    std::vector<unsigned char> bin;

    if (!hex2bin(data.c_str(), &bin)) {
        (*result)["error"] = "input is not a valid hex string";
        return false;
    }

    std::queue<graffiti_type> graffiti;

    (*result)["size"] = bin.size();
    (*result)["graffiti"] = false;
    (*result)["txid"] = calc_txid(bin.data(), bin.size());

    const unsigned char *rawtx = bin.data();

    uint32_t version = read_uint32(&rawtx);
    uint64_t num_vin = read_varint(&rawtx);

    (*result)["version"] = version;
    (*result)["inputs"] = num_vin;

    for (size_t i=0; i<num_vin; ++i) {
        rawtx += 32; // Skip previous TX hash.
        rawtx += 4;  // Skip previous output index.

        uint64_t script_size = read_varint(&rawtx);
        rawtx += script_size; // Skip the Unlocking-Script.
        rawtx += 4; // Skip the Sequence Number.
    }

    uint64_t num_vout = read_varint(&rawtx);
    (*result)["outputs"] = num_vout;

    for (size_t i=0; i<num_vout; ++i) {
        rawtx += 8; // Skip the amount.
        uint64_t script_size = read_varint(&rawtx);
        size_t offset = ((char *) rawtx) - ((char *) bin.data());

        if (!decode(rawtx, script_size, graffiti, offset)) {
            (*result)["error"] = "failed to decode";
            return false;
        }

        rawtx += script_size; // Skip the Locking-Script.
    }

    uint32_t locktime = read_uint32(&rawtx);
    (*result)["locktime"] = locktime;

    size_t valid_files = 0;
    (*result)["graffiti"] = false;
    (*result)["files"] = nlohmann::json::array();

    if (!graffiti.empty()) {
        nlohmann::json chunkbuf = nlohmann::json::array();

        while (!graffiti.empty()) {
            nlohmann::json chunk = nlohmann::json();
            std::vector<unsigned char> &payload = graffiti.front().payload;

            switch (graffiti.front().where) {
                case LOCATION::NULL_DATA: {
                    chunk["location"] = std::string("NULL_DATA");
                    break;
                }
                case LOCATION::P2PKH: {
                    chunk["location"] = std::string("P2PKH");
                    break;
                }
                default: {
                    chunk["location"] = std::string("UNKNOWN");
                    break;
                }
            }

            size_t old_sz = payload.size();
            std::string mimetype;
            bool mimetype_detected{
                get_mimetype(
                    (const unsigned char *) &payload[0], payload.size(),
                    mimetype
                )
            };

            if (!mimetype_detected) {
                (*result)["error"] = "failed to detect mimetype";
                return false;
            }

            chunk["mimetype"] = mimetype;
            chunk["offset"] = graffiti.front().offset;
            chunk["fsize"] = old_sz;

            bool found = false;

            for (const std::string &mt : mimetypes)  {
                if (mimetype.find(mt) == 0) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                chunk["error"] = std::string("unwanted mimetype");
            }
            else if (mimetype.find("image/") == 0) {
                if (mimetype.find("image/jpeg") == 0) {
                    std::vector<unsigned char> errors;

                    bool syscmd{
                        program->syspipe(
                            (const unsigned char *) &payload[0], payload.size(),
                            "djpeg -fast -grayscale -onepass 2>&1 1>/dev/null",
                            &errors
                        )
                    };

                    if (!syscmd) {
                        (*result)["error"] = "syspipe failure";
                        return false;
                    }
                    else if (!errors.empty()) {
                        chunk["error"] = std::string("corrupt file");
                    }
                }
                else {
                    chunk["error"] = std::string("unsupported image file");
                }
            }
            else {
                trim_utf8(payload);
                size_t new_sz = payload.size();

                double entropy{
                    calc_entropy(
                        (const unsigned char *) &payload[0], payload.size()
                    )
                };

                if (std::isnan(entropy)) chunk["entropy"] = nullptr;
                else                     chunk["entropy"] = entropy;

                if (old_sz/10 + new_sz >= old_sz) {
                    payload.push_back(0);
                    const char *str = (const char *) &payload[0];
                    if (unicode_len) {
                        chunk["unicode"] = prune_utf8(str, unicode_len);
                    }

                    if (new_sz <= 4) {
                        chunk["error"] = std::string("too short");
                    }
                    else if (entropy >= 0.9) {
                        chunk["error"] = std::string("high entropy");
                    }
                    else if (hex2bin(str)) {
                        chunk["error"] = std::string("hex string");
                    }
                    else if (nlohmann::json::accept(str)) {
                        chunk["error"] = std::string("json string");
                    }

                    payload.pop_back();
                }
                else chunk["error"] = std::string("not plaintext");
            }

            chunk["hash"] = std::string(
                (const char *) (&ripemd160(&payload[0], payload.size())[0])
            );

            if (!chunk.count("error")) {
                valid_files++;

                if (content) {
                    chunk["content"] = bin2hex(
                        (const unsigned char *) &payload[0], payload.size()
                    );
                }
            }

            graffiti.pop();
            if (chunk.count("error") && !verbose) continue;

            if (!file_hash.empty()
            && (!chunk.count("hash") || file_hash.compare(chunk["hash"]))) {
                continue;
            }

            // Let's ignore excess chunks to avoid potential DoS attacks.
            if (chunkbuf.size() < 256) chunkbuf.push_back(chunk);
            else break;

            if (!file_hash.empty()
            && (chunk.count("hash") && !file_hash.compare(chunk["hash"]))) {
                // We have found the chunk we were looking for.
                break;
            }
        }

        (*result)["files"].swap(chunkbuf);
    }

    if (valid_files > 0) (*result)["graffiti"] = true;

    return true;
}

bool DECODER::decode(
    const unsigned char *bytes, size_t bytes_len, std::queue<graffiti_type> &to,
    size_t offset
) const {
    LOCATION loc = LOCATION::NONE;
    size_t start_at = 0;

    if (bytes_len >= 1 && *bytes == 0x6a) {
        // Legacy OP_RETURN detected
        loc = LOCATION::NULL_DATA;
        start_at = 1;
    }
    else if (bytes_len >= 2 && bytes[0] == 0x00 && bytes[1] == 0x6a) {
        // OP_RETURN detected
        loc = LOCATION::NULL_DATA;
        start_at = 2;
    }

    if (loc == LOCATION::NONE) {
        return true;
    }

    if (loc == LOCATION::NULL_DATA) {
        const unsigned char *opret_body = bytes + start_at;
        size_t opret_size = bytes_len - start_at;

        std::map<size_t, size_t> segments;
        if (!get_opret_segments(opret_body, opret_size, segments)) {
            return false;
        }

        for (auto &segment : segments) {
            size_t pos = segment.first;
            size_t len = segment.second;

            if (opret_size > pos) {
                to.emplace(
                    make_graffiti(
                        loc, offset+start_at+pos, opret_body[pos], len
                    )
                );
            }
            else return false;
        }
    }

    return true;
}

bool DECODER::get_opret_segments(
    const unsigned char *bytes, size_t sz, std::map<size_t, size_t> &to
) const {
    size_t start_pos = 0;

    std::vector<unsigned char> segment_size_bytes;
    std::map<size_t, size_t> opret_segments;

    Again:

    for (size_t i=start_pos; i<sz; ++i) {
        unsigned char byte = bytes[i];

        if (!segment_size_bytes.empty()) {
            size_t size_bytes = segment_size_bytes[0];

            if (segment_size_bytes.size() < size_bytes + 1) {
                segment_size_bytes.push_back(byte);

                if (segment_size_bytes.size() == size_bytes + 1) {
                    size_t segment_size = 0;
                    while (segment_size_bytes.size() > 1) {
                        unsigned char sz_byte = segment_size_bytes.back();
                        segment_size_bytes.pop_back();
                        segment_size = (segment_size << 8) + sz_byte;
                    }

                    if (i + 1 + segment_size > sz) {
                        to.insert( { 0, sz } );
                        // Does not follow pushdata protocol.
                        return true;
                    }

                    if (segment_size) {
                        // We ignore zero size segments.
                        opret_segments.insert( { i+1, segment_size } );
                    }

                    start_pos = i + 1 + segment_size;
                    segment_size_bytes.clear();
                    goto Again;
                }

                continue;
            }

            return false; // Should never happen.
        }

        if (byte <= 75) {
            segment_size_bytes.push_back(1);
            goto Again;
        }
        else if (byte == 76) {
            segment_size_bytes.push_back(1);
        }
        else if (byte == 77) {
            segment_size_bytes.push_back(2);
        }
        else if (byte == 78) {
            segment_size_bytes.push_back(4);
        }
        else {
            to.insert( { 0, sz } ); // Does not follow pushdata protocol.
            return true;
        }
    }

    if (!segment_size_bytes.empty()) {
        to.insert( { 0, sz } ); // Does not follow pushdata protocol.
        return true;
    }

    to.insert(opret_segments.begin(), opret_segments.end());
    return true;
}

void DECODER::set_verbose(bool value) {
    verbose = value;
}

void DECODER::set_content(bool value) {
    content = value;
}

void DECODER::set_file_hash(const std::string &hash) {
    file_hash.assign(hash);

    std::transform(file_hash.begin(), file_hash.end(), file_hash.begin(),
        [](unsigned char c){
            return std::tolower(c);
        }
    );
}

void DECODER::set_unicode_len(size_t value) {
    unicode_len = value;
}

void DECODER::set_mime_types(const std::string &types) {
    std::string buf;
    for (char c : types) {
        if (c == ',') {
            mimetypes.insert(buf);
            buf.clear();
        }
        else buf.append(1, c);
    }

    if (!buf.empty() || mimetypes.empty()) mimetypes.insert(buf);
}

bool DECODER::get_mimetype(
    const unsigned char *bytes, size_t len, std::string &mimetype
) const {
    std::vector<unsigned char> result;

    if (!program->syspipe(bytes, len, "file -r -k -b --mime-type -", &result)) {
        return false;
    }

    if (result.empty()) {
        log(
            program->get_name(), "%s: empty mimetype (%s:%d)",
            __FUNCTION__, __FILE__, __LINE__
        );
        return false;
    }

    for (unsigned char c : result) {
        if (c == '\n'
        ||  c == '\0') break;
        mimetype.append(1, c);
    }

    return true;
}

std::string DECODER::calc_txid(const unsigned char *rawtx, size_t sz) const {
    std::vector<unsigned char> hash{sha256(rawtx, sz, false)};
    std::vector<unsigned char> txid{sha256(hash.data(), hash.size(), false)};
    std::reverse(txid.begin(), txid.end());
    return bin2hex(txid.data(), txid.size());
}

uint32_t DECODER::read_uint32(const unsigned char **bytes) const {
    uint32_t value = 0;
    for (size_t i=0; i<4; ++i) {
        value += **bytes << i*8;
        (*bytes)++;
    }

    return value;
}

uint64_t DECODER::read_uint64(const unsigned char **bytes) const {
    uint64_t value = 0;
    for (size_t i=0; i<8; ++i) {
        value += **bytes << i*8;
        (*bytes)++;
    }

    return value;
}

uint64_t DECODER::read_varint(const unsigned char **bytes) const {
    unsigned char first_byte = **bytes;

    (*bytes)++;

    size_t num_bytes = 0;

    switch (first_byte) {
        default : return first_byte;
        case 253: num_bytes = 2; break; // fd
        case 254: num_bytes = 4; break; // fe
        case 255: num_bytes = 8; break; // ff
    }

    uint64_t value = 0;
    for (size_t i=0; i<num_bytes; ++i) {
        value += **bytes << i*8;
        (*bytes)++;
    }

    return value;
}
