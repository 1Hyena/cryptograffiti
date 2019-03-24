#ifndef UTILS_H_23_03_2019
#define UTILS_H_23_03_2019

#include <vector>
#include <string>
#include <stdio.h>

void trim_utf8(std::vector<unsigned char> &hairy);
std::vector<unsigned char> sha256(const unsigned char *bytes, size_t len, bool hex =true);
bool hex2bin(const char *hex, std::vector<unsigned char> *bin =nullptr);
void str2hex(const char *str, std::string &hex);

#endif

