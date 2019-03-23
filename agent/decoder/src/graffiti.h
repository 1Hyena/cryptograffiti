#ifndef GRAFFITI_H_23_03_2019
#define GRAFFITI_H_23_03_2019

#include <vector>

enum class LOCATION {
    NONE,
    OP_RETURN,
    P2PKH
};

struct graffiti_type {
    LOCATION where;
    std::vector<unsigned char> payload;
};

#endif

