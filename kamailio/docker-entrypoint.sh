#!/bin/sh
set -e

# ============================================================
# Kamailio Docker Entrypoint
# Loads tenant configuration from PostgreSQL before starting.
# ============================================================

DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_USER="${POSTGRES_USER:-pbx_user}"
DB_NAME="${POSTGRES_DB:-pbx}"
DB_PASS="${POSTGRES_PASSWORD}"

if [ -z "$DB_PASS" ]; then
    echo "ERROR: POSTGRES_PASSWORD environment variable is not set"
    exit 1
fi

# --- Wait for PostgreSQL ---
echo "Waiting for PostgreSQL at $DB_HOST..."
MAX_RETRIES=30
RETRY=0
until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: PostgreSQL not ready after $MAX_RETRIES attempts. Exiting."
        exit 1
    fi
    echo "  attempt $RETRY/$MAX_RETRIES..."
    sleep 1
done
echo "PostgreSQL is ready."

# --- Generate tenant aliases ---
echo "Loading tenant configuration from database..."

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT domain FROM tenants WHERE is_active = TRUE ORDER BY id;" | while read -r domain; do
    [ -n "$domain" ] && echo "alias=\"$domain\""
done > /etc/kamailio/tenant_aliases.cfg

# --- Generate htable entries ---
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT domain, id FROM tenants WHERE is_active = TRUE ORDER BY id;" | while IFS='|' read -r domain tenant_id; do
    [ -n "$domain" ] && echo "\$sht(tenants=>$domain) = $tenant_id;"
done > /etc/kamailio/tenant_htable.cfg

echo "--- Tenant aliases ---"
cat /etc/kamailio/tenant_aliases.cfg
echo "--- Tenant htable ---"
cat /etc/kamailio/tenant_htable.cfg
echo "--- Tenant configuration loaded ---"

# --- Start Kamailio ---
exec kamailio -DD -E -m 64 -M 8
