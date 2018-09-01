#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <string>
#include <math.h>
#include <cstring> 

#include <lua.hpp>
#include "scribe.h"

void (*SCRIBE::log)(const char *) = NULL;
std::vector<SCRIBE*> SCRIBE::scribes;

void SCRIBE::log_internally( const char *p_fmt, ... ) {
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
        logline.append(" : ");
    }

    logline.append(buf);

    log(logline.c_str());

    // Free the temporary buffer
    free (buf);
}

void SCRIBE::print_callstack(lua_State* L, int n) {
    lua_Debug ar;
    if(lua_getstack(L, n, &ar) == 1) {
        lua_getinfo(L, "nSlu", &ar);
        const char* indent;
		if(n == 0) {
            indent = "->  ";
            log_internally("    <call stack>");
		}
		else {
            indent = "    ";
		}
		if(ar.name) log_internally("%s%s() : line %d [%s : line %d]",    indent, ar.name, ar.currentline, ar.source, ar.linedefined);
		else        log_internally("%sunknown : line %d [%s : line %d]", indent,          ar.currentline, ar.source, ar.linedefined);

		print_callstack(L, n+1);
	}
}

void SCRIBE::lua_call_va (const char *lt_name, const char *func, const char *sig, ...) {
    LUA_THREAD *lt = create_lua_thread(lt_name);
    if (lt==NULL) {
        log_internally("lua_call_va lt == NULL");
        return;
    }

    struct lua_State * L = lt->get_lua();
    lt->set_fn_name(func);

    va_list vl;
    int narg, nres;  /* number of arguments and results */

    va_start(vl, sig);
    std::vector<std::string> scopes;
    std::string buf="";
    for (size_t i=0;;i++) {
        if (func[i] == '\0') {
            scopes.push_back(buf);
            buf="";
            break;
        }
        if (func[i] == '.') {
            scopes.push_back(buf);
            buf="";
            continue;
        }
        buf.append(1,func[i]);
    }

    lua_getglobal(L, scopes[0].c_str());  /* get function */

    for (size_t i=1;i<scopes.size();i++) {
        lua_getfield(L, -1, scopes[i].c_str());
        lua_remove(L, -2);
    }
    /* push arguments */
    narg = 0;
    while (*sig) {  /* push arguments */
      switch (*sig++) {

        case 'd':  /* double argument */
          lua_pushnumber(L, va_arg(vl, double));
          break;

        case 'i':  /* int argument */
          lua_pushnumber(L, va_arg(vl, int));
          break;

        case 's':  /* string argument */
          lua_pushstring(L, va_arg(vl, char *));
          break;
/*
        case 't': { // table argument
          VARSET *vs = va_arg(vl, class VARSET *);
          if (vs==NULL) {
              lua_newtable(L);
          }
          else {
              lua_newtable(L);

              std::vector<VARIABLE *> vars;
              vs->fetch_all(&vars);

              for (size_t i=0;i<vars.size();i++) {
                  VALUE *value = vars[i]->get_value();

                  lua_pushstring(L, vars[i]->get_name());
                       if (value && value->to_bool())   lua_pushboolean(L, value->to_bool()->get_val());
                  else if (value && value->to_double()) lua_pushnumber (L, value->to_double()->get_val());
                  else if (value && value->to_int())    lua_pushnumber (L, value->to_int()->get_val());
                  else if (value && value->to_str())    lua_pushstring (L, value->to_str()->get_val());
                  else                                  lua_pushnil    (L);
                  lua_settable(L, -3);
              }
          }
        }
        break;
*/
        case '>':
          goto endwhile;

        default:
          {log_internally("invalid option (%c)", *(sig - 1));va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
      }
      narg++;
      luaL_checkstack(L, 1, "too many arguments");
    } endwhile:

    /* do the call */
    nres = strlen(sig);  /* number of expected results */
    //int ctx;

    //static int ntop = 0;
    //int temp = lua_gettop(L);
    //if (temp>ntop) {
    //    ntop=temp;
    //    log_internally("New ntop is %d",ntop);
    //}

    //int res = lua_resume(L,narg);
    int res = lua_resume(L,NULL,narg);

    if (res==LUA_YIELD) {
        va_end(vl);
        return;
    }
    else if (res == LUA_OK) {
        // Don't return yet, we have return arguments to fill
    }
    else {
        log_internally( "error running function `%s' (%s): %s", func, lt_name, lua_tostring(L, -1));
        print_callstack(L,0);
        close(SCRIBE_ERR_SCRIPT);
        va_end(vl);
        lt->kill();
        return;
    }

    /*lua_getctx(L,&ctx);

    if (lua_pcallk(L, narg, nres, 0, ctx,continuation) != 0)
      {log_internally( "error running function `%s': %s", func, lua_tostring(L, -1));va_end(vl); return;}
    */
    /* retrieve results */
    nres = -nres;  /* stack index of first result */
    while (*sig) {  /* get results */
      switch (*sig++) {

        case 'd':  /* double result */
          if (!lua_isnumber(L, nres))
            {log_internally("wrong result type");va_end(vl); lt->kill(); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, double *) = lua_tonumber(L, nres);
          break;

        case 'i':  /* int result */
          if (!lua_isnumber(L, nres))
            {log_internally("wrong result type"); va_end(vl); lt->kill(); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, int *) = (int)lua_tonumber(L, nres);
          break;

        case 's':  /* string result */
          if (!lua_isstring(L, nres))
            {log_internally("wrong result type");  va_end(vl); lt->kill(); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, const char **) = lua_tostring(L, nres);
          break;

        case 't':  /* table result */
          if (!lua_istable(L, nres))
            {log_internally("wrong result type"); va_end(vl); lt->kill(); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, void **) = NULL; //(int)lua_tonumber(L, nres);
          break;

        default:
          {log_internally("invalid option (%c)", *(sig - 1));va_end(vl); lt->kill(); close(SCRIBE_ERR_SCRIPT); return;}
      }
      nres++;
    }
    va_end(vl);
    lt->kill();
}

void SCRIBE::lua_fun_va (const char *lt_name, const char *func, const char *sig, ...) {
    LUA_STATE  *st = find_lua_state(lt_name);
    if (st==NULL) {
        log_internally("lua_fun_va st == NULL");
        return;
    }

    struct lua_State * L = st->get_lua();

    va_list vl;
    int narg, nres;  /* number of arguments and results */


    va_start(vl, sig);

    std::vector<std::string> scopes;
    std::string buf="";
    for (size_t i=0;;i++) {
        if (func[i] == '\0') {
            scopes.push_back(buf);
            buf="";
            break;
        }
        if (func[i] == '.') {
            scopes.push_back(buf);
            buf="";
            continue;
        }
        buf.append(1,func[i]);
    }

    lua_getglobal(L, scopes[0].c_str());  /* get function */

    for (size_t i=1;i<scopes.size();i++) {
        lua_getfield(L, -1, scopes[i].c_str());
        lua_remove(L, -2);
    }

    /* push arguments */
    narg = 0;
    while (*sig) {  /* push arguments */
      switch (*sig++) {

        case 'd':  /* double argument */
          lua_pushnumber(L, va_arg(vl, double));
          break;

        case 'i':  /* int argument */
          lua_pushnumber(L, va_arg(vl, int));
          break;

        case 's':  /* string argument */
          lua_pushstring(L, va_arg(vl, char *));
          break;
/*
        case 't': { // table argument
          VARSET *vs = va_arg(vl, class VARSET *);
          if (vs==NULL) {
              lua_newtable(L);
          }
          else {
              lua_newtable(L);

              std::vector<VARIABLE *> vars;
              vs->fetch_all(&vars);

              for (size_t i=0;i<vars.size();i++) {
                  VALUE *value = vars[i]->get_value();

                  lua_pushstring(L, vars[i]->get_name());
                       if (value && value->to_bool())   lua_pushboolean(L, value->to_bool()->get_val());
                  else if (value && value->to_double()) lua_pushnumber (L, value->to_double()->get_val());
                  else if (value && value->to_int())    lua_pushnumber (L, value->to_int()->get_val());
                  else if (value && value->to_str())    lua_pushstring (L, value->to_str()->get_val());
                  else                                  lua_pushnil    (L);
                  lua_settable(L, -3);
              }
          }
        }
        break;
*/
        case '>':
          goto endwhile;

        default:
          {log_internally("invalid option (%c)", *(sig - 1));va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
      }
      narg++;
      luaL_checkstack(L, 1, "too many arguments");
    } endwhile:

    /* do the call */
    nres = strlen(sig);  /* number of expected results */
    //int ctx;

    if (lua_pcall(L, narg, nres, 0) != 0) {
        log_internally( "error running function `%s' (%s): %s", func, lt_name, lua_tostring(L, -1));
        print_callstack(L,0);
        close(SCRIBE_ERR_SCRIPT);
        va_end(vl);
        return;
    }


    /*lua_getctx(L,&ctx);

    if (lua_pcallk(L, narg, nres, 0, ctx,continuation) != 0)
      {log_internally( "error running function `%s': %s", func, lua_tostring(L, -1));va_end(vl); return;}
    */
    /* retrieve results */
    nres = -nres;  /* stack index of first result */
    while (*sig) {  /* get results */
      switch (*sig++) {

        case 'd':  /* double result */
          if (!lua_isnumber(L, nres))
            {log_internally("wrong result type");va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, double *) = lua_tonumber(L, nres);
          break;

        case 'i':  /* int result */
          if (!lua_isnumber(L, nres))
            {log_internally("wrong result type"); va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, int *) = (int)lua_tonumber(L, nres);
          break;

        case 's':  /* string result */
          if (!lua_isstring(L, nres))
            {log_internally("wrong result type");  va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, const char **) = lua_tostring(L, nres);
          break;

        case 't':  /* table result */
          if (!lua_istable(L, nres))
            {log_internally("wrong result type"); va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
          *va_arg(vl, void **) = NULL; //(int)lua_tonumber(L, nres);
          break;

        default:
          {log_internally("invalid option (%c)", *(sig - 1));va_end(vl); close(SCRIBE_ERR_SCRIPT); return;}
      }
      nres++;
    }
    va_end(vl);
}


void SCRIBE::start(const char *root) {
    this->root = root;
    error_code = 0;
    //load();
}

void SCRIBE::errmsg(const char *str) {
    if (str!=NULL) {
        log_internally(str);
    }
}

/*
 *   Call this if you want to reload scripts..
 *   Scripts that have running threads won't get overwritten but will be paralyzed (they'll get deleted as soon as possible)
 *   Scripts that have zero running threads will get overwritten by reloaded scripts.
 */

void SCRIBE::load(const char *name, const char *file, const char *bytes) {
    if (state_exists(name)) {
        LUA_STATE *state = find_lua_state(name);
        state->load(file, bytes);
    }
    else states.push_back(new LUA_STATE(this, name, file, bytes));
}

void SCRIBE::init(const char *name) {
    this->name       = name;
    root             =   "";
    lua_memory_usage =    0;
    lua_memory_record=    0;        
}

SCRIBE::SCRIBE(){
    init("default");
    scribes.push_back(this);
    log_internally("SCRIBE constructed!");
}

SCRIBE::SCRIBE(const char * name) {
    init(name);
    scribes.push_back(this);
    log_internally("SCRIBE constructed!");
}

SCRIBE::~SCRIBE(){
    purge();
    clear();
    log_internally("SCRIBE destroyed!");
    
    std::vector<SCRIBE*> good_scribes;
    for (size_t i=0; i<scribes.size(); i++) {
        if (scribes[i] == this) continue;
        good_scribes.push_back(scribes[i]);
    }
    scribes = good_scribes;
}

SCRIBE* SCRIBE::find_scribe(lua_State *s) {
    for (size_t i=0; i<scribes.size(); i++) {
        for (size_t j=0; j<scribes[i]->states.size(); j++) {
            LUA_STATE * ls = scribes[i]->states[j];                    
             
            if (!ls || ls->is_broken()) continue;
            
            if (s == ls->get_lua()) return scribes[i];
            
            for (size_t k=0; k<ls->threads.size(); k++) {
                LUA_THREAD *thread = ls->threads[k];
                if (!thread || thread->is_broken()) continue;
                if (s == thread->get_lua()) return scribes[i];
            }
        }
    }
    return NULL;
}

void SCRIBE::clear(void) {
    while (!states.empty()) {
        delete states.back();
        states.pop_back();
    }
    while (!fun.empty()) {
        delete fun.back();
        fun.pop_back();
    }
    return;
}

void SCRIBE::tidy(void) {
    std::vector<LUA_STATE *> ls;

    for (size_t i=0;i<states.size();i++) {
        if (states[i]!=NULL) {
            if (states[i]->is_broken()
            &&  states[i]->thread_count()==0 ) {
                //log_internally("Deleting LUA_STATE: %s!",states[i]->get_name());
                delete states[i];
                states[i]=NULL;

                continue;
            }
            ls.push_back(states[i]);
            states[i]->tidy();
        }
    }
    states = ls;
}

int SCRIBE::thread_count() {
    std::vector<LUA_STATE *> ls;

    size_t thread_count = 0;
    for (size_t i=0; i<states.size(); i++) {
        if (states[i]!=NULL) {
            if (states[i]->is_broken()) continue;
            thread_count += states[i]->thread_count();
        }
    }
    
    return thread_count;
}

void SCRIBE::purge(void) {
    for (size_t i=0;i<states.size();i++) {
        if (states[i]!=NULL) {
            if (states[i]->is_broken()
            &&  states[i]->thread_count()==0 ) {
                continue;
            }
            states[i]->purge();
        }
    }
}

void SCRIBE::step(void) {
    static int next_msg=128;

    int mem=0;
    if (error_code!=0) return;
    for (size_t i=0;i<states.size();i++) {
        if (states[i]==NULL
        ||  states[i]->is_broken()) continue;

        states[i]->step();
        error_code |= states[i]->error_code;
        if (error_code!=0) return;

        mem+=lua_gc(states[i]->get_lua(), LUA_GCCOUNT, 0);
    }
    if (lua_memory_record<mem){
        if (mem > next_msg) {
            log_internally("Lua memory record: %d KBytes.",mem);
            next_msg*=2;
        }
        lua_memory_record=mem;
    }
    lua_memory_usage=mem;
}

const struct fun_type* SCRIBE::get_fun(size_t pos) {
    if (pos < fun.size()) return fun[pos];
    return NULL;
}
void SCRIBE::set_fun(const char *name, int (*function) (lua_State *)) {
    struct fun_type *f = new struct fun_type;
    if (f) {
        f->name = name;
        f->function = function;
        fun.push_back(f);
    }
    else {
        log_internally("Error: Cannot allocate memory for new struct fun_type '%s'.",name);
    }
}

/*
Commented out because it is potentially dangerous. 
LUA_THREAD can have only 1 LUA_STATE but 2 different lua_State structures.
void SCRIBE::kill_lua_thread(lua_State *state) {
    for (size_t i=0;i<states.size();i++) {
        if (states[i]==NULL) continue;
        LUA_THREAD *lt = states[i]->find_lua_thread(state);

        if (lt!=NULL) {
            lt->kill();
            return;
        }
    }
    log_internally("kill_lua_thread: lua_State *state not found!");
}*/

LUA_STATE * SCRIBE::find_lua_state(const char *name) {
    for (size_t i=0;i<states.size();i++) {
        if (states[i]==NULL
        ||  states[i]->is_broken()) continue;
        if (!strcmp(states[i]->get_name(),name)) {
            return states[i];
        }
    }
    log_internally("find_lua_state: Cannot find %s!",name);
    return NULL;
}

bool SCRIBE::state_exists(const char*name) {
    for (size_t i=0;i<states.size();i++) {
        if (states[i]==NULL
        ||  states[i]->is_broken()) continue;
        if (!strcmp(states[i]->get_name(),name)) {
            return true;
        }
    }
    return false;
}

LUA_THREAD *SCRIBE::create_lua_thread(const char *name) {
    LUA_STATE * st = find_lua_state(name);
    if (st==NULL) {
        log_internally("create_lua_thread: lua state '%s' not found.",name);
        return NULL;
    }
    LUA_THREAD *lt =NULL;
    lt = st->exec();
    if (lt==NULL) log_internally("create_lua_thread: s->exec() == NULL");
    return lt;
}

LUA_STATE::LUA_STATE(SCRIBE *scribe, const char *name, const char *file, const char *bytes){
    this->name=name;
    this->scribe=scribe;
    broken=false;
    lua=NULL;
    error_code=0;

    load(file, bytes);
}

LUA_STATE::~LUA_STATE(){
    while (!threads.empty()) {
        if (threads.back()!=NULL) {
            delete threads.back();
        }
        threads.pop_back();
    }

    if (lua!=NULL) {
        lua_close(lua);
    }
}

LUA_THREAD * LUA_STATE::exec(void) {
    LUA_THREAD *lt = new_lua_thread(lua);

    if (lt!=NULL) {
        threads.push_back(lt);
    }
    else {
        scribe->log_internally("LUA_STATE::exec : new_lua_thread returns NULL");
    }

    return lt;
}

// Creates a thread with no parameters.
//
// fn_name: the name of the function the thread will execute
// state: the parent Lua state.
//
LUA_THREAD *LUA_STATE::new_lua_thread( lua_State *state ) {
    if (state==NULL) {
        scribe->log_internally("new_lua_thread: state==NULL");
        return NULL;
    }
    LUA_THREAD *thread = new LUA_THREAD(scribe);
    thread->set_state(this); // CAUTION: thread->get_state()->get_lua() != thread->get_lua() 
    thread->m_state  = lua_newthread(state);
    thread->m_refkey = luaL_ref(state, LUA_REGISTRYINDEX);

    // Make sure it worked.
    if (thread->m_state) {

    } else {
        // Do your error thang here.
        scribe->log_internally("new_lua_thread: thread->m_state is 0 for %s",""/*fn_name*/);
        delete thread;
        return NULL;
    }

    return thread;
}

int LUA_STATE::thread_count(void) {
    int cnt=0;
    for (size_t i=0;i<threads.size();i++) {
        if (threads[i]!=NULL) cnt++;
    }
    return cnt;
}



void LUA_STATE::load(const char *file, const char *bytes) {
    if (bytes != NULL && bytes[0]=='\0' && lua==NULL) {
        scribe->log_internally("LUA_STATE file == '\\0' ");
        lua = NULL;
    }
    else {
        if (lua==NULL) {
            lua = luaL_newstate();//lua_open();
            luaL_openlibs(lua);
            size_t i;
            //lua_register(lua, "average", average);
            for (i=0;;i++) {
                if (SCRIBE::fun_table[i].function == NULL) break;
                lua_register(lua,SCRIBE::fun_table[i].name.c_str(),SCRIBE::fun_table[i].function);
                //scribe->log_internally("Registering %s for %s.",SCRIBE::fun_table[i].name.c_str(),name.c_str());
            }            
            scribe->log_internally("%lu default C function%s registered.",i, i==1 ? "" : "s");
            for (i=0; ; i++) {
                const struct fun_type * f = scribe->get_fun(i);
                if (f==NULL) break;
                lua_register(lua,f->name.c_str(),f->function);
                //scribe->log_internally("Registering %s for %s.",f->name.c_str(),name.c_str());
            }
            scribe->log_internally("%lu custom C function%s registered.",i, i==1 ? "" : "s");            
        }

        int result = LUA_ERRMEM;

        if (bytes==NULL) {
            std::string target = scribe->get_root();
            target.append(file);
            result =luaL_loadfile(lua, target.c_str());
        }
        else {
            result =luaL_loadstring(lua, bytes);
        }

        if (result == LUA_ERRSYNTAX) {
            scribe->log_internally("LUA_STATE: Syntax error loading %s!",file);
            error_code = SCRIBE_ERR_SCRIPT;
        }
        else if (result == LUA_ERRMEM) {
            scribe->log_internally("LUA_STATE: Memory error loading %s!",file);
            error_code = SCRIBE_ERR_SCRIPT;
        }

        if (result!=0) {
            scribe->log_internally("Error message: %s", lua_tostring(lua, -1));
            error_code = SCRIBE_ERR_SCRIPT;
            //lua_close(lua);
            //lua=NULL;
            paralyze();
        }
        else {
            lua_pcall(lua, 0, 0, 0);
            scribe->log_internally("%s loaded.",file);
        }
    }

    if (lua==NULL) paralyze();
    return;
}



void LUA_STATE::step(void) {
    for (size_t i=0;i<threads.size();i++) {
        //if (threads[i]->is_broken()) log_internally("Broken %s", threads[i]->get_fn_name());

        if (threads[i]==NULL
        ||  threads[i]->is_broken())
            continue;
        if (threads[i]->step() == false) {
            threads[i]->kill();
        }
        else {

        }
        if (threads[i]->error_code) {
            error_code |= threads[i]->error_code; 
        }
    }
}

/*
See why kill_lua_thread is commented out!
LUA_THREAD * LUA_STATE::find_lua_thread(struct lua_State* ls) {
    for (size_t i=0;i<threads.size();i++) {
        if (threads[i]==NULL) continue;
        if (threads[i]->get_lua() == ls) {
            return threads[i];
        }
    }
    return NULL;
}
*/


void LUA_STATE::tidy(void) {
    std::vector<LUA_THREAD *> tl;

    for (size_t i =0;i<threads.size();i++) {
        if (threads[i]!=NULL) {
            if (threads[i]->is_broken()) {
                //log_internally("Deleting LUA_THREAD from LUA_STATE::tidy");
                delete threads[i];
                threads[i]=NULL;
                continue;
            }
            tl.push_back(threads[i]);
        }
    }

    threads = tl;
}

void LUA_STATE::purge(void) {
    for (size_t i =0;i<threads.size();i++) {
        if (threads[i]!=NULL) {
            if (threads[i]->is_broken()) {
                continue;
            }
            threads[i]->kill();
        }
    }
}

void LUA_STATE::paralyze(void) {
    for (size_t i =0;i<threads.size();i++) {
        if (threads[i]!=NULL) {
            if (threads[i]->is_broken()) {
                continue;
            }
            threads[i]->kill();
        }
    }
    broken = true;
}

LUA_THREAD::LUA_THREAD(SCRIBE *scribe) {
    init();
    this->scribe = scribe;
    //log_internally("Creating LUA_THREAD.");
}

LUA_THREAD::~LUA_THREAD(){
    //log_internally("Deleting LUA_THREAD for %s.",m_fn_name.c_str());
    if (m_refkey != LUA_REFNIL && m_state != NULL) {
        // Kill the reference so the garbage collector grabs it.
        luaL_unref(m_state,LUA_REGISTRYINDEX, m_refkey);
        m_state=NULL;
    }
}

// Just sets the variables, doesn't deallocate anything or kill the thread.
void LUA_THREAD::init() {
    m_state = NULL;
    m_fn_name[0] = '\0';
    m_refkey = LUA_REFNIL;
    broken=false;
    ttl=0;
    error_code = 0;
    scribe = NULL;
    state = NULL;
    return;
}

bool LUA_THREAD::step(void) {
    // Grab the reference and run it until it finishes or you hit a yield.
    //lua_getglobal(m_state, m_fn_name.c_str());

    if (broken || error_code!=0) return false;
    if (m_state==NULL) {
        scribe->log_internally("LUA_THREAD: step - m_state==NULL (%s)",m_fn_name.c_str());
        return false;
    }

    //int res = lua_resume(m_state,0);
    int res = lua_resume(m_state,NULL, 0);

    if (res == LUA_YIELD) {
        if (ttl>0) {
            ttl-=1;
            if (ttl==0) {
                kill();
            }
        }
    }
    else if (res == LUA_OK) {
        kill();
    }
    else {
        scribe->log_internally("Lua step error: %s", lua_tostring(m_state, -1));
        scribe->print_callstack(m_state, 0);
        error_code = SCRIBE_ERR_SCRIPT;
        kill();
    }

    // When it returns false, your calling function should return your allocated
    // lua_thread object to whatever pool it came from
    // because it's done cooking.
    return res == LUA_YIELD;
}

void LUA_THREAD::kill(void) {
    broken=true;
}

void LUA_THREAD::set_fn_name(const char *str ) {
    m_fn_name = str;
}

/*
 *  Utility functions here:
 */
/*****************************************************************************
 Name:		first_arg
 Purpose:	Pick off one argument from a string and return the rest.
 		Understands quates, parenthesis (barring ) ('s) and
 		percentages.
 Called by:	string_add(string.c)
 ****************************************************************************/
static char *first_arg( char *argument, char *arg_first, bool fCase ) {
    char cEnd;

    while ( *argument == ' ' )
	argument++;

    cEnd = ' ';
    if ( *argument == '\'' || *argument == '"'
      || *argument == '%'  || *argument == '('
      || *argument == '{' )
    {
        if ( *argument == '(' )
        {
            cEnd = ')';
            argument++;
        }
        else if ( *argument == '{' )
        {
            cEnd = '}';
            argument++;
        }
        else cEnd = *argument++;
    }

    while ( *argument != '\0' )
    {
	if ( *argument == cEnd )
	{
	    argument++;
	    break;
	}
    if ( fCase ) *arg_first = SCRIBE::to_lower(*argument);
            else *arg_first = *argument;
	arg_first++;
	argument++;
    }
    *arg_first = '\0';

    while ( *argument == ' ' )
	argument++;

    return argument;
}
 
/*
 * Compare strings, case insensitive, for prefix matching.
 * Return true if astr not a prefix of bstr
 *   (compatibility with historical functions).
 */
static bool str_prefix( const char *astr, const char *bstr )
{
    if ( astr == NULL )
    {
	return true;
    }

    if ( bstr == NULL )
    {
	return true;
    }

    for ( ; *astr; astr++, bstr++ )
    {
	if ( SCRIBE::to_lower(*astr) != SCRIBE::to_lower(*bstr) )
	    return true;
    }

    return false;
} 
 

/*
 *  Helper functions here:
 */
inline int SCRIBE::to_lower(int c) {
    return ((c) >= 'A' && (c) <= 'Z' ? (c) + 32 : (c));
}

inline int SCRIBE::to_upper(int c) {
    return ((c) >= 'a' && (c) <= 'z' ? (c) - 32 : (c));
} 
 
bool SCRIBE::check_fun(lua_State *s, int min_arg, int max_arg) {
    int n = lua_gettop(s);
    SCRIBE *scribe = SCRIBE::find_scribe(s);
    bool error = false;
    
    if (n < min_arg) {
        lua_pushstring(s, "not enough arguments");
        error = true;
    }
    else if (n > max_arg) {
        lua_pushstring(s, "too many arguments");    
        error = true;    
    }
    else if (!scribe) {
        lua_pushstring(s, "scribe not found");        
        error = true;
    }
    
    if (error) {
        lua_error(s);
        return false;
    }
    return true;
}

bool SCRIBE::check_fun(lua_State *s, int min_arg) {
    return check_fun(s, min_arg, min_arg);
}

/*
 *  Default callable C functions here:
 */

static int fun_log(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;

    const char * str = lua_tostring (s, 1);
    if (SCRIBE::find_scribe(s)->log != NULL) {
        SCRIBE::find_scribe(s)->log(str);
    }

    return 0;
}

static int fun_first_arg(lua_State *s) {
    if (!SCRIBE::check_fun(s, 1)) return 1;
    
    if (!lua_isstring(s, 1)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * str = lua_tostring(s, 1);

    char args[1024]="";

    if (strlen(str) >= 1024) {
        SCRIBE::find_scribe(s)->log_internally("fun_first_arg: argument length exceeds MAX_INPUT_LENGTH!");
        lua_pushnil(s);
        lua_pushnil(s);
        return 2;
    }

    char *result    = NULL;
    char *argument  = (char *) str;
    char *arg_first = args;

    result = first_arg(argument, arg_first, false);
    lua_pushstring(s, (const char *) arg_first);
    lua_pushstring(s, (const char *) result);

    return 2;
}

static int fun_str_prefix(lua_State *s) {
    if (!SCRIBE::check_fun(s, 2)) return 1;

    if (!lua_isstring(s, 1)
    ||  !lua_isstring(s, 2)) {
        lua_pushstring(s, "incorrect arguments");
        lua_error(s);
        return 1;
    }

    const char * str1 = lua_tostring(s, 1);
    const char * str2 = lua_tostring(s, 2);

    bool result = str_prefix( str1, str2 );

    lua_pushboolean(s, result);

    return 1;
}

/* lua function table */
const struct fun_type SCRIBE::fun_table[] =
{
    {   "log",                          fun_log                  },
    {   "first_arg",                    fun_first_arg            },
    {   "str_prefix",                   fun_str_prefix           },
    {	"",                             NULL                     }
};




