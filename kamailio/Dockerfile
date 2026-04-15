FROM ghcr.io/kamailio/kamailio-ci:5.7

# Generate self-signed TLS certificate for SIP over TLS (port 5061)
RUN mkdir -p /etc/kamailio/tls && \
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /etc/kamailio/tls/kamailio-key.pem \
      -out /etc/kamailio/tls/kamailio-cert.pem \
      -days 3650 \
      -subj "/CN=pbx-cloud/O=PBX Cloud/C=UA" && \
    chmod 600 /etc/kamailio/tls/kamailio-key.pem

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
