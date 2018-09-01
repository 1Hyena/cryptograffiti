#include <signal.h>

void handle(class PORT *p);

bool check_flood(const std::vector < unsigned char >* buffer);

void signal_callback_handler(int signum);

extern volatile sig_atomic_t last_signal;
