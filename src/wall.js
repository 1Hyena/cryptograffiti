function cg_construct_wall(main) {
    var tab = cg_init_tab(main, 'cg-tab-wall');
    if (tab === null) return;

    tab["txs"] = {};
    tab["loading_txs"] = 0;
    tab["last_update"] = 0;
    tab["scrolled"] = false;
    tab["scrolled_bottom"] = false;
    tab["scrolled_top"] = false;

    var headbuf = document.createElement("div");
    var bodybuf = document.createElement("div");
    var tailbuf = document.createElement("div");

    headbuf.id = "cg-wall-headbuf";
    bodybuf.id = "cg-wall-bodybuf";
    tailbuf.id = "cg-wall-tailbuf";

    tab.element.addEventListener(
        'scroll',
        function(e) {
            var call_step = false;
            tab.scrolled = true;

            if (cg_wall_scrolled_bottom()) {
                if (tab.scrolled_bottom === false) {
                    tab.scrolled_bottom = true;
                    call_step = true;
                }
            }
            else {
                tab.scrolled_bottom = false;
            }

            if (cg_wall_scrolled_top()) {
                if (tab.scrolled_top === false) {
                    tab.scrolled_top = true;
                    call_step = true;
                }
            }
            else {
                tab.scrolled_top = false;
            }

            if (call_step === true) {
                setTimeout(
                    function(){
                        tab.last_update = 0;

                        if (tab.loading_txs >= 0) tab.loading_txs = 0;

                        cg_step_wall(tab);
                    }, 0
                );
            }
        }
    );

    tab.element.appendChild(headbuf);
    tab.element.appendChild(bodybuf);
    tab.element.appendChild(tailbuf);

    tab.element.classList.add("cg-tab-wall-setup");
}

function cg_wall_refresh_visible(tab) {
    var bodybuf = document.getElementById("cg-wall-bodybuf");
    var contents = bodybuf.children;

    for (var i=0; i<contents.length; ++i) {
        var txdiv = contents[i];

        if (!txdiv.classList.contains("cg-wall-txdiv")) continue;

        if (is_visible(tab.element, txdiv, false)) {
            txdiv.classList.add("cg-wall-txdiv-visible");
        }
        else {
            txdiv.classList.remove("cg-wall-txdiv-visible");
        }
    }
}

function cg_step_wall(tab) {
    var timestamp = Math.floor(Date.now() / 1000);

    if (timestamp - tab.last_update < 1) return;

    tab.last_update = timestamp;

    if (cg_get_global("constants") === null) return;

    if (tab.loading_txs >= 0
    &&  timestamp - tab.loading_txs >= 3) {
        tab.loading_txs = -1;
        cg_wall_get_txs(tab);
    }

    if (tab.scrolled) {
        tab.scrolled = false;
        cg_wall_refresh_visible(tab);
    }

    for (var key in tab.txs) {
        if (!tab.txs.hasOwnProperty(key)) continue;

        var txdiv = document.getElementById(key);

        if (txdiv == null) {
            var tx = tab.txs[key];

            txdiv = document.createElement("div");
            txdiv.id = key;
            txdiv.classList.add("cg-wall-txdiv");

            if (tx.txtime === null) {
                txdiv.setAttribute("data-timestamp", timestamp);
            }
            else {
                txdiv.setAttribute("data-timestamp", tx.txtime);
            }

            txdiv.setAttribute("data-nr", tx.nr);

            for (var i=0; i<tab.txs[key].graffiti.length; ++i) {
                var gdata = tab.txs[key].graffiti[i];
                var graffiti = document.createElement("div");
                graffiti.classList.add("cg-wall-graffiti");

                graffiti.setAttribute("data-location",  gdata.location);
                graffiti.setAttribute("data-fsize",     gdata.fsize);
                graffiti.setAttribute("data-offset",    gdata.offset);
                graffiti.setAttribute("data-mimetype",  gdata.mimetype);
                graffiti.setAttribute("data-hash",      gdata.hash);
                graffiti.setAttribute("data-timestamp", "0");

                txdiv.appendChild(graffiti);
            }

            cg_wall_add(tab, txdiv);
        }
    }

    tab.txs = {};

    var refresh_visible = false;

    while (cg_wall_refresh_buffers(tab) > 0) {
        refresh_visible = true;
    }

    if (refresh_visible) cg_wall_refresh_visible(tab);

    cg_wall_resolve_rawtxs(tab);
}

function cg_wall_add(tab, txdiv) {
    var headbuf = document.getElementById("cg-wall-headbuf");
    var bodybuf = document.getElementById("cg-wall-bodybuf");
    var tailbuf = document.getElementById("cg-wall-tailbuf");

    var newest = bodybuf.firstChild;
    var oldest = bodybuf.lastChild;

    if (newest == null && oldest == null) {
        bodybuf.appendChild(txdiv);
        cg_wall_refresh_visible(tab);
        return;
    }

    var newest_timestamp = parseInt(newest.getAttribute("data-timestamp"));
    var newest_nr        = parseInt(newest.getAttribute("data-nr"));
    var oldest_timestamp = parseInt(oldest.getAttribute("data-timestamp"));
    var oldest_nr        = parseInt(oldest.getAttribute("data-nr"));
    var timestamp        = parseInt(txdiv.getAttribute("data-timestamp"));
    var nr               = parseInt(txdiv.getAttribute("data-nr"));

    var send_to = null;

         if (timestamp > newest_timestamp) send_to = headbuf;
    else if (timestamp < oldest_timestamp) send_to = tailbuf;
    else if (nr > newest_nr) send_to = headbuf;
    else if (nr < oldest_nr) send_to = tailbuf;
    else {
        // TODO: Send to either head or tail depending on the position of the
        // scrollbar.
        if (Math.random() < 0.5) send_to = headbuf;
        else                     send_to = tailbuf;
    }

    send_to.appendChild(txdiv);
}

function cg_wall_txdiv_is_ready(txdiv) {
    var contents = txdiv.children;

    for (var i=0; i<contents.length; ++i) {
        var content = contents[i];

        if (!content.classList.contains("cg-wall-graffiti")) continue;

        if (content.classList.contains("cg-wall-graffiti-loading")
        ||  content.classList.contains("cg-wall-graffiti-decoding")
        ||  content.getAttribute("data-timestamp") === "0") {
            return false;
        }
    }

    return true;
}

function cg_wall_refresh_buffers(tab) {
    var updated = 0;

    var headbuf = document.getElementById("cg-wall-headbuf");
    var bodybuf = document.getElementById("cg-wall-bodybuf");
    var tailbuf = document.getElementById("cg-wall-tailbuf");

    var add_to_body_head = [];
    var add_to_body_tail = [];
    var add_to_head = [];
    var add_to_tail = [];

    var last_offset = 0;

    var news = headbuf.children;
    for (var i=0; i<news.length; ++i) {
        var txdiv = news[i];

        if (!txdiv.classList.contains("cg-wall-txdiv")) continue;

        if (!cg_wall_txdiv_is_ready(txdiv)) break;

        if (i === 0) {
            last_offset = txdiv.offsetTop;
            continue;
        }

        if (txdiv.offsetTop > last_offset) {
            for (var j=0; j<i; ++j) {
                add_to_body_head.push(news[j]);
            }
            for (var j=i; j<news.length; ++j) {
                add_to_head.push(news[j]);
            }
            break;
        }
    }

    if (add_to_body_head.length > 0) {
        while (headbuf.hasChildNodes()) {
            headbuf.removeChild(headbuf.lastChild);
        }

        if (bodybuf.hasChildNodes()) {
            bodybuf.insertBefore(
                document.createElement("hr"), bodybuf.firstChild
            );
        }

        while (add_to_body_head.length > 0) {
            bodybuf.insertBefore(add_to_body_head.shift(), bodybuf.firstChild);
        }

        while (add_to_head.length > 0) {
            headbuf.appendChild(add_to_head.shift());
        }
    }

    var olds = tailbuf.children;
    for (var i=0; i<olds.length; ++i) {
        var txdiv = olds[i];

        if (!txdiv.classList.contains("cg-wall-txdiv")) continue;

        if (!cg_wall_txdiv_is_ready(txdiv)) break;

        if (i === 0) {
            last_offset = txdiv.offsetTop;
            continue;
        }

        if (txdiv.offsetTop > last_offset) {
            for (var j=0; j<i; ++j) {
                add_to_body_tail.push(olds[j]);
            }
            for (var j=i; j<olds.length; ++j) {
                add_to_tail.push(olds[j]);
            }
            break;
        }
    }

    if (add_to_body_tail.length > 0) {
        while (tailbuf.hasChildNodes()) {
            tailbuf.removeChild(tailbuf.lastChild);
        }

        if (bodybuf.hasChildNodes()) {
            bodybuf.appendChild(document.createElement("hr"));
        }

        while (add_to_body_tail.length > 0) {
            bodybuf.appendChild(add_to_body_tail.shift());
            ++updated;
        }

        while (add_to_tail.length > 0) {
            tailbuf.appendChild(add_to_tail.shift());
            ++updated;
        }
    }

    return updated;
}

function cg_wall_resolve_rawtxs(tab) {
    var resolving = document.getElementsByClassName("cg-wall-graffiti-loading");
    if (resolving.length !== 0) return;

    var txdivs = [];

    var collection = document.getElementsByClassName("cg-wall-txdiv-visible");

    for (var i = 0; i < collection.length; i++) {
        txdivs.push(collection[i]);
    }

    var buffers = [];

    if (cg_wall_scrolled_top()) {
        buffers.push(document.getElementById("cg-wall-headbuf"));
    }

    if (cg_wall_scrolled_bottom()) {
        buffers.push(document.getElementById("cg-wall-tailbuf"));
    }

    while (buffers.length > 0) {
        var buffer = buffers.shift();
        var children = buffer.children;

        for (var i=0; i<children.length; ++i) {
            var txdiv = children[i];
            if (!txdiv.classList.contains("cg-wall-txdiv")) continue;

            txdivs.push(txdiv);
        }
    }

    var max_requests = 16;

    while (txdivs.length > 0) {
        var txdiv = txdivs.shift();
        var graffiti = txdiv.children;

        for (var j=0; j<graffiti.length; ++j) {
            var gdiv = graffiti[j];

            if (gdiv.classList.contains("cg-wall-graffiti")
            && !gdiv.classList.contains("cg-wall-graffiti-loading")
            && !gdiv.classList.contains("cg-wall-graffiti-decoding")
            && !gdiv.classList.contains("cg-wall-graffiti-decoded")) {
                var timestamp = parseInt(gdiv.getAttribute("data-timestamp"));

                // TODO: progressively increase the delay here after every try.
                if (get_timestamp_age(timestamp) < 3) continue;

                gdiv.classList.add("cg-wall-graffiti-loading");

                cg_wall_get_rawtx_range(
                    tab, txdiv.id,
                    parseInt(gdiv.getAttribute("data-offset")),
                    parseInt(gdiv.getAttribute("data-fsize")),
                    gdiv.getAttribute("data-hash")
                );

                if (--max_requests <= 0) return;
            }
        }
    }
}

function cg_wall_decode_graffiti(tab, txid, hash, data) {
    var timestamp = Math.floor(Date.now() / 1000);
    var txdiv = document.getElementById(txid);
    var children = txdiv.children;

    for (var i=0; i<children.length; ++i) {
        var graffiti = children[i];

        if (graffiti.hasChildNodes()) continue;
        if (graffiti.getAttribute("data-hash") !== hash) continue;

        var location = graffiti.getAttribute("data-location");
        var mimetype = graffiti.getAttribute("data-mimetype");

        graffiti.setAttribute("data-timestamp", timestamp);

        if (data === null || data === false) {
            graffiti.classList.remove("cg-wall-graffiti-decoding");
            continue;
        }

        if (location === "NULL_DATA"
        &&  mimetype.indexOf("image/") === 0) {
            var media = document.createElement("DIV");
            media.classList.add("cg-wall-media");

            var b64imgData = arrayBufferToBase64(data);
            var img = new Image();
            img.src = "data:"+mimetype+";base64,"+b64imgData;

            media.appendChild(img);
            graffiti.appendChild(media);

            graffiti.classList.remove("cg-wall-graffiti-decoding");
            graffiti.classList.add("cg-wall-graffiti-decoded");
        }
    }
}

function cg_wall_get_txs(tab) {
    var data_obj = {
        count : ""+Math.min(cg_get_global("constants").TXS_PER_QUERY, 32)
    };

    var bodybuf = document.getElementById("cg-wall-bodybuf");
    if (!bodybuf.hasChildNodes()) {
        data_obj.count = "1";
    }

    if (cg_wall_should_load_old_txs()) {
        data_obj["back"] = "1";

        var nr = cg_wall_get_smallest_tx_nr();
        if (nr !== null) data_obj["nr"] = ""+nr;
    }
    else if (cg_wall_should_load_new_txs()) {
        data_obj["back"] = "0";

        var nr = cg_wall_get_greatest_tx_nr();
        if (nr !== null) data_obj["nr"] = ""+nr;
    }
    else {
        tab.loading_txs = 0;
        return;
    }

    var json_str = encodeURIComponent(JSON.stringify(data_obj));

    cg_push_status(cg_translate(CG_TXT_WALL_LOADING_TX_METADATA));

    xmlhttpPost(cg_get_global("api_url"), 'fun=get_txs&data='+json_str,
        function(response) {
            tab.loading_txs = Math.floor(Date.now() / 1000);

            var status = "";

            if (response === false) {
                status = cg_translate(CG_TXT_WALL_LOADING_TX_METADATA_ERROR);
            }
            else if (response === null ) {
                status = cg_translate(CG_TXT_WALL_LOADING_TX_METADATA_TIMEOUT);
            }
            else {
                json = JSON.parse(response);
                if ("txs" in json) {
                    for (var i=0; i<json.txs.length; ++i) {
                        tab.txs[json.txs[i].txid] = json.txs[i];
                    }

                    if (tab.scrolled_bottom || tab.scrolled_top) {
                        setTimeout(function(){
                            tab.last_update = 0;
                            cg_step_wall(tab);
                        }, 0);
                    }
                }
                else {
                    cg_handle_error(json);
                }
            }

            if (status.length > 0) cg_push_status(status);
        }
    );

    return;
}

function cg_wall_find_graffiti(txid, hash) {
    var txdiv = document.getElementById(txid);
    var children = txdiv.children;

    for (var i=0; i<children.length; ++i) {
        var graffiti = children[i];

        if (graffiti.getAttribute("data-hash") === hash) return graffiti;
    }

    return null;
}

function cg_wall_get_rawtx_range(tab, txid, offset, fsize, hash) {
    cg_push_status(cg_translate(CG_TXT_WALL_LOADING_RAWTX_SEGMENT));

    xmlhttpGet(
        "https://cryptograffiti.info/rawtx/"+txid, "",
        function(response) {
            var status = "";
            var graffiti = cg_wall_find_graffiti(txid, hash);

            graffiti.classList.remove("cg-wall-graffiti-loading");
            graffiti.classList.add("cg-wall-graffiti-decoding");

            if (response === false) {
                status = cg_translate(CG_TXT_WALL_LOADING_RAWTX_SEGMENT_ERROR);
            }
            else if (response === null ) {
                status = cg_translate(
                    CG_TXT_WALL_LOADING_RAWTX_SEGMENT_TIMEOUT
                );
            }

            cg_wall_decode_graffiti(tab, txid, hash, response);

            if (status.length > 0) cg_push_status(status);
        }, 20000, { offset: offset, length: fsize }
    );

    return;
}

function cg_wall_scrolled_top() {
    var wall = document.getElementById("cg-tab-wall");
    return Math.ceil(wall.scrollTop) === 0;
}

function cg_wall_scrolled_bottom() {
    var wall = document.getElementById("cg-tab-wall");
    return Math.ceil(wall.scrollHeight - wall.scrollTop) === wall.clientHeight;
}

function cg_wall_head_clogged() {
    var headbuf = document.getElementById("cg-wall-headbuf");

    var last_offset = 0;

    var news = headbuf.children;
    for (var i=0; i<news.length; ++i) {
        var txdiv = news[i];

        if (i === 0) {
            last_offset = txdiv.offsetTop;
            continue;
        }

        if (txdiv.offsetTop > last_offset) {
            return true;
        }
    }

    return false;
}

function cg_wall_tail_clogged() {
    var tailbuf = document.getElementById("cg-wall-tailbuf");

    var last_offset = 0;

    var olds = tailbuf.children;
    for (var i=0; i<olds.length; ++i) {
        var txdiv = olds[i];

        if (i === 0) {
            last_offset = txdiv.offsetTop;
            continue;
        }

        if (txdiv.offsetTop > last_offset) {
            return true;
        }
    }

    return false;
}

function cg_wall_should_load_new_txs() {
    return cg_wall_scrolled_top() && !cg_wall_head_clogged();
}

function cg_wall_should_load_old_txs() {
    return cg_wall_scrolled_bottom() && !cg_wall_tail_clogged();
}

function cg_wall_get_greatest_tx_nr() {
    var nr = null;
    var containers = [
        "cg-wall-headbuf",
        "cg-wall-tailbuf",
        "cg-wall-bodybuf"
    ];

    for (var i=0; i<containers.length; ++i) {
        var container = document.getElementById(containers[i]);

        var contents = container.children;
        for (var j=0; j<contents.length; j++) {
            var content = contents[j];

            if (!content.classList.contains("cg-wall-txdiv")) continue;

            var txnr = parseInt(content.getAttribute("data-nr"));
            if (nr === null) {
                nr = txnr;
            }
            else if (txnr > nr) {
                nr = txnr;
            }
        }
    }

    return nr;
}

function cg_wall_get_smallest_tx_nr() {
    var nr = null;
    var containers = [
        "cg-wall-headbuf",
        "cg-wall-tailbuf",
        "cg-wall-bodybuf"
    ];

    for (var i=0; i<containers.length; ++i) {
        var container = document.getElementById(containers[i]);

        var contents = container.children;
        for (var j=0; j<contents.length; j++) {
            var content = contents[j];

            if (!content.classList.contains("cg-wall-txdiv")) continue;

            var txnr = parseInt(content.getAttribute("data-nr"));
            if (nr === null) {
                nr = txnr;
            }
            else if (txnr < nr) {
                nr = txnr;
            }
        }
    }

    return nr;
}
