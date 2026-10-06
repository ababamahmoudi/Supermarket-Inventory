# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app/backend
COPY backend/requirements*.txt ./
RUN --mount=type=secret,id=additional_ca \
    if [ -s /run/secrets/additional_ca ]; then \
      cp /run/secrets/additional_ca /etc/ssl/certs/ca-certificates.crt; \
    fi && \
    pip install --no-cache-dir --require-hashes -r requirements-dev.txt

ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    PIP_CERT=/etc/ssl/certs/ca-certificates.crt

COPY backend /app/backend
COPY seed /app/seed

# This image serves local development and CI. Production gets a separate hardened image later.
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
