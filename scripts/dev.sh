#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# The managed cloud proxy supplies this public trust root. Normal desktops keep
# their standard trust stores; an explicit BUILD_CA_FILE takes priority.
if [[ -f /usr/local/share/ca-certificates/environment-proxy-ca.crt ]]; then
  export BUILD_CA_FILE="${BUILD_CA_FILE:-/etc/ssl/certs/ca-certificates.crt}"
  export BUILDX_CONFIG="${BUILDX_CONFIG:-$PWD/.local/buildx}"
  export PRE_COMMIT_HOME="${PRE_COMMIT_HOME:-$PWD/.local/pre-commit}"
  export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$PWD/.local/pip-cache}"
  export npm_config_cache="${npm_config_cache:-$PWD/.local/npm-cache}"
fi

require_docker() {
  if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    echo "Install Docker Desktop with Compose; see README.md." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Start Docker Desktop, wait until its engine is running, and retry." >&2
    exit 1
  fi
}

local_config() {
  if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env with fake local development values."
  fi
}

compose() {
  docker compose "$@"
}

start_services() {
  compose up -d --wait --wait-timeout 180
  compose exec -T api python manage.py check
  compose exec -T api python -c "import json, urllib.request; r=json.load(urllib.request.urlopen('http://127.0.0.1:8000/readyz')); assert r['status']=='ok'; print('API and dependencies are ready.')"
  echo "Open http://localhost:5173 for the placeholder and http://localhost:8000/healthz for API health."
}

target="${1:-help}"
case "$target" in
  hooks)
    python_cmd="${DEV_PYTHON:-python3.12}"
    if ! command -v "$python_cmd" >/dev/null; then
      python_cmd="${DEV_PYTHON:-python3}"
    fi
    "$python_cmd" -c "import sys; assert sys.version_info[:2] == (3, 12), 'Install Python 3.12 or select it with DEV_PYTHON=python3.12 make hooks.'"
    "$python_cmd" -m venv .venv
    .venv/bin/python -m pip install -r backend/requirements-dev.txt
    .venv/bin/pre-commit install
    echo "Pre-commit installed. Activate with: source .venv/bin/activate"
    ;;
  e2e)
    require_docker
    local_config
    start_services
    if ! command -v npm >/dev/null; then
      echo "Install the Node.js version in frontend/.nvmrc, then retry make e2e." >&2
      exit 1
    fi
    if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]] && command -v chromium >/dev/null; then
      export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)"
    fi
    (cd frontend && npm ci && if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]]; then npx playwright install chromium; fi && npm run e2e)
    ;;
  *)
    require_docker
    local_config
    case "$target" in
      setup)
        compose config --quiet
        compose build
        compose up -d --wait --wait-timeout 120 db redis s3
        bash scripts/backup-before-migrate.sh
        compose run --rm api python manage.py migrate --noinput
        compose run --rm api python manage.py seed_arzon --refresh-config
        # Refresh the dependency volume against the committed lockfile on every setup.
        compose run --rm --no-deps web npm ci
        echo "Setup complete. Run make up. Repeating setup preserves .env, users, and data."
        ;;
      up) start_services ;;
      down) compose down; echo "Stopped. Local data volumes were preserved." ;;
      test)
        compose up -d --wait --wait-timeout 120 db redis
        compose run --rm --no-deps api pytest
        compose run --rm --no-deps web npm run test
        ;;
      lint)
        compose config --quiet
        bash -n scripts/dev.sh
        bash -n scripts/backup-before-migrate.sh
        compose run --rm --no-deps api ruff check . /app/seed
        compose run --rm --no-deps api ruff format --check . /app/seed
        compose run --rm --no-deps api python manage.py check
        compose run --rm --no-deps web npm run lint
        ;;
      build) compose run --rm --no-deps web npm run build ;;
      logs) compose logs --tail=100 ;;
      status) compose ps ;;
      audit)
        compose run --rm --no-deps api pip-audit -r requirements.txt
        compose run --rm --no-deps web npm audit --omit=dev --audit-level=high
        ;;
      *) echo "Unknown target: $target. Run make help." >&2; exit 2 ;;
    esac
    ;;
esac
