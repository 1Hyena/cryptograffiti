CC      = gcc
PROF    = -O -g
C_FLAGS = -Wall -Wno-variadic-macros -pedantic $(PROF)
L_FLAGS = -L./lib -lm $(PROF)
OBJ_DIR = obj

#Dependencies:
DEP_DIR   = ./lib/
DEP_SNET  = ./lib/snet/libsnet.a
DEP_UTILS = ./lib/utils/libutils.a
DEP_SCRIBE= ./lib/scribe/libscribe.a
DEP_LUA   = ./lib/lua/liblua.a
DEPENDS   = snet utils scribe lua
LIB_DEP   = $(DEP_SNET) $(DEP_UTILS) $(DEP_SCRIBE) $(DEP_LUA)

SRC_FILES := $(wildcard *.cpp)
O_FILES   := $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(SRC_FILES))

INCLUDE = $(patsubst %,-I./$(DEP_DIR)/%/,$(DEPENDS))

all:
	@$(MAKE) bitbroker -s

bitbroker: $(O_FILES)
	@printf "\033[1;33mMaking \033[37m   ...."
	$(CC) $(L_FLAGS) -o ../bitbroker $(O_FILES) $(LIB_DEP) -lm -lstdc++ -lcrypto -lcurl -ldl
	@printf "\033[1;32m DYNAMICALLY LINKED BITBROKER DONE!\033[0m\n"

$(OBJ_DIR)/%.o: %.cpp
		@printf "\033[1m\033[31mCompiling \033[37m....\033[34m %-20s\t\033[33m%6s\033[31m lines\033[0m \n" $*.cpp "`wc -l $*.cpp | cut -f1 -d' '`"
		@$(CC) $(INCLUDE) $< $(C_FLAGS) -c -o $@

clean_this:
	@printf "\033[1;36mFinishing\033[37m ...."
	@rm -f $(O_FILES) *~ *.bak *.orig *.rej
	@printf "\033[1;37m ALL CLEANED!\033[0m\n"

clean:
	@$(MAKE) clean_this -s
