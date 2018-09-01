#include "varset.h"

VARSET::VARSET(){
}

VARSET::~VARSET(){
    clear();
}

void VARSET::clear(void) {
    variables.clear();
    i_values.clear();
    d_values.clear();
    s_values.clear();
    b_values.clear();
}

void VARSET::fetch(std::map<std::string, std::string> * to) {
    char buf[1024];
    std::map<std::string, int>::iterator it;

    for ( it=variables.begin() ; it != variables.end(); it++ ) {
        int id = (*it).second;
        std::string variable = (*it).first;
        std::string value = "";
        if (s_values.count(id) > 0) {
            value = s_values[id];
        }
        else if (i_values.count(id) > 0) {
            sprintf(buf,"%d",i_values[id]);
            value = buf;
        }
        else if (d_values.count(id) > 0) {
            sprintf(buf,"%f",d_values[id]);
            value = buf;
        }
        else if (b_values.count(id) > 0) {
            sprintf(buf,"%s", (b_values[id] == true ? "true" : "false") );
            value = buf;
        }
        (*to)[variable] = value;
    }
}

bool VARSET::set(const char *name,const char *value) {
    int id;
    bool changed=true;
    Again:

    id = find_var(name);
    if (id == 0) {
        id = next_id();
        variables[name] = id;
        s_values[id] = value;
    }
    else {
        if (s_values.count(id) == 0) {
            // Another type of this variable already exists:
            del_var(name);
            goto Again;
        }
        else {
            if (!strcmp(s_values[id].c_str(), value)) changed=false;
            s_values[id] = value;
        }
    }
    return changed;
}
bool VARSET::set(const char *name,int value) {
    int id;
    bool changed=true;
    Again:

    id = find_var(name);
    if (id == 0) {
        id = next_id();
        variables[name] = id;
        i_values[id] = value;
    }
    else {
        if (i_values.count(id) == 0) {
            // Another type of this variable already exists:
            del_var(name);
            goto Again;
        }
        else {
            if (i_values[id] == value) changed=false;
            i_values[id] = value;
        }
    }
    return changed;
}

bool VARSET::set(const char *name,bool value) {
    int id;
    bool changed=true;
    Again:

    id = find_var(name);
    if (id == 0) {
        id = next_id();
        variables[name] = id;
        b_values[id] = value;
    }
    else {
        if (b_values.count(id) == 0) {
            // Another type of this variable already exists:
            del_var(name);
            goto Again;
        }
        else {
            if (b_values[id] == value) changed=false;
            b_values[id] = value;
        }
    }
    return changed;
}

bool VARSET::set(const char *name,double value) {
    int id;
    bool changed=true;
    Again:

    id = find_var(name);
    if (id == 0) {
        id = next_id();
        variables[name] = id;
        d_values[id] = value;
    }
    else {
        if (d_values.count(id) == 0) {
            // Another type of this variable already exists:
            del_var(name);
            goto Again;
        }
        else {
            if (d_values[id] == value) changed=false;
            d_values[id] = value;
        }
    }
    return changed;
}

const char* VARSET::get_str(const char *name){
    if (variables.count(name) == 0) return "";
    int id = variables[name];
    return s_values[id].c_str();
}

int VARSET::get_int(const char *name){
    if (variables.count(name) == 0) return 0;
    int id = variables[name];
    return i_values[id];
}

bool VARSET::get_bool(const char *name){
    if (variables.count(name) == 0) return false;
    int id = variables[name];
    return b_values[id];
}

double VARSET::get_double(const char *name){
    if (variables.count(name) == 0) return 0.0;
    int id = variables[name];
    return d_values[id];
}

bool VARSET::is_int(const char *name) {
    if (variables.count(name) == 0) return false;
    int id = variables[name];
    if (i_values.count(id) == 0) return false;
    return true;
}


bool VARSET::is_str(const char *name){
    if (variables.count(name) == 0) return false;
    int id = variables[name];
    if (s_values.count(id) == 0) return false;
    return true;
}

bool VARSET::is_bool(const char *name) {
    if (variables.count(name) == 0) return false;
    int id = variables[name];
    if (b_values.count(id) == 0) return false;
    return true;
}

bool VARSET::is_double(const char *name) {
    if (variables.count(name) == 0) return false;
    int id = variables[name];
    if (d_values.count(id) == 0) return false;
    return true;
}


int VARSET::find_var(const char *name){
    int cnt = variables.count(name);
    if (cnt == 0) return 0;
    return variables[name];
}

void VARSET::del_var(const char *name) {
    int id = find_var(name);
    if (id == 0) return;
    variables.erase(name);
    if (i_values.erase(id)) return;
    if (d_values.erase(id)) return;
    if (s_values.erase(id)) return;
    if (b_values.erase(id)) return;
    return;
}
