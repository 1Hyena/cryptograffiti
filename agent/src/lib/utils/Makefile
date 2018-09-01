NAME    = utils

CC      = gcc
PROF    = -O -g

# following line is original
C_FLAGS = -Wall -Wno-variadic-macros -pedantic $(PROF)
L_FLAGS = -lm $(PROF)

SRC_FILES := $(wildcard *.cpp)
OBJ_DIR = obj

SRC_FILES := $(wildcard *.cpp)
O_FILES   := $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(SRC_FILES))

OUT = ./lib$(NAME).a

all:
	@$(MAKE) $(OUT) -s

$(OUT): $(O_FILES)
	@printf "\033[1;33mMaking \033[37m   ...."
	@ar rcs $(OUT) $(O_FILES)
	@printf "\033[1;32m lib$(NAME).a DONE!\033[0m\n"

$(OBJ_DIR)/%.o: %.cpp
		@printf "\033[1m\033[31mCompiling \033[37m....\033[34m %-20s\t\033[33m%6s\033[31m lines\033[0m \n" $*.cpp "`wc -l $*.cpp | cut -f1 -d' '`"
		$(CC) $(INCLUDE) $< $(C_FLAGS) -c -o $@

clean:
	@printf "\033[1;36mCleaning \033[37m ...."
	@rm -f $(O_FILES) *~ *.bak *.orig *.rej
	@printf "\033[1;37m lib$(NAME).a cleaned!\033[0m\n"
