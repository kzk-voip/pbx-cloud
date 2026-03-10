#!/bin/sh
set -e

# Fix Windows CRLF line endings
for f in /etc/kamailio/*; do
    if [ -f "$f" ]; then
        sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
        cp "/tmp/$(basename "$f")" "$f"
    fi
done

# Substitute placeholders in kamailio.cfg
sed -e "s/POSTGRES_PASSWORD_PLACEHOLDER/$POSTGRES_PASSWORD/g" \
    -e "s/EXTERNAL_IP_PLACEHOLDER/$EXTERNAL_IP/g" \
    /etc/kamailio/kamailio.cfg > /tmp/kamailio.cfg
cp /tmp/kamailio.cfg /etc/kamailio/kamailio.cfg

exec kamailio -DD -E
