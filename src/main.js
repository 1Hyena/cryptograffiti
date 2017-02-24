var CG_MAIN_CSS    = null;
var CG_LANGUAGE    = "en";
var CG_CONSTANTS   = null;
var CG_STATUS      = [];
var CG_LAST_STATUS = "";
var CG_ONLINE      = null;
var CG_HOLD_STATUS = 0;
var CG_HOLD_DELAY  = false;
var CG_TX_NR       = null;
var CG_SCROLL_KEY  = false;
var CG_VERSION     = "0.86";
var CG_ACTIVE_TAB  = null;
var CG_DECODER_OK  = true; // Decoder is online?
var CG_ENCODER_OK  = true; // Encoder is online?

function cg_start(main_css) {
    CG_MAIN_CSS = main_css;
    if (window.attachEvent) {
        window.attachEvent('onload', cg_main);
    } else {
        if (window.onload) {
            var curronload = window.onload;
            var newonload = function() {
                curronload();
                cg_main();
            };
            window.onload = newonload;
        } else {
            window.onload = cg_main;
        }
    }
}

function cg_main() {
    var cg = document.getElementById("cg-main");
    if (cg == null) {
        alert(CG_TXT_MAIN_ERROR_1[CG_LANGUAGE]);
        return;
    }

    cg_init_sound();

    var lang_given = false;
    var hashes = location.hash.substring(1).split("#");
    for (var i=0, sz=hashes.length; i<sz; ++i) {
        var hash = decodeURIComponent(hashes[i]);
             if (hash === "en") {CG_LANGUAGE = "en"; lang_given = true;}
        else if (hash === "ru") {CG_LANGUAGE = "ru"; lang_given = true;}
        else if (hash === "et") {CG_LANGUAGE = "et"; lang_given = true;}
        else if (isNormalInteger(hash)) CG_TX_NR = hash;
        else if (Bitcoin.testAddress(hash)) CG_READ_FILTER_ADDR = hash;
        else if (hash.indexOf(":") > -1) {
            var parts = hash.split(":");
            if (parts.length === 2 && parts[0] === "censor") {
                var censor_txs = {};
                var txs = parts[1].split(",");
                for (var j=0, txsz=txs.length; j<txsz; ++j) {
                    if (txs[j].length === 64 && isHex(txs[j])) {
                        censor_txs[txs[j].toLowerCase()] = true;
                    }
                }
                if (Object.keys(censor_txs).length > 0) CG_READ_CENSOR_TXS = censor_txs;
            }
            else if (parts.length === 2 && parts[0] === "write") {
                CG_WRITE_TEXT = parts[1];
            }
            else if (parts.length === 2 && parts[1].indexOf(".") > -1 && Bitcoin.testAddress(parts[0])) {
                var nums = parts[1].split(".");
                if (nums.length == 2 && isNumeric(nums[0]) && isNumeric(nums[1])) {
                    var amount = nums[0]+"."+nums[1].substring(0,8);
                    if (cg_write_check_amount(amount) === "") {
                        CG_WRITE_PAY_TO     = parts[0];
                        CG_WRITE_PAY_AMOUNT = Math.floor(parseFloat(amount)*100000000)/100000000;
                    }
                }
            }
        }
        else if (hash.length > 0) {
            // Filter TXs only containing an address that is a hash of this argument.
            var ripemd160 = CryptoJS.algo.RIPEMD160.create();
            ripemd160.update(hash);
            var filter = Bitcoin.createAddressFromText(hex2ascii(ripemd160.finalize()));
            CG_READ_FILTER_ADDR = filter;
            CG_READ_FILTER_KEY  = hash;
        }
    }

    if (!lang_given) {
        var lang = navigator.languages ? navigator.languages[0] : (navigator.language || navigator.userLanguage);
        lang = lang || (window.navigator.languages ? window.navigator.languages[0] : null);
        lang = lang || (window.navigator.language || window.navigator.browserLanguage || window.navigator.userLanguage);
        if (lang.indexOf('-') !== -1) lang = lang.split('-')[0];
        if (lang.indexOf('_') !== -1) lang = lang.split('_')[0];
        lang = lang.toUpperCase();
             if (lang === "ET") CG_LANGUAGE = "et";
        else if (lang === "RU") CG_LANGUAGE = "ru";
        else                    CG_LANGUAGE = "en";
    }
    document.title = CG_TXT_MAIN_TITLE[CG_LANGUAGE];

    var credits = document.getElementById("cg-credits");
    if (credits == null) {
        alert(CG_TXT_MAIN_ERROR_3[CG_LANGUAGE]);
        return;
    }
    while (credits.hasChildNodes()) {
        credits.removeChild(credits.lastChild);
    }
    credits.appendChild(document.createTextNode(CG_TXT_MAIN_CREDITS[CG_LANGUAGE]));

    while (cg.hasChildNodes()) {
        cg.removeChild(cg.lastChild);
    }

    if (CG_MAIN_CSS !== null) {
        cg_loadcss(CG_MAIN_CSS);
        setTimeout(function(){
            cg.className = cg.className + " cg-main";
            cg.className = cg.className + " cg-borderbox";
            cg_construct(cg);
        }, 1000);
    }
    else {
        cg.className = cg.className + " cg-main";
        cg.className = cg.className + " cg-borderbox";    
        cg_construct(cg);
    }

    document.onkeydown = cg_check_key;

    cg_main_loop();
}

function cg_main_loop() {
    CG_SCROLL_KEY  = false;

    var spacer = document.getElementById("cg-tabs-spacer");
    var tabs   = document.getElementById("cg-tabs");

    if (spacer !== null && tabs !== null) {
        if (tabs.offsetTop >= 8) {
            if (spacer.classList.contains('cg-spacer-poofin')) {
                spacer.classList.remove('cg-spacer-poofin');
                spacer.classList.add('cg-spacer-poofout');
            }
        }
        else {
            if (spacer.classList.contains('cg-spacer-poofout')) {
                spacer.classList.remove('cg-spacer-poofout');
                spacer.classList.add('cg-spacer-poofin');
            }
        }
    }

    var tab_write = document.getElementById("cg-tab-write");
    if (tab_write && !tab_write.classList.contains("cg-inactive-tab")) {
        cg_write_update(false);
    }

    var tab_captcha = document.getElementById("cg-tab-captcha");
    if (tab_captcha && !tab_captcha.classList.contains("cg-inactive-tab")) {
        cg_captcha_update();
    }

    var tab_save = document.getElementById("cg-tab-save");
    if (tab_save && !tab_save.classList.contains("cg-inactive-tab")) {
        cg_save_update();
    }

    cg_save_pulse();

    setTimeout(function(){
        cg_main_loop();
    }, 1000);
}

function cg_check_key(e) {
    e = e || window.event;

    if (e.keyCode == '38') {
        // up arrow
        CG_SCROLL_KEY = true;
    }
    else if (e.keyCode == '40') {
        // down arrow
        CG_SCROLL_KEY = true;
    }
    else if (e.keyCode == '37') {
       // left arrow
    }
    else if (e.keyCode == '39') {
       // right arrow
    }
}

function cg_construct(cg) {
    var text = document.createTextNode(CG_TXT_MAIN_PLEASE_WAIT[CG_LANGUAGE]);
    
    while (cg.hasChildNodes()) {
        cg.removeChild(cg.lastChild);
    }

    var table = document.createElement("div");
    table.style.width="100%";
    table.style.height="100%";
    table.style.display="table";
    var cell = document.createElement("div");
    cell.style.display="table-cell";
    cell.style.verticalAlign="middle";
    var wrapper = document.createElement("div");
    wrapper.style.marginLeft="auto";
    wrapper.style.marginRight="auto";

    wrapper.appendChild(text);
    cell.appendChild(wrapper);
    table.appendChild(cell);

    cg.appendChild(table);

    setTimeout(function(){
        cg_construct_header();
    }, 100);
    
    setTimeout(function(){
        cg_construct_footer();
    }, 500);
}

function cg_construct_footer() {
    var footer = document.getElementById("cg-footer");
    if (footer == null) {
        alert(CG_TXT_MAIN_ERROR_2[CG_LANGUAGE]);
        return;
    }

    var credits = document.getElementById("cg-credits");
    if (credits == null) {
        alert(CG_TXT_MAIN_ERROR_3[CG_LANGUAGE]);
        return;
    }
    
    credits.className = credits.className + " cg-disappear";

    setTimeout(function(){
        while (footer.hasChildNodes()) {
            footer.removeChild(footer.lastChild);
        }
        var status = document.createElement("DIV");
        footer.appendChild(status);
        cg_refresh_status(status);
        cg_load_constants();

        var languages = document.createElement("DIV");
        
        var img_us = document.createElement("img");
        img_us.setAttribute('src', CG_IMG_US);
        img_us.setAttribute('alt', CG_TXT_MAIN_FLAG_OF_US[CG_LANGUAGE]);
        img_us.style.verticalAlign="middle";

        var img_ru = document.createElement("img");
        img_ru.setAttribute('src', CG_IMG_RU);
        img_ru.setAttribute('alt', CG_TXT_MAIN_FLAG_OF_RU[CG_LANGUAGE]);
        img_ru.style.verticalAlign="middle";
        
        var img_ee = document.createElement("img");
        img_ee.setAttribute('src', CG_IMG_EE);
        img_ee.setAttribute('alt', CG_TXT_MAIN_FLAG_OF_EE[CG_LANGUAGE]);
        img_ee.style.verticalAlign="middle";

        var options="";
        if (CG_READ_FILTER_KEY !== null) options = "#"+CG_READ_FILTER_KEY;
        if (CG_WRITE_PAY_TO !== null && CG_WRITE_PAY_AMOUNT !== null) options += "#"+CG_WRITE_PAY_TO+":"+CG_WRITE_PAY_AMOUNT;
        if (Object.keys(CG_READ_CENSOR_TXS).length > 0) {
            var keys = [];
            for (var key in CG_READ_CENSOR_TXS) {
                if (CG_READ_CENSOR_TXS.hasOwnProperty(key)) keys.push(key);
            }
            if (keys.length > 0) options += "#censor:"+keys.join();
        }

        var a_en = document.createElement("a"); a_en.appendChild(img_us);
        a_en.title = CG_TXT_MAIN_TRANSLATE_TO_EN[CG_LANGUAGE];
        a_en.href  = "#en"+options;
        a_en.classList.add("hvr-glow");
        a_en.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
        a_en.style.margin="0ch 0.25ch";

        var a_ru = document.createElement("a"); a_ru.appendChild(img_ru);
        a_ru.title = CG_TXT_MAIN_TRANSLATE_TO_RU[CG_LANGUAGE];
        a_ru.href  = "#ru"+options;
        a_ru.classList.add("hvr-glow");        
        a_ru.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
        a_ru.style.margin="0ch 0.25ch";
        
        var a_ee = document.createElement("a"); a_ee.appendChild(img_ee);
        a_ee.title = CG_TXT_MAIN_TRANSLATE_TO_EE[CG_LANGUAGE];
        a_ee.href  = "#et"+options;
        a_ee.classList.add("hvr-glow");        
        a_ee.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
        a_ee.style.margin="0ch 0.25ch";
        
        if (CG_LANGUAGE !== "en") languages.appendChild(a_en);
        if (CG_LANGUAGE !== "ru") languages.appendChild(a_ru);
        if (CG_LANGUAGE !== "et") languages.appendChild(a_ee);                
        
        languages.classList.add("cg-appear");
        languages.classList.add("cg-footer-languages");
        
        footer.appendChild(languages);
    }, 1000);
}

function cg_refresh_status(div) {
    if (!div.hasChildNodes() && !div.classList.contains("cg-status")) {
        div.classList.add("cg-status");
    }

    var status = "";
    if (CG_HOLD_STATUS > 0) {
        status = CG_LAST_STATUS; //CG_STATUS[0];
        CG_HOLD_STATUS--;
        if (CG_HOLD_DELAY && CG_STATUS.length > 0) {
            CG_HOLD_STATUS = 0;
            CG_HOLD_DELAY = false;
        }
    }
    else if (CG_STATUS.length === 0) {
        if (CG_ONLINE === null) status = CG_TXT_MAIN_PLEASE_WAIT[CG_LANGUAGE];
        else                    status = CG_ONLINE;
    }
    else {
        status = CG_STATUS.shift();
        if (CG_STATUS.length === 0){
            CG_HOLD_STATUS = 20;
            CG_HOLD_DELAY  = true;
        }
        else CG_HOLD_STATUS = 0;

        if (status.charAt(0) === '!'
        ||  status.charAt(0) === '_') CG_HOLD_STATUS = 6;
    }

    if (CG_LAST_STATUS !== status) {
        while (div.hasChildNodes()) {
            div.removeChild(div.lastChild);
        }

        var buf = status;
        if (buf.charAt(0) === '!' || buf.charAt(0) === '_') {
            buf = buf.substr(1);
        }

        div.appendChild(document.createTextNode(buf));
        CG_LAST_STATUS = status;
    }

    if (div.classList.contains("cg-status-warning")) div.classList.remove("cg-status-warning");
    else if (status.charAt(0) === '!') div.classList.add("cg-status-warning");

    setTimeout(function(){
        cg_refresh_status(div);
    }, 500);
}

function cg_load_constants() {
    var data_obj = {};
    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    CG_STATUS.push(CG_TXT_MAIN_LOADING_CONSTANTS[CG_LANGUAGE]);
    xmlhttpPost('http://cryptograffiti.info/database/', 'fun=get_constants&data='+json_str,
        function(response) {
            var status = "";

                 if (response === false) status = CG_TXT_MAIN_ERROR[CG_LANGUAGE];
            else if (response === null ) status = CG_TXT_MAIN_TIMEOUT[CG_LANGUAGE];
            else {
                json = JSON.parse(response);
                if ("constants" in json
                &&  "TXS_PER_QUERY" in json.constants) {
                   CG_CONSTANTS = json.constants;
                   status = CG_TXT_MAIN_CONSTANTS_LOADED[CG_LANGUAGE];
                }
                else cg_handle_error(json);
            }

            if (status.length > 0) CG_STATUS.push(status);

            if (CG_CONSTANTS !== null) {
                setTimeout(function(){cg_load_stats();}, 100);
                return;
            }

            setTimeout(function(){cg_load_constants();}, 10000);
        }
    );

    return;
}

function cg_load_stats() {
    var data_obj = {};
    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    CG_STATUS.push(CG_TXT_MAIN_ONLINE[CG_LANGUAGE]+": ...");
    xmlhttpPost('http://cryptograffiti.info/database/', 'fun=get_stats&data='+json_str,
        function(response) {
            var online = "???";

                 if (response === false) online = CG_TXT_MAIN_ERROR[CG_LANGUAGE];
            else if (response === null ) online = CG_TXT_MAIN_TIMEOUT[CG_LANGUAGE];
            else {
                json = JSON.parse(response);
                if ("stats" in json && json.stats.length === 1 
                &&  "sessions" in json.stats[0]
                &&  "IPs" in json.stats[0]
                &&  "decoder" in json.stats[0]
                &&  "encoder" in json.stats[0]) {
                   var units = (json.stats[0].sessions == 1 ? CG_TXT_MAIN_SESSION[CG_LANGUAGE] : CG_TXT_MAIN_SESSIONS[CG_LANGUAGE]);
                   online = json.stats[0].IPs/*+" ("+json.stats[0].sessions+" "+units+")"*/;
                   var decoder_ok = (json.stats[0].decoder !== "0");
                   var encoder_ok = (json.stats[0].encoder !== "0");
                   if (decoder_ok != CG_DECODER_OK) {
                       if (!decoder_ok) CG_STATUS.push("!"+CG_TXT_MAIN_DECODER_APPEARS_OFFLINE[CG_LANGUAGE]);
                       else CG_STATUS.push("_"+CG_TXT_MAIN_DECODER_APPEARS_ONLINE[CG_LANGUAGE]);
                   }
                   if (encoder_ok != CG_ENCODER_OK) {
                       if (!encoder_ok) CG_STATUS.push("!"+CG_TXT_MAIN_ENCODER_APPEARS_OFFLINE[CG_LANGUAGE]);
                       else CG_STATUS.push("_"+CG_TXT_MAIN_ENCODER_APPEARS_ONLINE[CG_LANGUAGE]);
                   }
                   CG_DECODER_OK = decoder_ok;
                   CG_ENCODER_OK = encoder_ok;
                }
                else cg_handle_error(json);
            }

            CG_ONLINE=CG_TXT_MAIN_ONLINE[CG_LANGUAGE]+": "+online;
            CG_STATUS.push(CG_ONLINE);

            setTimeout(function(){
                cg_load_stats();
            }, 60000);
        }
    );
}

function cg_handle_error(obj) {
    if ("error" in obj && "code" in obj.error) {
        if (obj.error.code === "ERROR_ACCESS_DENIED") {
            CG_STATUS.push("!"+CG_TXT_MAIN_ERROR_ACCESS_DENIED[CG_LANGUAGE]);
        }
    }
    return;
}

function cg_construct_header() {
    var header = document.getElementById("cg-header");
    if (header == null) {
        alert(CG_TXT_MAIN_ERROR_4[CG_LANGUAGE]);
        return;
    }

    if (header.hasChildNodes()) {
        var version = document.createElement("span");
        version.appendChild(document.createTextNode("v"+CG_VERSION));
        version.id="cg-version"
        
        header.children[0].appendChild(version);
    }

    var spacer = document.createElement("DIV");
    spacer.id="cg-tabs-spacer";
    spacer.classList.add("cg-spacer-poofin");
    header.appendChild(spacer);

    var tabs = document.createElement("DIV");
    tabs.id="cg-tabs";
    tabs.className = tabs.className + " cg-tabs";

    header.appendChild(tabs);
    
    setTimeout(function(){
        cg_construct_buttons(tabs);
    }, 100);
}

function cg_construct_buttons(tabs) {
    var btn_1 = document.createElement("BUTTON"); btn_1.className = btn_1.className + " cg-btn";
    var btn_2 = document.createElement("BUTTON"); btn_2.className = btn_2.className + " cg-btn";
    var btn_3 = document.createElement("BUTTON"); btn_3.className = btn_3.className + " cg-btn";
    var btn_4 = document.createElement("BUTTON"); btn_4.className = btn_4.className + " cg-btn";
    var btn_5 = document.createElement("BUTTON"); btn_5.className = btn_5.className + " cg-btn";
    
    btn_1.addEventListener("click", cg_button_click_read ); btn_1.disabled = true;
    btn_2.addEventListener("click", cg_button_click_write); btn_2.disabled = true;
    btn_3.addEventListener("click", cg_button_click_tools); btn_3.disabled = true;
    btn_4.addEventListener("click", cg_button_click_help ); btn_4.disabled = true;
    btn_5.addEventListener("click", cg_button_click_about); btn_5.disabled = true;

    var txt_1 = document.createTextNode(CG_TXT_MAIN_BTN_READ [CG_LANGUAGE]);
    var txt_2 = document.createTextNode(CG_TXT_MAIN_BTN_WRITE[CG_LANGUAGE]);
    var txt_3 = document.createTextNode(CG_TXT_MAIN_BTN_TOOLS[CG_LANGUAGE]);
    var txt_4 = document.createTextNode(CG_TXT_MAIN_BTN_HELP [CG_LANGUAGE]);
    var txt_5 = document.createTextNode(CG_TXT_MAIN_BTN_ABOUT[CG_LANGUAGE]);

    btn_1.appendChild(txt_1); btn_1.id = "cg-btn-tab-read";
    btn_2.appendChild(txt_2); btn_2.id = "cg-btn-tab-write";
    btn_3.appendChild(txt_3); btn_3.id = "cg-btn-tab-tools";
    btn_4.appendChild(txt_4); btn_4.id = "cg-btn-tab-help";
    btn_5.appendChild(txt_5); btn_5.id = "cg-btn-tab-about";

    var spawn_delay = 200;
    setTimeout(function(){tabs.appendChild(btn_1);}, 1*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_2);}, 2*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_3);}, 3*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_4);}, 4*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_5);}, 5*spawn_delay);
    setTimeout(function(){
        var cg = document.getElementById("cg-main");
        if (cg == null) {
            alert(CG_TXT_MAIN_ERROR_1[CG_LANGUAGE]);
            return;
        }

        while (cg.hasChildNodes()) {
            cg.removeChild(cg.lastChild);
        }

        if (CG_WRITE_TEXT === null) {
            btn_1.disabled = false;
            btn_1.click();
        }
        else {
            btn_2.disabled = false;
            btn_2.click();
        }
    }, 6*spawn_delay);
}

function cg_button_click(btn, fun) {
    var x = document.getElementsByClassName("cg-btn");
    for (var i = 0; i < x.length; i++) {
        x[i].disabled = false;
    }
    btn.disabled = true;

    var cg = document.getElementById("cg-main");
    if (cg == null) {
        alert(CG_TXT_MAIN_ERROR_1[CG_LANGUAGE]);
        return;
    }

    cg_sfx_rattle();
    if (CG_ACTIVE_TAB !== 'cg-tab-read') {
        cg.classList.remove("cg-poofin");
        cg.classList.add("cg-poofout");
    }
    else {
        cg.classList.remove("cg-appear");
        cg.classList.add("cg-disappear");
    }

    if (fun !== cg_construct_read) {
        setTimeout(function(){
            fun(cg);
            cg.classList.remove("cg-disappear");
            cg.classList.remove("cg-poofout");
            cg.classList.add("cg-poofin");
        }, (CG_ACTIVE_TAB === 'cg-tab-read') ? 500 : 200);
    }
    else {
        setTimeout(function(){
            fun(cg);
            cg.classList.remove("cg-disappear");
            cg.classList.remove("cg-poofout");
            cg.classList.add("cg-appear");
        }, (CG_ACTIVE_TAB === 'cg-tab-read') ? 500 : 200);
    }
}

function cg_init_tab(main, tab_id) {
    CG_ACTIVE_TAB = tab_id;
    var tabs = main.children;
    var i, e, d;
    var div = false;

    for (i = 0; i < tabs.length; ++i) {
        e = tabs[i];
        if (e.id == tab_id) {
            div = e;
        }
        else {
            e.classList.add("cg-inactive-tab");
        }
    }

    if (div !== false) {
        div.classList.remove("cg-inactive-tab");
        return null;
    }

    div = document.createElement("DIV");
    div.id=tab_id;
    div.classList.add("cg-tab");
    div.classList.add("cg-borderbox");
    
    main.appendChild(div);
    
    return div;
}

function cg_button_click_read() {
    var btn = document.getElementById("cg-btn-tab-read");
    cg_button_click(btn, cg_construct_read);
}

function cg_button_click_write() {
    var btn = document.getElementById("cg-btn-tab-write");
    if (CG_SAVE_ORDER_NR !== null) {
        cg_button_click(btn, cg_construct_save);
        return;
    }
    cg_button_click(btn, cg_construct_write);
}

function cg_button_click_captcha(next, back) {
    CG_CAPTCHA_NEXT_FUN = next;
    CG_CAPTCHA_BACK_FUN = back;
    var btn = document.getElementById("cg-btn-tab-write");
    cg_button_click(btn, cg_construct_captcha);
}

function cg_button_click_tools() {
    var btn = document.getElementById("cg-btn-tab-tools");
    cg_button_click(btn, cg_construct_tools);
}

function cg_button_click_help() {
    var btn = document.getElementById("cg-btn-tab-help");
    cg_button_click(btn, cg_construct_help);
}

function cg_button_click_about() {
    var btn = document.getElementById("cg-btn-tab-about");
    cg_button_click(btn, cg_construct_about);
}

function cg_loadcss(url) {
    var head = document.getElementsByTagName('head')[0];
    var link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = url;
    head.appendChild(link);
    return link;
}

function cg_init_sound() {
    var channel_max = 10;
    audiochannels = new Array();
    for (a=0;a<channel_max;a++) {
	    audiochannels[a] = new Array();
	    audiochannels[a]['channel'] = new Audio();
	    audiochannels[a]['finished'] = -1;
    }
}

function cg_sfx(s, r) {
    r = typeof r !== 'undefined' ? r : (0.9 + Math.random()/5.0);
    if (audiochannels === null) return;

    var sfx = document.getElementById(s);
    if (sfx === null) return;

    for (a=0; a<audiochannels.length; a++) {
        var thistime = new Date();
        if (audiochannels[a]['finished'] < thistime.getTime()) { // is this channel finished?
            audiochannels[a]['finished'] = thistime.getTime() + sfx.duration*(1000/r);
            audiochannels[a]['channel'].src = sfx.src;
            audiochannels[a]['channel'].load();
            audiochannels[a]['channel'].play();
            audiochannels[a]['channel'].playbackRate=r;
            audiochannels[a]['channel'].preservesPitch=false;
            audiochannels[a]['channel'].mozPreservesPitch=false;
            audiochannels[a]['channel'].webkitPreservesPitch=false;
            break;
        }
    }
}

function cg_sfx_spray() {
    var snd = Math.floor((Math.random() * 2) + 1);
    cg_sfx("sfx_spray_"+snd);
}

function cg_sfx_rattle() {
    var snd = Math.floor((Math.random() * 5) + 1);
    cg_sfx("sfx_rattle_"+snd);
}

var CG_IMG_US = "data:image/gif;base64,R0lGODlhHAAQALMAAAAAmWaZ//8AAP+Z///MAP/MM//MZv/Mmf/MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEQhDISae4OGvwuO8g94xkWUoBkK6qpL3ZJ4dmfbYsC8D87NtAFG64471+M2CtwnQZNcqo8kmFSa+mqhaD7T62Wy82AgA7";
var CG_IMG_RU = "data:image/gif;base64,R0lGODlhHAAQALMAAABmzMwAAP+ZzP+Z///MAP/MM//MZv/Mmf/MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEKPDJSau9OOvNu/8gBYxkaZ5oqq5s675wLMNBbd94ru987//AoHB4iwAAOw==";
var CG_IMG_EE = "data:image/gif;base64,R0lGODdhHAAQALMAAAAAAABmzP+ZzP+Z///MAP/MM//MZv/Mmf/MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEKDDISau9OOvNu/8gBYxkaZ5oqq5s675wLMNPbd94ru987//AoHB4iwAAOw==";

