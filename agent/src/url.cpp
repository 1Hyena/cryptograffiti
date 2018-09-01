/***************************************************************************
 *                                  _   _ ____  _
 *  Project                     ___| | | |  _ \| |
 *                             / __| | | | |_) | |
 *                            | (__| |_| |  _ <| |___
 *                             \___|\___/|_| \_\_____|
 *
 * Copyright (C) 1998 - 2012, Daniel Stenberg, <daniel@haxx.se>, et al.
 *
 * This software is licensed as described in the file COPYING, which
 * you should have received as part of this distribution. The terms
 * are also available at http://curl.haxx.se/docs/copyright.html.
 *
 * You may opt to use, copy, modify, merge, publish, distribute and/or sell
 * copies of the Software, and permit persons to whom the Software is
 * furnished to do so, under the terms of the COPYING file.
 *
 * This software is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY
 * KIND, either express or implied.
 *
 ***************************************************************************/
#include "url.h"

CURL *curl = NULL;
int curl_timeout = 30;

static size_t write_memory_callback(void *contents, size_t size, size_t nmemb, void *userp) {
    size_t realsize = size * nmemb;
    size_t maxsize  = std::numeric_limits<int>::max() / 8;
    std::vector<unsigned char>* to = (std::vector<unsigned char> *) userp;
    unsigned char* bytes = (unsigned char*) contents;
    to->reserve(realsize);
    //LOG("Writing %lu, capacity %lu (asked for %lu).",realsize, to->capacity(), realsize);
    for (size_t i=0; i<realsize; ++i) {
        if (to->size() >= maxsize) {
            LOG("write_memory_callback: received too many bytes (%lu)!", to->size());
            return i;
        }
        to->push_back(bytes[i]);
    }

    return realsize;
}

// Returns number of received bytes on success. Returns -1 on failure.
// When successful, response will contain the string of received bytes.
// When not successful, response will contain the error message.
int url_request(const char* address, std::string* response, VARSET *vs_get, VARSET *vs_post) {
    std::vector<unsigned char> buf;
    std::string url=address;
    buf.reserve(1024);
    int bytes = 0;
    //CURL *curl;
    CURLcode res = CURLE_OK;
    
    //curl = curl_easy_init();
    
    if(curl) {
        curl_easy_reset(curl);
        
        std::string encoded="";
        if (vs_get) {
            std::map<std::string, std::string> parameters;
            vs_get->fetch(&parameters);

            std::map<std::string, std::string>::iterator it;
            for (it=parameters.begin(); it != parameters.end(); ++it) {
                const char* f = (*it).first.c_str();
                const char* s = (*it).second.c_str();
                char *str = NULL;

                if (it == parameters.begin()) encoded.append("?");
                else                          encoded.append("&");

                str = curl_easy_escape(curl , f, 0);
                encoded.append(str);
                if (str) curl_free(str);

                encoded.append("=");

                str = curl_easy_escape(curl , s, 0);
                encoded.append(str);
                if (str) curl_free(str);
            }
            //LOG("GET_REQUEST: [%s%s]", url.c_str(), encoded.c_str());
            url.append(encoded);
        }
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1); 
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, curl_timeout);
        
        encoded="";
        if (vs_post) {
            std::map<std::string, std::string> parameters;
            vs_post->fetch(&parameters);

            std::map<std::string, std::string>::iterator it;
            for (it=parameters.begin(); it != parameters.end(); ++it) {
                const char* f = (*it).first.c_str();
                const char* s = (*it).second.c_str();
                char *str = NULL;

                if (it != parameters.begin()) encoded.append("&");

                str = curl_easy_escape(curl , f, 0);
                encoded.append(str);
                if (str) curl_free(str);

                encoded.append("=");

                str = curl_easy_escape(curl , s, 0);
                encoded.append(str);
                if (str) curl_free(str);
            }
            curl_easy_setopt(curl, CURLOPT_POST, 1);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, encoded.length());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, encoded.c_str());
            //LOG("POST_REQUEST: [%s]", encoded.c_str());
        }

        /* send all data to this function  */
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_memory_callback);

        /* we pass our 'chunk' struct to the callback function */
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *) &buf);

        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 1L);

        /* Perform the request, res will get the return code */
        res = curl_easy_perform(curl);

        /* Check for errors */
        if(res == CURLE_OK) bytes = buf.size();

        //curl_easy_cleanup(curl);
    }
    else {
        response->assign("library uninitialized");
        return -1;    
    }

    if(res != CURLE_OK) {
        response->assign(curl_easy_strerror(res));
        return -1;
    }
    
    if (!curl) {
        response->assign("Failed to init curl!");
        return -1;        
    }    

    size_t maxint = std::numeric_limits<int>::max();
    if (buf.size() > maxint) {
        response->assign("Received %ul bytes (maximum is %ul).", buf.size(), maxint);
        return -1;
    }
    else {
        buf.push_back(0);
        response->reserve(bytes+1);
        response->assign((const char*) &buf[0]);
    }

    return bytes;
}

int url_request(const char* address, std::string* response, VARSET *vs_get) {
    return url_request(address, response, vs_get, NULL);
}

int url_request(const char* address, std::string* response) {
    return url_request(address, response, NULL, NULL);
}

int url_post(const char* address, std::string* response, const char* data) {
    std::vector<unsigned char> buf;
    std::string url=address;
    buf.reserve(1024);
    int bytes = 0;
    //CURL *curl;
    CURLcode res = CURLE_OK;

    //curl = curl_easy_init();
    
    if (curl) {    
        curl_easy_reset(curl);
        
        std::string encoded="";
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1); 
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, curl_timeout);
        
        if (data) {
            /*char *str = NULL;

            str = curl_easy_escape(curl, f, 0);
            encoded.append(str);
            if (str) curl_free(str);

            encoded.append("=");*/

            curl_easy_setopt(curl, CURLOPT_POST, 1);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, strlen(data));
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data);
            //LOG("POST_REQUEST: [%s]", data);
        }

        /* send all data to this function  */
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_memory_callback);

        /* we pass our 'chunk' struct to the callback function */
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *) &buf);

        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 1L);

        /* Perform the request, res will get the return code */
        res = curl_easy_perform(curl);

        /* Check for errors */
        if(res == CURLE_OK) bytes = buf.size();

        //curl_easy_cleanup(curl);
    }
    else {
        response->assign("library uninitialized");
        return -1;    
    }

    if(res != CURLE_OK) {
        response->assign(curl_easy_strerror(res));
        return -1;
    }

    if (!curl) {
        response->assign("Failed to init curl!");
        return -1;        
    }

    size_t maxint = std::numeric_limits<int>::max();
    if (buf.size() > maxint) {
        response->assign("Received %ul bytes (maximum is %ul).", buf.size(), maxint);
        return -1;
    }
    else {
        //LOG("Received %lu bytes.", buf.size());
        buf.push_back(0);
        response->reserve(bytes+1);
        response->assign((const char*) &buf[0]);
    }

    return bytes;
}
