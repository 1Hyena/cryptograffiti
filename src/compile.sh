#!/bin/bash
out_dir="../"
out_index="index.html"
out_serviceworker="serviceworker.js"
pwa_dir="../pwa/"
pwa_webmanifest=".webmanifest"
pwa_serviceworker="serviceworker.js"
jar_closure_compiler="../bin/closure-compiler.jar"
jar_closure_stylesheets="../bin/closure-stylesheets.jar"

> "${out_dir}${out_index}"

ext_src=false
ext_css=false
ext_sfx=false
ext_gfx=false
src_files=
css_files=
sfx_files=
gfx_files=

while IFS='' read -r line || [[ -n "${line}" ]]; do
    if [ "${line}" == "/* FIRST SCRIPT LINE */" ]; then
        timestamp=$(date +%s)

        fmt="var COMPILE_TIME='%s';\n"
        printf "${fmt}" "${timestamp}" >> "${out_dir}${out_index}"

        printf "Compiling: %s\n" "${pwa_dir}${pwa_serviceworker}"
        minified=$(
            java -jar "${jar_closure_compiler}" "${pwa_dir}${pwa_serviceworker}"
        )

        out="${out_dir}${out_serviceworker}"
        fmt="var COMPILE_TIME='%s';\n%s"
        printf "${fmt}" "${timestamp}" "${minified}" > "${out}"

        continue
    fi

    if [ "${line}" == "/* PASTE EXTERNAL CSS HERE */" ]; then
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

        printf "Compiling: %s\n" "${files}"
        jar="${jar_closure_stylesheets}"
        arg1="--allow-unrecognized-properties"
        java -jar "${jar}" "${arg1}" ${files} >> "${out_dir}${out_index}"
        printf "\n" >> "${out_dir}${out_index}"

        continue
    fi

    if [ "${line}" == "<!-- PASTE EXTERNAL JS HERE -->" ]; then
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

        printf "<script>\n" >> "${out_dir}${out_index}"
        printf "Compiling: %s\n" "${files}"
        jar="${jar_closure_compiler}"
        java -jar "${jar}" ${files} >> "${out_dir}${out_index}"
        printf "\n</script>\n" >> "${out_dir}${out_index}"

        continue
    fi

    if [ "${line}" == "<!-- BEGIN EXTERNAL CSS -->" ]; then
        ext_css=true

        if [ -z "${pwa_dir}${pwa_webmanifest}" ]; then
            continue
        fi

        if [ -f "${pwa_dir}${pwa_webmanifest}" ]; then
            b64=$(base64 --wrap=0 "${pwa_dir}${pwa_webmanifest}")
            fmt="<link rel='manifest' "
            fmt+="href='data:application/manifest+json;base64,%s'>\n"
            printf "${fmt}" "${b64}" >> "${out_dir}${out_index}"
        else
            echo "Webmanifest file does not exist."
        fi

        continue
    fi

    if [ "${line}" == "<!-- END EXTERNAL CSS -->" ]; then
        ext_css=false
        continue
    fi

    if [ "${line}" == "<!-- BEGIN EXTERNAL SCRIPTS -->" ]; then
        ext_src=true
        continue
    fi

    if [ "${line}" == "<!-- END EXTERNAL SCRIPTS -->" ]; then
        ext_src=false
        continue
    fi

    if [ "${line}" == "<!-- BEGIN EXTERNAL SFX -->" ]; then
        ext_sfx=true
        continue
    fi

    if [ "${line}" == "<!-- BEGIN EXTERNAL GFX -->" ]; then
        ext_gfx=true
        continue
    fi

    if [ "${line}" == "<!-- END EXTERNAL SFX -->" ]; then
        ext_sfx=false

        for file in "${sfx_files[@]}"
        do
            id=$(echo "$file" | cut "-d " -f1)
            file=$(echo "$file" | cut "-d " -f2)
            if [ -z "$file" ]; then
                continue
            else
                if [ -f "$file" ]; then
                    fname=$(basename $file)
                    b64=$(base64 --wrap=0 "${file}")

                    fmt="<script>show_progress('%s');</script>\n"
                    printf "${fmt}" "${fname}" >> "${out_dir}${out_index}"

                    fmt="<audio id='%s' "
                    fmt+="src='data:audio/x-wav;base64,%s'></audio>\n"
                    printf "${fmt}" "${id}" "${b64}" >> "${out_dir}${out_index}"
                else
                    echo "External SFX '$file' ($id) does not exist."
                fi
            fi
        done

        continue
    fi

    if [ "${line}" == "<!-- END EXTERNAL GFX -->" ]; then
        ext_gfx=false

        for file in "${gfx_files[@]}"
        do
            id=$(echo "$file" | cut "-d " -f1)
            file=$(echo "$file" | cut "-d " -f2)

            if [ -z "$file" ]; then
                continue
            fi

            if [ ! -f "$file" ]; then
                echo "External GFX '$file' ($id) does not exist."
                continue
            fi

            fname=$(basename $file)
            mimetype=$(file --brief --mime-type "${file}")
            b64=$(base64 --wrap=0 "${file}")

            fmt="<script>show_progress('%s');</script>\n"
            printf "${fmt}" "${fname}" >> "${out_dir}${out_index}"

            fmt="<img id='%s' src='data:%s;base64,%s'></img>\n"
            out="${out_dir}${out_index}"
            printf "${fmt}" "${id}" "${mimetype}" "${b64}" >> "${out}"
        done

        continue
    fi

    if [ "$ext_css" = true ] ; then
        file=$(echo "${line}" | cut -d\" -f2)
        css_files+=("$file")
        continue
    fi

    if [ "$ext_src" = true ] ; then
        file=$(echo "${line}" | cut -d\" -f2)
        src_files+=("$file")
        continue
    fi

    if [ "$ext_sfx" = true ] ; then
        id=$(echo "${line}" | cut -d\' -f2)
        file=$(echo "${line}" | cut -d\" -f2)
        sfx_files+=("$id $file")
        continue
    fi

    if [ "$ext_gfx" = true ] ; then
        id=$(echo "${line}" | cut -d\' -f2)
        file=$(echo "${line}" | cut -d\" -f2)
        gfx_files+=("$id $file")
        continue
    fi

    echo "${line}" >> "${out_dir}${out_index}"
done < ${1:-cryptograffiti.html}
