#!/bin/sh
set -e

# Copy mounted config to a writable location
cp /etc/kamailio/kamailio.cfg /tmp/kamailio.cfg

# Fix Windows CRLF line endings
sed -i 's/\r$//' /tmp/kamailio.cfg

# Substitute environment variables
sed -i "s|\${ASTERISK_IP}|${ASTERISK_IP:-127.0.0.1}|g" /tmp/kamailio.cfg
sed -i "s|\${ASTERISK_PORT}|${ASTERISK_PORT:-5070}|g" /tmp/kamailio.cfg
sed -i "s|\${EXTERNAL_IP}|${EXTERNAL_IP:-127.0.0.1}|g" /tmp/kamailio.cfg

exec kamailio -DD -E -m 64 -M 8 -f /tmp/kamailio.cfg
