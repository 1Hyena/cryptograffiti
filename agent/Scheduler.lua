scheduler = {
    start = nil,
    tasks = {},
    behind= 0
}

function scheduler_init()
    scheduler.start = os.time();
end;

function scheduler_deinit()    
    if (not global.profile) then
        return;
    end;
    
    log("Scheduled tasks by their priority:");
    table.sort(scheduler.tasks, function(a, b) return a.time < b.time end);
    for i=1,#scheduler.tasks do
        print(("%3d. %35s (period %4d, calls %6d, time %5d)")
              :format(i, scheduler.tasks[i].name,
                         scheduler.tasks[i].period,
                         scheduler.tasks[i].calls,
                         scheduler.tasks[i].skips,
                         scheduler.tasks[i].time));
    end;
end;

function scheduler_step(time_left)   
    if (time_left <= 0) then
        scheduler.behind = scheduler.behind + 1;
        if ((scheduler.behind % 30) == 0) then
            warn("Scheduler is falling behind!");
        end;
        return;
    else
        scheduler.behind = 0;
    end;

    local runtime = os.time() - scheduler.start;
    local time    = os.time();
    local clock   = os.clock();
    local delay   = 0;

    table.sort(scheduler.tasks, function(a, b) return a.time < b.time end);
    local exec_tasks = {};
    for i=1,#scheduler.tasks do
        if ((scheduler.tasks[i].calls+scheduler.tasks[i].skips) * scheduler.tasks[i].period < runtime
        or  scheduler.tasks[i].early) then
            table.insert(exec_tasks, i);
        end;
    end;
    
    local task_time;
    local task_clock;
    local task_delay;
    local task;
    
    for i=1,#exec_tasks do
        task      = exec_tasks[i];
        task_time = os.time();
        task_clock= os.clock();
        task_delay= 0;
        if (not scheduler.tasks[task].early) then
            local ideal_calls = 1 + math.floor(runtime / scheduler.tasks[task].period);
            scheduler.tasks[task].calls = scheduler.tasks[task].calls + 1;
            scheduler.tasks[task].skips = ideal_calls - scheduler.tasks[task].calls;
        else
            scheduler.tasks[task].early=false;
        end;
        --[[
        log("Executing '"..scheduler.tasks[task].name..
            "', rank "..task..
            "', period "..scheduler.tasks[task].period..
            ", time "..math.floor(scheduler.tasks[task].time)..
            ", calls "..scheduler.tasks[task].calls..
            ", skips "..scheduler.tasks[task].skips..
            (scheduler.tasks[task].early and ", early" or "" )..".");
        --]]
        scheduler.tasks[task].fun();
        task_delay = math.max(os.time() - task_time, os.clock() - clock);
        scheduler.tasks[task].time = scheduler.tasks[task].time + task_delay;
        
        delay = math.max(os.time() - time, os.clock() - clock);
        if (time_left - delay <= 0) then
            break;
        end;
    end;
end;

function scheduler_add_task(name, period)
    local fun = _G[name]

    if (fun == nil or type(fun) ~= "function") then
        warn("No function with a name '"..name.."' found.");
        print(debug.traceback());
        scheduler = nil;
    end;
    local t = { 
                ["name"]   = name,   -- name of the function
                ["fun"]    = fun,    -- function to execute
                ["period"] = period, -- function execution period
                ["time"]   = 0,      -- total time consumption of the function
                ["calls"]  = 0,      -- number of times the function has been called
                ["skips"]  = 0,      -- number of times the function was not called due to exceptional lag
                ["early"]  = false   -- when true give it a chance to run early
              };
    
    table.insert(scheduler.tasks, t);
end;

function scheduler_rem_task(name)
    local tasks = {};

    for i=1, #scheduler.tasks do
        if (scheduler.tasks[i].fun ~= fun) then
            table.insert(tasks, scheduler.tasks[i]);
        end
    end

    scheduler.tasks = tasks;
end

function scheduler_run_early(fun)
    for i=1,#scheduler.tasks do
        if (scheduler.tasks[i].fun == fun) then
            scheduler.tasks[i].early = true;
            return;
        end;
    end;
end;

event_listen("INIT",   scheduler_init);
event_listen("DEINIT", scheduler_deinit);

