#ifndef GRAFFITI_H_23_03_2019
#define GRAFFITI_H_23_03_2019

#include <vector>

enum class LOCATION {
    NONE,
    NULL_DATA,
    P2PKH
};

struct graffiti_type {
    LOCATION where;
    size_t offset;
    std::vector<unsigned char> payload;
};

graffiti_type make_graffiti(
    LOCATION where,
    size_t offset,
    const unsigned char &start,
    size_t length
);

#endif

