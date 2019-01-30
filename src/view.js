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
    cg_main_set_hash({tx_hash : CG_VIEW_TX_HASH+(type === null ? "" : "."+type)});
}

function cg_button_click_view_close() {
    var btn_close = document.getElementById("cg-view-btn-close");
    btn_close.disabled = true;
    cg_main_set_hash({tx_hash : CG_VIEW_TX_HASH});
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

    var apis = [];
    var api = null;
    for (var i=0, sz = CG_READ_APIS.length; i<sz; i++) {
        if (CG_READ_APIS[i].delay ===  0) apis.push(i);
    }

    if (apis.length > 0) {
        apis = shuffle(apis);
        api = apis[0];
    }

    if (api === null) {
        CG_VIEW_DOING = false;
        CG_VIEW_DONE  = false;
        return;
    }

    var link = sprintf(CG_READ_APIS[api].link, txhash);

    CG_STATUS.push(sprintf(CG_TXT_VIEW_LOADING_TX_DATA[CG_LANGUAGE], txhash, CG_READ_APIS[api].domain));
    xmlhttpGet(sprintf(CG_READ_APIS[api].request, txhash), '',
        function(response) {
            var fail = true;

            if (response === false || response === null) {
                CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_LOADING_TX_DATA_FAIL[CG_LANGUAGE], txhash, CG_READ_APIS[api].domain));
            }
            else {
                var json = JSON.parse(response);

                if (typeof json === 'object') {
                    var extract = window[CG_READ_APIS[api].extract](json);
                    if (extract !== null) {
                        var out_bytes = extract[0];
                        var op_return = extract[1];
                        var timestamp = extract[2];

                        var mimetype = cg_view_get_mimetype(txtype);
                        var head_msgbox = cg_view_create_msgbox(out_bytes, op_return, mimetype, false, txhash, timestamp, link);
                        head_msgbox.cg_msgbody.classList.add("cg-view-msgbody");
                        head.appendChild(cg_view_create_wrapper(head_msgbox));

                        if (mimetype !== "application/octet-stream") {
                            var body_msgbox = cg_view_create_msgbox(out_bytes, op_return, mimetype, true, txhash, timestamp, link);
                            body_msgbox.cg_msgbody.classList.add("cg-view-msgbody");
                            body_msgbox.cg_msgbody.style.width = "100vw";
                            body_msgbox.cg_msgbody.style.height= "100vh";
                            body.appendChild(cg_view_create_wrapper(body_msgbox));
                            fail = false;
                            CG_VIEW_TX_DONE_TYPE = txtype;
                        }
                        else if (txtype === null) fail = false;
                    }
                }

                if (fail) {
                    CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_DECODING_FAIL[CG_LANGUAGE], txhash));
                }
            }

            if (fail) {
                CG_READ_APIS[api].down = true;
                CG_READ_APIS[api].fails++;
                CG_READ_APIS[api].delay = CG_READ_APIS[api].fails * CG_READ_APIS[api].max_delay;
                CG_VIEW_DOING   = false;
                CG_VIEW_DONE    = false;
                CG_VIEW_TX_DONE = null;
            }
            else {
                CG_VIEW_DOING   = false;
                CG_VIEW_DONE    = true;
                CG_VIEW_TX_DONE = txhash;
            }
        }
    );
}

function cg_view_update() {
    var again = false;
    if (CG_VIEW_LOCK || CG_VIEW_DOING) return;

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

    var msgbox = document.getElementById("cg-view-msgbox");
    if (msgbox !== null && CG_VIEW_TX_HASH !== null) {
        cg_view_get_msg_metadata(msgbox, CG_VIEW_TX_HASH);
    }

    return cg_view_update_end(again);
}

function cg_view_get_msg_metadata(msgbox, txhash) {
    var old_hash = msgbox.getAttribute("data-txhash");
    if (old_hash !== txhash && old_hash.length > 0) {
        msgbox.setAttribute("data-age",   "0");
        msgbox.setAttribute("data-txhash", "");
        return;
    }

    var age_text = msgbox.getAttribute("data-age");

    if (age_text.length === 0) return;

    var age = parseInt(age_text, 10);
    msgbox.setAttribute("data-age", (age+1).toString(10));

    if (age !== 0) return;

    var txs = [];
    txs.push(txhash);

    var data_obj = {
        txids: txs
    }
    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    CG_STATUS.push(sprintf(CG_TXT_VIEW_LOADING_TX_METADATA[CG_LANGUAGE], txhash));

    xmlhttpPost(CG_API, 'fun=get_msg_metadata&data='+json_str,
        function(response) {
            var status = "???";
            var box = document.getElementById("cg-view-msgbox");
            var footerR = document.getElementById("cg-view-msgfooter-right");
            var headerL = document.getElementById("cg-view-msgheader-left");
            if (box !== null) {
                // By default we will retry in 30 seconds.
                box.setAttribute("data-age", "-30");
            }

                 if (response === false) status = CG_TXT_READ_LOADING_ERROR[CG_LANGUAGE];
            else if (response === null ) status = CG_TXT_READ_LOADING_TIMEOUT[CG_LANGUAGE];
            else {
                json = JSON.parse(response);
                if ("payload" in json
                &&  txs.length <= json.payload.length
                &&  txs.length >= 1
                &&  json.payload[0] !== null
                &&  "nr" in json.payload[0]
                &&  json.payload[0].nr !== null) {
                    status = sprintf(CG_TXT_VIEW_LOADING_TX_METADATA_SUCCESS[CG_LANGUAGE], txs[0]);

                    if (box !== null && footerR !== null) {
                        // Success! Now let's stop counting updates...
                        box.setAttribute("data-age", "");

                        while (footerR.hasChildNodes()) footerR.removeChild(footerR.lastChild);
                        while (headerL.hasChildNodes()) headerL.removeChild(headerL.lastChild);

                        var tx_link = document.createElement("a");
                        var tx_text = document.createTextNode("#"+json.payload[0].nr);
                        var tx_icon = null;
                        if ("amount" in json.payload[0]
                        &&  parseInt(json.payload[0].amount, 10) > 0) {
                            tx_icon     = document.createElement("img");
                            tx_icon.src = document.getElementById("gfx_icon").src;
                            tx_icon.title = CG_TXT_READ_MSG_FLAG_CRYPTOGRAFFITI[CG_LANGUAGE];
                            tx_icon.classList.add("cg-msgbox-stamp");
                        }

                        tx_link.title = CG_TXT_READ_LINK_TO_THIS_MSG[CG_LANGUAGE];
                        tx_link.href  = "#"+json.payload[0].nr;
                        tx_link.onclick=function(){fade_out(); setTimeout(function(){location.reload();}, 500); return true;};
                        tx_link.appendChild(tx_text);

                        headerL.appendChild(document.createElement("span"));
                        headerL.appendChild(tx_link);

                        footerR.appendChild(document.createElement("span"));
                        if (tx_icon !== null) footerR.append(tx_icon);

                        var sel = document.getElementById("cg-view-type-of-"+txs[0]);
                        if (sel !== null) {
                            var opt;
                            for (var i = 0, len = sel.options.length; i < len; i++ ) {
                                opt = sel.options[i];
                                opt.selected = (opt.value === json.payload[0].type);
                            }
                        }
                    }
                }
                else {
                    status = CG_TXT_READ_INVALID_RESPONSE[CG_LANGUAGE];
                    cg_handle_error(json);
                }
            }

            CG_STATUS.push(status);
        }
    );
}

function cg_view_create_msgbox(out_bytes, op_return, mimetype, open, txhash, timestamp, link) {
    txhash    = typeof txhash    !== 'undefined' ? txhash    : (null);
    timestamp = typeof timestamp !== 'undefined' ? timestamp : (null);
    var msgbox     = document.createElement("DIV");
    var msgheader  = document.createElement("DIV");
    var msgheaderL = document.createElement("DIV");
    var msgheaderR = document.createElement("DIV");
    var msgbody    = document.createElement("PRE");
    var msgfooter  = document.createElement("DIV");
    var msgfooterL = document.createElement("DIV");
    var msgfooterR = document.createElement("DIV");

    var t_txid = document.createTextNode(txhash);
    var a_txid = document.createElement("a");
    a_txid.appendChild(t_txid);
    a_txid.title = CG_TXT_READ_TRANSACTION_DETAILS[CG_LANGUAGE];
    a_txid.href  = link;
    a_txid.target= "_blank";
    msgfooterL.appendChild(a_txid)

    if (timestamp !== null && timestamp !== 0) {
        msgheaderR.appendChild(document.createTextNode(timeConverter(timestamp)));
    }

    msgheader.appendChild(msgheaderL);
    msgheader.appendChild(msgheaderR);
    msgfooter.appendChild(msgfooterL);
    msgfooter.appendChild(msgfooterR);

    msgbox.appendChild(msgheader);
    msgbox.appendChild(msgbody);
    msgbox.appendChild(msgfooter);

    msgheader.classList.add("cg-msgheader");
    msgheaderL.classList.add("cg-msgheader-left");
    msgheaderR.classList.add("cg-msgheader-right");
    msgfooter.classList.add("cg-msgfooter");
    msgfooterL.classList.add("cg-msgfooter-left");
    msgfooterR.classList.add("cg-msgfooter-right");
    msgbody.classList.add("cg-msgbody");
    msgbox.classList.add("cg-msgbox");
    msgbox.classList.add("cg-msgbox-selected");
    msgbox.classList.add("cg-borderbox");
    msgbox.setAttribute("data-age", "0");
    msgbox.setAttribute("data-txhash", "");
    msgbox.id = "cg-view-msgbox";
    msgheaderL.id = "cg-view-msgheader-left";
    msgfooterR.id = "cg-view-msgfooter-right";

    var msg = "";
    var fsz = is_blockchain_file(out_bytes, null);
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

        var op_return_msg = decode_opreturn(op_return);
        if (op_return_msg.length >  1) {
            if (msg.length > 1) {msg = msg + "\n";
                msg = msg + "-----BEGIN OP_RETURN MESSAGE BLOCK-----\n"
                          + op_return_msg + "\n----- END OP_RETURN MESSAGE BLOCK -----";
            }
            else msg = op_return_msg;
        }

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

