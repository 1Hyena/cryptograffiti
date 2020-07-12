function cg_construct_wall(main) {
    var tab = cg_init_tab(main, 'cg-tab-wall');
    if (tab === null) return;

    tab["txs"] = {};
    tab["loading_txs"] = 0;
    tab["last_update"] = 0;
    tab["downloading_rawtx"] = 0;

    var headbuf = document.createElement("div");
    var bodybuf = document.createElement("div");
    var tailbuf = document.createElement("div");

    headbuf.id = "cg-wall-headbuf";
    bodybuf.id = "cg-wall-bodybuf";
    tailbuf.id = "cg-wall-tailbuf";

    tab.element.appendChild(headbuf);
    tab.element.appendChild(bodybuf);
    tab.element.appendChild(tailbuf);

    tab.element.classList.add("cg-tab-wall-setup");
}

function cg_step_wall(tab) {
    var timestamp = Math.floor(Date.now() / 1000);

    if (timestamp - tab.last_update < 1) return;

    tab.last_update = timestamp;

    if (cg_get_global("constants") === null) return;

    if (tab.loading_txs >= 0
    &&  timestamp - tab.loading_txs >= 10) {
        tab.loading_txs = -1;
        cg_wall_get_txs(tab);
    }

    for (var key in tab.txs) {
        if (!tab.txs.hasOwnProperty(key)) continue;

        var txdiv = document.getElementById(key);

        if (txdiv == null) {
            var tx = tab.txs[key];

            txdiv = document.createElement("div");
            txdiv.id = key;
            txdiv.classList.add("cg-wall-txdiv");
            txdiv.setAttribute("data-timestamp", tx.nr);

            for (var i=0; i<tab.txs[key].graffiti.length; ++i) {
                var gdata = tab.txs[key].graffiti[i];
                var graffiti = document.createElement("div");
                graffiti.classList.add("cg-wall-graffiti");

                graffiti.setAttribute("location", gdata.location);
                graffiti.setAttribute("fsize",    gdata.fsize);
                graffiti.setAttribute("offset",   gdata.offset);
                graffiti.setAttribute("mimetype", gdata.mimetype);
                graffiti.setAttribute("hash",     gdata.hash);

                txdiv.appendChild(graffiti);
            }

            cg_wall_add(tab, txdiv);
        }
    }

    tab.txs = {};

    cg_wall_refresh_buffers(tab);
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
        return;
    }

    var newest_timestamp = parseInt(newest.getAttribute("data-timestamp"));
    var oldest_timestamp = parseInt(oldest.getAttribute("data-timestamp"));
    var timestamp = parseInt(txdiv.getAttribute("data-timestamp"));

    var send_to = null;

         if (timestamp >= newest_timestamp) send_to = headbuf;
    else if (timestamp <= oldest_timestamp) send_to = tailbuf;
    else {
        // TODO: Send to either head or tail depending on the position of the
        // scrollbar.
        if (Math.random() < 0.5) send_to = headbuf;
        else                     send_to = tailbuf;
    }

    send_to.appendChild(txdiv);
}

function cg_wall_refresh_buffers(tab) {
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

        if (!txdiv.classList.contains("cg-wall-txdiv-decoded")
        &&  !txdiv.classList.contains("cg-wall-txdiv-broken")) break;

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

        if (!txdiv.classList.contains("cg-wall-txdiv-decoded")
        &&  !txdiv.classList.contains("cg-wall-txdiv-broken")) break;

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

        while (add_to_body_tail.length > 0) {
            bodybuf.appendChild(add_to_body_tail.shift());
        }

        while (add_to_tail.length > 0) {
            tailbuf.appendChild(add_to_tail.shift());
        }
    }
}

function cg_wall_resolve_rawtxs(tab) {
    var timestamp = Math.floor(Date.now() / 1000);

    if (tab.downloading_rawtx < 0
    ||  timestamp - tab.downloading_rawtx < 3) {
        return;
    }

    var scan = [
        document.getElementById("cg-wall-bodybuf"),
        document.getElementById("cg-wall-headbuf"),
        document.getElementById("cg-wall-tailbuf"),
    ];

    while (scan.length > 0) {
        var buf = scan.shift();
        var children = buf.children;

        for (var i=0; i<children.length; ++i) {
            var txdiv = children[i];

            if (!txdiv.classList.contains("cg-wall-txdiv-decoded")
            &&  !txdiv.classList.contains("cg-wall-txdiv-broken")) {
                tab.downloading_rawtx = -1;
                cg_wall_get_rawtx(tab, txdiv.id);
                return;
            }
        }
    }
}

function cg_wall_decode_tx(tab, txdiv, rawtx) {
    var children = txdiv.children;

    for (var i=0; i<children.length; ++i) {
        var graffiti = children[i];

        var location = graffiti.getAttribute("location");
        var fsize    = parseInt(graffiti.getAttribute("fsize"), 10);
        var offset   = parseInt(graffiti.getAttribute("offset"), 10);
        var mimetype = graffiti.getAttribute("mimetype");
        var hash     = graffiti.getAttribute("hash");

        if (location === "NULL_DATA"
        &&  mimetype.indexOf("image/") === 0) {
            var n = rawtx.indexOf("006a") + 4;
            var hex = rawtx.substr(n+2*offset, 2*fsize);

            var media = document.createElement("DIV");
            media.classList.add("cg-wall-media");

            var b64imgData = arrayBufferToBase64(hex2binary(hex));
            var img = new Image();
            img.src = "data:"+mimetype+";base64,"+b64imgData;

            media.appendChild(img);
            graffiti.appendChild(media);
        }
    }

    txdiv.classList.add("cg-wall-txdiv-decoded");
    txdiv.classList.remove("cg-wall-txdiv-broken");
}

function cg_wall_get_txs(tab) {
    var data_obj = {
        count : ""+Math.min(cg_get_global("constants").TXS_PER_QUERY, 8)
    };

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

function cg_wall_get_rawtx(tab, txid) {
    cg_push_status(cg_translate(CG_TXT_WALL_LOADING_TX_METADATA));

    xmlhttpGet(
        "https://api.blockchair.com/bitcoin-sv/raw/transaction/"+txid, "",
        function(response) {
            tab.downloading_rawtx = Math.floor(Date.now() / 1000);

            var txdiv = document.getElementById(txid);

            txdiv.classList.add("cg-wall-txdiv-broken");

            var status = "";

            if (response === false) {
                status = cg_translate(CG_TXT_WALL_LOADING_TX_METADATA_ERROR);
            }
            else if (response === null ) {
                status = cg_translate(CG_TXT_WALL_LOADING_TX_METADATA_TIMEOUT);
            }
            else {
                json = JSON.parse(response);
                if ("data" in json
                &&  txid in json.data
                &&  "raw_transaction" in json.data[txid]) {
                    cg_wall_decode_tx(
                        tab, txdiv, json.data[txid].raw_transaction
                    );
                }
                else cg_translate(CG_TXT_WALL_LOADING_TX_METADATA_ERROR);
            }

            if (status.length > 0) cg_push_status(status);
        }
    );

    return;
}
