/*
 * See Copyright Notice in snet.h
 */

#include <errno.h>
#include <sys/types.h>
#include <sys/time.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <signal.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>
#include <stdarg.h>

#include "network.h"

#if !defined(FNDELAY)
#define FNDELAY O_NDELAY
#endif

NETWORKER::NETWORKER() {
    init();
}

NETWORKER::NETWORKER(const char * name) {
    init();
    this->name = name;
}

NETWORKER::~NETWORKER() {
    while (!descriptors.empty()) {
        delete (descriptors.back());
        descriptors.pop_back();
    }
}

bool NETWORKER::start_tcp(int port) {
    if (tcp_running) {
        if (port != tcp_port) {
            log_internally("Already listening on TCP port %d.", tcp_port);
            return false;
        }
        return true;
    }

    if (port == 0) tcp_socket = -1;
    else {
        log_internally("Listening on TCP port %d.", port);
        tcp_socket  = init_tcp_socket(port);
        tcp_running = true;
        tcp_port    = port;
        return true;
    }
    return false;
}

void NETWORKER::close_tcp(void) {
    size_t i;
    DESCRIPTOR *d;

    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL
        ||    d->broken()
        ||    d->to_tcp() == NULL) continue;
        d->paralyze();
    }    
    
    if (!tcp_running) return;
    if (tcp_socket != -1) {
        log_internally("Closing TCP port %d.", tcp_port);
        ::close(tcp_socket);
    }
    tcp_running=false;
}

bool NETWORKER::start_udp(int udp_port) {
    log_internally("UDP not implemented!");
    return false;

}

void NETWORKER::close_udp(void) {
    return;
}

void NETWORKER::init(void) {    
    tcp_socket=-1;
    tcp_running=false;

    log  = NULL;
    name = "";    
}

void NETWORKER::init_descriptor(void) {
    DESCRIPTOR *dnew = NULL;
    struct sockaddr_in sock;
    int desc;
    socklen_t size;

    size = sizeof(sock);
    getsockname( (socklen_t)tcp_socket, (struct sockaddr *) &sock, &size );
    if ( ( desc = accept( (socklen_t)tcp_socket, (struct sockaddr *) &sock, &size) ) < 0 ) {
        log_internally( "New_descriptor: accept" );
        return;
    }

    if ( fcntl( desc, F_SETFL, FNDELAY ) == -1 ) {
        log_internally( "New_descriptor: fcntl: FNDELAY" );
        return;
    }

    dnew = new TCP_DESCRIPTOR;
    if (dnew==NULL) {
        log_internally("dnew = new DESCRIPTOR returned NULL");
        return;
    }
    if (dnew->get_id()<0 && ((-dnew->get_id())%10)==0) log_internally("Negative descriptor id detected.");

    dnew->descriptor	= desc;
    dnew->nw            = this;

    size = sizeof(sock);

    char hostbuf[NW_BUFLEN];
    char servbuf[NW_BUFLEN];

    int err=0;
    if ((err = getnameinfo((const struct sockaddr *)(&sock), size, hostbuf, NW_BUFLEN, servbuf, NW_BUFLEN, NI_NUMERICSERV)) != 0 ) {
        log_internally("NETWORKER::init_descriptor, getnameinfo error: %d", err);
        dnew->host = "(unknown)";
    }
    else {
        log_internally( "Connection %d from %s, port %s.", dnew->get_id(), hostbuf, servbuf);
        dnew->host = hostbuf;
    }
    
    char ip_str[INET_ADDRSTRLEN]="";
    if (inet_ntop(AF_INET, &(sock.sin_addr), ip_str, INET_ADDRSTRLEN)) {
        dnew->ip = ip_str;
    }

    pending.push_back(dnew->get_id());
    descriptors.push_back(dnew);

    return;
}

void NETWORKER::tidy(void) {
    size_t i;
    DESCRIPTOR *d;

    // Close broken descriptors.
    // They'll become NULL pointers in descriptors vector at first.
    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL) continue;
        if (d->broken()) {
            if (d->to_tcp()) close_tcp_socket(d->to_tcp());
        }
    }

    // Erase null pointers
    for (i=0;i<descriptors.size();) {
        if ( (d=descriptors[i])==NULL) {
            descriptors.erase(descriptors.begin()+i);
            if(i>0) i--;
            else continue;
        }
        i++;
    }

    return;
}

void NETWORKER::update(void) {
    size_t i;
    DESCRIPTOR *d;

    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL) continue;
        d->update();
    }

    return;
}

int NETWORKER::connect(const char *host, int portno) {
    int sockfd;
    struct sockaddr_in serv_addr;
    struct hostent *server;

    sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        log_internally("ERROR opening socket!");
        return 0;
    }

    server = gethostbyname(host);
    if (server == NULL) {
        log_internally("ERROR, no such host (%s, %d)!",host,portno);
        return 0;
    }

    bzero((char *) &serv_addr, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    bcopy((char *)server->h_addr, (char *)&serv_addr.sin_addr.s_addr, server->h_length);

    serv_addr.sin_port = htons(portno);

    if (::connect(sockfd,(struct sockaddr *) &serv_addr,sizeof(serv_addr)) < 0) {
        log_internally("ERROR connecting %s!",host);
        return 0;
    }

    // Cons a new descriptor.
    DESCRIPTOR *dnew = new TCP_DESCRIPTOR;
    if (dnew==NULL) {
        log_internally("connect: dnew = new DESCRIPTOR returned NULL");
        return 0;
    }
    if (dnew->get_id()<0 && ((-dnew->get_id())%10)==0) log_internally("Negative descriptor id detected.");

    dnew->descriptor	= sockfd;
    dnew->nw            = this;

    socklen_t size = sizeof(serv_addr);

    char hostbuf[NW_BUFLEN];
    char servbuf[NW_BUFLEN];

    int err=0;
    if ((err = getnameinfo((const struct sockaddr *)(&serv_addr), size, hostbuf, NW_BUFLEN, servbuf, NW_BUFLEN, 0)) != 0 ) {
        log_internally("NETWORKER::connect, getnameinfo error: %d", err);
        dnew->host = "(unknown)";
    }
    else {
        log_internally( "New Connection to: %s (%s)",hostbuf, servbuf);
        dnew->host = hostbuf;
    }

    descriptors.push_back(dnew);

    return dnew->get_id();
}

void NETWORKER::poll(void) {
    size_t i;
    DESCRIPTOR     *d    =NULL;
    TCP_DESCRIPTOR *tcp_d=NULL;
    fd_set in_set;
    fd_set out_set;
    fd_set exc_set;
    int maxdesc=0;
    struct timeval null_time;

    FD_ZERO( &in_set  );
    FD_ZERO( &out_set );
    FD_ZERO( &exc_set );

    if (tcp_socket != -1) {
        FD_SET ( tcp_socket, &in_set );

        maxdesc = tcp_socket;

        for (i=0;i<descriptors.size();i++) {
            if ( (d=descriptors[i])==NULL) continue;
            tcp_d = d->to_tcp();
            if (!tcp_d) continue;

            maxdesc = (maxdesc > tcp_d->descriptor ? maxdesc : tcp_d->descriptor);
            FD_SET( tcp_d->descriptor, &in_set  );
            FD_SET( tcp_d->descriptor, &out_set );
            FD_SET( tcp_d->descriptor, &exc_set );
        }

        null_time.tv_sec  = 0;
        null_time.tv_usec = 0;
        if ( select( maxdesc+1, &in_set, &out_set, &exc_set, &null_time ) < 0 ) {
            log_internally( "NETWORKER poll: select: poll" );
            return;
        }

        // New connection?
        if ( FD_ISSET( tcp_socket, &in_set ) ) {
            init_descriptor();
        }

        // Kick out the freaky folks.
        for (i=0;i<descriptors.size();i++) {
            if ( (d=descriptors[i])==NULL) continue;
            tcp_d = d->to_tcp();
            if (!tcp_d) continue;

            if ( FD_ISSET( tcp_d->descriptor, &exc_set ) ) {
                FD_CLR( tcp_d->descriptor, &in_set  );
                FD_CLR( tcp_d->descriptor, &out_set );
                close_tcp_socket( tcp_d );
            }
        }
    }
    else {
        for (i=0;i<descriptors.size();i++) {
            if ( (d=descriptors[i])==NULL) continue;
            tcp_d = d->to_tcp();
            if (!tcp_d) continue;

            maxdesc = ( maxdesc > tcp_d->descriptor ? maxdesc : tcp_d->descriptor );
            FD_SET( tcp_d->descriptor, &in_set  );
            FD_SET( tcp_d->descriptor, &out_set );
            FD_SET( tcp_d->descriptor, &exc_set );
        }

        null_time.tv_sec  = 0;
        null_time.tv_usec = 0;
        if ( select( maxdesc+1, &in_set, &out_set, &exc_set, &null_time ) < 0 ) {
            log_internally( "NETWORKER poll: select: poll" );
            return;
        }
    }

    // Process input.
    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL) continue;
        tcp_d = d->to_tcp();
        if (!tcp_d) continue;

        if ( FD_ISSET( tcp_d->descriptor, &in_set ) ){
            if ( !tcp_d->read() ) {
                FD_CLR( tcp_d->descriptor, &out_set );
                close_tcp_socket( tcp_d );
                continue;
            }
        }

        // raw_input contains raw data that has arrived from clients
        tcp_d->process_input();
    }

    // Output.
    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL) continue;
        tcp_d = d->to_tcp();
        if (!tcp_d) continue;

        if ( FD_ISSET(tcp_d->descriptor, &out_set) ) {
            if ( !tcp_d->process_output() ) {
                close_tcp_socket( tcp_d );
            }
        }
    }
}

void NETWORKER::flush(void) {
    size_t i;
    DESCRIPTOR *d=NULL;
    TCP_DESCRIPTOR * tcp_d = NULL;
    fd_set out_set;

    FD_ZERO( &out_set );

    // Output.
    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL) continue;
        tcp_d = d->to_tcp();
        if (!tcp_d) continue;

        FD_SET( tcp_d->descriptor, &out_set );

        if ( FD_ISSET(tcp_d->descriptor, &out_set) ) {
            if ( !tcp_d->process_output() ) {
                close_tcp_socket( tcp_d );
            }
        }
    }
}

void NETWORKER::close_tcp_socket( TCP_DESCRIPTOR *dclose ) {
    DESCRIPTOR *d=NULL;
    size_t i;

    // In case this connection was still pending, kill it at its birth
    for (i=0;i<pending.size();i++) {
        if (dclose->get_id() == pending[i]) {
            pending[i]=0;
            break;
        }
    }

    for (i=0;i<descriptors.size();i++) {
        if ( (d=descriptors[i])==NULL) continue;
        if (d->to_tcp()==dclose) {
            log_internally("Closing connection %d to %s.",dclose->get_id(), dclose->get_host());
            ::close( dclose->descriptor );
            descriptors[i] = NULL;
            delete dclose;
            return;
        }
    }

    log_internally( "Close_tcp_socket: dclose not found." );

    return;
}

int NETWORKER::init_tcp_socket( int port ) {
    static struct sockaddr_in sa_zero;
    struct sockaddr_in sa;
    int x = 1;
    int fd;

    if ( ( fd = socket( AF_INET, SOCK_STREAM, 0 ) ) < 0 ) {
        log_internally( "Init_tcp_socket: socket" );
        exit( 1 );
    }

    if ( setsockopt( fd, SOL_SOCKET, SO_REUSEADDR,(char *) &x, sizeof(x) ) < 0 ) {
        log_internally( "Init_tcp_socket: SO_REUSEADDR" );
        ::close(fd);
        exit( 1 );
    }

    sa		        = sa_zero;
    sa.sin_family   = AF_INET;
    sa.sin_port	    = htons( port );

    if ( bind( fd, (struct sockaddr *) &sa, sizeof(sa) ) < 0 ) {
        log_internally("Init socket: bind (port %d)", port );
        ::close(fd);
        exit(1);
    }

    if ( listen( fd, 3 ) < 0 ) {
        log_internally("Init socket: listen");
        ::close(fd);
        exit(1);
    }

    return fd;

}

int NETWORKER::next_pending_desc(void) {
    int id=0;

    while (id==0) {
        if (!pending.empty()) {
            id = pending.back();
            pending.pop_back();
        }
        else return 0;
    }

    return id;
}

const char *NETWORKER::get_host(int desc_id) {
    DESCRIPTOR * d = find_descriptor(desc_id);
    if (!d) return NULL;
    
    return d->get_host();
}

const char *NETWORKER::get_ip(int desc_id) {
    DESCRIPTOR * d = find_descriptor(desc_id);
    if (!d) return NULL;
    
    return d->get_ip();
}

bool NETWORKER::fetch_input(int desc_id, std::vector<unsigned char> * to) {
    DESCRIPTOR *d = find_descriptor(desc_id);
    if (!d) return false;
    d->to_tcp()->fetch_inbuf(to);
    return true;
}

bool NETWORKER::write_output(int desc_id, const std::vector< unsigned char >& bytes) {
    DESCRIPTOR *d = find_descriptor(desc_id);
    if (!d || !d->to_tcp()) return false;
    return d->to_tcp()->write_to_buffer(bytes);
}

void NETWORKER::emergency_broadcast(const char *message) {
    size_t i;
    DESCRIPTOR *d;
    size_t length = strlen(message);    
    if (!length) return;
    
    for (i=0;i<descriptors.size();i++) {
        d=descriptors[i];
        if (!d || d->broken() || !d->to_tcp()) continue;
        
        size_t iStart;
        size_t nWrite;
        size_t nBlock;
        int descriptor = d->get_desc();

        for ( iStart = 0; iStart < length; iStart += nWrite ) {
            int buf = length - iStart;
            nBlock = ( buf < 4096 ? buf : 4096 );
            if ( ( nWrite = ::write( descriptor, message + iStart, nBlock ) ) < 0 ) {
                continue;
            }
        }        
    }
}

void NETWORKER::log_internally( const char *p_fmt, ... ) {
    if (log == NULL) return;

    va_list    ap;
    char       *buf = NULL;
    char       *newbuf = NULL;
    std::string buf2;
    int			buffered = 0;
    int			size = 1024;

    // Nothing to be written?
    if (p_fmt == NULL) return;

    buf = (char *) malloc (size * sizeof (char));

    // Basically a safe vsprintf
    while (1) {
        va_start (ap, p_fmt);

        buffered = vsnprintf (buf, size, p_fmt, ap);

        va_end (ap);

        if (buffered > -1 && buffered < size) break;

        if (buffered > -1)
            size = buffered + 1;
        else
            size *= 2;
        if ((newbuf = (char *) realloc (buf, size)) == NULL) {
            free (buf);
            return;
        } else {
            buf = newbuf;
        }
    }

    std::string logline = "";

    if (name.length() > 0) {
        logline.append(name.c_str());
        logline.append(": ");
    }

    logline.append(buf);

    log(logline.c_str());

    // Free the temporary buffer
    free (buf);
}

class DESCRIPTOR * NETWORKER::find_descriptor(int id) {
    for (size_t i=0;i<descriptors.size();i++) {
        if (descriptors[i]==NULL) continue;
        if (descriptors[i]->get_id() == id) {
            return descriptors[i];
        }
    }
    return NULL;
}

void NETWORKER::paralyze_descriptor(int id) {
    DESCRIPTOR *d = find_descriptor(id);
    if (d) d->paralyze();

    return;
}

int DESCRIPTOR::next_id=1;

DESCRIPTOR::DESCRIPTOR() {
    paralyzed=false;
    descriptor=0;

    nw=NULL;

    id = next_id++;
}

DESCRIPTOR::~DESCRIPTOR() {

}

void DESCRIPTOR::paralyze(void) {
    paralyzed=true;
}

bool DESCRIPTOR::broken(void) {
    return paralyzed;
}

void DESCRIPTOR::update(void) {
    return;
}

int DESCRIPTOR::get_id(void) const {
    return id;
}

const char * DESCRIPTOR::get_host() const {
    return host.c_str();
}

const char * DESCRIPTOR::get_ip() const {
    return ip.c_str();
}

TCP_DESCRIPTOR::TCP_DESCRIPTOR() {

}

TCP_DESCRIPTOR::~TCP_DESCRIPTOR() {

}

bool TCP_DESCRIPTOR::read( void ) {
    unsigned char buf[65536];

    for ( ; ; ) {
        ssize_t nRead;

        nRead = (::read( descriptor, buf, sizeof(buf)));
        //nw->log_internally("Incoming %d bytes. (%d)",nRead, id);
        if ( nRead > 0 ) {
            for (ssize_t i=0;i<nRead;i++) {
                raw_input.push_back(buf[i]);
            }
            break;
        }
        else if ( nRead == 0 ) {
            if (nw) nw->log_internally( "EOF on read from #%d (%s).",descriptor ,host.c_str());
            return false;
        }
        else if ( errno == EWOULDBLOCK ) break;
        else {
            if (nw) nw->log_internally(strerror(errno));
            return false;
        }
    }

    // Check if we are flooded with incoming data
    if ( raw_input.size() > 65536 ) {
        if (nw) nw->log_internally("%s: input buffer way too big.", host.c_str() );

        return false;
    }

    return true;
}


bool TCP_DESCRIPTOR::process_output( void ) {
    if ( !write(outbuf) ) {
        return false;
    }

    outbuf.clear();

    return true;
}

// Lowest level input processing
void TCP_DESCRIPTOR::process_input( void ) {
    // inbuf is for upper layer (telnet) to read
    // raw_input is for low level functions to be done
    // with the input before sending it to the higher level

    //if (raw_input.size()>0) log_internally("[%d]",(int)raw_input.size());
    for (size_t i=0;i<raw_input.size();i++) {
        inbuf.push_back(raw_input[i]);
    }

    raw_input.clear();
    return;
}

void TCP_DESCRIPTOR::fetch_inbuf(std::vector < unsigned char >* dest) {
    //if (inbuf.size()>0) log_internally("(%d)",(int)inbuf.size());
    if (dest!=NULL)
    for (size_t i=0;i<inbuf.size();i++) {
        dest->push_back(inbuf[i]);
    }

    inbuf.clear();
    return;
}

/*
 * Append onto an output buffer.
 */
bool TCP_DESCRIPTOR::write_to_buffer(const unsigned char *txt, size_t length ) {
    if (broken()) return false;
    for (size_t i=0;i<length;i++) {
        outbuf.push_back(txt[i]);
        if (outbuf.size()> 65536) {
            if (nw) nw->log_internally("Output buffer from %s way too big.",host.c_str());
            if (nw) nw->log_internally("Closing #%d.",descriptor);
            paralyze();
            return false;
        }
    }

    return true;
}

bool TCP_DESCRIPTOR::write_to_buffer(const char *txt) {
    size_t length = strlen(txt);
    return write_to_buffer((const unsigned char*)txt,length);
}

bool TCP_DESCRIPTOR::write_to_buffer( const std::vector<unsigned char>& bytes ) {
    size_t length=bytes.size();
    const unsigned char *txt = &(bytes[0]);

    return write_to_buffer(txt,length);
}

bool TCP_DESCRIPTOR::write(const char *txt) {
    size_t length = strlen(txt);
    return write((const unsigned char*)txt,length);
}

bool TCP_DESCRIPTOR::write(const unsigned char *txt, size_t length ) {
    size_t iStart, nBlock;
    ssize_t nWrite;

    if (length==0) return true;

    for ( iStart = 0; iStart < length; iStart += nWrite ) {
        int buf = length - iStart;
        nBlock = ( buf < 4096 ? buf : 4096 );
        //nw->log_internally("Outgoing %d bytes. (%d)",length, id);
        nWrite = ::write(descriptor, txt + iStart, nBlock);
        if (nWrite <= 0) {
            if (nw) nw->log_internally("ERROR: DESCRIPTOR::write");
            return false;
        }
    }
    return true;
}

bool TCP_DESCRIPTOR::write( const std::vector<unsigned char>& bytes ) {
    size_t length=bytes.size();
    const unsigned char *txt = &(bytes[0]);

    return write(txt,length);
}

void send_to_desc( const char * str ,class TCP_DESCRIPTOR *d) {
    d->write_to_buffer(str);
    return;
}

