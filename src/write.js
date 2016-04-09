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
    var info_area = document.createElement("div");
    var btns_area = document.createElement("div");
    var text_area = document.createElement("textarea");

    main_area.classList.add("cg-write-main");
    main_area.classList.add("cg-borderbox");
    side_area.classList.add("cg-write-side");
    side_area.classList.add("cg-borderbox");
    info_area.classList.add("cg-write-info");
    info_area.classList.add("cg-borderbox");
    btns_area.classList.add("cg-write-btns");
    text_area.classList.add("cg-write-text");
    text_area.classList.add("cg-borderbox");

    text_area.id="cg-write-textarea";
    info_area.id="cg-write-addresses"

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

    side_area.appendChild(info_area);
    side_area.appendChild(btns_area);
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

