FROM kamailio/kamailio-ci:5.7

USER root

# Install dos2unix for CRLF handling (Windows host)
RUN apt-get update && \
    apt-get install -y --no-install-recommends dos2unix && \
    rm -rf /var/lib/apt/lists/*

# Copy configuration files
COPY etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg
COPY etc/kamailio/dispatcher.list /etc/kamailio/dispatcher.list

# Fix Windows CRLF line endings
RUN dos2unix /etc/kamailio/kamailio.cfg /etc/kamailio/dispatcher.list

EXPOSE 5060/udp 5060/tcp

ENTRYPOINT ["kamailio", "-DD", "-E", "-m", "64", "-M", "8"]
