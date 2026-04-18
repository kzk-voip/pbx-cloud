FROM alpine:3.20 AS cert-gen
RUN apk add --no-cache openssl && \
    mkdir -p /certs && \
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /certs/kamailio-key.pem \
      -out /certs/kamailio-cert.pem \
      -days 3650 \
      -subj "/CN=pbx-cloud/O=PBX Cloud/C=UA" && \
    chmod 600 /certs/kamailio-key.pem

FROM ghcr.io/kamailio/kamailio-ci:5.7

# Copy TLS certificate from builder stage
COPY --from=cert-gen /certs/ /etc/kamailio/tls/

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
