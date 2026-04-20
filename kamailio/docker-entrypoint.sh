#!/bin/sh
set -e

# Copy mounted config to a writable location
cp /etc/kamailio/kamailio.cfg /tmp/kamailio.cfg

# Fix Windows CRLF line endings
sed -i 's/\r$//' /tmp/kamailio.cfg

# Substitute environment variables
sed -i "s|\${EXTERNAL_IP}|${EXTERNAL_IP:-127.0.0.1}|g" /tmp/kamailio.cfg

# Copy dispatcher.list (fix CRLF)
cp /etc/kamailio/dispatcher.list /tmp/dispatcher.list
sed -i 's/\r$//' /tmp/dispatcher.list

# Update dispatcher.list path in config to use the writable copy
sed -i 's|/etc/kamailio/dispatcher.list|/tmp/dispatcher.list|g' /tmp/kamailio.cfg

exec kamailio -DD -E -m 64 -M 8 -f /tmp/kamailio.cfg
