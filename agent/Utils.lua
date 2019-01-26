function table_length(T)
    local count = 0;
    for _ in pairs(T) do count = count + 1; end;
    return count;
end;

function str_cmp(str1, str2)
    if (string.upper(str1) == string.upper(str2)) then
        return false;
    end;
    return true;
end;

function vlog(str)
    if (cgd.verbose) then
        log(str);
    end;
end;

function warn(text)
    global.warning = global.warning + 1;
    log('\027[1;31mWarning '..global.warning..':\n'..text..'\027[0m');
end;

function serializeTable(val, name, skipnewlines, depth)
    skipnewlines = skipnewlines or false
    depth = depth or 0

    local tmp = string.rep(" ", depth)

    if name then tmp = tmp .. name .. " = " end

    if type(val) == "table" then
        tmp = tmp .. "{" .. (not skipnewlines and "\n" or "")

        for k, v in pairs(val) do
            tmp =  tmp .. serializeTable(v, k, skipnewlines, depth + 1) .. "," .. (not skipnewlines and "\n" or "")
        end

        tmp = tmp .. string.rep(" ", depth) .. "}"
    elseif type(val) == "number" then
        tmp = tmp .. tostring(val)
    elseif type(val) == "string" then
        tmp = tmp .. string.format("%q", val)
    elseif type(val) == "boolean" then
        tmp = tmp .. (val and "true" or "false")
    else
        tmp = tmp .. "\"[inserializeable datatype:" .. type(val) .. "]\""
    end

    return tmp
end;

function string.fromhex(str)
    return (str:gsub('..', function (cc)
        return string.char(tonumber(cc, 16))
    end))
end

--- Returns HEX representation of num
function num2hex(num)
    local hexstr = '0123456789abcdef'
    local s = ''
    while num > 0 do
        local mod = math.fmod(num, 16)
        s = string.sub(hexstr, mod+1, mod+1) .. s
        num = math.floor(num / 16)
    end
    if s == '' then s = '0' end
    return s
end

--- Returns HEX representation of str
function string.tohex(str)
    local hex = ''
    while #str > 0 do
        local hb = num2hex(string.byte(str, 1, 1))
        if #hb < 2 then hb = '0' .. hb end
        hex = hex .. hb
        str = string.sub(str, 2)
    end
    return hex
end

function random_hex(bytes)
    local str = "";
    local hb;
    for i=1,bytes do
        hb  = num2hex(math.random(0, 255));
        if (#hb < 2) then
            hb = '0' .. hb;
        end;
        str = str .. hb;
    end;
    return str;
end

function replace_char(pos, str, r)
    return str:sub(1, pos-1) .. r .. str:sub(pos+1)
end

function get_plural(count)
    if (count == 1) then
        return "";
    end;
    return "s";
end;

function shuffle(t)
    local n = #t;

    while n >= 2 do
        -- n is now the last pertinent index
        local k = math.random(n); -- 1 <= k <= n
        -- Quick swap
        t[n], t[k] = t[k], t[n];
        n = n - 1;
    end;

    return t;
end;

function is_email(email)
    if (email:match("[A-Za-z0-9%.%%%+%-]+@[A-Za-z0-9%.%%%+%-]+%.%w%w%w?%w?")) then
        return true;
    end;
    return false;
end;

function hex2ascii(hex, chunk_size)
    local bytes = string.fromhex(hex);

    if (chunk_size == nil or chunk_size <= 0) then
        chunk_size = string.len(bytes);
        if (chunk_size <= 0) then
            return "";
        end
    end;

    local chunks = math.floor(string.len(bytes) / chunk_size);

    if (string.len(bytes) % chunk_size > 0) then
        chunks = chunks + 1;
    end;

    local chunk;
    local pos;
    local c;
    local chars;
    local valid;
    local visible;
    local message = {};

    for i=1,chunks do
        chunk = "";
        if (i == chunks) then
            chunk = bytes:sub((i-1)*chunk_size+1);
        else
            chunk = bytes:sub((i-1)*chunk_size+1, i*chunk_size);
        end;

        chars   = 0;
        valid   = 0;
        visible = 0;

        for pos = 1, #chunk do
            c = string.byte(chunk, pos);
            chars = chars + 1;

            if (c == 0) then
                chunk = replace_char(pos, chunk, " ");
                valid = valid + 1;
            else
                if (c ==  9 -- horizontal tab
                or  c == 10 -- new line
                or  c == 13 -- carriage return
                or  c == 27 -- 'ANSI Escape Sequence'
                or (c >=  32 and c <= 126)) then
                    valid = valid + 1;
                    if (c >=  32 and c <= 126) then
                        visible = visible + 1;
                    end;
                else
                    chunk = replace_char(pos, chunk, "?");
                end;
            end;
        end;

        if (valid/chars > 0.9 and visible > 0) then
            message[#message + 1] = chunk;
        end;
    end

    return table.concat(message);
end;

function hex2utf8(hex, chunk_size, os_time)
    os_time = os_time or os.time();
    local delay = os.time()-os_time;
    if (delay > 10.0) then
        return "";
        -- A kludgy hack against unintentional Denial of Service attacks.
        -- Fair enough as an emergency solution until a better system is
        -- implemented.
    end;

    local str = string.fromhex(hex);

    if (string.len(str) == 0) then
        return "";
    end;

    local validated   = validate_UTF8(str);
    local first_valid = nil;
    local last_valid  = nil;
    local invalid     = 0;

    if (chunk_size == nil or chunk_size <= 0) then chunk_size = #validated; end;

    -- We start validating the supposed UTF-8 string chunk-by-chunk.
    -- If the chunk is invalid, we must throw it away and start the whole
    -- process from scratch without including the invalid chunk. This is slow
    -- but has to be done when the input could contain chunks of random noise.
    local filtered = {};
    local chunk    = {};
    local i        = 1;

    while (i <= #validated) do
        chunk[#chunk + 1] = str:sub(i,i);
        if (validated[i]) then
            last_valid = #chunk;
            if (first_valid == nil) then
                first_valid = last_valid;
            end;
        else
            invalid = invalid + 1;
        end;

        if (#filtered == 0 and first_valid ~= 1) then
            first_valid = nil;
            last_valid  = nil;
            invalid     = 0;
            i           = math.floor((i-1)/chunk_size)*chunk_size + chunk_size;
            chunk       = {};
        else
            if (i % chunk_size == 0) then
                -- Worst case scenario includes 3 falsely invalid UTF-8 bytes in the
                -- beginning and 3 bad bytes at the end of the chunk.
                if (first_valid ~= nil and first_valid <= 4
                and last_valid+3 >= chunk_size
                and first_valid-1+chunk_size-last_valid == invalid ) then
                    filtered[#filtered + 1] = table.concat(chunk);
                else
                    return hex2utf8(string.tohex(table.concat(filtered))..hex:sub(2*i+1), chunk_size, os_time);
                end;

                chunk = {};
                first_valid = nil;
                last_valid  = nil;
                invalid     = 0;
            end;
        end;
        i = i + 1;
    end;

    if (first_valid ~= nil and first_valid <= 4
    and last_valid == #chunk) then
        filtered[#filtered + 1] = table.concat(chunk);
    elseif (#chunk > 0) then
        return hex2utf8(string.tohex(table.concat(filtered)), chunk_size, os_time);
    end;

    -- No more pure noise chunks were found. We can now invalidate a chunk even
    -- if it has just one invalid UTF-8 byte.
    filtered = table.concat(filtered);
    validated= validate_UTF8(filtered);

    local c;
    local result = {};
    chunk = {};
    invalid = 0;

    for i=1, #validated do
        -- Although all ASCII characters are valid UTF-8 characters,
        -- we deliberately invalidate some ASCII characters that are
        -- very unlikely a part of a human readable text.
        c = string.byte(filtered, i);
        if (c <=127
        and c ~=  0
        and c ~=  9 -- horizontal tab
        and c ~= 10 -- new line
        and c ~= 13 -- carriage return
        and c ~= 27 -- 'ANSI Escape Sequence'
        and c <  32) then
            validated[i] = false;
        end

        if (validated[i]) then
            --if (c == 0) then
            --    chunk[#chunk + 1] = " ";
            --else
                chunk[#chunk + 1] = filtered:sub(i,i);
            --end
        else
            invalid = invalid + 1;
        end;

        if (i % chunk_size == 0) then
            if (invalid == 0) then
                result[#result + 1] = table.concat(chunk);
            end;
            chunk = {};
            invalid = 0;
        end;
    end;

    if (invalid == 0) then
        result[#result + 1] = table.concat(chunk);
    end;

    return table.concat(result);
end;

function strlen(bytes)
    local length = 0;
    for i=1, #bytes do
        c = string.byte(bytes, i);
        if (c == 0) then
            return length;
        end
        length = length + 1;
    end
    return length;
end

function test_utf8()
    local clock = os.clock();
    local max = 100;
    local ok  = 0;
    for i=1,max do
        local hex       = random_hex(100).."d0af20d0bbd18ed0b1d0bbd18e20d182d0b5d0b1"..random_hex(100).."d18f";
        local bytes     = string.fromhex(hex);
        local validated = validate_UTF8(bytes);
        local valid     = "";
        for i=1, #validated do
            if (validated[i]) then
                valid = valid .. "1";
            else
                valid = valid .. "0";
            end;
            if (i % 20 == 0) then
                valid = valid .. "|";
            else
                valid = valid .. " ";
            end;
        end;

        local buf = hex2utf8(hex, 20);
        if (string.tohex(buf) ~= "d0af20d0bbd18ed0b1d0bbd18e20d182d0b5d0b1d18f") then
            print("HEX:   ["..hex.."]");
            print("VALID: ["..valid.."]");
        else
            ok = ok + 1;
        end;
    end;
    print("Correctly validated: "..ok.." in "..string.format("%.2f", os.clock()-clock).." seconds.");
end;

function test_jpg(filename)
    local f, msg = io.open(filename, "rb")
    if (f == nil) then
        print(msg);
        return;
    end;

    local content = f:read("*all");
    f:close();

    local w, h = validate_JPG(content);

    if (w == nil) then
        print(filename.." is not a valid JPG.");
        return;
    end

    print(filename.." is a valid JPG file ("..w.."x"..h..").");
end

