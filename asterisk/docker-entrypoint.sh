#!/bin/sh
set -e

# Fix Windows CRLF line endings for all mounted config files
for f in /etc/asterisk/*.conf; do
    sed -i 's/\r$//' "$f"
done

# Substitute POSTGRES_PASSWORD in res_config_pgsql.conf
sed -i "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
    /etc/asterisk/res_config_pgsql.conf

exec asterisk -f