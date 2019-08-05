#!/bin/bash

################################################################################
# Example usage: ./slackbot.sh config.json                                     #
################################################################################
CONF="$1"                                                                      #
ADDR=""                                                                        #
CACH=""                                                                        #
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
HR=""
TS=""
LAST_TEXT=""
LAST_HASH=""
CHAN_ID=""

if [ -z "$CONF" ] ; then
    log "Configuration file not provided, exiting."
    exit
fi

if [[ -r ${CONF} ]] ; then
    config=$(<"$CONF")
    NAME=`printf "%s" "${config}" | jq -r -M '.title | select (.!=null)'`
    CALL=`printf "%s" "${config}" | jq -r -M '.["call.sh"] | select (.!=null)'`
    ADDR=`printf "%s" "${config}" | jq -r -M .api`
    CACH=`printf "%s" "${config}" | jq -r -M .cache`
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

if [ -z "$CACH" ] ; then
    log "Cache address not provided, exiting."
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
            rpm=`printf "%s" "${response}" | jq -r -M .api_usage.rpm`
            max_rpm=`printf "%s" "${response}" | jq -r -M .api_usage.max_rpm`

            if [ "${result}" == "SUCCESS" ]; then
                lines=`printf "%s" "${response}" | jq -r -M --compact-output ".rows | .[]"`
                last_nr="${NR}"

                hr=`date +"%H"`

                if [ "${hr}" != "${HR}" ]; then
                    HR="${hr}"
                    TS=""
                fi

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
                        graffiti=`${CLIF} ${DDIR} getrawtransaction ${txid} 1 | ${CGDF} --content --hash "${ghash}"`
                        gfiles=`printf "%s" "${graffiti}" | jq -r -M --compact-output .files[]`

                        log "Extracting TX ${txid}."

                        while read -r gfile; do
                            filehash=`printf "%s" "${gfile}" | jq -r -M .hash`

                            if [ "${ghash}" = "${filehash}" ]; then
                                content=`printf "%s" "${gfile}" | jq -r -M .content`

                                if [ "${content}" = "null" ]; then
                                    log "Graffiti file ${filehash} has no content!"
                                else
                                    filesize=`printf "%s" "${gfile}" | jq -r -M .fsize`
                                    mimetype=`printf "%s" "${gfile}" | jq -r -M .mimetype`
                                    log "TX contains ${filehash} (${mimetype}, ${filesize})."
                                    unicode=`printf "%s" "${gfile}" | jq -r -M .unicode`

                                    if [ "${unicode}" != "null" ]; then
                                        log "Dumping unicode:"
                                        printf "%s\n" "${unicode}"
                                    fi

                                    if [[ ! -z "${AUTH}" ]]; then
                                        log "Uploading ${filesize} bytes."
                                        cache_respone=`printf "%s" "${content}" | xxd -p -r | curl -s -X POST --data-binary @- "${CACH}"`

                                        if [ "${cache_respone}" = "${filehash}" ]; then
                                            log "Successfully uploaded the file to cache."
                                            slack_msg=`printf "TX %s" "<https://bchsvexplorer.com/tx/${txid}|${txid}>"`

                                            if [ -z "${TS}" ] ; then
                                                slack_req=`jq -M -nc --arg str "${slack_msg}" --arg imgurl "${CACH}${filehash}" '{"channel":"cryptograffiti","unfurl_links":true,"unfurl_media":true,"text":$str,"attachments":[{"image_url":$imgurl,"title":"test"}]}'`

                                                slack_resp=`printf "%s" "${slack_req}" | curl -s -H "Authorization: Bearer ${AUTH}" -H "Content-Type: application/json" -X POST --data-binary @- https://slack.com/api/chat.postMessage`
                                                ok=`printf "%s" "${slack_resp}" | jq -M -r '.ok'`

                                                if [ "${ok}" = "true" ]; then
                                                    new_ts=`printf "%s" "${slack_resp}" | jq -M -r '.ts'`

                                                    log "A link to ${filehash} has been posted to Slack as a new thread (${new_ts})."
                                                    TS="${new_ts}"

                                                    LAST_TEXT="${slack_msg}"
                                                    LAST_HASH="${filehash}"
                                                    CHAN_ID=`printf "%s" "${slack_resp}" | jq -M -r '.channel'`

                                                    printf "%s" "${slack_resp}" | jq . >/dev/stderr
                                                else
                                                    log "A link to ${filehash} could not be posted to Slack (1)."
                                                    printf "%s" "${slack_resp}" | jq . >/dev/stderr
                                                fi
                                            else
                                                slack_req=`jq -M -nc --arg str "${slack_msg}" --arg ts "${TS}" --arg chid "${CHAN_ID}" --arg imgurl "${CACH}${filehash}" '{"unfurl_links":true,"unfurl_media":true,"channel":$chid,"ts":$ts,"text":$str,"attachments":[{"image_url":$imgurl,"title":"test"}]}'`

                                                slack_resp=`printf "%s" "${slack_req}" | curl -s -H "Authorization: Bearer ${AUTH}" -H "Content-Type: application/json" -X POST --data-binary @- https://slack.com/api/chat.update`
                                                ok=`printf "%s" "${slack_resp}" | jq -M -r '.ok'`

                                                if [ "${ok}" = "true" ]; then
                                                    new_ts=`printf "%s" "${slack_resp}" | jq -M -r '.ts'`

                                                    log "A link to ${filehash} has been posted to Slack as a thread replacement (${new_ts})."
                                                    TS="${new_ts}"

                                                    if [[ ! -z "${LAST_TEXT}" ]] && [[ ! -z "${LAST_HASH}" ]]; then
                                                        slack_req=`jq -M -nc --arg str "${LAST_TEXT}" --arg ts "${TS}" --arg imgurl "${CACH}${LAST_HASH}" '{"channel":"cryptograffiti","unfurl_links":true,"unfurl_media":true,"thread_ts":$ts,"text":$str,"attachments":[{"image_url":$imgurl,"title":"test"}]}'`
                                                        head1="Authorization: Bearer ${AUTH}"
                                                        head2="Content-Type: application/json"

                                                        slack_resp=`printf "%s" "${slack_req}" | curl -s -H "${head1}" -H "${head2}" -X POST --data-binary @- https://slack.com/api/chat.postMessage`
                                                        ok=`printf "%s" "${slack_resp}" | jq -M -r '.ok'`

                                                        if [ "${ok}" = "true" ]; then
                                                            log "A link to ${LAST_HASH} has been posted to the end of thread ${TS} in Slack."
                                                        else
                                                            log "A link to ${LAST_HASH} could not be posted to the end of thread ${TS} in Slack."
                                                            printf "%s" "${slack_resp}" | jq . >/dev/stderr
                                                        fi
                                                    else
                                                        log "Error. Unexpected program flow."
                                                    fi

                                                    LAST_TEXT="${slack_msg}"
                                                    LAST_HASH="${filehash}"
                                                else
                                                    log "A link to ${filehash} could not be posted to Slack (2)."
                                                    printf "%s" "${slack_resp}" | jq . >/dev/stderr
                                                fi
                                            fi
                                        else
                                            log "Failed to upload the file (${cache_response})."
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
                log "Failed to get graffiti: ${error_code}  (RPM: ${rpm}/${max_rpm})"
                printf "%s" "${response}" | jq .error >/dev/stderr
                sleep 10
            fi

            ((rpm+=10))
            if [ "$rpm" -ge "$max_rpm" ]; then
                log "API usage is reaching its hard limit of ${max_rpm} RPM, throttling!"
                sleep 60
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

