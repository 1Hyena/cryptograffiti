#!/bin/bash

################################################################################
# The aim of this script is to fill in the following variables as part of the  #
# newly established/restored session for the API of CryptoGraffiti.info.       #
SKEY=""                                                                        #
SEED=""                                                                        #
GUID=""                                                                        #
TOKN=""                                                                        #
NONC=""                                                                        #
################################################################################

ADDR="https://cryptograffiti.info/api/"
CONF="$1" # Configuration file
if [ -z "$CONF" ] ; then
    CONF=""
fi

ERRORS=0

date_format="%Y-%m-%d %H:%M:%S"

rawurlencode() {
    local string="${1}"
    local strlen=${#string}
    local encoded=""
    local pos c o

    for (( pos=0 ; pos<strlen ; pos++ )); do
        c=${string:$pos:1}
        case "$c" in
            [-_.~a-zA-Z0-9] ) o="${c}" ;;
            * )               printf -v o '%%%02x' "'$c"
        esac
        encoded+="${o}"
    done
    echo "${encoded}"    # You can either set a return variable (FASTER)
    REPLY="${encoded}"   #+or echo the result (EASIER)... or both... :p
}

log() {
    local now=`date +"$date_format"`
    printf "\033[1;35m%s\033[0m :: %s\n" "$now" "$1" >/dev/stderr
}

if [ ! -z "${CONF}" ] ; then
    log "Loading configuration: ${CONF}"

    if [[ -r ${CONF} ]] ; then
        config=$(<"$CONF")
        SKEY=`printf "%s" "${config}" | jq -r -M .sec_key | xxd -r -p | xxd -p | tr -d '\n'`
        SEED=`printf "%s" "${config}" | jq -r -M .seed    | xxd -r -p | xxd -p | tr -d '\n'`
        GUID=`printf "%s" "${config}" | jq -r -M .guid    | xxd -r -p | xxd -p | tr -d '\n'`
        TOKN=`printf "%s" "${config}" | jq -r -M .token   | xxd -r -p | xxd -p | tr -d '\n'`
        ADDR=`printf "%s" "${config}" | jq -r -M .api`

        if [ ! -z "${SKEY}" ] \
        && [ ! -z "${SEED}" ] \
        && [ ! -z "${GUID}" ] ; then
            log "Configuration loaded successfully."
        else
            log "Failed to extract the configuration file."
            exit
        fi
    else
        log "Failed to load configuration."
        exit
    fi
else
    log "Configuration file was not provided."

    while :
    do
        log "Generating a new security key."
        SKEY=`head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64 | sha256sum | head -c 64`

        log "Performing the security handshake."

        url_data=$( rawurlencode "{}"      )
        url_skey=$( rawurlencode "${SKEY}" )

        if [ ! -z "${TOKN}" ] ; then
            url_token=$( rawurlencode "${TOKN}" )
            response=`curl -f -s -d "fun=handshake&data=${url_data}&sec_key=${url_skey}&token=${url_token}" -X POST "${ADDR}"`
        else
            response=`curl -f -s -d "fun=handshake&data=${url_data}&sec_key=${url_skey}" -X POST "${ADDR}"`
        fi

        result=`printf "%s" "${response}" | jq -M -r .result`

        if [ ${result} == "SUCCESS" ]; then
            log "Security handshake completed successfully."
            break
        fi

        printf "%s" "${response}" | jq . >/dev/stderr

        if [ "${ERRORS}" -ge "3" ]; then
            log "Security handshake failed, exiting."
            exit
        fi

        log "Security handshake failed, retrying."
        ((ERRORS++))
        sleep 1
    done
fi

while :
do
    if [ ! -z "${GUID}" ] ; then
        log "Restoring the session."
        data=`printf '{"guid":"%s","restore":"1"}' "${GUID}"`
    else
        log "Generating a new GUID."
        GUID=`head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64 | sha256sum | head -c 64`
        data=`printf '{"guid":"%s"}' "${GUID}"`
    fi

    hash=`printf "%s" "${SKEY}" | xxd -r -p | sha256sum | head -c 64`
    salt=`head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64 | sha256sum | head -c 32`
    csum=`printf "%s%s" "${data}" "${SKEY}" | md5sum | head -c 32`
    data=`printf "%s" "${data}" | openssl enc -aes-256-cfb -a -A -K "${SKEY}" -iv "${salt}"`

    url_data=$( rawurlencode "${data}" )
    url_hash=$( rawurlencode "${hash}" )
    url_salt=$( rawurlencode "${salt}" )
    url_csum=$( rawurlencode "${csum}" )

    if [ ! -z "${TOKN}" ] ; then
        url_token=$( rawurlencode "${TOKN}" )
        response=`curl -f -s -d "fun=init&data=${url_data}&sec_hash=${url_hash}&salt=${url_salt}&checksum=${url_csum}&token=${url_token}" -X POST "${ADDR}"`
    else
        response=`curl -f -s -d "fun=init&data=${url_data}&sec_hash=${url_hash}&salt=${url_salt}&checksum=${url_csum}" -X POST "${ADDR}"`
    fi

    response_iv=`printf "%s" "${response}" | jq -M -r .iv`
    response_checksum=`printf "%s" "${response}" | jq -M -r .checksum | tr '[:upper:]' '[:lower:]'`
    response_data=`printf "%s" "${response}" | jq -M -r .data | openssl enc -d -aes-256-cfb -a -A -K "${SKEY}" -iv "${response_iv}"`
    test_checksum=`printf "%s%s" "${response_data}" "${SKEY}" | md5sum | head -c 32 | tr '[:upper:]' '[:lower:]'`

    if [ "${response_checksum}" == "${test_checksum}" ]; then
        result=`printf "%s" "${response_data}" | jq -M -r .result`

        if [ "${result}" == "SUCCESS" ]; then
            NONC=`printf "%s" "${response_data}" | jq -M -r .nonce`

            if [ ! -z "${SEED}" ] ; then
                log "Session restoration completed successfully."
            else
                SEED=`printf "%s" "${response_data}" | jq -M -r .seed`
                log "Session initialization completed successfully."
            fi

            break
        fi
    else
        log "Response includes a wrong checksum!"
    fi

    printf "%s" "${response}" | jq . >/dev/stderr

    if [ "${ERRORS}" -ge "3" ]; then
        log "Session initialization failed, exiting."
        exit
    fi

    log "Session initialization failed, retrying."
    ((ERRORS++))
    sleep 1
done

if [ ! -z "${SKEY}" ] \
&& [ ! -z "${SEED}" ] \
&& [ ! -z "${NONC}" ] \
&& [ ! -z "${GUID}" ] ; then
    if [ ! -z "${TOKN}" ] ; then
        TOKN="\"${TOKN}\""
    else
        TOKN="null"
    fi
    printf '{"sec_key":"%s","seed":"%s","guid":"%s","nonce":"%s","token":%s,"api":"%s"}' "${SKEY}" "${SEED}" "${GUID}" "${NONC}" "${TOKN}" "${ADDR}" | jq -r -M .
else
    log "Incomplete results, exiting."
    exit
fi

