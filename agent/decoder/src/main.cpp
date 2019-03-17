#include <cstdlib>
#include <iostream>
#include <queue>
#include <openssl/sha.h>

#include "json.h"

enum class LOCATION {
    NONE,
    OP_RETURN,
    P2PKH
};

struct graffiti_type {
    LOCATION where;
    std::vector<unsigned char> payload;
};

const char *PROGRAM_NAME = "cgd";

void trim_utf8(std::vector<unsigned char> &hairy);
bool hex2bin(const char *hex, std::vector<unsigned char> *bin =nullptr);
bool dump_json(const nlohmann::json &json, const int indent =-1, std::string *to =nullptr);
int fail(const char *msg = "Invalid TX", const char* file = __builtin_FILE(), int line = __builtin_LINE());
bool decode(const std::string &hex, std::queue<graffiti_type> &to);
bool get_opret_segments(std::vector<unsigned char> &bytes, std::map<size_t, size_t> &to);
std::vector<unsigned char> sha256(const unsigned char *bytes, size_t len, bool hex =true);

int main(int argc, char **argv) {
    PROGRAM_NAME = argv[0];
    std::string data(std::istreambuf_iterator<char>(std::cin), {});
    nlohmann::json tx = nlohmann::json();
    nlohmann::json result = nlohmann::json();

    std::exception_ptr eptr;
    try         {tx   = nlohmann::json::parse(data);    }
    catch (...) {eptr = std::current_exception();       }
    try         {if (eptr) std::rethrow_exception(eptr);}
    catch (const std::exception& e) {
        return fail(e.what());
    }

    if (!tx.count("vout") || !tx["vout"].is_array()) {
        return fail();
    }

    std::queue<graffiti_type> graffiti;

    for (auto &vout : tx["vout"]) {
        if (!vout.count("scriptPubKey")
        ||  !vout.at("scriptPubKey").is_object()) return fail();

        auto &spk = vout["scriptPubKey"];

        if (!spk.count("hex") || !spk.at("hex").is_string()) {
            return fail();
        }

        const std::string &hex = spk["hex"];
        if (!decode(hex, graffiti)) return fail();
    }

    std::vector<unsigned char> msg_bytes;
    result["txid"] = tx["txid"].get<std::string>();
    result["confirmations"] = 0;

    if (tx.count("confirmations") && tx["confirmations"].is_number()) {
        result["confirmations"] = tx["confirmations"];
    }

    if (!graffiti.empty()) {
        result["chunks"] = nlohmann::json::array();

        while (!graffiti.empty()) {
            size_t old_sz = graffiti.front().payload.size();
            trim_utf8(graffiti.front().payload);
            size_t new_sz = graffiti.front().payload.size();

            nlohmann::json chunk = nlohmann::json();

            switch (graffiti.front().where) {
                case LOCATION::OP_RETURN: chunk["type"] = std::string("OP_RETURN"); break;
                case LOCATION::P2PKH:     chunk["type"] = std::string("P2PKH");     break;
                default:                  chunk["type"] = std::string("UNKNOWN");   break;
            }

            chunk["initial_size"] = old_sz;
            chunk["trimmed_size"] = new_sz;

            std::vector<unsigned char> &payload = graffiti.front().payload;

            if (old_sz/10 + new_sz >= old_sz) {
                payload.push_back(0);
                chunk["unicode_body"] = std::string((const char *) &payload[0]);
                payload.pop_back();

                if (new_sz >= 4) {
                    msg_bytes.insert(msg_bytes.end(), payload.begin(), payload.end());
                }
                else chunk["error"] = std::string("too short");
            }
            else chunk["error"] = std::string("not plaintext");

            graffiti.pop();
            result["chunks"].push_back(chunk);
        }

        std::vector<unsigned char> msg_hash = sha256(&msg_bytes[0], msg_bytes.size());
        result["trimmed_size"] = msg_bytes.size();
        result["trimmed_hash"] = std::string((const char *) (&msg_hash[0]));
    }

    if (!msg_bytes.empty() && !dump_json(result)) return fail();

    return EXIT_SUCCESS;
}

bool decode(const std::string &hex, std::queue<graffiti_type> &to) {
    LOCATION loc = LOCATION::NONE;
    size_t start_at = 0;

    if (!hex.compare(0, 2, "6a")) {
        // OP_RETURN detected
        loc = LOCATION::OP_RETURN;
        start_at = 2;
    }

    if (loc == LOCATION::NONE) {
        return true;
    }

    std::vector<unsigned char> bin;
    if (!hex2bin(hex.c_str()+start_at, &bin)) {
        return false;
    }

    if (loc == LOCATION::OP_RETURN) {
        std::map<size_t, size_t> segments;
        if (!get_opret_segments(bin, segments)) return false;

        for (auto &segment : segments) {
            size_t pos = segment.first;
            size_t len = segment.second;

            if (bin.size() > pos) {
                to.push( { loc, std::vector<unsigned char>(bin.begin()+pos, bin.begin()+pos+len) } );
            }
            else return false;
        }
    }

    return true;
}

bool get_opret_segments(std::vector<unsigned char> &bytes, std::map<size_t, size_t> &to) {
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

bool hex2bin(const char *hex, std::vector<unsigned char> *bin) {
    if (hex == nullptr) return false;

    auto h2b = [](unsigned char c) -> char
    {
             if(c >= 48 && c <=  57) return (char) (c - 48);
        else if(c >= 97 && c <= 102) return (char) (c - 97 + 10);
        else if(c >= 65 && c <=  70) return (char) (c - 65 + 10);
        return -1;
    };

    bool invalid = false;

    for (size_t i = 0; ; i = i+2){
	    unsigned char b1 = hex[i];
	    if (b1 == '\0') break;

	    unsigned char b2 = hex[i+1];
	    if (b2 == '\0') invalid = true;
        else {
	        char i1 = h2b(b1);
	        char i2 = h2b(b2);

	        if (i1 != -1 && i2 != -1) {
		        unsigned char byte = (unsigned char)(i1 * 16 + i2);
		        if (bin) bin->push_back(byte);
	        }
	        else invalid = true;
	    }

	    if (invalid && bin == nullptr) break;
    }

    return !invalid;
}

bool dump_json(const nlohmann::json &json, const int indent, std::string *to) {
    std::string result;
    try {
        if (indent >= 0) result = json.dump(indent);
        else             result = json.dump();
    }
    catch (nlohmann::json::type_error& e) {
        std::cerr << PROGRAM_NAME << ": " << e.what() << std::endl;
        return false;
    }

    if (to) to->swap(result);
    else std::cout << result << std::endl;

    return true;
}

int fail(const char *msg, const char* file, int line) {
    std::cerr << PROGRAM_NAME << ": " << msg << " (" << file << ":" << line << ")." << std::endl;
    return EXIT_FAILURE;
}

void trim_utf8(std::vector<unsigned char>& hairy) {
    std::vector<bool> results;
    std::vector<unsigned char> smooth;
    size_t len = hairy.size();
    results.reserve(len);
    smooth.reserve(len);
    const unsigned char *bytes = (const unsigned char *) &(hairy[0]);

    auto read_utf8 = [](const unsigned char *bytes, size_t len, size_t *pos) -> unsigned {
        int code_unit1 = 0;
        int code_unit2, code_unit3, code_unit4;

        if (*pos >= len) goto ERROR1;
        code_unit1 = bytes[(*pos)++];

             if (code_unit1 < 0x80) return code_unit1;
        else if (code_unit1 < 0xC2) goto ERROR1; // continuation or overlong 2-byte sequence
        else if (code_unit1 < 0xE0) {
            if (*pos >= len) goto ERROR1;
            code_unit2 = bytes[(*pos)++]; //2-byte sequence
            if ((code_unit2 & 0xC0) != 0x80) goto ERROR2;
            return (code_unit1 << 6) + code_unit2 - 0x3080;
        }
        else if (code_unit1 < 0xF0) {
            if (*pos >= len) goto ERROR1;
            code_unit2 = bytes[(*pos)++]; // 3-byte sequence
            if ((code_unit2 & 0xC0) != 0x80) goto ERROR2;
            if (code_unit1 == 0xE0 && code_unit2 < 0xA0) goto ERROR2; // overlong
            if (*pos >= len) goto ERROR2;
            code_unit3 = bytes[(*pos)++];
            if ((code_unit3 & 0xC0) != 0x80) goto ERROR3;
            return (code_unit1 << 12) + (code_unit2 << 6) + code_unit3 - 0xE2080;
        }
        else if (code_unit1 < 0xF5) {
            if (*pos >= len) goto ERROR1;
            code_unit2 = bytes[(*pos)++]; // 4-byte sequence
            if ((code_unit2 & 0xC0) != 0x80) goto ERROR2;
            if (code_unit1 == 0xF0 && code_unit2 <  0x90) goto ERROR2; // overlong
            if (code_unit1 == 0xF4 && code_unit2 >= 0x90) goto ERROR2; // > U+10FFFF
            if (*pos >= len) goto ERROR2;
            code_unit3 = bytes[(*pos)++];
            if ((code_unit3 & 0xC0) != 0x80) goto ERROR3;
            if (*pos >= len) goto ERROR3;
            code_unit4 = bytes[(*pos)++];
            if ((code_unit4 & 0xC0) != 0x80) goto ERROR4;
            return (code_unit1 << 18) + (code_unit2 << 12) + (code_unit3 << 6) + code_unit4 - 0x3C82080;
        }
        else goto ERROR1; // > U+10FFFF

        ERROR4:
        (*pos)--;
        ERROR3:
        (*pos)--;
        ERROR2:
        (*pos)--;
        ERROR1:
        return code_unit1 + 0xDC00;
    };

    unsigned c;
    size_t pos = 0;
    size_t pos_before;
    size_t inc = 0;
    bool valid;

    for (;;) {
        pos_before = pos;
        c = read_utf8(bytes, len, &pos);
        inc = pos - pos_before;
        if (!inc) break; // End of string reached.

        valid = false;

        if ( (                 c <= 0x00007F)
        ||   (c >= 0x000080 && c <= 0x0007FF)
        ||   (c >= 0x000800 && c <= 0x000FFF)
        ||   (c >= 0x001000 && c <= 0x00CFFF)
        ||   (c >= 0x00D000 && c <= 0x00D7FF)
        ||   (c >= 0x00E000 && c <= 0x00FFFF)
        ||   (c >= 0x010000 && c <= 0x03FFFF)
        ||   (c >= 0x040000 && c <= 0x0FFFFF)
        ||   (c >= 0x100000 && c <= 0x10FFFF) ) valid = true;

        if (c >= 0xDC00 && c <= 0xDCFF) {
            valid = false;
        }

        do results.push_back(valid); while (--inc);
    }

    size_t sz = results.size();
    for (size_t i = 0; i < sz; ++i) {
        if (results[i]) smooth.push_back(hairy.at(i));
    }

    hairy.swap(smooth);
}

std::vector<unsigned char> sha256(const unsigned char *bytes, size_t len, bool hex) {
    char buf[256];
    SHA256_CTX context;
    unsigned char md[SHA256_DIGEST_LENGTH];
    std::vector<unsigned char> result;
    if (hex) result.reserve(2*SHA256_DIGEST_LENGTH+1);
    else     result.reserve(SHA256_DIGEST_LENGTH);

    SHA256_Init(&context);
    SHA256_Update(&context, bytes, len);
    SHA256_Final(md, &context);

    if (hex) {
        for (size_t i=0;i<SHA256_DIGEST_LENGTH;i++) {
            sprintf(buf,"%02x",md[i]);
            result.push_back(buf[0]);
            result.push_back(buf[1]);
        }
        result.push_back(0);
    }
    else {
        for (size_t i=0;i<SHA256_DIGEST_LENGTH;i++) {
            result.push_back(md[i]);
        }
    }

    return result;
}

