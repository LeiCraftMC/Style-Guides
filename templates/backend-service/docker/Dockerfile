# Production image: the compiled Bun binary on a slim Debian base.
# Build the binary first with `bun compile linux-x64-baseline <version> --no-version-tag`
# (see scripts/compile). Replace <binary-name> with your project's compiled binary name.
FROM debian:stable-slim

RUN apt-get update && apt-get install -y curl ca-certificates openssl tar bash gpg

WORKDIR /opt/<binary-name>

COPY ./build/bin/<binary-name>-linux-x64-baseline /usr/local/bin/<binary-name>
RUN chmod u+x /usr/local/bin/<binary-name>

EXPOSE 12500/tcp

ENTRYPOINT ["<binary-name>"]