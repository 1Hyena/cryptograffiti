var CG_WRITE_ENCODE_TIME = 0;
var CG_WRITE_CHUNKS = [];

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
    caption.appendChild(document.createTextNode("New Block Chain Message"));
    td1_tr1.appendChild(document.createTextNode("Size:"));
    td2_tr1.appendChild(document.createTextNode("1 KiB"));
    td1_tr2.appendChild(document.createTextNode("Cost:"));
    td2_tr2.appendChild(document.createTextNode("~0.00010000 BTC"));
    td1_tr3.appendChild(document.createTextNode("File:"));
    td2_tr3.appendChild(document.createTextNode("N/A"));
    td1_tr4.appendChild(document.createTextNode("Hash:"));
    td2_tr4.appendChild(document.createTextNode("N/A"));
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
    var txt_1 = document.createTextNode(CG_TXT_WRITE_BTN_SELECT_ALL[CG_LANGUAGE]);
    var txt_2 = document.createTextNode(CG_TXT_WRITE_BTN_TO_WALLET [CG_LANGUAGE]);
    var txt_3 = document.createTextNode(CG_TXT_WRITE_BTN_SAVE      [CG_LANGUAGE]);
    btn_1.appendChild(txt_1);
    btn_2.appendChild(txt_2);
    btn_3.appendChild(txt_3); btn_3.addEventListener("click", cg_button_click_save);
    btn_3.id = "cg-write-btn-save";
    btns_area.appendChild(btn_1);
    btns_area.appendChild(btn_2);
    btns_area.appendChild(btn_3);

    div.appendChild(main_area);
    div.appendChild(side_area);
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
}

