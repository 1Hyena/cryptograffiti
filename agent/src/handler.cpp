#include <stdio.h>
#include <zlib.h>
#include <algorithm>

#include <utils.h>

#include "main.h"
#include "handler.h"
#include "port.h"

volatile sig_atomic_t last_signal = 0;

void handle(PORT *port) {
    DESCRIPTOR *d = nw->find_descriptor(port->get_descriptor_id());

    if (d == NULL || d->to_tcp() == NULL) {
        // Descriptor not found, the connection has been closed,
        // there's no point to maintain the PORT instance any more.
        port->paralyze();
        return;
    }

    PORT_PLAIN *p = port->to_plain();

    if (p == NULL) {
        LOG("Bad port %d, paralyzing.", port->get_id());
        port->paralyze();
    }
    else {
        std::vector<unsigned char> input;
        d->to_tcp()->fetch_inbuf(&input);

        if (p->virgin) {
            //p->receive_text("Hello, %s!\n\r", d->host.c_str());
            p->virgin=false;
        }

        if (input.size() > 0) {
            p->inbuf.insert(p->inbuf.end(), input.begin(), input.end());
        }

        if (check_flood(&(p->inbuf))) {
            LOG("Warning! Flood detected, closing connection: %s:%s", d->host.c_str());
            port->paralyze();
        }
        else p->handle();
    }

    if (port->is_closing()) {
        port->wait_close();
    }
}

bool check_flood(const std::vector < unsigned char >* buffer) {
    if (buffer == NULL) return false;
    if (buffer->size() > FLOOD_LENGTH) return true;
    return false;
}

void signal_callback_handler(int signum) {
    // Only non-fatal signals can return:
    if (signum == SIGINT
    ||  signum == SIGPIPE) {
        last_signal = signum;
        return;
    }

    // Fatal signals:
    raise (signum);
}

