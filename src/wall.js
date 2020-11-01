function cg_wall_construct(main) {
    var tab = cg_init_tab(main, 'cg-tab-wall');
    if (tab === null) return;

    tab["txs"] = {};
    tab["graffiti"] = {
        data : {},
        order: []
    };
    tab["loading_txs"] = 0;
    tab["last_update"] = 0;
    tab["scrolled"] = false;
    tab["scrolled_bottom"] = false;
    tab["scrolled_top"] = false;
    tab["refresh_visible"] = false;

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

                        cg_wall_step(tab);
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

function cg_wall_step(tab) {
    var timestamp = Math.floor(Date.now() / 1000);
    var forgotten = cg_wall_forget_new_txs(tab) + cg_wall_forget_old_txs(tab);

    if (timestamp - tab.last_update < 1 || forgotten > 0) return;

    tab.last_update = timestamp;

    if (cg_get_global("constants") === null) return;

    if (tab.loading_txs >= 0
    &&  timestamp - tab.loading_txs >= 3
    &&  document.getElementsByClassName("cg-wall-frame-origin").length === 1) {
        tab.loading_txs = -1;
        cg_wall_get_txs(tab);
    }

    if (!is_empty(tab.txs)) {
        cg_wall_import_txs(tab);
    }

    if (tab.scrolled) {
        tab.scrolled = false;
        tab.refresh_visible = true;
    }

    setTimeout(
        function(){
            cg_wall_manage_frames(tab);
        }, 0
    );

    if (tab.refresh_visible) {
        tab.refresh_visible = false;

        setTimeout(
            function(){
                cg_wall_refresh_visible(tab);
            }, 0
        );
    }

    setTimeout(
        function(){
            cg_wall_download_graffiti(tab);
        }, 0
    );
}

function cg_wall_import_txs(tab) {
    for (var key in tab.txs) {
        if (!tab.txs.hasOwnProperty(key)) continue;

        var tx = tab.txs[key];

        for (var i=0; i<tx.graffiti.length; ++i) {
            var graffiti = tx.graffiti[i];

            tab.graffiti.data[""+graffiti.nr] = {
                txid:      key,
                txnr:      parseInt(tx.nr),
                nr:        parseInt(graffiti.nr),
                timestamp: tx.txtime,
                location:  graffiti.location,
                offset:    graffiti.offset,
                fsize:     graffiti.fsize,
                hash:      graffiti.hash,
                mimetype:  graffiti.mimetype,
                cache:     tx.cache
            };
        }
    }

    tab.txs = {};

    if (!is_empty(tab.graffiti.data)) {
        var order = Object.keys(tab.graffiti.data).map(
            function(key) {
                return [key, tab.graffiti.data[key]];
            }
        );

        order.sort(
            function(first, second) {
                var diff = first[1].txnr - second[1].txnr;
                return diff === 0 ? first[1].nr - second[1].nr : diff;
            }
        );

        tab.graffiti.order = [];
        for (var i=0; i<order.length; ++i) {
            tab.graffiti.order.push(order[i][1].nr);
        }

        cg_wall_import_graffiti(tab);
    }
}

function cg_wall_import_graffiti(tab) {
    if (tab.graffiti.order.length === 0) return;

    var origin = document.getElementsByClassName("cg-wall-frame-origin");

    if (origin.length === 0) return;

    origin = origin[0];

    if (origin.classList.contains("cg-wall-frame-empty")) {
        cg_wall_emplace_graffiti(tab, ""+tab.graffiti.order[0], origin);
        return;
    }

    var origin_graffiti_nr = parseInt(origin.getAttribute("data-graffiti-nr"));

    var origin_order_index = null;

    for (var i=0; i<tab.graffiti.order.length; ++i) {
        if (tab.graffiti.order[i] === origin_graffiti_nr) {
            origin_order_index = i;
            break;
        }
    }

    if (origin_order_index !== null) {
        var sibling = origin.previousSibling;
        var order_index = origin_order_index + 1;

        do {
            for (; sibling !== null; sibling = sibling.previousSibling) {
                if (sibling.classList.contains("cg-wall-frame-empty")) {
                    break;
                }
            }

            if (sibling !== null) {
                for (; order_index < tab.graffiti.order.length; ++order_index) {
                    var graffiti_id = (
                        "cg-wall-graffiti-"+tab.graffiti.data[
                            ""+tab.graffiti.order[order_index]
                        ].nr
                    );

                    if (document.getElementById(graffiti_id) === null) {
                        cg_wall_emplace_graffiti(
                            tab, ""+tab.graffiti.order[order_index], sibling
                        );

                        break;
                    }
                }
            }
        } while (sibling !== null && order_index < tab.graffiti.order.length);

        sibling = origin.nextSibling;
        order_index = origin_order_index - 1;

        do {
            for (; sibling !== null; sibling = sibling.nextSibling) {
                if (sibling.classList.contains("cg-wall-frame-empty")) {
                    break;
                }
            }

            if (sibling !== null) {
                for (; order_index >= 0; --order_index) {
                    var graffiti_id = (
                        "cg-wall-graffiti-"+tab.graffiti.data[
                            ""+tab.graffiti.order[order_index]
                        ].nr
                    );

                    if (document.getElementById(graffiti_id) === null) {
                        cg_wall_emplace_graffiti(
                            tab, ""+tab.graffiti.order[order_index], sibling
                        );

                        break;
                    }
                }
            }
        } while (sibling !== null && order_index >= 0);
    }
}

function cg_wall_emplace_graffiti(tab, key, frame) {
    if (key in tab.graffiti.data) {
        frame.classList.remove("cg-wall-frame-empty");
        frame.setAttribute("data-graffiti-nr", key);

        while (frame.hasChildNodes()) {
            frame.removeChild(frame.lastChild);
        }

        var graffiti = document.createElement("div");
        graffiti.id = "cg-wall-graffiti-"+key;
        graffiti.classList.add("cg-wall-graffiti");
        graffiti.classList.add("cg-borderbox");
        graffiti.classList.add("cg-wall-tx-"+tab.graffiti.data[key].txnr);

        graffiti.setAttribute("data-timestamp", "0");
        graffiti.setAttribute("data-graffiti-nr", key);

        frame.appendChild(graffiti);
    }
}

function cg_wall_move_row(tab, from, to) {
    var row = cg_wall_shift_framebuf(from);

    if (row.length === 0) return false;

    if (!to.hasChildNodes()) {
        row[Math.floor(row.length/2)].classList.add(
            "cg-wall-frame-origin"
        );
    }

    var frag = document.createDocumentFragment();

    if (from.id === "cg-wall-tailbuf" && to.hasChildNodes()) {
        frag.appendChild(document.createElement("hr"));
    }

    while (row.length > 0) {
        frag.appendChild(row.shift());
    }

    if (from.id === "cg-wall-headbuf" && to.hasChildNodes()) {
        frag.appendChild(document.createElement("hr"));
    }

    if (from.id === "cg-wall-headbuf") {
        to.insertBefore(frag, to.firstChild);
    }
    else to.appendChild(frag);

    cg_wall_reserve_framebuf(tab, from);

    tab.refresh_visible = true;

    return true;
}

function cg_wall_manage_frames(tab) {
    var headbuf = document.getElementById("cg-wall-headbuf");
    var bodybuf = document.getElementById("cg-wall-bodybuf");
    var tailbuf = document.getElementById("cg-wall-tailbuf");

    cg_wall_reserve_framebuf(tab, headbuf);
    cg_wall_reserve_framebuf(tab, tailbuf);

    while (cg_wall_scrolled_top() && cg_wall_scrolled_bottom()) {
        if (!cg_wall_move_row(tab, headbuf, bodybuf)) break;
        if (!cg_wall_move_row(tab, tailbuf, bodybuf)) break;
    }

    if (bodybuf.hasChildNodes()) {
        var import_graffiti = false;

        if (bodybuf.firstChild.classList.contains("cg-wall-frame")
        && !bodybuf.firstChild.classList.contains("cg-wall-frame-empty")) {
            var graffiti_nr = bodybuf.firstChild.getAttribute(
                "data-graffiti-nr"
            );

            if (graffiti_nr in tab.graffiti.data) {
                var greatest_tx_nr = cg_wall_get_greatest_tx_nr(tab);

                if (tab.graffiti.data[graffiti_nr].txnr !== greatest_tx_nr) {
                    if (cg_wall_move_row(tab, headbuf, bodybuf)) {
                        import_graffiti = true;
                    }
                }
            }
        }

        if (bodybuf.lastChild.classList.contains("cg-wall-frame")
        && !bodybuf.lastChild.classList.contains("cg-wall-frame-empty")) {
            var graffiti_nr = bodybuf.lastChild.getAttribute(
                "data-graffiti-nr"
            );

            if (graffiti_nr in tab.graffiti.data) {
                var smallest_tx_nr = cg_wall_get_smallest_tx_nr(tab);

                if (tab.graffiti.data[graffiti_nr].txnr !== smallest_tx_nr) {
                    if (cg_wall_move_row(tab, tailbuf, bodybuf)) {
                        import_graffiti = true;
                    }
                }
            }
        }

        if (import_graffiti) {
            setTimeout(
                function(){
                    cg_wall_import_graffiti(tab);
                }, 0
            );
        }
    }
}

function cg_wall_shift_framebuf(framebuf) {
    var last_offset = 0;

    var frames = framebuf.children;

    var overflow = false;

    var row = [];

    for (var i=0; i<frames.length; ++i) {
        var frame = frames[i];

        if (i === 0) {
            last_offset = frame.offsetTop;
            row.push(frame);
            continue;
        }

        if (frame.offsetTop > last_offset) {
            overflow = true;
            break;
        }

        row.push(frame);
    }

    if (overflow === true) {
        for (var i=0; i<row.length; ++i) {
            row[i].parentNode.removeChild(row[i]);
        }

        return row;
    }

    return [];
}

function cg_wall_reserve_framebuf(tab, framebuf) {
    var last_offset = 0;

    var frames = framebuf.children;

    do {
        var overflow = false;

        for (var i=0; i<frames.length; ++i) {
            var frame = frames[i];

            if (i === 0) {
                last_offset = frame.offsetTop;
                continue;
            }

            if (frame.offsetTop > last_offset) {
                overflow = true;
                break;
            }
        }

        if (overflow === true) {
            return;
        }

        cg_wall_add_frame(tab, framebuf);
    }
    while (true);
}

function cg_wall_add_frame(tab, framebuf) {
    var frame = document.createElement("div");
    frame.classList.add("cg-wall-frame");
    frame.classList.add("cg-wall-frame-empty");
    frame.classList.add("cg-borderbox");
    framebuf.appendChild(frame);
}

function cg_wall_get_txs(tab) {
    var data_obj = {
        count : ""+Math.min(cg_get_global("constants").TXS_PER_QUERY, 64)
    };

    var origin = document.getElementsByClassName(
        "cg-wall-frame-origin cg-wall-frame-empty"
    );

    if (origin.length !== 0) {
        data_obj.count = "1";
        if (cg_get_global("focus") !== null) {
            data_obj["nr"] = ""+cg_get_global("focus");
        }
    }
    else {
        var options = [
            function (t, d) {
                if (cg_wall_should_load_old_txs(t)) {
                    d["back"] = "1";

                    var nr = cg_wall_get_smallest_tx_nr(t);
                    if (nr !== null) d["nr"] = ""+nr;

                    return true;
                }

                return false;
            },
            function (t, d) {
                if (cg_wall_should_load_new_txs(t)) {
                    d["back"] = "0";

                    var nr = cg_wall_get_greatest_tx_nr(t);
                    if (nr !== null) d["nr"] = ""+nr;

                    return true;
                }

                return false;
            }
        ];

        shuffle(options);

        var any_option = false;
        for (var i=0; i<options.length; ++i) {
            if (options[i](tab, data_obj)) {
                any_option = true;
                break;
            }
        }

        if (any_option === false) {
            tab.loading_txs = 0;
            return;
        }
    }

    var api_usage = cg_get_global("api_usage");

    if (api_usage.rpm + 10 >= api_usage.max_rpm) {
        tab.loading_txs = 0;
        return;
    }
    else api_usage.rpm++;

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

                if ("api_usage" in json) {
                    cg_set_global("api_usage", json.api_usage);
                }

                if ("txs" in json) {
                    for (var i=0; i<json.txs.length; ++i) {
                        tab.txs[json.txs[i].txid] = json.txs[i];
                    }

                    if (tab.scrolled_bottom || tab.scrolled_top) {
                        setTimeout(function(){
                            tab.last_update = 0;
                            cg_wall_step(tab);
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

function cg_wall_refresh_visible(tab) {
    var bodybuf = document.getElementById("cg-wall-bodybuf");
    var contents = bodybuf.children;

    var origin_candidates = [];

    for (var i=0; i<contents.length; ++i) {
        var frame = contents[i];

        if (!frame.classList.contains("cg-wall-frame")) continue;

        if (is_visible(tab.element, frame, true)) {
            frame.classList.add("cg-wall-frame-visible");

            if (!frame.classList.contains("cg-wall-frame-empty")) {
                origin_candidates.push(frame);
            }
        }
        else {
            frame.classList.remove("cg-wall-frame-visible");
        }
    }

    if (origin_candidates.length > 0) {
        var origin = document.getElementsByClassName("cg-wall-frame-origin");
        var median = origin_candidates[Math.floor(origin_candidates.length/2)];

        for (var i = 1; i < origin.length; ++i) {
            origin[i].classList.remove("cg-wall-frame-origin");
        }

        origin = origin.length > 0 ? origin[0] : null;

        if (origin !== median) {
            if (origin !== null) {
                origin.classList.remove("cg-wall-frame-origin");
            }

            median.classList.add("cg-wall-frame-origin");
        }
    }
}

function cg_wall_download_graffiti(tab) {
    var downloading = document.getElementsByClassName(
        "cg-wall-graffiti-downloading"
    );

    if (downloading.length !== 0) return;

    var visible = document.getElementsByClassName(
        "cg-wall-frame-visible"
    );

    var pending = [];

    for (var i = 0; i < visible.length; i++) {
        var el = visible[i];

        if (el.classList.contains("cg-wall-frame")
        && !el.classList.contains("cg-wall-frame-empty")) {
            pending.push(el);
        }
    }

    var max_requests = 16;

    while (pending.length > 0) {
        var frame = pending.shift();
        var children = frame.children;

        for (var j=0; j<children.length; ++j) {
            var child = children[j];
            var graffiti_nr = child.getAttribute("data-graffiti-nr");

            if (graffiti_nr in tab.graffiti.data
            &&  child.classList.contains("cg-wall-graffiti")
            && !child.classList.contains("cg-wall-graffiti-downloading")
            && !child.classList.contains("cg-wall-graffiti-decoding")
            && !child.classList.contains("cg-wall-graffiti-decoded")) {
                var timestamp = parseInt(child.getAttribute("data-timestamp"));

                // TODO: progressively increase the delay here after every try.
                if (get_timestamp_age(timestamp) < 3) continue;

                child.classList.add("cg-wall-graffiti-downloading");

                cg_wall_get_rawtx_range(
                    tab,
                    tab.graffiti.data[graffiti_nr].txid,
                    parseInt(tab.graffiti.data[graffiti_nr].offset),
                    parseInt(tab.graffiti.data[graffiti_nr].fsize),
                    graffiti_nr
                );

                if (--max_requests <= 0) return;
            }
        }
    }
}

function cg_wall_get_rawtx_range(tab, txid, offset, fsize, graffiti_nr) {
    if (graffiti_nr in tab.graffiti.data
    && tab.graffiti.data[graffiti_nr].cache === false) {
        var api_usage = cg_get_global("api_usage");

        if (api_usage.rpm + 10 >= api_usage.max_rpm) {
            var graffiti = document.getElementById(
                "cg-wall-graffiti-"+graffiti_nr
            );
            graffiti.classList.remove("cg-wall-graffiti-downloading");
            return;
        }
        else api_usage.rpm++;

        var data_obj = {
            count : "1",
            nr : ""+tab.graffiti.data[graffiti_nr].txnr
        };

        var json_str = encodeURIComponent(JSON.stringify(data_obj));

        xmlhttpPost(cg_get_global("api_url"), 'fun=get_txs&data='+json_str,
            function(response) {
                var graffiti = document.getElementById(
                    "cg-wall-graffiti-"+graffiti_nr
                );

                if (response === false) {
                    return;
                }
                else if (response === null ) {
                    return;
                }

                var json = JSON.parse(response);

                if ("api_usage" in json) {
                    cg_set_global("api_usage", json.api_usage);
                }

                if (graffiti === null) {
                    // This can happen if we removed this graffiti while it was
                    // downloading. For example, we might have scrolled past
                    // this graffiti and as it was no longer visible on screen
                    // it got purged from memory before the download could
                    // complete.

                    return;
                }

                graffiti.classList.remove("cg-wall-graffiti-downloading");

                if ("txs" in json && json.txs.length === 1
                &&  json.txs[0].cache === true) {
                    tab.graffiti.data[graffiti_nr].cache = true;
                }
            }
        );

        return;
    }

    cg_push_status(cg_translate(CG_TXT_WALL_LOADING_RAWTX_SEGMENT));

    xmlhttpGet(
        "https://cryptograffiti.info/rawtx/"+txid, "",
        function(response) {
            var status = "";

            var graffiti = document.getElementById(
                "cg-wall-graffiti-"+graffiti_nr
            );

            if (graffiti === null) {
                // This can happen if we removed this graffiti while it was
                // downloading. For example, we might have scrolled past this
                // graffiti and as it was no longer visible on screen it got
                // purged from memory before the download could complete.

                return;
            }

            graffiti.classList.remove("cg-wall-graffiti-downloading");
            graffiti.classList.add("cg-wall-graffiti-decoding");

            if (response === false) {
                status = cg_translate(CG_TXT_WALL_LOADING_RAWTX_SEGMENT_ERROR);
            }
            else if (response === null ) {
                status = cg_translate(
                    CG_TXT_WALL_LOADING_RAWTX_SEGMENT_TIMEOUT
                );
            }

            cg_wall_decode_graffiti(tab, graffiti, response);

            if (status.length > 0) cg_push_status(status);
        }, 20000, { offset: offset, length: fsize }
    );

    return;
}

function cg_wall_decode_graffiti(tab, graffiti, data) {
    var graffiti_nr = graffiti.getAttribute("data-graffiti-nr");

    if (graffiti_nr in tab.graffiti.data) {
        var timestamp = Math.floor(Date.now() / 1000);
        var location  = tab.graffiti.data[graffiti_nr].location;
        var mimetype  = tab.graffiti.data[graffiti_nr].mimetype;
        var hash      = tab.graffiti.data[graffiti_nr].hash;

        graffiti.setAttribute("data-timestamp", timestamp);

        if (data === null || data === false) {
            graffiti.classList.remove("cg-wall-graffiti-decoding");
            return;
        }

        if (location === "NULL_DATA"
        &&  mimetype.indexOf("image/") === 0) {
            var media = document.createElement("DIV");
            media.classList.add("cg-wall-media");

            var b64imgData = arrayBufferToBase64(data);
            var img = new Image();
            img.src = "data:"+mimetype+";base64,"+b64imgData;

            var link = document.createElement("a");
            link.href = "https://cryptograffiti.info/cache/"+hash;
            link.target = "_blank";

            link.appendChild(img);
            media.appendChild(link);

            setTimeout(
                function(g, m){
                    m.classList.add("cg-poofin");
                    g.appendChild(m);
                },
                Math.floor(Math.random() * 1000), graffiti, media
            );

            graffiti.classList.remove("cg-wall-graffiti-decoding");
            graffiti.classList.add("cg-wall-graffiti-decoded");
        }
    }
}

function cg_wall_scrolled_top() {
    var wall = document.getElementById("cg-tab-wall");
    return Math.ceil(wall.scrollTop) === 0;
}

function cg_wall_scrolled_bottom() {
    var wall = document.getElementById("cg-tab-wall");
    return Math.ceil(wall.scrollHeight - wall.scrollTop) <= wall.clientHeight;
}

function cg_wall_should_load_new_txs(tab) {
    if (!cg_wall_scrolled_top()) {
        var visible = document.getElementsByClassName("cg-wall-frame-visible");

        if (visible.length > 0) {
            var greatest_tx_nr = null;
            var newest_graffiti = null;

            for (var i = 0; i < visible.length; i++) {
                var el = visible[i];

                if (!el.classList.contains("cg-wall-frame")) continue;

                var el_graffiti_nr = el.getAttribute("data-graffiti-nr");

                if (el_graffiti_nr in tab.graffiti.data) {
                    var this_tx_nr = tab.graffiti.data[el_graffiti_nr].txnr;

                    if (greatest_tx_nr === null
                    ||  this_tx_nr > greatest_tx_nr) {
                        greatest_tx_nr = this_tx_nr;
                        newest_graffiti = el;
                    }
                }
            }

            if (newest_graffiti === null) return false;

            var sibling = newest_graffiti.previousSibling;

            while (sibling !== null) {
                if (!sibling.classList.contains("cg-wall-frame-visible")) break;

                if (sibling.classList.contains("cg-wall-frame-empty")) {
                    return true;
                }

                sibling = sibling.previousSibling;
            }
        }

        return false;
    }

    var greatest_tx_nr = cg_wall_get_greatest_tx_nr(tab);

    if (greatest_tx_nr !== null) {
        var graffiti_group = document.getElementsByClassName(
            "cg-wall-tx-"+greatest_tx_nr
        );

        if (graffiti_group.length === 0) return false;
    }

    return true;
}

function cg_wall_should_load_old_txs(tab) {
    if (!cg_wall_scrolled_bottom()) {
        var visible = document.getElementsByClassName("cg-wall-frame-visible");

        if (visible.length > 0) {
            var smallest_tx_nr = null;
            var oldest_graffiti = null;

            for (var i = 0; i < visible.length; i++) {
                var el = visible[i];

                if (!el.classList.contains("cg-wall-frame")) continue;

                var el_graffiti_nr = el.getAttribute("data-graffiti-nr");

                if (el_graffiti_nr in tab.graffiti.data) {
                    var this_tx_nr = tab.graffiti.data[el_graffiti_nr].txnr;

                    if (smallest_tx_nr === null
                    ||  this_tx_nr < smallest_tx_nr) {
                        smallest_tx_nr = this_tx_nr;
                        oldest_graffiti = el;
                    }
                }
            }

            if (oldest_graffiti === null) return false;

            var sibling = oldest_graffiti.nextSibling;

            while (sibling !== null) {
                if (!sibling.classList.contains("cg-wall-frame-visible")) break;

                if (sibling.classList.contains("cg-wall-frame-empty")) {
                    return true;
                }

                sibling = sibling.nextSibling;
            }
        }

        return false;
    }

    var smallest_tx_nr = cg_wall_get_smallest_tx_nr(tab);

    if (smallest_tx_nr !== null) {
        var graffiti_group = document.getElementsByClassName(
            "cg-wall-tx-"+smallest_tx_nr
        );

        if (graffiti_group.length === 0) return false;
    }

    return true;
}

function cg_wall_get_smallest_tx_nr(tab) {
    if (tab.graffiti.order.length === 0) return null;

    return tab.graffiti.data[
        ""+tab.graffiti.order[0]
    ].txnr;
}

function cg_wall_get_greatest_tx_nr(tab) {
    if (tab.graffiti.order.length === 0) return null;

    return tab.graffiti.data[
        ""+tab.graffiti.order[tab.graffiti.order.length - 1]
    ].txnr;
}

function cg_wall_should_forget_old_txs(tab) {
    var wall = document.getElementById("cg-tab-wall");

    var position = wall.scrollTop + wall.clientHeight / 2;
    var visible = wall.clientHeight / wall.scrollHeight;

    return visible < 0.25 && (position/wall.scrollHeight) < 0.5;
}

function cg_wall_should_forget_new_txs(tab) {
    var wall = document.getElementById("cg-tab-wall");

    var position = wall.scrollTop + wall.clientHeight / 2;
    var visible = wall.clientHeight / wall.scrollHeight;

    return visible < 0.25 && (position/wall.scrollHeight) >= 0.5;
}

function cg_wall_remove_new_frames(tab) {
    var bodybuf = document.getElementById("cg-wall-bodybuf");

    var removed_frames = [];

    if (cg_wall_should_forget_new_txs(tab)) {
        while (bodybuf.hasChildNodes()) {
            var child = bodybuf.firstChild;

            if (child.classList.contains("cg-wall-frame-visible")
            ||  child.classList.contains("cg-wall-frame-origin")) {
                return removed_frames;
            }

            bodybuf.removeChild(child);

            if (child.tagName.toLowerCase() === "hr") {
                continue;
            }

            if (child.classList.contains("cg-wall-frame")) {
                removed_frames.push(child);
            }
        }
    }

    return removed_frames;
}

function cg_wall_remove_old_frames(tab) {
    var bodybuf = document.getElementById("cg-wall-bodybuf");

    var removed_frames = [];

    if (cg_wall_should_forget_old_txs(tab)) {
        while (bodybuf.hasChildNodes()) {
            var child = bodybuf.lastChild;

            if (child.classList.contains("cg-wall-frame-visible")
            ||  child.classList.contains("cg-wall-frame-origin")) {
                return removed_frames;
            }

            bodybuf.removeChild(child);

            if (child.tagName.toLowerCase() === "hr") {
                continue;
            }

            if (child.classList.contains("cg-wall-frame")) {
                removed_frames.push(child);
            }
        }
    }

    return removed_frames;
}

function cg_wall_forget_new_txs(tab) {
    var removed_frames = cg_wall_remove_new_frames(tab);

    for (var i=0; i<removed_frames.length; ++i) {
        var frame = removed_frames[i];
        if (frame.hasAttribute("data-graffiti-nr")) {
            var graffiti_key = frame.getAttribute("data-graffiti-nr");
            if (graffiti_key in tab.graffiti.data) {
                var graffiti_nr = tab.graffiti.data[graffiti_key].nr;
                delete tab.graffiti.data[graffiti_key];

                var order_index = tab.graffiti.order.indexOf(graffiti_nr);
                if (order_index !== -1) {
                    tab.graffiti.order.splice(order_index, 1);
                }
                else cg_bug();
            }
            else cg_bug();
        }
    }

    return removed_frames.length;
}

function cg_wall_forget_old_txs(tab) {
    var removed_frames = cg_wall_remove_old_frames(tab);

    for (var i=0; i<removed_frames.length; ++i) {
        var frame = removed_frames[i];
        if (frame.hasAttribute("data-graffiti-nr")) {
            var graffiti_key = frame.getAttribute("data-graffiti-nr");
            if (graffiti_key in tab.graffiti.data) {
                var graffiti_nr = tab.graffiti.data[graffiti_key].nr;
                delete tab.graffiti.data[graffiti_key];

                var order_index = tab.graffiti.order.indexOf(graffiti_nr);
                if (order_index !== -1) {
                    tab.graffiti.order.splice(order_index, 1);
                }
                else cg_bug();
            }
            else cg_bug();
        }
    }

    return removed_frames.length;
}

