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
NONCE_ERRORS=0
OTHER_ERRORS=0
CACHE_ERRORS=0
PULSE_PERIOD=30
CACHE=""
TXBUF=""

log() {
    if [ "${OTHER_ERRORS}" -ge "1" ]; then
        CANARY="\033[0;31m::\033[0m" # Canary is "dead", we got errors.
    fi

    local now=`date +"${DATE_FORMAT}"`
    printf "\033[1;36m%s\033[0m ${CANARY} %s\n" "$now" "$1" >/dev/stderr
}

alert() {
    if [ "${OTHER_ERRORS}" -ge "1" ]; then
        CANARY="\033[0;31m::\033[0m" # Canary is "dead", we got errors.
    fi

    local now=`date +"${DATE_FORMAT}"`
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
        NAME=`printf "%s" "${cfg}" | jq -r -M '.title | select (.!=null)'`
        INIT=`printf "%s" "${cfg}" | jq -r -M '.["init.sh"] | select (.!=null)'`
        CALL=`printf "%s" "${cfg}" | jq -r -M '.["call.sh"] | select (.!=null)'`
        ADDR=`printf "%s" "${cfg}" | jq -r -M .api`
        CGDF=`printf "%s" "${cfg}" | jq -r -M .cgd`
        CLIF=`printf "%s" "${cfg}" | jq -r -M '.["bitcoin-cli"]'`
        DDIR=`printf "%s" "${cfg}" | jq -r -M '.["bitcoin-dat"]'`

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

    if [ ! $(which "docker" 2>/dev/null ) ] ; then
        log "Program not found: docker"
        exit
    else
        local docker_img="v4tech/imagemagick:latest"
        docker inspect "${docker_img}" > /dev/null 2>&1 \
            || { log "Docker image not found: ${docker_img}" ; exit ; }
    fi

    return 0
}
################################################################################
config
################################################################################
get_cgd_cmd() {
    local pipe1="${CLIF} ${DDIR} getrawtransaction {} 1"
    local pipe2="${CGDF} --unicode-len 60"
    local pipe3="jq -r -M -c 'select(.graffiti == true)'"
    printf "%s | %s | %s" "${pipe1}" "${pipe2}" "${pipe3}"
    return 0
}

compile_graffiti_json() {
    local gbuf="{"
    local tx_count=0

    local p1_1=".files[]"
    local p1_2=".[\"type\"] = .mimetype"
    local p1_3="del(.mimetype, .content, .entropy, .unicode)"
    local p2=". + {\"fsize\": .fsize|tostring, \"offset\": .offset|tostring}"
    local p3="[.[] | select(.error == null)]"
    local jq_arg="[${p1_1} | ${p1_2} | ${p1_3}] | map_values( ${p2} ) | ${p3}"

    while IFS= read -r line; do
        ((tx_count++))
        if [ "${tx_count}" -gt "${TXS_PER_QUERY}" ]; then
            return 1
        fi

        local txid=`printf "%s" "${line}" | jq -M -r '.txid'`
        local txsz=`printf "%s" "${line}" | jq -M -r '.size'`
        local txtm=`printf "%s" "${line}" | jq -M -r '.time'`

        # We must convert all known integer values
        # to strings because Cryptograffiti's API
        # notoriously only recognizes string values.

        local files=$(printf "%s" "${line}" | jq -M -r -c "${jq_arg}")

        if [ "${gbuf}" != "{" ]; then
            gbuf+=","
        fi

        if [ "${txtm}" == "null" ]; then
            gbuf+="\"${txid}\":{\"txsize\":\"${txsz}\",\"files\":${files}}"
        else
            gbuf+="\"${txid}\":{\"txsize\":\"${txsz}\",\"txtime\":\"${txtm}\","
            gbuf+="\"files\":${files}}"
        fi
    done <<< "${1}"
    gbuf+="}"

    printf "%s" "${gbuf}"
    return 0
}

init() {
    local wdir=`pwd`
    log "${wdir}"
    log "${INIT} ${CONF}"
    local config=`"${INIT}" "${CONF}"`

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

    local response=`"${CALL}" "${CONF}" "get_constants" "${data}"`

    local result=`printf "%s" "${response}" | jq -r -M .result`
    if [ "${result}" == "SUCCESS" ]; then
        printf "%s" "${response}" | jq .constants

        NONCE_ERRORS=0
        TXS_PER_QUERY=$(
            printf "%s" "${response}" |
            jq -r -M .constants       |
            jq -r -M .TXS_PER_QUERY
        )

        log "TXS_PER_QUERY: ${TXS_PER_QUERY}"
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
        local pulse_start=`date +%s`

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
            if ! step ; then
                alert "Program step reported an error, breaking the loop."
                break
            fi
        else
            log "Some of the required commands are not available."
            exit
        fi

        local pulse_end=`date +%s`

        if [ "${pulse_end}" -ge "${pulse_start}" ]; then
            local delta_time=$((pulse_end-pulse_start))
            if [ "${delta_time}" -lt "${PULSE_PERIOD}" ]; then
                local stime=$((PULSE_PERIOD-delta_time))

                if [ ! -z "${TXBUF}" ] || [ ! -z "${CACHE}" ] ; then
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

step() {
    if [ -z "${CACHE}" ] ; then
        local newscount="0"
        local news=""

        if [ -z "${TXBUF}" ] ; then
            local bestblock=`${CLIF} ${DDIR} getbestblockhash`
            if [ "${bestblock}" != "${BESTBLOCK}" ]; then
                log "Loading block ${bestblock}."
                BESTBLOCK="${bestblock}"
            fi

            local pool=`${CLIF} ${DDIR} getrawmempool | jq -M -r .[]`
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

            newscount=`echo -n "${news}" | grep -c '^'`
        fi

        local bufsz=`echo -n "${TXBUF}" | grep -c '^'`
        if [ "${bufsz}" -ge "1" ]; then
            if [ "${newscount}" -ge "1" ]; then
                news=`printf "%s\n%s" "${TXBUF}" "${news}"`
            else
                news="${TXBUF}"
            fi

            TXBUF=""
            newscount=`echo -n "${news}" | grep -c '^'`
        fi

        if [ "${newscount}" -gt "${TXS_PER_QUERY}" ]; then
            local skip=$((newscount-TXS_PER_QUERY))
            TXBUF=`printf "%s" "${news}" | tail "-${skip}"`
            news=`printf "%s" "${news}" | head "-${TXS_PER_QUERY}"`
            newscount=`echo -n "${news}" | grep -c '^'`
        fi

        if [ "$newscount" -ge "1" ]; then
            if [ "$newscount" -gt "1" ]; then
                local line_queue=`echo -n "${TXBUF}" | grep -c '^'`
                if [ "${line_queue}" -ge "1" ]; then
                    log "Decoding ${newscount} TXs (${line_queue} in queue)."
                else
                    log "Decoding ${newscount} TXs."
                fi
            else
                local txhash=`printf "%s" "${news}" | tr -d '\n'`
                log "Decoding TX ${txhash}."
            fi

            local decoding_start=$SECONDS

            local cgd_cmd=$(get_cgd_cmd)
            local graffiti=$(
                echo "${news}" |
                parallel --timeout 30 -P ${WORKERS} "${cgd_cmd}"
            )
            local state=$?

            docker rm $(docker ps -a -q) 2>/dev/null

            if [ "${state}" -ge "1" ]; then
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
                        alert "Other error from parallel."
                    fi
                fi
                ((OTHER_ERRORS++))
            fi

            local decoding_time=$(( SECONDS - decoding_start ))

            if [ "${decoding_time}" -gt "1" ]; then
                log "Decoding took ${decoding_time} seconds."
            fi

            local msgcount=`echo -n "${graffiti}" | grep -c '^'`

            if [ "${msgcount}" -ge "1" ]; then
                local plural=""
                if [ "${msgcount}" -gt "1" ]; then
                    plural="s"
                fi
                log "Detected graffiti from ${msgcount} TX${plural}."

                local jqcmd="jq -C '.files[]? |= del(.content)'"
                echo "${graffiti}" |
                parallel --pipe -P "${WORKERS}" "${jqcmd}"

                local graffiti_buffer=$(compile_graffiti_json "${graffiti}")

                if [ -z "${graffiti_buffer}" ] ; then
                    # This should never happen because previously we have made
                    # sure that we are not decoding more TXs than TXS_PER_QUERY
                    # allows per step (see how ${news} gets its value).
                    ((OTHER_ERRORS++))
                    local tx_limit="${TXS_PER_QUERY}"
                    alert "Error, TX count exceeds the limit of ${tx_limit}!"
                else
                    local tcount=`printf "%s" "${graffiti_buffer}" | jq length`
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

                    #jq . >/dev/stderr <<< "${CACHE}"
                fi
            fi
        fi
    else
        log "Trying to upload from cache."
    fi

    if [ -z "${CACHE}" ] ; then
        return 0
    fi

    NONC=$(
        printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64
    )

    local datafmt="{\"guid\":\"%s\",\"nonce\":\"%s\",\"graffiti\":%s}"
    local data=$(
        printf "${datafmt}" "${GUID}" "${NONC}" "${CACHE}" | xxd -p | tr -d '\n'
    )

    # for debugging:
    #for i in {1..131072}
    #do
    #   data+="2020"
    #done

    local response=$("${CALL}" "${CONF}" "set_txs" <<< "${data}")
    local state=$?

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
        local result=`printf "%s" "${response}" | jq -r -M .result`
        local rpm=`printf "%s" "${response}" | jq -r -M .api_usage.rpm`
        local max_rpm=`printf "%s" "${response}" | jq -r -M .api_usage.max_rpm`

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
            local msg="API usage is reaching its hard limit of ${max_rpm} RPM, "
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
