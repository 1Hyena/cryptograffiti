#include "program.h"

int main(int argc, char **argv) {
    PROGRAM program(argv[0], "0.1");

    if (program.init(argc, argv)) {
        program.run();
        program.deinit();
    }

    if (program.get_status() == EXIT_FAILURE) {
        PROGRAM::log(argv[0], "process exits with errors");
    }

    return program.get_status();
}

