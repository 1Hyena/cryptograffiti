#!/bin/bash

################################################################################
# The aim of this script is to fill in the following variables as part of the  #
# newly established session for the API of CryptoGraffiti.info.                #
SEC_KEY=""                                                                     #
SEED=""                                                                        #
GUID=""                                                                        #
################################################################################

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

date_format="%Y-%m-%d %H:%M:%S"

while :
do
    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: Generating a new security key.\n" "$now"

    SEC_KEY=`makepasswd --chars 64 | sha256sum | head -c 64`

    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: SEC_KEY: %s\n" "$now" "${SEC_KEY}"

    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: Performing the security handshake.\n" "$now"

    URL_DATA=$( rawurlencode "{}" )
    URL_SEC_KEY=$( rawurlencode "${SEC_KEY}" )

    response=`curl -s -d "fun=handshake&data=${URL_DATA}&sec_key=${URL_SEC_KEY}" -X POST "https://cryptograffiti.info/api/"`
    result=`printf "%s" "${response}" | jq -M -r .result`

    if [ ${result} == "SUCCESS" ]; then
        now=`date +"$date_format"`
        printf "\033[1;36m%s\033[0m :: Security handshake completed successfully.\n" "$now"
        break
    fi

    printf "%s" "${response}" | jq

    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: Security handshake failed, retrying.\n" "$now"
    sleep 1
done

while :
do
    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: Generating a new GUID.\n" "$now"

    GUID=`makepasswd --chars 64 | sha256sum | head -c 64`

    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: GUID   : %s\n" "$now" "${GUID}"

    SEC_HASH=`printf "%s" "${SEC_KEY}" | xxd -r -p | sha256sum | head -c 64`
    SALT=`makepasswd --chars 64 | sha256sum | head -c 32`
    DATA=`printf '{"guid":"%s"}' "${GUID}"`
    CHECKSUM=`printf "%s%s" "${DATA}" "${SEC_KEY}" | md5sum | head -c 32`
    DATA=`printf "%s" "${DATA}" | openssl enc -aes-256-cfb -a -A -K "${SEC_KEY}" -iv "${SALT}"`

    URL_DATA=$( rawurlencode "${DATA}" )
    URL_SEC_HASH=$( rawurlencode "${SEC_HASH}" )
    URL_SALT=$( rawurlencode "${SALT}" )
    URL_CHECKSUM=$( rawurlencode "${CHECKSUM}" )

    response=`curl -s -d "fun=init&data=${URL_DATA}&sec_hash=${URL_SEC_HASH}&salt=${URL_SALT}&checksum=${URL_CHECKSUM}" -X POST "https://cryptograffiti.info/api/"`
    response_iv=`printf "%s" "${response}" | jq -M -r .iv`
    response_checksum=`printf "%s" "${response}" | jq -M -r .checksum | tr '[:upper:]' '[:lower:]'`
    response_data=`printf "%s" "${response}" | jq -M -r .data | openssl enc -d -aes-256-cfb -a -A -K "${SEC_KEY}" -iv "${response_iv}"`
    test_checksum=`printf "%s%s" "${response_data}" "${SEC_KEY}" | md5sum | head -c 32 | tr '[:upper:]' '[:lower:]'`

    if [ "${response_checksum}" == "${test_checksum}" ]; then
        result=`printf "%s" "${response_data}" | jq -M -r .result`

        if [ "${result}" == "SUCCESS" ]; then
            SEED=`printf "%s" "${response_data}" | jq -M -r .seed`

            now=`date +"$date_format"`
            printf "\033[1;36m%s\033[0m :: Session initialization completed successfully.\n" "$now"
            printf "%s" "${response_data}" | jq
            break
        fi
    else
        now=`date +"$date_format"`
        printf "\033[1;36m%s\033[0m :: Response includes a wrong checksum!\n" "$now"
    fi

    printf "%s" "${response}" | jq

    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: Session initialization failed, retrying.\n" "$now"

    sleep 1
done

if [[ ! -z "${SEED}" ]]; then
    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: SEED   : %s\n" "$now" "${SEED}"
fi

now=`date +"$date_format"`
printf "\033[1;36m%s\033[0m :: All done.\n" "$now"

