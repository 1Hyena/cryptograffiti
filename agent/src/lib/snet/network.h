/*
 * See Copyright Notice in snet.h
 */

#include <vector>
#include <string>

#define NW_BUFLEN 256

class NETWORKER {
    friend class DESCRIPTOR;
    friend class TCP_DESCRIPTOR;
    public:

    NETWORKER();
    NETWORKER(const char * name);
    ~NETWORKER();

    bool start_tcp (int tcp_port);           //Starts the networker that listens to the specified port for TCP/IP
    bool start_udp (int udp_port);           //Starts the networker that listens to the specified port for UDP/IP
    void close_tcp (void);                   //Closes all TCP sockets involved
    void close_udp (void);                   //Closes the UDP listener

    void poll  (void);                       //Questions each and every descriptor for input and processes output
    void flush (void);                       //Send all pending output
    void tidy  (void);                       //descriptor vector may contain NULL pointers and broken descriptors
    void update(void);                       //updates all descriptors in main loop

    bool is_tcp_running(void)        {return tcp_running; }
    bool is_udp_running(void)        {return false;       }
    const char *get_name(void)       {return name.c_str();}

    void set_name(const char * name) {this->name = name;}

    int connect(const char* host, int port); //Opens up a tcp ip connection

    const char *get_host(int desc_id);
    const char *get_ip(int desc_id);

    int next_pending_desc(void);
    class DESCRIPTOR *find_descriptor(int);
    void paralyze_descriptor(int);
    bool fetch_input (int desc_id, std::vector<unsigned char> * to);
    bool write_output(int desc_id, const std::vector< unsigned char >& bytes);
    void emergency_broadcast(const char *message);
    
    void (*log)(const char *);

    private:
    int  init_tcp_socket(int port);
    void close_tcp_socket(class TCP_DESCRIPTOR *dclose);
    void init_descriptor(void);
    void init(void);

    bool tcp_running;

    std::vector< class DESCRIPTOR* > descriptors;
    std::vector< int > pending; // used to differ new connections at their birth
    int tcp_socket;
    int tcp_port;
    
    void log_internally(const char *p_fmt, ... );

    std::string name;
};

class DESCRIPTOR {
    friend class NETWORKER;
    protected:
    bool paralyzed;

    static int next_id;
    int id;
    int descriptor;    
    class NETWORKER *nw;
    
    public:
    std::string host;
    std::string ip;

    void paralyze(void); // turns ON the broken flag
    bool broken  (void); // returns TRUE when broken=TRUE
    void update  (void); // updates the descriptor in main loop
    int get_desc (void) {return descriptor;}
    class NETWORKER *get_networker(void) {return nw;}

    virtual class TCP_DESCRIPTOR * to_tcp(void) {return NULL;}

    DESCRIPTOR();
    virtual ~DESCRIPTOR()=0;

    int get_id(void) const;
    const char * get_host() const;
    const char * get_ip() const;
};

class TCP_DESCRIPTOR : public DESCRIPTOR {
    private:

    bool write(const unsigned char *str, size_t n);
    bool write(const char *str);
    bool write(const std::vector < unsigned char >& bytes);

    std::vector< unsigned char > raw_input;

    public:

    class TCP_DESCRIPTOR *to_tcp(void) {return this;}

    bool read(void);

    bool write_to_buffer(const unsigned char *bytes, size_t length);
    bool write_to_buffer(const char *bytes);
    bool write_to_buffer(const std::vector < unsigned char >& bytes);

    void fetch_inbuf(std::vector < unsigned char >* dest);

    bool process_output(void);

    void process_input (void);

    std::vector< unsigned char > inbuf;
    std::vector< unsigned char > outbuf;

    TCP_DESCRIPTOR();
    ~TCP_DESCRIPTOR();
};

