function cg_construct_about(main) {
    var div = cg_init_tab(main, 'cg-tab-about');
    if (div === null) return;

    div.classList.add("cg-about-tab");

    var elements = [];
    var ps = [CG_TXT_ABOUT_P1,
              CG_TXT_ABOUT_P2,
              CG_TXT_ABOUT_P3,
              CG_TXT_ABOUT_P4,
              CG_TXT_ABOUT_P5,
              CG_TXT_ABOUT_P6];

    for (var i=0; i<ps.length; ++i) {
        if (ps[i][CG_LANGUAGE].length === 0) continue;

        var w = document.createElement("div");

        var s = document.createElement("span");
        w.appendChild(s);

        var t = document.createTextNode(ps[i][CG_LANGUAGE]);
        var p = document.createElement("p");
        p.appendChild(t);
        w.style.opacity = "0";
        w.appendChild(p);

        elements.push( { "parent" : "cg-tab-about", "child" : w });
    }

    {
        var contact = document.createElement("div");
        contact.classList.add("cg-contact");
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
        table_wrapper.id = "cg-contact-table-wrapper";
        table_wrapper.appendChild(table);

        var t_email  = document.createTextNode("support@");
        var t_source = document.createTextNode("github.com/1Hyena/cryptograffiti");

        var a_source   = document.createElement("a"); a_source.appendChild(t_source);
        a_source.title = CG_TXT_ABOUT_SOURCE[CG_LANGUAGE];
        a_source.href  = "https://github.com/1Hyena/cryptograffiti";
        a_source.target= "_blank";

        var t_bchinfo  = document.createTextNode("https://bitcoinsv.io/");
        var a_bchinfo  = document.createElement("a");
        a_bchinfo.appendChild(t_bchinfo);
        a_bchinfo.title = "Bitcoin Satoshi Vision";
        a_bchinfo.href  = "https://bitcoinsv.io/";
        a_bchinfo.target= "_blank";

        var img_domain = document.createElement("img");
        img_domain.setAttribute('src', CG_IMG_DOMAIN);
        img_domain.setAttribute('title', CG_TXT_ABOUT_EMAIL_ALT[CG_LANGUAGE]);
        img_domain.style.verticalAlign="bottom";

        td2_1.appendChild(document.createTextNode(CG_TXT_ABOUT_SOURCE_CODE[CG_LANGUAGE])); td2_2.appendChild(a_source);
        td3_1.appendChild(document.createTextNode(CG_TXT_ABOUT_CONTACT_US [CG_LANGUAGE])); td3_2.appendChild(t_email); td3_2.appendChild(img_domain);
        td4_1.appendChild(document.createTextNode(CG_TXT_ABOUT_FRIENDS[CG_LANGUAGE]));
        td5_1.appendChild(document.createTextNode("Bitcoin:"));
        td5_2.appendChild(a_bchinfo);

        var first_friend = true;
        for (var key in CG_TXT_ABOUT_FRIEND_LIST) {
            if (!CG_TXT_ABOUT_FRIEND_LIST.hasOwnProperty(key)) continue;
            if (!first_friend) {
                td4_2.appendChild(document.createTextNode(", "));
            }

            var t_friend = document.createTextNode(key);
            var a_friend = document.createElement("a");
            a_friend.appendChild(t_friend);
            a_friend.title = CG_TXT_ABOUT_FRIEND_LIST[key][CG_LANGUAGE];
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
            cash_img.title = CG_TXT_THE_ORIGINAL_BITCOIN[CG_LANGUAGE];

            var core_img = document.createElement("img");
            core_img.src = document.getElementById("gfx_core").src;
            core_img.width = "128";
            core_img.height= "128";
            core_img.title = CG_TXT_THE_FAKE_BITCOIN[CG_LANGUAGE];

            contact.appendChild(cash_img);
            contact.appendChild(table_wrapper);
            contact.appendChild(core_img);
        }

        contact.style.opacity = "0";
        elements.push( { "parent" : "cg-tab-about", "child" : contact } );
    }

    for (var i=0; i<elements.length; ++i) {
        var parent = elements[i].parent;
        var child  = elements[i].child;
        parent = document.getElementById(parent);

        if (parent === null) continue;

        parent.appendChild(child);
        setTimeout(function(e){
            e.classList.add("cg-appear");
            cg_sfx_spray();
        }, 750+250*i, child);
    }
}

var CG_IMG_DOMAIN = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJwAAAAQBAMAAAAR5AvdAAAAG1BMVEX////f39+/v79/f39fX18/Pz8fHx+fn58AAAC1SdELAAAAAXRSTlMAQObYZgAAAVZJREFUOI3lUj1PwzAUfE6VhtEIqWSM6FCPXUoyFgmqjh2gzRhRoBkj0o+MCSFpfjY+O+7HxNIJzno6+87vyfYz0f/Ctn4+W/davq+ig9aJKxWi0D6YThheOyvTik4heKtv8qPm36m4TbQPBgzD07hKKLWbzT6O5AjrpNs0EZsupc5m0GmuNaU3BRkGwHH4SianPQwLqlGWyFGuSyvYefYqGAvOOHQarHMmNQT1C7JaVpCcLSbE2hxzNzEke/xEwqMAgus5ueBxDd0K5RGwCWEVRwYsWIJMjlTcRNd0ij3KZZgL7uSud6PKuIv+b+W4yVFPvntUF/iISCzTklx/3lttx/ZqXUB3/dEXGMH6ew/+NdjihHUmB7yuzNEf5QFPSdmQxKROqNMs2PSN2KQeQnfi92/TCrVP+oq7M9WCOAp1m2TO2Qc5/JFLYPBClH1erJzso4o/jB/oi3Grspyp9wAAAABJRU5ErkJggg==";

