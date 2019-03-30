#include <cstdlib>
#include <iostream>
#include <stdarg.h>
#include <queue>

#include "json.h"
#include "options.h"
#include "program.h"
#include "decoder.h"

size_t PROGRAM::log_size = 0;

void PROGRAM::run() {
    if (!options) return bug();
    if (options->exit_flag) {
        status = EXIT_SUCCESS;
        return;
    }

    DECODER decoder(log);
    decoder.set_verbose(options->verbose);

    std::string input(std::istreambuf_iterator<char>(std::cin), {});
    nlohmann::json result = nlohmann::json();

    bool success = decoder.decode(input, &result);

    if (result.count("txid") && result.at("txid").is_string()) {
        comment = result["txid"].get<std::string>();
    }

    if (success) {
        if (result.count("graffiti")
        &&  result.at("graffiti").is_boolean()) {
            if (result["graffiti"].get<bool>()
            ||  options->verbose) {
                if (dump_json(result)) {
                    status = EXIT_SUCCESS;
                }
            }
            else status = EXIT_SUCCESS;
            return;
        }
        else bug();
    }
    else {
        if (result.count("error") && result.at("error").is_string()) {
            std::string error(result["error"].get<std::string>());
            if (comment.empty()) log(get_name(), "%s", error.c_str());
            else log(get_name(), "%s: %s", comment.c_str(), error.c_str());
        }
        else bug();
    }
}

bool PROGRAM::init(int argc, char **argv) {
    options = new (std::nothrow) OPTIONS(get_version(), log);
    if (!options) return false;

    if (!options->init(argc, argv)) {
        return false;
    }

    constexpr const char *prerequisites[] = {
        "xxd",
        "printf",
        "file"
    };

    for (const char *prg : prerequisites) {
        char buf[256];
        std::snprintf(buf, sizeof(buf), "which %s > /dev/null 2>&1", prg);
        if (system(buf) != 0) {
            log(get_name(), "%s: command not found", prg);
            return false;
        }
    }

    return true;
}

int PROGRAM::deinit() {
    if (options) {
        delete options;
        options = nullptr;
    }

    return get_status();
}

int PROGRAM::get_status() const {
    return status;
}

size_t PROGRAM::get_log_size() {
    return PROGRAM::log_size;
}

void PROGRAM::log(const char *origin, const char *p_fmt, ...) {
    va_list ap;
    char *buf = nullptr;
    char *newbuf = nullptr;
    int buffered = 0;
    int	size = 1024;

    if (p_fmt == nullptr) return;
    buf = (char *) malloc (size * sizeof (char));

    while (1) {
        va_start(ap, p_fmt);
        buffered = vsnprintf(buf, size, p_fmt, ap);
        va_end (ap);

        if (buffered > -1 && buffered < size) break;
        if (buffered > -1) size = buffered + 1;
        else               size *= 2;

        if ((newbuf = (char *) realloc (buf, size)) == nullptr) {
            free (buf);
            return;
        } else {
            buf = newbuf;
        }
    }

    std::string logline(origin);
    logline.reserve(size);
    logline.append(": ").append(buf).append("\n");

    PROGRAM::log_size += logline.size();
    std::cerr << logline;
    free(buf);
}

void PROGRAM::bug(const char *file, int line) {
    if (comment.empty()) {
        log(get_name(), "Bug on line %d of %s.", line, file);
        return;
    }

    log(get_name(), "%s: Bug on line %d of %s.", comment.c_str(), line, file);
}

const char *PROGRAM::get_name() const {
    return pname.c_str();
}

const char *PROGRAM::get_version() const {
    return pver.c_str();
}

const char *PROGRAM::get_comment() const {
    return comment.c_str();
}

bool PROGRAM::dump_json(const nlohmann::json &json, const int indent, std::string *to, const char* file, int line) {
    std::string result;

    try {
        if (indent >= 0) result = json.dump(indent);
        else             result = json.dump();
    }
    catch (nlohmann::json::type_error& e) {
        std::cerr << get_name() << ": " << e.what() << " (" << file << ":" << line << ")" << std::endl;
        return false;
    }

    if (to) to->swap(result);
    else std::cout << result << std::endl;

    return true;
}

