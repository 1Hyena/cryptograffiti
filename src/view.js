var CG_VIEW_TX_HASH = null;
var CG_VIEW_TX_TYPE = null;

function cg_construct_view(main) {
    var div = cg_init_tab(main, 'cg-tab-view');
    if (div === null) return;
    div.classList.add("cg-view-tab");
}

function cg_view_update() {
    if (CG_TX_TYPE !== CG_VIEW_TX_TYPE && CG_VIEW_TX_HASH !== null) {
        CG_VIEW_TX_TYPE = CG_TX_TYPE;
        CG_TX_HASH = null;
    }

    if (CG_TX_HASH === CG_VIEW_TX_HASH) return;

    var iframe = document.getElementById("cg-view-iframe");

    if ((CG_TX_HASH !== null && CG_VIEW_TX_HASH !== null)
    ||  (CG_TX_HASH === null && CG_VIEW_TX_HASH !== null)) {
        // Old content has to disappear first.
        if (CG_VIEW_TX_HASH !== null) CG_STATUS.push(sprintf(CG_TXT_VIEW_TX_FORGOTTEN[CG_LANGUAGE], CG_VIEW_TX_HASH));
        CG_TX_HASH = null;
        CG_VIEW_TX_HASH = null;
        if (iframe !== null) {
            iframe.classList.remove("cg-appear");
            iframe.classList.add("cg-disappear");
            setTimeout(function(){
                iframe.parentNode.removeChild(iframe);
            }, 500);
        }
        return;
    }

    if (iframe) return;

    // New content appears from nothing.
    CG_VIEW_TX_HASH = CG_TX_HASH;
    CG_VIEW_TX_TYPE = CG_TX_TYPE;

    CG_STATUS.push(sprintf(CG_TXT_VIEW_LOADING_TX_DATA[CG_LANGUAGE], CG_VIEW_TX_HASH, "blockchain.info"));
    xmlhttpGet("https://blockchain.info/rawtx/"+CG_TX_HASH+"?cors=true&format=json", '',
        function(response) {
            var div = document.getElementById("cg-tab-view");
            var iframe = document.createElement('iframe');
            iframe.id="cg-view-iframe";
            iframe.sandbox = '';
            var type = 'text/html;charset=utf-8;base64';
            var payload = btoa('<body></body>');

            if (response === false || response === null) {
                CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_LOADING_TX_DATA_FAIL[CG_LANGUAGE], CG_VIEW_TX_HASH, "blockchain.info"));
            }
            else {
                var json = JSON.parse(response);
                var fail = true;
                if ("out" in json && json.out.length > 0) {
                    var out_bytes= "";
                    var outs = json.out.length;
                    for (var j = 0; j < outs; j++) {
                        if ("addr" in json.out[j]) {
                            out_bytes = out_bytes + Bitcoin.getAddressPayload(json.out[j].addr);
                        }
                    }

                    var fsz = is_blockchain_file(out_bytes);
                    var blockchain_file = null;
                    if (fsz > 0) blockchain_file = out_bytes.substr(0, fsz);

                    if (blockchain_file !== null) {
                        fail = false;
                        payload = btoa(blockchain_file);
                             if (CG_VIEW_TX_TYPE === 'jpg')  type = 'image/jpeg;base64';
                        else if (CG_VIEW_TX_TYPE === 'png')  type = 'image/png;base64';
                        else if (CG_VIEW_TX_TYPE === 'gif')  type = 'image/gif;base64';
                        else if (CG_VIEW_TX_TYPE === 'txt')  type = 'text/plain;charset=utf-8;base64';
                        else if (CG_VIEW_TX_TYPE === 'html') type = 'text/html;charset=utf-8;base64';
                        else if (CG_VIEW_TX_TYPE === 'md') {
                            type = 'text/markdown;charset=utf-8;base64';
                            // Render markdown here...
                        }
                        else payload = btoa('<body></body>');
                    }
                    else if (CG_VIEW_TX_TYPE !== null) {
                        CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_FILE_NOT_FOUND[CG_LANGUAGE], CG_VIEW_TX_HASH));
                    }
                }
                if (fail) {
                    CG_STATUS.push(sprintf("!"+CG_TXT_VIEW_DECODING_FAIL[CG_LANGUAGE], CG_VIEW_TX_HASH));
                }
            }

            iframe.src = 'data:'+type+',' + payload;
            div.appendChild(iframe);
            iframe.classList.add("cg-appear");
        }
    );
}

