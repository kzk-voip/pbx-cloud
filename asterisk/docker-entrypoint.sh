#!/bin/sh
set -e

sed "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
    /etc/asterisk/res_config_pgsql.conf > /tmp/res_config_pgsql.conf

cp /tmp/res_config_pgsql.conf /etc/asterisk/res_config_pgsql.conf

exec asterisk -f