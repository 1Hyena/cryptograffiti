#!/bin/bash
out="../index.html"

> "$out"
ext_src=false
ext_css=false
ext_sfx=false
ext_gfx=false
src_files=
css_files=
sfx_files=
gfx_files=
while IFS='' read -r line || [[ -n "$line" ]]; do
    if [ "$line" == "/* PASTE EXTERNAL CSS HERE */" ]; then
        files=""

        for file in "${css_files[@]}"
        do
            if [ -z "$file" ]; then
                continue
            else
                if [ -f "$file" ]; then
                    files="${files}${file} "
                else
                    echo "External CSS '$file' does not exist."
                fi
            fi
        done

        printf "Compiling CSS...\n"
        cat ${files} | yui-compressor --verbose --type css --charset utf8 >> "$out"
        printf "\n" >> "${out}"
        continue
    fi

    if [ "$line" == "<!-- PASTE EXTERNAL JS HERE -->" ]; then
        files=""

        for file in "${src_files[@]}"
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

        printf "<script>\n" >> "$out"
        printf "Compiling JavaScript...\n"
        cat ${files} | yui-compressor --verbose --type js --charset utf8 -v >> "$out"
        printf "\n</script>\n" >> "$out"
        continue
    fi

    if [ "$line" == "<!-- BEGIN EXTERNAL CSS -->" ]; then
        ext_css=true
        continue
    fi

    if [ "$line" == "<!-- END EXTERNAL CSS -->" ]; then
        ext_css=false
        continue
    fi

    if [ "$line" == "<!-- BEGIN EXTERNAL SCRIPTS -->" ]; then
        ext_src=true
        continue
    fi

    if [ "$line" == "<!-- END EXTERNAL SCRIPTS -->" ]; then
        ext_src=false
        continue
    fi

    if [ "$line" == "<!-- BEGIN EXTERNAL SFX -->" ]; then
        ext_sfx=true
        continue
    fi

    if [ "$line" == "<!-- BEGIN EXTERNAL GFX -->" ]; then
        ext_gfx=true
        continue
    fi

    if [ "$line" == "<!-- END EXTERNAL SFX -->" ]; then
        ext_sfx=false

        for file in "${sfx_files[@]}"
        do
            id=`echo "$file" | cut "-d " -f1`
            file=`echo "$file" | cut "-d " -f2`
            if [ -z "$file" ]; then
                continue
            else
                if [ -f "$file" ]; then
                    fname=$(basename $file)
                    b64=`base64 --wrap=0 "${file}"`
                    printf "<script>show_progress('%s');</script>\n" "${fname}" >> "$out"
                    printf "<audio id='%s' src='data:audio/x-wav;base64,%s'></audio>\n" "${id}" "${b64}" >> "$out"
                else
                    echo "External SFX '$file' ($id) does not exist."
                fi
            fi
        done

        continue
    fi

    if [ "$line" == "<!-- END EXTERNAL GFX -->" ]; then
        ext_gfx=false

        for file in "${gfx_files[@]}"
        do
            id=`echo "$file" | cut "-d " -f1`
            file=`echo "$file" | cut "-d " -f2`
            if [ -z "$file" ]; then
                continue
            else
                if [ -f "$file" ]; then
                    fname=$(basename $file)
                    mimetype=`file --brief --mime-type "${file}"`
                    b64=`base64 --wrap=0 "${file}"`
                    printf "<script>show_progress('%s');</script>\n" "${fname}" >> "$out"
                    printf "<img id='%s' src='data:${mimetype};base64,%s'></img>\n" "${id}" "${b64}" >> "$out"
                else
                    echo "External GFX '$file' ($id) does not exist."
                fi
            fi
        done

        continue
    fi

    if [ "$ext_css" = true ] ; then
        file=`echo "$line" | cut -d\" -f2`
        css_files+=("$file")
        continue
    fi

    if [ "$ext_src" = true ] ; then
        file=`echo "$line" | cut -d\" -f2`
        src_files+=("$file")
        continue
    fi

    if [ "$ext_sfx" = true ] ; then
        id=`echo "$line" | cut -d\' -f2`
        file=`echo "$line" | cut -d\" -f2`
        sfx_files+=("$id $file")
        continue
    fi

    if [ "$ext_gfx" = true ] ; then
        id=`echo "$line" | cut -d\' -f2`
        file=`echo "$line" | cut -d\" -f2`
        gfx_files+=("$id $file")
        continue
    fi

    echo "$line" >> "$out"
done < ${1:-cryptograffiti.html}

