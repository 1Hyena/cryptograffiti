var CG_ABOUT_IMG_DOMAIN = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJwAAAAQBAMAAAAR5AvdAAAAG1B"+
    "MVEX////f39+/v79/f39fX18/Pz8fHx+fn58AAAC1SdELAAAAAXRSTlMAQObYZgAAAVZJREFU"+
    "OI3lUj1PwzAUfE6VhtEIqWSM6FCPXUoyFgmqjh2gzRhRoBkj0o+MCSFpfjY+O+7HxNIJzno6+"+
    "87vyfYz0f/Ctn4+W/davq+ig9aJKxWi0D6YThheOyvTik4heKtv8qPm36m4TbQPBgzD07hKKL"+
    "WbzT6O5AjrpNs0EZsupc5m0GmuNaU3BRkGwHH4SianPQwLqlGWyFGuSyvYefYqGAvOOHQarHM"+
    "mNQT1C7JaVpCcLSbE2hxzNzEke/xEwqMAgus5ueBxDd0K5RGwCWEVRwYsWIJMjlTcRNd0ij3K"+
    "ZZgL7uSud6PKuIv+b+W4yVFPvntUF/iISCzTklx/3lttx/ZqXUB3/dEXGMH6ew/+NdjihHUmB"+
    "7yuzNEf5QFPSdmQxKROqNMs2PSN2KQeQnfi92/TCrVP+oq7M9WCOAp1m2TO2Qc5/JFLYPBClH"+
    "1erJzso4o/jB/oi3Grspyp9wAAAABJRU5ErkJggg=="
);

function cg_about_construct(main) {
    var tab = cg_init_tab(main, 'cg-tab-about');
    if (tab === null) return;

    var div = tab.element;

    div.classList.add("cg-tab-about-setup");

    var elements = [];
    var ps = [
        CG_TXT_ABOUT_P1,
        CG_TXT_ABOUT_P2,
        CG_TXT_ABOUT_P3
    ];

    for (var i=0; i<ps.length; ++i) {
        if (cg_translate(ps[i]).length === 0) continue;

        var w = document.createElement("div");

        var s = document.createElement("span");
        w.appendChild(s);

        var t = document.createTextNode(cg_translate(ps[i]));
        var p = document.createElement("p");
        p.appendChild(t);
        w.style.opacity = "0";
        w.appendChild(p);

        elements.push(
            { "parent" : "cg-tab-about", "child" : w, "sfx" : true }
        );
    }

    {
        var contact = document.createElement("div");
        contact.classList.add("cg-about-contact");
        contact.classList.add("cg-borderbox");

        var table = document.createElement("table");
        var tr2   = document.createElement("tr");
        var tr3   = document.createElement("tr");
        var tr4   = document.createElement("tr");
        var tr5   = document.createElement("tr");
        var td2_1 = document.createElement("td");
        var td2_2 = document.createElement("td");
        var td3_1 = document.createElement("td");
        var td3_2 = document.createElement("td");
        var td4_1 = document.createElement("td");
        var td4_2 = document.createElement("td");
        var td5_1 = document.createElement("td");
        var td5_2 = document.createElement("td");
        table.appendChild(tr2);
        tr2.appendChild(td2_1);
        tr2.appendChild(td2_2);
        table.appendChild(tr3);
        tr3.appendChild(td3_1);
        tr3.appendChild(td3_2);
        table.appendChild(tr4);
        tr4.appendChild(td4_1);
        tr4.appendChild(td4_2);
        table.appendChild(tr5);
        tr5.appendChild(td5_1);
        tr5.appendChild(td5_2);
        table.classList.add("cg-about-table");

        var table_wrapper = document.createElement("div");
        table_wrapper.id = "cg-about-contact-table-wrapper";
        table_wrapper.appendChild(table);

        var t_email  = document.createTextNode("support@");
        var t_source = document.createTextNode(
            "github.com/1Hyena/cryptograffiti"
        );

        var a_source = document.createElement("a");
        a_source.appendChild(t_source);

        a_source.title = cg_translate(CG_TXT_ABOUT_SOURCE);
        a_source.href  = "https://github.com/1Hyena/cryptograffiti";
        a_source.target= "_blank";

        var t_bsvinfo  = document.createTextNode("https://bitcoinsv.io/");
        var a_bsvinfo  = document.createElement("a");
        a_bsvinfo.appendChild(t_bsvinfo);
        a_bsvinfo.title = "Bitcoin Satoshi Vision";
        a_bsvinfo.href  = "https://bitcoinsv.io/";
        a_bsvinfo.target= "_blank";

        var t_wrightpaper = document.createTextNode(
            "A P2P Electronic Cash System"
        );

        var a_wrightpaper = document.createElement("a");
        a_wrightpaper.appendChild(t_wrightpaper);
        a_wrightpaper.title = "Bitcoin: A Peer-to-Peer Electronic Cash System";
        a_wrightpaper.href = (
            "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3440802"
        );

        a_wrightpaper.target= "_blank";

        var img_domain = document.createElement("img");
        img_domain.setAttribute('src', CG_ABOUT_IMG_DOMAIN);
        img_domain.setAttribute('title', cg_translate(CG_TXT_ABOUT_EMAIL_ALT));
        img_domain.style.verticalAlign="bottom";

        td2_1.appendChild(
            document.createTextNode(cg_translate(CG_TXT_ABOUT_SOURCE_CODE))
        );

        td2_2.appendChild(a_source);
        td3_1.appendChild(
            document.createTextNode(cg_translate(CG_TXT_ABOUT_CONTACT_US))
        );

        td3_2.appendChild(t_email);
        td3_2.appendChild(img_domain);
        td4_1.appendChild(
            document.createTextNode(cg_translate(CG_TXT_ABOUT_FRIENDS))
        );
        td5_1.appendChild(document.createTextNode("Bitcoin:"));
        td5_2.appendChild(a_bsvinfo);
        td5_2.appendChild(document.createElement("br"));
        td5_2.appendChild(a_wrightpaper);

        var first_friend = true;
        for (var key in CG_TXT_ABOUT_FRIEND_LIST) {
            if (!CG_TXT_ABOUT_FRIEND_LIST.hasOwnProperty(key)) continue;
            if (!first_friend) {
                td4_2.appendChild(document.createTextNode(", "));
            }

            var t_friend = document.createTextNode(key);
            var a_friend = document.createElement("a");
            a_friend.appendChild(t_friend);
            a_friend.title = cg_translate(CG_TXT_ABOUT_FRIEND_LIST[key]);
            a_friend.href  = CG_TXT_ABOUT_FRIEND_LIST[key].website;
            a_friend.target= "_blank";
            td4_2.appendChild(a_friend);
            first_friend = false;
        }

        {
            var cash_img = document.createElement("img");
            cash_img.src = document.getElementById("gfx_cash").src;
            cash_img.width = "128";
            cash_img.height= "128";
            cash_img.title = cg_translate(CG_TXT_THE_ORIGINAL_BITCOIN);

            var core_img = document.createElement("img");
            core_img.src = document.getElementById("gfx_core").src;
            core_img.width = "128";
            core_img.height= "128";
            core_img.title = cg_translate(CG_TXT_THE_FAKE_BITCOIN);

            contact.appendChild(cash_img);
            contact.appendChild(table_wrapper);
            contact.appendChild(core_img);
        }

        var flex_br = document.createElement("div");
        flex_br.style.flexBasis = "100%";
        flex_br.style.height = "0";

        elements.push(
            { "parent" : "cg-tab-about", "child" : flex_br, "sfx" : false }
        );

        contact.style.opacity = "0";
        elements.push(
            { "parent" : "cg-tab-about", "child" : contact, "sfx" : true }
        );
    }

    var n = 0;
    for (var i=0; i<elements.length; ++i) {
        var parent = elements[i].parent;
        var child  = elements[i].child;
        var sfx    = elements[i].sfx;

        parent = document.getElementById(parent);

        if (parent === null) continue;

        parent.appendChild(child);

        if (sfx === true) ++n;

        setTimeout(function(e, sfx){
            e.classList.add("cg-appear");
            if (sfx === true) cg_sfx_spray();
        }, 750+250*n, child, sfx);
    }
}

function cg_about_step(tab) {
}
