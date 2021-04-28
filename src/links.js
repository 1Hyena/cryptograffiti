function cg_links_construct(main) {
    var tab = cg_init_tab(main, 'cg-tab-links');
    if (tab === null) return;

    var structure = [
        {
            label: "LEARNING",
            links: [
                [ "WHITEPAPER",   "LINK_TO_WHITEPAPER"   ],
                [ "Craig Wright", "LINK_TO_CRAIG_WRIGHT" ]
            ]
        },
        {
            label: "SOFTWARE",
            links: [
                [ "ElectrumSV",  "LINK_TO_ELECTRUMSV"  ],
                [ "Simply Cash", "LINK_TO_SIMPLY_CASH" ]
            ]
        },
        {
            label: "NEWS",
            links: [
                [ "CoinGeek", "LINK_TO_COINGEEK" ]
            ]
        },
        {
            label: "COMMUNITY",
            links: [
                [ "MetaNet ICU", "LINK_TO_METANET" ]
            ]
        }
    ];

    var container = tab.element;
    var wrapper = document.createElement("div");
    wrapper.id = "cg-links-wrapper";

    for (var i=0; i<structure.length; ++i) {
        var s = structure[i];
        var section = document.createElement("div");

        var heading = document.createElement("h1");
        heading.appendChild(document.createTextNode(cg_links_translate(s.label)));

        var links = document.createElement("div");

        for (var j=0; j<s.links.length; ++j) {
            var l = s.links[j];
            var link_name = l[0];
            var link_alt = l[1];

            var link = document.createElement("a");
            link.appendChild(
                document.createTextNode(cg_links_translate(link_name))
            );
            link.title = cg_links_translate(link_alt);
            link.href = CG_TXT_LINKS[link_alt].website;
            link.target= "_blank";

            var desc = document.createElement("div");
            desc.appendChild(
                document.createTextNode(cg_links_translate(link_alt))
            );

            links.appendChild(link);
            links.appendChild(desc);
        }

        section.appendChild(heading);
        section.appendChild(links);
        wrapper.appendChild(section);
    }

    container.appendChild(document.createElement("span"));
    container.appendChild(wrapper);
}

function cg_links_step(tab) {
}

function cg_links_translate(label, args) {
    args = typeof args !== 'undefined' ? args : ([]);

    if (label in CG_TXT_LINKS) {
        return sprintf(CG_TXT_LINKS[label][cg_get_global("language")], args);
    }

    return label;
}
