#include <string.h>
#include <assert.h>
#include <openssl/evp.h>

#include <scribe.h>
#include <utils.h>

#include "main.h"
#include "handler.h"
#include "port.h"
#include "url.h"
#include "fun.h"

static int fun_get_signal(lua_State *s) {
    if (!SCRIBE::check_fun(s, 0)) return 1;

    if (last_signal) {
        char *str = strsignal(last_signal);
        lua_pushstring(s, str);
    }
    else lua_pushnil(s);

    return 1;
}

static int fun_get_input(lua_State *s) {
    size_t sz = ports.size();

    lua_newtable(s);
    for (size_t i=0; i<sz; i++) {
        PORT *p = ports[i];
        if (!p || p->is_broken() ) continue;
        PORT_PLAIN *plain = p->to_plain();
        if (!plain) continue;

        DESCRIPTOR *d = nw->find_descriptor(p->get_descriptor_id());
        const char *host = "unknown";
        if (d) host = d->host.c_str();

        int id = p->get_id();
        plain->inbuf.push_back('\0');

        lua_newtable(s);

        //lua_pushstring(s, "id");
        //lua_pushnumber(s, id);
        //lua_settable  (s, -3);

        lua_pushstring(s, "host");
        lua_pushstring(s, host);
        lua_settable  (s, -3);

        lua_pushstring(s, "inbuf");
        lua_pushstring(s, (const char *) &(plain->inbuf)[0]); plain->inbuf.clear();
        lua_settable  (s, -3);

        lua_pushnumber( s, id );
        lua_insert    ( s, -2 );
        lua_settable  ( s, -3 );
    }

    return 1;
}

static int fun_send(lua_State *s) {
    if (!SCRIBE::check_fun(s, 2)) return 1;

    if (!lua_isstring(s, 2)
    ||  !lua_isnumber(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * str = lua_tostring(s, 2);
    int           id = lua_tointeger(s, 1);

    PORT *p = find_port(id);
    PORT_PLAIN *plain = (p ? p->to_plain() : NULL);

    if (plain) {
        plain->receive_text("%s",str);
    }

    return 0;
}

static int fun_disconnect(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isnumber(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    int id = lua_tointeger(s, 1);

    PORT *p = find_port(id);

    if (p) {
        p->paralyze();
    }

    return 0;
}

static int fun_url_request(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1, 3)) return 1;
    int n = lua_gettop(s);

    if (!lua_isstring(s,1)){
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    if ( (n==2 && !lua_istable(s,2) && !lua_isnil(s,2))
    ||   (n==3 && !lua_istable(s,3) && !lua_isnil(s,3)) )  {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char *address = lua_tostring(s,1);

    VARSET *vs_get =NULL;
    VARSET *vs_post=NULL;
    VARSET**vs     =NULL;

    for (int i=2; i<=n; ++i) {
             if (vs == NULL)     vs = &vs_get;
        else if (vs == &vs_get)  vs = &vs_post;
        else if (vs == &vs_post) break;
        if (lua_isnil(s,i)) continue;
        lua_pushvalue(s, i);
        *vs = new VARSET;

        lua_pushnil(s);
        while (lua_next(s, -i) != 0) {
            (*vs)->set(lua_tostring(s, -2), lua_tostring(s,-1));
            //SCRIBE::find_scribe(s)->log_internally("[%d] %p->set(%s, %s)",i,*vs, lua_tostring(s, -2), lua_tostring(s,-1));
            lua_pop(s, 1);
        }
        lua_pop(s, 1);
    }

    std::string response="";
    int ret = url_request(address, &response, vs_get, vs_post);
    if (ret < 0) {
        std::string errstr = "cURL: ";
        errstr.append(response);
        SCRIBE::find_scribe(s)->log_internally(errstr.c_str());
        lua_pushnil(s);
    }
    else {
        lua_pushstring(s, response.c_str());
    }

    delete vs_get;
    delete vs_post;

    return 1;
}

static int fun_url_post(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1, 3)) return 1;

    if (!lua_isstring(s,1)){
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    if (!lua_isstring(s,2) && !lua_isnil(s,2)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    if (!lua_isnumber(s, 3) && !lua_isnil(s,3)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    int default_timeout = curl_timeout;
    curl_timeout = lua_isnil(s,3) ? default_timeout : lua_tointeger(s, 3);

    const char *address = lua_tostring(s,1);
    const char *data    = lua_isnil(s,2) ? NULL : lua_tostring(s,2);

    std::string response="";
    int ret = url_post(address, &response, data);
    if (ret < 0) {
        std::string errstr = "cURL: ";
        errstr.append(response);
        SCRIBE::find_scribe(s)->log_internally(errstr.c_str());
        lua_pushnil(s);
    }
    else {
        lua_pushstring(s, response.c_str());
    }

    curl_timeout = default_timeout;

    return 1;
}

static int fun_get_pps(lua_State *s) {
    if (!SCRIBE::check_fun(s, 0)) return 1;

    lua_pushinteger(s, PULSE_PER_SECOND);

    return 1;
}

static int fun_get_curl_timeout(lua_State *s) {
    if (!SCRIBE::check_fun(s, 0)) return 1;

    lua_pushinteger(s, curl_timeout);

    return 1;
}

static int fun_set_curl_timeout(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isnumber(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    int seconds = lua_tointeger(s, 1);
    curl_timeout = seconds;

    return 0;
}

static int fun_get_logfile(lua_State *s) {
    if (!SCRIBE::check_fun(s, 0)) return 1;

    lua_pushstring(s, logfile_name.c_str());

    return 1;
}

static int fun_set_logfile(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    logfile_name = lua_tostring(s, 1);

    return 0;
}

static int fun_check_system(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * program = lua_tostring(s,1);
    std::string program_name="";

    size_t i;
    for (i=0;;++i) {
        if (program[i] == 0) break;
        if (!isalpha(program[i]) && !isdigit(program[i])) {
            lua_pushstring(s, "incorrect arguments");
            lua_error(s);
            return 1;
        }
        program_name.append(1, program[i]);
    }
    if (i == 0) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    std::string command="which ";
    command.append(program_name);
    command.append(" > /dev/null");

    if (system(command.c_str()) != 0) {
        lua_pushboolean(s, false);
        return 1;
    }

    lua_pushboolean(s, true);
    return 1;
}

static int fun_shutdown(lua_State *s) {
    if (!SCRIBE::check_fun(s, 0)) return 1;
    terminating = true;
    return 0;
}

static int fun_start_tcp(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isnumber(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    int port = lua_tointeger(s, 1);

    if (nw && nw->start_tcp(port)) lua_pushboolean(s, true);
    else lua_pushboolean(s, false);
    return 1;
}

static int fun_close_tcp(lua_State *s) {
    if (!SCRIBE::check_fun(s, 0)) return 1;

    if (nw) nw->close_tcp();

    return 0;
}

static int fun_get_args(lua_State *s) {
    std::map<std::string, std::string>::iterator iter;

    lua_newtable(s);
    for( iter=main_args.begin(); iter!=main_args.end(); ++iter) {
        lua_pushstring(s, iter->first.c_str());
        lua_pushstring(s, iter->second.c_str());
        lua_settable  (s, -3);
    }

    return 1;
}

static int fun_AES_256_encrypt(lua_State *s) {
    if (!SCRIBE::check_fun(s, 3)) return 1;

    if (!lua_isstring(s, 1)
    ||  !lua_isstring(s, 2)
    ||  !lua_isstring(s, 3)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * data   = lua_tostring(s,1);
    const char * hexkey = lua_tostring(s,2);
    const char * hexiv  = lua_tostring(s,3);

    int len = strlen(data);
    unsigned char binkey[32];
    unsigned char biniv [16];

    if (!hex_to_bin(hexkey, binkey, 32)
    ||  !hex_to_bin(hexiv,  biniv,  16)) {
        lua_pushstring(s, "bad hex string");
        lua_error(s);
        return 1;
    }

    std::vector<unsigned char> cryptic;
    AES_256_encrypt((const unsigned char *) data,
                    (const unsigned char *) binkey,
                    (const unsigned char *) biniv,
                    len, &cryptic);

    const char * encoded = base64((const unsigned char *) &cryptic[0], cryptic.size());

    lua_pushstring(s, encoded);
    return 1;
}

static int fun_AES_256_decrypt(lua_State *s) {
    if (!SCRIBE::check_fun(s, 3)) return 1;

    if (!lua_isstring(s, 1)
    ||  !lua_isstring(s, 2)
    ||  !lua_isstring(s, 3)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * edata  = lua_tostring(s,1);
    const char * hexkey = lua_tostring(s,2);
    const char * hexiv  = lua_tostring(s,3);

    unsigned char binkey[32];
    unsigned char biniv [16];

    if (!hex_to_bin(hexkey, binkey, 32)
    ||  !hex_to_bin(hexiv,  biniv,  16)) {
        lua_pushstring(s, "bad hex string");
        lua_error(s);
        return 1;
    }

    int len;
    const unsigned char * data = unbase64(edata, &len);

    std::vector<unsigned char> decoded;
    AES_256_decrypt(data, binkey, biniv, len, &decoded);
    decoded.push_back(0);

    lua_pushstring(s, (const char *) &decoded[0]);
    return 1;
}

static int fun_hash_MD5(lua_State *s) {
    if (!SCRIBE::check_fun(s, 2)) return 1;

    if (!lua_isstring (s, 1)
    ||  !lua_isboolean(s, 2)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * data = lua_tostring(s,1);
    bool         hex  = lua_toboolean(s,2);
    const char * md5  = "";
    char mdString[33];

    if (hex) {
        unsigned char bytes[16];

        std::vector<unsigned char> bin;
        hex_to_bin(data, &bin);
        hash_bytes_MD5(&bin[0], bin.size(), bytes);

        for (int i = 0; i < 16; i++) {
            sprintf(&mdString[i*2], "%02x", (unsigned int) bytes[i]);
        }
        md5 = mdString;
    }
    else {
        md5  = hash_MD5(data);
    }

    lua_pushstring(s, md5);
    return 1;
}

static int fun_hash_SHA256(lua_State *s) {
    if (!SCRIBE::check_fun(s, 2)) return 1;

    if (!lua_isstring(s,  1)
    ||  !lua_isboolean(s, 2)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * data = lua_tostring (s,1);
    bool         hex  = lua_toboolean(s,2);
    const char * sha  = "";

    if (hex) {
        std::vector<unsigned char> out;
        hex_to_bin(data, &out);

        sha = hash_bytes((const char *) &out[0], out.size());
    }
    else {
        sha = hash_pass(data);
    }

    lua_pushstring(s, sha);
    return 1;
}

static int fun_validate_UTF8(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s,  1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    size_t len;
    const unsigned char *bytes = (const unsigned char *) lua_tolstring (s, 1, &len);

    unsigned c;
    size_t pos = 0;
    size_t pos_before;
    size_t inc = 0;
    std::vector<bool> results;
    bool valid;

    while (1) {
        pos_before = pos;
        c = read_utf8(bytes, len, &pos);
        inc = pos - pos_before;
        if (!inc) break; // End of string reached.

        valid = false;

        if ( (c >= 0x000000 && c <= 0x00007F)
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
    assert(len == sz);

    lua_newtable(s);
    for (size_t i = 0; i < sz; ++i) {
        lua_pushboolean(s, results[i]);
        lua_rawseti(s, -2, i+1);
    }

    return 1;
}

static int fun_validate_JPG(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s,  1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    bool ECS = false; // Entropy-Coded Segment
    size_t size, i = 0;
    size_t width = 0, height = 0;
    const unsigned char *data = (const unsigned char *) lua_tolstring (s, 1, &size);

    if (size < 125 || data[0] != 0xFF || data[1] != 0xD8 || data[2] != 0xFF) {
        goto Fail;
    }

    while (1) {
        if (ECS) {
            if (i >= size) goto Fail;
            if (data[i] == 0xFF) {
                if (i+1 >= size) goto Fail;
                if (data[i+1] != 0x00) {
                    ECS = false;
                    continue;
                }
            }
            i++;
            continue;
        }

        unsigned char b1, b2;
        if (i+1 >= size) goto Fail;

        b1 = data[i++]; if (b1 != 0xFF) goto Fail;
        b2 = data[i++];

        switch (b2) {
            case 0xD0:
            case 0xD1:
            case 0xD2:
            case 0xD3:
            case 0xD4:
            case 0xD5:
            case 0xD6:
            case 0xD7:
            case 0xD8:
            case 0xD9: break;
            default: {
                if (i+1 >= size) goto Fail;
                unsigned char len1, len2;
                len1 = data[i  ];
                len2 = data[i+1];
                size_t length = (len1<<8) + len2;

                if (length < 2) goto Fail;

                switch (b2) {
                    case 0xC0:
                    case 0xC1:
                    case 0xC2:
                    case 0xC3:
                    case 0xC5:
                    case 0xC6:
                    case 0xC7:
                    case 0xC9:
                    case 0xCA:
                    case 0xCB:
                    case 0xCD:
                    case 0xCE:
                    case 0xCF: {
                        unsigned char w1, w2, h1, h2;
                        if (i+6 >= size) goto Fail;
                        h1 = data[i+3];
                        h2 = data[i+4]; height = (h1<<8) + h2;
                        w1 = data[i+5];
                        w2 = data[i+6]; width  = (w1<<8) + w2;
                        goto Success;
                    } break;
                    default: break;
                }

                i += length;
            } break;
        }

        if (b2 == 0xDA) {
            ECS = true;
        }
    }

    Fail:
    lua_pushnil(s);
    return 1;

    Success:
    lua_newtable(s);
    lua_pushstring(s, "width");
    lua_pushnumber(s, width);
    lua_settable  (s, -3);
    lua_pushstring(s, "height");
    lua_pushnumber(s, height);
    lua_settable  (s, -3);
    return 1;
}

static int fun_get_mimetype(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s,  1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    size_t size;
    std::string mimetype;
    const unsigned char *data = (const unsigned char *) lua_tolstring (s, 1, &size);

    {
        size_t i;
        std::string command;
        FILE *fp;

        command.append("printf '");
        char buf[32];
        for (i=0; i<size; ++i) {
            sprintf(buf, "%02x", data[i]);
            command.append(buf);
        }
        command.append("' | xxd -p -r | file -b --mime-type -");

        /* Open the command for reading. */
        fp = popen(command.c_str(), "r");
        if (fp == NULL) goto Fail;

        char c;
        bool slash = false;
        while ( (c = fgetc(fp)) != EOF ) {
            if (c == '\n') break;
            if (c == '/') slash = true;
            mimetype.append(1, c);
        }

        pclose(fp);
        if (!slash) goto Fail;
        goto Success;
    }

    Fail:
    lua_pushnil(s);
    return 1;

    Success:
    lua_pushstring(s, mimetype.c_str());

    return 1;
}

static int fun_is_blockchain_file(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    int filesize = 0;
    size_t size;
    const unsigned char *data = (const unsigned char *) lua_tolstring (s, 1, &size);

    if (size >= 40 && (size % 20) == 0) {
#if OPENSSL_VERSION_NUMBER >= 0x1010006f
        EVP_MD_CTX *mdctx = EVP_MD_CTX_new();
        EVP_MD_CTX *partial_ctx = EVP_MD_CTX_new();
#else
        EVP_MD_CTX mdctx;
        EVP_MD_CTX partial_ctx;
#endif
        unsigned char md_value[EVP_MAX_MD_SIZE];
        unsigned int md_len;

#if OPENSSL_VERSION_NUMBER >= 0x1010006f
        EVP_MD_CTX_init(mdctx);
        EVP_DigestInit_ex(mdctx, EVP_ripemd160(), NULL);
#else
        EVP_MD_CTX_init(&mdctx);
        EVP_DigestInit_ex(&mdctx, EVP_ripemd160(), NULL);
#endif

        size_t i = 0;
        while ((i+20) < size) {
            size_t j;
            unsigned char this_chunk[20];
            unsigned char next_chunk[20];

            size_t last_nonzero = 0;
            for (j=0; j<sizeof(this_chunk); ++j) {
                this_chunk[j] = data[i+j];
                if (this_chunk[j] != 0) last_nonzero = j;
            }
            size_t next_i = i+j;

            for (j=0; j<sizeof(next_chunk); ++j) {
                next_chunk[j] = data[next_i+j];
            }

            if (last_nonzero+1 == sizeof(this_chunk)) {
#if OPENSSL_VERSION_NUMBER >= 0x1010006f
                EVP_DigestUpdate(mdctx, this_chunk, sizeof(this_chunk));

                EVP_MD_CTX_init(partial_ctx);
                EVP_MD_CTX_copy(partial_ctx, mdctx);
                EVP_DigestFinal_ex(partial_ctx, md_value, &md_len);
#else
                EVP_DigestUpdate(&mdctx, this_chunk, sizeof(this_chunk));

                EVP_MD_CTX_init(&partial_ctx);
                EVP_MD_CTX_copy(&partial_ctx, &mdctx);
                EVP_DigestFinal_ex(&partial_ctx, md_value, &md_len);
                EVP_MD_CTX_cleanup(&partial_ctx);
#endif

                if (memcmp(md_value, next_chunk, sizeof(next_chunk)) == 0) {
                    filesize = next_i;
                }
            }
            else {
                size_t count = last_nonzero + 1;
                size_t iteration = 0;
                for (size_t first = 0; first < sizeof(this_chunk);) {
#if OPENSSL_VERSION_NUMBER >= 0x1010006f
                    EVP_DigestUpdate(mdctx, &(this_chunk[first]), count);

                    EVP_MD_CTX_init(partial_ctx);
                    EVP_MD_CTX_copy(partial_ctx, mdctx);
                    EVP_DigestFinal_ex(partial_ctx, md_value, &md_len);
#else
                    EVP_DigestUpdate(&mdctx, &(this_chunk[first]), count);

                    EVP_MD_CTX_init(&partial_ctx);
                    EVP_MD_CTX_copy(&partial_ctx, &mdctx);
                    EVP_DigestFinal_ex(&partial_ctx, md_value, &md_len);
                    EVP_MD_CTX_cleanup(&partial_ctx);
#endif

                    if (memcmp(md_value, next_chunk, sizeof(next_chunk)) == 0) {
                        filesize = i + first + count;
                    }

                    ++iteration;
                    first = last_nonzero + iteration;
                    count = 1;
                }
            }

            i = next_i;
        }

#if OPENSSL_VERSION_NUMBER >= 0x1010006f
        EVP_MD_CTX_free(partial_ctx);
        EVP_MD_CTX_free(mdctx);
#else
        //EVP_DigestFinal_ex(&mdctx, md_value, &md_len);
        EVP_MD_CTX_cleanup(&mdctx);
#endif
    }

    lua_pushnumber(s, filesize);
    return 1;
}

/* Based on libbase58, see https://github.com/luke-jr/libbase58 for reference.*/
/* Returns the version of a valid Bitcoin address or a negative value if the  */
/* address is invalid.                                                        */
static int validate_bitcoin_address(const char *address, unsigned char *payload, size_t payload_sz) {
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
                c = (t & 0x3f00000000) >> 32;
                outi[j] = t & 0xffffffff;
            }

            if (c) return -3; /* Output number too big (carry to the next int32) */
            if (outi[0] & zeromask) return -4; /* Output number too big (last int32 filled too far) */
        }

        j = 0;
        switch (bytesleft) {
            case 3: *(binu++) = (outi[0] &   0xff0000) >> 16;
		    case 2: *(binu++) = (outi[0] &     0xff00) >>  8;
		    case 1: *(binu++) = (outi[0] &       0xff);  ++j;
		    default: break;
        }

        for (; j < outisz; ++j) {
            *(binu++) = (outi[j] >> 0x18) & 0xff;
            *(binu++) = (outi[j] >> 0x10) & 0xff;
            *(binu++) = (outi[j] >>    8) & 0xff;
            *(binu++) = (outi[j] >>    0) & 0xff;
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

    if (payload != NULL) {
        for (size_t i=0; i<payload_sz && i < 21; ++i) {
            payload[i] = addrbin[1+i];
        }
    }

    return addrbin[0];
}

static int fun_is_bitcoin_addr(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * addr = lua_tostring(s, 1);
    lua_pushboolean(s, (validate_bitcoin_address(addr, NULL, 0) >= 0));

    return 1;
}

static int fun_bitcoin_addr_to_hex(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    if (!lua_isstring(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    unsigned char payload[20];
    const char * addr = lua_tostring(s, 1);

    if (validate_bitcoin_address(addr, payload, sizeof(payload)) >= 0) {
        size_t i;
        char hex[2*sizeof(payload)+1];

        for (i = 0; i < sizeof(payload); i++) {
            sprintf(&hex[i*2], "%02x", (unsigned int) payload[i]);
        }
        hex[2*sizeof(payload)] = 0;

        lua_pushstring(s, hex);
    }
    else lua_pushnil(s);

    return 1;
}

/* Based on libbase58, see https://github.com/luke-jr/libbase58 for reference.*/
/* Attempts to convert the binary input to a Base58 format and returns true   */
/* on success.                                                                */
static bool generate_bitcoin_address(const unsigned char *payload, char type, char *b58, size_t *b58sz) {
    unsigned char address[25];

    address[0] = ( type == '1' ? 0 :
                   type == '3' ? 5 : 111);
    memcpy(address+1, payload, 20);

    unsigned char d1[SHA256_DIGEST_LENGTH], d2[SHA256_DIGEST_LENGTH];
    SHA256(SHA256(address, 21, d1), SHA256_DIGEST_LENGTH, d2);
    memcpy(address+21, d2, 4);

    {
        static const char b58digits_ordered[] = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        const uint8_t *bin = (const uint8_t *) address;
        int carry;
        ssize_t i, j, high, zcount = 0;
        size_t size;
        size_t uzcount = 0;

        while (uzcount < 25 && !bin[uzcount]) ++uzcount;
        zcount = uzcount;
        size =        (25 - zcount) * 138 / 100 + 1;
        uint8_t buf[ ((25 -      0) * 138 / 100 + 1) ];
        memset(buf, 0, size);
        for (i = zcount, high = size - 1; i < 25; ++i, high = j) {
            for (carry = bin[i], j = size - 1; (j > high) || carry; --j) {
                carry += 256 * buf[j];
                buf[j] = carry % 58;
                carry /= 58;
            }
        }

        for (j = 0; j < (ssize_t) size && !buf[j]; ++j);

        if (*b58sz <= zcount + size - j) {
            *b58sz = zcount + size - j + 1;
            return false;
        }

        if (zcount) memset(b58, '1', zcount);
        for (i = zcount; j < (ssize_t) size; ++i, ++j) b58[i] = b58digits_ordered[buf[j]];
        b58[i] = '\0';
        *b58sz = i + 1;
    }
    return true;
}

static int fun_bitcoin_hex_to_addr(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1, 2)) return 1;

    if (!lua_isstring(s,1)){
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    if (lua_gettop(s) == 2 && !lua_isstring(s,2)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char *hex  = lua_tostring(s,1);
    const char type  = (lua_gettop(s) == 1) ? '1' : lua_tostring(s,2)[0];

    if (type != '1' && type != '3') {
        lua_pushstring(s, "unexpected address type");
        lua_error(s);
        return 1;
    }

    unsigned char payload[20];
    if (!hex_to_bin(hex, payload, 20)) {
        lua_pushstring(s, "bad hex string");
        lua_error(s);
        return 1;
    }

    char address[64];
    size_t addr_len = sizeof(address);
    if (generate_bitcoin_address(payload, type, address, &addr_len)) {
        if (validate_bitcoin_address(address, NULL, 0) >= 0) {
            lua_pushstring(s, address);
            return 1;
        }
    }

    lua_pushnil(s);
    return 1;
}

/* lua function table */
const struct fun_type fun_table[] =
{
    {   "get_signal",                   fun_get_signal           },
    {   "get_input",                    fun_get_input            },
    {   "send",                         fun_send                 },
    {   "disconnect",                   fun_disconnect           },
    {   "url_request",                  fun_url_request          },
    {   "url_post",                     fun_url_post             },
    {   "get_pps",                      fun_get_pps              },
    {   "get_curl_timeout",             fun_get_curl_timeout     },
    {   "set_curl_timeout",             fun_set_curl_timeout     },
    {   "shutdown",                     fun_shutdown             },
    {   "check_system",                 fun_check_system         },
    {   "start_tcp",                    fun_start_tcp            },
    {   "close_tcp",                    fun_close_tcp            },
    {   "get_args",                     fun_get_args             },
    {   "AES_256_encrypt",              fun_AES_256_encrypt      },
    {   "AES_256_decrypt",              fun_AES_256_decrypt      },
    {   "hash_MD5",                     fun_hash_MD5             },
    {   "hash_SHA256",                  fun_hash_SHA256          },
    {   "validate_UTF8",                fun_validate_UTF8        },
    {   "validate_JPG",                 fun_validate_JPG         },
    {   "get_mimetype",                 fun_get_mimetype         },
    {   "is_blockchain_file",           fun_is_blockchain_file   },
    {   "is_bitcoin_addr",              fun_is_bitcoin_addr      },
    {   "bitcoin_addr_to_hex",          fun_bitcoin_addr_to_hex  },
    {   "bitcoin_hex_to_addr",          fun_bitcoin_hex_to_addr  },
    {   "set_logfile",                  fun_set_logfile          },
    {   "get_logfile",                  fun_get_logfile          },
    {	"",                             NULL                     }
};

