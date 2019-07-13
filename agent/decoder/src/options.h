#ifndef OPTIONS_H_23_03_2019
#define OPTIONS_H_23_03_2019

#include <string>
#include <getopt.h>
#include "utils.h"

class OPTIONS {
    public:

    OPTIONS(
        const char *version,
        void      (*log_fun) (const char *, const char *, ...) =drop_log,
        const char *log_src ="options"
    ) : verbose         (      0)
      , content         (      0)
      , max_sys_cmd_len (     -1)
      , exit_flag       (      0)
      , name            (     "")
      , hash            (     "")
      , unicode         (      0)
      , version         (version)
      , logfrom         (log_src)
      , log             (log_fun) {}

    ~OPTIONS() {}

    int verbose;
    int content;
    int max_sys_cmd_len;
    int exit_flag;
    std::string name;
    std::string hash;
    int unicode;

    std::string print_usage() const {
        char line[256];

        std::snprintf(line, sizeof(line), "Usage: %s [options]\n", name.c_str());
        std::string result(line);

        result.append(
            "Options:\n"
            "      --brief           Print brief information (default).\n"
            "  -h  --help            Display this usage information.\n"
            "  -m  --max-cmd-len     Maximum system command length (default is -1).\n"
            "                            Provide a negative number to automatically\n"
            "                            determine a good value for this parameter.\n"
            "  -H  --hash            Decode only the graffiti with the given hash.\n"
            "  -u  --unicode-len     Maximum UTF8 preview length (default is 0).\n"
            "      --verbose         Print verbose information.\n"
            "      --content         Include graffiti content.\n"
            "  -v  --version         Show version information.\n"
        );

        return result;
    }

    bool init(int argc, char **argv) {
        int c;
        name = argv[0];
        while (1) {
            static struct option long_options[] = {
                // These options set a flag:
                {"brief",               no_argument,         &verbose,           0 },
                {"verbose",             no_argument,         &verbose,           1 },
                {"content",             no_argument,         &content,           1 },
                // These options may take an argument:
                {"help",                no_argument,              0,            'h'},
                {"version",             no_argument,              0,            'v'},
                {"max-cmd-len",         required_argument,        0,            'm'},
                {"unicode-len",         required_argument,        0,            'u'},
                {"hash",                required_argument,        0,            'H'},
                {0,                     0,                        0,             0 }
            };

            int option_index = 0;
            c = getopt_long(argc, argv, "hvm:u:H:", long_options, &option_index);
            if (c == -1) break; // End of command line parameters?

            switch (c) {
                case 0: {
                    // If this option sets a flag do nothing else.
                    if (long_options[option_index].flag != 0) break;
                    std::string buf="option ";
                    buf.append(long_options[option_index].name);
                    if (optarg) {
                        buf.append(" with arg ");
                        buf.append(optarg);
                    }
                    log(logfrom.c_str(), buf.c_str());
                    break;
                }
                case 'm':
                    {
                        int i = atoi(optarg);
                        if (i == 0 && (optarg[0] != '0' || optarg[1] != '\0')) {
                            log(logfrom.c_str(), "max-cmd-len invalid: %s", optarg);
                        }
                        else max_sys_cmd_len = i;
                    }
                    break;
                case 'u':
                    {
                        int i = atoi(optarg);
                        if (i == 0 && (optarg[0] != '0' || optarg[1] != '\0')) {
                            log(logfrom.c_str(), "unicode-len invalid: %s", optarg);
                        }
                        else unicode = i;
                    }
                    break;
                case 'H': {
                    if (hex2bin(optarg)) hash.assign(optarg);
                    else {
                        log(logfrom.c_str(), "hash is invalid hex: %s", optarg);
                    }
                    break;
                }
                case 'h': {
                    std::cout << print_usage() << std::endl;
                    exit_flag = 1;
                    break;
                }
                case 'v':
                    std::cout << version << std::endl;
                    exit_flag = 1;
                    break;
                case '?':
                    // getopt_long already printed an error message.
                    break;
                default: return false;
            }
        }

        if (exit_flag) return true;

        while (optind < argc) {
            log(logfrom.c_str(), "unidentified argument: %s", argv[optind++]);
        }
        return true;
    }

    private:
    static void drop_log(const char *, const char *, ...) {}

    std::string version;
    std::string logfrom;
    void (*log)(const char *, const char *p_fmt, ...);
};

#endif

