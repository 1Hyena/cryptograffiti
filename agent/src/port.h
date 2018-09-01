#include <map>

class PORT {
    public:

    PORT();
    virtual ~PORT()=0;

    virtual       class PORT_PLAIN   * to_plain   (void)       {return NULL;}
    virtual const class PORT_PLAIN   * to_plain   (void) const {return NULL;}

    virtual void paralyze   (void);
    virtual void close      (void);
    virtual void wait_close (void);
    virtual void flush      (void);

    int  get_id           (void)   {return id;}
    bool is_broken        (void)   {return broken;}
    bool is_closing       (void)   {return closing;}
    int  get_descriptor_id(void)   {return descriptor_id;}
    void set_descriptor_id(int id) {descriptor_id = id; return;}

    bool receive_bytes(const std::vector < unsigned char >& bytes);
    bool receive_text(const char * p_fmt, ...); // This is dangerous, if contains format but no params.

    protected:

    int descriptor_id;

    static int next_id;
    int id;
    bool broken;
    int closing;
};

class PORT_PLAIN : public PORT {
    public:

    PORT_PLAIN();
    virtual ~PORT_PLAIN();

          PORT_PLAIN* to_plain(void)       { return this; }
    const PORT_PLAIN* to_plain(void) const { return this; }

    void handle(void);
    void flush(void);

    bool virgin;

    std::vector<unsigned char> inbuf;
};


