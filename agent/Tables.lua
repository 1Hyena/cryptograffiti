
command_table = {
    { name = "auto",       fun = do_auto,  desc = "Enables/disables automatic message reading."     },
    { name = "echo",       fun = do_echo,  desc = "Echoes the text you give as an input argument."  },
    { name = "exit",       fun = do_exit,  desc = "Closes the connection."                          },
    { name = "help",       fun = do_help,  desc = "Prints the list of available commands."          },    
--  { name = "purge",      fun = do_purge, desc = "Purges memory."                                  },
    { name = "quit",       fun = do_exit,  desc = "Alias to exit."                                  },
    { name = "read",       fun = do_read,  desc = "Prints the next message."                        },
    { name = "skip",       fun = do_skip,  desc = "Skips all unread messages."                      }
};

