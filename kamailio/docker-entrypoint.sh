#!/bin/sh
set -e

# Fix Windows CRLF line endings
for f in /etc/kamailio/*; do
    if [ -f "$f" ]; then
        sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
        cp "/tmp/$(basename "$f")" "$f"
    fi
done

# Substitute POSTGRES_PASSWORD in kamailio.cfg
sed "s/POSTGRES_PASSWORD_PLACEHOLDER/$POSTGRES_PASSWORD/g" \
    /etc/kamailio/kamailio.cfg > /tmp/kamailio.cfg
cp /tmp/kamailio.cfg /etc/kamailio/kamailio.cfg

exec kamailio -DD -E
