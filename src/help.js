function cg_construct_help(main) {
    var div = cg_init_tab(main, 'cg-tab-help');
    if (div === null) return;

    div.classList.add("cg-help-tab");
    div.appendChild(cg_help_create_list(CG_TXT_HELP_TODO,  CG_TXT_HELP_KNOWN_ISSUES[CG_LANGUAGE]));
}

function cg_help_create_list(table, caption) {
    var a_todo = document.createElement("article");
    var h_todo = document.createElement("h1");
    var p_todo = document.createElement("p");
    var l_todo = document.createElement("ul");

    var sz = table.length;
    for (var i=0; i<sz; i++) {
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(table[i][CG_LANGUAGE]));
        l_todo.appendChild(li);
    }   

    h_todo.appendChild(document.createTextNode(caption));
    p_todo.appendChild(l_todo);
    
    a_todo.appendChild(h_todo);
    a_todo.appendChild(p_todo);
    return a_todo;
}

