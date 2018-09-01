
#ifndef _UTILS_H_
#define _UTILS_H_

#include <string>
#include <vector>
#include <openssl/sha.h>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/aes.h>
#include <openssl/md5.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

#include "arg.h"     
#include "varset.h"

#define LOG(...) (utils_log(__VA_ARGS__))
#define BUG(...) (LOG(__VA_ARGS__))

#define UMIN(a, b)		((a) < (b) ? (a) : (b))
#define UMAX(a, b)		((a) > (b) ? (a) : (b))
#define URANGE(a, b, c)		((b) < (a) ? (a) : ((b) > (c) ? (c) : (b))) // Look carefully! Lowest value must be the leftmost argument
#define ABS(a)                  ((a) <  0  ?-(a): (a) )
#define LOWER(c)		((c) >= 'A' && (c) <= 'Z' ? (c) + 32 : (c))
#define UPPER(c)		((c) >= 'a' && (c) <= 'z' ? (c) - 32 : (c))

#define BP __asm("int $3") // break point, use continue to continue from a break

extern void (*utils_log_callback)(const char *);

void utils_log( const char *p_fmt, ... );
void utils_log_dummy(const char*);

bool is_number      ( char *arg );
int number_range( int from, int to );

// cstring.cpp
char *first_arg( char *argument, char *arg_first, bool fCase );
bool str_cmp( const char *astr, const char *bstr );
const char *capitalize( const char *str );

void to_binary_as_string(int number, std::string * to);

uint16_t read_uint16(uint8_t *bytes);
uint32_t read_uint32(uint8_t *bytes);
uint64_t read_uint64(uint8_t *bytes);

char hex_to_bin(unsigned char b);
void hex_to_bin(const char *hex_str, std::vector<unsigned char> *out);
bool hex_to_bin(const char *hex_str, unsigned char *out, size_t out_len);

const char          * hash_MD5      (const char *string);
void                  hash_bytes_MD5(const unsigned char *bytes, size_t size, unsigned char * out16_bytes);
const char          * hash_bytes    (const char *bytes, size_t len);
const char          * hash_pass     (const char *str);
const char          * base64        (const unsigned char *input, int length);
const unsigned char * unbase64      (const char *input, int *out_length);

void AES_256_encrypt(const unsigned char * input, 
                     const unsigned char * key_32bytes, 
                     const unsigned char * iv_16bytes,
                     int input_length, std::vector<unsigned char> *output);
                     
void AES_256_decrypt(const unsigned char * input, 
                     const unsigned char * key_32bytes, 
                     const unsigned char * iv_16bytes, 
                     int input_length, std::vector<unsigned char> *output);                     

bool str_suffix( const char *astr, const char *bstr );
bool str_infix( const char *astr, const char *bstr );
bool str_prefix( const char *astr, const char *bstr );

unsigned read_utf8(const unsigned char *bytes, size_t len, size_t *pos);

#endif

