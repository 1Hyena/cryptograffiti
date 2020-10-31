#!/bin/bash

################################################################################
# Example usage: ./monitor.sh config.json                                      #
################################################################################
CONF="$1"                                                                      #
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
    INIT=`printf "%s" "${config}" | jq -r -M '.["init.sh"] | select (.!=null)'`
    CALL=`printf "%s" "${config}" | jq -r -M '.["call.sh"] | select (.!=null)'`

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

while :
do
    wdir=`pwd`
    log "${wdir}"
    log "${INIT} ${CONF}"
    config=`"${INIT}" "${CONF}"`

    SKEY=$(
        printf "%s" "${config}" |
        jq -r -M .sec_key       |
        xxd -r -p               |
        xxd -p                  |
        tr -d '\n'
    )

    SEED=$(
        printf "%s" "${config}" |
        jq -r -M .seed          |
        xxd -r -p               |
        xxd -p                  |
        tr -d '\n'
    )

    GUID=$(
        printf "%s" "${config}" |
        jq -r -M .guid          |
        xxd -r -p               |
        xxd -p                  |
        tr -d '\n'
    )

    TOKN=$(
        printf "%s" "${config}" |
        jq -r -M .token         |
        xxd -r -p               |
        xxd -p                  |
        tr -d '\n'
    )

    NONC=$(
        printf "%s" "${config}" |
        jq -r -M .nonce         |
        xxd -r -p               |
        xxd -p                  |
        tr -d '\n'
    )

    ADDR=$(
        printf "%s" "${config}" |
        jq -r -M .api
    )

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

    NONC=$(
        printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64
    )

    DATA=$(
        printf '{"guid":"%s","nonce":"%s"}' "${GUID}" "${NONC}" |
        xxd -p                                                  |
        tr -d '\n'
    )

    response=$("${CALL}" "${CONF}" "get_constants" "${DATA}")

    result=`printf "%s" "${response}" | jq -r -M .result`
    if [ "${result}" == "SUCCESS" ]; then
        NONCE_ERRORS=0
        LOGS_PER_QUERY=$(
            printf "%s" "${response}" |
            jq -r -M .constants       |
            jq -r -M .LOGS_PER_QUERY
        )
        log "LOGS_PER_QUERY: ${LOGS_PER_QUERY}"

        while :
        do
            old_nonce="${NONC}"
            NONC=$(
                printf "%s%s" "${NONC}" "${SEED}" |
                xxd -r -p                         |
                sha256sum                         |
                head -c 64
            )
            new_nonce="${NONC}"

            DATA=$(
                printf '{"guid":"%s","nonce":"%s","nr":"%s","count":"%s"}' \
                "${GUID}" "${NONC}" "${NR}" "${LOGS_PER_QUERY}"            |
                xxd -p                                                     |
                tr -d '\n'
            )

            state=0
            response=$("${CALL}" "${CONF}" "get_log" "${DATA}")
            state=$?

            result=$(printf "%s" "${response}" | jq -r -M .result)

            NONC="${old_nonce}" # By default, we revert the nonce.

            if [ "${result}" == "SUCCESS" ]; then
                # The API call did not fail on the network level, now it is safe
                # to actually update the nonce.
                NONC="${new_nonce}"

                lines=$(
                    printf "%s" "${response}" |
                    jq -r -M --compact-output ".log | .[]"
                )

                last_nr="${NR}"

                while read -r line; do
                    nr=`printf "%s" "${line}" | jq -r -M .nr`

                    if [ -z "${NR}" ] ; then
                        NR="${nr}"
                        last_nr="0"
                    else
                        if [ "${nr}" -gt "${NR}" ]; then
                            NR="${nr}"
                        fi
                    fi

                    if [ "${nr}" -gt "${last_nr}" ]; then
                        level=$(printf "%s" "${line}" | jq -r -M .level)
                        text=$(printf "%s" "${line}"  | jq -r -M .text)
                        time=$(printf "%s" "${line}"  | jq -r -M .creation_time)
                        alias=$(
                            printf "%s" "${line}" |
                            jq -r -M '.session_alias | select (.!=null)'
                        )

                        color="\033[0m";

                        if [ "${level}" == "0" ] ; then
                            color="\033[0;37m" # spam
                        elif [ "${level}" == "1" ] ; then
                            color="\033[0m"    # normal
                        elif [ "${level}" == "2" ] ; then
                            color="\033[0;31m" # misuse
                        elif [ "${level}" == "3" ] ; then
                            color="\033[1;35m" # financial
                        elif [ "${level}" == "4" ] ; then
                            color="\033[1;33m" # error
                        elif [ "${level}" == "5" ] ; then
                            color="\033[1;31m" # critical
                        fi

                        if [ -z "${alias}" ] ; then
                            printf "%s :: ${color}%s\033[0m\n" \
                            "${time}" "${text}"
                        else
                            printf "%s :: %s: ${color}%s\033[0m\n" \
                            "${time}" "${alias}" "${text}"
                        fi
                    fi
                done <<< "${lines}"
            elif [ "${result}" == "FAILURE" ]; then
                # The API call did not fail on the network level, now it is safe
                # to actually update the nonce.
                NONC="${new_nonce}"

                printf "%s" "${response}" | jq .error >/dev/stderr
                error_code=$(
                    printf "%s" "${response}" | jq -r -M .error | jq -r -M .code
                )

                if [ "${error_code}" == "ERROR_NONCE" ]; then
                    ((NONCE_ERRORS++))
                    break
                fi
            elif [ "${state}" -ge "1" ] ; then
                printf "%s\n" "${CALL}: Exit code ${state}."
            else
                printf "%s" "${response}" | jq .error >/dev/stderr
            fi

            sleep 5
        done
    else
        printf "%s" "${response}" | jq .error >/dev/stderr

        error_code=$(
            printf "%s" "${response}" | jq -r -M .error | jq -r -M .code
        )

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
