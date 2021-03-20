var CG_LOG_NORMAL  = 0;
var CG_LOG_ALERT   = 1;
var CG_LOG_WARNING = 2;

var GIuGDtd14GQaDKh9TfVKGQJS = {
    "version"    : "2.02",
    "language"   : "en",
    "api_url"    : "",
    "hashtag"    : null,
    "status"     : [],
    "constants"  : null,
    "decoder"    : true,
    "encoder"    : true,
    "online"     : null,
    "tab"        : null,
    "tabs"       : {},
    "scroll_key" : false,
    "debug"      : false,
    "buggy"      : false,
    "focus"      : null,
    "api_usage"  : { rpm : 0, max_rpm : 60 }
};

function cg_get_global(name) {
    if (name in GIuGDtd14GQaDKh9TfVKGQJS) {
        return GIuGDtd14GQaDKh9TfVKGQJS[name];
    }
    else console.error("Could not get global variable '"+name+"'.");

    return null;
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

function cg_main() {
    var metas = document.getElementsByTagName("META");
    for (var i=0; i < metas.length; ++i) {
        if (metas[i].name === "application-name") {
            cg_set_global("api_url", metas[i].getAttribute('data-api'));
            break;
        }
    }

    var cg_main = document.getElementById("cg-main");

    (
        function() {
            var link = (
                document.querySelector("link[rel*='icon']") ||
                document.createElement('link')
            );

            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = document.getElementById("gfx_icon").src;
            document.getElementsByTagName('head')[0].appendChild(link);
        }
    )();

    cg_init_sound();

    cg_parse_hashtag();
    cg_setup_parameters();

    if (cg_get_global("hashtag").lang === null) {
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

    if (cg_get_global("debug")) {
        var cg = document.getElementById("cg");
        cg.classList.add("cg-debug");
    }

    document.title = CG_TXT_MAIN_TITLE[cg_get_global("language")];

    var credits = document.getElementById("cg-credits");

    while (credits.hasChildNodes()) {
        credits.removeChild(credits.lastChild);
    }

    credits.appendChild(
        document.createTextNode(CG_TXT_MAIN_CREDITS[cg_get_global("language")])
    );

    cg_main.classList.add("cg-disappear");

    setTimeout(function(){
        cg_main.classList.remove("cg-disappear");
        cg_main.classList.add("cg-appear");
        while (cg_main.hasChildNodes()) {
            cg_main.removeChild(cg_main.lastChild);
        }

        cg_load_constants();
    }, 250);
}

function cg_setup_parameters(params) {
    params = (typeof params !== 'undefined') ?  params : null;

    var hashtag = cg_get_global("hashtag");

    for (var key in hashtag) {
        if (hashtag.hasOwnProperty(key)) {
            var val = hashtag[key];

            if (val === null) continue;
            if (params !== null && key in params == false) continue;

            switch (key) {
                case "lang" : cg_set_global("language", val); break;
                case "debug": cg_set_global("debug",    val); break;
                case "focus": cg_set_global("focus",    val); break;
                default     : break;
            }
        }
    }
}

function cg_parse_hashtag() {
    var hashtag = {
        lang : null,
        debug: false,
        focus: null
    };

    var hashes = location.hash.substring(1).split("#");
    for (var i=0, sz=hashes.length; i<sz; ++i) {
        var hash = decodeURIComponent(hashes[i]);
             if (hash ===    "en") hashtag.lang  = hash;
        else if (hash ===    "ru") hashtag.lang  = hash;
        else if (hash ===    "et") hashtag.lang  = hash;
        else if (hash === "debug") hashtag.debug = true;
        else if (is_digital(hash)) hashtag.focus = hash;
    }

    cg_set_global("hashtag", hashtag);
}

function cg_startup(cg) {
    if (cg_get_global("status").length > 0) {
        var text = (
            document.createTextNode(
                cg_pop_status().text
            )
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

    if (cg_get_global("constants") !== null) {
        cg_construct(cg);
        document.onkeydown = cg_check_key;
        document.addEventListener(
            'keydown',
            function(event){
                cg_check_key(event);
            }
        );
    }
    else {
        setTimeout(function(){
            cg_startup(cg);
        }, 1000);
    }
}

function cg_main_loop() {
    cg_set_global("scroll_key", false);

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

    setTimeout(function(){
        var tab_id = cg_get_global("tab");
        var tab = cg_get_global("tabs")[tab_id];

        switch (tab_id) {
            case "cg-tab-wall":  cg_wall_step(tab);  break;
            case "cg-tab-about": cg_about_step(tab); break;
            default: break;
        }
    }, 0);

    setTimeout(function(){
        cg_main_loop();
    }, 1000);
}

function cg_check_key(e) {
    if (e.keyCode == '38') {
        // up arrow
        cg_set_global("scroll_key", true);
    }
    else if (e.keyCode == '40') {
        // down arrow
        cg_set_global("scroll_key", true);
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

    setTimeout(function(){
        cg_activate_interface();
        cg_main_loop();
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
        status.setAttribute('data-status', "");
        status.id="cg-footer-status";
        footer.appendChild(status);
        cg_refresh_footer_status();

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
        a_en.onclick=function(){
            fade_out();
            setTimeout(function(){
                location.reload();
            }, 500);
            return true;
        };
        a_en.style.margin="0ch 0.25ch";

        var a_ru = document.createElement("a");
        a_ru.appendChild(img_ru);
        a_ru.title = cg_translate(CG_TXT_MAIN_TRANSLATE_TO_RU);
        a_ru.href  = "#ru"+options;
        a_ru.classList.add("hvr-glow");
        a_ru.onclick=function(){
            fade_out();
            setTimeout(function(){
                location.reload();
            }, 500);
            return true;
        };
        a_ru.style.margin="0ch 0.25ch";

        var a_ee = document.createElement("a");
        a_ee.appendChild(img_ee);
        a_ee.title = cg_translate(CG_TXT_MAIN_TRANSLATE_TO_EE);
        a_ee.href  = "#et"+options;
        a_ee.classList.add("hvr-glow");
        a_ee.onclick=function(){
            fade_out();
            setTimeout(function(){
                location.reload();
            }, 500);
            return true;
        };
        a_ee.style.margin="0ch 0.25ch";

        if (cg_get_global("language") !== "en") languages.appendChild(a_en);
        if (cg_get_global("language") !== "ru") languages.appendChild(a_ru);
        if (cg_get_global("language") !== "et") languages.appendChild(a_ee);

        languages.classList.add("cg-appear");
        languages.classList.add("cg-footer-languages");

        footer.appendChild(languages);
    }, 250);
}

function cg_refresh_footer_status() {
    var div = document.getElementById("cg-footer-status");
    if (!div.hasChildNodes() && !div.classList.contains("cg-status")) {
        div.classList.add("cg-status");
    }

    var last_status_message = div.getAttribute('data-status');

    var status_message = "";
    var status_level   = CG_LOG_NORMAL;

    while (cg_first_status() !== null) {
        var status = cg_first_status();

        status_level = status.level;

        if (status.presentation_timestamp === null) {
            status.presentation_timestamp = Math.floor(Date.now() / 1000);
        }

        var time_to_live = 2+2*status_level;

        if (get_timestamp_age(status.presentation_timestamp) > time_to_live
        ||  cg_status_count() > 1) {
            cg_pop_status();

            while ( (status = cg_first_status()) !== null ) {
                var ts_age = get_timestamp_age(status.creation_timestamp);

                status_level = status.level;

                if (ts_age > (2+2*status_level)) {
                    cg_pop_status();
                }
                else break;
            }
        }
        else {
            status_message = status.text;
            break;
        }
    }

    if (status_message === "") {
        if (cg_get_global("online") === null) {
            status_message = cg_translate(CG_TXT_MAIN_PLEASE_WAIT);
        }
        else {
            status_message = cg_get_global("online");
        }
    }

    if (last_status_message !== status_message) {
        while (div.hasChildNodes()) {
            div.removeChild(div.lastChild);
        }

        div.setAttribute('data-status', status_message);
    }

    if (div.classList.contains("cg-status-warning")
    ||  div.classList.contains("cg-status-alert")) {
        div.classList.remove("cg-status-warning");
        div.classList.remove("cg-status-alert");
    }
    else if (status_level === CG_LOG_WARNING) {
        div.classList.add("cg-status-warning");
    }
    else if (status_level === CG_LOG_ALERT) {
        div.classList.add("cg-status-alert");
    }

    setTimeout(function(){
        cg_refresh_footer_status();
    }, 500);
}

function cg_load_constants() {
    var api_usage = cg_get_global("api_usage");

    if (api_usage.rpm + 10 >= api_usage.max_rpm) {
        return;
    }
    else api_usage.rpm++;

    var data_obj = {};
    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    cg_push_status(cg_translate(CG_TXT_MAIN_LOADING_CONSTANTS));

    xmlhttpPost(cg_get_global("api_url"), 'fun=get_constants&data='+json_str,
        function(response) {
            var status = "";

            if (response === false) {
                status = cg_translate(CG_TXT_MAIN_ERROR);
            }
            else if (response === null ) {
                status = cg_translate(CG_TXT_MAIN_TIMEOUT);
            }
            else {
                json = JSON.parse(response);
                if ("constants" in json
                &&  "TXS_PER_QUERY" in json.constants) {
                    cg_set_global("constants",  json.constants);
                    status = cg_translate(CG_TXT_MAIN_CONSTANTS_LOADED);
                }
                else {
                    cg_handle_error(json);
                }

                if ("api_usage" in json) {
                    cg_set_global("api_usage", json.api_usage);
                }
            }

            if (status.length > 0) cg_push_status(status);

            if (cg_get_global("constants") !== null) {
                var cg_main = document.getElementById("cg-main");
                cg_startup(cg_main);

                setTimeout(
                    function(){
                        cg_load_stats();
                    }, 100
                );
                return;
            }

            setTimeout(function(){
                cg_load_constants();
            }, 10000);
        }
    );

    return;
}

function cg_load_stats() {
    // Here we don't check API usage because in case we were already banned we
    // need to poll the API to see when the ban has been lifted.

    var data_obj = {};
    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    cg_push_status(cg_translate(CG_TXT_MAIN_ONLINE)+": ...");

    xmlhttpPost(cg_get_global("api_url"), 'fun=get_stats&data='+json_str,
        function(response) {
            var online = "???";

            if (response === false) {
                online = cg_translate(CG_TXT_MAIN_ERROR);
            }
            else if (response === null ) {
                online = cg_translate(CG_TXT_MAIN_TIMEOUT);
            }
            else {
                json = JSON.parse(response);

                if ("api_usage" in json) {
                    cg_set_global("api_usage", json.api_usage);
                }

                if ("stats" in json && json.stats.length === 1
                &&  "sessions" in json.stats[0]
                &&  "IPs" in json.stats[0]
                &&  "decoder" in json.stats[0]
                &&  "encoder" in json.stats[0]) {
                    var units = (
                        json.stats[0].sessions == 1
                            ? cg_translate(CG_TXT_MAIN_SESSION)
                            : cg_translate(CG_TXT_MAIN_SESSIONS)
                    );

                    online = json.stats[0].IPs;

                    var decoder_ok = (json.stats[0].decoder !== "0");
                    var encoder_ok = (json.stats[0].encoder !== "0");

                    if (decoder_ok !== cg_get_global("decoder")) {
                        if (!decoder_ok) {
                            cg_push_status(
                                cg_translate(
                                    CG_TXT_MAIN_DECODER_APPEARS_OFFLINE
                                ), CG_LOG_WARNING
                            );
                        }
                        else {
                            cg_push_status(
                                cg_translate(
                                    CG_TXT_MAIN_DECODER_APPEARS_ONLINE
                                ), CG_LOG_ALERT
                            );
                        }
                    }

                    /* TODO: uncomment when Encoder has been implemented.
                    if (encoder_ok !== cg_get_global("encoder")) {
                        if (!encoder_ok) {
                            cg_push_status(
                                cg_translate(
                                    CG_TXT_MAIN_ENCODER_APPEARS_OFFLINE
                                ), CG_LOG_WARNING
                            );
                        }
                        else {
                            cg_push_status(
                                cg_translate(
                                    CG_TXT_MAIN_ENCODER_APPEARS_ONLINE
                                ), CG_LOG_ALERT
                            );
                        }
                    }
                    */

                    cg_set_global("decoder", decoder_ok);
                    cg_set_global("encoder", encoder_ok);
                }
                else cg_handle_error(json);
            }

            cg_set_global(
                "online", cg_translate(CG_TXT_MAIN_ONLINE)+": "+online
            );
            cg_push_status(cg_get_global("online"));

            setTimeout(function(){
                cg_load_stats();
            }, 10000);
        }
    );
}

function cg_handle_error(obj) {
    if ("error" in obj && "code" in obj.error) {
        if (obj.error.code === "ERROR_ACCESS_DENIED") {
            cg_push_status(
                cg_translate(CG_TXT_MAIN_ERROR_ACCESS_DENIED), CG_LOG_WARNING
            );
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
    }, 250);
}

function cg_activate_interface() {
    var cg = document.getElementById("cg-main");

    while (cg.hasChildNodes()) {
        cg.removeChild(cg.lastChild);
    }

    cg_sfx_rattle();

    cg.classList.remove("cg-appear");
    cg.classList.add("cg-disappear");

    setTimeout(
        function(){
            cg_wall_construct(cg);
            cg.classList.remove("cg-disappear");
            cg.classList.add("cg-appear");
        }, 0
    );
}

function cg_construct_buttons(tabs) {
    var buttons = [
        {
            id: "cg-btn-tab-wall",
            label : CG_TXT_MAIN_BTN_WALL,
            click_fun : cg_button_click_wall
        },
        {
            id: "cg-btn-tab-about",
            label : CG_TXT_MAIN_BTN_ABOUT,
            click_fun : cg_button_click_about
        }
    ];

    while (buttons.length > 0) {
        var template = buttons.shift();

        var btn = document.createElement("BUTTON");
        btn.classList.add("cg-btn");
        btn.addEventListener("click", template.click_fun);

        var txt = document.createTextNode(cg_translate(template.label));
        btn.appendChild(txt);
        btn.id = template.id;

        if (template.id === "cg-btn-tab-wall") {
            btn.disabled = true;
        }

        tabs.appendChild(btn);
    }
}

function cg_button_click(btn, fun) {
    if (cg_get_global("constants") === null) return;

    var x = document.getElementsByClassName("cg-btn");
    for (var i = 0; i < x.length; i++) {
        x[i].disabled = false;
    }
    btn.disabled = true;

    var cg_main = document.getElementById("cg-main");

    cg_sfx_rattle();

    cg_main.classList.remove("cg-appear");
    cg_main.classList.add("cg-disappear");

    setTimeout(function(){
        fun(cg_main);
        cg_main.classList.remove("cg-disappear");
        cg_main.classList.add("cg-appear");
    }, 250);
}

function cg_init_tab(main, tab_id) {
    cg_set_global("tab", tab_id);
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

    cg_get_global("tabs")[tab_id] = {
        element : div
    };

    return cg_get_global("tabs")[tab_id];
}

function cg_button_click_about() {
    var btn = document.getElementById("cg-btn-tab-about");
    cg_button_click(btn, cg_about_construct);
}

function cg_button_click_wall() {
    var btn = document.getElementById("cg-btn-tab-wall");
    cg_button_click(btn, cg_wall_construct);
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

function cg_sfx(s, v, r) {
    v = typeof v !== 'undefined' ? v : (1.0);
    r = typeof r !== 'undefined' ? r : (0.9 + Math.random()/5.0);

    if (audiochannels === null) return;

    var sfx = document.getElementById(s);
    if (sfx === null) return;

    for (a=0; a<audiochannels.length; a++) {
        var thistime = new Date();
        if (audiochannels[a]['finished'] < thistime.getTime()) {
            // is this channel finished?

            audiochannels[a]['finished'] = (
                thistime.getTime() + sfx.duration*(1000/r)
            );
            audiochannels[a]['channel'].src = sfx.src;
            audiochannels[a]['channel'].load();
            audiochannels[a]['channel'].playbackRate=r;
            audiochannels[a]['channel'].preservesPitch=false;
            audiochannels[a]['channel'].mozPreservesPitch=false;
            audiochannels[a]['channel'].webkitPreservesPitch=false;
            audiochannels[a]['channel'].volume = v;
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

function cg_sfx_spray(volume) {
    volume = typeof volume !== 'undefined' ? volume : (1.0);
    var snd = Math.floor((Math.random() * 2) + 1);
    cg_sfx("sfx_spray_"+snd, volume);
}

function cg_sfx_rattle(volume) {
    volume = typeof volume !== 'undefined' ? volume : (1.0);
    var snd = Math.floor((Math.random() * 5) + 1);
    cg_sfx("sfx_rattle_"+snd);
}

function cg_translate(text, args) {
    args = typeof args !== 'undefined' ? args : ([]);
    return sprintf(text[cg_get_global("language")], args);
}

function cg_push_status(str, lvl) {
    lvl = typeof lvl !== 'undefined' ? lvl : (CG_LOG_NORMAL);

    var status = cg_get_global("status");

    status.push(
        {
            text                   : str,
            level                  : lvl,
            creation_timestamp     : Math.floor(Date.now() / 1000),
            presentation_timestamp : null
        }
    );
}

function cg_pop_status() {
    var status = cg_get_global("status");
    if (status.length === 0) return null;
    return status.shift();
}

function cg_first_status() {
    var status = cg_get_global("status");
    if (status.length === 0) return null;
    return status[0];
}

function cg_status_count() {
    var status = cg_get_global("status");
    return status.length;
}

function cg_bug(arg) {
    arg = typeof arg !== 'undefined' ? arg : null;

    if (cg_get_global("buggy") === false) {
        if (arg !== null) {
            console.error("Forbidden condtion has been met ("+arg+").");
        }
        else console.error("Forbidden condtion has been met.");
        console.trace();
    }

    cg_set_global("buggy", true);
}

var CG_IMG_US = (
    "data:image/gif;base64,R0lGODlhHAAQALMAAAAAmWaZ//8AAP+Z///MAP/MM//MZv/Mmf/"+
    "MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEQhDISae4OGvwuO8g94xkWUoBkK6q"+
    "pL3ZJ4dmfbYsC8D87NtAFG64471+M2CtwnQZNcqo8kmFSa+mqhaD7T62Wy82AgA7"
);

var CG_IMG_RU = (
    "data:image/gif;base64,R0lGODlhHAAQALMAAABmzMwAAP+ZzP+Z///MAP/MM//MZv/Mmf/"+
    "MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEKPDJSau9OOvNu/8gBYxkaZ5oqq5s"+
    "675wLMNBbd94ru987//AoHB4iwAAOw=="
);

var CG_IMG_EE = (
    "data:image/gif;base64,R0lGODdhHAAQALMAAAAAAABmzP+ZzP+Z///MAP/MM//MZv/Mmf/"+
    "MzP/M////AP//M///Zv//mf//zP///ywAAAAAHAAQAAAEKDDISau9OOvNu/8gBYxkaZ5oqq5s"+
    "675wLMNPbd94ru987//AoHB4iwAAOw=="
);
