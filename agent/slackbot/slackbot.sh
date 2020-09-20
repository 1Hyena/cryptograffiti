#!/bin/bash

################################################################################
# Example usage: ./slackbot.sh config.json                                     #
################################################################################
CONF="$1"                                                                      #
ADDR=""                                                                        #
CACH=""                                                                        #
NAME=""                                                                        #
AUTH=""                                                                        #
################################################################################
DATE_FORMAT="%Y-%m-%d %H:%M:%S"
ROWS_PER_QUERY=0

log() {
    now=$(date +"${DATE_FORMAT}")
    printf "\033[1;35m%s\033[0m :: %s\n" "$now" "$1" >/dev/stderr
}

alert() {
    now=$(date +"${DATE_FORMAT}")
    printf \
        "\033[1;35m%s\033[0m :: \033[1;33m%s\033[0m\n" "$now" "$1" >/dev/stderr
}

NR="${2}"
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
    NAME=$(printf "%s" "${config}" | jq -r -M '.title | select (.!=null)')
    CALL=$(printf "%s" "${config}" | jq -r -M '.["call.sh"] | select (.!=null)')
    ADDR=$(printf "%s" "${config}" | jq -r -M '.api | select (.!=null)')
    CACH=$(printf "%s" "${config}" | jq -r -M '.cache | select (.!=null)')
    AUTH=$(printf "%s" "${config}" | jq -r -M '.oauth | select (.!=null)')

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

step() {
    local data

    if [ -z "$NR" ] ; then
        data=$(
            printf '{"count":"%s","mimetype":"image"}' "1" |
            xxd -p                                         |
            tr -d '\n'
        )
    else
        local dfmt='{"nr":"%s","count":"%s","mimetype":"image"}'
        data=$(
            printf "${dfmt}" "${NR}" "${ROWS_PER_QUERY}" |
            xxd -p                                       |
            tr -d '\n'
        )
    fi

    local response
    response=$("${CALL}" "${CONF}" "get_graffiti" "${data}")

    local result=$(printf "%s" "${response}" | jq -r -M .result)
    local rpm=$(printf "%s" "${response}" | jq -r -M .api_usage.rpm)
    local max_rpm=$(printf "%s" "${response}" | jq -r -M .api_usage.max_rpm)

    if [ "${result}" == "SUCCESS" ]; then
        local lines
        lines=$(
            printf "%s" "${response}" |
            jq -r -M --compact-output ".rows | .[]"
        )

        local last_nr="${NR}"
        local hr=$(date +"%H")

        if [ "${hr}" != "${HR}" ]; then
            # This is needed so that we would create a new topic on
            # Slack every time the hour of the day changes.
            HR="${hr}"
            TS=""
        fi

        while read -r line; do
            local nr
            nr=$(printf "%s" "${line}" | jq -r -M .nr)

            if [ -z "${NR}" ] ; then
                NR="${nr}"
                last_nr="${nr}" # Let's not upload the first we get.
                # This way we are not spamming the Slack with duplicate
                # posts in case the SlackBot restarts.
            else
                if [ "${nr}" -ge "${NR}" ]; then
                    NR="${nr}"
                else
                    # This indicates that we have not received the lines in a
                    # proper order. They should be ordered ascendingly by `nr`.
                    alert "Graffiti were not properly ordered by the server."
                fi
            fi

            if [ "${nr}" -gt "${last_nr}" ]; then
                log "${line}"

                local ghash
                local filesize
                local mimetype
                local txid
                txid=$(printf "%s" "${line}" | jq -r -M .txid)
                ghash=$(printf "%s" "${line}" | jq -r -M .hash)
                filesize=$(printf "%s" "${line}" | jq -r -M .fsize)
                mimetype=$(printf "%s" "${line}" | jq -r -M .mimetype)

                log "Downloading ${mimetype} of size ${filesize} (${ghash})."

                local curl_response
                local curl_exit_code
                curl_response=$(
                    curl -f -s -X GET "${CACH}?hash=${ghash}" |
                    xxd -p |
                    tr -d '\n'
                )
                curl_exit_code="$?"

                if [ "0" != "${curl_exit_code}" ]; then
                    alert "Curl exits with code ${curl_exit_code}."
                elif [[ -z "${curl_response}" ]]; then
                    alert "Received an empty response."
                elif [[ ! -z "${AUTH}" ]]; then
                    log "Uploading ${filesize} bytes to Slack."

                    local slack_msg=$(
                        printf      \
                            "TX %s" \
                            "<https://bchsvexplorer.com/tx/${txid}|${txid}>"
                    )

                    if [ -z "${TS}" ] ; then
                        local slack_req_json=""
                        slack_req_json+='{"channel":"cryptograffiti",'
                        slack_req_json+='"unfurl_links":true,'
                        slack_req_json+='"unfurl_media":true,"text":$str,'
                        slack_req_json+='"attachments":[{"image_url":$imgurl,'
                        slack_req_json+='"title":$fhash}]}'

                        local slack_req=$(
                            jq -M -nc --arg str "${slack_msg}" --arg imgurl \
                            "${CACH}?hash=${ghash}"                      \
                            --arg fhash "${ghash}" "${slack_req_json}"
                        )

                        local slack_resp=$(
                            printf "%s" "${slack_req}" |
                            curl -s -H "Authorization: Bearer ${AUTH}" -H \
                                "Content-Type: application/json" -X POST  \
                                --data-binary @-                          \
                                "https://slack.com/api/chat.postMessage"
                        )
                        local ok=$(printf "%s" "${slack_resp}" | jq -M -r '.ok')

                        if [ "${ok}" = "true" ]; then
                            local new_ts=$(
                                printf "%s" "${slack_resp}" | jq -M -r '.ts'
                            )

                            log "A link to ${ghash} has been posted to Slack as a new thread (${new_ts})."
                            TS="${new_ts}"

                            LAST_TEXT="${slack_msg}"
                            LAST_HASH="${ghash}"
                            CHAN_ID=`printf "%s" "${slack_resp}" | jq -M -r '.channel'`

                            printf "%s" "${slack_resp}" | jq . >/dev/stderr
                        else
                            log "A link to ${ghash} could not be posted to Slack (1)."
                            printf "%s" "${slack_resp}" | jq . >/dev/stderr
                        fi
                    else
                        local slack_req_json=""
                        slack_req_json+='{"unfurl_links":true,"unfurl_media":true,"channel":$chid,"ts":$ts,"text":$str,"attachments":[{"image_url":$imgurl,"title":$fhash}]}'
                        local slack_req=$(
                            jq -M -nc --arg str "${slack_msg}"       \
                            --arg ts "${TS}" --arg chid "${CHAN_ID}" \
                            --arg imgurl "${CACH}?hash=${ghash}"        \
                            --arg fhash "${ghash}" "${slack_req_json}"
                        )

                        local slack_resp=$(
                            printf "%s" "${slack_req}" |
                            curl -s -H "Authorization: Bearer ${AUTH}"      \
                                -H "Content-Type: application/json" -X POST \
                                --data-binary @- https://slack.com/api/chat.update
                        )

                        local ok=$(printf "%s" "${slack_resp}" | jq -M -r '.ok')

                        if [ "${ok}" = "true" ]; then
                            local new_ts=$(
                                printf "%s" "${slack_resp}" | jq -M -r '.ts'
                            )

                            log "A link to ${ghash} has been posted to Slack as a thread replacement (${new_ts})."
                            TS="${new_ts}"

                            if [[ ! -z "${LAST_TEXT}" ]] && [[ ! -z "${LAST_HASH}" ]]; then
                                slack_req=`jq -M -nc --arg str "${LAST_TEXT}" --arg ts "${TS}" --arg imgurl "${CACH}?hash=${LAST_HASH}" --arg fhash "${LAST_HASH}" '{"channel":"cryptograffiti","unfurl_links":true,"unfurl_media":true,"thread_ts":$ts,"text":$str,"attachments":[{"image_url":$imgurl,"title":$fhash}]}'`
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
                            LAST_HASH="${ghash}"
                        else
                            log "A link to ${ghash} could not be posted to Slack (2)."
                            printf "%s" "${slack_resp}" | jq . >/dev/stderr
                        fi
                    fi

                fi
            fi
        done <<< "${lines}"
    else
        local ecode
        ecode=$(
            printf "%s" "${response}" | jq -r -M .error | jq -r -M .code
        )
        log "Failed to get graffiti: ${ecode}  (RPM: ${rpm}/${max_rpm})"
        printf "%s" "${response}" | jq .error >/dev/stderr
        sleep 10
    fi

    ((rpm+=10))

    if [ "$rpm" -ge "$max_rpm" ]; then
        local logline=""
        logline+="API usage is reaching its hard limit of ${max_rpm} "
        logline+="RPM, throttling!"
        log "${logline}"
        sleep 60
    fi
}

loop() {
    local wdir=$(pwd)
    log "${wdir}"

    while :
    do
        local response
        local result
        local data

        data=$(printf '{}' | xxd -p | tr -d '\n')
        response=$("${CALL}" "${CONF}" "get_constants" "${data}")
        result=$(printf "%s" "${response}" | jq -r -M .result)

        if [ "${result}" == "SUCCESS" ]; then
            ROWS_PER_QUERY=$(
                printf "%s" "${response}" |
                jq -r -M .constants       |
                jq -r -M .ROWS_PER_QUERY
            )
            log "ROWS_PER_QUERY: ${ROWS_PER_QUERY}"

            while :
            do
                step # Subshell must be avoided here.
                sleep 5
            done
        else
            local ecode
            ecode=$(printf "%s" "${response}" | jq -r -M .error | jq -r -M .code)
            log "Failed to get constants: ${ecode}"
            printf "%s" "${response}" | jq .error >/dev/stderr
            sleep 10
        fi

        sleep 5
    done
}

################################################################################
loop # Subshell must be avoided here.
################################################################################
