#!/bin/sh
set -e

# Fix Windows CRLF line endings for all mounted config files
# (sed -i doesn't work on Docker bind mounts, so we use tmp + cp)
for f in /etc/asterisk/*.conf; do
    sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
    cp "/tmp/$(basename "$f")" "$f"
done

# Substitute POSTGRES_PASSWORD in res_pgsql.conf
sed "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
    /etc/asterisk/res_pgsql.conf > /tmp/res_pgsql.conf
cp /tmp/res_pgsql.conf /etc/asterisk/res_pgsql.conf

# Substitute EXTERNAL_IP in pjsip.conf
sed "s/\${EXTERNAL_IP}/${EXTERNAL_IP:-127.0.0.1}/g" \
    /etc/asterisk/pjsip.conf > /tmp/pjsip.conf
cp /tmp/pjsip.conf /etc/asterisk/pjsip.conf

exec asterisk -f