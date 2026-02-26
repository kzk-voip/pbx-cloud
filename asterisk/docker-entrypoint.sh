#!/bin/sh
set -e

sed -i "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
    /etc/asterisk/res_pgsql.conf

exec asterisk -f