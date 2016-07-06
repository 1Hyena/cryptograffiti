function cg_construct_help(main) {
    var div = cg_init_tab(main, 'cg-tab-help');
    if (div === null) return;

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

    var a_protocol = document.createElement("article");
    var h_protocol = document.createElement("h1");
    var p_protocol_1 = document.createElement("p");
    var p_protocol_2 = document.createElement("p");

    h_protocol.appendChild(document.createTextNode(CG_TXT_HELP_PROTOCOL_HEAD[CG_LANGUAGE]));
    p_protocol_1.appendChild(document.createTextNode(CG_TXT_HELP_PROTOCOL_BODY[CG_LANGUAGE]));
    p_protocol_2.appendChild(document.createTextNode(CG_TXT_HELP_PROTOCOL_FOOT[CG_LANGUAGE]));
    a_protocol.appendChild(h_protocol);
    a_protocol.appendChild(p_protocol_1);
    a_protocol.appendChild(p_protocol_2);

    wrapper.appendChild(a_protocol);
    wrapper.appendChild(document.createElement("BR"));
    wrapper.appendChild(cg_help_create_list(CG_TXT_HELP_TODO,  CG_TXT_HELP_KNOWN_ISSUES[CG_LANGUAGE]));
    cell.appendChild(wrapper);
    table.appendChild(cell);
    div.appendChild(table);

    div.classList.add("cg-help-tab");
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

