FROM andrius/asterisk:21

# Install MOH and core voice prompt sounds
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    asterisk-moh-opsound-wav \
    asterisk-core-sounds-en-wav && \
    rm -rf /var/lib/apt/lists/*
USER asterisk

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]