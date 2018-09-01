global = {
    doexit = false,
    pulse = 0,
    warning = 0,
    SPB = 100000000, -- Satoshis Per Bitcoin
    MIN_BTC_OUTPUT = 0.00000001,
    MEMCAP = 256, -- MiB
    profile = false,
    sleep = 0, -- number of pulses to do nothing
    sleep_started = false
};

user_list = {};
-- {
--    id_0 => { host => x0, inbuf => y0 },
--     ...
--    id_n => { host => xn, inbuf => yn }
-- }

JSON = (loadfile "lib/Json.lua")();

function JSON.assert(message)
    log("Internal Error: "..( (type(message) == "string") and message or "unknown"));
end;

function main()
    math.randomseed( os.time() );

    local args = get_args();
    if (args["logfile"] ~= nil) then
        set_logfile(args["logfile"]);
        log("Logging into "..get_logfile().." started.");
    end

    if (args["port"] ~= nil) then
        start_tcp(args["port"]);
    end;

    if (args["profile"] ~= nil) then
        global.profile = true;
        log("\027[1;33mWarning, profiler is enabled! Everything is MUCH SLOWER.\027[0m");
    end;

    if (args["memcap"] ~= nil) then
        global.MEMCAP = tonumber(args["memcap"]);
        if (global.MEMCAP == nil) then
            global.MEMCAP = 0;
        end;
    end;
    log("Lua memory usage cap is set to "..global.MEMCAP.." MiB.");

    if (load(args["plugins"]) == true) then
        if (refresh_RNG()) then
            log("Using a truly random RNG seed.");
        end;

        init_bitbroker();
        if (global.profile) then profiler_start(); end;
        main_loop();
        if (global.profile) then profiler_end(); end;
        deinit_bitbroker();
    end;

    if (global.profile) then profiler_results(); end;
    shutdown();

    profile_decoder();
    test_utf8();
    --log("stuff: ["..strlen(hex2utf8("6d06146537a66177cf495c406431d987d0a851f333d26f",1)).."]");

    return;
end;

function main_loop()
    if (not check_system("file")
    or  not check_system("xxd")
    or  not check_system("printf")) then
        warn("One of the following programs is not installed: file, xxd, printf.");
        global.doexit = true;
    end

    log("Lua main loop started.");
    while (not global.doexit) do
        local signal = get_signal();
        if (signal ~= nil) then
            global.doexit = true;
            log("Signal: "..signal..", shutting down.");
            break;
        end;

        if (global.sleep == 0) then
            global.sleep_started = false;
            global.pulse = global.pulse + 1;
            step();
        else
            if (global.sleep_started == false) then
                global.sleep_started = true;
                log("Sleeping for "..global.sleep.." pulses.");
            end
            global.sleep = global.sleep - 1;
        end

        coroutine.yield();
    end;
    log("Lua main loop finished.");
end;

function load(plugins)
    local file  = nil;
    local error = nil;

    local files = {
--                  "lib/Hash.lua",
--                  "lib/BigNum.lua",
--                  "lib/Base58.lua",
--                  "lib/Bitcoin.lua",
                    "Utils.lua",
                    "Comm.lua",
                    "Bitbroker.lua",
                    "Event.lua",
                    "Profiler.lua",
                    "Scheduler.lua",
                    "Tables.lua"  -- Should be last as they may depend on previous content
                  };

    local err   = false;

    for i,str in pairs(files) do
        file, error = loadfile(str);
        if (file == nil) then
            log(error);
            err = true;
        else
            file();
        end;
    end;

    if (plugins ~= nil) then
        for plugin in plugins:gmatch("%S+") do
            log("Loading plugin: "..plugin);
            file, error = loadfile(plugin);
            if (file == nil) then
                log(error);
                err = true;
            else
                file();
            end;
        end;
    end;

    return not err;
end;

function step()
    local clock = os.clock();
    local time  = os.time();
    local delay = 0;

    local new_user_list = get_input();

    for k,v in pairs(user_list) do
        if (user_list[k] ~= nil and new_user_list[k] == nil) then
            log(k..". connection lost.");
            user_list[k] = nil;
        end;
    end;

    for k,v in pairs(new_user_list) do
        if (user_list[k] ~= nil) then
            user_list[k].inbuf = user_list[k].inbuf .. new_user_list[k].inbuf;
        else
            local new = nil;

            new = { host  = new_user_list[k].host,
                    inbuf = new_user_list[k].inbuf
                  };
            --log("k:"..k);
            --table.insert(user_list, k, new);
            user_list[k] = new;
            greet_user(k);
        end;
    end;

    for k,v in pairs(user_list) do
        local read = -1;
        local comm = "";
        while (read ~= 0) do
            read = interpret( k, v.inbuf );
            if (read == nil) then
                v.inbuf = "";
                send(k, "\n\rPUT A LID ON IT ! ! !\n\r");
                kick_user(k);
                break;
            end;
            v.inbuf = string.sub( v.inbuf, read+1 );
        end;
    end;

    delay = math.max(os.clock()-clock, os.time()-time);
    scheduler_step(1/get_pps() - delay);
end;

function interpret( id, input )
    local read = 0;

    local lf = string.find( input, "\n" );
    if (lf ~= nil) then
        read = lf;

        local line = string.sub(input, 1, lf-1);
        line = string.gsub(line, "\r", "");

        --log(id .. ": [" .. line .. "]");

        local com, args = first_arg(line);
        if (com == nil and args == nil) then
            return nil;
        end;
        local match = false;

        if (com == nil) then return 0; end;

        if (string.len(com) > 0) then
            for k,v in pairs(command_table) do
                if (not str_prefix(com, v.name)) then
                    v.fun(id, args);
                    if (v.name ~= "exit" and v.name ~= "quit") then
                        send_prompt(id);
                    end;
                    match = true;
                    break;
                end;
            end;

            if (not match) then
                send_message(id, "Unknown command: '"..com.."'\n\r");
                --send_prompt(id);
            end;
        else
            if (archive.enabled
            and archive.users[id] ~= nil
            and #archive.users[id].news > 0) then
                do_read(id, "");
            end;
            send_prompt(id);
        end;
    end;

    return read;
end;

function greet_user(id)
    if (archive.enabled) then
        local archive_user = {news = {}};
        if (archive.users[id] == nil) then
            archive.users[id] = archive_user;
        else
            warn("greet_user: User ID "..id.." already exists in archive.");
        end;

        for k,v in pairs(archive.olds) do
            table.insert(archive.users[id].news, k);
        end;
    end;

    send(id, "\027]0;".."CryptoGraffiti".."\a\n\r");
    send(id, "            _|_|_|                                  _|                \n\r"
           .."          _|        _|  _|_|  _|    _|  _|_|_|    _|_|_|_|    _|_|    \n\r"
           .."          _|        _|_|      _|    _|  _|    _|    _|      _|    _|  \n\r"
           .."          _|        _|        _|    _|  _|    _|    _|      _|    _|  \n\r"
           .."            _|_|_|  _|          _|_|_|  _|_|_|        _|_|    _|_|    \n\r"
           .."                                    _|  _|                            \n\r"
           .."                                _|_|    _|                     \n\r"
           .."    \n\r"
           .."      @@@@@@@@  @@@@@@@    @@@@@@   @@@@@@@@  @@@@@@@@  @@@  @@@@@@@  @@@  \n\r"
           .."     @@@@@@@@@  @@@@@@@@  @@@@@@@@  @@@@@@@@  @@@@@@@@  @@@  @@@@@@@  @@@  \n\r"
           .."     !@@        @@!  @@@  @@!  @@@  @@!       @@!       @@!    @@!    @@!  \n\r"
           .."     !@!        !@!  @!@  !@!  @!@  !@!       !@!       !@!    !@!    !@!  \n\r"
           .."     !@! @!@!@  @!@!!@!   @!@!@!@!  @!!!:!    @!!!:!    !!@    @!!    !!@  \n\r"
           .."     !!! !!@!!  !!@!@!    !!!@!!!!  !!!!!:    !!!!!:    !!!    !!!    !!!  \n\r"
           .."     :!!   !!:  !!: :!!   !!:  !!!  !!:       !!:       !!:    !!:    !!:  \n\r"
           .."     :!:   !::  :!:  !:!  :!:  !:!  :!:       :!:       :!:    :!:    :!:  \n\r"
           .."      ::: ::::  ::   :::  ::   :::   ::        ::        ::     ::     ::  \n\r"
           .."      :: :: :    :   : :   :   : :   :         :        :       :     :    \n\r"
           .."    \n\r"
           .."                            telnet:  carlnet.ee 4000  \n\r"
           .."    \n\r");
    send(id, "Welcome, user from "..user_list[id].host.."!\n\r");
    send(id, "Type \027[1;32mhelp\027[0m to see the list of available commands.\n\r");
    send_prompt(id);
end;

function kick_user(id)
    if (archive.enabled) then
        if (archive.users[id] == nil) then
            warn("kick_user: User ID "..id.." missing from archive.");
        end;
        archive.users[id] = nil;
    end;

    disconnect(id);
end;

function send_message(id, message)
    send(id, message);
    send_prompt(id);
end;

function send_prompt(id)
    if (archive.enabled) then
        if (archive.users[id] ~= nil) then
            local news = #archive.users[id].news;
            if (news > 0) then
                send(id, "\n\r[ "..news.." new message"..(news == 1 and "," or "s,").." press \027[1;32mENTER\027[0m to read. ]\n\r");
                return;
            end;
        else
            warn("send_prompt: User ID "..id.." missing from archive.");
        end;
    end;
    send(id, "\n\r> ");
end;

function refresh_RNG()
    local r = url_request("https://www.random.org/integers/?num=1&min=1&max=1000000000&col=1&base=10&format=plain&rnd=new", nil, nil);

    RNG = (r and tonumber(r)) or nil;
    if (RNG ~= nil) then
        math.randomseed( os.time() + RNG );
    else
        r = string.gsub(r or "", "\n", "");
        r = string.gsub(r or "", "\r", "");
        warn("Unable to refresh RNG Seed (received "..(r or "nil")..")!");
        return false;
    end;
    return true;
end;

