#!/bin/sh
set -e

# Fix Windows CRLF line endings and substitute placeholders.
# Process into /tmp so volume-mounted source files stay intact.
for f in /etc/kamailio/*; do
    if [ -f "$f" ]; then
        sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
    fi
done

# Substitute placeholders
sed -i \
    -e "s/POSTGRES_PASSWORD_PLACEHOLDER/$POSTGRES_PASSWORD/g" \
    -e "s/EXTERNAL_IP_PLACEHOLDER/$EXTERNAL_IP/g" \
    /tmp/kamailio.cfg

exec kamailio -DD -E -f /tmp/kamailio.cfg
