#include <unistd.h>
#include <fstream>

#include "decoder.h"
#include "utils.h"
#include "json.h"
#include "program.h"

bool DECODER::decode(const std::string &data, nlohmann::json *result) {
    nlohmann::json buf = nlohmann::json();
    nlohmann::json tx  = nlohmann::json();

    if (result == nullptr) result = &buf;

    std::exception_ptr eptr;
    try         {tx   = nlohmann::json::parse(data);    }
    catch (...) {eptr = std::current_exception();       }
    try         {if (eptr) std::rethrow_exception(eptr);}
    catch (const std::exception& e) {
        (*result)["error"] = e.what();
        return false;
    }

    if (!tx.count("txid") || !tx["txid"].is_string()) {
        (*result)["error"] = "invalid or missing txid";
        return false;
    }

    (*result)["txid"] = tx["txid"].get<std::string>();

    if (tx.count("time") && !tx["time"].is_number()) {
        (*result)["error"] = "invalid time";
        return false;
    }

    if (tx.count("time")) (*result)["time"] = tx["time"];
    else                  (*result)["time"] = nullptr;

    if (!tx.count("size") || !tx["size"].is_number()) {
        (*result)["error"] = "invalid or missing size";
        return false;
    }

    (*result)["size"] = tx["size"];

    if (!tx.count("vout") || !tx["vout"].is_array()) {
        (*result)["error"] = "invalid vout structure";
        return false;
    }

    std::queue<graffiti_type> graffiti;

    for (auto &vout : tx["vout"]) {
        if (!vout.count("scriptPubKey")
        ||  !vout.at("scriptPubKey").is_object()) {
            (*result)["error"] = "invalid scriptPubKey structure";
            return false;
        }

        auto &spk = vout["scriptPubKey"];

        if (!spk.count("hex") || !spk.at("hex").is_string()) {
            (*result)["error"] = "invalid hex structure";
            return false;
        }

        const std::string &hex = spk["hex"];
        if (!decode(hex, graffiti)) {
            (*result)["error"] = "failed to decode scriptPubKey['hex']";
            return false;
        }
    }

    size_t valid_files = 0;
    (*result)["confirmations"] = 0;
    (*result)["graffiti"] = false;
    (*result)["files"] = nlohmann::json::array();

    if (tx.count("confirmations") && tx["confirmations"].is_number()) {
        (*result)["confirmations"] = tx["confirmations"];
    }

    if (!graffiti.empty()) {
        nlohmann::json chunkbuf = nlohmann::json::array();

        while (!graffiti.empty()) {
            nlohmann::json chunk = nlohmann::json();
            std::vector<unsigned char> &payload = graffiti.front().payload;

            switch (graffiti.front().where) {
                case LOCATION::NULL_DATA: chunk["location"] = std::string("NULL_DATA"); break;
                case LOCATION::P2PKH:     chunk["location"] = std::string("P2PKH");     break;
                default:                  chunk["location"] = std::string("UNKNOWN");   break;
            }

            size_t old_sz = payload.size();
            std::string mimetype;
            if (!get_mimetype((const unsigned char *) &payload[0], payload.size(), mimetype)) {
                (*result)["error"] = "failed to detect mimetype";
                return false;
            }

            chunk["mimetype"] = mimetype;
            chunk["offset"] = graffiti.front().offset;
            chunk["fsize"] = old_sz;

            if (mimetype.find("image/") == 0) {
                std::vector<unsigned char> errors;

                if (!program->syspipe((const unsigned char *) &payload[0],
                    payload.size(), "identify -verbose - 2>&1 > /dev/null", &errors)) {
                    (*result)["error"] = "failed to identify file";
                    return false;
                }
                else if (!errors.empty()) {
                    chunk["error"] = std::string("corrupt file");
                }
            }
            else {
                trim_utf8(payload);
                size_t new_sz = payload.size();

                double entropy = calc_entropy((const unsigned char *) &payload[0], payload.size());
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
                    else if (validate_bitcoin_address(str, nullptr, 0) >= 0) {
                        chunk["error"] = std::string("bitcoin address");
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

bool DECODER::decode(const std::string &hex, std::queue<graffiti_type> &to) {
    LOCATION loc = LOCATION::NONE;
    size_t start_at = 0;

    if (!hex.compare(0, 2, "6a")) {
        // OP_RETURN detected
        loc = LOCATION::NULL_DATA;
        start_at = 2;
    }

    if (loc == LOCATION::NONE) {
        return true;
    }

    std::vector<unsigned char> bin;
    if (!hex2bin(hex.c_str()+start_at, &bin)) {
        return false;
    }

    if (loc == LOCATION::NULL_DATA) {
        std::map<size_t, size_t> segments;
        if (!get_opret_segments(bin, segments)) return false;

        for (auto &segment : segments) {
            size_t pos = segment.first;
            size_t len = segment.second;

            if (bin.size() > pos) {
                to.push( { loc, pos, std::vector<unsigned char>(bin.begin()+pos, bin.begin()+pos+len) } );
            }
            else return false;
        }
    }

    return true;
}

bool DECODER::get_opret_segments(std::vector<unsigned char> &bytes, std::map<size_t, size_t> &to) {
    size_t sz = bytes.size();
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
                        to.insert( { 0, sz } ); // Does not follow pushdata protocol.
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

bool DECODER::get_mimetype(const unsigned char *bytes, size_t len, std::string &mimetype) const {
    std::vector<unsigned char> result;

    if (!program->syspipe(bytes, len, "file -r -k -b --mime-type -", &result)) {
        return false;
    }

    for (unsigned char c : result) {
        if (c == '\n'
        ||  c == '\0') break;
        mimetype.append(1, c);
    }

    return true;
}

