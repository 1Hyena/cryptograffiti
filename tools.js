function cg_construct_tools(main) {
    var div = cg_init_tab(main, 'cg-tab-tools');
    if (div === null) return;

    div.classList.add("cg-tools-tab");

    var text = document.createTextNode(CG_TXT_TOOLS_COMING_SOON[CG_LANGUAGE]);
    div.appendChild(text);
}

