#ifndef DECODER_H_23_03_2019
#define DECODER_H_23_03_2019

#include <string>
#include <queue>
#include <map>
#include <set>

#include "json.h"
#include "graffiti.h"

class DECODER {
    public:

    DECODER(
        class PROGRAM *program,
        void      (*log_fun) (const char *, const char *, ...) =drop_log,
        const char *log_src ="decoder"
    ) : logfrom    (log_src)
      , log        (log_fun)
      , verbose    (   true)
      , content    (  false)
      , unicode_len(      0)
      , program    (program) {}

    ~DECODER() {}

    bool decode(const std::string &input, nlohmann::json *json =nullptr);
    void set_verbose(bool value);
    void set_content(bool value);
    void set_file_hash(const std::string &);
    void set_unicode_len(size_t value);
    void set_mime_types(const std::string &);

    bool get_mimetype(
        const unsigned char *bytes, size_t len, std::string &mimetype
    ) const;

    private:

    bool decode(const std::string &hex, std::queue<graffiti_type> &to);
    bool get_opret_segments(
        std::vector<unsigned char> &bytes, std::map<size_t, size_t> &to
    );

    static void drop_log(const char *, const char *, ...) {}

    std::string logfrom;
    void (*log)(const char *, const char *p_fmt, ...);
    bool    verbose;
    bool    content;
    size_t  unicode_len;
    std::string file_hash;
    class PROGRAM *program;
    std::set<std::string> mimetypes;
};

#endif
