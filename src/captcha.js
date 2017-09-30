var CG_CAPTCHA_TOKEN     = null;
var CG_CAPTCHA_IMAGE     = null;
var CG_CAPTCHA_NEXT_FUN  = null;
var CG_CAPTCHA_BACK_FUN  = null;
var CG_CAPTCHA_C_LOADING = false;
var CG_CAPTCHA_T_LOADING = false;
var CG_CAPTCHA_COOLDOWN  = 0;
var CG_CAPTCHA_IMAGE_SRC =
"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAtCAYAAAAp4WArAAAACXBIWXM"+
"AAAsTAAALEwEAmpwYAAAAMklEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAA"+
"AAAAAAAAAHBlcK0AAfU+SZcAAAAASUVORK5CYII=";

function cg_construct_captcha(main) {
    var div = cg_init_tab(main, 'cg-tab-captcha');
    if (div === null) {
        var btn = document.getElementById("cg-captcha-btn-back");
        btn.disabled = true;
        btn = document.getElementById("cg-captcha-btn-next");
        btn.disabled = true;
        return;
    }

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

    var btn_next = document.createElement("BUTTON"); btn_next.classList.add("cg-captcha-btn"); btn_next.disabled = false;
    var txt_next = document.createTextNode(CG_TXT_CAPTCHA_BTN_NEXT[CG_LANGUAGE]);
    btn_next.appendChild(txt_next);
    btn_next.addEventListener("click", cg_captcha_next);
    btn_next.id="cg-captcha-btn-next";

    var btn_back = document.createElement("BUTTON"); btn_back.classList.add("cg-captcha-btn"); btn_back.disabled = false;
    var txt_back = document.createTextNode(CG_TXT_CAPTCHA_BTN_BACK[CG_LANGUAGE]);
    btn_back.appendChild(txt_back);
    btn_back.addEventListener("click", cg_captcha_back);
    btn_back.id="cg-captcha-btn-back";

    var img = document.createElement("img");
    img.setAttribute("src", CG_CAPTCHA_IMAGE_SRC);
    img.setAttribute("width", 160);
    img.setAttribute("height", 45);
    img.setAttribute("alt", CG_TXT_CAPTCHA_IMAGE_ALT[CG_LANGUAGE]);
    img.setAttribute("title", CG_TXT_CAPTCHA_IMAGE_TITLE[CG_LANGUAGE]);
    img.classList.add("cg-captcha-img");
    img.id = "cg-captcha-img";

    var controls_div = document.createElement("div");

    var input_captcha = document.createElement("input");
    input_captcha.id = "cg-captcha-answer";
    input_captcha.classList.add("cg-captcha-answer-input");
    input_captcha.classList.add("cg-borderbox");
    input_captcha.placeholder = CG_TXT_CAPTCHA_INPUT_PLACEHOLDER[CG_LANGUAGE];

    var t  = document.createElement("table");
    var tr1 = document.createElement("tr");
    var td1_tr1 = document.createElement("td");
    var td2_tr1 = document.createElement("td");
    var td3_tr1 = document.createElement("td");
    td1_tr1.appendChild(btn_back);
    td2_tr1.appendChild(input_captcha);
    td3_tr1.appendChild(btn_next);
    tr1.appendChild(td1_tr1);
    tr1.appendChild(td2_tr1);
    tr1.appendChild(td3_tr1);
    //tr2.appendChild(td2);
    //t.appendChild(tr1);
    t.appendChild(tr1);

    t.classList.add("cg-captcha-table");
    controls_div.appendChild(t);

    wrapper.appendChild(img);
    wrapper.appendChild(controls_div);
    cell.appendChild(wrapper);
    table.appendChild(cell);
    div.appendChild(table);

    //CG_CAPTCHA_TOKEN = true;
}

function cg_captcha_next() {
    if (CG_CAPTCHA_IMAGE !== null && CG_CAPTCHA_TOKEN === null) {
        cg_captcha_get_token();
        return;
    }

    if (CG_CAPTCHA_NEXT_FUN === null) return;
    CG_CAPTCHA_IMAGE = null;
    var img = document.getElementById("cg-captcha-img");
    img.setAttribute("src", CG_CAPTCHA_IMAGE_SRC);
    document.getElementById("cg-captcha-answer").value = "";
    CG_CAPTCHA_NEXT_FUN();
}

function cg_captcha_back() {
    if (CG_CAPTCHA_C_LOADING || CG_CAPTCHA_T_LOADING) return;
    if (CG_CAPTCHA_BACK_FUN !== null) CG_CAPTCHA_BACK_FUN();
}

function cg_captcha_update() {
    if (CG_CAPTCHA_COOLDOWN > 0) CG_CAPTCHA_COOLDOWN--;
    cg_captcha_get_challenge();
    if (CG_CAPTCHA_TOKEN !== null) cg_captcha_next();

    var btn = document.getElementById("cg-captcha-btn-back");
    btn.disabled = true;
    btn = document.getElementById("cg-captcha-btn-next");
    btn.disabled = true;

    if (!CG_CAPTCHA_C_LOADING && !CG_CAPTCHA_T_LOADING) {
        btn = document.getElementById("cg-captcha-btn-back");
        btn.disabled = false;

        btn = document.getElementById("cg-captcha-btn-next");
        if (document.getElementById("cg-captcha-answer").value.length > 0) btn.disabled = false;
    }
}

function cg_captcha_get_challenge() {
    if (CG_CAPTCHA_C_LOADING || CG_CAPTCHA_IMAGE || CG_CAPTCHA_COOLDOWN > 0) return;
    CG_CAPTCHA_C_LOADING = true;
    CG_STATUS.push(CG_TXT_CAPTCHA_LOADING_CHALLENGE[CG_LANGUAGE]);
    xmlhttpPost(CG_API, 'fun=get_captcha',
        function(response) {
            var status = "???";
                 if (response === false) status = CG_TXT_CAPTCHA_LOADING_CHALLENGE_ERROR[CG_LANGUAGE];
            else if (response === null ) status = CG_TXT_CAPTCHA_LOADING_CHALLENGE_TIMEOUT[CG_LANGUAGE];
            else {
                var json = JSON.parse(response);
                if ("captcha" in json && "url" in json.captcha && "img" in json.captcha) {
                    if ("token" in json.captcha && is_string(json.captcha.token) && json.captcha.token.length === 64) {
                        status = CG_TXT_CAPTCHA_LOADING_CHALLENGE_FREE_TOKEN[CG_LANGUAGE];
                        CG_CAPTCHA_TOKEN = json.captcha.token;
                    }
                    else {
                        status = CG_TXT_CAPTCHA_LOADING_CHALLENGE_OK[CG_LANGUAGE];
                    }
                    CG_CAPTCHA_IMAGE = json.captcha.img;
                    var img = document.getElementById("cg-captcha-img");
                    img.setAttribute("src", json.captcha.url);
                }
                else {
                    status = CG_TXT_CAPTCHA_LOADING_CHALLENGE_ERROR[CG_LANGUAGE];
                    cg_handle_error(json);
                }
            }

            CG_STATUS.push(status);
            CG_CAPTCHA_C_LOADING = false;
            CG_CAPTCHA_COOLDOWN = 5;
        }
    );
}

function cg_captcha_get_token() {
    if (CG_CAPTCHA_T_LOADING || CG_CAPTCHA_TOKEN || CG_CAPTCHA_COOLDOWN > 0) return;
    CG_CAPTCHA_T_LOADING = true;
    CG_STATUS.push(CG_TXT_CAPTCHA_LOADING_TOKEN[CG_LANGUAGE]);

    var code     = document.getElementById("cg-captcha-answer").value;
    var img_str  = encodeURIComponent(CG_CAPTCHA_IMAGE);
    var code_str = encodeURIComponent(code);

    xmlhttpPost(CG_API, 'fun=get_token&img='+img_str+'&code='+code_str,
        function(response) {
            var status = "???";
                 if (response === false) status = CG_TXT_CAPTCHA_LOADING_TOKEN_ERROR[CG_LANGUAGE];
            else if (response === null ) status = CG_TXT_CAPTCHA_LOADING_TOKEN_TIMEOUT[CG_LANGUAGE];
            else {
                var json = JSON.parse(response);
                if ("token" in json) {
                    status = CG_TXT_CAPTCHA_LOADING_TOKEN_OK[CG_LANGUAGE];
                    CG_CAPTCHA_TOKEN = json.token;
                }
                else {
                    status = CG_TXT_CAPTCHA_LOADING_TOKEN_ERROR[CG_LANGUAGE];
                    CG_CAPTCHA_IMAGE = null;
                    document.getElementById("cg-captcha-answer").value = "";
                    var img = document.getElementById("cg-captcha-img");
                    img.setAttribute("src", CG_CAPTCHA_IMAGE_SRC);
                    cg_handle_error(json);
                }
            }

            CG_STATUS.push(status);
            CG_CAPTCHA_T_LOADING = false;
            CG_CAPTCHA_COOLDOWN = 5;
        }
    );
}

