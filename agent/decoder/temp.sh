#!/bin/bash

################################################################################
# Example usage: ./loop.sh ../init.sh ../call.sh config.json                   #
################################################################################
INIT="$1"                                                                      #
CALL="$2"                                                                      #
CONF="$3"                                                                      #
SKEY=""                                                                        #
SEED=""                                                                        #
GUID=""                                                                        #
TOKN=""                                                                        #
NONC=""                                                                        #
ADDR=""                                                                        #
NAME=""                                                                        #
################################################################################
DATE_FORMAT="%Y-%m-%d %H:%M:%S"
LOGS_PER_QUERY=0
NONCE_ERRORS=0

canary="::"

log() {
    now=`date +"${DATE_FORMAT}"`
    printf "\033[1;36m%s\033[0m ${canary} %s\n" "$now" "$1" >/dev/stderr
}

################################################################################
clifile="/home/hyena/Desktop/system/bitcoin-cli"
oauth=""
cgdfile=""
datadir=""
workers="16"

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

if [ -z "$datadir" ] ; then
    datadir=""
else
    datadir="-datadir=${datadir}"
fi

if [ -z "$clifile" ] ; then
    clifile="bitcoin-cli"
fi

if [ -z "$oauth" ] ; then
    oauth=""
fi

if [ -z "$cgdfile" ] ; then
    cgdfile="./cgd"
fi

errors=0
tick=8
################################################################################

if [ -z "$INIT" ] ; then
    log "Init script not provided, exiting."
    exit
fi

if [ -z "$CALL" ] ; then
    log "Call script not provided, exiting."
    exit
fi

NR=""

if [ -z "$CONF" ] ; then
    log "Configuration file not provided, exiting."
    exit
fi

if [[ -r ${CONF} ]] ; then
    config=$(<"$CONF")
    NAME=`printf "%s" "${config}" | jq -r -M '.title | select (.!=null)'`

    if [ ! -z "${NAME}" ] ; then
        printf "\033]0;%s\007" "${NAME}"
    fi
else
    log "Failed to read the configuration file."
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
            deadcanary="\033[0;31m::\033[0m"
            if [ "$errors" -ge "1" ]; then
                canary="${deadcanary}"
            fi

            ((tick++))
            if [ "$tick" -ge "10" ]; then
                tick=0

                if [ $(which "${clifile}" 2>/dev/null ) ] \
                && [ $(which "${cgdfile}" 2>/dev/null ) ] \
                && [ $(which sort)                      ] \
                && [ $(which uniq)                      ] \
                && [ $(which echo)                      ] \
                && [ $(which grep)                      ] \
                && [ $(which comm)                      ] \
                && [ $(which curl)                      ] \
                && [ $(which tr)                        ] \
                && [ $(which tee)                       ] \
                && [ $(which parallel)                  ] \
                && [ $(which jq)                        ] ; then
                    bestblock=`${clifile} ${datadir} getbestblockhash`
                    pool=`${clifile} ${datadir} getrawmempool | jq -M -r .[]`
                    news=`${clifile} ${datadir} getblock ${bestblock} | jq -M -r '.tx | .[]'`
                    nfmt="%s%s\n"
                    if [[ ! -z "${pool}" ]]; then
                        nfmt="%s\n%s\n"
                    fi
                    news=`printf "${nfmt}" "${pool}" "${news}" | sort | uniq | tee ${newsfile} | comm -23 - ${oldsfile}`
                    mv ${oldsfile} ${tempfile} && mv ${newsfile} ${oldsfile} && mv ${tempfile} ${newsfile}

                    lines=`echo -n "${news}" | grep -c '^'`

                    if [ "$lines" -ge "1" ]; then
                        echo "${news}" # this line is just for debugging, can be removed

                        if [ "$lines" -gt "1" ]; then
                            log "Decoding ${lines} TXs."
                        else
                            txhash=`printf "%s" "${news}" | tr -d '\n'`
                            log "Decoding TX ${txhash}."
                        fi

                        graffiti=`echo "${news}" | parallel -P ${workers} "${clifile} ${datadir} getrawtransaction {} 1 | ${cgdfile}"`
                        state=$?
                        msgcount=`echo -n "${graffiti}" | grep -c '^'`

                        if [ "$msgcount" -ge "1" ]; then
                            plural=""
                            if [ "$msgcount" -gt "1" ]; then
                                plural="s"
                            fi
                            log "Detected graffiti from ${msgcount} TX${plural}."

                            echo "${graffiti}" | parallel --pipe -P ${workers} "jq '.files[]? |= del(.content)'"

                            graffiti_buffer="{"
                            while read -r line; do
                                txid=`printf "%s" "${line}" | jq -M -r '.txid'`
                                txsz=`printf "%s" "${line}" | jq -M -r '.size'`
                                files=`printf "%s" "${line}" | jq -M -r --compact-output '[.files[] | .["type"] = .mimetype | del(.mimetype, .content, .entropy, .unicode)] | walk(if type == "number" then tostring else . end)'`

                                if [ "${graffiti_buffer}" != "{" ]; then
                                    graffiti_buffer+=","
                                fi

                                graffiti_buffer+="\"${txid}\":{\"txsize\":\"${txsz}\",\"files\":${files}}"
                            done <<< "${graffiti}"
                            graffiti_buffer+="}"

                            log "Uploading new graffiti."
                            #printf "%s\n" "${graffiti_buffer}"
                            #printf "%s" "${graffiti_buffer}" | jq .

################################################################################
                            NONC=`printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64`
                            DATA=`printf '{"guid":"%s","nonce":"%s","graffiti":%s}' "${GUID}" "${NONC}" "${graffiti_buffer}" | xxd -p | tr -d '\n'`
                            response=`"${CALL}" "${CONF}" "set_graffiti" "${DATA}"`

                            result=`printf "%s" "${response}" | jq -r -M .result`

                            if [ "${result}" == "SUCCESS" ]; then
                                printf "%s" "${response}" | jq .
                            else
                                printf "%s" "${response}" | jq .error >/dev/stderr
                                error_code=`printf "%s" "${response}" | jq -r -M .error | jq -r -M .code`
                                if [ "${error_code}" == "ERROR_NONCE" ]; then
                                    ((NONCE_ERRORS++))
                                    break
                                fi
                            fi
################################################################################

                            if [[ ! -z "${oauth}" ]]; then
                                while read -r line; do
                                    json=`printf "%s" "${line}" | jq -M -r '[.files | .[]? | select(.content != null) | [.]][0] | select (.!=null) | .[]'`

                                    if [[ ! -z "${json}" ]]; then
                                        txid=`printf "%s" "${line}" | jq -M -r '.txid'`
                                        size=`printf "%s" "${json}" | jq -M -r '.fsize'`
                                        type=`printf "%s" "${json}" | jq -M -r '.mimetype'`
                                        body=`printf "%s" "${json}" | jq -M -r '.content'`

                                        log "Uploading file from TX ${txid} (${type}, ${size})."
                                        ok=`printf "%s" "${body}" | xxd -p -r | curl -s -F file=@- -F "initial_comment=https://bchsvexplorer.com/tx/${txid}" -F channels=cryptograffiti -H "Authorization: Bearer ${oauth}" https://slack.com/api/files.upload | jq -M -r '.ok'`

                                        if [ "${ok}" = "true" ]; then
                                            log "Successfully uploaded a file from TX ${txid}."
                                        else
                                            log "Failed to upload file."
                                        fi
                                    fi
                                done <<< "${graffiti}"
                            fi
                        fi

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
                            ((errors++))
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

