#include "program.h"

int main(int argc, char **argv) {
    std::string comment;
    int exit_status = EXIT_FAILURE;
    PROGRAM program(argv[0], "0.2");

    if (program.init(argc, argv)) {
        program.run();
        comment.assign(program.get_comment());
        exit_status = program.deinit();
    }

    if (PROGRAM::get_log_size() == 0
    &&  exit_status == EXIT_FAILURE) {
        if (!comment.empty()) {
            comment.append(": process exits with errors");
            PROGRAM::log(argv[0], "%s", comment.c_str());
        }
        else PROGRAM::log(argv[0], "process exits with errors");
    }

    return exit_status;
}
