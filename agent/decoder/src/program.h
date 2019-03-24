#ifndef PROGRAM_H_23_03_2019
#define PROGRAM_H_23_03_2019

#include <string>
#include "json.h"

class PROGRAM {
    public:

    PROGRAM(
        const char *name,
        const char *version)
    : pname(name)
    , pver(version)
    , status(EXIT_FAILURE)
    , options(nullptr) {}

    ~PROGRAM() {}

    static size_t get_log_size();
    static void log(const char *, const char *, ...);

    void bug(const char * =__builtin_FILE(), int =__builtin_LINE());
    bool init(int argc, char **argv);
    void run();
    int deinit();
    int get_status() const;

    const char *get_name() const;
    const char *get_version() const;
    const char *get_comment() const;

    private:
    bool dump_json(
        const nlohmann::json &json,
        const int indent =-1,
        std::string *to =nullptr,
        const char* file = __builtin_FILE(),
        int line = __builtin_LINE()
    );

    std::string    pname;
    std::string    pver;
    int            status;
    class OPTIONS *options;
    std::string    comment;

    static size_t log_size;
};

#endif

