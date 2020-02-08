#include "graffiti.h"

graffiti_type make_graffiti(
    LOCATION where, size_t offset, const unsigned char &start, size_t length
) {
    return
#if __cplusplus <= 201703L
    __extension__
#endif // __cplusplus
    graffiti_type{
        .where  = where,
        .offset = offset,
        .payload{&start, &start + length}
    };
}

