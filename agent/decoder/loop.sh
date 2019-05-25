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

log() {
    now=`date +"${DATE_FORMAT}"`
    printf "\033[1;35m%s\033[0m :: %s\n" "$now" "$1" >/dev/stderr
}

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
            NONC=`printf "%s%s" "${NONC}" "${SEED}" | xxd -r -p | sha256sum | head -c 64`
            DATA=`printf '{"guid":"%s","nonce":"%s","graffiti":%s}' "${GUID}" "${NONC}" "[]" | xxd -p | tr -d '\n'`
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

