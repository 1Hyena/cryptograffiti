var CG_WRITE_ENCODE_TIME = 0;
var CG_WRITE_CHUNKS = [];
var CG_WRITE_MIN_BTC_OUTPUT = 0.00002730;//0.0000001;//
var CG_WRITE_MAX_TX_SIZE = 100000;//174271;//
var CG_WRITE_MAX_FILE_SIZE_KiB = 50;//100;//
var CG_WRITE_FILE_NAME  = null;
var CG_WRITE_FILE_TYPE  = null;
var CG_WRITE_FILE_BYTES = null;
var CG_WRITE_FILE_CHUNKS = [];
var CG_WRITE_FILE_HASH = null;
var CG_WRITE_FEE_PER_KB = 0.0001;
var CG_WRITE_FEE_API_DELAY = 5;
var CG_WRITE_STATE = "cg-write-textarea";
var CG_WRITE_PAY_TO = null;
var CG_WRITE_PAY_AMOUNT = null;
var CG_WRITE_AREA_LAST_VALUE = "";

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
    var payment_area = document.createElement("div"); payment_area.style.display="none";
    var preview_area = document.createElement("div"); preview_area.style.display="none";

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

    btns_area.id="cg-write-btnsarea";
    text_area.id="cg-write-textarea";
    addr_area.id="cg-write-addresses";
    info_area.id="cg-write-infoarea";
    payment_area.id="cg-write-paymentarea";
    preview_area.id="cg-write-previewarea";

    var payment_wrap  = document.createElement("div");
    payment_wrap.style.marginLeft="auto";
    payment_wrap.style.marginRight="auto";
    var helper_table = document.createElement("div");
    helper_table.style.width="100%";
    helper_table.style.height="100%";
    helper_table.style.display="table";
    var helper_cell = document.createElement("div");
    helper_cell.style.display="table-cell";
    helper_cell.style.verticalAlign="middle";
    var payment_table = create_payment_table("cg-write-paymenttable");
    payment_wrap.appendChild(payment_table);
    helper_cell.appendChild(payment_wrap);
    helper_table.appendChild(helper_cell);
    payment_area.appendChild(helper_table);

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

    var span_payment=document.createElement("span"); span_payment.id="cg-write-msg-payment";
    info_area.appendChild(span_payment);

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
    
    var writecore = document.createElement("div");
    writecore.id = "cg-write-core";
    writecore.appendChild(payment_area);
    writecore.appendChild(text_area);
    writecore.appendChild(preview_area);
    main_area.appendChild(writecore);

    var btn_1 = document.createElement("BUTTON"); btn_1.classList.add("cg-write-btn");
    var btn_2 = document.createElement("BUTTON"); btn_2.classList.add("cg-write-btn"); btn_2.disabled = true;
    var btn_3 = document.createElement("BUTTON"); btn_3.classList.add("cg-write-btn"); btn_3.disabled = true;
    var btn_4 = document.createElement("BUTTON"); btn_4.classList.add("cg-write-btn"); btn_4.disabled = true;
    var btn_5 = document.createElement("BUTTON"); btn_5.classList.add("cg-write-btn");
    var btn_6 = document.createElement("BUTTON"); btn_6.classList.add("cg-write-btn"); btn_6.disabled = true;
    var btn_7 = document.createElement("BUTTON"); btn_7.classList.add("cg-write-btn");
    var btn_8 = document.createElement("BUTTON"); btn_8.classList.add("cg-write-btn");

    if (window.File && window.FileReader && window.FileList && window.Blob) btn_4.disabled = false;

    var txt_1 = document.createTextNode(CG_TXT_WRITE_BTN_SELECT_ALL [CG_LANGUAGE]);
    var txt_2 = document.createTextNode(CG_TXT_WRITE_BTN_TO_WALLET  [CG_LANGUAGE]);
    var txt_3 = document.createTextNode(CG_TXT_WRITE_BTN_SAVE       [CG_LANGUAGE]);
    var txt_4 = document.createTextNode(CG_TXT_WRITE_BTN_ATTACH     [CG_LANGUAGE]);
    var txt_5 = document.createTextNode(CG_TXT_WRITE_BTN_ADD_PAYMENT[CG_LANGUAGE]);
    var txt_6 = document.createTextNode(CG_TXT_WRITE_BTN_PREVIEW    [CG_LANGUAGE]);
    var txt_7 = document.createTextNode(CG_TXT_CAPTCHA_BTN_NEXT     [CG_LANGUAGE]);
    var txt_8 = document.createTextNode(CG_TXT_CAPTCHA_BTN_BACK     [CG_LANGUAGE]);
    btn_1.appendChild(txt_1); btn_1.addEventListener("click", cg_button_click_select_all);
    btn_2.appendChild(txt_2);
    btn_3.appendChild(txt_3); btn_3.addEventListener("click", cg_button_click_save);
    btn_3.id = "cg-write-btn-save";
    btn_4.appendChild(txt_4); btn_4.addEventListener("click", cg_button_click_attach);
    btn_4.id = "cg-write-btn-file";
    btn_5.appendChild(txt_5); btn_5.addEventListener("click", cg_button_click_payment);
    btn_5.id = "cg-write-btn-payment";
    btn_6.appendChild(txt_6); btn_6.addEventListener("click", cg_button_click_preview);
    btn_6.id = "cg-write-btn-preview";
    btn_7.appendChild(txt_7); btn_7.addEventListener("click", cg_button_click_payment_next);
    btn_7.style.width="50%";
    btn_7.id = "cg-write-btn-payment-next";
    btn_8.appendChild(txt_8); btn_8.addEventListener("click", cg_button_click_payment_back);
    btn_8.style.width="50%";
    btns_area.appendChild(btn_4);
    btns_area.appendChild(btn_5);
    btns_area.appendChild(btn_1);
    btns_area.appendChild(btn_2);
    btns_area.appendChild(btn_6);
    btns_area.appendChild(btn_3);

    payment_wrap.appendChild(document.createElement("br"));
    payment_wrap.appendChild(btn_8);
    payment_wrap.appendChild(btn_7);

    div.appendChild(main_area);
    div.appendChild(side_area);
    cg_write_update_now();
    cg_write_reset_file_input();
}

function create_payment_table(id) {
    var addr = document.createElement("input");
    var amnt = document.createElement("input");

    addr.placeholder = CG_TXT_WRITE_PAYMENT_ADDRESS_PLACEHOLDER[CG_LANGUAGE];
    amnt.placeholder = CG_TXT_WRITE_PAYMENT_AMOUNT_PLACEHOLDER[CG_LANGUAGE];

    addr.classList.add("cg-save-order-input"); addr.size = "40"; addr.id="cg-write-payment-addr-input";
    amnt.classList.add("cg-save-order-input"); amnt.size = "40"; amnt.id="cg-write-payment-amnt-input";
    addr.maxLength = "34";
    amnt.maxLength = "17";
    amnt.type = "number";
    amnt.min  = ""+CG_WRITE_MIN_BTC_OUTPUT;
    amnt.max  = "21000000";

    var table      = document.createElement("table");
    var caption    = document.createElement("caption");
    var tr1        = document.createElement("tr");
    var tr2        = document.createElement("tr");
    var td1_tr1    = document.createElement("td");
    var td2_tr1    = document.createElement("td");
    var td1_tr2    = document.createElement("td");
    var td2_tr2    = document.createElement("td");
    caption.appendChild(document.createTextNode(CG_TXT_WRITE_PAYMENT_CAPTION[CG_LANGUAGE]));
    td1_tr1.appendChild(document.createTextNode(CG_TXT_WRITE_PAYMENT_RECEIVER[CG_LANGUAGE]));
    td2_tr1.appendChild(addr);
    td1_tr2.appendChild(document.createTextNode(CG_TXT_WRITE_PAYMENT_AMOUNT[CG_LANGUAGE]));
    td2_tr2.appendChild(amnt);
    tr1.appendChild(td1_tr1);
    tr1.appendChild(td2_tr1);
    tr2.appendChild(td1_tr2);
    tr2.appendChild(td2_tr2);
    table.appendChild(caption);
    table.appendChild(tr1);
    table.appendChild(tr2);
    table.id=id;
    return table;
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
//  file_input.accept="image/*";
    info_area.appendChild(file_input);
    CG_WRITE_FILE_NAME = null;
    CG_WRITE_FILE_TYPE = null;
    CG_WRITE_FILE_BYTES = null;
    CG_WRITE_FILE_CHUNKS = [];
    CG_WRITE_FILE_HASH = null;

    var file_span = document.getElementById("cg-write-msg-file");
    while (file_span.hasChildNodes()) file_span.removeChild(file_span.lastChild);

    var hash_span = document.getElementById("cg-write-msg-hash");
    while (hash_span.hasChildNodes()) hash_span.removeChild(hash_span.lastChild);

    cg_write_update_now();
}

function cg_write_update_now() {
    var buf = CG_WRITE_ENCODE_TIME;
    CG_WRITE_ENCODE_TIME = -1;
    cg_write_update(true);
    CG_WRITE_ENCODE_TIME = buf;
}

function cg_write_update(instant) {
    if (!instant) {
        CG_WRITE_ENCODE_TIME--;
        CG_WRITE_FEE_API_DELAY--;
        if (CG_WRITE_FEE_API_DELAY === 0) {
            cg_write_estimate_fee();
        }
    }

    var btn_preview = document.getElementById("cg-write-btn-preview");
    if (CG_WRITE_CHUNKS.length == 0) btn_preview.disabled = true;
    else                             btn_preview.disabled = false;

    var area = document.getElementById("cg-write-textarea");
    var addr = document.getElementById("cg-write-addresses");
    var btn  = document.getElementById("cg-write-btn-save");
    var size_span = document.getElementById("cg-write-msg-size");
    var cost_span = document.getElementById("cg-write-msg-cost");

    if (area === null || addr === null || btn === null) return;

    if (area.value.length === 0 && CG_WRITE_FILE_CHUNKS.length === 0) btn.disabled = true;
    else if (!size_span.classList.contains("cg-status-warning"))      btn.disabled = false;

    if (instant && CG_WRITE_ENCODE_TIME >= 0 && (area.value.length > 200 || CG_WRITE_FILE_CHUNKS.length > 10)) return;
    if (instant && CG_WRITE_ENCODE_TIME < 0) CG_WRITE_ENCODE_TIME = 3;
    if (!instant && CG_WRITE_ENCODE_TIME !== 0 && area.value === CG_WRITE_AREA_LAST_VALUE) return;
    CG_WRITE_AREA_LAST_VALUE = area.value;

    var file_hash = [];
    if (CG_WRITE_FILE_HASH !== null) file_hash.push(CG_WRITE_FILE_HASH);
    var text = unescape(encodeURIComponent(area.value));
    var chunks = CG_WRITE_FILE_CHUNKS.concat(file_hash, Bitcoin.genAddressesFromText(text));

    var scroll = false;
    if (CG_WRITE_CHUNKS.length < chunks.length) scroll = true;
    CG_WRITE_CHUNKS = chunks;

    var sz = chunks.length;
    text = "";
    for (var i = 0; i < sz; i++) {
        //text+=ascii2hex(Bitcoin.getAddressPayload(chunks[i]))+"\n";
        text+=chunks[i]+"\n";
    }    

    while (addr.hasChildNodes()) addr.removeChild(addr.lastChild);
    addr.appendChild(document.createTextNode(text));

    var inputs  = 1;
    var outputs = sz;
    var tx_size = inputs*181 + outputs*34 + 10;
    var tx_fee  = Math.ceil(tx_size/1000) * CG_WRITE_FEE_PER_KB;
    var tx_cost = CG_WRITE_MIN_BTC_OUTPUT*outputs + tx_fee;

    if (outputs === 0) {
        tx_size = 0;
        tx_cost = 0;
    }

    while (size_span.hasChildNodes()) size_span.removeChild(size_span.lastChild);
    size_span.appendChild(document.createTextNode((tx_size/1024).toFixed(8)+" KiB"));

    while (cost_span.hasChildNodes()) cost_span.removeChild(cost_span.lastChild);
    cost_span.appendChild(document.createTextNode((tx_cost).toFixed(8)+" BTC"));

    if (tx_size > CG_WRITE_MAX_TX_SIZE) {
        btn.disabled = true;
        size_span.classList.add("cg-status-warning");
    }
    else if (size_span.classList.contains("cg-status-warning")) {
        size_span.classList.remove("cg-status-warning");
    }

    if (scroll) addr.scrollTop = addr.scrollHeight;
}

function cg_button_click_save() {
    if (CG_WRITE_STATE !== "cg-write-textarea") return;

    cg_write_update_now();
    var btn = document.getElementById("cg-btn-tab-write");
    if (CG_CAPTCHA_TOKEN === null) cg_button_click_captcha(cg_button_click_save, cg_button_click_write);
    else                           cg_button_click(btn, cg_construct_save);
}

function cg_button_click_attach() {
    if (CG_WRITE_STATE !== "cg-write-textarea") return;

    var input = document.getElementById("cg-write-msg-file-input");
    input.click();
}

function cg_button_click_select_all() {
    selectText("cg-write-addresses");
}

function cg_button_click_payment() {
    if (CG_WRITE_STATE !== "cg-write-textarea") return;

    if (CG_WRITE_PAY_TO !== null || CG_WRITE_PAY_AMOUNT !== null) {
        CG_WRITE_PAY_TO = null;
        CG_WRITE_PAY_AMOUNT = null;

        var payment_btn = document.getElementById("cg-write-btn-payment");
        while (payment_btn.hasChildNodes()) payment_btn.removeChild(payment_btn.lastChild);
        payment_btn.appendChild(document.createTextNode(CG_TXT_WRITE_BTN_ADD_PAYMENT[CG_LANGUAGE]));

        var payment_span = document.getElementById("cg-write-msg-payment");
        while (payment_span.hasChildNodes()) payment_span.removeChild(payment_span.lastChild);

        return;
    }

    var state = document.getElementById(CG_WRITE_STATE);
    state.classList.remove("cg-poofin");
    state.classList.add("cg-poofout");
    CG_WRITE_STATE = null;

    var btnsarea = document.getElementById("cg-write-btnsarea");
    btnsarea.classList.remove("cg-appear");
    btnsarea.classList.add("cg-disappear");

    setTimeout(function(){
        CG_WRITE_STATE = "cg-write-paymentarea";
        state.style.display = "none";
        state.classList.remove("cg-poofout");

        var paymentarea = document.getElementById(CG_WRITE_STATE);
        paymentarea.style.display = "block";
        paymentarea.classList.add("cg-appear");
    }, 200);
}

function cg_button_click_payment_next() {
    if (CG_WRITE_STATE !== "cg-write-paymentarea") return;

    var addr = document.getElementById("cg-write-payment-addr-input");
    var amnt = document.getElementById("cg-write-payment-amnt-input");
    var btn  = document.getElementById("cg-write-btn-payment-next");

    var addr_value = addr.value.trim();
    if (addr_value.length === 0) {
        CG_STATUS.push("!"+CG_TXT_WRITE_EMPTY_BTC_ADDRESS[CG_LANGUAGE]);
        btn.disabled = true;
        setTimeout(function(){
            btn.disabled = false;
        }, 2000);
        return;
    }

    if (!Bitcoin.testAddress(addr_value)) {
        CG_STATUS.push("!"+sprintf(CG_TXT_WRITE_INVALID_BTC_ADDRESS[CG_LANGUAGE], addr_value));
        btn.disabled = true;
        setTimeout(function(){
            btn.disabled = false;
        }, 2000);
        return;
    }
    
    var amnt_value = amnt.value.trim();
    var msg = cg_write_check_amount(amnt_value);
    if (msg !== "") {
        CG_STATUS.push("!"+msg);
        btn.disabled = true;
        setTimeout(function(){
            btn.disabled = false;
        }, 2000);
        return;
    }

    CG_WRITE_PAY_TO     = addr_value;
    CG_WRITE_PAY_AMOUNT = Math.floor(parseFloat(amnt_value)*100000000)/100000000;

    var payment_btn = document.getElementById("cg-write-btn-payment");
    while (payment_btn.hasChildNodes()) payment_btn.removeChild(payment_btn.lastChild);
    payment_btn.appendChild(document.createTextNode(CG_TXT_WRITE_BTN_REMOVE_PAYMENT[CG_LANGUAGE]));

    var payment_span = document.getElementById("cg-write-msg-payment");
    while (payment_span.hasChildNodes()) payment_span.removeChild(payment_span.lastChild);
    msg = sprintf(CG_TXT_WRITE_MSG_PAYMENT[CG_LANGUAGE], CG_WRITE_PAY_AMOUNT.toFixed(8), addr_value);
    payment_span.appendChild(document.createTextNode( msg ));

    cg_button_click_payment_back();
}

function cg_button_click_payment_back() {
    if (CG_WRITE_STATE !== "cg-write-paymentarea") return;

    var state = document.getElementById(CG_WRITE_STATE);
    state.classList.remove("cg-appear");
    state.classList.add("cg-disappear");
    CG_WRITE_STATE = null;

    var btnsarea = document.getElementById("cg-write-btnsarea");
    btnsarea.classList.remove("cg-disappear");
    btnsarea.classList.add("cg-appear");

    setTimeout(function(){
        CG_WRITE_STATE = "cg-write-textarea";
        state.style.display = "none";
        state.classList.remove("cg-disappear");

        var textarea = document.getElementById(CG_WRITE_STATE);
        textarea.style.display = "block";
        textarea.classList.add("cg-poofin");
    }, 500);
}

function cg_button_click_detach() {
    if (CG_WRITE_STATE !== "cg-write-textarea") return;

    var file_span = document.getElementById("cg-write-msg-file");
    while (file_span.hasChildNodes()) file_span.removeChild(file_span.lastChild);

    var btn = document.getElementById("cg-write-btn-file");
    while (btn.hasChildNodes()) btn.removeChild(btn.lastChild);
    btn.appendChild(document.createTextNode(CG_TXT_WRITE_BTN_ATTACH[CG_LANGUAGE]));
    btn.removeEventListener("click", cg_button_click_detach);
    btn.addEventListener("click", cg_button_click_attach);
    cg_write_reset_file_input();
}

function cg_button_click_preview() {
    if (CG_WRITE_STATE !== "cg-write-textarea") return;

    var state = document.getElementById(CG_WRITE_STATE);
    state.classList.remove("cg-poofin");
    state.classList.add("cg-poofout");
    CG_WRITE_STATE = null;

    var btnsarea = document.getElementById("cg-write-btnsarea");
    btnsarea.classList.remove("cg-appear");
    btnsarea.classList.add("cg-disappear");
    cg_write_update_now();

    setTimeout(function(){
        CG_WRITE_STATE = "cg-write-previewarea";
        state.style.display = "none";
        state.classList.remove("cg-poofout");

        var previewarea = document.getElementById(CG_WRITE_STATE);
        while (previewarea.hasChildNodes()) previewarea.removeChild(previewarea.lastChild);

        var msgbox = cg_write_create_msgbox(CG_WRITE_CHUNKS, CG_WRITE_FILE_TYPE);
        previewarea.appendChild(msgbox);
        previewarea.appendChild(document.createElement("br"));

        var btn = document.createElement("BUTTON"); btn.classList.add("cg-write-btn");
        btn.appendChild(document.createTextNode(CG_TXT_CAPTCHA_BTN_BACK[CG_LANGUAGE]));
        btn.addEventListener("click", cg_button_click_preview_back);
        previewarea.appendChild(btn);

        previewarea.style.display = "block";
        previewarea.classList.add("cg-appear");
    }, 200);
}

function cg_button_click_preview_back() {
    if (CG_WRITE_STATE !== "cg-write-previewarea") return;

    var state = document.getElementById(CG_WRITE_STATE);
    state.classList.remove("cg-appear");
    state.classList.add("cg-disappear");
    CG_WRITE_STATE = null;

    var btnsarea = document.getElementById("cg-write-btnsarea");
    btnsarea.classList.remove("cg-disappear");
    btnsarea.classList.add("cg-appear");

    setTimeout(function(){
        CG_WRITE_STATE = "cg-write-textarea";
        state.style.display = "none";
        state.classList.remove("cg-disappear");

        var textarea = document.getElementById(CG_WRITE_STATE);
        textarea.style.display = "block";
        textarea.classList.add("cg-poofin");
    }, 500);
}

function cg_write_handle_file_select(evt) {
    var files = evt.target.files;
    var output = [];
    for (var i = 0, f; f = files[i]; i++) {
        if (f.size > CG_WRITE_MAX_FILE_SIZE_KiB*1024) {
            CG_STATUS.push("!"+sprintf(CG_TXT_WRITE_ERROR_FILE_SIZE[CG_LANGUAGE], f.name, CG_WRITE_MAX_FILE_SIZE_KiB+" KiB"));
            cg_write_reset_file_input();
            break;
        }

        document.getElementById("cg-write-btn-file").disabled = true;
        var reader = new FileReader();

        reader.onloadend = (function(theFile) {
            return function(evt) {
                if (evt.target.readyState == FileReader.DONE) {
                    document.getElementById("cg-write-btn-file").disabled = false;
                    if (evt.target.result !== null && evt.target.result.byteLength === theFile.size) {
                        CG_WRITE_FILE_NAME = theFile.name;
                        CG_WRITE_FILE_TYPE = theFile.type;
                        var file_span = document.getElementById("cg-write-msg-file");
                        while (file_span.hasChildNodes()) file_span.removeChild(file_span.lastChild);
                        file_span.appendChild(document.createTextNode(theFile.name));

                        var btn = document.getElementById("cg-write-btn-file");
                        while (btn.hasChildNodes()) btn.removeChild(btn.lastChild);
                        btn.appendChild(document.createTextNode(CG_TXT_WRITE_BTN_DETACH[CG_LANGUAGE]));
                        btn.removeEventListener("click", cg_button_click_attach);
                        btn.addEventListener("click", cg_button_click_detach);

                        CG_WRITE_FILE_BYTES = evt.target.result;
                        var txt = Uint8ToString(new Uint8Array(CG_WRITE_FILE_BYTES));
                        CG_WRITE_FILE_CHUNKS = Bitcoin.genAddressesFromText(txt, false);

                        /*var ripemd160 = CryptoJS.algo.RIPEMD160.create(); 
                        ripemd160.update(txt);
                        var hash = ripemd160.finalize();*/
                        var hash = CryptoJS.RIPEMD160(arrayBufferToWordArray(CG_WRITE_FILE_BYTES)).toString();
                        CG_WRITE_FILE_HASH = Bitcoin.createAddressFromText(hex2ascii(hash));

                        var hash_span = document.getElementById("cg-write-msg-hash");
                        while (hash_span.hasChildNodes()) hash_span.removeChild(hash_span.lastChild);
                        hash_span.appendChild(document.createTextNode(CG_WRITE_FILE_HASH));

                        cg_write_update_now();
                        return;
                    }

                    CG_STATUS.push("!"+sprintf(CG_TXT_WRITE_ERROR_FILE_LOAD[CG_LANGUAGE], f.name));
                    cg_write_reset_file_input();
                }
            };
        })(f);

        reader.readAsArrayBuffer(f);

        break;
    }
}

function cg_write_estimate_fee() {
    xmlhttpGet('https://bitcoinfees.21.co/api/v1/fees/recommended', '',
        function(json) {                
            var status = "???";
            var success = false;

                 if (json === false) status = sprintf(CG_TXT_MAIN_API_ERROR[CG_LANGUAGE], "bitcoinfees.21.co");
            else if (json === null ) status = sprintf(CG_TXT_MAIN_API_TIMEOUT[CG_LANGUAGE], "bitcoinfees.21.co");
            else {
                var response = JSON.parse(json);

                if (typeof response === 'object' && isNumeric(response.hourFee)) {
                    var hourfee = Number(response.hourFee);
                    if (hourfee > 0) {
                        var new_fee = 0.00000001*(hourfee*1000);
                        if (CG_WRITE_FEE_PER_KB !== new_fee) {
                            CG_WRITE_FEE_PER_KB = new_fee;
                            cg_write_update_now();
                        }

                        status = sprintf(CG_TXT_WRITE_TX_FEE_PER_KB[CG_LANGUAGE], CG_WRITE_FEE_PER_KB.toFixed(8)+" BTC");
                    }
                    success = true;
                }
                else status = sprintf(CG_TXT_MAIN_API_INVALID_RESPONSE[CG_LANGUAGE], "bitcoinfees.21.co");
            }

            if (!success) CG_WRITE_FEE_API_DELAY = 180;
            else          CG_WRITE_FEE_API_DELAY =  60;

            CG_STATUS.push(status);
        }
    );
}

function cg_write_check_amount(str) {
    var val = parseFloat(str);
    if(isNaN(val)) return CG_TXT_WRITE_INVALID_AMOUNT[CG_LANGUAGE];

    if (val >       21000000) return CG_TXT_WRITE_INVALID_AMOUNT[CG_LANGUAGE];
    if (val <              0) return CG_TXT_WRITE_INVALID_AMOUNT[CG_LANGUAGE];
    if (val < CG_WRITE_MIN_BTC_OUTPUT) {
        return sprintf(CG_TXT_WRITE_DUST_AMOUNT[CG_LANGUAGE], CG_WRITE_MIN_BTC_OUTPUT.toFixed(8)+" BTC");
    }

    return "";
}

function cg_write_create_msgbox(CG_WRITE_CHUNKS, mimetype) {
    var msgbox     = document.createElement("DIV");
    var msgheader  = document.createElement("DIV");
    var msgheaderL = document.createElement("DIV");
    var msgheaderR = document.createElement("DIV");
    var msgbody    = document.createElement("PRE");
    var msgfooter  = document.createElement("DIV");
    var msgfooterC = document.createElement("DIV");
    
    var span = document.createElement('span');
    span.appendChild(document.createTextNode("("+CG_TXT_READ_MSG_NOT_DECODED_YET[CG_LANGUAGE]+")"));
    span.classList.add("cg-msgspan");

    msgheader.appendChild(msgheaderL);
    msgheader.appendChild(msgheaderR);
    msgbody.appendChild(span);
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
    msgbox.classList.add("cg-borderbox");

    var msg = "";
    var out_bytes= "";
    for (var j = 0, sz = CG_WRITE_CHUNKS.length; j < sz; j++) {
        out_bytes = out_bytes + Bitcoin.getAddressPayload(CG_WRITE_CHUNKS[j]);
    }

    var fsz = (CG_WRITE_FILE_BYTES !== null ? CG_WRITE_FILE_BYTES.byteLength : 0);
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

    var msg_utf8  = decode_utf8(out_bytes);
    var msg_ascii = decode_ascii(out_bytes);

    var len_utf8 = msg_utf8.length;
    var len_ascii= msg_ascii.length;
         if (len_utf8 <=        1) msg = msg_ascii;
    else if (len_utf8 < len_ascii) msg = msg_ascii;
    else                           msg = msg_utf8;

    var txt = msg;
    while (span.hasChildNodes()) span.removeChild(span.lastChild);
    span.appendChild(document.createTextNode(txt));

    var isRTL = checkRTL(txt);
    var dir = isRTL ? 'RTL' : 'LTR';
    if(dir === 'RTL') msgbody.classList.add("cg-msgbody-rtl");

    if (CG_WRITE_FILE_CHUNKS.length > 0) {
        if (mimetype.indexOf("image/") === 0) {
            var media = document.createElement("DIV");

            var b64imgData = btoa(blockchain_file == null ? out_bytes : blockchain_file);
            var img = new Image();
            img.src = "data:"+mimetype+";base64," + b64imgData;

            media.appendChild(img);
            msgbody.insertBefore(media, span);
        }
        else {
            var file_table = cg_read_create_filetable(blockchain_file, mimetype, filehash, fsz);
            file_table.classList.add("cg-read-filetable");
            msgbody.insertBefore(file_table, span);
            msgbody.insertBefore(document.createElement("BR"), span);
        }
    }

    if (isOverflowed(msgbody)) {
        msgbody.classList.add("cg-msgbody-tiny");
    }

    msgbox.style.width="100%";
    msgbox.style.height="calc(100% - 2rem)";
    msgbody.style.maxHeight="none";
    msgbody.style.height="calc(100% - 4ch)";
    return msgbox;
}


