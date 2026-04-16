#!/bin/sh
set -e

# Fix Windows CRLF line endings for all mounted config files
# (sed -i doesn't work on Docker bind mounts, so we use tmp + cp)
for f in /etc/asterisk/*.conf; do
    sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
    cp "/tmp/$(basename "$f")" "$f"
done

# Substitute POSTGRES_PASSWORD in res_pgsql.conf and cdr_pgsql.conf
for pgconf in res_pgsql.conf cdr_pgsql.conf; do
    sed "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" \
        /etc/asterisk/$pgconf > /tmp/$pgconf
    cp /tmp/$pgconf /etc/asterisk/$pgconf
done

# Substitute EXTERNAL_IP and ASTERISK_SIP_PORT in pjsip.conf
sed "s/\${EXTERNAL_IP}/${EXTERNAL_IP:-127.0.0.1}/g" \
    /etc/asterisk/pjsip.conf > /tmp/pjsip.conf
sed -i "s/\${ASTERISK_SIP_PORT}/${ASTERISK_SIP_PORT:-5070}/g" /tmp/pjsip.conf
cp /tmp/pjsip.conf /etc/asterisk/pjsip.conf

exec asterisk -f