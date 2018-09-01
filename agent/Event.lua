event_table = {
    INIT   = {},
    STEP   = {},
    DEINIT = {},
    TX     = {}
};

function event_listen(event, callback)
    table.insert(event_table[event], callback);
end;

function event_trigger(event, ...)
    local unpack = unpack or table.unpack;
    if (event_table[event] == nil) then return; end;

    for i=1,#event_table[event] do
        event_table[event][i](unpack({...}));
    end;
end;

