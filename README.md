# Supermarket Operations

An English/Persian supermarket operations app. Super Arzon is the first company;
its name, branding, CAD currency, Toronto timezone, and 13% HST are editable seed
configuration, not hardcoded application behavior. Exempt products remain exempt.

**Status: Phase 0.1 foundation.** Local services, the bilingual placeholder shell,
API health checks, bootstrap configuration, tests, and pull-request CI are present.
Receiving, approvals, stock, returns, payables, employee sign-in, and the clickable
prototype are not implemented. Do not enter real business data into this scaffold.

## Quick-start for Ali

Choose your computer below. The five main `make` commands run inside Docker;
you do not need Python or Node.js on your computer for those commands. Git downloads
the project, Docker Desktop runs the services, and Make runs the named commands.
VS Code is recommended for editing but not required to view the placeholder.

### Windows 10/11 with WSL 2

1. Install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
   and optionally [VS Code](https://code.visualstudio.com/).
2. Open **PowerShell as Administrator** and run:

   ```powershell
   wsl --install -d Ubuntu
   ```

   Restart if requested. Open **Ubuntu** from the Start menu and create the
   requested Linux username/password. Password typing is invisible; that is normal.
   If WSL is installed already, use `wsl --list --verbose` in PowerShell to check
   Ubuntu is version 2; use `wsl --set-version Ubuntu 2` if necessary.
3. Open Docker Desktop. Enable **Settings → General → Use the WSL 2 based engine**
   and **Settings → Resources → WSL Integration → Ubuntu**. Apply changes and wait
   until the Docker engine is running.
4. In the **Ubuntu terminal**, install the command-line tools and check Docker:

   ```bash
   sudo apt-get update
   sudo apt-get install -y git make curl
   docker version
   docker compose version
   ```

   Expected: Docker lists both **Client** and **Server**, and Compose prints a
   `v2...` version. If no Server appears, recheck Docker Desktop and Ubuntu
   integration. Do not install a second Docker engine inside Ubuntu.
5. Keep the project in Ubuntu's home folder, rather than `/mnt/c`, for reliable
   file watching. In Ubuntu:

   ```bash
   cd ~
   git clone --branch feat/phase-0-1-foundation https://github.com/ababamahmoudi/Supermarket-Inventory.git
   cd Supermarket-Inventory
   ```

### macOS, Intel or Apple silicon

1. Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)
   using the download for your Mac's processor. Optionally install
   [VS Code](https://code.visualstudio.com/).
2. Open **Terminal** from **Applications → Utilities** and install Apple's tools:

   ```bash
   xcode-select --install
   ```

   Click **Install**. If the tools are already installed, continue. Then check:

   ```bash
   git --version
   make --version
   ```

   Expected: both print version numbers rather than `command not found`.
3. Start Docker Desktop and wait for its engine. In Terminal:

   ```bash
   docker version
   docker compose version
   ```

   Expected: a Docker Client and Server and a Compose `v2...` version.
4. Download the review branch:

   ```bash
   cd ~
   git clone --branch feat/phase-0-1-foundation https://github.com/ababamahmoudi/Supermarket-Inventory.git
   cd Supermarket-Inventory
   ```

If already cloned, use that checkout and run `git switch feat/phase-0-1-foundation`.
A private repository may require your existing GitHub sign-in; never put a token
into these commands. After the PR merges, future clones can use `main`.

### Start and test

In the project's top folder, using Ubuntu on Windows or Terminal on Mac:

```bash
make setup
make up
```

The first setup downloads images/packages and may take several minutes. Expect
**Setup complete. Run make up.** Setup preserves an existing `.env`, local data,
and user passwords. It refreshes the reviewed company configuration and branches
from the seed and creates the local demo supervisor only if missing. Omitted
existing companies/branches are not deleted. No inventory records are created. Before pending database migrations, setup writes
a backup under ignored `.local/backups/` and verifies a full restore into a temporary
database. A failed backup/restore prevents migration; protect these local backups.

After `make up`, expect healthy services and **API and dependencies are ready.**
In a browser on your computer:

1. Open **http://localhost:5173**. Expect the company name, a Phase 0.1 placeholder,
   and an API connection indicator.
2. Click the language control to select **فارسی**. Expect Persian text and a layout
   that reads right to left. Switch back to English.
3. Open **http://localhost:8000/healthz**. Expect `{"status":"ok"}`.
4. Open **http://localhost:8000/readyz**. Expect an `ok` response with database and
   Redis checks; a dependency failure returns HTTP 503.
5. Open **http://localhost:8000/api/docs** for the API documentation.

These addresses run on your own computer. Local HTTP is permitted only for
loopback development; deployments require HTTPS. No AWS resources are created.

Run checks:

```bash
make test
make lint
make build
```

Expect pytest and Vitest to report all tests passed, lint to exit without errors,
and Vite to finish a production build. Backend tests run every pricing fixture;
the case count grows as coverage is added. A failing command exits nonzero and
must be fixed before merging.

Stop with:

```bash
make down
```

Containers stop, but named data volumes remain. Restart with `make up`. Do not
use `docker compose down --volumes` to troubleshoot: it deletes local data.

### Troubleshooting

| Symptom | Action |
| --- | --- |
| `make: command not found` | Use Ubuntu and install Make on Windows; install Apple's command-line tools on Mac. |
| Cannot connect to Docker daemon | Start Docker Desktop, wait for the engine, and recheck WSL integration. |
| Missing Makefile or Compose configuration | Use `pwd` and `ls`; enter the folder containing this README and `Makefile`. |
| Image/package download fails | Check Internet access and retry `make setup`. Keep certificate verification enabled. |
| Port 5173 or 8000 already allocated | Stop the other server, or change `WEB_PORT`/`API_PORT` in `.env`, then run `make down` and `make up`. Use the new browser port. |
| Service unhealthy or API connection fails | Run `make status` and `make logs`. Share the error text without passwords. Retry `make down`, `make setup`, `make up`. |
| Database authentication fails after editing `.env` | Existing PostgreSQL volumes retain original credentials. Restore previous local DB credentials; do not delete data to bypass the issue. |
| Frontend dependency missing after pulling changes | Run `make setup`; it refreshes the dependency volume using the committed lockfile. |

## Developer commands

| Command | Purpose |
| --- | --- |
| `make setup` | Build, migrate, seed bootstrap configuration, prepare dependencies. |
| `make up` / `make down` | Start with health checks / stop while retaining data. |
| `make test` | Backend integration/unit tests and frontend component tests. |
| `make lint` | Python and frontend checks, shell syntax, Compose validation. |
| `make build` | Type-check and build the frontend. |
| `make e2e` | Real-browser smoke tests; requires the Node.js version in `frontend/.nvmrc`. |
| `make hooks` | Install Git hooks; requires Python 3.12. |
| `make audit` | Check runtime dependencies for known vulnerabilities. |
| `make logs` / `make status` | Inspect service output / health. |

For browser tests, install the pinned Node.js version, then run `make e2e`.
On Linux/WSL, install required system libraries once:
`cd frontend && npx playwright install --with-deps chromium`, then return to the
root. CI installs these automatically. An existing Chromium can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium make e2e`.
Browser tools are optional for viewing the placeholder; smoke tests run in CI.

To install pre-commit hooks after installing Python 3.12:

```bash
DEV_PYTHON=python3.12 make hooks
source .venv/bin/activate
pre-commit run --all-files
```

Hooks check YAML/JSON, accidental private keys, whitespace, and project lint.
Keep Docker running for the lint hook. Add files again if a hook fixes whitespace.
VS Code Git operations run the installed hook without manual activation.
Dependency declarations and lockfiles must be updated together.

## Local services and credentials

Compose runs PostgreSQL 16, Redis, SeaweedFS local S3, Django, Celery, and Vite. Database and
Redis ports are not published; HTTP ports bind to loopback. Storage is private at **http://localhost:9000**, with fake S3 credentials in
your ignored `.env`; no storage administration console is exposed.
The Django admin at **http://localhost:8000/admin/** uses the fake demo supervisor
values from `.env`. It is a developer inspection tool, not employee sign-in or a
company-isolated business API. Full permissions arrive in Phase 1.

Never commit `.env` or use its fake passwords in production. Development seeding
is refused when debug mode is disabled. No real credentials or AI provider are
needed for this phase. Django public health endpoints reveal no business records.

## Repository and policies

- `backend/`: Django, bootstrap models/migrations, Celery, health, tests, and seed loader.
- `frontend/`: bilingual placeholder, component/browser tests, and build tools.
- `prototype/`: Phase 0.2 placeholder; `infra/`: reserved for reviewed deployments.
- `seed/`: company settings, invented demo data, pricing fixtures and reference.
- `docs/`: requirements, workflows, [return policy](docs/return-policy.md),
  [decisions](docs/decisions.md), and [changelog](docs/CHANGELOG.md).

Read `AGENTS.md` first and follow its document order. The return policy requires
signed pickup evidence, supplier credit paperwork, confirmed physical quantities,
and Supervisor review of financial corrections. Policies are documented now;
their application workflows are scheduled for Phase 1.

CI runs on pull requests and manual dispatch, with tests, lint, web build, service
and browser smoke checks, hooks, and runtime dependency audits. It does not deploy.
The owner must enable required CI checks in GitHub branch protection; adding the
workflow does not itself protect `main`.

## Local storage and build trust decisions

MinIO community is now source-only and unmaintained; its old container images
were unavailable during setup. Local development uses the maintained,
digest-pinned SeaweedFS 4.48 S3 gateway instead. Production storage remains AWS S3.
Read [decision 011](docs/decisions.md) for the source and rationale.

Builds preserve TLS and package checksum verification. The managed cloud proxy
uses its supplied public certificate bundle through an optional BuildKit secret.
Normal Docker Desktop builds use their normal certificate trust. If your workplace
requires an additional trusted CA, set `BUILD_CA_FILE` to an approved CA bundle
when running `make setup`; never disable certificate checking.
