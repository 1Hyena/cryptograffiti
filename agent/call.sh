#!/bin/bash

################################################################################
CONF="$1"                                                                      #
FUNC="$2"                                                                      #
DATA="$3"                                                                      #
SKEY=""                                                                        #
SEED=""                                                                        #
GUID=""                                                                        #
TOKN=""                                                                        #
ADDR=""                                                                        #
################################################################################
date_format="%Y-%m-%d %H:%M:%S"

log() {
    now=`date +"$date_format"`
    printf "\033[1;34m%s\033[0m :: %s\n" "$now" "$1" >/dev/stderr
}

if [ -z "${CONF}" ] ; then
    log "Configuration file not provided, exiting."
    exit
else
    if [[ -r ${CONF} ]] ; then
        config=$(<"$CONF")
        SKEY=`printf "%s" "${config}" | jq -r -M .sec_key | xxd -r -p | xxd -p | tr -d '\n'`
        SEED=`printf "%s" "${config}" | jq -r -M .seed    | xxd -r -p | xxd -p | tr -d '\n'`
        GUID=`printf "%s" "${config}" | jq -r -M .guid    | xxd -r -p | xxd -p | tr -d '\n'`
        TOKN=`printf "%s" "${config}" | jq -r -M .token   | xxd -r -p | xxd -p | tr -d '\n'`
        ADDR=`printf "%s" "${config}" | jq -r -M .api`

        if [ -z "${SKEY}" ] \
        || [ -z "${SEED}" ] \
        || [ -z "${TOKN}" ] \
        || [ -z "${ADDR}" ] \
        || [ -z "${GUID}" ] ; then
            log "Failed to extract the configuration file."
            exit
        fi
    else
        log "Failed to load configuration from '${CONF}'."
        exit
    fi
fi

if [ -z "${FUNC}" ] ; then
    log "API call not defined, exiting."
    exit
fi

if [ -z "${DATA}" ] ; then
    log "Data not defined, exiting."
    exit
fi

format_data=`printf "%s" "${DATA}" | xxd -r -p | xxd -p | tr -d '\n'`
if [ "${format_data}" != "${DATA}" ] ; then
    log "Invalid data format, exiting."
    exit
fi

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

#log "API call: ${FUNC}"

data=`printf "%s" "${DATA}" | xxd -r -p`
hash=`printf "%s" "${SKEY}" | xxd -r -p | sha256sum | head -c 64`
salt=`head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64 | sha256sum | head -c 32`
csum=`printf "%s%s" "${data}" "${SKEY}" | md5sum | head -c 32`
data=`printf "%s" "${data}" | openssl enc -aes-256-cfb -a -A -K "${SKEY}" -iv "${salt}"`

url_func=$( rawurlencode "${FUNC}" )
url_data=$( rawurlencode "${data}" )
url_hash=$( rawurlencode "${hash}" )
url_salt=$( rawurlencode "${salt}" )
url_csum=$( rawurlencode "${csum}" )
url_tokn=$( rawurlencode "${TOKN}" )

response=`curl -f -s -d "fun=${url_func}&data=${url_data}&sec_hash=${url_hash}&salt=${url_salt}&checksum=${url_csum}&token=${url_tokn}" -X POST "${ADDR}"`
exit_code="$?"
if [ "0" != "${exit_code}" ]; then
    log "Curl exits with code ${exit_code}."
    exit
fi

if [[ -z "${response}" ]]; then
    log "Received an empty response."
    exit
fi

response_iv=`printf "%s" "${response}" | jq -M -r .iv`
response_checksum=`printf "%s" "${response}" | jq -M -r .checksum | tr '[:upper:]' '[:lower:]'`
response_data=`printf "%s" "${response}" | jq -M -r .data | openssl enc -d -aes-256-cfb -a -A -K "${SKEY}" -iv "${response_iv}"`
test_checksum=`printf "%s%s" "${response_data}" "${SKEY}" | md5sum | head -c 32 | tr '[:upper:]' '[:lower:]'`

if [ "${response_checksum}" == "${test_checksum}" ]; then
    printf "%s" "${response_data}" | jq -M -r .
else
    log "Response includes a wrong checksum!"
fi

