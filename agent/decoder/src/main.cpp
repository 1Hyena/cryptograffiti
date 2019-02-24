#include <cstdlib>
#include <iostream>
#include <queue>

#include "json.h"

enum class GRAFFITI {
    NONE,
    OP_RETURN,
    P2PKH
};

struct graffiti_type {
    GRAFFITI index;
    std::vector<unsigned char> payload;
};

const char *PROGRAM_NAME = "cgd";

void trim_utf8(std::string& hairy);
bool hex2bin(const char *hex, std::vector<unsigned char> *bin =nullptr);
bool dump_json(const nlohmann::json &json, const int indent, std::string *to);
int fail(const char *msg = "Invalid TX", const char* file = __builtin_FILE(), int line = __builtin_LINE());

int main(int argc, char **argv) {
    PROGRAM_NAME = argv[0];
    std::string data(std::istreambuf_iterator<char>(std::cin), {});
    nlohmann::json tx = nlohmann::json();

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

    std::vector<graffiti_type> raw_graffiti;

    for (auto &vout : tx["vout"]) {
        if (!vout.count("scriptPubKey")
        ||  !vout.at("scriptPubKey").is_object()) return fail();

        auto &spk = vout["scriptPubKey"];

        if (!spk.count("hex") || !spk.at("hex").is_string()) {
            return fail();
        }

        const std::string &hex = spk["hex"];

        if (!hex.compare(0,2, "6a")) {
            std::vector<unsigned char> bin;
            if (!hex2bin(hex.c_str()+2, &bin)) {
                return fail();
            }
            raw_graffiti.push_back({GRAFFITI::OP_RETURN, {} });
            raw_graffiti.back().payload.swap(bin);
        }
    }

    //if (!dump_json(tx, 4, &data)) return EXIT_FAILURE;
    //std::cout << data << std::endl;

    std::queue<std::string> messages;

    for (auto &graffiti : raw_graffiti) {
        graffiti.payload.push_back(0);
        std::string utf8str((const char *) &(graffiti.payload[0]));
        trim_utf8(utf8str);
        if (utf8str.size() > 2) {
            messages.push(utf8str);
        }
    }

    if (!messages.empty()) {
        std::cout << tx["txid"].get<std::string>() << std::endl;
        while (!messages.empty()) {
            std::cout << messages.front() << std::endl;
            messages.pop();
        }
    }

    return EXIT_SUCCESS;
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
        result = json.dump(indent);
    }
    catch (nlohmann::json::type_error& e) {
        std::cerr << PROGRAM_NAME << ": " << e.what() << std::endl;
        return false;
    }

    to->swap(result);
    return true;
}

int fail(const char *msg, const char* file, int line) {
    std::cerr << PROGRAM_NAME << ": " << msg << " (" << file << ":" << line << ")." << std::endl;
    return EXIT_FAILURE;
}

void trim_utf8(std::string& hairy) {
    std::vector<bool> results;
    std::string smooth;
    size_t len = hairy.size();
    results.reserve(len);
    smooth.reserve(len);
    const unsigned char *bytes = (const unsigned char *) hairy.c_str();

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
        if (results[i]) smooth.append(1, hairy.at(i));
    }

    hairy.swap(smooth);
}

