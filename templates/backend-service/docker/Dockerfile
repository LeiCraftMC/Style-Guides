# Production image: the compiled Bun binary on a slim Debian base.
# Build the binary first (CI does this): `bun run compile linux-x64-baseline --no-version-tag`
# → build/bin/<BINARY_NAME>-linux-x64-baseline. BINARY_NAME must match AppConstants.BINARY_NAME
# (src/utils/constants.ts); override with `--build-arg BINARY_NAME=...` if you rename it.
FROM debian:stable-slim

ARG BINARY_NAME=my-project-api

RUN apt-get update && apt-get install -y curl ca-certificates openssl tar bash gpg

WORKDIR /opt/app

COPY ./build/bin/${BINARY_NAME}-linux-x64-baseline /usr/local/bin/app
RUN chmod u+x /usr/local/bin/app

EXPOSE 12500/tcp

ENTRYPOINT ["app"]
