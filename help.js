function cg_construct_help(main) {
    var div = cg_init_tab(main, 'cg-tab-help');
    if (div === null) return;

    div.classList.add("cg-help-tab");

    var a_todo = document.createElement("article");
    var h_todo = document.createElement("h1");
    var p_todo = document.createElement("p");
    var l_todo = document.createElement("ul");

    var sz = CG_TXT_HELP_TODO.length;
    for (var i=0; i<sz; i++) {
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(CG_TXT_HELP_TODO[i][CG_LANGUAGE]));
        l_todo.appendChild(li);
    }   

    h_todo.appendChild(document.createTextNode(CG_TXT_HELP_KNOWN_ISSUES[CG_LANGUAGE]));
    p_todo.appendChild(l_todo);
    
    a_todo.appendChild(h_todo);
    a_todo.appendChild(p_todo);
    
    div.appendChild(a_todo);
}

