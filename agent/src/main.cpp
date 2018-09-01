#include <errno.h>
#include <string.h>
#include <math.h>
#include <stdlib.h>
#include <sys/time.h>
#include <stdarg.h>
#include <stdio.h>
#include <fstream>
#include <sstream>
#include <unistd.h>

#include <utils.h>
#include <scribe.h>

#include "url.h"
#include "main.h"
#include "handler.h"
#include "port.h"
#include "fun.h"

time_t current_time;
std::map<std::string, std::string> main_args;
std::vector<PORT *> ports;
std::string logfile_name = "";
NETWORKER *nw            = NULL;
SCRIBE    *scribe        = NULL;
bool terminating         = false;

int main( int argc, char **argv ) {
    bool scribe_failure = false;
    bool closing = false;
    if (!init(argc, argv)) {
        delete scribe;
        delete nw;
        return EXIT_FAILURE;
    }

    scribe->lua_call_va("Main", "main", ">");
    while( (scribe_failure = scribe->get_error_code()) == 0) {
        nw->poll();
        nw->update();

        // New connections will be recognized:
        int id;
        while ((id = nw->next_pending_desc()) != 0) {
            PORT_PLAIN *port = new PORT_PLAIN;
            if (port) {
                port->set_descriptor_id(id);
                ports.push_back(port);
            }
        }
        size_t sz = ports.size();

        // Process each port:
        for (size_t i=0; i<sz; ++i) {
            if (ports[i] == NULL || ports[i]->is_broken()) continue;
            handle(ports[i]);
            sz = ports.size(); // If new ports were created
        }

        scribe->step();
        scribe->tidy();

        // Flush each port, sending all the pending bytes:
        for (size_t i=0; i<sz; ++i) {
            if (ports[i] == NULL || ports[i]->is_broken()) continue;
            ports[i]->flush();
        }

        nw->flush();
        nw->tidy();

        // Disconnected clients will be removed:
        std::vector<PORT *> good_ports;
        sz = ports.size();
        for (size_t i=0; i<sz; i++) {
            if (ports[i] == NULL) continue;
            if (ports[i]->is_broken()) {
                delete ports[i];
                continue;
            }
            good_ports.push_back(ports[i]);
        }
        ports = good_ports;

        if (scribe->thread_count() == 0) {
            terminating = true;
        }

        rest();
        if (closing) break;

        if (last_signal) {
            char *str = strsignal(last_signal);
            LOG("Caught signal %d (%s).",last_signal, str ? str : "NULL");
            if (last_signal != SIGPIPE) {
                closing = true; // Give some time for the script to catch it too.
            }
            else last_signal = 0;
        }
        if (terminating) {
            LOG("Initiating normal termination of Bitbroker.");
            closing = true;
        }
    }

    deinit();

    return scribe_failure ? EXIT_FAILURE : EXIT_SUCCESS;
}

bool init( int argc, char **argv ) {
    static struct timeval last_time;
    gettimeofday( &last_time, NULL );
    current_time = (time_t) last_time.tv_sec;

    signal(SIGINT,  signal_callback_handler);
    signal(SIGPIPE, signal_callback_handler);

    utils_log_callback = &log_text;

    nw = new NETWORKER("UI");
    if (!nw) return false;
    nw->log = &log_snet;

    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();

    SCRIBE::log = &log_scribe;
    scribe = new SCRIBE("");
    if (!scribe) return false;

    // Register C functions that can be called from Lua scripts:
    for (size_t i=0;; i++) {
        if (fun_table[i].function == NULL) break;
        scribe->set_fun(fun_table[i].name.c_str(),
                        fun_table[i].function);
    }

    scribe->start("./");
    scribe->load("Main", "Main.lua", NULL);
    if (scribe->get_error_code() != 0) return false;

    ports.clear();

    std::string var = "";
    std::string val = "";
    for (int i=1; i<=argc; ++i) {
        if (var.length() > 0) main_args[var] = val;
        if (i>=argc) break;
        if (argv[i][0]=='-') var = &(argv[i][1]);
        else                 val = argv[i];
    }

    if (main_args.find("cfgfile") != main_args.end()) {
        std::ifstream cfgfile(main_args["cfgfile"].c_str());

        if (cfgfile.is_open()) {
            std::string line;
            std::string var;
            std::string val;
            std::string *buf = NULL;
            size_t linenr = 0;
            while (std::getline(cfgfile, line)) {
                std::istringstream iss(line);
                linenr++;

                var = "";
                val = "";
                buf = &var;
                size_t len = line.length();
                for (size_t i=0; i<len; ++i) {
                    if (line[i] == '#') {
                        buf = NULL;
                        break;
                    }
                    if (line[i] == '=') {
                        buf = &val;
                        continue;
                    }
                    buf->append(1, line[i]);
                }

                if (buf == NULL) continue;
                if (buf == &var && var.length() == 0) continue;

                if (buf == &var) {
                    LOG("\x1B[1;31mError reading %d. line of %s.\x1B[0m", linenr, main_args["cfgfile"].c_str());
                }
                else main_args[var] = val;
            }
            cfgfile.close();
        }
        else {
           char cwd[1024];
           if (getcwd(cwd, sizeof(cwd)) == NULL) strcpy(cwd,"(null)");

           LOG("\x1B[1;31mCould not open %s/%s!\x1B[0m", cwd, main_args["cfgfile"].c_str());
        }
    }
    else {
        LOG("\x1B[1;31mConfiguration file parameter missing!\x1B[0m");
        LOG("\x1B[1;31mExample: %s -cfgfile ./bitbroker.conf\x1B[0m", argv[0]);
    }

    LOG("\x1B[1;32mBitbroker is ready to rock!\x1B[0m");
    return true;
}

void deinit(void) {
    while (!ports.empty()) {
        delete ports.back();
        ports.pop_back();
    }

    if (nw->is_tcp_running()) nw->close_tcp();
    LOG("\x1B[32mExiting Bitbroker.\x1B[0m");

    delete scribe;
    curl_easy_cleanup(curl);
    curl_global_cleanup();
    delete nw;
}

void rest(void) {
    static struct timeval last_time;
    static bool first=true;
    if (first){
        gettimeofday( &last_time, NULL );
        current_time = (time_t) last_time.tv_sec;
        first=false;
    }
    struct timeval now_time;
    long secDelta;
    long usecDelta;

    gettimeofday( &now_time, NULL );
    usecDelta	= ((int) last_time.tv_usec) - ((int) now_time.tv_usec) + 1000000 / PULSE_PER_SECOND;
    secDelta	= ((int) last_time.tv_sec ) - ((int) now_time.tv_sec );

    while ( usecDelta < 0 ) {
        usecDelta += 1000000;
        secDelta  -= 1;
    }
    while ( usecDelta >= 1000000 ) {
        usecDelta -= 1000000;
        secDelta  += 1;
    }

    if ( secDelta > 0 || ( secDelta == 0 && usecDelta > 0 ) ) {
        struct timeval stall_time;

        stall_time.tv_usec = usecDelta;
        stall_time.tv_sec  = secDelta;

        if ( select( 0, NULL, NULL, NULL, &stall_time ) < 0 && errno != EINTR ) {
            perror( "rest: select: stall" );
            exit( 1 );
        }
    }
    gettimeofday( &last_time, NULL );
    current_time = (time_t) last_time.tv_sec;

    return;
}

void log_snet(const char * text) {
    LOG("SNet: %s", text);
}

void log_scribe(const char * text) {
    LOG("%s", text);
}

void log_text(const char * text) {
    static bool append = false;
    time_t cur_time;
    struct timeval last_time;
    gettimeofday( &last_time, NULL );
    cur_time = (time_t) last_time.tv_sec;

    char *strtime;
    strtime = ctime((const time_t *)(&cur_time));
    strtime[strlen(strtime) - 1] = '\0';
    fprintf(stderr, "%s :: %s\n\r", strtime, text);

    if (logfile_name.length() > 0) {
        FILE *fp = fopen(logfile_name.c_str(), append ? "a" : "w");
        if (!fp) {
            fprintf(stderr, "Unable to open %s for %s.\n\r",
                    logfile_name.c_str(), append ? "appending" : "writing");
            return;
        }

        fprintf(fp, "%s :: %s\n", strtime, text);
        fclose(fp);

        append = true;
    }
}

PORT * find_port(int id) {
    size_t s = ports.size();
    for (size_t i=0;i<s;++i) {
        PORT *p = ports[i];
        if (p == NULL || p->is_broken()) continue;
        if (p->get_id() == id) return p;
    }
    return NULL;
}

void flush_port(int id) {
    PORT *p = find_port(id);
    if (p) p->flush();
}

