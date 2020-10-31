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

    std::string calc_txid(const unsigned char *, size_t) const;

    uint32_t read_uint32(const unsigned char **) const;
    uint64_t read_uint64(const unsigned char **) const;
    uint64_t read_varint(const unsigned char **) const;

    private:

    bool decode(
        const unsigned char *bytes, size_t len, std::queue<graffiti_type> &to,
        size_t offset
    ) const;

    bool get_opret_segments(
        const unsigned char* bytes, size_t len, std::map<size_t, size_t> &to
    ) const;

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
