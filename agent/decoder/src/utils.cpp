#include <limits>
#include <cstring>
#include <openssl/sha.h>
#include <zlib.h>

#include "utils.h"

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

void str2hex(const char *str, std::string &hex) {
    char buf[8];
    for (; *str; ++str) {
        sprintf(buf, "%02x", *str);
        hex.append(buf);
    }
}

std::string bin2hex(const unsigned char *bytes, size_t len) {
    std::string hex;
    char buf[8];
    for (size_t i=0; i<len; ++i) {
        sprintf(buf, "%02x", bytes[i]);
        hex.append(buf);
    }
    return hex;
}

bool str2int(char const *s, int *i, int base) {
    char *end;
    long l;
    errno = 0;
    l = strtol(s, &end, base);
    if ((errno == ERANGE && l == std::numeric_limits<long int>::max())
    || l > std::numeric_limits<int>::max()) {
        return false;
    }
    if ((errno == ERANGE && l == std::numeric_limits<long int>::min())
    || l < std::numeric_limits<int>::min()) {
        return false;
    }
    if (*s == '\0' || *end != '\0') {
        return false;
    }
    *i = (int) l;
    return true;
}

double calc_entropy(const unsigned char *bytes, size_t inlen) {
    constexpr const int compressionlevel = Z_BEST_COMPRESSION;
    if (!inlen) return 0.0;

    z_stream zs;
    memset(&zs, 0, sizeof(zs));

    if (inlen > std::numeric_limits<uInt>::max()
    || deflateInit(&zs, compressionlevel) != Z_OK) {
        return std::numeric_limits<double>::quiet_NaN();
    }

    zs.next_in  = (Bytef*) bytes;
    zs.avail_in = (uInt)   inlen;

    int ret;
    char outbuffer[32768];
    size_t outlen = 0;

    do {
        zs.next_out = reinterpret_cast<Bytef*>(outbuffer);
        zs.avail_out = sizeof(outbuffer);

        ret = deflate(&zs, Z_FINISH);

        if (outlen < zs.total_out) {
            outlen += (zs.total_out - outlen);
        }
    } while (ret == Z_OK);

    deflateEnd(&zs);

    if (ret != Z_STREAM_END) {
        return std::numeric_limits<double>::quiet_NaN();
    }

    return ((double) outlen) / ((double)inlen);
}

/* Based on libbase58, see https://github.com/luke-jr/libbase58 for reference.*/
/* Returns the version of a valid Bitcoin address or a negative value if the  */
/* address is invalid.                                                        */
int validate_bitcoin_address(const char *address, unsigned char *payload, size_t payload_sz) {
    static const int8_t b58digits_map[] = {
        -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,
        -1, 0, 1, 2, 3, 4, 5, 6,  7, 8,-1,-1,-1,-1,-1,-1,
        -1, 9,10,11,12,13,14,15, 16,-1,17,18,19,20,21,-1,
        22,23,24,25,26,27,28,29, 30,31,32,-1,-1,-1,-1,-1,
        -1,33,34,35,36,37,38,39, 40,41,42,43,-1,44,45,46,
        47,48,49,50,51,52,53,54, 55,56,57,-1,-1,-1,-1,-1,
    };

    unsigned char addrbin[25];
    size_t addrbinsz = sizeof(addrbin);

    void *bin = (void *) addrbin;
    size_t *binszp = &addrbinsz;
    const char *b58 = address;
    size_t b58sz = strlen(address);

    {
        const unsigned char *b58u = (const unsigned char *) b58;
        unsigned char *binu = (unsigned char *) bin;
        uint32_t outi[(25 + 3) / 4];
        size_t outisz=(25 + 3) / 4;
        uint64_t t;
        uint32_t c;
        size_t i, j;
        uint8_t bytesleft = 25 % 4;
        uint32_t zeromask = bytesleft ? (0xffffffff << (bytesleft * 8)) : 0;
        unsigned zerocount = 0;

        if (!b58sz) b58sz = strlen(b58);
        memset(outi, 0, sizeof(outi));

        /* Leading zeros, just count */
        for (i = 0; i < b58sz && b58u[i] == '1'; ++i) ++zerocount;
        for ( ; i < b58sz; ++i) {
            if (b58u[i] & 0x80) return -1; /* High-bit set on invalid digit */
		    if (b58digits_map[b58u[i]] == -1) return -2; /* Invalid base58 digit */

            c = (unsigned)b58digits_map[b58u[i]];
            for (j = outisz; j--; ) {
                t = ((uint64_t)outi[j]) * 58 + c;
                c = (uint32_t) ((t & 0x3f00000000) >> 32);
                outi[j] = t & 0xffffffff;
            }

            if (c) return -3; /* Output number too big (carry to the next int32) */
            if (outi[0] & zeromask) return -4; /* Output number too big (last int32 filled too far) */
        }

        j = 0;
        switch (bytesleft) {
            case 3: *(binu++) = (outi[0] &   0xff0000) >> 16; // fall through
		    case 2: *(binu++) = (outi[0] &     0xff00) >>  8; // fall through
		    case 1: *(binu++) = (outi[0] &       0xff);  ++j;
		    default: break;
        }

        for (; j < outisz; ++j) {
            *(binu++) = (unsigned char) ((outi[j] >> 0x18) & 0xff);
            *(binu++) = (unsigned char) ((outi[j] >> 0x10) & 0xff);
            *(binu++) = (unsigned char) ((outi[j] >>    8) & 0xff);
            *(binu++) = (unsigned char) ((outi[j] >>    0) & 0xff);
        }

        binu = (unsigned char *) bin; /* Count canonical base58 byte count */
        for (i = 0; i < 25; ++i) {
            if (binu[i]) break;
            --*binszp;
        }
        *binszp += zerocount;
    }

    if (addrbinsz != 25) return -5;
    if (addrbin[0] != 0 && addrbin[0] != 5) return -6;

    {
        unsigned char d1[SHA256_DIGEST_LENGTH], d2[SHA256_DIGEST_LENGTH];
        SHA256(SHA256(addrbin, 21, d1), SHA256_DIGEST_LENGTH, d2);
        if (memcmp(addrbin + 21, d2, 4)) return -7;
    }

    if (payload != nullptr) {
        for (size_t i=0; i<payload_sz && i < 21; ++i) {
            payload[i] = addrbin[1+i];
        }
    }

    return addrbin[0];
}

