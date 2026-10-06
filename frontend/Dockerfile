# syntax=docker/dockerfile:1
FROM node:22.23.3-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=secret,id=additional_ca \
    if [ -s /run/secrets/additional_ca ]; then \
      cp /run/secrets/additional_ca /etc/ssl/certs/ca-certificates.crt; \
    fi && \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt npm ci
COPY frontend/ ./
COPY seed/ /app/seed/
COPY assets/ /app/assets/

EXPOSE 5173
CMD ["npm", "run", "dev"]
