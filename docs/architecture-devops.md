# Architecture and DevOps

Goal: one repository, one command to run everything locally, automated tests on every change, and a clear path to AWS. Ali is not a programmer, so everything must be scripted and explained.

## Recommended stack (change only with a recorded decision in `docs/decisions.md`)
| Layer | Choice | Why |
|---|---|---|
| Backend API | **Python 3.12, Django + Django REST Framework**, OpenAPI schema generated automatically | Mature, strong admin tooling, excellent for data-heavy business apps, AI tools write it reliably |
| Database | **PostgreSQL 16** | Transactions, constraints, JSON where needed |
| Background jobs | **Celery** workers (Redis broker locally; managed Redis or SQS in AWS) | AI invoice reading, PDF generation, exports |
| File storage | **S3-compatible** (MinIO locally, S3 in AWS), private bucket, signed URLs | Invoice originals, return photos |
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
Prerequisites on Ali's computer: Git, Docker Desktop, a code editor (VS Code). The AI writes exact install steps for his operating system.

`docker-compose.yml` services: `db` (Postgres), `redis`, `minio` (S3), `api`, `worker`, `web` (Vite dev server), optional `mailpit`.

Make targets (the AI must implement and document them in README):
- `make setup`: copy `.env.example` to `.env`, build images, run migrations, **load `seed/arzon-config.json`**, create a demo supervisor.
- `make up` / `make down`: start/stop everything. App at `http://localhost:5173`, API docs at `http://localhost:8000/api/docs`.
- `make test`: backend + frontend unit tests, including the pricing test file.
- `make e2e`: Playwright browser tests.
- `make seed-demo`: load demo products/suppliers for manual testing.
- `make lint`, `make reset-db` (asks for confirmation).

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

## AWS plan (decide with Ali, with cost estimates first)
Staged path so costs stay low while there is no paying usage:
1. **Local only** until the prototype is approved and Phase 1 is underway.
2. **Dev on a small AWS footprint** (single small container host or minimal managed services) for remote testing.
3. **Production design (suggested, confirm before building):** containers on **ECS Fargate** (api + worker), **RDS PostgreSQL** (Multi-AZ only if justified), **S3** (private, versioned) for files, **CloudFront** + S3 for the web app, **Application Load Balancer** + ACM certificate, **Route 53**, **Secrets Manager**, **CloudWatch** logs/alarms, managed Redis or SQS for jobs.
4. Everything as **Terraform** in `infra/`, reviewed by pull request.
Required before any paid resource: AWS **budget alert**, MFA on the AWS account, a non-root admin identity, a short monthly cost estimate shown to Ali.

## Security and privacy
- HTTPS only; secure, HTTP-only cookies; CSRF protection; rate limiting and account lockout on failed sign-ins.
- Accounts are created only by the Supervisor (no self-registration); temporary passwords force a change at first sign-in; passwords hashed with a modern algorithm (Argon2 or Django's default), checked against common/breached lists; no PINs.
- Each company is served on its own subdomain; usernames are unique per company. Registered-device tokens (for the recent-users list) are revocable by the Supervisor; instant user deactivation.
- Later, not now: invite-only Google sign-in (OpenID Connect, matched to emails the Supervisor added) and authenticator-app second step for Supervisors.
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
