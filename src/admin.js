function cg_admin_construct(main) {
    var tab = cg_init_tab(main, 'cg-tab-admin');
    if (tab === null) return;

    var container = tab.element;
    var wrapper = document.createElement("div");
    wrapper.id = "cg-admin-wrapper";

    var form = document.createElement("form");
    form.setAttribute("action", "/");
    form.setAttribute("method", "POST");
    form.setAttribute("autocomplete", "on");
    form.setAttribute("onsubmit", "return false;");

    var label_user = document.createElement("label");
    label_user.setAttribute("for", "admin-uname");
    label_user.appendChild(document.createTextNode("Username"));

    var input_user = document.createElement("input");
    input_user.setAttribute("type", "text");
    input_user.setAttribute("name", "admin-uname");
    input_user.id = "cg-admin-input-user";

    var label_pass = document.createElement("label");
    label_pass.setAttribute("for", "admin-upass");
    label_pass.appendChild(document.createTextNode("Password"));

    var input_pass = document.createElement("input");
    input_pass.setAttribute("type", "password");
    input_pass.setAttribute("name", "admin-upass");
    input_pass.id = "cg-admin-input-pass";

    var btn_submit = document.createElement("button");
    btn_submit.id = "cg-admin-btn-save";
    btn_submit.setAttribute("type", "submit");
    btn_submit.appendChild(document.createTextNode("💾"));

    var fieldset = document.createElement("fieldset");

    fieldset.appendChild(label_user);
    fieldset.appendChild(input_user);
    fieldset.appendChild(document.createElement("br"));
    fieldset.appendChild(label_pass);
    fieldset.appendChild(input_pass);
    form.appendChild(fieldset);
    form.appendChild(btn_submit);

    wrapper.appendChild(form);

    var hmac = document.createElement("div");
    hmac.id = "cg-admin-hmac";
    hmac.setAttribute("data-content", "");

    wrapper.appendChild(hmac);

    container.appendChild(document.createElement("span"));
    container.appendChild(wrapper);
}

function cg_admin_step(tab) {
    var hmac = document.getElementById("cg-admin-hmac");
    hmac.setAttribute("data-content", cg_admin_hmac(""));
}

function cg_admin_hmac(salt) {
    var input_user = document.getElementById("cg-admin-input-user");
    var input_pass = document.getElementById("cg-admin-input-pass");
    var username = input_user !== null ? input_user.value : "";
    var password = input_pass !== null ? input_pass.value : "";
    var timestamp = Math.floor(Date.now() / 1000);
    var timesocket = Math.floor(timestamp / 60);
    var message = username+password+timesocket+salt;

    return bin2hex(rmd160(new Uint8Array(str2utf8_array(message))));
}
