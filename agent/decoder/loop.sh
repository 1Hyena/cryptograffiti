#!/bin/bash

date_format="%a %b %d %H:%M:%S %Y"

clifile="$1"
cgdfile="$2"
datadir="$3"
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

if [ -z "$cgdfile" ] ; then
    cgdfile="./cgd"
fi

tick=8
while :
do
    ((tick++))
    if [ "$tick" -ge "10" ]; then
        tick=0

        if [ $(which "${clifile}" 2>/dev/null ) ] \
        && [ $(which "${cgdfile}" 2>/dev/null ) ] \
        && [ $(which sort)                      ] \
        && [ $(which comm)                      ] \
        && [ $(which tee)                       ] \
        && [ $(which parallel)                  ] \
        && [ $(which jq)                        ] ; then
            now=`date +"$date_format"`
            printf "\033[1;36m%s\033[0m :: Checking for new TXs...\n" "$now"

            ${clifile} ${datadir} getrawmempool | jq -M -r .[] | sort | tee ${newsfile} | comm -23 - ${oldsfile} | parallel -P ${workers} "${clifile} ${datadir} getrawtransaction {} 1 | ${cgdfile}"
            mv ${oldsfile} ${tempfile} && mv ${newsfile} ${oldsfile} && mv ${tempfile} ${newsfile}
        else
            now=`date +"$date_format"`
            printf "\033[1;36m%s\033[0m :: Some of the required commands are not available.\n" "$now"
            exit
        fi
    fi

    sleep 1
done

