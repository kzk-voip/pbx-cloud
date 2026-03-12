FROM ghcr.io/kamailio/kamailio-ci:5.7

# Install PostgreSQL client for tenant config loading
RUN apk add --no-cache postgresql-client

# Copy configuration files
COPY etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg
COPY etc/kamailio/dispatcher.list /etc/kamailio/dispatcher.list

# Copy entrypoint script
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

# Fix Windows CRLF line endings
RUN sed -i 's/\r$//' /etc/kamailio/kamailio.cfg /etc/kamailio/dispatcher.list /docker-entrypoint.sh

# Create empty placeholder files for #!include_file directives
# (they will be populated by docker-entrypoint.sh at runtime)
RUN touch /etc/kamailio/tenant_aliases.cfg /etc/kamailio/tenant_htable.cfg

EXPOSE 5060/udp 5060/tcp

ENTRYPOINT ["/docker-entrypoint.sh"]
