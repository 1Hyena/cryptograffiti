var GIuGDtd14GQaDKh9TfVKGQJS = {
    "version" : "2.00",
    "language" : "en",
    "api_url" : "",
    "hashtag" : null
};

function cg_get_global(name) {
    if (name in GIuGDtd14GQaDKh9TfVKGQJS) {
        return GIuGDtd14GQaDKh9TfVKGQJS[name];
    }
    else console.error("Could not get global variable '"+name+"'.");
}

function cg_set_global(name, value) {
    if (name in GIuGDtd14GQaDKh9TfVKGQJS) {
        GIuGDtd14GQaDKh9TfVKGQJS[name] = value;
    }
    else {
        console.error(
            "Could not set global variable '"+name+"' to '"+value+"'."
        );
    }
}

var CG_API_URL     = "";
var CG_HASHTAG     = null;
/******************************************************************************/
var CG_CONSTANTS   = null;
var CG_STATUS      = [];
var CG_LAST_STATUS = "";
var CG_ONLINE      = null;
var CG_SAT_BYTE    = 0;
var CG_HOLD_STATUS = 0;
var CG_HOLD_DELAY  = false;
var CG_TX_NR       = null;
var CG_TX_HASH     = null;
var CG_TX_TYPE     = null;
var CG_SCROLL_KEY  = false;
var CG_ACTIVE_TAB  = null;
var CG_DECODER_OK  = true; // Decoder is online?
var CG_ENCODER_OK  = true; // Encoder is online?
var CG_LAST_HASH   = "";

function cg_main() {
    var metas = document.getElementsByTagName("META");
    for (var i=0; i < metas.length; ++i) {
        if (metas[i].name === "application-name") {
            CG_API_URL = metas[i].getAttribute('data-api');
            break;
        }
    }

    var cg_main = document.getElementById("cg-main");

    (function() {
        var link = (
            document.querySelector("link[rel*='icon']") ||
            document.createElement('link')
        );

        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = document.getElementById("gfx_icon").src;
        document.getElementsByTagName('head')[0].appendChild(link);
    })();

    cg_init_sound();

    cg_parse_hashtag();
    cg_setup_parameters();

    if (CG_HASHTAG.lang === null) {
        var lang = (
            navigator.languages
                ? navigator.languages[0]
                : (navigator.language || navigator.userLanguage)
        );

        lang = (
            lang || (
                window.navigator.languages
                    ? window.navigator.languages[0] : null
            )
        );

        lang = (
            lang || (
                window.navigator.language ||
                window.navigator.browserLanguage ||
                window.navigator.userLanguage
            )
        );

        if (lang.indexOf('-') !== -1) lang = lang.split('-')[0];
        if (lang.indexOf('_') !== -1) lang = lang.split('_')[0];

        lang = lang.toUpperCase();

             if (lang === "ET") cg_set_global("language", "et");
        else if (lang === "RU") cg_set_global("language", "ru");
        else                    cg_set_global("language", "en");
    }

    document.title = CG_TXT_MAIN_TITLE[cg_get_global("language")];

    var credits = document.getElementById("cg-credits");

    while (credits.hasChildNodes()) {
        credits.removeChild(credits.lastChild);
    }

    credits.appendChild(
        document.createTextNode(CG_TXT_MAIN_CREDITS[cg_get_global("language")])
    );

    cg_main.classList.add("disappear");

    setTimeout(function(){
        cg_main.classList.remove("disappear");
        cg_main.classList.add("appear");
        while (cg_main.hasChildNodes()) {
            cg_main.removeChild(cg_main.lastChild);
        }

        cg_load_constants();
        cg_startup(cg_main);
    }, 0);
}

function cg_setup_parameters(params) {
    params = (typeof params !== 'undefined') ?  params : null;

    for (var key in CG_HASHTAG) {
        if (CG_HASHTAG.hasOwnProperty(key)) {
            var val = CG_HASHTAG[key];
            if (val === null) continue;
            if (params !== null && key in params == false) continue;

            switch (key) {
                case "lang" : cg_set_global("language", val); break;
                default     : break;
            }
        }
    }
}

function cg_parse_hashtag() {
    CG_HASHTAG = {
        lang        : null,
        tx_nr       : null,
        tx_hash     : null,
        filter_addr : null,
        filter_key  : null,
        censor_txs  : null,
        write_txt   : null,
        order_nr    : null,
        pay         : null,
        mimetype    : null
    };

    var hashes = location.hash.substring(1).split("#");
    for (var i=0, sz=hashes.length; i<sz; ++i) {
        var hash = decodeURIComponent(hashes[i]);
             if (hash === "en") CG_HASHTAG.lang = hash;
        else if (hash === "ru") CG_HASHTAG.lang = hash;
        else if (hash === "et") CG_HASHTAG.lang = hash;
    }
}

function cg_prepare_status(status) {
    if (status.charAt(0) === '!' || status.charAt(0) === '_') {
        status = status.substr(1);
    }
    return status;
}

function cg_startup(cg) {
    if (CG_STATUS.length > 0) {
        var text = (
            document.createTextNode(cg_prepare_status(CG_STATUS.shift()))
        );

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
    }

    if (CG_CONSTANTS !== null) {
        cg_construct(cg);
        document.onkeydown = cg_check_key;
        cg_main_loop();
    }
    else {
        setTimeout(function(){
            cg_startup(cg);
        }, 1000);
    }
}

function cg_main_set_hash(update) {
    var setup_params = {};
    for (var key in update) {
        if (update.hasOwnProperty(key)) {
            CG_HASHTAG[key] = update[key];
            setup_params[key] = true;
        }
    }

    var hashtag = "";

    for (var key in CG_HASHTAG) {
        if (CG_HASHTAG.hasOwnProperty(key)) {
            var val = CG_HASHTAG[key];
            if (val === null) continue;

            switch (key) {
                case "lang" : hashtag += "#"+val; break;
                default     : break;
            }
        }
    }

    if (CG_LAST_HASH  !== location.hash
    ||  CG_LAST_HASH  !== hashtag) {
        if (hashtag.length == 0) hashtag = "#";
        if (history.pushState) history.pushState(null, null, hashtag);
        else location.hash = hashtag;
    }
    CG_LAST_HASH = hashtag;

    cg_setup_parameters(setup_params);
}

function cg_main_loop() {
    CG_SCROLL_KEY  = false;

    cg_parse_hashtag();

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

    var tab_view = document.getElementById("cg-tab-view");
    if (tab_view && !tab_view.classList.contains("cg-inactive-tab")) {
        cg_view_update();
    }

    var tab_save = document.getElementById("cg-tab-save");
    if (tab_save && !tab_save.classList.contains("cg-inactive-tab")) {
        cg_save_update();
    }

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
    var text = document.createTextNode(cg_translate(CG_TXT_MAIN_PLEASE_WAIT));

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
    }, 0);

    setTimeout(function(){
        cg_construct_footer();
    }, 0);
}

function cg_construct_footer() {
    var footer = document.getElementById("cg-footer");

    var credits = document.getElementById("cg-credits");

    credits.className = credits.className + " cg-disappear";

    setTimeout(function(){
        while (footer.hasChildNodes()) {
            footer.removeChild(footer.lastChild);
        }
        var status = document.createElement("DIV");
        footer.appendChild(status);
        cg_refresh_status(status);

        var languages = document.createElement("DIV");

        var img_us = document.createElement("img");
        img_us.setAttribute('src', CG_IMG_US);
        img_us.setAttribute('alt', cg_translate(CG_TXT_MAIN_FLAG_OF_US));
        img_us.style.verticalAlign="middle";

        var img_ru = document.createElement("img");
        img_ru.setAttribute('src', CG_IMG_RU);
        img_ru.setAttribute('alt', cg_translate(CG_TXT_MAIN_FLAG_OF_RU));
        img_ru.style.verticalAlign="middle";

        var img_ee = document.createElement("img");
        img_ee.setAttribute('src', CG_IMG_EE);
        img_ee.setAttribute('alt', cg_translate(CG_TXT_MAIN_FLAG_OF_EE));
        img_ee.style.verticalAlign="middle";

        var options="";

        var a_en = document.createElement("a"); a_en.appendChild(img_us);
        a_en.title = cg_translate(CG_TXT_MAIN_TRANSLATE_TO_EN);
        a_en.href  = "#en"+options;
        a_en.classList.add("hvr-glow");
        a_en.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
        a_en.style.margin="0ch 0.25ch";

        var a_ru = document.createElement("a"); a_ru.appendChild(img_ru);
        a_ru.title = cg_translate(CG_TXT_MAIN_TRANSLATE_TO_RU);
        a_ru.href  = "#ru"+options;
        a_ru.classList.add("hvr-glow");
        a_ru.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
        a_ru.style.margin="0ch 0.25ch";

        var a_ee = document.createElement("a"); a_ee.appendChild(img_ee);
        a_ee.title = cg_translate(CG_TXT_MAIN_TRANSLATE_TO_EE);
        a_ee.href  = "#et"+options;
        a_ee.classList.add("hvr-glow");
        a_ee.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
        a_ee.style.margin="0ch 0.25ch";

        if (cg_get_global("language") !== "en") languages.appendChild(a_en);
        if (cg_get_global("language") !== "ru") languages.appendChild(a_ru);
        if (cg_get_global("language") !== "et") languages.appendChild(a_ee);

        languages.classList.add("cg-appear");
        languages.classList.add("cg-footer-languages");

        footer.appendChild(languages);
    }, 0);
}

function cg_refresh_status(div) {
    if (!div.hasChildNodes() && !div.classList.contains("cg-status")) {
        div.classList.add("cg-status");
    }

    var status = "";
    if (CG_HOLD_STATUS > 0) {
        status = CG_LAST_STATUS;
        CG_HOLD_STATUS--;
        if (CG_HOLD_DELAY && CG_STATUS.length > 0) {
            CG_HOLD_STATUS = 0;
            CG_HOLD_DELAY = false;
        }
    }
    else if (CG_STATUS.length === 0) {
        if (CG_ONLINE === null) status = cg_translate(CG_TXT_MAIN_PLEASE_WAIT);
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

        var buf = cg_prepare_status(status);

        div.appendChild(document.createTextNode(buf));
        CG_LAST_STATUS = status;
    }

    if (div.classList.contains("cg-status-warning")) {
        div.classList.remove("cg-status-warning");
    }
    else if (status.charAt(0) === '!') {
        div.classList.add("cg-status-warning");
    }

    setTimeout(function(){
        cg_refresh_status(div);
    }, 500);
}

function cg_load_constants() {
    var data_obj = {};
    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    CG_STATUS.push(cg_translate(CG_TXT_MAIN_LOADING_CONSTANTS));
    xmlhttpPost(CG_API_URL, 'fun=get_constants&data='+json_str,
        function(response) {
            var status = "";

                 if (response === false) status = cg_translate(CG_TXT_MAIN_ERROR);
            else if (response === null ) status = cg_translate(CG_TXT_MAIN_TIMEOUT);
            else {
                json = JSON.parse(response);
                if ("constants" in json
                &&  "TXS_PER_QUERY" in json.constants
                &&  "ENCODER_FEE_AMPLIFIER" in json.constants
                &&  "MIN_BTC_OUTPUT" in json.constants
                &&  "SATOSHIS_PER_BITCOIN" in json.constants) {
                   CG_CONSTANTS = json.constants;
                   status = cg_translate(CG_TXT_MAIN_CONSTANTS_LOADED);
                   CG_WRITE_MIN_BTC_OUTPUT = CG_CONSTANTS["MIN_BTC_OUTPUT"] / CG_CONSTANTS["SATOSHIS_PER_BITCOIN"];
                }
                else {
                    cg_handle_error(json);
                    if (CG_STATUS.length === 0) status = cg_translate(CG_TXT_MAIN_ERROR);
                }
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

    CG_STATUS.push(cg_translate(CG_TXT_MAIN_ONLINE)+": ...");
    xmlhttpPost(CG_API_URL, 'fun=get_stats&data='+json_str,
        function(response) {
            var online = "???";

                 if (response === false) online = cg_translate(CG_TXT_MAIN_ERROR);
            else if (response === null ) online = cg_translate(CG_TXT_MAIN_TIMEOUT);
            else {
                json = JSON.parse(response);
                if ("stats" in json && json.stats.length === 1
                &&  "sessions" in json.stats[0]
                &&  "IPs" in json.stats[0]
                &&  "decoder" in json.stats[0]
                &&  "encoder" in json.stats[0]
                &&  "sat_byte" in json.stats[0]) {
                    CG_SAT_BYTE = json.stats[0].sat_byte;
                    var units = (json.stats[0].sessions == 1 ? cg_translate(CG_TXT_MAIN_SESSION) : cg_translate(CG_TXT_MAIN_SESSIONS));
                    online = json.stats[0].IPs/*+" ("+json.stats[0].sessions+" "+units+")"*/;
                    var decoder_ok = (json.stats[0].decoder !== "0");
                    var encoder_ok = (json.stats[0].encoder !== "0");
                    if (decoder_ok != CG_DECODER_OK) {
                       if (!decoder_ok) CG_STATUS.push("!"+cg_translate(CG_TXT_MAIN_DECODER_APPEARS_OFFLINE));
                       else CG_STATUS.push("_"+cg_translate(CG_TXT_MAIN_DECODER_APPEARS_ONLINE));
                    }
                    if (encoder_ok != CG_ENCODER_OK) {
                       if (!encoder_ok) CG_STATUS.push("!"+cg_translate(CG_TXT_MAIN_ENCODER_APPEARS_OFFLINE));
                       else CG_STATUS.push("_"+cg_translate(CG_TXT_MAIN_ENCODER_APPEARS_ONLINE));
                    }
                    CG_DECODER_OK = decoder_ok;
                    CG_ENCODER_OK = encoder_ok;
                }
                else cg_handle_error(json);
            }

            CG_ONLINE=cg_translate(CG_TXT_MAIN_ONLINE)+": "+online;
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
            CG_STATUS.push("!"+cg_translate(CG_TXT_MAIN_ERROR_ACCESS_DENIED));
        }
    }
    return;
}

function cg_construct_header() {
    var header = document.getElementById("cg-header");

    header.classList.add("cg-disappear");

    setTimeout(function(){
        var version = null;
        if (header.hasChildNodes()) {
            while (header.children[0].hasChildNodes()) {
                header.children[0].removeChild(header.children[0].lastChild);
            }

            var title_link = document.createElement("a");
            var title_img  = document.createElement("img");
            title_link.href = "https://cryptograffiti.info/";
            title_link.title= "CryptoGraffiti.info";
            title_link.id   = "cg-title-link";
            title_img.id    = "cg-title-img";
            title_img.src   = document.getElementById("gfx_title").src;
            title_link.appendChild(title_img);
            header.children[0].appendChild(title_link);

            version = document.createElement("span");
            version.appendChild(
                document.createTextNode(
                    "v"+cg_get_global("version")
                )
            );
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

        header.classList.remove("cg-disappear");
        header.classList.add("cg-appear");

        setTimeout(function(){
            cg_construct_buttons(tabs);
            if (version) {
                version.style.width="5ch";
                setTimeout(function(){
                    version.classList.add("cg-appear");
                }, 1000);
            }
        }, 0);
    }, 0);
}

function cg_activate_interface() {
    var cg = document.getElementById("cg-main");

    while (cg.hasChildNodes()) {
        cg.removeChild(cg.lastChild);
    }

    var btn = document.getElementById("cg-btn-tab-about");
    btn.disabled = false;
    btn.click();

    /*
    if (CG_TX_HASH !== null) {
        var btn = document.getElementById("cg-btn-tab-read");
        cg_button_click(btn, cg_construct_view);
        read_btn.disabled = false;
    }
    else if (CG_WRITE_TEXT    === null
         &&  CG_SAVE_ORDER_NR === null) {
        read_btn.disabled = false;
        read_btn.click();
    }
    else {
        write_btn.disabled = false;
        write_btn.click();
    }
    */
}

function cg_construct_buttons(tabs) {
    //var btn_1 = document.createElement("BUTTON"); btn_1.classList.add("cg-btn");
    //var btn_2 = document.createElement("BUTTON"); btn_2.classList.add("cg-btn");
    //var btn_3 = document.createElement("BUTTON"); btn_3.classList.add("cg-btn");
    //var btn_4 = document.createElement("BUTTON"); btn_4.classList.add("cg-btn");
    var btn_5 = document.createElement("BUTTON"); btn_5.classList.add("cg-btn");

    //btn_1.addEventListener("click", cg_button_click_read );
    //btn_2.addEventListener("click", cg_button_click_write);
    //btn_3.addEventListener("click", cg_button_click_tools);
    //btn_4.addEventListener("click", cg_button_click_help );
    btn_5.addEventListener("click", cg_button_click_about);

    //var txt_1 = document.createTextNode(CG_TXT_MAIN_BTN_READ [CG_LANGUAGE]);
    //var txt_2 = document.createTextNode(CG_TXT_MAIN_BTN_WRITE[CG_LANGUAGE]);
    //var txt_3 = document.createTextNode(CG_TXT_MAIN_BTN_TOOLS[CG_LANGUAGE]);
    //var txt_4 = document.createTextNode(CG_TXT_MAIN_BTN_HELP [CG_LANGUAGE]);
    var txt_5 = document.createTextNode(cg_translate(CG_TXT_MAIN_BTN_ABOUT));

    //btn_1.appendChild(txt_1); btn_1.id = "cg-btn-tab-read";
    //btn_2.appendChild(txt_2); btn_2.id = "cg-btn-tab-write";
    //btn_3.appendChild(txt_3); btn_3.id = "cg-btn-tab-tools";
    //btn_4.appendChild(txt_4); btn_4.id = "cg-btn-tab-help";
    btn_5.appendChild(txt_5); btn_5.id = "cg-btn-tab-about";

    setTimeout(
        function(){
            /*
            tabs.appendChild(btn_1);
            tabs.appendChild(btn_2);
            tabs.appendChild(btn_3);
            tabs.appendChild(btn_4);
            */
            tabs.appendChild(btn_5);

            setTimeout(
                function(){
                    cg_activate_interface();
                }, 0
            );

        }, 0
    );

    /*
    var spawn_delay = 0;
    setTimeout(function(){tabs.appendChild(btn_1);}, 0*spawn_delay);
    setTimeout(function(){
        tabs.appendChild(btn_2);
        cg_click_initial_buttons(btn_1, btn_2);
    }, 1*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_3);}, 2*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_4);}, 3*spawn_delay);
    setTimeout(function(){tabs.appendChild(btn_5);}, 4*spawn_delay);
    */
}

function cg_button_click(btn, fun) {
    if (CG_CONSTANTS === null) return;

    var x = document.getElementsByClassName("cg-btn");
    for (var i = 0; i < x.length; i++) {
        x[i].disabled = false;
    }
    btn.disabled = true;

    var cg_main = document.getElementById("cg-main");

    cg_sfx_rattle();
    if (CG_ACTIVE_TAB !== 'cg-tab-read') {
        cg_main.classList.remove("cg-poofin");
        cg_main.classList.add("cg-poofout");
    }
    else {
        cg_main.classList.remove("cg-appear");
        cg_main.classList.add("cg-disappear");
    }

    if (fun !== cg_construct_about) {
        setTimeout(function(){
            fun(cg_main);
            cg_main.classList.remove("cg-disappear");
            cg_main.classList.remove("cg-poofout");
            cg_main.classList.add("cg-poofin");
        }, (CG_ACTIVE_TAB === 'cg-tab-read') ? 500 : 200);
    }
    else {
        setTimeout(function(){
            fun(cg_main);
            cg_main.classList.remove("cg-disappear");
            cg_main.classList.remove("cg-poofout");
            cg_main.classList.add("cg-appear");
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
            audiochannels[a]['channel'].playbackRate=r;
            audiochannels[a]['channel'].preservesPitch=false;
            audiochannels[a]['channel'].mozPreservesPitch=false;
            audiochannels[a]['channel'].webkitPreservesPitch=false;
            var audio = audiochannels[a]['channel'];
            var promise = audio.play();
            if (promise !== undefined) {
                promise.then(
                    function(){return;},
                    function(){audiochannels[a]['finished'] = true;}
                );
            }
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

function cg_translate(text) {
    return text[cg_get_global("language")];
}

var CG_IMG_US = "data:image/gif;base64,R0lGODlhHAAQALMAAAAAmWaZ//8AAP+Z///MAP/MM//MZv/Mmf/MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEQhDISae4OGvwuO8g94xkWUoBkK6qpL3ZJ4dmfbYsC8D87NtAFG64471+M2CtwnQZNcqo8kmFSa+mqhaD7T62Wy82AgA7";
var CG_IMG_RU = "data:image/gif;base64,R0lGODlhHAAQALMAAABmzMwAAP+ZzP+Z///MAP/MM//MZv/Mmf/MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEKPDJSau9OOvNu/8gBYxkaZ5oqq5s675wLMNBbd94ru987//AoHB4iwAAOw==";
var CG_IMG_EE = "data:image/gif;base64,R0lGODdhHAAQALMAAAAAAABmzP+ZzP+Z///MAP/MM//MZv/Mmf/MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEKDDISau9OOvNu/8gBYxkaZ5oqq5s675wLMNPbd94ru987//AoHB4iwAAOw==";
