function cg_construct_about(main) {
    var div = cg_init_tab(main, 'cg-tab-about');
    if (div === null) return;

    div.classList.add("cg-about-tab");

    var t1 = document.createTextNode(CG_TXT_ABOUT_P1[CG_LANGUAGE]);
    var t2 = document.createTextNode(CG_TXT_ABOUT_P2[CG_LANGUAGE]);
    var t3 = document.createTextNode(CG_TXT_ABOUT_P3[CG_LANGUAGE]);

    var p1 = document.createElement("p"); p1.appendChild(t1);
    var p2 = document.createElement("p"); p2.appendChild(t2);
    var p3 = document.createElement("p"); p3.appendChild(t3);

    div.classList.add("cg-about-tab");

    var contact = document.createElement("div");
    contact.classList.add("cg-contact");

    var table = document.createElement("table");
    var tr1   = document.createElement("tr");
    var tr2   = document.createElement("tr");
    var tr3   = document.createElement("tr");
    var tr4   = document.createElement("tr");
    var tr5   = document.createElement("tr");
    var td1_1 = document.createElement("td");
    var td1_2 = document.createElement("td");
    var td2_1 = document.createElement("td");
    var td2_2 = document.createElement("td");
    var td3_1 = document.createElement("td");
    var td3_2 = document.createElement("td");
    var td4_1 = document.createElement("td");
    var td4_2 = document.createElement("td");
    var td5_1 = document.createElement("td");
    var td5_2 = document.createElement("td");
    table.appendChild(tr1);
    tr1.appendChild(td1_1);
    tr1.appendChild(td1_2);
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

    var t_topic  = document.createTextNode("bitcointalk.org/?topic=524877.0");
    var t_email  = document.createTextNode("hyena@");
    var t_donate = document.createTextNode("1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS");
    var t_source = document.createTextNode("github.com/1Hyena/cryptograffiti");

    var a_topic   = document.createElement("a"); a_topic.appendChild(t_topic);
    a_topic.title = CG_TXT_ABOUT_TOPIC[CG_LANGUAGE];
    a_topic.href  = "https://bitcointalk.org/index.php?topic=524877.0";
    a_topic.target= "_blank";

    var a_source   = document.createElement("a"); a_source.appendChild(t_source);
    a_source.title = CG_TXT_ABOUT_SOURCE[CG_LANGUAGE];
    a_source.href  = "https://github.com/1Hyena/cryptograffiti";
    a_source.target= "_blank";

    var img_domain = document.createElement("img");
    img_domain.setAttribute('src', CG_IMG_DOMAIN);
    img_domain.setAttribute('alt', CG_TXT_ABOUT_EMAIL_ALT[CG_LANGUAGE]);
    img_domain.style.verticalAlign="bottom";

    var fork = (CG_BTC_FORK === "cash" ? "bitcoincash:" : "bitcoin:");
    var a_donate = document.createElement("a"); a_donate.appendChild(t_donate);
    a_donate.title = CG_TXT_ABOUT_DONATE_ALT[CG_LANGUAGE];
    a_donate.href  = fork+"1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS";
    a_donate.target= "_blank";

    var cashaddr = cashaddr_parseAndConvertOldAddress("1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS").split(":").pop().toUpperCase();
    var a_donate_cashaddr = document.createElement("a"); a_donate_cashaddr.appendChild(document.createTextNode(cashaddr));
    a_donate_cashaddr.title = CG_TXT_ABOUT_DONATE_ALT[CG_LANGUAGE];
    a_donate_cashaddr.href  = "bitcoincash:"+cashaddr.toLowerCase();
    a_donate_cashaddr.target= "_blank";

    var t_note = document.createTextNode(CG_TXT_ABOUT_NOTE[CG_LANGUAGE]);
    var p_note = document.createElement("p");
    p_note.appendChild(t_note);
    p_note.classList.add("cg-note");

    a_topic.classList.add('cg-link');
    a_donate.classList.add('cg-link');
    a_donate_cashaddr.classList.add('cg-link');

    td1_1.appendChild(document.createTextNode(CG_TXT_ABOUT_FORUM_TOPIC[CG_LANGUAGE])); td1_2.appendChild(a_topic);
    td2_1.appendChild(document.createTextNode(CG_TXT_ABOUT_SOURCE_CODE[CG_LANGUAGE])); td2_2.appendChild(a_source);
    td3_1.appendChild(document.createTextNode(CG_TXT_ABOUT_CONTACT_US [CG_LANGUAGE])); td3_2.appendChild(t_email); td3_2.appendChild(img_domain);
    td4_1.appendChild(document.createTextNode(CG_TXT_ABOUT_DONATE_BTC [CG_LANGUAGE]));
        td4_2.appendChild(a_donate);
        td4_2.appendChild(document.createElement("br"));
        td4_2.appendChild(a_donate_cashaddr);
    td5_1.appendChild(document.createTextNode(CG_TXT_ABOUT_MEMORABLE_DONORS[CG_LANGUAGE]));
    var first_donor = true;
    for (var key in CG_TXT_ABOUT_DONOR_LIST) {
        if (!CG_TXT_ABOUT_DONOR_LIST.hasOwnProperty(key)) continue;
        if (!first_donor) {
            td5_2.appendChild(document.createTextNode(", "));
        }

        var t_donor = document.createTextNode(key);
        var a_donor = document.createElement("a");
        a_donor.appendChild(t_donor);
        a_donor.title = CG_TXT_ABOUT_DONOR_LIST[key][CG_LANGUAGE];
        a_donor.href  = CG_TXT_ABOUT_DONOR_LIST[key].website;
        a_donor.target= "_blank";
        td5_2.appendChild(a_donor);
        first_donor = false;
    }

    table.classList.add('cg-table');

    if (CG_BTC_FORK === "cash") {
        var cash_img = document.createElement("img");
        cash_img.src = document.getElementById("gfx_cash").src;
        cash_img.width = "128";
        cash_img.height= "128";

        var core_img = document.createElement("img");
        core_img.src = document.getElementById("gfx_core").src;
        core_img.width = "128";
        core_img.height= "128";

        contact.appendChild(cash_img);
        contact.appendChild(table);
        contact.appendChild(core_img);
    }
    else contact.appendChild(table);

    contact.appendChild(p_note);

    p1.style.opacity = "0";
    p2.style.opacity = "0";
    p3.style.opacity = "0";
    contact.style.opacity = "0";

    div.appendChild(p1);
    div.appendChild(p2);
    div.appendChild(p3);
    div.appendChild(contact);

    setTimeout(function(){p1.classList.add("cg-appear");      cg_sfx_spray();},  750);
    setTimeout(function(){p2.classList.add("cg-appear");      cg_sfx_spray();}, 1000);
    setTimeout(function(){p3.classList.add("cg-appear");      cg_sfx_spray();}, 1250);
    setTimeout(function(){contact.classList.add("cg-appear"); cg_sfx_spray();}, 1500);
}

var CG_IMG_DOMAIN = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJwAAAAQBAMAAAAR5AvdAAAAG1BMVEX////f39+/v79/f39fX18/Pz8fHx+fn58AAAC1SdELAAAAAXRSTlMAQObYZgAAAVZJREFUOI3lUj1PwzAUfE6VhtEIqWSM6FCPXUoyFgmqjh2gzRhRoBkj0o+MCSFpfjY+O+7HxNIJzno6+87vyfYz0f/Ctn4+W/davq+ig9aJKxWi0D6YThheOyvTik4heKtv8qPm36m4TbQPBgzD07hKKLWbzT6O5AjrpNs0EZsupc5m0GmuNaU3BRkGwHH4SianPQwLqlGWyFGuSyvYefYqGAvOOHQarHMmNQT1C7JaVpCcLSbE2hxzNzEke/xEwqMAgus5ueBxDd0K5RGwCWEVRwYsWIJMjlTcRNd0ij3KZZgL7uSud6PKuIv+b+W4yVFPvntUF/iISCzTklx/3lttx/ZqXUB3/dEXGMH6ew/+NdjihHUmB7yuzNEf5QFPSdmQxKROqNMs2PSN2KQeQnfi92/TCrVP+oq7M9WCOAp1m2TO2Qc5/JFLYPBClH1erJzso4o/jB/oi3Grspyp9wAAAABJRU5ErkJggg==";

