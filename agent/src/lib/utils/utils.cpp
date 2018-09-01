#include <stdlib.h>
#include <sys/time.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>

#include "utils.h"

/*
 * Return true if an argument is completely numeric.
 */
bool is_number ( char *arg ) {
    if ( *arg == '\0' ) return false;
    if ( *arg == '+' || *arg == '-' ) arg++;

    for ( ; *arg != '\0'; arg++ ) {
        if ( !isdigit( *arg ) )
            return false;
    }

    return true;
}

long number_mm( void ) {
    return random() >> 6;
}

int number_range( int from, int to ) {
    int power;
    int number;

    if (from == 0 && to == 0)          return 0;
    if ( ( to = to - from + 1 ) <= 1 ) return from;

    for ( power = 2; power < to; power <<= 1 );

    while ( ( number = number_mm() & (power -1 ) ) >= to );

    return from + number;
}

void utils_log_dummy(const char *) {
    static bool first=true;
    if (first) {
        fprintf(stderr, "Error! Callback function for logging is not set.\n\r"
                        "void (*utils_log_callback)(const char *);\n\r"
                        "utils_log_callback = &log; // Where log is your callback function.\n\r");
        first = false;
    }
}
void (*utils_log_callback)(const char *)=&utils_log_dummy;

void utils_log( const char *p_fmt, ... ) {
    va_list    ap;
    char       *buf = NULL;
    char       *newbuf = NULL;
    std::string buf2;
    int			buffered = 0;
    int			size = 1024;

    // Nothing to be written?
    if (p_fmt == NULL) return;

    buf = (char *) malloc (size * sizeof (char));

    // Basically a safe vsprintf
    while (1) {
        va_start (ap, p_fmt);

        buffered = vsnprintf (buf, size, p_fmt, ap);

        va_end (ap);

        if (buffered > -1 && buffered < size) break;

        if (buffered > -1)
            size = buffered + 1;
        else
            size *= 2;
        if ((newbuf = (char *) realloc (buf, size)) == NULL) {
            free (buf);
            return;
        } else {
            buf = newbuf;
        }
    }

    utils_log_callback(buf);

    // Free the temporary buffer
    free (buf);
}

void to_binary_as_string(int number, std::string * to) {
    char buf[32];
    int remainder;

    if(number <= 1) {
        sprintf(buf, "%d",number);
        to->append(buf);
        return;
    }

    remainder = number%2;
    to_binary_as_string(number >> 1, to);

    sprintf(buf, "%d",remainder);
    to->append(buf);
}

uint16_t read_uint16(uint8_t *arr) {
    uint16_t result;
    result = arr[0] << 8 | arr[1];
    return result;
}

uint32_t read_uint32(uint8_t *arr) {
    uint32_t result;
    result = arr[0] << 24 | arr[1] << 16 | arr[2] << 8 | arr[3];
    return result;
}

uint64_t read_uint64(uint8_t *arr) {
    uint64_t result = 0;
    uint64_t buf    = 0;

    buf = arr[0]; buf = buf << 56; result |= buf;
    buf = arr[1]; buf = buf << 48; result |= buf;
    buf = arr[2]; buf = buf << 40; result |= buf;
    buf = arr[3]; buf = buf << 32; result |= buf;
    buf = arr[4]; buf = buf << 24; result |= buf;
    buf = arr[5]; buf = buf << 16; result |= buf;
    buf = arr[6]; buf = buf <<  8; result |= buf;
    buf = arr[7];                  result |= buf;

    return result;
}


const char * hash_bytes(const char *str, size_t len) {
    SHA256_CTX context;
    unsigned char md[SHA256_DIGEST_LENGTH];
    static std::string buffer;
    //static char buffer[MSL]="";
    char buf[256];
    //buffer[0]='\0';
    buffer.clear();

    SHA256_Init(&context);
    SHA256_Update(&context, (unsigned char*)str, len);
    SHA256_Final(md, &context);

    for (size_t i=0;i<SHA256_DIGEST_LENGTH;i++) {
        sprintf(buf,"%02x",md[i]);
        buffer.append(buf);
        //strcat(buffer,buf);
    }

    return buffer.c_str();
}

const char * hash_pass(const char *str) {
    return hash_bytes(str,strlen(str));
}

const char *base64(const unsigned char *input, int length) {
    static char *buff=NULL;

    if (buff) {
        free(buff);
        buff=NULL;
    }

    BIO *bmem, *b64;
    BUF_MEM *bptr;

    b64 = BIO_new(BIO_f_base64());
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    bmem = BIO_new(BIO_s_mem());
    b64 = BIO_push(b64, bmem);
    BIO_write(b64, input, length);
    if (BIO_flush(b64) == 1) {
        BIO_get_mem_ptr(b64, &bptr);

        buff = (char *)malloc(bptr->length+1);
        memcpy(buff, bptr->data, bptr->length);
        buff[bptr->length] = 0;
    }

    BIO_free_all(b64);
    return buff;
}

const unsigned char *unbase64(const char *input, int *out_length) {
    int length = strlen(input);
    static unsigned char *buff=NULL;

    if (buff) {
        free(buff);
        buff=NULL;
    }

    BIO *b64, *bmem;

    buff = (unsigned char *)calloc(length, sizeof(char));
    //memset(buffer, 0, length+1);

    b64 = BIO_new(BIO_f_base64());
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    bmem = BIO_new_mem_buf((void *)input, length);
    bmem = BIO_push(b64, bmem);

    int final_length = BIO_read(bmem, buff, length);
    //buffer[length] = '\0';

    BIO_free_all(bmem);

    *out_length = final_length;
    //LOG("unbasing: %d input becomes %d output.", length, final_length);

    return buff;
}

void AES_256_encrypt(const unsigned char * input,
                     const unsigned char * key_32bytes,
                     const unsigned char * iv_16bytes,
                     int input_length, std::vector<unsigned char> *output) {
    AES_KEY key;
    AES_set_encrypt_key(key_32bytes, 256, &key);

    unsigned char ivec[16];
    int num = 0;
    memcpy(ivec, iv_16bytes, 16);

    size_t bytes_read;
    unsigned char indata[AES_BLOCK_SIZE+1];
    unsigned char outdata[AES_BLOCK_SIZE];

    size_t block = 0;
    while (1) {
        bytes_read = 0;
        size_t i=0;
        for (i=0; i<AES_BLOCK_SIZE; i++) {
            if ((int)(block*AES_BLOCK_SIZE+i) >= input_length) break;
            indata[i] = input[block*AES_BLOCK_SIZE+i];
            bytes_read++;
        }
        indata[i] = '\0';

        if (bytes_read == 0) break;

        AES_cfb128_encrypt(indata, outdata, bytes_read, &key, ivec, &num, AES_ENCRYPT);

        for (size_t i=0; i<bytes_read; i++) {
            output->push_back(outdata[i]);
        }

        block++;

        if (bytes_read < AES_BLOCK_SIZE) break;
    }

    return;
}

void AES_256_decrypt(const unsigned char * input,
                     const unsigned char * key_32bytes,
                     const unsigned char * iv_16bytes,
                     int input_length, std::vector<unsigned char> *output) {
    AES_KEY key;
    AES_set_encrypt_key(key_32bytes, 256, &key);

    unsigned char ivec[16];
    int num = 0;
    memcpy(ivec, iv_16bytes, 16);

    size_t bytes_read;
    unsigned char indata[AES_BLOCK_SIZE];
    unsigned char outdata[AES_BLOCK_SIZE+1];

    size_t block = 0;
    while (1) {
        bytes_read = 0;
        for (size_t i=0; i<AES_BLOCK_SIZE; i++) {
            if ((int)(block*AES_BLOCK_SIZE+i) >= input_length) break;
            indata[i] = input[block*AES_BLOCK_SIZE+i];
            bytes_read++;
        }

        if (bytes_read == 0) break;

        AES_cfb128_encrypt(indata, outdata, bytes_read, &key, ivec, &num, AES_DECRYPT);
        outdata[bytes_read] = '\0';

        for (size_t i=0; i<bytes_read; i++) {
            output->push_back(outdata[i]);
        }

        block++;

        if (bytes_read < AES_BLOCK_SIZE) break;
    }

    return;
}

char hex_to_bin(unsigned char b) {
         if(b >= 48 && b <=  57) return b - 48;
    else if(b >= 97 && b <= 102) return b - 97 + 10;
    else if(b >= 65 && b <=  70) return b - 65 + 10;
	return -1;
}

void hex_to_bin(const char *hex_str, std::vector<unsigned char> *out) {
    int len = strlen(hex_str);

    for(int i = 0; i < len; i = i+2){
	    unsigned char b1 = hex_str[i];
	    unsigned char b2 = hex_str[i+1];

	    char i1 = hex_to_bin(b1);
	    char i2 = hex_to_bin(b2);

	    if(i1 != -1 && i2 != -1) {
		    unsigned char bin = (unsigned char)(i1 * 16 + i2);
		    out->push_back(bin);
	    }
    }
}

bool hex_to_bin(const char *hex_str, unsigned char *out, size_t out_len) {
    int len = strlen(hex_str);

    size_t out_pos = 0;
    for(int i = 0; i < len; i = i+2){
	    unsigned char b1 = hex_str[i];
	    unsigned char b2 = hex_str[i+1];

	    char i1 = hex_to_bin(b1);
	    char i2 = hex_to_bin(b2);

	    if(i1 != -1 && i2 != -1) {
		    unsigned char bin = (unsigned char)(i1 * 16 + i2);
		    if (out_pos >= out_len) return false;
		    out[out_pos++] = bin;
	    }
    }
    return (out_pos == out_len);
}

const char * hash_MD5(const char *string) {
    unsigned char digest[16];

    MD5_CTX ctx;
    MD5_Init(&ctx);
    MD5_Update(&ctx, string, strlen(string));
    MD5_Final(digest, &ctx);

    static char mdString[33];
    for (int i = 0; i < 16; i++) sprintf(&mdString[i*2], "%02x", (unsigned int)digest[i]);

    return mdString;
}

void hash_bytes_MD5(const unsigned char *bytes, size_t size, unsigned char * out16_bytes) {
    unsigned char digest[16];

    MD5_CTX ctx;
    MD5_Init(&ctx);
    MD5_Update(&ctx, bytes, size);
    MD5_Final(digest, &ctx);

    for (int i = 0; i < 16; i++) out16_bytes[i] = digest[i];
}

unsigned read_utf8(const unsigned char *bytes, size_t len, size_t *pos) {
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
}

