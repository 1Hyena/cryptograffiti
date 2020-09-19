#!/bin/bash

################################################################################
# Example usage: ./decoder.sh config.json (TX hash)                            #
################################################################################
CONF="$1"                                                                      #
TXID="$2"                                                                      #
SKEY=""                                                                        #
SEED=""                                                                        #
GUID=""                                                                        #
TOKN=""                                                                        #
NONC=""                                                                        #
ADDR=""                                                                        #
NAME=""                                                                        #
CLIF=""                                                                        #
CGDF=""                                                                        #
DDIR=""                                                                        #
################################################################################
DATE_FORMAT="%Y-%m-%d %H:%M:%S"
CANARY="::"
WORKERS="16"
BESTBLOCK=""
TXS_PER_QUERY=0
MAX_DATA_SIZE=0
NONCE_ERRORS=0
OTHER_ERRORS=0
CHEAP_ERRORS=0
CACHE_ERRORS=0
PULSE_PERIOD=30
CACHE=""
TXBUF=""

log() {
    if [ "${OTHER_ERRORS}" -ge "1" ]; then
        CANARY="\033[1;31m::\033[0m"
    elif [ "${CHEAP_ERRORS}" -ge "1" ]; then
        CANARY="\033[0;31m::\033[0m"
    fi

    local now=$(date +"${DATE_FORMAT}")
    printf "\033[1;36m%s\033[0m ${CANARY} %s\n" "$now" "$1" >/dev/stderr
}

alert() {
    if [ "${OTHER_ERRORS}" -ge "1" ]; then
        CANARY="\033[1;31m::\033[0m"
    elif [ "${CHEAP_ERRORS}" -ge "1" ]; then
        CANARY="\033[0;31m::\033[0m"
    fi

    local now=$(date +"${DATE_FORMAT}")
    local format="\033[1;36m%s\033[0m ${CANARY} \033[1;33m%s\033[0m\n"
    printf "${format}" "$now" "$1" >/dev/stderr
}

LOCKFILE=/tmp/7Ngp0oRoKc7QHIqC
NEWSFILE=/tmp/Y9Jx4Gvab0MYNjH0
OLDSFILE=/tmp/dVDvED7qzF0wHFp1
TEMPFILE=/tmp/g2xEyKg2hqoDuCii
touch $LOCKFILE
read LAST_PID < $LOCKFILE

if [ ! -z "$LAST_PID" -a -d "/proc/${LAST_PID}" ]
then
    log "Process is already running!"
    exit
fi
echo $$ > $LOCKFILE

truncate -s 0 $NEWSFILE
truncate -s 0 $OLDSFILE
truncate -s 0 $TEMPFILE

config() {
    if [ -z "$CONF" ] ; then
        log "Configuration file not provided, exiting."
        exit
    fi

    if [ ! -z "$TXID" ] ; then
        local txid=$(
            printf "%s" "${TXID}" |
            tr -dc A-Za-z0-9      |
            head -c 64            |
            xxd -r -p             |
            xxd -p                |
            tr -d '\n'
        )

        if [ ${#txid} -ne 64 ] || [ "${TXID}" != "${txid}" ]; then
            log "Invalid TX hash parameter: ${TXID}"
            exit
        fi

        TXBUF="${txid}"
    fi

    if [[ -r ${CONF} ]] ; then
        local cfg=$(<"$CONF")
        NAME=$(printf "%s" "${cfg}" | jq -r -M '.title | select (.!=null)')
        INIT=$(
            printf "%s" "${cfg}" | jq -r -M '.["init.sh"] | select (.!=null)'
        )
        CALL=$(
            printf "%s" "${cfg}" | jq -r -M '.["call.sh"] | select (.!=null)'
        )
        ADDR=$(printf "%s" "${cfg}" | jq -r -M .api)
        CGDF=$(printf "%s" "${cfg}" | jq -r -M .cgd)
        CLIF=$(printf "%s" "${cfg}" | jq -r -M '.["bitcoin-cli"]')
        DDIR=$(printf "%s" "${cfg}" | jq -r -M '.["bitcoin-dat"]')

        if [ ! -z "${DDIR}" ] ; then
            DDIR="-datadir=${DDIR}"
        fi

        if [ ! -z "${NAME}" ] ; then
            printf "\033]0;%s\007" "${NAME}"
        fi
    else
        log "Failed to read the configuration file."
        exit
    fi

    if [ -z "$INIT" ] ; then
        log "Init script not provided, exiting."
        exit
    fi

    if [ -z "$CALL" ] ; then
        log "Call script not provided, exiting."
        exit
    fi

    if [ -z "$ADDR" ] ; then
        log "API address not provided, exiting."
        exit
    fi

    if [ ! $(which "${CGDF}" 2>/dev/null ) ] ; then
        log "Program not found: ${CGDF}"
        exit
    fi

    if [ ! $(which "${CLIF}" 2>/dev/null ) ] ; then
        log "Program not found: ${CLIF}"
        exit
    fi

    if [ ! $(which "djpeg" 2>/dev/null ) ] ; then
        log "Program not found: djpeg"
        exit
    fi

    return 0
}
################################################################################
config
################################################################################
compile_graffiti_json() {
    local jq_cmd="jq -r -M -c '"
    jq_cmd+=".files=([.files[] | {fsize, hash, location, mimetype, offset, "
    jq_cmd+="error} | .[\"type\"] = .mimetype | del(.mimetype)] | map_values( "
    jq_cmd+=". + {\"fsize\": .fsize|tostring, \"offset\": .offset|tostring} ) |"
    jq_cmd+=" [.[] | select(.error == null) | del(.error) ]) | {files, txid, "
    jq_cmd+="size, blocktime, blockheight} | .[\"txsize\"] = (.size|tostring) "
    jq_cmd+="| del(.size) | .[\"txtime\"] = (.blocktime|tostring) | "
    jq_cmd+="del(.blocktime) | .[\"txheight\"] = (.blockheight|tostring) | "
    jq_cmd+="del(.blockheight) | ( select(.txtime == \"null\") |= "
    jq_cmd+="del(.txtime) ) | ( select(.txheight == \"null\") |= "
    jq_cmd+="del(.txheight) ) '"

    local jq_out=$(
        parallel --pipe -N 1 --timeout 10 -P "${WORKERS}" "${jq_cmd}" <<< "${1}"
    )

    local jq_arg="map( {(.txid|tostring): del(.txid) } ) | add"

    jq -M -r -s -c "${jq_arg}" <<< "${jq_out}"
    return 0
}

init() {
    local wdir=$(pwd)
    log "${wdir}"
    log "${INIT} ${CONF}"
    local config=$("${INIT}" "${CONF}")

    SKEY=$(jq -r -M .sec_key <<< "${config}" | xxd -r -p | xxd -p | tr -d '\n')
    SEED=$(jq -r -M .seed    <<< "${config}" | xxd -r -p | xxd -p | tr -d '\n')
    GUID=$(jq -r -M .guid    <<< "${config}" | xxd -r -p | xxd -p | tr -d '\n')
    TOKN=$(jq -r -M .token   <<< "${config}" | xxd -r -p | xxd -p | tr -d '\n')
    NONC=$(jq -r -M .nonce   <<< "${config}" | xxd -r -p | xxd -p | tr -d '\n')
    ADDR=$(jq -r -M .api     <<< "${config}")

    if [ ! -z "${SKEY}" ] \
    && [ ! -z "${SEED}" ] \
    && [ ! -z "${TOKN}" ] \
    && [ ! -z "${ADDR}" ] \
    && [ ! -z "${NONC}" ] \
    && [ ! -z "${GUID}" ] ; then
        log "Session has been initialized successfully."
        log "API URL: ${ADDR}"
    else
        alert "Failed to initialize the session, exiting."
        exit
    fi

    NONC=$(
        printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64
    )

    local data=$(
        printf '{"guid":"%s","nonce":"%s"}' "${GUID}" "${NONC}" |
        xxd -p                                                  |
        tr -d '\n'
    )

    local response=$("${CALL}" "${CONF}" "get_constants" "${data}")
    local result=$(printf "%s" "${response}" | jq -r -M .result)

    if [ "${result}" == "SUCCESS" ]; then
        printf "%s" "${response}" | jq .constants

        NONCE_ERRORS=0
        TXS_PER_QUERY=$(
            printf "%s" "${response}" |
            jq -r -M .constants       |
            jq -r -M .TXS_PER_QUERY
        )

        log "TXS_PER_QUERY: ${TXS_PER_QUERY}"

        MAX_DATA_SIZE=$(
            printf "%s" "${response}" |
            jq -r -M .constants       |
            jq -r -M .MAX_DATA_SIZE
        )

        log "MAX_DATA_SIZE: ${MAX_DATA_SIZE}"

        return 0
    fi

    printf "%s" "${response}" | jq .error >/dev/stderr

    local error_code=$(
        printf "%s" "${response}" |
        jq -r -M .error           |
        jq -r -M .code
    )

    if [ "${error_code}" == "ERROR_NONCE" ]; then
        ((NONCE_ERRORS++))
    fi

    return 1
}

loop() {
    while :
    do
        local pulse_start=$(date +%s)

        if [ $(which "${CLIF}" 2>/dev/null ) ] \
        && [ $(which "${CGDF}" 2>/dev/null ) ] \
        && [ $(which sort)                   ] \
        && [ $(which uniq)                   ] \
        && [ $(which echo)                   ] \
        && [ $(which grep)                   ] \
        && [ $(which comm)                   ] \
        && [ $(which curl)                   ] \
        && [ $(which tr)                     ] \
        && [ $(which tee)                    ] \
        && [ $(which parallel)               ] \
        && [ $(which jq)                     ] ; then
            if ! step "${TXS_PER_QUERY}"  ; then
                alert "Program step reported an error, breaking the loop."
                break
            fi
        else
            log "Some of the required commands are not available."
            exit
        fi

        local pulse_end=$(date +%s)

        if [ "${pulse_end}" -ge "${pulse_start}" ]; then
            local delta_time=$((pulse_end-pulse_start))
            if [ "${delta_time}" -lt "${PULSE_PERIOD}" ]; then
                local stime=$((PULSE_PERIOD-delta_time))

                if [ ! -z "${TXBUF}" ] \
                || [ ! -z "${CACHE}" ] \
                || [ ! -z "${VOLATILE_TXS}" ] ; then
                    log "Too much work in queue, skipping the nap of ${stime}s."
                else
                    log "Sleeping for ${stime}s."
                    sleep "${stime}"
                fi
            elif [ "${delta_time}" -gt "${PULSE_PERIOD}" ]; then
                local lost_time=$((delta_time-PULSE_PERIOD))
                alert "Decoder falls behind schedule by ${lost_time}s."
            fi
        else
            ((OTHER_ERRORS++))
            alert "Error, ${pulse_end} < ${pulse_start}!"
            sleep "${PULSE_PERIOD}"
        fi
    done

    return 0
}

decode_graffiti() {
    handle_state() {
        local state="${1}"
        local command=${2}""

        if [ "${state}" -ge "1" ]; then
            ((CHEAP_ERRORS++))
            if [ "${state}" -eq "101" ]; then
                alert "More than 100 jobs failed."
            else
                if [ "${state}" -le "100" ]; then
                    if [ "${state}" -eq "1" ]; then
                        alert "1 job failed."
                    else
                        alert "${state} jobs failed."
                    fi
                else
                    alert "Other error from parallel (${command})."
                fi
            fi
        fi

        return 0
    }

    # Since this function could modify the CHEAP_ERRORS global variable via the
    # handle_state function, we must not call this function from a subshell. For
    # that reason, we use the DECODED_GRAFFITI global variable where we store
    # the result of this function.
    DECODED_GRAFFITI=""

    local buf="${1}"
    local prevbuf=""

    if [ -z "${buf}" ] ; then
        return 0
    fi

    local cli_cmd="${CLIF} ${DDIR} getrawtransaction {} "
    local cli_state
    prevbuf="${buf}"
    buf=$(
        parallel          \
        --halt now,fail=1 \
        --timeout 20      \
        -P ${WORKERS}     \
        "${cli_cmd}" <<< "${buf}"
    )
    cli_state=$?

    if [ "${cli_state}" -ge "1" ]; then
        buf="${prevbuf}"
        buf=$(
            parallel      \
            --timeout 20  \
            -P ${WORKERS} \
            "${cli_cmd}" <<< "${buf}" 2>/dev/null
        )
        cli_state=$?
    fi

    handle_state "${cli_state}" "${cli_cmd}"

    if [ -z "${buf}" ] ; then
        return 0
    fi

    local cgd_cmd="${CGDF} --unicode-len 60 -M image/"
    local cgd_state
    prevbuf="${buf}"
    buf=$(
        parallel          \
        --halt now,fail=1 \
        --pipe            \
        -N 1              \
        --timeout 10      \
        -P ${WORKERS}     \
        "${cgd_cmd}" <<< "${buf}"
    )
    cgd_state=$?

    if [ "${cgd_state}" -ge "1" ]; then
        buf="${prevbuf}"
        buf=$(
            parallel      \
            --pipe        \
            -N 1          \
            --timeout 10  \
            -P ${WORKERS} \
            "${cgd_cmd}" <<< "${buf}" 2>/dev/null
        )
        cgd_state=$?
    fi

    handle_state "${cgd_state}" "${cgd_cmd}"

    if [ -z "${buf}" ] ; then
        return 0
    fi

    local jq2_cmd="jq -r -M -c 'select(.graffiti == true)'"
    local jq2_state
    prevbuf="${buf}"
    buf=$(
        parallel          \
        --halt now,fail=1 \
        --pipe            \
        -N 1              \
        --timeout 10      \
        -P ${WORKERS}     \
        "${jq2_cmd}" <<< "${buf}"
    )
    jq2_state=$?

    if [ "${jq2_state}" -ge "1" ]; then
        buf="${prevbuf}"
        buf=$(
            parallel      \
            --pipe        \
            -N 1          \
            --timeout 10  \
            -P ${WORKERS} \
            "${jq2_cmd}" <<< "${buf}" 2>/dev/null
        )
        jq2_state=$?
    fi

    handle_state "${jq2_state}" "${jq2_cmd}"

    local txids=$(jq -M -r -c -s '.[].txid' <<< "${buf}")

    local extra=""

    if [ ! -z "${txids}" ] ; then
        local extra_cmd
        local extra_state

        extra_cmd="${CLIF} ${DDIR} getrawtransaction {} 1 "
        extra=$(
            parallel          \
            --halt now,fail=1 \
            --timeout 20      \
            -P ${WORKERS}     \
            "${extra_cmd}" <<< "${txids}"
        )
        extra_state=$?

        if [ "${extra_state}" -ge "1" ]; then
            extra=$(
                parallel      \
                --timeout 20  \
                -P ${WORKERS} \
                "${extra_cmd}" <<< "${txids}" 2>/dev/null
            )
            extra_state=$?
        fi

        handle_state "${extra_state}" "${extra_cmd}"

        extra=$(jq -M -r -c '{txid, blocktime, blockheight}' <<< "${extra}")
    fi

    if [ -z "${extra}" ] ; then
        DECODED_GRAFFITI="${buf}"
    else
        local jqarg=''
        jqarg+='map( {(.txid|tostring): . } ) | '
        jqarg+='reduce .[] as $item ({}; . * $item) | .[]'

        DECODED_GRAFFITI=$(
            printf "%s\n%s" "${buf}" "${extra}" | jq -M -r -s -c "${jqarg}"
        )
    fi

    return 0
}

get_volatile_txs() {
    # Since this function could modify global variables, we must not call this
    # function from a subshell. For that reason, we set global variables where
    # store the return values of this function.
    if [ -z "${VOLATILE_TXS_FROM_BLOCKHEIGHT}" ] ; then
        return 0
    fi

    if [ -z "${VOLATILE_TXS_FROM_NR}" ] ; then
        VOLATILE_TXS_FROM_NR="0"
    fi

    VOLATILE_TXS=""

    local blockheight="${VOLATILE_TXS_FROM_BLOCKHEIGHT}"
    local max_txs="${1}"

    local old_nonce="${NONC}"
    NONC=$(
        printf "%s%s" "${NONC}" "${SEED}" |
        xxd -r -p                         |
        sha256sum                         |
        head -c 64
    )
    local new_nonce="${NONC}"

    local datafmt=""
    datafmt+="{\"guid\":\"%s\",\"nonce\":\"%s\",\"count\":\"%s\","
    datafmt+="\"height\":\"${blockheight}\",\"nr\":\"${VOLATILE_TXS_FROM_NR}\"}"
    local data=$(
        printf "${datafmt}" "${GUID}" "${NONC}" "${max_txs}" |
        xxd -p                                                     |
        tr -d '\n'
    )

    local state
    local response
    response=$("${CALL}" "${CONF}" "get_txs" <<< "${data}")
    state=$?

    NONC="${old_nonce}" # By default, we revert the nonce.

    if [ "${state}" -ge "1" ] ; then
        ((OTHER_ERRORS++))
        alert "${CALL}: Exit code ${state}."
    elif [ -z "${response}" ] ; then
        ((OTHER_ERRORS++))
        alert "Call script returned nothing."
    else
        # The API call did not fail on the network level, now it is safe to
        # actually update the nonce.
        NONC="${new_nonce}"

        local result=$(printf "%s" "${response}" | jq -r -M .result)
        local rpm=$(printf "%s" "${response}" | jq -r -M .api_usage.rpm)
        local max_rpm=$(
            printf "%s" "${response}" | jq -r -M .api_usage.max_rpm
        )

        if [ "${result}" == "SUCCESS" ]; then
            VOLATILE_TXS=$(
                printf "%s" "${response}" | jq -r -M '.txs[] | .txid'
            )

            local news_count=$(echo -n "${VOLATILE_TXS}" | grep -c '^')

            if [ "${news_count}" -ge "1" ] ; then
                local plural=" is"
                if [ "${news_count}" -gt "1" ]; then
                    plural="s are"
                fi

                local logmsg=""
                logmsg+="At least ${news_count} more TX${plural} "
                logmsg+="queued for refreshing, starting from "
                logmsg+="#${VOLATILE_TXS_FROM_NR} (RPM: ${rpm}/${max_rpm})."
                log "${logmsg}"

                VOLATILE_TXS_FROM_NR=$(
                    printf "%s" "${response}" | jq -r -M '.txs[] | .nr' |
                    sort -rn | head -n 1
                )
                VOLATILE_TXS_FROM_NR=$((VOLATILE_TXS_FROM_NR+1))
            fi
        elif [ "${result}" == "FAILURE" ]; then
            printf "%s" "${response}" | jq .error >/dev/stderr
            local error_code=$(
                jq -r -M .error <<< "${response}" | jq -r -M .code
            )

            if [ "${error_code}" == "ERROR_NONCE" ]; then
                ((NONCE_ERRORS++))
                return 1
            else
                local error_message=$(
                    jq -r -M '.error | .message' <<< "${response}"
                )
                alert "Failed to get volatile TXs: ${error_message}"
            fi
        else
            # Invalid output from the call script.
            alert "Call script returned invalid output:"
            printf "%s\n" "${response}" >/dev/stderr

            ((OTHER_ERRORS++))
            return 1
        fi

        ((rpm+=10))
        if [ "${rpm}" -ge "${max_rpm}" ]; then
            local msg=""
            msg+="API usage is reaching its hard limit of ${max_rpm} "
            msg+="RPM, throttling!"
            log "${msg}"
            sleep 60
        fi
    fi
}

step() {
    local txs_per_query="${1}"

    if [ -z "${CACHE}" ] ; then
        local newscount="0"
        local news=""

        if [ -z "${TXBUF}" ] ; then
            local pool=$(${CLIF} ${DDIR} getrawmempool | jq -M -r .[])
            local bestblock=$(${CLIF} ${DDIR} getbestblockhash)

            if [ "${bestblock}" != "${BESTBLOCK}" ]; then
                local blockheight=$(
                    ${CLIF} ${DDIR} getblockheader "${bestblock}" |
                    jq -M -r .height
                )

                if [ ! -z "${blockheight}" ] ; then
                    local txheight=$((
                        blockheight >= 100 ? blockheight-100 : 0
                    ))

                    local volatile_txs_count=$(
                        echo -n "${VOLATILE_TXS}" | grep -c '^'
                    )

                    if [ "${volatile_txs_count}" -lt "1"       ] \
                    || [ -z "${VOLATILE_TXS_FROM_BLOCKHEIGHT}" ] ; then
                        VOLATILE_TXS_FROM_NR="0"
                        VOLATILE_TXS_FROM_BLOCKHEIGHT="${txheight}"
                        log "Refreshing TXs since block ${txheight}."
                    fi
                else
                    alert "Invalid block height."
                fi

                log "Latest block is now ${bestblock}."
                BESTBLOCK="${bestblock}"
            fi

            get_volatile_txs "${txs_per_query}" # Subshell must be avoided here.

            local pfmt="%s%s\n"
            if [[ ! -z "${pool}" ]]; then
                pfmt="%s\n%s\n"
            fi

            pool=$(
                printf "${pfmt}" "${pool}" "${VOLATILE_TXS}"
            )

            news=$(
                ${CLIF} ${DDIR} getblock ${bestblock} |
                jq -M -r '.tx | .[]'
            )

            local nfmt="%s%s\n"
            if [[ ! -z "${pool}" ]]; then
                nfmt="%s\n%s\n"
            fi

            news=$(
                printf "${nfmt}" "${pool}" "${news}" |
                sort                                 |
                uniq                                 |
                tee ${NEWSFILE}                      |
                comm -23 - ${OLDSFILE}
            )

            mv ${OLDSFILE} ${TEMPFILE} && \
            mv ${NEWSFILE} ${OLDSFILE} && \
            mv ${TEMPFILE} ${NEWSFILE}

            newscount=$(echo -n "${news}" | grep -c '^')
        fi

        local bufsz=$(echo -n "${TXBUF}" | grep -c '^')
        if [ "${bufsz}" -ge "1" ]; then
            if [ "${newscount}" -ge "1" ]; then
                news=$(printf "%s\n%s" "${TXBUF}" "${news}")
            else
                news="${TXBUF}"
            fi

            TXBUF=""
            newscount=$(echo -n "${news}" | grep -c '^')
        fi

        if [ "${newscount}" -gt "${txs_per_query}" ]; then
            local skip=$((newscount-txs_per_query))
            TXBUF=$(printf "%s" "${news}" | tail "-${skip}")
            news=$(printf "%s" "${news}" | head "-${txs_per_query}")
            newscount=$(echo -n "${news}" | grep -c '^')
        fi

        if [ "$newscount" -ge "1" ]; then
            if [ "$newscount" -gt "1" ]; then
                local line_queue=$(echo -n "${TXBUF}" | grep -c '^')
                if [ "${line_queue}" -ge "1" ]; then
                    log "Decoding ${newscount} TXs (${line_queue} in queue)."
                else
                    log "Decoding ${newscount} TXs."
                fi
            else
                local txhash=$(printf "%s" "${news}" | tr -d '\n')
                log "Decoding TX ${txhash}."
            fi

            local decoding_start=$SECONDS

            decode_graffiti "${news}" # Subshell must be avoided here.
            local graffiti="${DECODED_GRAFFITI}"

            local decoding_time=$(( SECONDS - decoding_start ))

            if [ "${decoding_time}" -gt "1" ]; then
                log "Decoding took ${decoding_time} seconds."
            fi

            local msgcount_before=$(echo -n "${graffiti}" | grep -c '^')

            if [ "${msgcount_before}" -ge "1" ]; then
                local plural=""
                if [ "${msgcount_before}" -gt "1" ]; then
                    plural="s"
                fi
                log "Detected graffiti from ${msgcount_before} TX${plural}."

                local jqcmd="jq -C '.files[]? |= del(.content)'"

                parallel --pipe -N 1 -P "${WORKERS}" "${jqcmd}" <<<"${graffiti}"

                local graffiti_buffer=$(compile_graffiti_json "${graffiti}")

                #jq <<< "${graffiti_buffer}"

                local msgcount_after=$(
                    jq -r -M -c length <<< "${graffiti_buffer}"
                )

                if [ "${msgcount_before}" != "${msgcount_after}" ]; then
                    ((OTHER_ERRORS++))
                    local before="${msgcount_before}"
                    local after="${msgcount_after}"
                    alert "Error, ${after} of ${before} TXs compiled!"
                    printf "%s\n" "${graffiti_buffer}"
                fi

                local tcount=$(printf "%s" "${graffiti_buffer}" | jq length)
                local fcount=$(
                    printf "%s" "${graffiti_buffer}" |
                    jq -r -M '.[].files'             |
                    jq -r -M -s add                  |
                    jq length
                )

                if [ "${tcount}" -eq "1" ]; then
                    log "Uploading ${fcount} graffiti from ${tcount} TX."
                else
                    log "Uploading ${fcount} graffiti from ${tcount} TXs."
                fi

                CACHE="${graffiti_buffer}"
            fi
        fi
    else
        log "Trying to upload from cache."
    fi

    if [ -z "${CACHE}" ] ; then
        return 0
    fi

    local upload_txs=$(
        jq -r -M -c 'keys | .[]' <<< "${CACHE}"
    )

    local old_nonce="${NONC}"
    NONC=$(
        printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64
    )
    local new_nonce="${NONC}"

    local datafmt="{\"guid\":\"%s\",\"nonce\":\"%s\",\"graffiti\":%s}"
    local data=$(
        printf "${datafmt}" "${GUID}" "${NONC}" "${CACHE}" | xxd -p | tr -d '\n'
    )

    local datasz=$(( ${#data} / 2 ))

    NONC="${old_nonce}" # By default, we revert the nonce.

    if [ "${datasz}" -gt "${MAX_DATA_SIZE}" ]; then
        alert "Upload of ${datasz} bytes exceeds the limit of ${MAX_DATA_SIZE}".

        local upload_tx_count=$(echo -n "${upload_txs}" | grep -c '^')

        if [ "${upload_tx_count}" -gt "1" ]; then
            local txbufsz=$(echo -n "${TXBUF}" | grep -c '^')

            if [ "${txbufsz}" -ge "1" ]; then
                TXBUF=$(printf "%s\n%s" "${upload_txs}" "${TXBUF}")
            else
                TXBUF="${upload_txs}"
            fi

            CACHE=""
            txs_per_query=$(( ${upload_tx_count} / 2 ))

            if ! step "${txs_per_query}"  ; then
                return 1
            fi

            return 0
        fi
    fi

    local state
    local response
    response=$("${CALL}" "${CONF}" "set_txs" <<< "${data}")
    state=$?

    if [ "${state}" -ge "1" ] ; then
        ((OTHER_ERRORS++))
        alert "${CALL}: Exit code ${state}, dumping the cache."
        printf "%s\n" "${CACHE}" >/dev/stderr

        CACHE=""
    elif [ -z "${response}" ] ; then
        ((OTHER_ERRORS++))
        alert "Call script returned nothing."
        alert "Dumping the cache and dropping it."
        printf "%s\n" "${CACHE}" >/dev/stderr
        CACHE=""
    else
        # The API call did not fail on the network level, now it is safe to
        # actually update the nonce.
        NONC="${new_nonce}"

        local result=$(printf "%s" "${response}" | jq -r -M .result)
        local rpm=$(printf "%s" "${response}" | jq -r -M .api_usage.rpm)
        local max_rpm=$(printf "%s" "${response}" | jq -r -M .api_usage.max_rpm)

        if [ "${result}" == "SUCCESS" ]; then
            log "Upload completed successfully (RPM: ${rpm}/${max_rpm})."
            CACHE=""
        elif [ "${result}" == "FAILURE" ]; then
            printf "%s" "${response}" | jq .error >/dev/stderr
            local error_code=$(
                jq -r -M .error <<< "${response}" | jq -r -M .code
            )

            if [ "${error_code}" == "ERROR_NONCE" ]; then
                ((NONCE_ERRORS++))
                return 1
            else
                local error_message=$(
                    jq -r -M '.error | .message' <<< "${response}"
                )
                alert "Failed to upload the cache: ${error_message}"
                ((CACHE_ERRORS++))

                if [ "${CACHE_ERRORS}" -ge "5" ]; then
                    alert "Too many failed attempts when uploading the cache."
                    alert "Dumping the cache and dropping it."
                    printf "%s\n" "${CACHE}" >/dev/stderr
                    CACHE=""
                    CACHE_ERRORS=0
                    ((OTHER_ERRORS++))
                    return 1
                fi
            fi
        else
            # Invalid output from the call script.
            alert "Call script returned invalid output:"
            printf "%s\n" "${response}" >/dev/stderr

            ((OTHER_ERRORS++))
            alert "Dumping the cache."
            printf "%s\n" "${CACHE}" >/dev/stderr

            CACHE=""
            return 1
        fi

        ((rpm+=10))
        if [ "${rpm}" -ge "${max_rpm}" ]; then
            local msg=""
            msg+="API usage is reaching its hard limit of ${max_rpm} RPM, "
            msg+="throttling!"
            log "${msg}"
            sleep 60
        fi
    fi

    return 0
}

main() {
    while :
    do
        if init; then
            loop
        fi

        sleep 1

        if [ "${NONCE_ERRORS}" -ge "5" ]; then
            alert "Too many nonce errors, exiting."
            exit
        elif [ "${NONCE_ERRORS}" -ge "1" ]; then
            log "Trying to synchronize the nonce (${NONCE_ERRORS})."
        else
            log "Restarting the session."
            sleep 10
        fi
    done

    return 0
}
################################################################################
main
################################################################################
