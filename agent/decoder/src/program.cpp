#include <cstdlib>
#include <iostream>
#include <stdarg.h>
#include <queue>
#include <chrono>
#include <unistd.h>
#include <thread>

#include "json.h"
#include "options.h"
#include "program.h"
#include "decoder.h"
#include "utils.h"

size_t PROGRAM::log_size = 0;

void PROGRAM::run() {
    if (!options) return bug();
    if (options->exit_flag) {
        status = EXIT_SUCCESS;
        return;
    }

    if (options->max_sys_cmd_len == -1) {
        max_sys_cmd_len = estimate_cmd_buf_size();
    }

    DECODER decoder(this, log);
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
        "xargs",
        "grep",
        "tail",
        "tr",
        "file",
        "identify"
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

size_t PROGRAM::estimate_cmd_buf_size() const {
    constexpr const char *cmd =
        "xargs -r --show-limits </dev/null 2>&1 "
        "| grep 'Size of command buffer we are actually using:' "
        "| tr ' ' '\n' "
        "| tail -n1";
    size_t max_sys_cmd_len = 4096;

    std::FILE *fp = popen(cmd, "re");
    if (!fp) {
        log(get_name(), "Could not execute '%s'.\n", cmd);
        return max_sys_cmd_len;
    }
    else {
        int i;
        char buf[16];
        size_t byte_count = fread(buf, 1, sizeof(buf) - 1, fp);
        buf[byte_count] = 0;
        for (size_t j=0; j<byte_count; ++j) {
            if (!std::isdigit(buf[j])) buf[j] = '\0';
        }
        if (str2int(buf, &i) && i >= 0) max_sys_cmd_len = i;
        else log(get_name(), "Could not extract maximum command length from '%s'.", buf);
    }

    if (pclose(fp) == -1) log(get_name(), "%s: %s", __FUNCTION__, strerror(errno));
    return max_sys_cmd_len;
}

bool PROGRAM::syspipe(const unsigned char *input, size_t len, const std::string &cmd_target, std::vector<unsigned char> *output) const {
    // Write len bytes from input into a temporary file. Then, execute the cmd_target
    // command with popen, feeding the temporary file into its standard input.
    // Read everything from that command and when output is present, write the
    // data into the output vector.
    //
    // If the whole command would not exceed the maximum command length then
    // skip the temporary file creation and provide the input data direction
    // within the command line that is to be executed within popen.
    std::string sys_cmd;
    std::string fname;
    const std::string cmd_prefix = "printf '";
    const std::string cmd_suffix = "' | xxd -p -r | ";
    bool success = true;

    size_t cmd_len = cmd_prefix.size() + 2*len + cmd_suffix.size() + cmd_target.size();
    if (cmd_len+1 < max_sys_cmd_len) {
        sys_cmd.reserve(cmd_len);
        sys_cmd.assign(cmd_prefix);

        char buf[8];
        for (size_t i=0; i<len; ++i) {
            std::snprintf(buf, sizeof(buf), "%02x", input[i]);
            sys_cmd.append(buf);
        }

        sys_cmd.append(cmd_suffix);
        sys_cmd.append(cmd_target);
    }
    else {
        // Fallback to a temporary file.
        char sfn[] = "/tmp/cgd.XXXXXX";
        int fd = mkstemp(sfn);

        if (fd == -1) {
            log(get_name(), "mkstemp: %s", strerror(errno));
            return false;
        }

        ssize_t written = 0;
        size_t total_written = 0;
        size_t total_remains = len;

        std::chrono::time_point<std::chrono::steady_clock> t2, t1;
        t1 = std::chrono::steady_clock::now();

        do {
            written = write(fd, input + total_written, total_remains);

            if (written < 0) {
                int enr = errno;
                if (enr != EINTR && enr != EAGAIN) {
                    log(get_name(), "write: %s", strerror(enr));
                    break;
                }
            }
            else {
                total_written += written;
                total_remains -= std::min(total_remains, (size_t) written);
            }

            t2 = std::chrono::steady_clock::now();
            size_t step_time = std::chrono::duration_cast<std::chrono::milliseconds>(t2-t1).count();
            if (total_remains > 0 && step_time > 3000) {
                log(get_name(), "write: timeout (%s:%d)", __FILE__, __LINE__);
                break;
            }

            std::this_thread::yield();
        }
        while (total_remains > 0);

        if (fsync(fd) < 0) {
            int enr = errno;
            log(get_name(), "fsync: %s (%s:%d)", strerror(enr), __FILE__, __LINE__);
            success = false;
        }

        t1 = std::chrono::steady_clock::now();
        while (true) {
	        if (close(fd) < 0) {
                int enr = errno;

                if (enr != EINTR) {
                    log(get_name(), "close: %s (%s:%d)", strerror(enr), __FILE__, __LINE__);
                    success = false;
                    break;
                }

                t2 = std::chrono::steady_clock::now();
                size_t step_time = std::chrono::duration_cast<std::chrono::milliseconds>(t2-t1).count();
                if (step_time > 3000) {
                    log(get_name(), "close: timeout (%s:%d)", __FILE__, __LINE__);
                    success = false;
                    break;
                }

                std::this_thread::yield();
	        }
	        else break;
	    }

        fname.assign(sfn);

        sys_cmd.assign(cmd_target);
        sys_cmd.append(" <").append(fname);
    }

    {
        FILE *fp;
        errno = 0;
        fp = popen(sys_cmd.c_str(), "r");
        if (fp != nullptr) {
            int c;
            while ( (c = fgetc(fp)) != EOF ) {
                if (c >= 0
                &&  c <= std::numeric_limits<unsigned char>::max()) {
                    if (output) {
                        output->push_back((unsigned char) c);
                    }
                }
            }

            if (pclose(fp) == -1) {
                int enr = errno;
                log(get_name(), "pclose: %s (%s:%d)", strerror(enr), __FILE__, __LINE__);
                success = false;
            }
        }
        else {
            if (errno != 0) {
                int enr = errno;
                log(get_name(), "popen: %s (%s:%d)", strerror(enr), __FILE__, __LINE__);
            }
            else log(get_name(), "popen: fail (%s:%d)", __FILE__, __LINE__);
            success = false;
        }
    }

    if (!fname.empty() && unlink(fname.c_str()) < 0) {
        int enr = errno;
        log(get_name(), "unlink(%s): %s (%s:%d)",
            fname.c_str(), strerror(enr), __FILE__, __LINE__
        );
        success = false;
    }

    return success;
}

