# Architecture and DevOps

Goal: one repository, one command to run everything locally, automated tests on every change, and a clear path to AWS. Ali is not a programmer, so everything must be scripted and explained.

## Recommended stack (change only with a recorded decision in `docs/decisions.md`)
| Layer | Choice | Why |
|---|---|---|
| Backend API | **Python 3.12, Django + Django REST Framework**, OpenAPI schema generated automatically | Mature, strong admin tooling, excellent for data-heavy business apps, AI tools write it reliably |
| Database | **PostgreSQL 16** | Transactions, constraints, JSON where needed |
| Background jobs | **Celery** workers (Redis broker locally; managed Redis or SQS in AWS) | AI invoice reading, PDF generation, exports |
| File storage | **S3-compatible** (SeaweedFS locally, S3 in AWS (decision 011)), private bucket, signed URLs | Invoice originals, return photos |
| Frontend | **React + TypeScript + Vite + Tailwind CSS + shadcn/ui**, TanStack Query, i18next | Matches the reference design; strong i18n/RTL support |
| Label/PDF output | Server-side HTML→PDF with embedded Vazirmatn/Inter (WeasyPrint or headless Chromium) | Correct Persian shaping and exact mm sizing |
| Tests | pytest, Vitest + Testing Library, Playwright (end-to-end) | |
| Lint/format | ruff, eslint, prettier, pre-commit | |
| Containers | Docker + Docker Compose | Same environment everywhere |

The web app can be installed as a PWA later; native wrappers (Capacitor) remain optional.

## Repository layout (monorepo)
```
/
├─ AGENTS.md  README.md  Makefile  docker-compose.yml  .env.example
├─ backend/        Django project (apps: tenancy, accounts, catalog, pricing, receiving,
│                  approvals, offers, labels, returns, expiry, payables, notes, stock, ai_extraction)
├─ frontend/       React app (src/features/*, src/components/ui, src/i18n)
├─ prototype/      Phase 0 demo (frontend-only; see prototype-brief.md)
├─ infra/          Terraform (AWS), scripts
├─ docs/  seed/  assets/
└─ .github/workflows/  ci.yml  deploy-dev.yml  deploy-staging.yml  deploy-prod.yml
```

## Local development (target experience)
Phase 0.1 provides the Django scaffold, a public health endpoint and dependency
readiness endpoint, a bilingual placeholder web shell, local service containers,
test/lint runners, and pull-request CI. A small bootstrap model stores the seeded
company, branches, and configuration, and a local Django admin supervisor can
inspect it. This is not Phase 1 authentication, permissions, or business tenancy:
no inventory, pricing approval, receiving, returns, or payables API exists yet.
The full company/branch isolation and role tests are required before introducing
those endpoints in Phase 1. The prototype remains a separate Phase 0.2 deliverable.

Prerequisites on Ali's computer: Git, Docker Desktop, a code editor (VS Code). The AI writes exact install steps for his operating system.

`docker-compose.yml` services: `db` (Postgres), `redis`, `s3` (SeaweedFS S3), `api`, `worker`, `web` (Vite dev server), optional `mailpit`.

Make targets (the AI must implement and document them in README):
- `make setup`: create `.env` from `.env.example` only when absent, build images, back up and verify restoration before pending migrations, run migrations, **load `seed/arzon-config.json`**, create a local demo supervisor only when absent. Repeating setup preserves existing configuration files, user passwords, and data. Database configuration is refreshed from the reviewed seed; omitted existing companies/branches are not deleted.
- `make up` / `make down`: start/stop everything. App at `http://localhost:5173`, API docs at `http://localhost:8000/api/docs`.
- `make test`: backend + frontend unit tests, including the pricing test file.
- `make e2e`: Playwright browser tests.
- `make seed-demo`: load demo products/suppliers for manual testing.
- `make lint`, `make reset-db` (asks for confirmation).

Phase 0.1 also provides `make build`, `make e2e`, `make hooks`, `make audit`,
`make logs`, and `make status`. `make seed-demo` and `make reset-db` are deferred
until their business data and safe reset workflow are implemented. `make down`
preserves named data volumes; it does not run `down --volumes`. Docker binds local
ports to the loopback interface, so this scaffold is not exposed to the LAN.
The placeholder is served on port 5173, `/healthz` and `/api/v1/health/` expose API
liveness, and `/readyz` checks PostgreSQL and Redis and returns 503 on failure.
Local plain HTTP is permitted only for loopback development; deployed environments
require HTTPS. The seed confirms Toronto/Ontario, CAD, America/Toronto, and 13% HST
for the first company; exempt products remain exempt. These are editable company
settings, not application constants.

## Environments
| Environment | Purpose | Data | Deploys |
|---|---|---|---|
| local | development | demo data | manual |
| dev | shared testing | demo data | automatic from `main` after CI |
| staging | final checks with realistic data | copy of seed/real-like data | automatic from release tags |
| production | Super Arzon live | real | **only with Ali's explicit approval** |

## CI/CD with GitHub Actions
- On every pull request: install, lint, unit tests, pricing tests, build images, security scan (dependency audit, secret scan). Required checks on `main`.
- On merge to `main`: build and push images, deploy to **dev**.
- On a release tag: deploy to **staging**; production deploy is a manual-approval job.
- Deploy to AWS using **GitHub OIDC** (no stored AWS keys). Enable Dependabot.
- Protect `main`: pull request required, checks required, no force pushes.

For Phase 0.1, CI runs on pull requests and manual dispatch with read-only repository
permissions. It performs local setup, lint, backend/frontend tests, the web build,
service and browser smoke checks, pre-commit checks, and dependency audits. There
are no deployments. Branch protection must be configured in GitHub settings;
adding a workflow does not itself protect `main` or establish a green CI run.

## AWS plan (decide with Ali, with cost estimates first)
Staged path so costs stay low while there is no paying usage:
1. **Local only** until the prototype is approved and Phase 1 is underway.
2. **Dev on a small AWS footprint** (single small container host or minimal managed services) for remote testing.
3. **Production design (suggested, confirm before building):** containers on **ECS Fargate** (api + worker), **RDS PostgreSQL** (Multi-AZ only if justified), **S3** (private, versioned) for files, **CloudFront** + S3 for the web app, **Application Load Balancer** + ACM certificate, **Route 53**, **Secrets Manager**, **CloudWatch** logs/alarms, managed Redis or SQS for jobs.
4. Everything as **Terraform** in `infra/`, reviewed by pull request.
Required before any paid resource: AWS **budget alert**, MFA on the AWS account, a non-root admin identity, a short monthly cost estimate shown to Ali.

## Security and privacy
- HTTPS only; secure, HTTP-only cookies; CSRF protection; rate limiting and lockout on sign-in and PIN attempts.
- PIN login only from registered devices; device tokens revocable by the Supervisor; instant user deactivation.
- Server-side permission checks on every endpoint; company/branch scoping enforced centrally; automated tests for cross-company and cross-branch leakage.
- Uploads: validate type and size, store privately, serve by short-lived signed URL, never trust file names. Add malware scanning before production.
- Secrets only in secret stores. No secrets in logs. Audit log for sensitive actions.
- Backups: automated daily database backups with point-in-time recovery, S3 versioning, a documented and **tested** restore procedure before go-live.
- Customer data (Phase 3): payments via a payment processor only; no card numbers stored; privacy policy and data-deletion process before launch.

## AI invoice reading (provider-agnostic)
- Define an `ExtractionProvider` interface: `extract(file) → JSON per data-model.md`. Implement one provider using a vision-capable language-model API, behind configuration; **do not choose the provider silently**: present options with cost per invoice and ask Ali at the start of that phase.
- Process in a background job; store the raw JSON and the model/prompt version; validate against the schema; mark low-confidence or arithmetic-inconsistent lines `needs_attention`.
- Always require human review before posting. Track cost per invoice. Provide retry and a manual-entry fallback. Never let the model write directly to prices or stock.
- AI category assignment uses the same provider interface and is editable by people.

## Phases 2 and 3 readiness
- Register integration: authenticated endpoint accepting sales batches that create `sale` stock movements; idempotency keys; per-branch API credentials.
- Website: separate module and frontend consuming the same API; customer accounts are a different table and role from employees.

## Observability
Structured logs, request IDs, health endpoints (`/healthz`), error tracking, uptime check, basic dashboards for job failures (especially AI reading and PDF generation).
