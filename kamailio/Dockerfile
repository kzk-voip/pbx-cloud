FROM kamailio/kamailio:5.7-bookworm

USER root

# Install PostgreSQL client lib for db_postgres module
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    kamailio-postgres-modules && \
    rm -rf /var/lib/apt/lists/*

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh
COPY etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg

EXPOSE 5060/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
