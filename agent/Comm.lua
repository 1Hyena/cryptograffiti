
function do_echo(id, str)
    send(id, str.."\n\r");
end;

function do_purge(id, str)
    local memusage = collectgarbage("count")/1024.0;
    send(id, "Lua memory usage is "..string.format("%.4f", memusage).." MiB.\n\r");
    send(id, "Freeing memory ... \n\r");
    collectgarbage();
    memusage = collectgarbage("count")/1024.0;
    send(id, "Lua memory usage is now "..string.format("%.4f", memusage).." MiB.\n\r");    
end;

function do_help(id, str)
    send(id, "Available Commands:\n\r");
    for k,v in pairs(command_table) do
        send(id, string.format(" %8s - %-60s", v.name, v.desc).."\n\r");
    end;

end;

function do_exit(id, str)
    send(id, "Alas, all good things must come to an end ... \n\r");
    
    kick_user(id);
end;

function do_read(id, str)
    if (archive.users[id] == nil) then
        send(id, "Archive is disabled.\n\r");
        return;
    end;    
    
    local tx = table.remove(archive.users[id].news);
    if (tx == nil) then
        send(id, "No new messages to read.\n\r");
        return;
    end;

    if (archive.olds[tx] ~= nil) then    
        send(id, "\027[0;32mTX \027[1;32m"..tx.."\027[0;32m:\027[0m\n\r"..archive.olds[tx].."\027[0m\n\r");
    end;
end;

function do_auto(id, str)
    if (archive.users[id] == nil) then
        send(id, "Archive is disabled.\n\r");
        return;
    end;    
    
    if (archive.users[id].auto) then
        archive.users[id].auto = false;
        send(id, "Autoread is now disabled.\n\r");
    else
        archive.users[id].auto = true;
        send(id, "Autoread is now enabled.\n\r");
    end;    
end;

function do_skip(id, str)
    if (archive.users[id] == nil) then
        send(id, "Archive is disabled.\n\r");
        return;
    end;    
    
    local messages = #archive.users[id].news;
    
    send(id, "Skipped "..messages.." message"..(messages == 1 and "." or "s.").."\n\r");
    
    archive.users[id].news = {};
end;

