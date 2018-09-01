#include <string>
#include <string.h>
#include <stdio.h>
#include <vector>
#include <map>

class VARSET {
    public:

    VARSET();
    ~VARSET();

    bool set(const char *name,const char *value);
    bool set(const char *name,int value);
    bool set(const char *name,bool value);
    bool set(const char *name,double value);

    const char   *get_str   (const char *name);
    int           get_int   (const char *name);
    bool          get_bool  (const char *name);
    double        get_double(const char *name);

    void clear(void);
    void fetch(std::map<std::string, std::string> * to);

    bool is_str    (const char *name);
    bool is_int    (const char *name);
    bool is_bool   (const char *name);
    bool is_double (const char *name);
    int  find_var  (const char *name);
    void del_var   (const char *name);

    private:

    std::map<std::string, int>  variables;
    std::map<int, std::string>  s_values;
    std::map<int, int>          i_values;
    std::map<int, bool>         b_values;
    std::map<int, double>       d_values;

    int next_id(void) {return variables.size() + 1;}
};
