FROM ghcr.io/kamailio/kamailio-ci:5.7

USER root

# Copy configuration files
COPY etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg
COPY etc/kamailio/dispatcher.list /etc/kamailio/dispatcher.list

# Fix Windows CRLF line endings (sed is available on Alpine by default)
RUN sed -i 's/\r$//' /etc/kamailio/kamailio.cfg /etc/kamailio/dispatcher.list

EXPOSE 5060/udp 5060/tcp

ENTRYPOINT ["kamailio", "-DD", "-E", "-m", "64", "-M", "8"]
