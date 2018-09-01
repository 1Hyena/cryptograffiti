#include "utils.h"

ARG::ARG(const char *str, bool fCase){
    init(str,fCase);
}

ARG::ARG(const char *str){
    bool fCase=false;

    init(str,fCase);
}

void ARG::init(const char *str, bool fCase) {
    size_t len = strlen(str);

    char * first = (char*) malloc (len+1);
    if (!first) {
        return;
    }
    char * arg = (char*)str;

    while (*arg) {
        arg = first_arg( arg, first, fCase );
        args.push_back(new std::string(first));
    }

    arg = (char*)str;
    rest = first_arg(arg,first,fCase);

    this->first=first;
    free(first);

    return;
}

ARG::~ARG(){
    while (!args.empty()) {
        if (args.back()!=NULL) delete args.back();
        args.pop_back();
    }
}

const char *ARG::get_first(void) {
    return first.c_str();
}

const char *ARG::get_rest(void) {
    return rest.c_str();
}

