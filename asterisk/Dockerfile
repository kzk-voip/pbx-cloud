FROM andrius/asterisk:21

# Download MOH sounds
RUN curl -sL https://downloads.asterisk.org/pub/telephony/sounds/asterisk-moh-opsound-wav-current.tar.gz \
    | tar xz -C /var/lib/asterisk/moh/

# Download core sounds (for voicemail prompts, IVR, etc.)
RUN curl -sL https://downloads.asterisk.org/pub/telephony/sounds/asterisk-core-sounds-en-wav-current.tar.gz \
    | tar xz -C /var/lib/asterisk/sounds/en/

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]