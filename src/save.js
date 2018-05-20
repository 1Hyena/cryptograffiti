var CG_SAVE_ORDER_NR       = null;
var CG_SAVE_ORDER_GROUP    = '1';
var CG_SAVE_MAKING_ORDER   = false;
var CG_SAVE_UPDATING_ORDER = 0;
var CG_SAVE_SKIP_UPDATE    = false;
var CG_SAVE_ORDER_FILLED   = false;
var CG_SAVE_DELAY          = 0;
var CG_SAVE_ORDER_TIMEOUT  = 0;

function cg_construct_save(main) {
    var div = cg_init_tab(main, 'cg-tab-save');
    if (div === null) {
        var btn = document.getElementById("cg-save-btn-back");
        if (!btn.disabled) btn.disabled = true;
        btn = document.getElementById("cg-save-btn-wallet");
        if (!btn.disabled) btn.disabled = true;
        return;
    }

    //div.classList.add("cg-save-tab");

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
    wrapper.style.maxWidth="30rem";

    var order_nr      = document.createElement("input"); order_nr.id      = "cg-save-order-nr";
    var order_status  = document.createElement("input"); order_status.id  = "cg-save-order-status";
    var order_address = document.createElement("input"); order_address.id = "cg-save-order-address";
    var order_amount  = document.createElement("input"); order_amount.id  = "cg-save-order-amount";
    order_nr     .classList.add("cg-save-order-input"); order_nr.readOnly      = true; order_nr.size      = "44";
    order_status .classList.add("cg-save-order-input"); order_status.readOnly  = true; order_status.size  = "44";
    order_address.classList.add("cg-save-order-input"); order_address.readOnly = true; order_address.size = "44";
    order_amount .classList.add("cg-save-order-input"); order_amount.readOnly  = true; order_amount.size  = "44";

    var t  = document.createElement("table");
    var tr1 = document.createElement("tr"); // order
    var tr2 = document.createElement("tr"); // status
    var tr3 = document.createElement("tr"); // address
    var tr4 = document.createElement("tr"); // amount
    var tr5 = document.createElement("tr"); // buttons
    var td1 = document.createElement("td"); td1.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_NR[CG_LANGUAGE]));
    var td2 = document.createElement("td"); td2.appendChild(order_nr);
    var td3 = document.createElement("td"); td3.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_STATUS[CG_LANGUAGE]));
    var td4 = document.createElement("td"); td4.appendChild(order_status);
    var td5 = document.createElement("td"); td5.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_ADDRESS[CG_LANGUAGE]));
    var td6 = document.createElement("td"); td6.appendChild(order_address);
    var td7 = document.createElement("td"); td7.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_AMOUNT[CG_LANGUAGE]));
    var td8 = document.createElement("td"); td8.appendChild(order_amount);
    var td9 = document.createElement("td");
    var td10= document.createElement("td");

    tr1.appendChild(td1); tr1.appendChild(td2);
    tr2.appendChild(td3); tr2.appendChild(td4);
    tr3.appendChild(td5); tr3.appendChild(td6);
    tr4.appendChild(td7); tr4.appendChild(td8);
    tr5.appendChild(td9); tr5.appendChild(td10);

    t.appendChild(tr1);
    t.appendChild(tr2);
    t.appendChild(tr3);
    t.appendChild(tr4);
    t.appendChild(tr5);

    t.classList.add("cg-save-order-table");

    var btn_back = document.createElement("BUTTON"); btn_back.classList.add("cg-save-btn"); btn_back.disabled = true;
    var txt_back = document.createTextNode(CG_TXT_SAVE_BTN_BACK[CG_LANGUAGE]);
    btn_back.appendChild(txt_back);
    btn_back.addEventListener("click", cg_save_back);
    btn_back.id = "cg-save-btn-back";

    var btn_wallet = document.createElement("BUTTON"); btn_wallet.classList.add("cg-save-btn"); btn_wallet.disabled = true;
    var txt_wallet = document.createTextNode(CG_TXT_SAVE_BTN_WALLET[CG_LANGUAGE]);
    btn_wallet.appendChild(txt_wallet);
    btn_wallet.addEventListener("click", cg_save_wallet);
    btn_wallet.id = "cg-save-btn-wallet";

    td9.appendChild(btn_back);
    td10.appendChild(btn_wallet);

    var order_details = document.createElement("p");
    order_details.id = "cg-save-order-details";
    order_details.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_GREETING[CG_LANGUAGE]));

    var order_note = document.createElement("p");
    order_note.id = "cg-save-order-note";
    order_note.appendChild(document.createTextNode(CG_TXT_SAVE_PAYMENT_NOTE[CG_LANGUAGE]));

    wrapper.appendChild(t);
    wrapper.appendChild(order_details);
    wrapper.appendChild(document.createElement("br"));
    wrapper.appendChild(order_note);
    cell.appendChild(wrapper);
    table.appendChild(cell);
    div.appendChild(table);
}

function cg_save_pulse() {
    if (CG_SAVE_ORDER_TIMEOUT > 0 && --CG_SAVE_ORDER_TIMEOUT == 0) {
        var details = document.getElementById("cg-save-order-details");
        while (details.hasChildNodes()) details.removeChild(details.lastChild);
        details.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_TIMEOUT[CG_LANGUAGE]));
        CG_SAVE_ORDER_TIMEOUT = -1; // Indicates that timeout has occurred.
    }
}

function cg_save_back() {
    if (CG_SAVE_MAKING_ORDER) return;
    CG_SAVE_ORDER_NR = null;
    CG_SAVE_SKIP_UPDATE = true;
    CG_SAVE_ORDER_FILLED = false;

    document.getElementById("cg-save-order-nr")     .value = "";
    document.getElementById("cg-save-order-status") .value = "";
    document.getElementById("cg-save-order-address").value = "";
    document.getElementById("cg-save-order-amount") .value = "";

    var details = document.getElementById("cg-save-order-details");
    while (details.hasChildNodes()) details.removeChild(details.lastChild);

    cg_button_click_write();
}

function cg_save_wallet() {
    if (CG_SAVE_MAKING_ORDER) return;

    var addr = document.getElementById("cg-save-order-address").value;
    var amnt = document.getElementById("cg-save-order-amount").value;
    if (addr.length === 0 || amnt.length === 0) return;

    var addr_value = addr;
    try {
        addr_value = addr_value.split(":").pop().toLowerCase();
        cashaddr_parseAndConvertCashAddress("bitcoincash", addr_value);
    }
    catch (ex) {
        // Was not in CashAddr format...
        addr_value = addr;
    }
    addr = addr_value;

    var url = (CG_BTC_FORK === "cash" ? "bitcoincash:" : "bitcoin:" ) + addr + "?amount=" + amnt;
    window.open(url, "theUriFrame");
}

function cg_save_update() {
    if (CG_SAVE_SKIP_UPDATE) {
        CG_SAVE_SKIP_UPDATE = false;
        return;
    }
    if (CG_SAVE_DELAY > 0) {
        CG_SAVE_DELAY--;
        return;
    }
    cg_save_make_order();
    cg_save_get_order();

    var order_nr = document.getElementById("cg-save-order-nr");
    var value = (CG_SAVE_ORDER_NR ? ""+CG_SAVE_ORDER_NR : "");
    if (order_nr.value !== value) order_nr.value = value;

    var btn = document.getElementById("cg-save-btn-back");
    if (!btn.disabled) btn.disabled = true;
    btn = document.getElementById("cg-save-btn-wallet");
    if (!btn.disabled) btn.disabled = true;

    if (!CG_SAVE_MAKING_ORDER) {
        btn = document.getElementById("cg-save-btn-back");
        if (btn.disabled) btn.disabled = false;

        var addr = document.getElementById("cg-save-order-address").value;
        var amnt = document.getElementById("cg-save-order-amount").value;

        btn = document.getElementById("cg-save-btn-wallet");
        if (btn.disabled && CG_SAVE_ORDER_NR !== null
        &&  addr.length > 0 && amnt.length > 0) btn.disabled = false;
    }

    var addr = document.getElementById("cg-save-order-address").value;
    var amnt = document.getElementById("cg-save-order-amount").value;
    btn = document.getElementById("cg-save-btn-wallet");
    if (btn) {
        if (addr.length > 0 && amnt.length > 0 && !CG_SAVE_ORDER_FILLED) {
            var addr_value = addr;
            try {
                addr_value = addr_value.split(":").pop().toLowerCase();
                cashaddr_parseAndConvertCashAddress("bitcoincash", addr_value);
            }
            catch (ex) {
                // Was not in CashAddr format...
                addr_value = addr;
            }
            addr = addr_value;

            var url = (CG_BTC_FORK === "cash" ? "bitcoincash:" : "bitcoin:") + addr + "?amount=" + amnt;
            btn.href  = url;
            btn.title = url;
        }
        else {
            btn.href = "";
            btn.title = "";
            btn.disabled = true;
        }
    }
}

function cg_save_get_order() {
    if (CG_SAVE_ORDER_NR === null) return;

    if (CG_SAVE_UPDATING_ORDER !== 0) {
        CG_SAVE_UPDATING_ORDER--;
        return;
    }
    CG_SAVE_UPDATING_ORDER = -1;
    CG_STATUS.push(sprintf(CG_TXT_SAVE_UPDATING_ORDER[CG_LANGUAGE], CG_SAVE_ORDER_NR));

    var data_obj = {
        nr : CG_SAVE_ORDER_NR.toString()
    };

    var json_str = encodeURIComponent(JSON.stringify(data_obj));
    xmlhttpPost(CG_API, 'fun=get_order&data='+json_str,
        function(response) {
            var status = "???";
                 if (response === false) status = sprintf(CG_TXT_SAVE_UPDATING_ORDER_ERROR[CG_LANGUAGE], CG_SAVE_ORDER_NR);
            else if (response === null ) status = sprintf(CG_TXT_SAVE_UPDATING_ORDER_TIMEOUT[CG_LANGUAGE], CG_SAVE_ORDER_NR);
            else {
                var details_msg = null;
                var order_addr_input = document.getElementById("cg-save-order-address");
                var order_amnt_input = document.getElementById("cg-save-order-amount");

                var json = JSON.parse(response);
                if ("order"  in json       && "nr"     in json.order && "accepted" in json.order
                &&  "filled" in json.order && "output" in json.order) {
                    var accepted     = (json.order.accepted === '1');
                    var filled       = (json.order.filled   === '1');
                    var order_status = "";

                    CG_SAVE_ORDER_FILLED = false;
                    if (!accepted && !filled) order_status = CG_TXT_SAVE_ORDER_STATUS_PENDING[CG_LANGUAGE];
                    else if (accepted && !filled) {
                        order_status = CG_TXT_SAVE_ORDER_STATUS_ACCEPTED[CG_LANGUAGE];
                        details_msg = CG_TXT_SAVE_ORDER_ACCEPTED[CG_LANGUAGE];
                    }
                    else if (accepted && filled) {
                        order_status = CG_TXT_SAVE_ORDER_STATUS_FILLED[CG_LANGUAGE];
                        details_msg = CG_TXT_SAVE_ORDER_FILLED[CG_LANGUAGE];
                        CG_SAVE_ORDER_FILLED = true;
                    }
                    else order_status = "";

                    if (accepted && CG_SAVE_ORDER_TIMEOUT > 0) {
                        CG_SAVE_ORDER_TIMEOUT = 0; // Disable order timeout counter.
                    }

                    var order_status_input = document.getElementById("cg-save-order-status");
                    if (order_status_input.value !== order_status) order_status_input.value = order_status;

                    if (json.order.output.length > 0) {
                        var output = null;
                        try {
                            output = JSON.parse(json.order.output);
                        } catch (e) {}

                        if (output !== null && "address" in output && "amount" in output) {
                            status = sprintf(CG_TXT_SAVE_UPDATING_ORDER_OK[CG_LANGUAGE], json.order.nr);

                            var addr = format_btc_addr(output.address);
                            var amnt = output.amount;

                            if (order_addr_input.value !== addr) order_addr_input.value = addr;
                            if (order_amnt_input.value !== amnt) order_amnt_input.value = amnt;

                            if (!filled) details_msg = sprintf(CG_TXT_SAVE_PAYMENT_DETAILS[CG_LANGUAGE], amnt, addr, btc_base58(output.address));
                        }
                        else if (output !== null && "error" in output) {
                            status = sprintf(CG_TXT_SAVE_ORDER_REJECTED[CG_LANGUAGE], json.order.nr);
                            details_msg = status;
                        }
                        else {
                            status = sprintf(CG_TXT_SAVE_UPDATING_ORDER_ERROR_OUTPUT[CG_LANGUAGE], json.order.nr);
                            details_msg = status;
                        }
                    }
                    else {
                        status = sprintf(CG_TXT_SAVE_UPDATING_ORDER_OK[CG_LANGUAGE], json.order.nr);
                        if (details_msg === null && CG_SAVE_ORDER_TIMEOUT >= 0) {
                            details_msg = CG_TXT_SAVE_ORDER_PROCESSING[CG_LANGUAGE];
                        }
                        CG_SAVE_UPDATING_ORDER = 5;
                    }
                }
                else {
                    status = sprintf(CG_TXT_SAVE_UPDATING_ORDER_ERROR[CG_LANGUAGE], CG_SAVE_ORDER_NR);
                    details_msg = status;
                    cg_handle_error(json);
                }

                if (details_msg !== null) {
                    var details = document.getElementById("cg-save-order-details");
                    var content = details_msg+order_addr_input.value
                                 +order_amnt_input.value+json.order.nr
                                 +json.order.filled+json.order.accepted;
                    var ripemd160 = CryptoJS.algo.RIPEMD160.create();
                    ripemd160.update(content);
                    var hash = ""+ripemd160.finalize();
                    if (hash !== details.getAttribute('data-hash')) {
                        details.setAttribute('data-hash', hash);
                        while (details.hasChildNodes()) details.removeChild(details.lastChild);
                        details.appendChild(document.createTextNode(details_msg));
                        if (accepted && !filled) {
                            var addr_value = order_addr_input.value;
                            try {
                                addr_value = addr_value.split(":").pop().toLowerCase();
                                cashaddr_parseAndConvertCashAddress("bitcoincash", addr_value);
                            }
                            catch (ex) {
                                // Was not in CashAddr format...
                                addr_value = order_addr_input.value;
                            }

                            details.appendChild(document.createElement("br"));
                            details.appendChild(document.createElement("br"));
                            var addr = encodeURIComponent(addr_value);
                            var amnt = encodeURIComponent(order_amnt_input.value);
                            var fork = (CG_BTC_FORK === "cash" ? "bitcoincash:" : "bitcoin:");

                            if (addr.length > 0) {
                                var img = document.createElement("img");
                                img.src = "https://api.qrserver.com/v1/create-qr-code/?size=128x128&qzone=4&data="+fork+addr+"?amount="+amnt;
                                img.width = "128";
                                img.height = "128";
                                img.style = "display: none; width: 0%;";
                                img.onload = function () {
                                    img.classList.add("widen");
                                    img.style = "display: initial; max-width: 128px;";
                                    var cash = document.getElementById("cg-cash-img");
                                    var core = document.getElementById("cg-core-img");
                                    if (cash !== null) cash.classList.remove("appear");
                                    if (core !== null) core.classList.remove("appear");
                                    if (cash !== null) cash.classList.add("glow");
                                    if (core !== null) core.classList.add("glow");
                                };

                                if (CG_BTC_FORK === "cash") {
                                    var link_core_rejected = document.createElement("a");
                                    var link_cash_accepted = document.createElement("a");
                                    link_core_rejected.href="http://www.newsbtc.com/2017/10/16/cryptograffiti-rejects-bitcoin-core-bch-now-available-payment-method/";
                                    link_core_rejected.target="_blank";
                                    link_core_rejected.onclick = function() {
                                        var img = document.getElementById("cg-core-img");
                                        if (img !== null && img.classList.contains("glow")) {
                                            img.classList.remove("glow");
                                        }
                                    };
                                    link_cash_accepted.href="https://www.bitcoincash.org/";
                                    link_cash_accepted.target="_blank";
                                    link_cash_accepted.onclick = function() {
                                        var img = document.getElementById("cg-cash-img");
                                        if (img !== null && img.classList.contains("glow")) {
                                            img.classList.remove("glow");
                                        }
                                    };

                                    var cash_img = document.createElement("img");
                                    cash_img.src = document.getElementById("gfx_cash").src;
                                    cash_img.width = "128";
                                    cash_img.height= "128";
                                    cash_img.classList.add("appear");
                                    cash_img.id = "cg-cash-img";

                                    var core_img = document.createElement("img");
                                    core_img.src = document.getElementById("gfx_core").src;
                                    core_img.width = "128";
                                    core_img.height= "128";
                                    core_img.classList.add("appear");
                                    core_img.id = "cg-core-img";

                                    link_core_rejected.appendChild(core_img);
                                    link_cash_accepted.appendChild(cash_img);

                                    details.appendChild(link_cash_accepted);
                                    details.appendChild(img);
                                    details.appendChild(link_core_rejected);
                                }
                                else details.appendChild(img);
                            }
                        }
                    }
                }
            }

            CG_STATUS.push(status);
            if (CG_SAVE_UPDATING_ORDER < 0) CG_SAVE_UPDATING_ORDER = 10;
        }
    );
}

function cg_save_make_order() {
    if (CG_SAVE_MAKING_ORDER || CG_SAVE_ORDER_NR) return;

    if (CG_CAPTCHA_TOKEN === null) {
        CG_STATUS.push(CG_TXT_SAVE_NO_TOKEN[CG_LANGUAGE]);
        return;
    }

    CG_SAVE_MAKING_ORDER = true;
    CG_STATUS.push(CG_TXT_SAVE_MAKING_ORDER[CG_LANGUAGE]);

    var order = {
        addr   : "",
        amount : "",
        chunks : ""
    };

    var donation = CG_WRITE_MIN_BTC_OUTPUT;
    order.addr   = "1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS";
    order.amount = Math.floor(donation * 100000000);
    order.chunks = CG_WRITE_CHUNKS;

    if (CG_WRITE_PAY_TO !== null && CG_WRITE_PAY_AMOUNT !== null) {
        order.addr   = btc_base58(CG_WRITE_PAY_TO);
        order.amount = Math.floor(CG_WRITE_PAY_AMOUNT * 100000000);
    }

    var data_obj = {
        group    : CG_SAVE_ORDER_GROUP,
        input    : [],
        token    : ''
    };

    data_obj.input = order;
    data_obj.token = CG_CAPTCHA_TOKEN;

    var json_str = JSON.stringify(data_obj);

    if (json_str.length > CG_CONSTANTS.MAX_DATA_SIZE) {
        var KiB = ((json_str.length - CG_CONSTANTS.MAX_DATA_SIZE)/1024).toFixed(2);
        CG_STATUS.push("!"+sprintf(CG_TXT_SAVE_MAX_DATA_SIZE_EXCEEDED[CG_LANGUAGE], KiB+" KiB"));
        CG_SAVE_MAKING_ORDER = false;
        CG_SAVE_DELAY = 10;
        return;
    }

    json_str = encodeURIComponent(json_str);

    xmlhttpPost(CG_API, 'fun=make_order&data='+json_str,
        function(response) {
            var status = "???";
                 if (response === false) status = CG_TXT_SAVE_MAKING_ORDER_ERROR[CG_LANGUAGE];
            else if (response === null ) status = CG_TXT_SAVE_MAKING_ORDER_TIMEOUT[CG_LANGUAGE];
            else {
                var json = JSON.parse(response);
                if ("nr" in json) {
                    status = sprintf(CG_TXT_SAVE_MAKING_ORDER_OK[CG_LANGUAGE], json.nr);
                    CG_SAVE_ORDER_NR = json.nr;

                    var details = document.getElementById("cg-save-order-details");
                    while (details.hasChildNodes()) details.removeChild(details.lastChild);
                    details.appendChild(document.createTextNode(CG_TXT_SAVE_ORDER_PENDING[CG_LANGUAGE]));
                    CG_SAVE_ORDER_TIMEOUT = 30;
                }
                else {
                    status = CG_TXT_SAVE_MAKING_ORDER_ERROR[CG_LANGUAGE];

                    var details = document.getElementById("cg-save-order-details");
                    while (details.hasChildNodes()) details.removeChild(details.lastChild);
                    details.appendChild(document.createTextNode(CG_TXT_SAVE_MAKING_ORDER_ERROR[CG_LANGUAGE]));

                    cg_handle_error(json);
                }
                CG_CAPTCHA_TOKEN = null;
            }

            CG_STATUS.push(status);
            CG_SAVE_MAKING_ORDER = false;
        }
    );
}

