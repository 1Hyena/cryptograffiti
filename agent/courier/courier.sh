#!/bin/bash

################################################################################
# Example usage: ./courier.sh config.json (TX hash)                            #
################################################################################
CONF="$1"                                                                      #
TXID="$2"                                                                      #
SKEY=""                                                                        #
SEED=""                                                                        #
GUID=""                                                                        #
TOKN=""                                                                        #
NONC=""                                                                        #
ADDR=""                                                                        #
RWTX=""                                                                        #
NAME=""                                                                        #
CLIF=""                                                                        #
DDIR=""                                                                        #
CFGF=""                                                                        #
################################################################################
DATE_FORMAT="%Y-%m-%d %H:%M:%S"
CANARY="::"
WORKERS="16"
BLOCKSZ="16M"
TXS_PER_QUERY=0
NONCE_ERRORS=0
OTHER_ERRORS=0
CHEAP_ERRORS=0
PULSE_PERIOD=5
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

LOCKFILE=/tmp/GIGWiaTQ1psAeeI5
NEWSFILE=/tmp/A5vP9NQz4nxf187o
OLDSFILE=/tmp/PxmriBfE7uuA6jbN
TEMPFILE=/tmp/IG4qo2b3L0wUSWw6
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
        RWTX=$(printf "%s" "${cfg}" | jq -r -M .rawtx)
        CLIF=$(
            printf "%s" "${cfg}" |
            jq -r -M '.["bitcoin-cli"] | select (.!=null)'
        )
        DDIR=$(
            printf "%s" "${cfg}" |
            jq -r -M '.["bitcoin-dat"] | select (.!=null)'
        )
        CFGF=$(
            printf "%s" "${cfg}" |
            jq -r -M '.["bitcoin-cfg"] | select (.!=null)'
        )


        if [ ! -z "${DDIR}" ] ; then
            DDIR="-datadir=${DDIR}"
        fi

        if [ ! -z "${CFGF}" ] ; then
            CFGF="-conf=${CFGF}"
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

    if [ -z "$RWTX" ] ; then
        log "Raw TX address not provided, exiting."
        exit
    fi

    if [ ! $(which "${CLIF}" 2>/dev/null ) ] ; then
        log "Program not found: ${CLIF}"
        exit
    fi

    return 0
}
################################################################################
config
################################################################################

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
    # Do not try to read custom configuration variables from here.
    # The init script only forwards a specific set of configuration parameters.

    if [ ! -z "${SKEY}" ] \
    && [ ! -z "${SEED}" ] \
    && [ ! -z "${TOKN}" ] \
    && [ ! -z "${ADDR}" ] \
    && [ ! -z "${RWTX}" ] \
    && [ ! -z "${NONC}" ] \
    && [ ! -z "${GUID}" ] ; then
        log "Session has been initialized successfully."
        log "API URL: ${ADDR}"
        log "Raw TX URL: ${RWTX}"
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

        local txs_per_query=32

        txs_per_query=$((
            TXS_PER_QUERY < txs_per_query ? TXS_PER_QUERY : txs_per_query
        ))

        log "TXS_PER_QUERY: ${TXS_PER_QUERY} (using ${txs_per_query})"
        TXS_PER_QUERY=${txs_per_query}

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
    local tick_start=$(date +%s)

    while :
    do
        local tick_end=$(date +%s)

        if [ "${tick_end}" -ge "${tick_start}" ]; then
            local delta_time=$((tick_end-tick_start))

            if [ "${delta_time}" -ge "60" ]; then
                tick_start=$(date +%s)
                # log "Tick!"

                # Periodically truncating these files allows missing TXs to
                # be tried again in case they might have arrived to our node
                # within the last tick.
                truncate -s 0 $NEWSFILE
                truncate -s 0 $OLDSFILE
                truncate -s 0 $TEMPFILE
            fi
        fi

        local pulse_start=$(date +%s)

        if [ $(which "${CLIF}" 2>/dev/null ) ] \
        && [ $(which sort)                   ] \
        && [ $(which shuf)                   ] \
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
                TXBUF=""
                break
            fi
        else
            log "Some of the required commands are not available."
            exit
        fi

        if [ ! -z "${TXBUF}" ] ; then
            # We clear the TXBUF because some of it may already have
            # been resolved by another Courier instance. Emptying
            # TXBUF here will allow us to get the most up to date
            # list of TXs later on.
            TXBUF=""
        fi

        local pulse_end=$(date +%s)

        if [ "${pulse_end}" -ge "${pulse_start}" ]; then
            local delta_time=$((pulse_end-pulse_start))
            if [ "${delta_time}" -lt "${PULSE_PERIOD}" ]; then
                local stime=$((PULSE_PERIOD-delta_time))

                if [ ! -z "${TXBUF}" ] || [ ! -z "${CACHE}" ] ; then
                    log "Too much work in queue, skipping the nap of ${stime}s."
                else
                    # log "Sleeping for ${stime}s."
                    sleep "${stime}"
                fi
            elif [ "${delta_time}" -gt "${PULSE_PERIOD}" ]; then
                local lost_time=$((delta_time-PULSE_PERIOD))
                alert "Courier falls behind schedule by ${lost_time}s."
            fi
        else
            ((OTHER_ERRORS++))
            alert "Error, ${pulse_end} < ${pulse_start}!"
            sleep "${PULSE_PERIOD}"
        fi
    done

    return 0
}

handle_parallel_state() {
    # Since this function could modify the CHEAP_ERRORS global variable we must
    # not call this function from a subshell.
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

get_rawtxs() {
    # Since this function could modify the CHEAP_ERRORS global variable via the
    # handle_parallel_state function, we must not call this function from a
    # subshell. For that reason, we use the RAWTXS global variable where
    # we store the result of this function.
    RAWTXS=""

    local buf="${1}"
    local prevbuf=""

    if [ -z "${buf}" ] ; then
        return 0
    fi

    local cli_cmd="${CLIF} ${DDIR} ${CFGF} getrawtransaction {} "
    local cli_state
    prevbuf="${buf}"
    buf=$(
        parallel           \
        --block ${BLOCKSZ} \
        --halt now,fail=1  \
        --timeout 30       \
        -P ${WORKERS}      \
        "${cli_cmd}" <<< "${buf}"
    )
    cli_state=$?

    if [ "${cli_state}" -ge "1" ]; then
        buf="${prevbuf}"
        buf=$(
            parallel           \
            --block ${BLOCKSZ} \
            --timeout 30       \
            -P ${WORKERS}      \
            "${cli_cmd}" <<< "${buf}" 2>/dev/null
        )
        cli_state=$?
    fi

    handle_parallel_state "${cli_state}" "${cli_cmd}"

    if [ -z "${buf}" ] ; then
        return 0
    fi

    RAWTXS="${buf}"
    return 0
}

step() {
    local txs_per_query="${1}"
    local rawtx_count="0"
    local max_rawtx_count="3"

    if [ -z "${CACHE}" ] ; then
        local newscount="0"
        local news=""

        if [ -z "${TXBUF}" ] ; then
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
            datafmt+="\"cache\":\"0\"}"
            local data=$(
                printf "${datafmt}" "${GUID}" "${NONC}" "${txs_per_query}" |
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
                # The API call did not fail on the network level, now it is safe
                # to actually update the nonce.
                NONC="${new_nonce}"

                local result=$(printf "%s" "${response}" | jq -r -M .result)
                local rpm=$(printf "%s" "${response}" | jq -r -M .api_usage.rpm)
                local max_rpm=$(
                    printf "%s" "${response}" | jq -r -M .api_usage.max_rpm
                )

                if [ "${result}" == "SUCCESS" ]; then
                    news=$(
                        printf "%s" "${response}" | jq -r -M '.txs[] | .txid'
                    )

                    local news_count=$(echo -n "${news}" | grep -c '^')

                    if [ "${news_count}" -ge "1" ] ; then
                        local plural=" is"
                        if [ "${news_count}" -gt "1" ]; then
                            plural="s are"
                        fi

                        local logmsg=""
                        logmsg+="At least ${news_count} more TX${plural} "
                        logmsg+="queued for caching (RPM: ${rpm}/${max_rpm})."

                        log "${logmsg}"

                        if [ "${news_count}" -gt "${max_rawtx_count}" ] ; then
                            local skip=$((news_count-max_rawtx_count))
                            news=$(printf "%s" "${news}" | shuf)
                            TXBUF=$(printf "%s" "${news}" | tail "-${skip}")
                            news=$(
                                printf "%s" "${news}" |
                                head "-${max_rawtx_count}"
                            )
                        fi
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
                        alert "Failed to download TXs: ${error_message}"
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

            news=$(
                printf "%s\n" "${news}" |
                sort                                 |
                uniq                                 |
                tee ${NEWSFILE}                      |
                comm -23 - ${OLDSFILE}
            )

            mv ${OLDSFILE} ${TEMPFILE} && \
            mv ${NEWSFILE} ${OLDSFILE} && \
            mv ${TEMPFILE} ${NEWSFILE}
        else
            news="${TXBUF}"
            TXBUF=""
        fi

        newscount=$(echo -n "${news}" | grep -c '^')

        if [ "$newscount" -ge "1" ]; then
            if [ "$newscount" -gt "1" ]; then
                local line_queue=$(echo -n "${TXBUF}" | grep -c '^')
                if [ "${line_queue}" -ge "1" ]; then
                    log "Getting ${newscount} raw TXs (${line_queue} in queue)."
                else
                    log "Getting ${newscount} raw TXs."
                fi
            else
                local txhash=$(printf "%s" "${news}" | tr -d '\n')
                log "Getting the raw content of TX ${txhash}."
            fi

            local resolving_start=$SECONDS

            get_rawtxs "${news}" # Subshell must be avoided here.
            local rawtxs="${RAWTXS}"

            local resolving_time=$(( SECONDS - resolving_start ))

            rawtx_count=$(echo -n "${rawtxs}" | grep -c '^')
            local rawtx_count_plural=""
            if [ "${rawtx_count}" -gt "1" ]; then
                rawtx_count_plural="s"
            fi

            if [ "${resolving_time}" -gt "1" ]; then
                local logstr=""
                logstr+="Got ${rawtx_count} raw TX${rawtx_count_plural} in "
                logstr+="${resolving_time} seconds."
                log "${logstr}"
            fi

            if [ "${rawtx_count}" -ge "1" ]; then
                log "Uploading ${rawtx_count} TX${rawtx_count_plural}."

                CACHE="${rawtxs}"
            fi
        fi
    else
        log "Trying to upload from cache."
    fi

    if [ -z "${CACHE}" ] ; then
        return 0
    fi

    local curl_cmd=""
    curl_cmd+="xxd -r -p | "
    curl_cmd+="curl -s --show-error -f -X POST --data-binary @- ${RWTX}"

    local curl_state
    local curl_out

    curl_out=$(
        parallel           \
        --block ${BLOCKSZ} \
        --halt now,fail=1  \
        --timeout 60       \
        --pipe             \
        -N 1               \
        -P ${WORKERS}      \
        "${curl_cmd}" <<< "${CACHE}"
    )
    curl_state=$?

    if [ "${curl_state}" -ge "1" ]; then
        curl_out=$(
            parallel           \
            --block ${BLOCKSZ} \
            --timeout 60       \
            --pipe             \
            -N 1               \
            -P ${WORKERS}      \
            "${curl_cmd}" <<< "${CACHE}" 2>/dev/null
        )
        curl_state=$?
    fi

    handle_parallel_state "${curl_state}" "${curl_cmd}"

    local upload_count=$(echo -n "${curl_out}" | grep -c '^')
    local plural=""

    if [ "${rawtx_count}" -gt "1" ]; then
        plural="s"
    fi

    if [ "${upload_count}" == "${rawtx_count}" ]; then
        log "Uploaded ${upload_count} of ${rawtx_count} TX${plural}."
    else
        alert "Uploaded ${upload_count} of ${rawtx_count} TX${plural}."
    fi

    CACHE=""

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
