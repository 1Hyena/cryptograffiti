NAME    = cgd
CC      = g++
PROF    = -O3
C_FLAGS = -std=c++11 -Wall -Wextra -pedantic-errors -Wconversion -Wno-unused-parameter -fmax-errors=5 $(PROF)
L_FLAGS = -lm -lstdc++ -lcrypto -lz $(PROF)
OBJ_DIR = obj
DEFINES =

SRC_FILES := $(wildcard *.cpp)
O_FILES   := $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(SRC_FILES))

OUT = ../$(NAME)

all:
	@$(MAKE) make_dynamic -s

debug:
	@$(MAKE) make_debug -s

make_dynamic: $(O_FILES)
	@printf "\033[1;33mMaking \033[37m   ...."
	$(CC) -o $(OUT) $(O_FILES) $(L_FLAGS)
	@printf "\033[1;32m %s DONE!\033[0m\n" $(NAME)

make_debug: PROF = -O0 -g -rdynamic
make_debug: DEFINES = -DCGD_DEBUG
make_debug: $(O_FILES)
	@printf "\033[1;33mMaking \033[37m   ...."
	$(CC) -o $(OUT) $(O_FILES) $(L_FLAGS)
	@printf "\033[1;32m DEBUG %s DONE!\033[0m\n" $(NAME)

$(OBJ_DIR)/%.o: %.cpp
		@printf "\033[1m\033[31mCompiling \033[37m....\033[34m %-20s\t\033[33m%6s\033[31m lines\033[0m \n" $*.cpp "`wc -l $*.cpp | cut -f1 -d' '`"
		@$(CC) $< $(C_FLAGS) $(DEFINES) -c -o $@

clean:
	@printf "\033[1;36mCleaning \033[37m ...."
	@rm -f $(O_FILES) $(OUT)
	@printf "\033[1;37m $(NAME) cleaned!\033[0m\n"

