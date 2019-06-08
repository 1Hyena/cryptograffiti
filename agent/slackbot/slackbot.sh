#!/bin/bash

################################################################################
# Example usage: ./slackbot.sh config.json                                     #
################################################################################
CONF="$1"                                                                      #
ADDR=""                                                                        #
NAME=""                                                                        #
AUTH=""                                                                        #
CLIF=""                                                                        #
CGDF=""                                                                        #
DDIR=""                                                                        #
################################################################################
DATE_FORMAT="%Y-%m-%d %H:%M:%S"
ROWS_PER_QUERY=0

log() {
    now=`date +"${DATE_FORMAT}"`
    printf "\033[1;35m%s\033[0m :: %s\n" "$now" "$1" >/dev/stderr
}

NR=""

if [ -z "$CONF" ] ; then
    log "Configuration file not provided, exiting."
    exit
fi

if [[ -r ${CONF} ]] ; then
    config=$(<"$CONF")
    NAME=`printf "%s" "${config}" | jq -r -M '.title | select (.!=null)'`
    CALL=`printf "%s" "${config}" | jq -r -M '.["call.sh"] | select (.!=null)'`
    ADDR=`printf "%s" "${config}" | jq -r -M .api`
    AUTH=`printf "%s" "${config}" | jq -r -M .oauth`
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

    DATA=`printf '{}' | xxd -p | tr -d '\n'`
    response=`"${CALL}" "${CONF}" "get_constants" "${DATA}"`

    result=`printf "%s" "${response}" | jq -r -M .result`
    if [ "${result}" == "SUCCESS" ]; then
        ROWS_PER_QUERY=`printf "%s" "${response}" | jq -r -M .constants | jq -r -M .ROWS_PER_QUERY`
        log "ROWS_PER_QUERY: ${ROWS_PER_QUERY}"

        while :
        do
            if [ -z "$NR" ] ; then
                DATA=`printf '{"count":"%s","mimetype":"image"}' "1" | xxd -p | tr -d '\n'`
            else
                DATA=`printf '{"nr":"%s","count":"%s","mimetype":"image"}' "${NR}" "${ROWS_PER_QUERY}" | xxd -p | tr -d '\n'`
            fi
            response=`"${CALL}" "${CONF}" "get_graffiti" "${DATA}"`

            result=`printf "%s" "${response}" | jq -r -M .result`

            if [ "${result}" == "SUCCESS" ]; then
                lines=`printf "%s" "${response}" | jq -r -M --compact-output ".rows | .[]"`
                last_nr="${NR}"

                while read -r line; do
                    nr=`printf "%s" "${line}" | jq -r -M .nr`

                    if [ -z "${NR}" ] ; then
                        NR="${nr}"
                        last_nr="${nr}" # Let's not upload the first we get.
                        # This way we are not spamming the Slack with duplicate
                        # posts in case the SlackBot restarts.
                    else
                        if [ "${nr}" -gt "${NR}" ]; then
                            NR="${nr}"
                        fi
                    fi

                    if [ "${nr}" -gt "${last_nr}" ]; then
                        log "${line}"

                        txid=`printf "%s" "${line}" | jq -r -M .txid`
                        ghash=`printf "%s" "${line}" | jq -r -M .hash`
                        graffiti=`${CLIF} ${DDIR} getrawtransaction ${txid} 1 | ${CGDF}`
                        gfiles=`printf "%s" "${graffiti}" | jq -r -M --compact-output .files[]`

                        log "Extracting TX ${txid}."

                        while read -r gfile; do
                            mimetype=`printf "%s" "${gfile}" | jq -r -M .mimetype`
                            filehash=`printf "%s" "${gfile}" | jq -r -M .hash`
                            filesize=`printf "%s" "${gfile}" | jq -r -M .fsize`
                            content=`printf "%s" "${gfile}" | jq -r -M .content`

                            if [ "${ghash}" = "${filehash}" ]; then

                                if [ "${content}" = "null" ]; then
                                    log "Graffiti file ${filehash} has no content!"
                                else
                                    log "TX contains ${filehash} (${mimetype}, ${filesize})."
                                    unicode=`printf "%s" "${gfile}" | jq -r -M .unicode`

                                    if [ "${unicode}" != "null" ]; then
                                        log "Dumping unicode:"
                                        printf "%s\n" "${unicode}"
                                    fi

                                    if [[ ! -z "${AUTH}" ]]; then
                                        log "Uploading ${filesize} bytes."
                                        ok=`printf "%s" "${content}" | xxd -p -r | curl -s -F file=@- -F "initial_comment=https://bchsvexplorer.com/tx/${txid}" -F "mimetype=${mimetype}" -F "filename=${filehash}" -F channels=cryptograffiti -H "Authorization: Bearer ${AUTH}" https://slack.com/api/files.upload | jq -M -r '.ok'`

                                        if [ "${ok}" = "true" ]; then
                                            log "Successfully uploaded the file (${filehash})."
                                        else
                                            log "Failed to upload the file (${filehash})."
                                        fi
                                    fi
                                fi
                            else
                                log "SKIPPING ${filehash} != ${ghash}"
                            fi
                        done <<< "${gfiles}"
                    fi
                done <<< "${lines}"
            else
                error_code=`printf "%s" "${response}" | jq -r -M .error | jq -r -M .code`
                log "Failed to get graffiti: ${error_code}"
                printf "%s" "${response}" | jq .error >/dev/stderr
                sleep 10
            fi

            sleep 5
        done
    else
        error_code=`printf "%s" "${response}" | jq -r -M .error | jq -r -M .code`
        log "Failed to get constants: ${error_code}"
        printf "%s" "${response}" | jq .error >/dev/stderr
        sleep 10
    fi

    sleep 5
done

