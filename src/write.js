var CG_WRITE_ENCODE_TIME = 0;
var CG_WRITE_CHUNKS = [];
var CG_WRITE_MIN_BTC_OUTPUT = 0.00002730;
var CG_WRITE_MAX_TX_SIZE = 100000;

function cg_construct_write(main) {
    var div = cg_init_tab(main, 'cg-tab-write');
    if (div === null) {
        var btn = document.getElementById("cg-write-btn-save");
        if (btn) btn.disabled = false;
        return;
    }
    
    div.classList.add("cg-write-tab");    
    
    /*
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

    var text = document.createTextNode(CG_TXT_WRITE_COMING_SOON[CG_LANGUAGE]);

    wrapper.appendChild(text);
    cell.appendChild(wrapper);
    table.appendChild(cell);
    div.appendChild(table);
    */
    
    var main_area = document.createElement("div");
    var side_area = document.createElement("div");
    var addr_area = document.createElement("div");
    var btns_area = document.createElement("div");
    var text_area = document.createElement("textarea");
    var info_area = document.createElement("div");

    main_area.classList.add("cg-write-main");
    main_area.classList.add("cg-borderbox");
    side_area.classList.add("cg-write-side");
    side_area.classList.add("cg-borderbox");
    addr_area.classList.add("cg-write-addr");
    addr_area.classList.add("cg-borderbox");
    btns_area.classList.add("cg-write-btns");
    text_area.classList.add("cg-write-text");
    text_area.classList.add("cg-borderbox");
    info_area.classList.add("cg-write-info");
    info_area.classList.add("cg-borderbox");

    text_area.id="cg-write-textarea";
    addr_area.id="cg-write-addresses";
    info_area.id="cg-write-infoarea";

    var info_table = document.createElement("table");
    var caption    = document.createElement("caption");
    var tr1        = document.createElement("tr");
    var tr2        = document.createElement("tr");
    var tr3        = document.createElement("tr");
    var tr4        = document.createElement("tr");
    var td1_tr1    = document.createElement("td");
    var td2_tr1    = document.createElement("td");
    var td1_tr2    = document.createElement("td");
    var td2_tr2    = document.createElement("td");
    var td1_tr3    = document.createElement("td");
    var td2_tr3    = document.createElement("td");
    var td1_tr4    = document.createElement("td");
    var td2_tr4    = document.createElement("td");
    var span_size  = document.createElement("span"); span_size.id="cg-write-msg-size";
    var span_cost  = document.createElement("span"); span_cost.id="cg-write-msg-cost";
    var span_file  = document.createElement("span"); span_file.id="cg-write-msg-file";
    var span_hash  = document.createElement("span"); span_hash.id="cg-write-msg-hash";
    caption.appendChild(document.createTextNode(CG_TXT_WRITE_NEW_MSG[CG_LANGUAGE]));
    td1_tr1.appendChild(document.createTextNode(CG_TXT_WRITE_NEW_MSG_SIZE[CG_LANGUAGE]));
    td2_tr1.appendChild(span_size);
    td1_tr2.appendChild(document.createTextNode(CG_TXT_WRITE_NEW_MSG_COST[CG_LANGUAGE]));
    td2_tr2.appendChild(span_cost);
    td1_tr3.appendChild(document.createTextNode(CG_TXT_WRITE_NEW_MSG_FILE[CG_LANGUAGE]));
    td2_tr3.appendChild(span_file);
    td1_tr4.appendChild(document.createTextNode(CG_TXT_WRITE_NEW_MSG_HASH[CG_LANGUAGE]));
    td2_tr4.appendChild(span_hash);
    tr1.appendChild(td1_tr1);
    tr1.appendChild(td2_tr1);
    tr2.appendChild(td1_tr2);
    tr2.appendChild(td2_tr2);
    tr3.appendChild(td1_tr3);
    tr3.appendChild(td2_tr3);
    tr4.appendChild(td1_tr4);
    tr4.appendChild(td2_tr4);
    info_table.appendChild(caption);
    info_table.appendChild(tr1);
    info_table.appendChild(tr2);
    info_table.appendChild(tr3);
    info_table.appendChild(tr4);
    info_table.id="cg-write-infotable";
    info_area.appendChild(info_table);

    if (text_area.addEventListener) {
        text_area.addEventListener('input', function() {
            // event handling code for sane browsers
            cg_write_update(true);
        }, false);
    } else if (text_area.attachEvent) {
        text_area.attachEvent('onpropertychange', function() {
            // IE-specific event handling code
            cg_write_update(true);
        });
    }
    text_area.placeholder = CG_TXT_WRITE_MSG_PLACEHOLDER[CG_LANGUAGE];

    side_area.appendChild(addr_area);
    side_area.appendChild(btns_area);
    main_area.appendChild(info_area);
    main_area.appendChild(text_area);
    
    var btn_1 = document.createElement("BUTTON"); btn_1.classList.add("cg-write-btn"); btn_1.disabled = true;
    var btn_2 = document.createElement("BUTTON"); btn_2.classList.add("cg-write-btn"); btn_2.disabled = true;
    var btn_3 = document.createElement("BUTTON"); btn_3.classList.add("cg-write-btn"); btn_3.disabled = true;
    var btn_4 = document.createElement("BUTTON"); btn_4.classList.add("cg-write-btn"); btn_4.disabled = true;

    if (window.File && window.FileReader && window.FileList && window.Blob) btn_4.disabled = false;

    var txt_1 = document.createTextNode(CG_TXT_WRITE_BTN_SELECT_ALL[CG_LANGUAGE]);
    var txt_2 = document.createTextNode(CG_TXT_WRITE_BTN_TO_WALLET [CG_LANGUAGE]);
    var txt_3 = document.createTextNode(CG_TXT_WRITE_BTN_SAVE      [CG_LANGUAGE]);
    var txt_4 = document.createTextNode(CG_TXT_WRITE_BTN_ATTACH    [CG_LANGUAGE]);
    btn_1.appendChild(txt_1);
    btn_2.appendChild(txt_2);
    btn_3.appendChild(txt_3); btn_3.addEventListener("click", cg_button_click_save);
    btn_3.id = "cg-write-btn-save";
    btn_4.appendChild(txt_4); btn_4.addEventListener("click", cg_button_click_attach);
    btn_4.id = "cg-write-btn-file";
    btns_area.appendChild(btn_4);
    btns_area.appendChild(btn_1);
    btns_area.appendChild(btn_2);
    btns_area.appendChild(btn_3);

    div.appendChild(main_area);
    div.appendChild(side_area);
    cg_write_update(true);
    cg_write_reset_file_input();
}

function cg_write_reset_file_input() {
    var info_area = document.getElementById("cg-write-infoarea");
    var input = document.getElementById("cg-write-msg-file-input");
    if (input !== null) {
        input.parentElement.removeChild(input);
    }

    var file_input = document.createElement('input');
    file_input.type="file";
    file_input.addEventListener('change', cg_write_handle_file_select, false);
    file_input.id="cg-write-msg-file-input";
    file_input.style.display="none";
    info_area.appendChild(file_input);
}

function cg_write_update(instant) {
    if (!instant) CG_WRITE_ENCODE_TIME--;

    var area = document.getElementById("cg-write-textarea");
    var addr = document.getElementById("cg-write-addresses");
    var btn  = document.getElementById("cg-write-btn-save");

    if (area === null || addr === null || btn === null) return;

    if (area.value.length === 0) btn.disabled = true;
    else                         btn.disabled = false;

    if (instant && CG_WRITE_ENCODE_TIME >= 0 && area.value.length > 200) return;
    if (instant && CG_WRITE_ENCODE_TIME < 0) CG_WRITE_ENCODE_TIME = 3;
    if (!instant && CG_WRITE_ENCODE_TIME !== 0) return;

    var text = unescape(encodeURIComponent(area.value));
    var chunks = Bitcoin.genAddressesFromText(text);
    CG_WRITE_CHUNKS = chunks;
    
    var sz = chunks.length;
    text = "";
    for (var i = 0; i < sz; i++) {
        text+=chunks[i]+"\n"
    }    

    while (addr.hasChildNodes()) {
        addr.removeChild(addr.lastChild);
    }

    addr.appendChild(document.createTextNode(text));
    
    var inputs  = 1;
    var outputs = sz;
    var tx_size = inputs*181 + outputs*34 + 10;
    var tx_fee  = Math.ceil(tx_size/1000) * 0.0001;
    var tx_cost = CG_WRITE_MIN_BTC_OUTPUT*outputs + tx_fee;

    if (outputs === 0) {
        tx_size = 0;
        tx_cost = 0;
    }

    var size_span = document.getElementById("cg-write-msg-size");
    var cost_span = document.getElementById("cg-write-msg-cost");

    while (size_span.hasChildNodes()) size_span.removeChild(size_span.lastChild);
    size_span.appendChild(document.createTextNode((tx_size/1024).toFixed(8)+" KiB"));

    while (cost_span.hasChildNodes()) cost_span.removeChild(cost_span.lastChild);
    cost_span.appendChild(document.createTextNode((tx_cost).toFixed(8)+" BTC"));
}

function cg_button_click_save() {
    var btn = document.getElementById("cg-btn-tab-write");
    if (CG_CAPTCHA_TOKEN === null) cg_button_click_captcha(cg_button_click_save, cg_button_click_write);
    else                           cg_button_click(btn, cg_construct_save);
}

function cg_button_click_attach() {
    var input = document.getElementById("cg-write-msg-file-input");
    input.click();
}

function cg_button_click_detach() {
    var file_span = document.getElementById("cg-write-msg-file");
    while (file_span.hasChildNodes()) file_span.removeChild(file_span.lastChild);

    var btn = document.getElementById("cg-write-btn-file");
    while (btn.hasChildNodes()) btn.removeChild(btn.lastChild);
    btn.appendChild(document.createTextNode(CG_TXT_WRITE_BTN_ATTACH[CG_LANGUAGE]));
    btn.removeEventListener("click", cg_button_click_detach);
    btn.addEventListener("click", cg_button_click_attach);
    cg_write_reset_file_input();
}

function cg_write_handle_file_select(evt) {
    var files = evt.target.files;
    var output = [];
    for (var i = 0, f; f = files[i]; i++) {
        if (f.size > 50*1024) {
            CG_STATUS.push("!"+sprintf(CG_TXT_WRITE_ERROR_FILE_SIZE[CG_LANGUAGE], f.name, "50 KiB"));
            cg_write_reset_file_input();
            break;
        }

        var file_span = document.getElementById("cg-write-msg-file");
        while (file_span.hasChildNodes()) file_span.removeChild(file_span.lastChild);
        file_span.appendChild(document.createTextNode(f.name));

        var btn = document.getElementById("cg-write-btn-file");
        while (btn.hasChildNodes()) btn.removeChild(btn.lastChild);
        btn.appendChild(document.createTextNode(CG_TXT_WRITE_BTN_DETACH[CG_LANGUAGE]));
        btn.removeEventListener("click", cg_button_click_attach);
        btn.addEventListener("click", cg_button_click_detach);
        break;
    }
}

