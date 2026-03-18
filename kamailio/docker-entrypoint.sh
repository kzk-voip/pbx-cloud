#!/bin/sh
set -e

# Fix Windows CRLF line endings for mounted config
for f in /etc/kamailio/*.cfg; do
    [ -f "$f" ] || continue
    sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
    cp "/tmp/$(basename "$f")" "$f"
done

# Substitute environment variables in kamailio.cfg
sed -i "s|\${ASTERISK_IP}|${ASTERISK_IP:-127.0.0.1}|g" /etc/kamailio/kamailio.cfg
sed -i "s|\${ASTERISK_PORT}|${ASTERISK_PORT:-5070}|g" /etc/kamailio/kamailio.cfg
sed -i "s|\${EXTERNAL_IP}|${EXTERNAL_IP:-127.0.0.1}|g" /etc/kamailio/kamailio.cfg

exec kamailio -DD -E -m 64 -M 8
