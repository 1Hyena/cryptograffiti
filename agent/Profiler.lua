Profiler = {
    calls = {},
    total = {},
    clock = {},
    time  = {}
};

function profiler_start()
    debug.sethook(function(event)
        local i = debug.getinfo(2, "Sln")
        if i.what ~= 'Lua' then return end
        local func = i.name or (i.source..':'..i.linedefined)
        
        if event == 'call' then
            Profiler.clock[func] = os.clock()
            Profiler.time[func]  = os.time()
        elseif (Profiler.clock[func] ~= nil) then
            local clock = os.clock() - Profiler.clock[func]
            local time  = os.time() - Profiler.time[func]
            clock = math.max(clock, time)
            Profiler.total[func] = (Profiler.total[func] or 0) + clock
            Profiler.calls[func] = (Profiler.calls[func] or 0) + 1
        end
    end, "cr")
end;

function profiler_end()
    -- the code to debug ends here; reset the hook
    debug.sethook()
end;

function profiler_results()
    local main_time = 0;
    local calls;
    local seconds;
    local percent;
    
    -- print the results
    local sorted = {};
    for f,time in pairs(Profiler.total) do
        table.insert(sorted, {f, time});
        if (time > main_time) then
            main_time = time;
        end;
    end
    
    table.sort(sorted, function(a, b) return a[2] > b[2] end);
    log("Profiler's results:");
    for i=1,#sorted do
        calls   = Profiler.calls[sorted[i][1]];
        seconds = math.floor(sorted[i][2]);
        percent = math.floor((seconds*100)/main_time);        
        
        if (percent < 1) then
            break;
        end;
        
        print ( 
            (
                "%3d. %-40s (%16d %7s, %3d%%)"
            ):format(
                i, sorted[i][1], seconds, "second"..get_plural(seconds), percent
            )
        );
    end
    
    local ideal_time = (global.pulse / get_pps());
    print(("The efficiency of the main loop was %d%%."):format((100*ideal_time)/main_time));
end;

function profile_decoder()
    local clock = os.clock();
    local hex = "";

    local hex = {};
    for i=1, 100 do
        hex[i] = random_hex(20);
    end
    hex = table.concat(hex);

    profile_ascii(hex);
    profile_utf8(hex);

    local delay = string.format("%.4f", os.clock() - clock);
    print("profile_decoder took "..delay.." seconds.");
end;

function profile_ascii(hex)
    local clock = os.clock();
    local ascii = hex2ascii(hex, 20);
    local delay = string.format("%.4f", os.clock() - clock);
    print("profile_ascii took "..delay.." seconds.");
end;

function profile_utf8(hex)
    local clock = os.clock();
    local utf8 = hex2utf8(hex, 20);
    local delay = string.format("%.4f", os.clock() - clock);
    print("profile_utf8 took "..delay.." seconds.");
end;

