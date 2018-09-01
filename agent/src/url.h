#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits>

#include <curl/curl.h>
#include <utils.h>

extern CURL * curl;
extern int curl_timeout;

int url_request(const char* address, std::string* response, VARSET *get, VARSET *post);
int url_request(const char* address, std::string* response, VARSET *get);
int url_request(const char* address, std::string* response);

int url_post(const char* address, std::string* response, const char* data);
