var CG_VIEW_TX_HASH = null;
var CG_VIEW_TX_TYPE = null;
var CG_VIEW_HEAD = false;
var CG_VIEW_BODY = false;
var CG_VIEW_HEAD_LAST = false;
var CG_VIEW_BODY_LAST = false;
var CG_VIEW_LOCK = false;
var CG_VIEW_DOING= false;
var CG_VIEW_DONE = false;
var CG_VIEW_TX_DONE = null;
var CG_VIEW_TX_DONE_TYPE = null;
var CG_VIEW_TYPES = {
    "jpg" : "image/jpeg",
    "png" : "image/png",
    "gif" : "image/gif",
    "bmp" : "image/bmp",
    "txt" : "text/plain",
    "md"  : "text/markdown",
    "html": "text/html",
    "htm" : "text/html",
    "pdf" : "application/pdf",
    ""    : "application/octet-stream"
};

function cg_construct_view(main) {
    var div = cg_init_tab(main, 'cg-tab-view');
    if (div === null) return;
    div.classList.add("cg-view-tab");

    var btn_open = document.createElement("BUTTON");
    btn_open.id = "cg-view-btn-open";
    btn_open.appendChild(document.createTextNode(CG_TXT_VIEW_BTN_OPEN[CG_LANGUAGE]));
    btn_open.classList.add("cg-view-btn");
    btn_open.addEventListener("click", cg_button_click_view_open);

    var btn_close = document.createElement("BUTTON");
    btn_close.id = "cg-view-btn-close";
    btn_close.appendChild(document.createTextNode(CG_TXT_VIEW_BTN_CLOSE[CG_LANGUAGE]));
    btn_close.classList.add("cg-view-btn");
    btn_close.addEventListener("click", cg_button_click_view_close);

    var main = document.createElement("div");
    var head = document.createElement("div");
    var body = document.createElement("div");
    var btns = document.createElement("div");
    main.id = "cg-view-main";
    head.id = "cg-view-head";
    body.id = "cg-view-body";
    btns.id = "cg-view-btns";
    btns.appendChild(btn_open);
    btns.appendChild(btn_close);
    main.appendChild(head);
    main.appendChild(body);
    div.appendChild(main);
    div.appendChild(btns);
}

function cg_view_update_end(again) {
    if (again) cg_view_update();
}

function cg_button_click_view_open() {
    var btn_open  = document.getElementById("cg-view-btn-open");
    var type = null;
    var select = document.getElementById("cg-view-type-of-"+CG_VIEW_TX_HASH);
    if (select) {
        for (var key in CG_VIEW_TYPES) {
            if (CG_VIEW_TYPES.hasOwnProperty(key)) {
                if (CG_VIEW_TYPES[key] === select.options[select.selectedIndex].value) {
                    if (key.length > 0) type = key;
                    break;
                }
            }
        }
    }
    if (type !== null) btn_open.disabled  = true;
    else CG_STATUS.push("!"+CG_TXT_VIEW_OPEN_FAIL[CG_LANGUAGE]);
    cg_main_set_hash({tx_type : type});
}

function cg_button_click_view_close() {
    var btn_close = document.getElementById("cg-view-btn-close");
    btn_close.disabled = true;
    cg_main_set_hash({tx_type : null});
}

function cg_view_get_mimetype(ext) {
    if (ext === null) return CG_VIEW_TYPES[""];
    ext = ext.toLowerCase();
    if (ext in CG_VIEW_TYPES) return CG_VIEW_TYPES[ext];
    else return CG_VIEW_TYPES[""];
}

function cg_view_do() {
    if (CG_VIEW_TX_DONE === CG_VIEW_TX_HASH
    &&  (CG_VIEW_TX_DONE_TYPE === CG_VIEW_TX_TYPE || CG_VIEW_TX_TYPE === null)) {
        CG_VIEW_DOING = false;
        CG_VIEW_DONE  = true;
        return;
    }

    var head = document.getElementById("cg-view-head");
    var body = document.getElementById("cg-view-body");

    while (head.hasChildNodes()) head.removeChild(head.lastChild);
    while (body.hasChildNodes()) body.removeChild(body.lastChild);

    var txhash = CG_VIEW_TX_HASH;
    var txtype = CG_VIEW_TX_TYPE;
    var api = CG_READ_API[CG_BTC_FORK];
    var link = sprintf(CG_READ_APIS[api].link, txhash);

    CG_STATUS.push(sprintf(CG_TXT_VIEW_LOADING_TX_DATA[CG_LANGUAGE], txhash, CG_READ_APIS[api].domain));
    xmlhttpGet(sprintf(CG_READ_APIS[api].request, txhash), '',
        function(response) {
            if (response === false || response === null) {
                CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_LOADING_TX_DATA_FAIL[CG_LANGUAGE], txhash, CG_READ_APIS[api].domain));
            }
            else {
                var json = JSON.parse(response);
                var fail = true;

                if (typeof json === 'object') {
                    var out_bytes= "";
                    var op_return= "";
                    var timestamp=  0;

                    var extract = window[CG_READ_APIS[api].extract](json);
                    if (extract !== null) {
                        out_bytes = extract[0];
                        op_return = extract[1];
                        timestamp = extract[2];

                        var mimetype = cg_view_get_mimetype(txtype);
                        var head_msgbox = cg_view_create_msgbox(out_bytes, mimetype, false, txhash, timestamp, link);
                        head_msgbox.cg_msgbody.classList.add("cg-view-msgbody");
                        head.appendChild(cg_view_create_wrapper(head_msgbox));

                        if (mimetype !== "application/octet-stream") {
                            var body_msgbox = cg_view_create_msgbox(out_bytes, mimetype, true, txhash, timestamp, link);
                            body_msgbox.cg_msgbody.classList.add("cg-view-msgbody");
                            body_msgbox.cg_msgbody.style.width  = "calc(1.0*(100vh - 22rem))";
                            body_msgbox.cg_msgbody.style.height = "100vh";
                            body.appendChild(cg_view_create_wrapper(body_msgbox));
                            fail = false;
                            CG_VIEW_TX_DONE_TYPE = txtype;
                        }
                        else if (txtype === null) fail = false;
                    }
                }
                if (fail) CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_DECODING_FAIL[CG_LANGUAGE], txhash));
            }
            CG_VIEW_DOING   = false;
            CG_VIEW_DONE    = true;
            CG_VIEW_TX_DONE = txhash;
        }
    );
}

function cg_view_update() {
    var again = false;
    if (CG_VIEW_LOCK || CG_VIEW_DOING) return;

    if (CG_TX_TYPE !== CG_VIEW_TX_TYPE && CG_VIEW_TX_HASH !== null) {
        CG_VIEW_TX_TYPE = CG_TX_TYPE;
        CG_TX_HASH = null;
    }

    if ((CG_VIEW_BODY !== CG_VIEW_BODY_LAST && CG_VIEW_BODY)
    ||  (CG_VIEW_HEAD !== CG_VIEW_HEAD_LAST && CG_VIEW_HEAD)) {
        var main = document.getElementById("cg-view-main");
        CG_VIEW_LOCK = true;
        if (main.classList.contains("disappear")) main.classList.remove("disappear");
        main.classList.add("appear");
        setTimeout(function(){
            CG_VIEW_LOCK = false;
            cg_view_update();
        }, 500);
    }

    if (CG_VIEW_BODY !== CG_VIEW_BODY_LAST) {
        var body = document.getElementById("cg-view-body");
        if (CG_VIEW_BODY) body.style.display = "block";
        else              body.style.display = "none";
        CG_VIEW_BODY_LAST = CG_VIEW_BODY;
    }

    if (CG_VIEW_HEAD !== CG_VIEW_HEAD_LAST) {
        var head = document.getElementById("cg-view-head");
        if (CG_VIEW_HEAD) head.style.display = "block";
        else              head.style.display = "none";
        CG_VIEW_HEAD_LAST = CG_VIEW_HEAD;
    }

    if (!CG_VIEW_HEAD && !CG_VIEW_BODY && CG_VIEW_TX_HASH) {
        if (!CG_VIEW_DONE) {
            CG_VIEW_DOING = true;
            cg_view_do();
            return;
        }
        CG_VIEW_DONE = false;
        var btn_open  = document.getElementById("cg-view-btn-open");
        var btn_close = document.getElementById("cg-view-btn-close");
        btn_open.disabled  = false;
        btn_close.disabled = false;

        var btns = document.getElementById("cg-view-btns");
        if (!btns.classList.contains("appear")) btns.classList.add("appear");

        if (CG_VIEW_TX_TYPE !== null) {
            CG_VIEW_BODY = true;
            btn_close.style.display = "inline-block";
            btn_open.style.display = "none";
        }
        else {
            CG_VIEW_HEAD = true;
            btn_close.style.display = "none";
            btn_open.style.display = "inline-block";
        }
        again = true;
    }

    if (CG_TX_HASH === CG_VIEW_TX_HASH) return cg_view_update_end(again);

    if (CG_TX_HASH !== CG_VIEW_TX_HASH
    ||  CG_TX_TYPE !== CG_VIEW_TX_TYPE) {
        CG_VIEW_TX_HASH = CG_TX_HASH;
        CG_VIEW_TX_TYPE = CG_TX_TYPE;
        CG_VIEW_HEAD = false;
        CG_VIEW_BODY = false;
        var btn_open  = document.getElementById("cg-view-btn-open");
        var btn_close = document.getElementById("cg-view-btn-close");
        btn_open.disabled  = true;
        btn_close.disabled = true;

        var main = document.getElementById("cg-view-main");
        CG_VIEW_LOCK = true;
        if (main.classList.contains("appear")) main.classList.remove("appear");
        main.classList.add("disappear");
        setTimeout(function(){
            CG_VIEW_LOCK = false;
            cg_view_update();
        }, 500);
        return cg_view_update_end(again);
    }


    return cg_view_update_end(again);
}

function cg_view_create_msgbox(out_bytes, mimetype, open, txhash, timestamp, link) {
    txhash    = typeof txhash    !== 'undefined' ? txhash    : (null);
    timestamp = typeof timestamp !== 'undefined' ? timestamp : (null);
    var msgbox     = document.createElement("DIV");
    var msgheader  = document.createElement("DIV");
    var msgheaderL = document.createElement("DIV");
    var msgheaderR = document.createElement("DIV");
    var msgbody    = document.createElement("PRE");
    var msgfooter  = document.createElement("DIV");
    var msgfooterC = document.createElement("DIV");

    var t_txid = document.createTextNode(txhash);
    var a_txid = document.createElement("a");
    a_txid.appendChild(t_txid);
    a_txid.title = CG_TXT_READ_TRANSACTION_DETAILS[CG_LANGUAGE];
    a_txid.href  = link;
    a_txid.target= "_blank";
    msgfooterC.appendChild(a_txid)

    if (timestamp !== null) msgheaderR.appendChild(document.createTextNode(timeConverter(timestamp)));

    msgheader.appendChild(msgheaderL);
    msgheader.appendChild(msgheaderR);
    msgfooter.appendChild(msgfooterC);

    msgbox.appendChild(msgheader);
    msgbox.appendChild(msgbody);
    msgbox.appendChild(msgfooter);

    msgheader.classList.add("cg-msgheader");
    msgheaderL.classList.add("cg-msgheader-left");
    msgheaderR.classList.add("cg-msgheader-right");
    msgfooter.classList.add("cg-msgfooter");
    msgfooterC.classList.add("cg-msgfooter-content");
    msgbody.classList.add("cg-msgbody");
    msgbox.classList.add("cg-msgbox");
    msgbox.classList.add("cg-msgbox-selected");
    msgbox.classList.add("cg-borderbox");

    var msg = "";
    var fsz = is_blockchain_file(out_bytes);
    var blockchain_file = null;
    var filehash = null;
    if (fsz > 0) {
        blockchain_file = out_bytes.substr(0, fsz);
        var comment_start = fsz;
        var comment_mod   = fsz % 20;
        if (comment_mod !== 0) {
            comment_start+= (20-comment_mod);
        }

        filehash = out_bytes.slice(comment_start, comment_start + 20);
        filehash = Bitcoin.createAddressFromText(filehash);
        out_bytes = out_bytes.slice(comment_start + 20); // 20 to compensate file hash.
    }

    if (open) {
        if (blockchain_file !== null) {
            var wrapper = document.createElement("div");
            wrapper.id = "cg-view-wrapper";

            var obj = null;
            if (mimetype === "application/pdf") {
                var b64Data = btoa(blockchain_file);
                obj = document.createElement('object');
                obj.id = "cg-view-object";
                obj.type = mimetype;
                obj.data = "data:"+mimetype+";base64,"+b64Data;
                msgbody.style.padding="0";
            }
            else if (mimetype.indexOf("image/") === 0) {
                var b64Data = btoa(blockchain_file);
                obj = document.createElement('img');
                obj.id = "cg-view-object";
                obj.type = mimetype;
                obj.src = "data:"+mimetype+";base64,"+b64Data;
                msgbody.style.padding="0";
            }
            else {
                var type = mimetype;
                if (type.indexOf("text/") === 0
                ||  type.indexOf("application/pgp") === 0) type = "text/plain";
                var utf8 = decode_utf8(blockchain_file);
                var b64Data = encode_base64(utf8);
                obj = document.createElement('iframe');
                obj.id = "cg-view-object";
                obj.src = "data:"+type+";charset=utf8;base64,"+b64Data;
                obj.sandbox = '';
                if (mimetype === "text/markdown") {
                    var data_obj = {
                        text: utf8,
                        mode: "markdown",
                        context: "none"
                    }
                    var json_str = JSON.stringify(data_obj);
                    xmlhttpPost('https://api.github.com/markdown', json_str,
                        function(response) {
                            if (response === false || response === null) return;
                            var b64 = encode_base64(response);
                            obj.src = "data:text/html;charset=utf8;base64,"+b64;
                        }
                    );
                }
            }
            obj.classList.add("cg-borderbox");

            wrapper.appendChild(obj);
            msgbody.appendChild(wrapper);
            msgbody.style.overflow="hidden";
        }
    }
    else {
        var span = document.createElement('span');
        span.appendChild(document.createTextNode("("+CG_TXT_READ_MSG_NOT_DECODED_YET[CG_LANGUAGE]+")"));
        span.classList.add("cg-msgspan");
        msgbody.appendChild(span);

        var msg_utf8  = decode_utf8(out_bytes);
        var msg_ascii = decode_ascii(out_bytes);

        var len_utf8 = msg_utf8.length;
        var len_ascii= msg_ascii.length;
             if (len_utf8 <=        1) msg = msg_ascii;
        else if (len_utf8 < len_ascii) msg = msg_ascii;
        else                           msg = msg_utf8;

        var txt = msg;
        processedTxt = processColours(txt);

        while (span.hasChildNodes()) span.removeChild(span.lastChild);

        for (var i = 0; i < processedTxt.length; i++) {
            span.appendChild(processedTxt[i])
        }

        var isRTL = checkRTL(txt);
        var dir = isRTL ? 'RTL' : 'LTR';
        if(dir === 'RTL') msgbody.classList.add("cg-msgbody-rtl");

        if (blockchain_file !== null) {
            var file_table = cg_read_create_filetable(blockchain_file, mimetype, filehash, fsz, (txhash !== null ? "cg-view-type-of-"+txhash : null));
            file_table.classList.add("cg-read-filetable");
            msgbody.insertBefore(file_table, span);
            msgbody.insertBefore(document.createElement("BR"), span);
        }
    }

    if (isOverflowed(msgbody)) {
        msgbody.classList.add("cg-msgbody-tiny");
    }

    msgbox.style.backgroundColor="transparent";
    msgbox.cg_msgbody = msgbody;
    return msgbox;
}

function cg_view_create_wrapper(child) {
    var boxarea = document.createElement("div");
    boxarea.style.height="100%";
    boxarea.style.width="100%";
    boxarea.style.overflow="hidden";
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

    wrapper.appendChild(child);
    cell.appendChild(wrapper);
    table.appendChild(cell);
    boxarea.appendChild(table);
    return boxarea;
}

