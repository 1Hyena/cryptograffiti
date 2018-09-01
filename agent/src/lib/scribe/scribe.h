#include <string>
#include <vector>
#include <lua.hpp>

#define SCRIBE_ERR_SCRIPT  1
#define SCRIBE_ERR_UNKNOWN 2
#define SCRIBE_ERR_MEMORY  4
#define SCRIBE_ERR_IO      8

class SCRIBE {
    public:
    static void (*log)(const char *);
    static SCRIBE* find_scribe(lua_State *s);
    static const struct fun_type fun_table[];
    static bool check_fun(lua_State *s, int min_arg, int max_arg);
    static bool check_fun(lua_State *s, int min_arg);
    static int to_lower(int c);
    static int to_upper(int c);

    void lua_call_va (const char *, const char *func, const char *sig, ...);
    void start(const char*);
    void step (void);
    void tidy (void);    
    void clear(void);
    const struct fun_type* get_fun(size_t pos);
    void set_fun(const char *name, int (*function) (lua_State *));
    int thread_count(void);
    
    void load (const char * name, const char * filename, const char *bytes);
    void purge(void);
    const char * get_root(void) { return root.c_str(); }

    void log_internally(const char *p_fmt, ... );
    void print_callstack(lua_State* L, int n);

    int get_error_code(void) {return error_code;}

    std::string name;

    SCRIBE();
    SCRIBE(const char *name);
    ~SCRIBE();

    private:
    void               init(const char *name);
    class LUA_STATE  * find_lua_state(const char *);
    class LUA_THREAD * create_lua_thread(const char *);
    bool               state_exists(const char*);

    void lua_fun_va  (const char *, const char *func, const char *sig, ...);
    //void kill_lua_thread(lua_State *state);

    void errmsg(const char *str);

    void close(int code) {error_code = code;}

    int error_code;
    std::string root;
    std::vector<class LUA_STATE *> states;

    int lua_memory_usage;
    int lua_memory_record;
    static std::vector<SCRIBE*> scribes;
    
    std::vector<struct fun_type *> fun;
};

class LUA_STATE {
    friend class SCRIBE;
    private:

    void step(void);
    void tidy(void);
    int  thread_count(void);
    void paralyze(void);
    bool is_broken(void) {return broken;}
    void load(const char *file, const char *bytes);
    void purge(void);

    class LUA_THREAD * exec(void);
    //class LUA_THREAD * find_lua_thread(struct lua_State*);

    LUA_STATE(SCRIBE *, const char*, const char *, const char*);
    ~LUA_STATE();

    const char*get_name(void) {return name.c_str();}

    struct lua_State *get_lua(void) {return lua;}
    SCRIBE *scribe;

    std::string name;

    class LUA_THREAD* new_lua_thread(lua_State *state);

    struct lua_State *lua;

    std::vector<class LUA_THREAD *> threads;
    bool broken;
    int error_code;
};

class LUA_THREAD {
    friend class SCRIBE;
    friend class LUA_STATE;

    private:

    LUA_THREAD(SCRIBE *);
    ~LUA_THREAD();

    bool step(void);
    void kill(void);
    bool is_broken(void) {return broken;}

    void set_fn_name(const char *);
    const char *get_fn_name(void) {return m_fn_name.c_str();}
    lua_State *get_lua(void) {return m_state;}
    LUA_STATE *get_state(void) {return state;}
    void set_state(LUA_STATE *st) {state = st;}
    
    void init(void);

    SCRIBE *scribe;
    LUA_STATE *state;

    lua_State *m_state; // This does not have to be same as LUA_STATE's "lua"
    int m_refkey;

    std::string m_fn_name;

    bool broken;
    int error_code;

    int ttl;
};

struct fun_type {
    std::string name;                   /* special function name */
    int (*function) (lua_State *);      /* the function */
};


