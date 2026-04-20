#!/bin/sh
set -e

# ===========================================================================
# PBX Cloud - Asterisk Docker Entrypoint
#
# IMPORTANT: Both asterisk-1 and asterisk-2 share the same bind-mounted
# config files. We MUST NOT write back to /etc/asterisk/ (bind mount) —
# that would cause a race condition where one node overwrites the other's
# port/config. Instead, we process configs into /tmp/ and point Asterisk
# to read from /tmp/ via AST_CONFIG_DIR.
# ===========================================================================

CONF_DIR="/tmp/asterisk-conf"
mkdir -p "$CONF_DIR"

# 1. Copy ALL configs to the working directory, stripping Windows CRLF
for f in /etc/asterisk/*.conf; do
    sed 's/\r$//' "$f" > "$CONF_DIR/$(basename "$f")"
done

# 2. Substitute POSTGRES_PASSWORD in res_pgsql.conf and cdr_pgsql.conf
for pgconf in res_pgsql.conf cdr_pgsql.conf; do
    sed -i "s/\${POSTGRES_PASSWORD}/$POSTGRES_PASSWORD/g" "$CONF_DIR/$pgconf"
done

# 3. Substitute EXTERNAL_IP and ASTERISK_SIP_PORT in pjsip.conf
sed -i "s/\${EXTERNAL_IP}/${EXTERNAL_IP:-127.0.0.1}/g" "$CONF_DIR/pjsip.conf"
sed -i "s/\${ASTERISK_SIP_PORT}/${ASTERISK_SIP_PORT:-5070}/g" "$CONF_DIR/pjsip.conf"

# 4. Substitute AMI_PORT in manager.conf (each node needs a unique AMI port)
sed -i "s/\${AMI_PORT}/${AMI_PORT:-5038}/g" "$CONF_DIR/manager.conf"

# 5. Start Asterisk, pointing it to our processed config directory
exec asterisk -f -C "$CONF_DIR/asterisk.conf"