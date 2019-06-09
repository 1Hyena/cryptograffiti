#!/bin/bash

################################################################################
# Example usage: ./decoder.sh config.json                                      #
################################################################################
CONF="$1"                                                                      #
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
TXS_PER_QUERY=0
NONCE_ERRORS=0
OTHER_ERRORS=0
TICK=8
CACHE=""

log() {
    now=`date +"${DATE_FORMAT}"`
    printf "\033[1;36m%s\033[0m ${CANARY} %s\n" "$now" "$1" >/dev/stderr
}

lockfile=/tmp/7Ngp0oRoKc7QHIqC
newsfile=/tmp/Y9Jx4Gvab0MYNjH0
oldsfile=/tmp/dVDvED7qzF0wHFp1
tempfile=/tmp/g2xEyKg2hqoDuCii
touch $lockfile
read lastPID < $lockfile

if [ ! -z "$lastPID" -a -d /proc/$lastPID ]
then
    log "Process is already running!"
    exit
fi
echo $$ > $lockfile

truncate -s 0 $newsfile
truncate -s 0 $oldsfile
truncate -s 0 $tempfile
################################################################################

if [ -z "$CONF" ] ; then
    log "Configuration file not provided, exiting."
    exit
fi

if [[ -r ${CONF} ]] ; then
    config=$(<"$CONF")
    NAME=`printf "%s" "${config}" | jq -r -M '.title | select (.!=null)'`
    INIT=`printf "%s" "${config}" | jq -r -M '.["init.sh"] | select (.!=null)'`
    CALL=`printf "%s" "${config}" | jq -r -M '.["call.sh"] | select (.!=null)'`
    ADDR=`printf "%s" "${config}" | jq -r -M .api`
    CGDF=`printf "%s" "${config}" | jq -r -M .cgd`
    CLIF=`printf "%s" "${config}" | jq -r -M '.["bitcoin-cli"]'`
    DDIR=`printf "%s" "${config}" | jq -r -M '.["bitcoin-dat"]'`

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

while :
do
    wdir=`pwd`
    log "${wdir}"
    log "${INIT} ${CONF}"
    config=`"${INIT}" "${CONF}"`

    SKEY=`printf "%s" "${config}" | jq -r -M .sec_key | xxd -r -p | xxd -p | tr -d '\n'`
    SEED=`printf "%s" "${config}" | jq -r -M .seed    | xxd -r -p | xxd -p | tr -d '\n'`
    GUID=`printf "%s" "${config}" | jq -r -M .guid    | xxd -r -p | xxd -p | tr -d '\n'`
    TOKN=`printf "%s" "${config}" | jq -r -M .token   | xxd -r -p | xxd -p | tr -d '\n'`
    NONC=`printf "%s" "${config}" | jq -r -M .nonce   | xxd -r -p | xxd -p | tr -d '\n'`
    ADDR=`printf "%s" "${config}" | jq -r -M .api`

    if [ ! -z "${SKEY}" ] \
    && [ ! -z "${SEED}" ] \
    && [ ! -z "${TOKN}" ] \
    && [ ! -z "${ADDR}" ] \
    && [ ! -z "${NONC}" ] \
    && [ ! -z "${GUID}" ] ; then
        log "Session has been initialized successfully."
        log "API URL: ${ADDR}"
    else
        log "Failed to initialize the session, exiting."
        exit
    fi

    NONC=`printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64`
    DATA=`printf '{"guid":"%s","nonce":"%s"}' "${GUID}" "${NONC}" | xxd -p | tr -d '\n'`
    response=`"${CALL}" "${CONF}" "get_constants" "${DATA}"`

    result=`printf "%s" "${response}" | jq -r -M .result`
    if [ "${result}" == "SUCCESS" ]; then
        printf "%s" "${response}" | jq .constants

        NONCE_ERRORS=0
        TXS_PER_QUERY=`printf "%s" "${response}" | jq -r -M .constants | jq -r -M .TXS_PER_QUERY`
        log "TXS_PER_QUERY: ${TXS_PER_QUERY}"

        while :
        do
            if [ "$OTHER_ERRORS" -ge "1" ]; then
                CANARY="\033[0;31m::\033[0m" # Canary is "dead", we got errors.
            fi

            ((TICK++))
            if [ "$TICK" -ge "10" ]; then
                TICK=0

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
                    if [ -z "${CACHE}" ] ; then
                        bestblock=`${CLIF} ${DDIR} getbestblockhash`
                        pool=`${CLIF} ${DDIR} getrawmempool | jq -M -r .[]`
                        news=`${CLIF} ${DDIR} getblock ${bestblock} | jq -M -r '.tx | .[]'`
                        nfmt="%s%s\n"
                        if [[ ! -z "${pool}" ]]; then
                            nfmt="%s\n%s\n"
                        fi
                        news=`printf "${nfmt}" "${pool}" "${news}" | sort | uniq | tee ${newsfile} | comm -23 - ${oldsfile}`
                        mv ${oldsfile} ${tempfile} && mv ${newsfile} ${oldsfile} && mv ${tempfile} ${newsfile}

                        lines=`echo -n "${news}" | grep -c '^'`

                        if [ "$lines" -ge "1" ]; then
                            if [ "$lines" -gt "1" ]; then
                                log "Decoding ${lines} TXs."
                            else
                                txhash=`printf "%s" "${news}" | tr -d '\n'`
                                log "Decoding TX ${txhash}."
                            fi

                            decoding_start=$SECONDS

                            graffiti=`echo "${news}" | parallel -P ${WORKERS} "${CLIF} ${DDIR} getrawtransaction {} 1 | ${CGDF}"`
                            state=$?

                            if [ "$state" -ge "1" ]; then
                                if [ "$state" -eq "101" ]; then
                                    log "More than 100 jobs failed."
                                else
                                    if [ "$state" -le "100" ]; then
                                        if [ "$state" -eq "1" ]; then
                                            log "1 job failed."
                                        else
                                            log "${state} jobs failed."
                                        fi
                                    else
                                        log "Other error from parallel."
                                    fi
                                fi
                                ((OTHER_ERRORS++))
                            fi

                            decoding_time=$(( SECONDS - decoding_start ))

                            if [ "$decoding_time" -gt "1" ]; then
                                log "Decodeding took ${decoding_time} seconds."
                            fi

                            msgcount=`echo -n "${graffiti}" | grep -c '^'`

                            if [ "$msgcount" -ge "1" ]; then
                                plural=""
                                if [ "$msgcount" -gt "1" ]; then
                                    plural="s"
                                fi
                                log "Detected graffiti from ${msgcount} TX${plural}."

                                echo "${graffiti}" | parallel --pipe -P ${WORKERS} "jq '.files[]? |= del(.content)'"

                                graffiti_buffer="{"
                                while read -r line; do
                                    txid=`printf "%s" "${line}" | jq -M -r '.txid'`
                                    txsz=`printf "%s" "${line}" | jq -M -r '.size'`
                                    txtm=`printf "%s" "${line}" | jq -M -r '.time'`
                                    files=`printf "%s" "${line}"  | jq -M -r --compact-output '[.files[] | .["type"] = .mimetype | del(.mimetype, .content, .entropy, .unicode)]'`

                                    # We must convert all known integer values
                                    # to strings because Cryptograffiti's API
                                    # notoriously only recognizes string values.
                                    files=`printf "%s" "${files}" | jq -M -r --compact-output '. | map_values( . + {"fsize": .fsize|tostring} )'`
                                    files=`printf "%s" "${files}" | jq -M -r --compact-output '. | map_values( . + {"offset": .offset|tostring} )'`

                                    if [ "${graffiti_buffer}" != "{" ]; then
                                        graffiti_buffer+=","
                                    fi

                                    if [ "${txtm}" == "null" ]; then
                                        graffiti_buffer+="\"${txid}\":{\"txsize\":\"${txsz}\",\"files\":${files}}"
                                    else
                                        graffiti_buffer+="\"${txid}\":{\"txsize\":\"${txsz}\",\"txtime\":\"${txtm}\",\"files\":${files}}"
                                    fi
                                done <<< "${graffiti}"
                                graffiti_buffer+="}"

                                tcount=`printf "%s" "${graffiti_buffer}" | jq length`
                                fcount=`printf "%s" "${graffiti_buffer}" | jq -r -M '.[].files' | jq -r -M -s add | jq length`

                                if [ "$tcount" -eq "1" ]; then
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

                    if [ ! -z "${CACHE}" ] ; then
                        NONC=`printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64`
                        DATA=`printf '{"guid":"%s","nonce":"%s","graffiti":%s}' "${GUID}" "${NONC}" "${CACHE}" | xxd -p | tr -d '\n'`
                        response=`"${CALL}" "${CONF}" "set_graffiti" "${DATA}"`

                        result=`printf "%s" "${response}" | jq -r -M .result`
                        rpm=`printf "%s" "${response}" | jq -r -M .api_usage.rpm`
                        max_rpm=`printf "%s" "${response}" | jq -r -M .api_usage.max_rpm`

                        if [ "${result}" == "SUCCESS" ]; then
                            log "Upload completed successfully (RPM: ${rpm}/${max_rpm})."
                            CACHE=""
                        else
                            printf "%s" "${response}" | jq .error >/dev/stderr
                            error_code=`printf "%s" "${response}" | jq -r -M .error | jq -r -M .code`
                            if [ "${error_code}" == "ERROR_NONCE" ]; then
                                ((NONCE_ERRORS++))
                                break
                            fi
                        fi

                        ((rpm+=10))
                        if [ "$rpm" -ge "$max_rpm" ]; then
                            log "API usage is reaching its hard limit of ${max_rpm} RPM, throttling!"
                            sleep 60
                        fi
                    fi
                else
                    log "Some of the required commands are not available."
                    exit
                fi
            fi

            sleep 5
        done
    else
        printf "%s" "${response}" | jq .error >/dev/stderr
        error_code=`printf "%s" "${response}" | jq -r -M .error | jq -r -M .code`
        if [ "${error_code}" == "ERROR_NONCE" ]; then
            ((NONCE_ERRORS++))
        fi
    fi

    sleep 1

    if [ "$NONCE_ERRORS" -ge "5" ]; then
        log "Too many nonce errors, exiting."
        exit
    else
        log "Trying to synchronize the nonce (${NONCE_ERRORS})."
    fi
done

