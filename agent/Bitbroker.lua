cgd = {
    session_nonce = "s1G2VVv9Sspu4bjNLiDeeHasin3NVsXT", -- NEVER STORE THE REAL NONCE IN CODE REPOSITORY
    invalid_nonce = 5, -- Number of times INVALID_NONCE error is going to be tolerated in a row.

    database = {
        url       = "https://cryptograffiti.info/api/"
    },

    session = {
        guid        = hash_SHA256(tostring(math.random()), false),
        token       = nil,
        TLS         = false,
        ALS         = false,
        data        = {},
        active      = false,
        sleep       = 4,
        max_sleep   = 4,
        profit      = "0",
        escrow      = "0",
        riskfund    = "0",
        halt        = true,
        set_account = false,
        last_log    = 0,
        skipping    = true,
        online      = false
    },
    api_usage = {
        rpm         =  0,
        max_rpm     = 60,
        max_sleep   =  1,
        sleep_pulse =  0 -- pulse nr when the max_sleep was increased last time
    },
    constants= {},
    ALS = {
        sec_key  = nil,
        sec_hash = nil,
        nonce    = nil,
        seed     = nil
    },
    upload_txs= {},
    TPS         = 100, -- transactions per second
    verbose     = false,
    estimatefee = false,
    historian   = false,
    realtime    = false,
    monitor     = false,
    decode      = false,
    encode      = false,
    backwards   = nil,
    mime        = false, -- try to detect the mime type of messages
    utf8        = false  -- try to detect and decode utf8 messages
};

bitcoin = {
    enabled              = false,
    rpc_user             = "BlockChainClient",
    rpc_password         = "gcfApgghA2oBCacz9fGmY88ULUNLFL29", -- NEVER STORE THE REAL PASSWORD IN CODE REPOSITORY
    rpc_ip               = "127.0.0.1",
    rpc_port             = "8332",
    wallet_account       = "CryptoGraffiti",
    wallet_passphrase    = nil, -- NEVER STORE THE REAL PASSWORD IN CODE REPOSITORY, nil means unencrypted wallet
    wallet_addresses     = {}, -- all addresses that share the same account
    txs_from             = 0,
    balance              = 0,
    down                 = true,
    block_nr             = 288302,
    new_txs              = {},
    checked_blocks       = {},
    donations            = {},
    raw_mempool          = {new={}, old={}}, -- used when monitoring donations to a BTC address that is not present in the local wallet
    hot_txs              = {}, -- dictionary of recently confirmed transactions
    propagate_txs        = {}, -- array of recently confirmed unpropagated transactions
    startup              = true,
    poll_blockchain      = false, -- true when blockchain should be polled ASAP
    curl_timeout         = 10, -- RPCs must get answered in 10 seconds
    unavailable_tx_count = 0
};

fallback = {
    enabled   = false,
    down      = true,
    offset    = 0,
    limit     = 1,
    block     = {hash = nil, txs = {}}
};

archive = {
    enabled = false,
    users   = {},
    news    = {},
    olds    = {},
    order   = {}
};

executive = {
    MIN_BTC_OUTPUT = global.MIN_BTC_OUTPUT,
    FEE_PER_KB     = 0.0001,
    FEE_AMPLIFIER  = 1.0,
    group          = '0',
    order_nr       = nil,
    order          = nil,
    tickets        = {},
    min_conf       = 0,    -- minimum number of confirmations required to fill an order
    version        = 0.95, -- the web client won't work if its version is lower than this
    profits        = {["1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS"] = 0.10}
--  Previous profit distribution scheme:
--  profits        = {["1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS"] = 0.09,
--                    ["1ED5qtLdnFURLGQxajysRJtfJyNZ3fVWLi"] = 0.01}
};

admin = {
    email = "hyena@hyena.net.ee",
    notification = "",
    retry = 10
};

blockchain_info = {
    url = "https://blockchain.info/",
    api_usage = {
        rpm     = 0,
        max_rpm = 60
    },
};

function blockchain_info_url_request(resource, expect_json)
    blockchain_info.api_usage.rpm = blockchain_info.api_usage.rpm + 1;
    vlog("BLOCKCHAIN.INFO: "..resource.." ("..blockchain_info.api_usage.rpm.."/"..blockchain_info.api_usage.max_rpm.." RPM)");
    if (blockchain_info.api_usage.rpm > blockchain_info.api_usage.max_rpm) then
        log("Maximum RPM exceeded, request aborted.");
        return nil;
    end

    local response = url_request(blockchain_info.url..resource, nil, nil);

    if (response == nil) then
        log("Failed API call: "..resource);
        return nil;
    end;

    if (expect_json) then
        local t = JSON:decode(response);
        if (t == nil or type(t) ~= "table") then
            log("Invalid JSON object received from blockchain.info!");
            warn(response);
            return nil;
        end
        return t;
    end

    return response;
end

function cgd_url_request(function_name, json_data)
    local response;
    if (cgd.api_usage.rpm*2 >= cgd.api_usage.max_rpm) then
        vlog("CGD URL REQUEST: "..function_name.." ("..cgd.api_usage.rpm.."/"..cgd.api_usage.max_rpm.." RPM)");
    end

    if (cgd.api_usage.rpm+10 >= cgd.api_usage.max_rpm
    and cgd.api_usage.rpm    <  cgd.api_usage.max_rpm) then
        global.sleep = 60*get_pps();
        warn("API usage approaches its hard limit, sleeping for 1 minute.");
    end

    if (cgd.ALS.sec_hash) then
        local s = hash_MD5(tostring(math.random()), false);
        local cs= hash_MD5(json_data..cgd.ALS.sec_key, false);
        json_data = AES_256_encrypt(json_data, cgd.ALS.sec_key, s);

        response = url_request(cgd.database.url, nil, { fun      = function_name,
                                                        data     = json_data,
                                                        sec_hash = cgd.ALS.sec_hash,
                                                        salt     = s,
                                                        checksum = cs,
                                                        token    = cgd.session.token } );
    else
        response = url_request(cgd.database.url, nil, { fun  = function_name, data = json_data, token = cgd.session.token });
    end;

    if (cgd.ALS.sec_hash and response ~= nil) then
        local tt = JSON:decode(response);
        if (tt == nil or tt.data == nil or tt.iv == nil or tt.checksum == nil) then
            warn("Unexpected response: "..response);
            response = nil;
            if (cgd.api_usage.rpm >= cgd.api_usage.max_rpm and global.pulse > cgd.api_usage.sleep_pulse) then
                -- We have exceeded the API usage limit, start making increasingly
                -- longer pauses before retrying.
                cgd.api_usage.sleep_pulse = global.pulse;
                global.sleep = math.max(global.sleep, cgd.api_usage.max_sleep);
                cgd.api_usage.max_sleep = cgd.api_usage.max_sleep * 2;
                if (cgd.api_usage.max_sleep > 5*60*get_pps()) then
                    cgd.api_usage.max_sleep = 5*60*get_pps();
                end
            end
        else
            response = AES_256_decrypt(tt.data, cgd.ALS.sec_key, tt.iv);
            local cs = hash_MD5(response..cgd.ALS.sec_key, false);
            if (cs ~= tt.checksum) then
                response = nil;
                warn("Received data integrity check failed, wrong checksum!");
            end;
        end;
    end;

    if (response == nil) then
        log("Failed API call: "..function_name);
        return nil;
    end;

    local t = cgd_decode_response(response);
    if (t == nil) then
        log("Failed API call: "..function_name);
        log("Invalid JSON object received!");
        warn(response);
    else
        if (t.error ~= nil) then
            warn(serializeTable(t.error));
            if (t.error.code == "ERROR_NONCE") then
                cgd.invalid_nonce = cgd.invalid_nonce - 1;
                if (cgd.invalid_nonce <= 0) then
                    log("Nonce is no longer synchronized, closing.");
                    global.doexit = true;
                else
                    log("Trying next nonce. "..cgd.invalid_nonce..
                        " attempt"..(cgd.invalid_nonce == 1 and " " or "s ").."remaining.");
                end;
            end;
        else
            if (cgd.invalid_nonce < 5) then
                log("Nonce is now synchronized again!");
                cgd.invalid_nonce = 5;
            end;
        end;
        if (t.api_usage ~= nil and type(t.api_usage) == "table") then
            cgd.api_usage.rpm     = t.api_usage.rpm     or  0;
            cgd.api_usage.max_rpm = t.api_usage.max_rpm or 60;
            if (cgd.api_usage.rpm < cgd.api_usage.max_rpm) then
                cgd.api_usage.max_sleep = 1;
            end
        end;
        if (cgd.ALS.nonce and cgd.ALS.seed) then
            cgd.ALS.nonce = hash_SHA256(cgd.ALS.nonce..cgd.ALS.seed, true);
        end;
        return t;
    end;

    return nil;
end;

function cgd_decode_response(response)
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil) then
            return t;
        end;
    end;
    return nil;
end;

function init_bitbroker()
    local handshake = false;
    local args = get_args();

    if (args["guid"]             ~= nil) then cgd.session.guid = args["guid"];                      end;

    if (args["rpcuser"]          ~= nil) then bitcoin.rpc_user          = args["rpcuser"];          end;
    if (args["rpcpassword"]      ~= nil) then bitcoin.rpc_password      = args["rpcpassword"];      end;
    if (args["rpcip"]            ~= nil) then bitcoin.rpc_ip            = args["rpcip"];            end;
    if (args["rpcport"]          ~= nil) then bitcoin.rpc_port          = args["rpcport"];          end;
    if (args["walletpassphrase"] ~= nil) then bitcoin.wallet_passphrase = args["walletpassphrase"]; end;
    if (args["walletaccount"]    ~= nil) then bitcoin.wallet_account    = args["walletaccount"];    end;

    if (args["tps"] ~= nil) then
        cgd.TPS = math.floor(tonumber(args["tps"]));
        if (cgd.TPS < 1) then cgd.TPS = 1; end;
        log("TPS:   "..cgd.TPS);
    end;

    if (args["title"] ~= nil) then
        log("TITLE: "..args["title"].."\027]0;"..args["title"].."\a");
    end;

    if (args["sec_key"] ~= nil) then
        cgd.ALS.sec_key = args["sec_key"];
    else
        local key = hash_SHA256(tostring(math.random()), false);
        warn("`sec_key` not provided in program arguments. Using this:\n"..key);
        cgd.ALS.sec_key = key;
        handshake = true;
    end;

    if (args["seed"] ~= nil) then
        cgd.ALS.seed = args["seed"];
        log("SEED:  "..(cgd.ALS.seed or "nil"));
    end;

    if (args["token"] ~= nil) then
        cgd.session.token = args["token"];
        log("TOKEN: "..(cgd.session.token or "nil"));
    end;

    if (args["btc_rpc"] ~= nil) then
        bitcoin.enabled = true;
        log("Bitcoin Core RPC enabled.");
    end;

    if (args["verbose"] ~= nil) then
        cgd.verbose = true;
        log("Verbose logging enabled.");
    end;

    if (args["estimatefee"] ~= nil) then
        cgd.estimatefee = true;
        log("Fee estimation enabled.");
    end;

    if (args["historian"] ~= nil) then
        cgd.historian = true;
        log("Decoding randomly chosen historic blocks.");
    end;

    if (args["realtime"] ~= nil) then
        cgd.realtime = true;
        log("Checking unconfirmed transactions as they appear.");
    end;

    if (args["monitor"] ~= nil) then
        cgd.monitor = true;
        log("Monitoring the server log.");
    end;

    if (args["decode"] ~= nil) then
        cgd.decode = true;
        log("Transaction decoding enabled.");

        if (args["utf8"] ~= nil) then
            cgd.utf8 = true;
            log("UTF-8 decoding enabled.");
        end;

        if (args["mime"] ~= nil) then
            cgd.mime = true;
            log("MIME type detection enabled.");
        end;
    end;

    if (args["api"] ~= nil) then
        cgd.database.url = args["api"];
        log("Using the API from "..cgd.database.url..".");
    end;

    if (args["encode"] ~= nil) then
        cgd.encode = true;
        executive.group = args["encode"];
        log("Transaction encoding enabled for group "..executive.group..".");
    end;

    if (args["fallback"] ~= nil) then
        fallback.enabled = true;
        log("Fallback to 3rd party services enabled.");
    end;

    if (args["archive"] ~= nil) then
        archive.enabled = true;
        log("Archive of decoded messages enabled.");
    end;

    if (args["backwards"] ~= nil) then
        cgd.backwards = tonumber(args["backwards"]);
        log("Loading blocks in a reverse order starting from block "..cgd.backwards..".");
    end;

    local hs = handshake and cgd_fun_handshake();

    if (handshake == false or hs ~= nil) then
        if (handshake == true) then
            if (hs.TLS == "1") then
                log("TLS was enabled.");
            else
                log("TLS was disabled.");
            end;
        else
            log("Skipped Security Handshake.");
        end;
        cgd.ALS.sec_hash = hash_SHA256(cgd.ALS.sec_key, true);

        if (cgd_fun_init(true) and cgd_fun_get_session()) then
            log("GUID:  "..(cgd.session.guid or "nil"));
            cgd.session.active = true;
        else
            warn("Failed to initiate a session. Generating a new GUID.");
            cgd.session.guid = hash_SHA256(tostring(math.random()), false);
            if (cgd_fun_init(false) and cgd_fun_get_session()) then
                log("GUID:  "..(cgd.session.guid or "nil"));
                cgd.session.active = true;
            else
                warn("Failed to initiate a session. Closing!");
                global.doexit = true;
            end;
        end;
    end;

    --TODO: Move bitcoin_* to Bitcoin.lua plugin.
    scheduler_add_task('bitbroker_poll_wallet',                        10);
    scheduler_add_task('bitbroker_estimate_fee',                       60);
    scheduler_add_task('bitbroker_poll_donations',                     10);
    scheduler_add_task('bitbroker_poll_block',                         10);
    scheduler_add_task('bitbroker_poll_mempool',                       60);
    scheduler_add_task('bitbroker_monitor_txs',                         5);
    scheduler_add_task('bitbroker_bitcoin_poll_blockchain',           300);
    scheduler_add_task('bitbroker_fallback_poll_donations',            10);
    scheduler_add_task('bitbroker_fallback_poll_block',                60);
    scheduler_add_task('bitbroker_fallback_reset_blockchain_info_rpm', 60);
    scheduler_add_task('bitbroker_encoder_poll_new_orders',            10);
    scheduler_add_task('bitbroker_decode_graffiti',                     5);
    scheduler_add_task('bitbroker_cgd_step_uploader',                  10);
    scheduler_add_task('bitbroker_cgd_step_session',                   10);
    scheduler_add_task('bitbroker_cgd_step_monitor',                    5);
    scheduler_add_task('bitbroker_cgd_step_encoder',                    5);
    scheduler_add_task('bitbroker_cgd_step_archive',                    5);
    scheduler_add_task('bitbroker_step_bitcoin',                        3);
    scheduler_add_task('bitbroker_check_memory',                       10);
    scheduler_add_task('bitbroker_free_memory',                       300);
    scheduler_add_task('admin_step',                                 3600);

    event_trigger("INIT", args);
end;

function deinit_bitbroker()
    admin_step();
    event_trigger("DEINIT");
end;

function bitbroker_poll_wallet()
    if (not is_connected() or not bitcoin.enabled) then return; end;
    poll_wallet();
    if (bitcoin.down) then
        scheduler_run_early(bitbroker_poll_wallet);
    end;
end;

function bitbroker_estimate_fee()
    if (not is_connected() or not bitcoin.enabled or bitcoin.down) then
        return;
    end;
    estimate_fee();
end;

function bitbroker_poll_donations()
    if (not is_connected() or not bitcoin.enabled or bitcoin.down) then
        return;
    end;
    poll_donations();
end;

function bitbroker_poll_block()
    if (not is_connected() or not bitcoin.enabled or bitcoin.down) then
        return;
    end;
    poll_block();
end;

function bitbroker_poll_mempool()
    if (not is_connected() or not bitcoin.enabled or bitcoin.down) then
        return;
    end;
    poll_mempool();
end;

function bitbroker_monitor_txs()
    if (not is_connected() or not bitcoin.enabled or bitcoin.down) then
        return;
    end;
    monitor_txs();
end;

function bitbroker_bitcoin_poll_blockchain()
    if (not is_connected() or not bitcoin.enabled or bitcoin.down) then
        scheduler_run_early(bitbroker_bitcoin_poll_blockchain)
        return;
    end;
    bitcoin_poll_blockchain();
    if (bitcoin.poll_blockchain) then
        scheduler_run_early(bitbroker_bitcoin_poll_blockchain);
    end;
end;

function bitbroker_fallback_poll_donations()
    if (not is_connected()) then return; end;
    fallback_poll_donations();
end;

function bitbroker_fallback_poll_block()
    if (not is_connected()) then return; end;
    fallback_poll_block();
end;

function bitbroker_fallback_reset_blockchain_info_rpm()
    if (not is_connected()) then return; end;
    fallback_reset_blockchain_info_rpm();
end;

function bitbroker_encoder_poll_new_orders()
    if (not is_connected()) then return; end;
    encoder_poll_new_orders();
end;

function bitbroker_decode_graffiti()
    if (not is_connected()) then return; end;
    decode_graffiti();
end;

function bitbroker_cgd_step_uploader()
    if (not is_connected()) then return; end;
    cgd_step_uploader();
end;

function bitbroker_cgd_step_session()
    if (not is_connected()) then return; end;
    cgd_step_session();
end;

function bitbroker_cgd_step_monitor()
    if (not is_connected()) then return; end;
    cgd_step_monitor();
end;

function bitbroker_cgd_step_encoder()
    if (not is_connected()) then return; end;
    cgd_step_encoder();
end;

function bitbroker_cgd_step_archive()
    if (not is_connected()) then return; end;
    cgd_step_archive();
end;

function bitbroker_step_bitcoin()
    if (not is_connected()) then return; end;
    step_bitcoin();
end;

function notify_admin(subject, message)
    local nl = "\n\n";
    if (string.len(admin.notification) == 0) then
        nl = "Notifications from session "..string.sub(cgd.session.guid, 1, 8).."...\n\n";
    end
    admin.notification = admin.notification..nl..subject.." ("..os.date("%c")..")\n"..message;
end

function admin_step()
    if (string.len(admin.notification) == 0 or not is_connected()) then
        return;
    end

    local from = "bitbroker@cryptograffiti.info";
    if (not cgd_fun_send_mail(admin.email, "Notification", admin.notification, "From:"..from)) then
        admin.retry = admin.retry - 1;
        if (admin.retry > 0) then
            log("Failed to notify admin ("..admin.email.."). "..admin.retry..
                " attempt"..get_plural(admin.retry).." remaining.");
        end
    else
        admin.notification = "";
        admin.retry = 10;
        log("Sent a notification e-mail to "..admin.email..".");
    end

    if (admin.retry <= 0) then
        warn("Failed to notify admin, discarding notifications.");
        admin.retry = 10;
        admin.notification = "";
    end
end

function bitbroker_check_memory()
    local memusage = collectgarbage("count")/1024.0;
    if (memusage > global.MEMCAP and global.doexit ~= true) then
        warn("Lua memory usage of "..string.format("%.4f", memusage).." MiB exceeds the cap of "..string.format("%.4f", global.MEMCAP).." MiB.");
        bitbroker_free_memory();
        memusage = collectgarbage("count")/1024.0;
        if (memusage <= global.MEMCAP) then
            return;
        end

        global.doexit = true;
        local msg = "Lua memory usage is "..string.format("%.4f", memusage)..
                    " MiB and exceeds the cap of "..string.format("%.4f", global.MEMCAP).." MiB.\n\n"..
                    "Session GUID: "..string.sub(cgd.session.guid, 1, 8).."...";
        local from = "bitbroker";
        if (not cgd_fun_send_mail("hyena@hyena.net.ee", "MEMCAP EXCEEDED", msg, "From:"..from)) then
            log("Failed to send an e-mail.");
        end;
        log(msg);
    end;

    --notify_admin("memory check", "Lua memory usage is "..string.format("%.4f", memusage).." MiB.");
end;

function bitbroker_free_memory()
    local memusage = collectgarbage("count")/1024.0;
    local membefore = memusage;
    collectgarbage();
    memusage = collectgarbage("count")/1024.0;
    vlog("Freed "..string.format("%.4f", membefore-memusage)..
         " MiB. Lua now consumes "..string.format("%.4f",memusage).." MiB.");
end;

function report_unavailable(count)
    if (count == 0) then return; end
    log("TX details of "..count.." TX"..get_plural(count).." were unavailable.");
end

function step_bitcoin()
    if (bitcoin.down) then
        return;
    end;

    if (#event_table.TX == 0) then
        bitcoin.propagate_txs = {};
        return;
    end;

    local checked         = 0;
    local remaining       = {};
    local propagate_count = #bitcoin.propagate_txs;
    local clock           = os.clock();
    local time            = os.time();
    local delay           = 0;
    local fail            = 0;

    if (propagate_count == 0) then
        return;
    end;

    local unavailable_tx_count = 0;
    for i=1,#bitcoin.propagate_txs do
        if (delay > 1.0 or fail > 2) then
            table.insert(remaining, bitcoin.propagate_txs[i]);
        else
            local tx = bitcoin_get_raw_transaction(bitcoin.propagate_txs[i], 1);
            if (tx == false) then unavailable_tx_count = unavailable_tx_count + 1; end
            if (tx == nil) then
                fail = fail + 1;
                table.insert(remaining, bitcoin.propagate_txs[i]);
            else
                if (tx ~= false and tx["vout"] ~= nil) then
                    event_trigger("TX", tx);
                end;
                checked = checked + 1;
            end;
        end;

        delay = math.max(os.clock()-clock, os.time()-time);
    end;

    delay = string.format("%.2f", delay);
    if (checked == propagate_count) then
        vlog("Checked "..propagate_count.." confirmed TX"..get_plural(propagate_count).." in "..delay.." seconds.");
    else
        vlog("Checked "..checked.." of "..propagate_count.." confirmed TX"..get_plural(propagate_count).." in "..delay.." seconds.");
    end;

    report_unavailable(unavailable_tx_count);

    if (fail > 0) then
        warn("Failed to check "..fail.." confirmed TX"..get_plural(fail)..".");
    end;

    bitcoin.propagate_txs = remaining;
end;

function is_connected()
    if (next(cgd.constants) == nil) then
        if (cgd_fun_get_constants() == false) then
            global.doexit = true;
        else
            if (cgd.constants.SATOSHIS_PER_BITCOIN ~= nil) then
                global.SPB = tonumber(cgd.constants.SATOSHIS_PER_BITCOIN);
            end;

            if (cgd.constants.MIN_BTC_OUTPUT ~= nil) then
                global.MIN_BTC_OUTPUT = tonumber(cgd.constants.MIN_BTC_OUTPUT) / global.SPB;
                executive.MIN_BTC_OUTPUT = global.MIN_BTC_OUTPUT;
            end;

            if (cgd.constants.ENCODER_FEE_AMPLIFIER ~= nil and cgd.encode) then
                local amp = tonumber(cgd.constants.ENCODER_FEE_AMPLIFIER);
                if (type(amp) == "number" and amp > 0.0) then
                    executive.FEE_AMPLIFIER = amp;
                    log("Encoder fee amplifier is "..string.format("%.2f", amp)..".");
                end
            end
        end;
        return false;
    end;
    return true;
end;

function is_online()
    return cgd.session.online;
end

function poll_wallet()
    local balance_shown = false;

    local btc_balance = bitcoin_fun_get_balance();
    if (btc_balance ~= nil) then
        if (bitcoin.balance ~= btc_balance) then
            log("Bitcoin Wallet Balance: "..btc_balance.." BTC.");
            balance_shown = true;
        end;
        bitcoin.balance = btc_balance;
        bitcoin.down = false;
    else
        log("Bitcoin Wallet Balance is unavailable!");
        bitcoin.down = true;
    end;

    local btc_addresses = bitcoin_fun_get_addresses_by_account(bitcoin.wallet_account);
    if (btc_addresses ~= nil) then
        bitcoin.wallet_addresses = btc_addresses;
    else
        bitcoin.wallet_addresses = {};
    end;

end;

function estimate_fee()
    if (not cgd.estimatefee) then
        return;
    end;

    local fail = true;
    local fee = bitcoin_fun_estimate_fee(6);
    if (fee ~= nil) then
        if (fee > 0.0) then
            fee = fee * executive.FEE_AMPLIFIER; -- Compensate for the lower than dust outputs.
            if (executive.FEE_PER_KB ~= fee or global.pulse % (600*get_pps()) == 0) then
                executive.FEE_PER_KB = fee;
                local sat_byte = tostring(math.ceil((global.SPB * fee) / 1000));
                log("Estimated TX fee is now "..sat_byte.." sat/B.");
                if (cgd.encode) then
                    cgd_fun_set_stat("sat_byte", sat_byte);
                end
            end;
            fail = false;
        end
    end;

    if (fail) then
        warn("Failed to estimate TX fee per kilobyte.");
    end
end;

function poll_donations()
    if (not cgd.decode) then
        return;
    end;

    if (table_length(bitcoin.new_txs) > 0) then
        return;
    end;

    local txs = bitcoin_fun_list_transactions(bitcoin.wallet_account, cgd.constants.TXS_PER_QUERY, bitcoin.txs_from);

    if (txs and #txs > 0) then
        local added = 0;
        local amount = 0;
        local continue = false;

        for k,v in pairs(txs) do
            if (v.category == "receive"
            and bitcoin.donations[v.txid] ~= true) then
                continue = false;
                if (v.confirmations == 0) then
                    bitcoin.new_txs[v.txid] = {amount = v.amount, confirmed = false};
                elseif (v.confirmations < 432) then
                    bitcoin.new_txs[v.txid] = {amount = v.amount, confirmed = true};
                else
                    continue = true;
                end;

                if (not continue) then
                    added = added + 1;
                    amount = amount + v.amount;

                    bitcoin.donations[v.txid] = true;
                end;
            end;
        end;

        bitcoin.txs_from = bitcoin.txs_from + #txs;

        if (added > 0) then
            log("Received "..(added).." bitcoin donation"..(added == 1 and " " or "s ").."("..string.format("%.8f", amount).." BTC).");
        end;
    else
        bitcoin.txs_from = 0;
    end;
end;

function poll_mempool()
    -- Monitor all pending transactions...
    if (not cgd.realtime) then
        return;
    end;

    --if (cgd.verbose) then
    --    log("Loading raw memory pool.");
    --end;

    local txs = bitcoin_fun_get_raw_mempool();

    --if (cgd.verbose) then
    --    if (txs) then
    --        if (#txs > 0) then
    --            log((#txs).." pending transaction"..(#txs == 1 and " " or "s ").."detected.");
    --        else
    --            log("No pending transactions detected.");
    --        end;
    --    else
    --        warn("Failed to load the raw memory pool.");
    --    end;
    --end;

    if (txs == nil) then
        warn("Failed to load the raw memory pool.");
        return;
    end;

    local t = os.time();
    for k,v in pairs(txs) do
        if (bitcoin.raw_mempool.old[v] == nil
        and bitcoin.raw_mempool.new[v] == nil) then
            bitcoin.raw_mempool.new[v] = {creation = t};
        end;
    end;
end;

function monitor_txs()
    -- Monitor all pending transactions...
    if (not cgd.realtime) then
        return;
    end;

    local new_txs_count = table_length(bitcoin.raw_mempool.new);
    local delete        = {};
    local amount        = 0;
    local added         = 0;
    local count         = 0;
    local clock         = os.clock();
    local time          = os.time();
    local delay         = 0;
    local fail          = 0;

    local unavailable_tx_count = 0;
    for txid,v in pairs(bitcoin.raw_mempool.new) do
        local tx = bitcoin_get_raw_transaction(txid,1);
        if (tx == false) then unavailable_tx_count = unavailable_tx_count + 1; end
        if (tx == nil) then
            fail = fail + 1;
        else
            if (tx ~= false and tx["vout"] ~= nil) then
                event_trigger("TX", tx);
                for i,j in pairs(tx["vout"]) do
                    if (j["scriptPubKey"] ~= nil and j.scriptPubKey["addresses"] ~= nil) then
                        for m,n in pairs(j.scriptPubKey["addresses"]) do
                            if (cgd.decode) then
                                if (n == cgd.constants.BTC_ADDRESS
                                and bitcoin.donations[txid] ~= true) then
                                    local amt = j["value"];
                                    bitcoin.new_txs[txid] = {amount = amt, confirmed = false};
                                    bitcoin.donations[txid] = true;
                                    added = added + 1;
                                    amount = amount + amt;
                                end;
                            end;
                        end;
                    end;
                end;
            end;
            bitcoin.raw_mempool.old[txid] = bitcoin.raw_mempool.new[txid];
            table.insert(delete, txid);

            count = count + 1;
        end;

        delay = math.max(os.clock()-clock, os.time()-time);
        if (delay > 1.0) then
            break;
        end;
    end;

    if (cgd.verbose and new_txs_count > 0) then
        local time_str = string.format("%.2f", delay);
        if (count == new_txs_count) then
            if (delay > 1.0) then
                log("Checked "..new_txs_count.." unconfirmed TX"..(new_txs_count == 1 and " " or "s ").."in "..time_str.." seconds.");
            end;
        else
            log("Checked "..count.." of "..new_txs_count.." unconfirmed TX"..(new_txs_count == 1 and " " or "s ").."in "..time_str.." seconds.");
        end;
    end;

    report_unavailable(unavailable_tx_count);

    if (fail > 0) then
        warn("Failed to check "..fail.." unconfirmed TX"..get_plural(fail)..".");
    end;

    if (added > 0) then
        log("Received "..(added).." bitcoin donation"..(added == 1 and " " or "s ").."("..string.format("%.8f", amount).." BTC).");
    end;

    -- Deleting new transactions that were just copied to the list of old transactions:
    for i=1, #delete do
        if (bitcoin.raw_mempool.new[delete[i]] ~= nil) then
            bitcoin.raw_mempool.new[delete[i]] = nil;
        end;
    end;
    delete = {};
    --if (cgd.verbose) then
    --    log(table_length(bitcoin.raw_mempool.new).." new and "..table_length(bitcoin.raw_mempool.old).." old.");
    --end;

    -- Deleting too old and still unconfirmed transactions:
    if (global.pulse % (3600*get_pps()) == 0) then
        local t = os.time();
        for k,v in pairs(bitcoin.raw_mempool.old) do
            if (os.difftime(t, bitcoin.raw_mempool.old[k].creation) > 3600) then
                table.insert(delete, k);
            end;
        end;

        local deleted = 0;
        for i=1, #delete do
            if (bitcoin.raw_mempool.old[delete[i]] ~= nil) then
                bitcoin.raw_mempool.old[delete[i]] = nil;
                deleted = deleted + 1;
            end;
        end;
        delete = {};
        if (cgd.verbose and deleted > 0) then
            log("Deleted "..deleted.." outdated and unconfirmed TX"..(deleted == 1 and "." or "s."));
        end;
    end;
end;

function poll_block()
    if (not cgd.decode or not is_online()) then
        return;
    end;

    if (table_length(bitcoin.new_txs) > 0) then
        return;
    end;

    local decode_next = true;

    if (bitcoin.startup == false) then
        if (cgd.backwards ~= nil) then
            if (bitcoin.block_nr < 1) then
                log("Reached the first block when decoding backwards, closing.");
                global.doexit = true;
                return;
            else
                bitcoin.block_nr = bitcoin.block_nr - 1;
            end;
        else
            local block_count = bitcoin_get_block_count();

            if (block_count == nil) then
                return;
            end;

            if (block_count == bitcoin.block_nr) then
                decode_next = false;
            else
                if (block_count < bitcoin.block_nr
                or  block_count > bitcoin.block_nr + 6) then
                    bitcoin.block_nr = block_count;
                else
                    bitcoin.block_nr = bitcoin.block_nr + 1;
                end;
            end;
        end;
    else
        bitcoin.startup = false;
        if (cgd.backwards ~= nil) then
            bitcoin.block_nr = cgd.backwards;
        end;
    end;

    if (cgd.historian == true) then
        local max_block    = bitcoin.block_nr;
        local random_block = math.random(1, max_block);
        local repeated = 0;
        while (bitcoin.checked_blocks[random_block] ~= nil) do
            random_block = random_block + 1;
            repeated     = repeated + 1;
            if (repeated > 10000 or random_block > max_block) then
                return;
            end;
        end;
        bitcoin.checked_blocks[random_block] = true;

        local block_hash = nil;
        local block      = nil;
        block_hash = bitcoin_get_block_hash(random_block);

        if (block_hash ~= nil) then
            if (cgd.verbose) then
                log("Loading block "..random_block.." (randomly chosen).");
            end;
            block = bitcoin_get_block(block_hash);
        end;

        if (block ~= nil and block["tx"] ~= nil) then
            for k,v in pairs(block["tx"]) do
                if (bitcoin.new_txs[v] == nil) then
                    bitcoin.new_txs[v] = { confirmed = true };
                else
                    bitcoin.new_txs[v].confirmed = true;
                end;
            end;
        end;

        return;
    end;

    if (bitcoin.block_nr > 0 and decode_next) then
        local block_hash = nil;
        local block      = nil;

        if (bitcoin.block_nr > 0) then
            block_hash = bitcoin_get_block_hash(bitcoin.block_nr);
        end;

        if (block_hash ~= nil) then
            --if (cgd.verbose) then
            log("Loading block "..bitcoin.block_nr..".");
            --end;
            block = bitcoin_get_block(block_hash);
        end;

        if (block ~= nil and block["tx"] ~= nil) then
            --local del_mempool = 0;
            for k,v in pairs(block["tx"]) do
                if (bitcoin.new_txs[v] == nil) then
                    bitcoin.new_txs[v] = { confirmed = true };
                else
                    bitcoin.new_txs[v].confirmed = true;
                end;

                --if (bitcoin.raw_mempool.new[v]
                --or  bitcoin.raw_mempool.old[v]) then
                --    del_mempool = del_mempool + 1;
                --end;

                bitcoin.raw_mempool.new[v] = nil;
                bitcoin.raw_mempool.old[v] = nil;
            end;

            --if (cgd.verbose and del_mempool > 0) then
            --    log("Deleted "..del_mempool.." transaction"..(del_mempool == 1 and " " or "s ")..".");
            --end;
        end;
    end;
end;

function bitcoin_poll_blockchain()
    local clock  = os.clock();
    local time   = os.time();
    local delay  = 0;
    local blocks = bitcoin_get_block_count();

    if (blocks == nil) then
        warn("Failed to get block count when polling blockchain.");
        bitcoin.poll_blockchain = true;
        return;
    end;

    local block_nr   = blocks;
    local block_hash = nil;
    local hot_txs    = {};
    local max_conf   = 6;

    for i=1, max_conf do
        block_hash = bitcoin_get_block_hash(block_nr);

        if (block_hash ~= nil) then
            local block = bitcoin_get_block(block_hash);

            if (block == nil) then
                warn("Failed to get block "..block_nr.." when polling blockchain.");
                bitcoin.poll_blockchain = true;
                return;
            elseif (block["tx"] ~= nil) then
                for k,v in pairs(block["tx"]) do
                    if (bitcoin.hot_txs[v] == nil) then
                        table.insert(bitcoin.propagate_txs, v);
                    end;
                    hot_txs[v] = i;
                end;
            end;
        else
            warn("Failed to get hash of block "..block_nr.." when polling blockchain.");
            bitcoin.poll_blockchain = true;
            return;
        end;

        block_nr = block_nr - 1;
        if (block_nr < 1) then
            break;
        end;
    end;

    delay = math.max(os.clock()-clock, os.time()-time);
    delay = string.format("%.2f", delay);

    vlog("Refreshed last "..max_conf.." block"..get_plural(max_conf).." in "..delay.." seconds.");
    bitcoin.poll_blockchain = false;

    bitcoin.hot_txs = hot_txs;
end;

function decode_graffiti()
    if (not cgd.decode) then
        return;
    end;

    local new_txs_count = table_length(bitcoin.new_txs);
    local upload_count  = table_length(cgd.upload_txs);

    if (new_txs_count <= 0 or upload_count > 0) then
        return;
    end;

    local tx         = nil;
    local last_token = nil;
    local cur        = 0;
    local max        = cgd.TPS;
    local delete     = {};
    local decode     = {};

    local clock = os.clock();
    local time  = os.time();
    local delay = 0;

    local unavailable_tx_count = 0;
    for k,v in pairs(bitcoin.new_txs) do
        cur = cur + 1;

        delay = math.max(os.time()-time, os.clock()-clock);
        if (delay > 1.0 or cur > max) then
            break;
        end;

        tx = nil;
        if (bitcoin.enabled and not bitcoin.down) then
            -- The below call sometimes blocks for more than 10 seconds.
            -- This is somewhat normal considering that bitcoin-core can lag.
            tx = bitcoin_get_raw_transaction(k,1);
            if (tx == false) then unavailable_tx_count = unavailable_tx_count + 1; end
        elseif (fallback.enabled) then
            if (fallback.block.txs[k] ~= nil) then
                tx = {vout = {}, confirmations = 1};
                local btx = fallback.block.txs[k];
                if (btx.out ~= nil) then
                    for i,j in pairs(btx.out) do
                        if (string.len(j.script) == 50
                        and j.script:sub(1,6)    == "76a914"
                        and j.script:sub(47,50)  == "88ac") then
                            local out = {value = j.value/global.SPB, addr = j.addr, addr_hex = j.script:sub(7,46)};
                            table.insert(tx.vout, out);
                        elseif (j.script:sub(1,2) == "6a" -- OP_RETURN
                        and string.len(j.script) >= 12) then
                            local len = j.script:sub(3,4);
                            len = tonumber(len, 16);
                            if (len >= 4) then
                                local op_return_hex = j.script:sub(5, 4+2*len);
                                local out = {value = j.value/global.SPB, ["op_return_hex"] = op_return_hex};
                                table.insert(tx.vout, out);
                            end
                        end;
                    end;
                end;
            elseif (bitcoin.donations[k] ~= nil) then
                local t = blockchain_info_url_request("rawtx/"..k, true);
                if (t ~= nil) then
                    tx = {vout = {}};

                    if (t.block_height ~= nil) then
                        tx.confirmations = 1;
                    end;

                    if (t.out ~= nil) then
                        for i,j in pairs(t.out) do
                            if (string.len(j.script) == 50
                            and j.script:sub(1,6)    == "76a914"
                            and j.script:sub(47,50)  == "88ac") then
                                local out = {value = j.value/global.SPB, addr = j.addr, addr_hex = j.script:sub(7,46)};
                                table.insert(tx.vout, out);
                            elseif (j.script:sub(1,2) == "6a" -- OP_RETURN
                            and string.len(j.script) >= 12) then
                                local len = j.script:sub(3,4);
                                len = tonumber(len, 16);
                                if (len >= 4) then
                                    local op_return_hex = j.script:sub(5, 4+2*len);
                                    local out = {value = j.value/global.SPB, ["op_return_hex"] = op_return_hex};
                                    table.insert(tx.vout, out);
                                end
                            end;
                        end;
                    end;
                else
                    fallback.down = true;
                end
                --[[
                local response = url_request("https://blockchain.info/rawtx/"..k, nil, nil);
                if (response == nil) then
                    log("Blockchain.info not responding.");
                else
                    local t = cgd_decode_response(response);
                    if (t == nil) then
                        log("Invalid JSON object received from blockchain.info!");
                        warn(response);
                    else
                        tx = {vout = {}};

                        if (t.block_height ~= nil) then
                            tx.confirmations = 1;
                        end;

                        if (t.out ~= nil) then
                            for i,j in pairs(t.out) do
                                if (string.len(j.script) == 50
                                and j.script:sub(1,6)    == "76a914"
                                and j.script:sub(47,50)  == "88ac") then
                                    local out = {value = j.value/global.SPB, addr = j.addr, addr_hex = j.script:sub(7,46)};
                                    table.insert(tx.vout, out);
                                end;
                            end;
                        end;
                    end;
                end;
                --]]
            end;
        end;

        if (tx and tx["vout"] ~= nil) then
            if (v.raw_graffiti == nil) then;
                v.raw_graffiti = {};

                local donation  = 0;
                local confirmed = false;
                local op_return_hex = nil;

                if (tx.confirmations ~= nil and tx.confirmations > 0) then
                    confirmed = true;
                end;

                for i,j in pairs(tx["vout"]) do
                    if (j["scriptPubKey"] ~= nil) then
                        if (j.scriptPubKey["asm"] ~= nil) then
                            last_token = "";
                            for token in string.gmatch(j.scriptPubKey["asm"], "[^%s]+") do
                                if (last_token == "OP_HASH160") then
                                    table.insert(v.raw_graffiti, token);
                                    break;
                                elseif (last_token == "OP_RETURN") then
                                    op_return_hex = j.scriptPubKey["hex"]:sub(5); --token;
                                    --log(token.. "-> "..j.scriptPubKey["hex"]);
                                    break;
                                end;
                                last_token = token;
                            end;
                        end;

                        if (j["value"] ~= nil and j.scriptPubKey["addresses"] ~= nil) then
                            for m,n in pairs(j.scriptPubKey["addresses"]) do
                                if (n == cgd.constants.BTC_ADDRESS) then
                                    local amt = j["value"];
                                    donation = donation + amt;
                                    break;
                                end;
                            end;
                        end;
                    elseif (j.addr_hex ~= nil) then
                        table.insert(v.raw_graffiti, j.addr_hex);
                        if (j.value ~= nil and j.addr ~= nil
                        and j.addr == cgd.constants.BTC_ADDRESS) then
                            donation = donation + j.value;
                        end;
                    elseif (j.op_return_hex ~= nil) then
                        op_return_hex = j.op_return_hex;
                    end;
                end;

                --if (donation == 0) then
                --    -- Because OP_RETURN channel contains a lot of plaintext spam
                --    -- we ignore it unless it includes a donation to our service.
                --    op_return_hex = nil;
                --end

                bitcoin.new_txs[k].amount    = donation;
                bitcoin.new_txs[k].confirmed = confirmed;
                bitcoin.new_txs[k].op_return_hex = op_return_hex;

                if (#v.raw_graffiti > 0 or v.op_return_hex ~= nil) then
                    table.insert(decode, k);
                else
                    table.insert(delete, k);
                    --log("TX "..k.." is invalid.");
                end
            else
                -- For some reason this tx already contains graffiti data, skip it.
                warn("New TX already contains graffiti prior to decoding!");
                table.insert(decode, k);
            end;
        else
            table.insert(delete, k);
        end;
    end;

    if (cgd.verbose) then
        local time_str = string.format("%.2f", delay);
        log("Extracted "..cur.." of "..new_txs_count.." TX"..(new_txs_count == 1 and " " or "s ")..
            "in "..time_str.." seconds.");
    end;

    report_unavailable(unavailable_tx_count);

    local dropped = 0;
    for i=1, #delete do
        if (bitcoin.new_txs[delete[i]] ~= nil) then
            dropped = dropped + 1;
            bitcoin.new_txs[delete[i]] = nil;
        end;
    end;
    delete = {};

    if (cgd.verbose and dropped > 0) then
        log("Dropped "..dropped.." uninteresting TX"..(dropped == 1 and "." or "s."));
    end;

    local archived     = 0;
    local str          = "";
    local chars        = 0;
    local valid        = 0;
    local c            = 0;
    local visible      = 0;
    local message;
    local hex;
    local op_return_hex;
    local utf8 = false;
    local msg_hash = nil;
    local mimetype = nil;
    local upload_msg = false;
    local spam_txs = 0;
    local fsize = 0;
    local hashes = {};
    clock = os.clock();
    time  = os.time();

    tx = nil;
    for j=1, #decode do
        tx = bitcoin.new_txs[decode[j]];
        message = "";
        hex     = table.concat(tx.raw_graffiti);
        utf8    = false;
        img     = nil;
        msg_hash= nil;
        mimetype= nil;
        upload_msg = false;
        fsize = 0;
        op_return_hex = tx.op_return_hex;

        if (cgd.mime) then
            local bytes = string.fromhex(hex);
            local fsz = is_blockchain_file(bytes);
            local KiB = "";
            local blockchain_file = false;

            if (fsz > 0) then
                mimetype = get_mimetype(string.sub(bytes, 1, fsz));
                KiB = string.format("%.2f", fsz/1024);
                log("Detected a file: "..mimetype.." ("..KiB.." KiB"..").");
                blockchain_file = true;
                fsize = fsz;
            else
                fsize = nil;
                mimetype = get_mimetype(bytes);
                fsz = string.len(bytes);
                KiB = string.format("%.2f", fsz/1024);
                if (not ( (mimetype == 'image/jpeg' and validate_JPG(bytes) ~= nil)
                       or (mimetype == 'image/png')
                       or (mimetype == 'image/bmp')
                       or (mimetype == 'image/gif')
                       or (mimetype == 'image/ico')
                )) then
                    mimetype="application/octet-stream";
                end
            end

            if (string.len(mimetype) > 64) then
                log("MIME type "..mimetype.." exceeds 64 bytes, falling back to generic.");
                mimetype=nil;
                if (blockchain_file) then
                    mimetype="application/octet-stream";
                end
            end

            if (mimetype ~= nil) then
                message = mimetype.." ("..KiB.." KiB)";

                if (not blockchain_file) then
                    if (mimetype ~= 'application/octet-stream') then
                        upload_msg = true;
                        log("Detected a TX containing "..(mimetype)..".");
                    else
                        message = "";
                        mimetype = nil; -- Fallback to UTF8 / ASCII detection.
                    end
                else
                    upload_msg = true;
                end
            end
        end

        local op_return = "";
        if (mimetype == nil) then
            if (cgd.utf8) then
                if (op_return_hex ~= nil) then
                    op_return = hex2utf8(op_return_hex, 1);
                end
                message = hex2utf8(hex, 20);

                if (strlen(message) > 1 or strlen(op_return) > 1) then
                    utf8 = true;
                end;
            end;

            if (not utf8) then
                if (op_return_hex ~= nil) then
                    op_return = hex2ascii(op_return_hex, strlen(op_return_hex)/2);
                end
                message = hex2ascii(hex, 20);
            end;

            if (strlen(op_return) > 1) then
                msg_hash = hash_SHA256(message..op_return, false);

                local msglen = strlen(message);
                if (msglen > 1) then
                    message = string.sub(message, 1, msglen);
                else
                    message = "";
                end

                msglen = strlen(op_return);
                op_return = string.sub(op_return, 1, msglen);

                if (op_return_hex ~= nil) then
                    local oplen = strlen(op_return);
                    local raw_oplen = strlen(op_return_hex)/2;
                    if (oplen < 8 or oplen/raw_oplen < 0.8) then
                        op_return = "";
                    end
                end

                if (strlen(message) + strlen(op_return) > 1) then upload_msg = true; end
            else
                msg_hash = hash_SHA256(message, false);

                local msglen = strlen(message);
                if (msglen > 1) then
                    message = string.sub(message, 1, msglen);
                    upload_msg = true;
                end
            end
        end

        if (upload_msg and msg_hash ~= nil and hashes[msg_hash] ~= nil and bitcoin.donations[decode[j]] == nil) then
            upload_msg = false;
            spam_txs = spam_txs + 1;
        end

        if (upload_msg) then
            if (msg_hash ~= nil) then
                hashes[msg_hash] = true;
            end

            if (mimetype == nil) then
                if (cgd.verbose) then
                    local msz = strlen(message) + strlen(op_return);

                    if (strlen(op_return) > 0) then
                        op_return = "-----BEGIN OP_RETURN MESSAGE BLOCK-----\n"
                                 .. op_return
                                 .. "\n----- END OP_RETURN MESSAGE BLOCK -----\027[0m";
                        if (strlen(message) > 0) then
                            op_return = "\n" .. op_return;
                        end
                    end

                    log("Decoded"..(utf8 and " UTF-8 " or " ").."message of "..msz.." bytes:\n"..message.."\027[0m"..op_return);
                end
                mimetype = "application/octet-stream";
            end

            if (archive.enabled
            and archive.olds[ decode[j] ] == nil
            and archive.news[ decode[j] ] == nil) then
                archive.news[ decode[j] ] = message;
                table.insert(archive.order, decode[j]);
                archived = archived + 1;
            end;

            cgd.upload_txs[ decode[j] ] = {
                conf     = "1",
                amount   = "0",
                ["type"] = mimetype,
                hash     = msg_hash
            }; -- Default, suitable for most cases

            if (fsize ~= nil) then
                cgd.upload_txs[ decode[j] ].fsize = tostring(fsize);
            end

            if (tx.confirmed == false) then
                cgd.upload_txs[ decode[j] ].conf = "0";
            end;

            if (tx.amount ~= nil) then
                cgd.upload_txs[ decode[j] ].amount = tostring(math.floor(tx.amount*global.SPB));
            end;
        end

        table.insert(delete, decode[j]);
    end;

    if (cgd.verbose and #decode > 0) then
        delay = math.max(os.time()-time, os.clock()-clock);
        local time_str = string.format("%.2f", delay);
        log("Decoded "..(#decode).." TX"..(#decode == 1 and " " or "s ").."in "..time_str.." seconds.");
    end;

    dropped = 0;
    for i=1, #delete do
        if (bitcoin.new_txs[delete[i]] ~= nil) then
            dropped = dropped + 1;
            bitcoin.new_txs[delete[i]] = nil;
        end;
    end;
    delete = nil;
    decode = nil;

    if (cgd.verbose and archived > 0) then
        log("Archived "..archived.." decoded TX"..(archived == 1 and "." or "s."));
    end;

    if (cgd.verbose and dropped > 0) then
        log("Dropped "..dropped.." decoded TX"..(dropped == 1 and "." or "s."));
    end;

    if (cgd.verbose and spam_txs > 0) then
        log("Ignored "..spam_txs.." spam TX"..(spam_txs == 1 and "." or "s."));
    end

    --new_txs_count = table_length(bitcoin.new_txs);
    --if (cgd.verbose and new_txs_count > 0) then
    --    warn(new_txs_count.." new transaction"..(new_txs_count == 1 and " " or "s ").."remaining.");
    --end;
end;

function fallback_poll_donations()
    if ((bitcoin.enabled and not bitcoin.down) or not fallback.enabled) then
        return;
    end;
    --[[
    local txs = nil;
    local response = url_request("https://blockchain.info/address/"..cgd.constants.BTC_ADDRESS..
                                 "?format=json&limit="..fallback.limit..
                                 "&offset="..fallback.offset, nil, nil);

    if (response == nil) then
        log("Blockchain.info not responding.");
        fallback.down = true;
        return;
    end;

    local t = cgd_decode_response(response);
    if (t == nil) then
        log("Invalid JSON object received from blockchain.info!");
        warn(response);
        fallback.down = true;
        return;
    end;
    --]]
    fallback.down = true;
    local t = blockchain_info_url_request("address/"..cgd.constants.BTC_ADDRESS..
                                          "?format=json&limit="..fallback.limit..
                                          "&offset="..fallback.offset, true);

    if (t == nil) then
        return;
    end

    local txs = t.txs;
    if (txs == nil) then
        return;
    end

    local amount = 0;
    local added  = 0;
    local txid   = nil;
    local stop   = false;

    for k,v in pairs(txs) do
        if (v.hash ~= nil and v.out ~= nil) then
            txid = v.hash;

            if (bitcoin.donations[txid] ~= true) then
                for i,j in pairs(v.out) do
                    if (j.addr ~= nil and j.addr == cgd.constants.BTC_ADDRESS and j.value ~= nil) then
                        local amt = j["value"]/global.SPB;
                        bitcoin.new_txs[txid] = {amount = amt, confirmed = false};

                        if (v.block_height ~= nil) then
                            bitcoin.new_txs[txid].confirmed = true;
                        end;

                        bitcoin.donations[txid] = true;
                        added = added + 1;
                        amount = amount + amt;
                        break;
                    end;
                end;
            end;

            if (v.time+168*60*60 < os.time()) then
                stop = true;
            end;
        end;
    end;

    if (added > 0 and stop == false) then
        log("Received "..(added).." bitcoin donation"..(added == 1 and " " or "s ").."("..string.format("%.8f", amount).." BTC).");
        fallback.offset = fallback.offset + added;
        fallback.limit  = 10;
    else
        fallback.offset = 0;
        fallback.limit  = 1;
    end;
    fallback.down = false;
end;

function fallback_reset_blockchain_info_rpm()
    if ((bitcoin.enabled and not bitcoin.down) or not fallback.enabled) then
        return;
    end

    blockchain_info.api_usage.rpm = 0;
end

function fallback_poll_block()
    if ((bitcoin.enabled and not bitcoin.down) or not fallback.enabled) then
        return;
    end;
    fallback.down = true;
    --[[
    local response = nil;
    local txs      = nil;

    response = url_request("https://blockchain.info/q/latesthash", nil, nil);
    if (response == nil) then
        log("Blockchain.info not responding.");
        fallback.down = true;
        return;
    end;

    local response = blockchain_info_url_request("q/latesthash", false);
    --]]
    local t = blockchain_info_url_request("latestblock", true);
    if (t == nil) then
        return;
    end

    local latesthash = t.hash;
    if (latesthash == nil or strlen(latesthash) ~= 64) then
        log("Invalid block hash of the latest block from blockchain.info.");
        warn(serializeTable(t));
        return;
    end

    if (fallback.block.hash ~= latesthash) then
        log("Loading block "..latesthash..".");
        -- new block found, download it!
        fallback.block = {hash = latesthash, txs = {}};

        local block = blockchain_info_url_request("rawblock/"..fallback.block.hash, true);
        if (block == nil) then
            return;
        end
        --[[
        response = url_request("https://blockchain.info/rawblock/"..fallback.block.hash, nil, nil);
        if (response == nil) then
            log("Blockchain.info not responding.");
            fallback.down = true;
            return;
        end;
        --]]

        -- load transactions.
        --[[
        local block = cgd_decode_response(response);
        if (block == nil) then
            log("Invalid JSON object received from blockchain.info!");
            warn(response);
            fallback.down = true;
            return;
        end;
        --]]

        if (block ~= nil and block["tx"] ~= nil) then
            block.txs = {};
            for k,v in pairs(block["tx"]) do
                local txhash = v.hash;
                if (bitcoin.new_txs[txhash] == nil) then
                    bitcoin.new_txs[txhash] = { confirmed = true };
                else
                    bitcoin.new_txs[txhash].confirmed = true;
                end;

                block.txs[txhash] = v;
            end;
            block.tx = nil;
        end;

        fallback.block = block;
    end;

    fallback.down = false;
end;

function cgd_step_session()
    if (not cgd.session.active) then
        return;
    end;

    if ((not bitcoin.enabled  or bitcoin.down )
    and (not fallback.enabled or fallback.down)) then
        return;
    end;

    -- KEEP DECOER's SESSION ALIVE
    if (not cgd_fun_get_session()) then
        log("Failed to update session data.");
        cgd.session.online = false;
    else
        cgd.session.online = true;
    end;
end

function cgd_step_uploader()
    if (not cgd.decode) then
        return;
    end;

    if (not cgd.session.active) then
        return;
    end;

    local n = table_length(cgd.upload_txs);
    if (n > 0) then
        local max = n;
        if (max > cgd.constants.TXS_PER_QUERY) then
            max = cgd.constants.TXS_PER_QUERY;
        end;

        log("Uploading "..max.." of "..n.." TX"..(n == 1 and "." or "s."));

        local upload_count = 0;
        local upload_txs = {};
        local delete     = {};

        for k,v in pairs(cgd.upload_txs) do
            upload_count = upload_count + 1;
            if (upload_count > max) then
                break;
            end;

            upload_txs[k] = v;
            table.insert(delete, k);
        end;

        if (not cgd_fun_set_btc_txs(upload_txs)) then
            warn("Failed to upload "..max.." TX"..(max == 1 and "." or "s."));
        else
            local dropped = 0;
            for i=1, #delete do
                if (cgd.upload_txs[delete[i]] ~= nil) then
                    dropped = dropped + 1;
                    cgd.upload_txs[delete[i]] = nil;
                end;
            end;

            delete = nil;
            upload_txs = nil;

            if (cgd.verbose and dropped > 0) then
                log("Dropped "..dropped.." uploaded TX"..(dropped == 1 and " " or "s ").."from queue.");
            end;
        end;
    end;
end;

function cgd_step_monitor()
    -- Monitor the server's log...
    if (not cgd.session.active
    or  not cgd.monitor) then
        return;
    end;

    local logs = nil;

    if (cgd.session.skipping) then
        logs = cgd_fun_get_log(nil, tostring(cgd.constants.LOGS_PER_QUERY));
        if (logs ~= nil) then
            cgd.session.skipping = false;
        end;
    else
        logs = cgd_fun_get_log(tostring(cgd.session.last_log+1), tostring(cgd.constants.LOGS_PER_QUERY));
    end;

    if (logs ~= nil) then
        local w = false;
        for k,v in pairs(logs) do
            if (cgd.session.last_log < tonumber(v.nr)) then
                cgd.session.last_log = tonumber(v.nr);

                --local ip   = v.ip               or "";
                --local snr  = v.session_nr       or "";
                local ct   = v.creation_time    or "";
                --local fun  = v.fun              or "";
                --local line = v.line             or "";
                --local file = v.file             or "";
                local level= tonumber(v.level);
                local color = "\027[0m";

                if (level == 0) then color="\027[0;37m"; end; -- spam
                if (level == 1) then color="\027[0m";    end; -- normal
                if (level == 2) then color="\027[0;31m"; end; -- misuse
                if (level == 3) then color="\027[1;35m"; end; -- financial
                if (level == 4) then color="\027[1;33m"; end; -- error
                if (level == 5) then color="\027[1;31m"; end; -- critical

                print(" DB: "..string.format("%-20s: "..color.."%s\027[0m", ct, v.text));
            else
                w = true;
            end;
        end;
        if (w) then
            warn("Received log was not sorted as ascending!");
        end;
    end;

    return;
end;

function cgd_step_encoder()
    if (not cgd.session.active
    or  not cgd.encode
    or  not bitcoin.enabled
    or      bitcoin.down) then
        return;
    end;

    local start_from = 0;
    local txs        = nil;
    local txs_count  = cgd.constants.TXS_PER_QUERY;
    local min_conf   = executive.min_conf;
    local max_conf   = math.max(6, min_conf+144);

    txs = bitcoin_fun_list_unspent(0, max_conf, bitcoin.wallet_addresses);

    if (txs and #txs > 0) then
        for k,v in pairs(txs) do
            encoder_process_transaction(v.address, v.amount, v.txid, v.confirmations, v.vout);
            --log(v.address.."|"..v.amount.."|"..v.txid.."|"..v.confirmations.."|"..v.vout);
        end;
    end;

    encoder_fill_orders();
    encoder_upload_orders();

    local delete = {};

    for k,v in pairs(executive.tickets) do
        if (not v.active or v.ttl <= 0) then
            table.insert(delete, k);
        end;
    end;

    local deleted = 0;
    for i=1, #delete do
        if (executive.tickets[delete[i]] ~= nil) then
            executive.tickets[delete[i]] = nil;
            deleted = deleted + 1;
        end;
    end;
    delete = {};

    if (cgd.verbose and deleted > 0) then
        log("Deleted "..deleted.." order"..(deleted == 1 and "." or "s."));
    end;

end;

function encoder_process_transaction(addr, amount, tx, conf, vout)
    local ticket, ticket_key = encoder_find_ticket(addr, amount);
    if (ticket ~= nil and ticket_key ~= nil) then
        if (ticket.txs[tx] ~= nil and ticket.txs[tx] == conf) then
            return;
        end;

        --if (ticket.txs[tx] == nil and conf > 0) then
        --
        --end;

        local refresh_conf  = true;
        local update_output = false;

        if (ticket.txs[tx] == nil and conf == 0) then
            refresh_conf = false;
        end;

        if (ticket.txs[tx] == nil
        or  ticket.txs[tx] ~= conf) then update_output = true; end;

        ticket.txs[tx]   = conf;
        ticket.vouts[tx] = vout;
        ticket.payment   = { txid = tx, vout = vout, address = addr };

        if (refresh_conf) then
            local largest = nil;
            local largest_tx = nil;
            for i,j in pairs(ticket.txs) do
                if (largest == nil or largest < j) then
                    largest = j;
                    largest_tx = i;
                end;
            end;
            if (largest ~= nil) then
                if (ticket.conf ~= largest) then
                    update_output = true;
                end;
                ticket.conf      = largest;
                ticket.payment   = { txid    = largest_tx,
                                     vout    = ticket.vouts[largest_tx],
                                     address = addr
                                   };
            end;
        end;

        if (update_output) then
            ticket.upload = true;
        end;
    end;
end;

function encoder_poll_new_orders()
    if (not cgd.session.active
    or  not cgd.encode
    or  not bitcoin.enabled
    or      bitcoin.down) then
        return;
    end;

    local next_order    = nil;
    local next_order_nr = nil;
    local start         = '0';

    local orders = cgd_fun_get_orders(executive.group, start, tostring(cgd.constants.ORDERS_PER_QUERY), '0', '0', '0', nil);

    if (orders == nil) then
        log("Failed to get orders.");
        return;
    end;

    local n = table_length(orders);

    if (n > 0) then
        if (cgd.verbose) then
            log(""..n.." order"..(n == 1 and " " or "s ").."remaining for the encoder in group "..executive.group..".");
        end;

        local r = math.random(1, n);
        local random_order = orders[r];
        if (random_order == nil) then
            warn("orders["..r.."] is nil.");
            return;
        end;
        random_order = random_order.nr;
        if (random_order == nil) then
            warn("orders["..r.."].nr is nil.");
            return;
        end;

        local accepted = cgd_fun_accept_order(tostring(random_order));

        if (accepted) then
            if (cgd.verbose) then
                log("Accepted order "..random_order..".");
            end;

            local order = cgd_fun_get_order(tostring(random_order), '1');
            if (order == nil) then
                log("Failed to download order "..random_order..".");
                return;
            else
                if (cgd.verbose) then
                    log("Downloaded order "..random_order..".");
                end;
                local order_nr = tostring(order.nr);
                if (order_nr == nil) then
                    order_nr = "nil";
                end;
                if (tostring(random_order) ~= order_nr) then
                    warn("Next order is supposed to be "..tostring(random_order).." but downloaded "..(order_nr)..".");
                    return;
                end;

                next_order_nr = random_order;
                next_order    = order;
            end;
        else
            if (cgd.verbose) then
                log("Failed to accept order "..random_order..".");
                return;
            end;
        end;
    end;

    if (next_order_nr == nil) then
        next_order = nil;
        return;
    end;

    local error_message = encoder_check_order(next_order);
    local output = nil;
    local done   = nil;

    if (error_message ~= nil) then
        output = {error = error_message};
        output["version"] = executive.version;
        done   = cgd_fun_set_order(tostring(next_order_nr), output, '1');
        if (cgd.verbose) then
            if (not done) then
                log("Failed to set invalid order "..next_order_nr..".");
            else
                log("Order "..next_order_nr.." is invalid.");
            end;
        end;

        next_order = nil;
        return;
    end;

    encoder_process_order(next_order);

    return;
end;

function encoder_check_order(next_order)
    local error_message = nil;

        if (next_order.input        == nil) then error_message = "Order input is missing.";
    elseif (next_order.input.addr   == nil) then error_message = "Missing field: `addr` (payment receiver).";
    elseif (next_order.input.amount == nil) then error_message = "Missing field: `amount` (payment amount).";
    elseif (next_order.input.chunks == nil) then error_message = "Missing field: `chunks` (order details)."; end;

    if (error_message == nil) then
        local amt = next_order.input.amount;
        if (type(amt) ~= "number"
        or  math.floor(amt) ~= amt) then
            error_message = "Invalid field: `amount` (must be an integer number).";
        end;

        if (type(amt) == "number" and (amt/global.SPB) < executive.MIN_BTC_OUTPUT) then
            local min_amt = executive.MIN_BTC_OUTPUT*global.SPB;
            error_message = "Invalid field: `amount` (cannot be less than "..min_amt..
                            " satoshi"..get_plural(min_amt)..").";
        end;
    end;

    if (error_message == nil) then
        if (type(next_order.input.addr) ~= "string"
        or  string.len(next_order.input.addr) > 34
        or  is_bitcoin_addr(next_order.input.addr) ~= true) then
            error_message = "Invalid field: `addr` (must be a valid bitcoin address).";
        end;
    end;

    if (error_message == nil) then
        if (type(next_order.input.chunks) ~= "table") then
            error_message = "Invalid field: `chunks` (must be an array of bitcoin addresses).";
        elseif (table_length(next_order.input.chunks) > 5120) then
            error_message = "Invalid field: `chunks` (cannot contain more than 5120 addresses).";
        else
            local outs = {};
            local nr = 0;
            for i,j in pairs(next_order.input.chunks) do
                nr = nr + 1;

                if (type(j) ~= "string"
                or  string.len(j) > 34
                or  is_bitcoin_addr(j) ~= true) then
                    error_message = "Invalid field: `chunks` ("..nr..". address is invalid).";
                    break;
                end;

                --if (outs[j] ~= nil) then
                --    error_message = "Invalid field: `chunks` ("..nr..". address is duplicate).";
                --    break;
                --end;

                --if (next_order.input.addr == j) then
                --    error_message = "Invalid field: `chunks` (must not contain "..j..").";
                --    break;
                --end;

                --for k,v in pairs(executive.profits) do
                --    if (j == k) then
                --        error_message = "Invalid field: `chunks` (must not contain "..j..").";
                --        break;
                --    end;
                --end;

                outs[j] = true;
            end;
        end;
    end;

    --[[
    if (error_message == nil and next_order.input.notify ~= nil) then
        if (type(next_order.input.notify) ~= "table") then
            error_message = "Invalid field: `notify` (must be a dictionary).";
        else
            local mobile_nr = next_order.input.notify.mobile_nr;
            local test_nr   = string.match(mobile_nr, '%d+');
            local test_nr   = "+"..test_nr;
            if (mobile_nr == nil or mobile_nr ~= test_nr) then
                error_message = "Invalid field: `notify.mobile_nr` (must contain a plus sign, country code a number without spaces).";
            end;
        end;
    end;
    --]]

    return error_message;
end;

function encoder_process_order(order)
    local rnd           = nil;
    local bonus         = nil;
    local bonus_addr    = nil;
    local payments      = {};
    local chunk_count   = table_length(order.input.chunks);

    local taxable_tx_size = chunk_count*34;
    local taxable_tx_cost = chunk_count*executive.MIN_BTC_OUTPUT + math.ceil(taxable_tx_size/1000)*executive.FEE_PER_KB;
    local tax_total       = 0.0;

    payments[order.input.addr] = order.input.amount / global.SPB;
    for k,v in pairs(executive.profits) do
        if (payments[k] == nil) then
            payments[k] = 0.0;
        end;

        local tax = math.max(v*taxable_tx_cost, executive.MIN_BTC_OUTPUT);
        tax = tax * global.SPB;
        tax = math.ceil(tax);
        tax = tax / global.SPB;
        -- In case payee is also a profit receiver, merge the amounts.
        payments[k] = payments[k] + tax;
        if (bonus_addr == nil) then
            -- The ticket identifier (rnd) should be used up on some profit address.
            bonus_addr = k;
        end;

        tax_total = tax_total + payments[k];
    end;

    local inputs  = 1;
    local outputs = chunk_count + table_length(payments);
    local tx_size = inputs*181 + outputs*34 + 10;
    local tx_fee  = math.ceil(tx_size/1000) * executive.FEE_PER_KB;
    local charge  = 0.0;

    charge = charge + tx_fee;
    charge = charge + executive.MIN_BTC_OUTPUT*chunk_count;
    for k,v in pairs(payments) do
        charge = charge + v;
    end;

    local ticket = nil;
    local ticket_key = nil;
    for i=1, 1000 do
        rnd   = math.random(0,9999);
        bonus = rnd / global.SPB;
        ticket, ticket_key = encoder_generate_ticket(charge + bonus);
        if (ticket ~= nil) then
            if (bonus_addr ~= nil) then
                payments[bonus_addr] = payments[bonus_addr] + bonus;
            end;
            ticket["order_nr"]     = order.nr;
            ticket['payee_addr']   = order.input.addr;
            ticket['order_chunks'] = order.input.chunks;
            ticket['order_amount'] = (order.input.amount / global.SPB);
            ticket['payments']     = payments;
            break;
        end;
    end;

    if (ticket == nil or ticket_key == nil) then
        warn("All tickets sold out! Cannot take any more orders. Increase the address pool!");

        local output = {error = "All payment tickets have been sold out, please try again later."};
        output["version"] = executive.version;
        local done = cgd_fun_set_order(order.nr, output, "1");

        if (not done) then
            warn("Failed to set order "..order.nr..".");
        elseif (cgd.verbose) then
            log("Answered to order "..order.nr..".");
        end;
        log("Discarded order "..order.nr..".");
        return;
    end;

    if (cgd.verbose) then
        log("Processed order "..order.nr..".");
    end;

    executive.tickets[ticket_key] = ticket;

    if (cgd.verbose) then
        local chunks        = table_length(order.input.chunks);
        local order_amount  = string.format("%.8f", (order.input.amount / global.SPB) );
        local extra_outputs = (chunks > 0 and ("+"..chunks.." output"..get_plural(chunks))) or "none";
        local cost          = string.format("%.8f", ticket.charge );
        local tx_fee_str    = string.format("%.8f", tx_fee );
        local tx_tax_str    = string.format("%.8f", tax_total );

        local order_details = "";
        order_details = order_details .. (" Pay To : "..ticket.payee_addr .."\n");
        order_details = order_details .. (" Amount : "..order_amount      .." BTC\n");
        order_details = order_details .. (" Extras : "..extra_outputs     .."\n");
        order_details = order_details .. (" Ticket : "..ticket.addr       .."\n");
        order_details = order_details .. (" TX Fee : "..tx_fee_str        .." BTC\n");
        order_details = order_details .. (" TX Tax : "..tx_tax_str        .." BTC\n");
        order_details = order_details .. (" Charge : "..cost              .." BTC\n");
        order_details = order_details .. (" Random : "..rnd               .."");

        log("Dumping order "..order.nr..".\n"..order_details);
    end;

    return;
end;

function encoder_fill_orders()
    for k,v in pairs(executive.tickets) do
        if (v.conf >= executive.min_conf and v.filled == false and v.active and v.payment ~= nil) then
            v.error = "Unable to fill the order due to internal error.";

            local outputs = {};
            local inputs  = {};

            for i=1, #v.order_chunks do
                table.insert(outputs, { [v.order_chunks[i]] = executive.MIN_BTC_OUTPUT } );
            end;

            for i,j in pairs(v.payments) do
                table.insert(outputs, { [i] = j });
            end;

            table.insert(inputs, {txid = v.payment.txid, vout = v.payment.vout});

            local tx = nil;--bitcoin_fun_send_many(bitcoin.wallet_account, outputs, executive.min_conf, "Order "..v.order_nr);

            local raw_tx   = bitcoin_fun_create_raw_transaction(inputs, outputs);
            local unlocked = true;
            if (bitcoin.wallet_passphrase ~= nil) then
                unlocked = bitcoin_fun_wallet_passphrase(bitcoin.wallet_passphrase, 30);
            end

            if (unlocked == true) then
                if (raw_tx ~= nil) then
                    local signed_tx = bitcoin_fun_sign_raw_transaction(raw_tx);

                    if (signed_tx ~= nil and signed_tx.complete == true and signed_tx.hex ~= nil) then
                        tx = bitcoin_fun_send_raw_transaction(signed_tx.hex, true);
                    end;
                end;

                if (tx == nil) then
                    if (v.ttl > 0) then v.ttl = v.ttl - 1; end;
                    warn("Failed to make a TX to fill order "..v.order_nr..". (TTL: "..v.ttl..")");
                else
                    v.filled = true;
                    v.upload = true;
                    v.error  = nil;
                    v.proof  = tx;
                    if (cgd.verbose) then
                        log("Filled order "..v.order_nr..".");
                    end;
                end;
            else
                warn("Failed to unlock wallet.");
            end;
            break;
        end;
    end;

    return;
end;

function encoder_upload_orders()
    local output = nil;
    local done   = nil;

    --local discard = {};

    for k,v in pairs(executive.tickets) do
        if (v.upload and v.active) then
            output = { amount        = string.format("%.8f", v.charge),
                       address       = v.addr,
                       transactions  = v.txs,
                       confirmations = v.conf };

            if (v.error ~= nil) then
                output["error"] = v.error;
            end;

            if (v.proof ~= nil) then
                output["proof"] = v.proof;
            end;

            if (not v.filled) then
                if (v.conf < executive.min_conf or v.payment == nil) then
                    if (table_length(v.txs) == 0) then
                        output["msg"] = "Please send exactly "..output.amount.." bitcoins to "..output.address..".";
                    else
                        local needed = executive.min_conf - v.conf;
                        output["msg"] = "Payment received, waiting for "..(needed).." confirmation"..get_plural(needed)..".";
                    end;
                else
                    output["msg"] = "Your payment has been confirmed. Your order should be filled soon.";
                end;
            else
                output["msg"] = "Your order has been filled.";
            end;

            output["version"] = executive.version;
            done = cgd_fun_set_order(v.order_nr, output, v.filled and "1" or "0");

            if (not done) then
                if (v.ttl > 0) then v.ttl = v.ttl - 1; end;
                --v.ttl = v.ttl - 1;
                warn("Failed to set order "..v.order_nr..". (TTL: "..v.ttl..")");
                --if (v.ttl <= 0) then
                --    table.insert(discard, k);
                --    log("Discarding order "..v.order_nr..".");
                --end;
            else
                if (cgd.verbose) then
                    log("Uploaded new output for order "..v.order_nr..".");
                end;
                v.upload = false;

                if (v.filled) then
                    v.active = false;
                end;
            end;

            break;
        end;
    end;

    --local deleted = 0;
    --for i=1, #discard do
    --    if (executive.tickets[discard[i]] ~= nil) then
    --        executive.tickets[discard[i]] = nil;
    --        deleted = deleted + 1;
    --    end;
    --end;
    --discard = {};
    --
    --if (cgd.verbose and deleted > 0) then
    --    log("Discarded "..deleted.." order"..(deleted == 1 and "." or "s."));
    --end;

    return;
end;

function encoder_generate_ticket(charge)
    for i=1, #bitcoin.wallet_addresses do
        local addr = bitcoin.wallet_addresses[i];
        local key  = string.format("%.8f", charge)..":"..addr;
        if (executive.tickets[key] == nil) then
            local ticket = { addr   = addr,  -- Encoder's receiving address.
                             charge = charge,-- Require this many bitcoins.
                             conf   = 0,     -- Greatest number of confirmations.
                             txs    = {},    -- Transactions and their confirmations.
                             vouts  = {},    -- Transactions and their vouts.
                             payment= nil,   -- TX details that paid for this ticket.
                             upload = true,  -- When true, upload order's output.
                             ttl    = 100,   -- Time To Live. When 0, discard order.
                             filled = false, -- True when order is filled.
                             active = true,  -- False when order can be deleted.
                             error  = nil,   -- Possible error message.
                             proof  = nil    -- TX hash proving that order is filled.
                           };

            return ticket, key;
        end;
    end;
    return nil, nil;
end;

function encoder_find_ticket(addr, amount)
    local key = string.format("%.8f", amount)..":"..addr;

    if (executive.tickets[key] ~= nil) then
        return executive.tickets[key], key;
    end;

    return nil, nil;
end;

function cgd_step_archive()
    if (not archive.enabled) then
        return;
    end;

    local sent = {};

    for i,j in pairs(archive.news) do
        for k,v in pairs(archive.users) do
            if (#v.news > 0 or sent[k] ~= nil) then
                table.insert(v.news, i);
            else
                sent[k] = "\027[0;32mTX \027[1;32m"..i.."\027[0;32m:\027[0m\n\r"..j.."\027[0m\n\r";
            end;
        end;

        archive.olds[i] = j;
        archive.news[i] = nil;
    end;

    for k,v in pairs(archive.users) do
        if (sent[k] == nil and v.auto and #v.news > 0) then
            do_read(k, "");
            send_prompt(k);
        end;
    end;

    for k,v in pairs(sent) do
        send_message(k, v);
    end;

    -- Do not keep more than 10 messages in memory:
    local removed = 0;
    while (#archive.order > 10) do
        for k,v in pairs(archive.users) do
            for i=1, #v.news do
                if (v.news[i] == archive.order[1]) then
                    table.remove(v.news, i);
                    break;
                end;
            end;
        end;

        archive.news[archive.order[1]] = nil;
        archive.olds[archive.order[1]] = nil;
        table.remove(archive.order, 1);

        removed = removed + 1;
    end;

    if (removed > 0 and cgd.verbose) then
        log("Purged "..removed.." archived message"..get_plural(removed)..".");
    end;
end;

function cgd_fun_handshake()
    local json = JSON:encode({});

    local response = url_request(cgd.database.url, nil, { fun  = "handshake", data = json, sec_key = cgd.ALS.sec_key });

    if (response == nil) then
        log("ALS handshake failed.");
        return nil;
    end;

    local t = cgd_decode_response(response);
    if (t == nil) then
        log("ALS handshake failed.");
        log("Invalid JSON object received!");
        warn(response);
    else
        if (t.error ~= nil) then
            warn(serializeTable(t.error));
        end;
        return t;
    end;

    return nil;
end;

function cgd_fun_init(restore)
    local json = JSON:encode({guid = cgd.session.guid, restore = ( (restore and '1') or '0')});
    log("Initializing session.");

    local response = cgd_url_request("init", json);
    if (response == nil) then return false; end;

    if (response.result ~= "SUCCESS" or restore) then
        if (response.seed) then
            cgd.ALS.seed = response.seed;
            log("SEED:  "..(cgd.ALS.seed or "nil"));
        end;
        if (response.nonce and cgd.ALS.seed) then
            cgd.ALS.nonce = hash_SHA256(response.nonce..cgd.ALS.seed, true);
            cgd.session.TLS = response.TLS;
            cgd.session.ALS = response.ALS;
            log("Session restored."..( (cgd.session.ALS and " ALS enabled.") or " ALS disabled." )
                                   ..( (cgd.session.TLS and " TLS enabled.") or " TLS disabled." ) );
            return true;
        end;
        return false;
    end;

    cgd.session.TLS = response.TLS;
    cgd.session.ALS = response.ALS;
    cgd.ALS.nonce   = response.nonce;
    cgd.ALS.seed    = response.seed;

    if (cgd.ALS.nonce and cgd.ALS.seed) then
        log("SEED:  "..(cgd.ALS.seed or "nil"));
        cgd.ALS.nonce = hash_SHA256(cgd.ALS.nonce..cgd.ALS.seed, true);
    end;

    if (cgd.session.TLS == nil
    or  cgd.session.ALS == nil) then
        warn("TLS or ALS not sent by the server.");
    end;

    return true;
end;

function cgd_fun_get_constants()
    local json = JSON:encode({guid = cgd.session.guid, nonce = cgd.ALS.nonce});
    local response = cgd_url_request("get_constants", json);
    if (response == nil) then return false; end;

    cgd.constants = response.constants;
    if (cgd.constants == nil) then
        warn("Could not fetch the server constants.");
        return false;
    end

    log("Server Constants:\n"..serializeTable(cgd.constants));

    return true;
end;

function cgd_fun_get_session()
    local json = JSON:encode({guid = cgd.session.guid, nonce = cgd.ALS.nonce});
    local response = cgd_url_request("get_session", json);
    if (response == nil
    or  response.session == nil) then return false; end;

    cgd.session.data = response.session;
    return true;
end;

function cgd_fun_get_log(first_log, limit)
    local json = JSON:encode({guid = cgd.session.guid, nr = first_log, count = limit, nonce = cgd.ALS.nonce});
    local response = cgd_url_request("get_log", json);
    if (response == nil
    or  response.log == nil) then return nil; end;

    return response.log;
end;

function cgd_fun_get_orders(group_nr, first_order, limit, back, accepted, filled, executive)
    local json = JSON:encode({ guid      = cgd.session.guid,
                               group     = group_nr,
                               nr        = first_order,
                               count     = limit,
                               back      = back,
                               accepted  = accepted,
                               filled    = filled,
                               executive = executive,
                               nonce     = cgd.ALS.nonce
                            });
    local response = cgd_url_request("get_orders", json);
    if (response == nil
    or  response.orders == nil) then return nil; end;

    return response.orders;
end;

function cgd_fun_get_order(order_nr, inclusive)
    local json = JSON:encode({ guid      = cgd.session.guid,
                               nr        = order_nr,
                               inclusive = inclusive,
                               nonce     = cgd.ALS.nonce
                            });
    local response = cgd_url_request("get_order", json);
    if (response == nil
    or  response.order == nil) then return nil; end;

    return response.order;
end;

function cgd_fun_accept_order(order_nr)
    local json = JSON:encode({ guid      = cgd.session.guid,
                               nr        = order_nr,
                               nonce     = cgd.ALS.nonce
                            });
    local response = cgd_url_request("accept_order", json);

    if (response == nil) then return false; end;
    if (response.result ~= "SUCCESS") then
        return false;
    end;

    return true;
end;

function cgd_fun_set_order(order_nr, output, filled)
    local json = JSON:encode({ guid      = cgd.session.guid,
                               nr        = order_nr,
                               output    = output,
                               filled    = filled,
                               nonce     = cgd.ALS.nonce
                            });

    local response = cgd_url_request("set_order", json);

    if (response == nil) then return false; end;
    if (response.result ~= "SUCCESS") then
        if (response.error.code == "ERROR_NO_CHANGE") then
            return true;
        end;
        return false;
    end;

    return true;
end;

function cgd_fun_set_stat(name, value)
    local json = JSON:encode({ guid      = cgd.session.guid,
                               name      = name,
                               value     = value,
                               nonce     = cgd.ALS.nonce
                            });

    local response = cgd_url_request("set_stat", json);

    if (response == nil) then return false; end;
    if (response.result ~= "SUCCESS") then
        if (response.error.code == "ERROR_NO_CHANGE") then
            return true;
        end;
        return false;
    end;

    return true;
end;

function cgd_fun_set_btc_txs(upload)
    local json = JSON:encode({guid = cgd.session.guid, txs = upload, nonce = cgd.ALS.nonce});
    local curl_timeout_before = get_curl_timeout();
    local response = nil;

    set_curl_timeout(60);
    response = cgd_url_request("set_btc_txs", json);
    set_curl_timeout(curl_timeout_before);

    if (response == nil) then return false; end;

    if (response.result ~= "SUCCESS") then
        return false;
    end;

    return true;
end;

function cgd_fun_send_mail(to, subj, msg, headers)
    local json = JSON:encode({ guid    = cgd.session.guid,
                               to      = to,
                               subj    = subj,
                               msg     = msg,
                               headers = headers,
                               nonce   = cgd.ALS.nonce });
    local response = cgd_url_request("send_mail", json);

    if (response == nil) then return false; end;

    if (response.result ~= "SUCCESS") then
        return false;
    end;

    return true;
end;

function txt4coin_create(number, sender, message)
    -- THIS FUNCTION IS NOT NEEDED ANY MORE BECAUSE TXT4COIN IS NOT RELIABLE.
    local t = {
        message          = message,
        sender           = sender,
        recipient_number = number
    };

    response = url_request("http://www.txt4coins.net/api/create/json/", nil, t);
    warn(response);

    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t                        ~= nil and type(t)                        == "table"
        and t.resultcode             ~= nil and type(t.resultcode)             == "number"
        and t.resultmessage          ~= nil and type(t.resultmessage)          == "string"
        and t.txtmessage             ~= nil and type(t.txtmessage)             == "table"
        and t.txtmessage.btc_address ~= nil and type(t.txtmessage.btc_address) == "string"
        and t.txtmessage.btc_price   ~= nil and type(tonumber(t.txtmessage.btc_price)) == "number") then
            if (t.resultcode ~= 200) then
                log("txt4coin create: "..t.resultmessage);
            else
                return t;
            end;
        else
            warn("Invalid response from txt4coins.net:\n"..response);
        end;
    end;

    return nil;
end;

function bitcoin_fun_get_balance()
    local tt = {
        jsonrpc = "2.0",
        method  = "getinfo",
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin getinfo: "..t.error.message);
                return nil;
            end;
            return t["result"].balance;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_estimate_fee(nblocks)
    local tt = {
        jsonrpc = "2.0",
        method  = "estimatefee",
        params  = {nblocks},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin estimatefee: "..t.error.message);
            end;
            return tonumber(t.result);
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_get_addresses_by_account(account)
    local tt = {
        jsonrpc = "2.0",
        method  = "getaddressesbyaccount",
        params  = {account},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin getaddressesbyaccount: "..t.error.message);
            end;
            return t["result"];
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_wallet_passphrase(pass, timeout)
    local tt = {
        jsonrpc = "2.0",
        method  = "walletpassphrase",
        params  = {pass, timeout},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin walletpassphrase: "..t.error.message);
                return false;
            end;
            return true;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_wallet_lock()
    local tt = {
        jsonrpc = "2.0",
        method  = "walletlock",
        params  = {},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin walletlock: "..t.error.message);
                return false;
            end;
            return true;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_send_to_address(addr, amount, comment)
    local tt = {
        jsonrpc = "2.0",
        method  = "sendtoaddress",
        params  = {addr, amount, comment},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin sendtoaddress: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_send_many(fromaccount, addresses, minconf, comment)
    -- Because Lua dictionaries cannot have a predefined order we must
    -- construct this request manually.
    local addresslist = "{";
    local k, v;

    for i=1, #addresses do
        k, v = next(addresses[i], nil);
        addresslist = addresslist..'"'..k..'": '..v;
        if (i < #addresses) then
            addresslist = addresslist .. ", ";
        end;
    end;
    addresslist = addresslist .. "}";

    local request = '{\n'..
                    '      "id": 1,          \n'..
                    ' "jsonrpc": "2.0",      \n'..
                    '  "method": "sendmany", \n'..
                    '  "params": [ "'..fromaccount..'", '..addresslist..', '..minconf..', "'..comment..'" ]\n'..
                    '}';

    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", request, bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin sendmany: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: sendmany");
    end;
    return nil;
end;

function bitcoin_fun_create_raw_transaction(inputs, outputs)
    -- Because Lua dictionaries cannot have a predefined order we must
    -- construct this request manually.
    local outputlist = "{";
    local k, v;

    local mapping = {};
    local order   = {};
    local index;
    local index_hex;
    local hex;
    local salt = "MPGdJA7KX9TwBB7i";
    local addr_type = "1";

    for i=1, #outputs do
        k, v = next(outputs[i], nil);
        addr_type = string.sub(k, 1, 1);

        index_hex = hash_SHA256(i..salt, false);
        index_hex = string.sub(index_hex, 1, 40);
        index     = bitcoin_hex_to_addr(index_hex, addr_type);
        hex       = bitcoin_addr_to_hex(k);
        mapping[index_hex] = hex;
        table.insert(order, index_hex);

        --log("mapping["..index_hex.."] = "..hex);
        outputlist = outputlist..'"'..index..'": '..v;
        if (i < #outputs) then
            outputlist = outputlist .. ", ";
        end;
    end;
    outputlist = outputlist .. "}";

    local inputlist = JSON:encode(inputs);

    local request = '{\n'..
                    '      "id": 1,          \n'..
                    ' "jsonrpc": "2.0",      \n'..
                    '  "method": "createrawtransaction", \n'..
                    '  "params": [ '..inputlist..', '..outputlist..' ]\n'..
                    '}';
    --warn(request);
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", request, bitcoin.curl_timeout);
    --warn(response);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin createrawtransaction: "..t.error.message);
                notify_admin("createrawtransaction", t.error.message);
            else
                local k,v;
                local s = 1;
                local e;
                local bad = nil;
                -- Replace indexes with real output hex representations that may
                -- contain duplicates.
                for i=1, #order do
                    k = order[i];
                    v = mapping[k];

                    s, e = string.find(t.result, k, s, true);
                    if (s ~= nil and e ~= nil) then
                        t.result = t.result:sub(1, s-1) .. v .. t.result:sub(e+1);
                        s = e + 1;
                    else
                        bad = k;
                    end;
                end;
                --warn(t.result);

                if (bad ~= nil) then
                    local msg = "Index hex "..bad.." not found from raw transaction.";
                    warn(msg);
                    notify_admin("createrawtransaction", msg);
                    return nil;
                end;
            end;
            return t.result;
        end;
    else
        local msg = "Bitcoin RPC failed on cURL post: createrawtransaction";
        warn(msg);
        notify_admin("createrawtransaction", msg);
    end;

    notify_admin("createrawtransaction", "Failed to create a raw transaction, returning nil.");
    return nil;
end;

function bitcoin_fun_sign_raw_transaction(hex)
    local tt = {
        jsonrpc = "2.0",
        method  = "signrawtransaction",
        params  = {hex},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    --warn(response);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin signrawtransaction: "..t.error.message);
                notify_admin("signrawtransaction", t.error.message);
            end;
            return t.result;
        end;
    else
        local msg = "Bitcoin RPC failed on cURL post: "..tt.method;
        warn(msg);
        notify_admin("signrawtransaction", msg);
    end;

    notify_admin("signrawtransaction", "Failed to sign a raw transaction, returning nil.");
    return nil;
end;

function bitcoin_fun_list_transactions(account, count, from)
    local tt = {
        jsonrpc = "2.0",
        method  = "listtransactions",
        params  = {account, count, from},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin listtransactions: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_list_unspent(min_conf, max_conf, addresses)
    local tt = {
        jsonrpc = "2.0",
        method  = "listunspent",
        params  = {min_conf, max_conf, addresses},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin listunspent: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_get_transaction(txid)
    local tt = {
        jsonrpc = "2.0",
        method  = "gettransaction",
        params  = {txid},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin gettransaction: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_get_block_count()
    local tt = {
        jsonrpc = "2.0",
        method  = "getblockcount",
        params  = {},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin getblockcount: "..t.error.message);
            end;
            return tonumber(t.result);
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_get_block_hash(nr)
    local tt = {
        jsonrpc = "2.0",
        method  = "getblockhash",
        params  = {nr},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin getblockhash: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_get_block(hash)
    local tt = {
        jsonrpc = "2.0",
        method  = "getblock",
        params  = {hash},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin getblock: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_get_raw_mempool()
    local tt = {
        jsonrpc = "2.0",
        method  = "getrawmempool",
        params  = {},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin getrawmempool: "..t.error.message);
                --warn(serializeTable(t));
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_get_raw_transaction(tx, decoded)
    -- Returns false when TX was not found.
    -- Returns nil when request failed or response is invalid.
    -- Returns TX data on success.
    local tt = {
        jsonrpc = "2.0",
        method  = "getrawtransaction",
        params  = {tx,decoded},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and t.error.code == -5) then
                return false;
            end;
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                if (cgd.verbose) then
                    log("Bitcoin getrawtransaction: "..t.error.message);
                end
                --warn(serializeTable(t));
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

function bitcoin_fun_send_raw_transaction(hex, high_fees)
    local tt = {
        jsonrpc = "2.0",
        method  = "sendrawtransaction",
        params  = {hex, high_fees},
        id      = 1
    };
    response = url_post("http://"..bitcoin.rpc_user..":"
                                 ..bitcoin.rpc_password.."@"
                                 ..bitcoin.rpc_ip..":"
                                 ..bitcoin.rpc_port.."/", JSON:encode(tt), bitcoin.curl_timeout);

    --warn(response);
    if (response ~= nil) then
        local t = JSON:decode(response);
        if (t ~= nil and type(t) == "table") then
            if (type(t.error) == "table" and type(t.error.message) == "string" ) then
                log("Bitcoin sendrawtransaction: "..t.error.message);
            end;
            return t.result;
        end;
    else
        warn("Bitcoin RPC failed on cURL post: "..tt.method);
    end;
    return nil;
end;

