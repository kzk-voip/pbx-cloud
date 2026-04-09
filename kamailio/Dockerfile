FROM ghcr.io/kamailio/kamailio:5.8.7-bookworm

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh
COPY etc/kamailio/ /etc/kamailio/

ENTRYPOINT ["/docker-entrypoint.sh"]
