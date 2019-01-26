var CG_TOOLS_PPS          = 1;
var CG_TOOLS_POE_FILES    = [];
var CG_TOOLS_POE_FPOS     = 0;
var CG_TOOLS_POE_UPDATE   = true;
var CG_TOOLS_POE_HASHER   = null;
var CG_TOOLS_POE_READING  = false;
var CG_TOOLS_POE_ITEMS    = [];
var CG_TOOLS_POE_CHECKING = false;

function cg_construct_tools(main) {
    var div = cg_init_tab(main, 'cg-tab-tools');
    if (div === null) return;

    div.classList.add("cg-tools-tab");

    var head_area = document.createElement("div");
    var list_area = document.createElement("div");
    var btns_area = document.createElement("div");
    var info_area = document.createElement("div");
    var core_area = document.createElement("div");

    list_area.classList.add("cg-tools-list");
    list_area.classList.add("cg-borderbox");
    btns_area.classList.add("cg-tools-btns");
    info_area.classList.add("cg-tools-info");
    info_area.classList.add("cg-borderbox");

    btns_area.id="cg-tools-btnsarea";
    info_area.id="cg-tools-infoarea";
    head_area.id="cg-tools-head";
    core_area.id="cg-tools-core";

    var span_tool_name=document.createElement("span");
    span_tool_name.id="cg-tools-span-tool-name";
    info_area.appendChild(span_tool_name);

    var p_tool_desc=document.createElement("p");
    p_tool_desc.id="cg-tools-p-tool-desc";
    info_area.appendChild(p_tool_desc);

    var btn_1 = document.createElement("BUTTON"); btn_1.classList.add("cg-tools-btn");
    var txt_1 = document.createTextNode(CG_TXT_TOOLS_BTN_PROOF_OF_EXISTENCE[CG_LANGUAGE]);
    btn_1.appendChild(txt_1); btn_1.addEventListener("click", cg_button_click_proof_of_existence);
    //btn_1.disabled = true;
    btns_area.appendChild(btn_1);

    var btn_2 = document.createElement("BUTTON"); btn_2.classList.add("cg-tools-btn");
    var txt_2 = document.createTextNode(CG_TXT_TOOLS_BTN_ADDRESS_DECODER[CG_LANGUAGE]);
    btn_2.appendChild(txt_2); btn_2.addEventListener("click", cg_button_click_address_decoder);
    btn_2.disabled = true;
    btn_2.classList.add("cg-hidden");
    btns_area.appendChild(btn_2);

    var btn_3 = document.createElement("BUTTON"); btn_3.classList.add("cg-tools-btn");
    var txt_3 = document.createTextNode(CG_TXT_TOOLS_BTN_TRANSACTION_DECODER[CG_LANGUAGE]);
    btn_3.appendChild(txt_3); btn_3.addEventListener("click", cg_button_click_transaction_decoder);
    btn_3.disabled = true;
    btn_3.classList.add("cg-hidden");
    btns_area.appendChild(btn_3);
    list_area.appendChild(btns_area);

    core_area.appendChild(cg_tools_create_proof_of_existence());

    head_area.appendChild(list_area);
    head_area.appendChild(info_area);
    div.appendChild(head_area);
    div.appendChild(core_area);

    cg_button_click_proof_of_existence();
    cg_tools_loop();
}

function cg_tools_loop() {
    CG_TOOLS_POE_UPDATE = true;

    var btn = document.getElementById("cg-tools-poe-btn-compile");
    if (CG_TOOLS_POE_FILES.length == 0) btn.disabled = false;
    else                                btn.disabled = true;

    setTimeout(function(){
        cg_tools_loop();
    }, 1000/CG_TOOLS_PPS);
}

function cg_tools_poe_create_browse_btn() {
    var browse_btn = document.createElement("input");
    browse_btn.type = "file";
    browse_btn.id   = "cg-tools-poe-browse-btn";
    browse_btn.name = "files[]";
    browse_btn.multiple = true;
    browse_btn.addEventListener('change',  cg_tools_poe_handle_file_select, false);
    //browse_btn.classList.add("cg-borderbox");
    return browse_btn;
}

function cg_tools_create_proof_of_existence() {
    var div = document.createElement("div");
    div.id = "cg-tools-proof-of-existence";

    var drop_zone  = document.createElement("div");
    drop_zone.id = "cg-tools-poe-drop-zone";
    drop_zone.classList.add("cg-borderbox");
    drop_zone.addEventListener('click', function (event) {document.getElementById("cg-tools-poe-browse-btn").click();});

    var drop_cell = document.createElement("div");
    drop_cell.style.display="table-cell";
    drop_cell.style.verticalAlign="middle";
    drop_cell.appendChild(document.createTextNode(CG_TXT_TOOLS_DROP_FILES_HERE[CG_LANGUAGE]));
    drop_cell.appendChild(document.createElement("br"));
    drop_cell.appendChild(document.createElement("br"));
    drop_cell.appendChild(document.createTextNode(CG_TXT_TOOLS_FILES_WILL_NOT_BE_UPLOADED[CG_LANGUAGE]));
    drop_zone.appendChild(drop_cell);

    // Setup the dnd listeners.
    drop_zone.addEventListener('dragover', cg_tools_poe_handle_drag_over,   false);
    drop_zone.addEventListener('drop',     cg_tools_poe_handle_file_drop,   false);

    var file_selection_div = document.createElement("div");
    file_selection_div.id = "cg-tools-poe-file-selection";
    file_selection_div.appendChild(drop_zone);

    var footer_table = document.createElement("div");
    footer_table.classList.add("cg-tools-poe-footer-table");
    var footer_cell = document.createElement("div");
    footer_cell.id = "cg-tools-poe-browse-cell";
    footer_cell.classList.add("cg-tools-poe-footer-cell");

    var footer_button_div = document.createElement("div");
    footer_button_div.id = "cg-tools-poe-browse-div";
    footer_button_div.appendChild(cg_tools_poe_create_browse_btn());

    footer_cell.appendChild(footer_button_div);
    footer_table.appendChild(footer_cell);
    file_selection_div.appendChild(footer_table);

    div.appendChild(file_selection_div);

    var file_list_div = document.createElement("div");
    file_list_div.id = "cg-tools-poe-file-list";
    var file_table_div = document.createElement("div");
    file_table_div.id = "cg-tools-poe-file-table";
    file_table_div.classList.add("cg-borderbox");
    file_table_div.classList.add("cg-tools-info");
    file_list_div.appendChild(file_table_div);

    var btn = document.createElement("BUTTON"); btn.classList.add("cg-tools-btn");
    var txt = document.createTextNode(CG_TXT_TOOLS_BTN_CANCEL[CG_LANGUAGE]);
    btn.appendChild(txt); btn.addEventListener("click", cg_tools_button_click_poe_cancel);
    footer_table = document.createElement("div");
    footer_table.classList.add("cg-tools-poe-footer-table");
    footer_cell = document.createElement("div");
    footer_cell.classList.add("cg-tools-poe-footer-cell");
    footer_cell.appendChild(btn);
    footer_table.appendChild(footer_cell);
    footer_cell = document.createElement("div");
    footer_cell.classList.add("cg-tools-poe-footer-cell");
    btn = document.createElement("BUTTON"); btn.classList.add("cg-tools-btn");
    btn.id = "cg-tools-poe-btn-compile";
    btn.disabled = true;
    txt = document.createTextNode(CG_TXT_TOOLS_BTN_COMPILE[CG_LANGUAGE]);
    btn.appendChild(txt); btn.addEventListener("click", cg_tools_button_click_poe_compile);
    footer_cell.appendChild(btn);
    footer_table.appendChild(footer_cell);
    file_list_div.appendChild(footer_table);

    div.appendChild(file_list_div);

    return div;
}

function cg_tools_poe_try_to_cancel() {
    if (CG_TOOLS_POE_READING) {
        setTimeout(function(){
            cg_tools_poe_try_to_cancel();
        }, 1000);
        return;
    }

    var d = document.getElementById("cg-tools-poe-file-selection");
    d.classList.add("cg-poofin");
    d.style.display = "block";

    CG_TOOLS_POE_FILES = [];
    CG_TOOLS_POE_FPOS  = 0;
    CG_TOOLS_POE_HASHER= null;
    CG_TOOLS_POE_ITEMS = [];

    var browse_div = document.getElementById("cg-tools-poe-browse-div");
    while (browse_div.hasChildNodes()) browse_div.removeChild(browse_div.lastChild);
    browse_div.appendChild(cg_tools_poe_create_browse_btn());

    setTimeout(function(){
        d.classList.remove("cg-poofin");
    }, 200);
}

function cg_tools_button_click_poe_cancel() {
    var div = document.getElementById("cg-tools-poe-file-list");
    div.classList.remove("cg-poofin");
    div.classList.add("cg-poofout");

    setTimeout(function(){
        div.style.display = "none";
        div.classList.remove("cg-poofout");

        CG_TOOLS_POE_FILES = [];
        cg_tools_poe_try_to_cancel();
    }, 500);
}

function cg_tools_button_click_poe_compile() {
    if (CG_WRITE_STATE !== "cg-write-textarea"
    ||  CG_WRITE_CHUNKS.length > 0) {
        CG_STATUS.push("!"+CG_TXT_TOOLS_WRITE_TAB_NOT_EMPTY[CG_LANGUAGE]);
        return;
    }

    if (CG_TOOLS_POE_ITEMS.length*20 > CG_WRITE_MAX_FILE_SIZE_KiB*1024) {
        CG_STATUS.push("!"+sprintf(CG_TXT_WRITE_ERROR_FILE_SIZE[CG_LANGUAGE],
                                   CG_TXT_TOOLS_PROOF[CG_LANGUAGE],
                                   CG_WRITE_MAX_FILE_SIZE_KiB+" KiB"));
        return;
    }

    cg_button_click_write();
    setTimeout(function(){
        var area = document.getElementById("cg-write-textarea");
        var buf  = "RIPEMD-160 hashes\n"
                 + "-----------------\n";
        var bytes = "";
        for (var i=0, sz=CG_TOOLS_POE_ITEMS.length; i<sz; ++i) {
            buf   += CG_TOOLS_POE_ITEMS[i].ripemd160 + "  "
                  +  CG_TOOLS_POE_ITEMS[i].fname     + "\n";
            bytes += Bitcoin.getAddressPayload(CG_TOOLS_POE_ITEMS[i].btc_addr);
        }
        area.value = buf;
        var ab = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; ++i) ab[i] = bytes.charCodeAt(i);
        cg_write_attach_file("Proof of Existence", "application/octet-stream", ab.buffer);
    }, 500);
}

function cg_tools_poe_handle_drag_over(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function cg_tools_poe_read_blob(file, opt_startByte, opt_stopByte) {
    var start = opt_startByte;
    var stop  = opt_stopByte;

    var reader = new FileReader();

    // If we use onloadend, we need to check the readyState.
    reader.onloadend = function(evt) {
        if (evt.target.readyState == FileReader.DONE) { // DONE == 2
            CG_TOOLS_POE_READING = false;
            if (CG_TOOLS_POE_HASHER === null) {
                CG_TOOLS_POE_HASHER = CryptoJS.algo.RIPEMD160.create();
            }
            var wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(evt.target.result));
            CG_TOOLS_POE_HASHER.update(wordArray);

            CG_TOOLS_POE_FPOS = stop+1;
            cg_tools_poe_read_files();
        }
    };

    var blob = file.slice(start, stop + 1);
    CG_TOOLS_POE_READING = true;
    reader.readAsArrayBuffer(blob);
}

function cg_tools_poe_read_files() {
    if (CG_TOOLS_POE_FILES.length === 0) return;

    if (CG_TOOLS_POE_CHECKING) {
        setTimeout(function(){
            cg_tools_poe_read_files();
        }, 1000);
        return;
    }

    var apis = [];
    var api = null;
    for (var i=0, sz = CG_READ_APIS.length; i<sz; i++) {
        if ("request_addr" in CG_READ_APIS[i] == false
        ||  "link_addr"    in CG_READ_APIS[i] == false) {
            continue;
        }

        if (CG_READ_APIS[i].delay === 0) apis.push(i);
    }

    if (apis.length > 0) {
        apis = shuffle(apis);
        api = apis[0];
    }

    var status  = null;
    var refresh = false;
    var done    = (CG_TOOLS_POE_FPOS === CG_TOOLS_POE_FILES[0].size);
    if (CG_TOOLS_POE_UPDATE || done) {
        status  = document.getElementById(CG_TOOLS_POE_FILES[0].cg_element_id);
        refresh = true;
        CG_TOOLS_POE_UPDATE = false;
        while (status.hasChildNodes()) status.removeChild(status.lastChild);
    }

    if (done) {
        if (refresh) {
            if (CG_TOOLS_POE_HASHER !== null) {
                var hash = CG_TOOLS_POE_HASHER.finalize().toString(CryptoJS.enc.Hex);
                var addr = Bitcoin.createAddressFromText(hex2ascii(hash));
                status.appendChild(document.createTextNode(addr));
                var item = {
                    fname     : CG_TOOLS_POE_FILES[0].name,
                    ripemd160 : hash,
                    btc_addr  : addr
                };
                CG_TOOLS_POE_ITEMS.push(item);
                CG_TOOLS_POE_CHECKING = true;

                if (api !== null) {
                    var api_url  = sprintf(CG_READ_APIS[api].request_addr, addr)+"?noTxList=1";
                    var info_url = sprintf(CG_READ_APIS[api].link_addr, addr);

                    xmlhttpGet(api_url, '',
                        function(response) {
                            CG_TOOLS_POE_CHECKING = false;
                                 if (response === false);
                            else if (response === null );
                            else {
                                var json = JSON.parse(response);
                                if ("txApperances" in json && json.txApperances > 0) {
                                    while (status.hasChildNodes()) status.removeChild(status.lastChild);

                                    var a_proof   = document.createElement("a");
                                    a_proof.appendChild(document.createTextNode(addr));
                                    a_proof.title = CG_TXT_TOOLS_POE_PROOF_LINK[CG_LANGUAGE];
                                    a_proof.href  = info_url;
                                    a_proof.target= "_blank";

                                    status.appendChild(a_proof);
                                }
                            }
                        }
                    );
                }
                else CG_TOOLS_POE_CHECKING = false;
            }
            else status.appendChild(document.createTextNode("---"));
        }
        CG_TOOLS_POE_FILES.shift();
        CG_TOOLS_POE_FPOS = 0;
        CG_TOOLS_POE_HASHER = null;

        if (CG_TOOLS_POE_FILES.length > 0) {
            setTimeout(function(){
                cg_tools_poe_read_files();
            }, 1000);
        }
        return;
    }

    if (refresh) {
        var percentage = ((100*CG_TOOLS_POE_FPOS)/CG_TOOLS_POE_FILES[0].size).toFixed(1);
        status.appendChild(document.createTextNode(percentage+"%"));
    }

    var buf_size  = 64*1024;
    var last_byte = Math.min(CG_TOOLS_POE_FPOS+buf_size, CG_TOOLS_POE_FILES[0].size-1);
    cg_tools_poe_read_blob(CG_TOOLS_POE_FILES[0], CG_TOOLS_POE_FPOS, last_byte);
}

function cg_tools_poe_file_selection(files) {
    var div = document.getElementById("cg-tools-poe-file-selection");
    div.classList.remove("cg-appear");
    div.classList.add("cg-disappear");

    setTimeout(function(){
        div.style.display = "none";
        div.classList.remove("cg-disappear");

        var d = document.getElementById("cg-tools-poe-file-table");
        while (d.hasChildNodes()) d.removeChild(d.lastChild);
        var t = document.createElement("table");

        CG_TOOLS_POE_FILES = [];
        for (var i = 0, f; f = files[i]; i++) {
            var tr = document.createElement("tr");

            var td1 = document.createElement("td");
            var td2 = document.createElement("td");
            var td3 = document.createElement("td");

            var status = document.createElement("span");
            status.id  = "cg-tools-poe-file-"+i;

            td1.appendChild(document.createTextNode(f.name));
            td2.appendChild(document.createTextNode(formatBytes(f.size)));
            td3.appendChild(status);

            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);
            t.appendChild(tr);

            f.cg_element_id = status.id;
            CG_TOOLS_POE_FILES.push(f);
        }
        d.appendChild(t);

        d = document.getElementById("cg-tools-poe-file-list");
        d.classList.add("cg-poofin");
        d.style.display = "block";
        setTimeout(function(){
            d.classList.remove("cg-poofin");
            cg_tools_poe_read_files();
        }, 1500);
    }, 500);
}

function cg_tools_poe_handle_file_select(evt) {
    var files = evt.target.files;
    cg_tools_poe_file_selection(files);
}

function cg_tools_poe_handle_file_drop(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files;
    cg_tools_poe_file_selection(files);
}

function cg_button_click_proof_of_existence() {
    var tool_name = document.getElementById("cg-tools-span-tool-name");
    while (tool_name.hasChildNodes()) tool_name.removeChild(tool_name.lastChild);
    tool_name.appendChild(document.createTextNode(CG_TXT_TOOLS_BTN_PROOF_OF_EXISTENCE[CG_LANGUAGE].toLowerCase()));

    var tool_desc = document.getElementById("cg-tools-p-tool-desc");
    while (tool_desc.hasChildNodes()) tool_desc.removeChild(tool_desc.lastChild);
    tool_desc.appendChild(document.createTextNode(CG_TXT_TOOLS_BTN_PROOF_OF_EXISTENCE.description[CG_LANGUAGE]));
}

function cg_button_click_address_decoder() {

}

function cg_button_click_transaction_decoder() {

}

