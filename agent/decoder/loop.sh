#!/bin/bash

date_format="%Y-%m-%d %H:%M:%S"

clifile="$1"
webhook="$2"
cgdfile="$3"
datadir="$4"
workers="16"

lockfile=/tmp/7Ngp0oRoKc7QHIqC
newsfile=/tmp/Y9Jx4Gvab0MYNjH0
oldsfile=/tmp/dVDvED7qzF0wHFp1
tempfile=/tmp/g2xEyKg2hqoDuCii
touch $lockfile
read lastPID < $lockfile

if [ ! -z "$lastPID" -a -d /proc/$lastPID ]
then
    now=`date +"$date_format"`
    printf "\033[1;36m%s\033[0m :: Process is already running!\n" "$now"
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

if [ -z "$webhook" ] ; then
    webhook=""
fi

if [ -z "$cgdfile" ] ; then
    cgdfile="./cgd"
fi

errors=0
tick=8
while :
do
    deadcanary="\033[0;31m::\033[0m"
    canary="::"
    if [ "$errors" -ge "1" ]; then
        canary="${deadcanary}"
    fi

    ((tick++))
    if [ "$tick" -ge "10" ]; then
        tick=0

        if [ $(which "${clifile}" 2>/dev/null ) ] \
        && [ $(which "${cgdfile}" 2>/dev/null ) ] \
        && [ $(which sort)                      ] \
        && [ $(which echo)                      ] \
        && [ $(which grep)                      ] \
        && [ $(which comm)                      ] \
        && [ $(which curl)                      ] \
        && [ $(which tee)                       ] \
        && [ $(which parallel)                  ] \
        && [ $(which jq)                        ] ; then
            news=`${clifile} ${datadir} getrawmempool | jq -M -r .[] | sort | tee ${newsfile} | comm -23 - ${oldsfile}`
            mv ${oldsfile} ${tempfile} && mv ${newsfile} ${oldsfile} && mv ${tempfile} ${newsfile}

            lines=`echo -n "${news}" | grep -c '^'`

            if [ "$lines" -ge "1" ]; then
                now=`date +"$date_format"`

                if [ "$lines" -gt "1" ]; then
                    printf "\033[1;36m%s\033[0m ${canary} Decoding %s TXs.\n" "$now" "${lines}"
                else
                    txhash=`printf "%s" "${news}" | tr -d '\n'`
                    printf "\033[1;36m%s\033[0m ${canary} Decoding TX %s.\n" "$now" "${txhash}"
                fi

                graffiti=`echo "${news}" | parallel -P ${workers} "${clifile} ${datadir} getrawtransaction {} 1 | ${cgdfile}"`
                state=$?
                msgcount=`echo -n "${graffiti}" | grep -c '^'`

                if [ "$msgcount" -ge "1" ]; then
                    now=`date +"$date_format"`
                    plural=""
                    if [ "$msgcount" -gt "1" ]; then
                        plural="s"
                    fi
                    printf "\033[1;36m%s\033[0m ${canary} Detected graffiti from %s TX%s.\n" "$now" "${msgcount}" "${plural}"

                    echo "${graffiti}" | parallel --pipe -P ${workers} jq
                fi

                if [ "$state" -ge "1" ]; then
                    now=`date +"$date_format"`
                    if [ "$state" -eq "101" ]; then
                        printf "\033[1;31m%s\033[0m ${deadcanary} More than 100 jobs failed.\n" "$now"
                    else
                        if [ "$state" -le "100" ]; then
                            if [ "$state" -eq "1" ]; then
                                printf "\033[1;31m%s\033[0m ${deadcanary} 1 job failed.\n" "$now"
                            else
                                printf "\033[1;31m%s\033[0m ${deadcanary} %s jobs failed.\n" "$now" "$state"
                            fi
                        else
                            printf "\033[1;31m%s\033[0m ${deadcanary} Other error from parallel.\n" "$now"
                        fi
                    fi
                    ((errors++))
                fi
            fi
        else
            now=`date +"$date_format"`
            printf "\033[1;36m%s\033[0m ${canary} Some of the required commands are not available.\n" "$now"
            exit
        fi
    fi

    sleep 1
done

