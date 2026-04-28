FROM andrius/asterisk:21

# Install MOH and core voice prompt sounds
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    asterisk-moh-opsound-wav \
    asterisk-core-sounds-en-wav \
    openssl && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/share/asterisk/sounds/en_US_f_Allison /var/lib/asterisk/sounds/en

# Generate self-signed DTLS certificates for WebRTC
RUN mkdir -p /etc/asterisk/keys && \
    openssl req -x509 -newkey rsa:2048 \
      -keyout /etc/asterisk/keys/asterisk.key \
      -out /etc/asterisk/keys/asterisk.pem \
      -days 3650 -nodes -subj '/CN=pbx-cloud' && \
    chmod 644 /etc/asterisk/keys/asterisk.pem /etc/asterisk/keys/asterisk.key

USER asterisk

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]