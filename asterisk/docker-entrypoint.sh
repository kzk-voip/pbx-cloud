#!/bin/sh
set -e

sed "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
    /etc/asterisk/res_pgsql.conf > /tmp/res_pgsql.conf

cp /tmp/res_pgsql.conf /etc/asterisk/res_pgsql.conf

exec asterisk -f