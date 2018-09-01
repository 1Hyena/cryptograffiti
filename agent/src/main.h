#include <string>
#include <vector>
#include <map>
#include <snet.h>

#define PULSE_PER_SECOND 1
#define PPS PULSE_PER_SECOND

#define FLOOD_LENGTH 1048576 // 1 MegaByte, this hard limit should be used to prevent malicious flooding

extern std::map<std::string, std::string> main_args;
extern std::vector<class PORT*> ports;
extern class NETWORKER * nw;
extern class SCRIBE    * scribe;
extern bool  terminating; // set to true when program needs to be shut down
extern std::string logfile_name;

bool init(int argc, char **argv);
void deinit(void);
void rest(void);
void log_snet(const char *);
void log_text(const char *);
void log_scribe(const char *);

class PORT * find_port(int id);
void flush_port(int id);
