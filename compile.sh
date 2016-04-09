#!/bin/bash
out="cryptograffiti.html"
css="./main.css"

> "$out"
ext_scripts=false
exception_1=false
js_files=
while IFS='' read -r line || [[ -n "$line" ]]; do
    if [ "$line" == "/* PASTE EXTERNAL CSS HERE */" ]; then
        if [ -f "$css" ]; then
            cat "${css}" | yui-compressor --type css --charset utf8 >> "$out"
        else
            echo "External CSS '$css' does not exist."
        fi
        continue
    fi

    if [ "$line" == "/* PASTE EXTERNAL JS HERE */" ]; then
        files=""

        for file in "${js_files[@]}"
        do
            if [ -z "$file" ]; then
                continue
            else
                if [ -f "$file" ]; then
                    files="${files}${file} "
                else
                    echo "External javascript '$file' does not exist."
                fi
            fi
        done

        cat ${files} | yui-compressor --type js --charset utf8 >> "$out"
        continue
    fi

    if [ "$line" == "<!-- BEGIN EXTERNAL SCRIPTS -->" ]; then
        ext_scripts=true
        continue
    fi

    if [ "$line" == "<!-- END EXTERNAL SCRIPTS -->" ]; then
        ext_scripts=false
        continue
    fi

    if [ "$line" == "/* BEGIN EXCEPTION 1 */" ]; then
        exception_1=true
        continue
    fi

    if [ "$line" == "/* END EXCEPTION 1 */" ]; then
        exception_1=false
        echo "cg_start(null);" >> "$out"
        continue
    fi

    if [ "$ext_scripts" = true ] ; then
        file=`echo "$line" | cut -d\" -f2`
        js_files+=("$file")
        continue
    fi

    if [ "$exception_1" = true ] ; then
        continue
    fi

    echo "$line" >> "$out"
done < "$1"

