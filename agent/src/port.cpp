#include <stdarg.h>
#include <algorithm>
#include <map>

#include <utils.h>

#include "main.h"
#include "port.h"
#include "handler.h"

int PORT::next_id=1;

PORT::PORT() {
    broken=false;
    closing=0;
    id = next_id++;
    descriptor_id = 0;
}

PORT::~PORT() {
    //LOG("Destructor of PORT, id=%d;",id);
}

void PORT::paralyze(void) {
    //LOG("PORT::paralyze;");
    broken=true;

    // Port instance is going to be deleted thus the according
    // descriptor instance should be deleted too.
    nw->paralyze_descriptor(descriptor_id);
}

void PORT::close(void) {
    closing = 3;
}

void PORT::wait_close(void) {
    if (closing > 0) {
        closing--;
        if (closing == 0) {
            paralyze();
        }
    }
}

void PORT::flush(void) {
    return;
}

bool PORT::receive_text(const char * p_fmt, ...) {
    va_list    ap;
    char       *buf = NULL;
    char       *newbuf = NULL;
    std::string buf2;
    int			buffered = 0;
    int			size = 1024;

    // Nothing to be written?
    if (p_fmt == NULL) return true;

    buf = (char *) malloc (size * sizeof (char));

    // Basically a safe vsprintf
    while (1) {
        va_start (ap, p_fmt);

        buffered = vsnprintf(buf, size, p_fmt, ap);

        va_end (ap);

        if (buffered > -1 && buffered < size) break;

        if (buffered > -1)
            size = buffered + 1;
        else
            size *= 2;
        if ((newbuf = (char *) realloc (buf, size)) == NULL) {
            free (buf);
            return false;
        } else {
            buf = newbuf;
        }
    }

    DESCRIPTOR *d = nw->find_descriptor(descriptor_id);
    bool result=true;
    if (d && d->to_tcp()) {
        result = d->to_tcp()->write_to_buffer(buf);
    }

    // Free the temporary buffer
    free (buf);
    return result;
}

bool PORT::receive_bytes(const std::vector < unsigned char >& bytes) {
    DESCRIPTOR *d = nw->find_descriptor(get_descriptor_id());

    if (!d || !d->to_tcp()) return false;

    return d->to_tcp()->write_to_buffer(bytes);
}

// PLAIN PORT:
PORT_PLAIN::PORT_PLAIN() {
    virgin  = true;
}

PORT_PLAIN::~PORT_PLAIN() {
    //LOG("Destructor of PORT_PLAIN;");
}

void PORT_PLAIN::handle(void) {
    //Input handling is done in Lua!
    //receive_bytes(inbuf);
    //inbuf.clear();

    return;
}

void PORT_PLAIN::flush(void) {
    std::vector<unsigned char> message;

    if (message.size() > 0) {
        receive_bytes(message);
    }
}

