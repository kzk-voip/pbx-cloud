#!/bin/sh
set -e

# Fix Windows CRLF line endings for all mounted config files
# (sed -i doesn't work on Docker bind mounts, so we use tmp + cp)
for f in /etc/asterisk/*.conf; do
    sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
    cp "/tmp/$(basename "$f")" "$f"
done

# Generate res_config_pgsql.conf from scratch (avoids bind mount issues)
cat > /etc/asterisk/res_config_pgsql.conf << EOF
[general]
dbhost=127.0.0.1
dbport=5432
dbname=pbx
dbuser=pbx_user
dbpass=${POSTGRES_PASSWORD}
requirements=warn
EOF

exec asterisk -f