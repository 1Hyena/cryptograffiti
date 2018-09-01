#include <vector>
#include <string>


class ARG {
    public:

    ARG(const char *, bool);
    ARG(const char *);
    ~ARG();

    std::vector<std::string *> args;
    
    const char *get_rest(void);
    const char *get_first(void);

    private:
    void init(const char *, bool);

    std::string rest;
    std::string first;
};



