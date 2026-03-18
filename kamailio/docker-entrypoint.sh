#!/bin/sh
set -e

# Fix Windows CRLF line endings for config files
for f in /etc/kamailio/*.cfg; do
    if [ -f "$f" ]; then
        sed 's/\r$//' "$f" > "/tmp/$(basename "$f")"
        cp "/tmp/$(basename "$f")" "$f"
    fi
done

exec kamailio -DD -E -m 64 -M 8
