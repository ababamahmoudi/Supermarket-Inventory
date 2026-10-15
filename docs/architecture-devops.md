# Architecture and DevOps

Goal: one repository, one command to run everything locally, automated tests on every change, and a clear path to AWS. Ali is not a programmer, so everything must be scripted and explained.

## Recommended stack (change only with a recorded decision in `docs/decisions.md`)

| Layer            | Choice                                                                                  | Why                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Backend API      | **Python 3.12, Django + Django REST Framework**, OpenAPI schema generated automatically | Mature, strong admin tooling, excellent for data-heavy business apps, AI tools write it reliably |
| Database         | **PostgreSQL 16**                                                                       | Transactions, constraints, JSON where needed                                                     |
| Background jobs  | **Celery** workers (Redis broker locally; managed Redis or SQS in AWS)                  | AI invoice reading, PDF generation, exports                                                      |
| File storage     | **S3-compatible** (MinIO locally, S3 in AWS), private bucket, signed URLs               | Invoice originals, return photos                                                                 |
| Frontend         | **React + TypeScript + Vite + Tailwind CSS + shadcn/ui**, TanStack Query, i18next       | Matches the reference design; strong i18n/RTL support                                            |
| Label/PDF output | Server-side HTML→PDF with embedded Vazirmatn/Inter (WeasyPrint or headless Chromium)    | Correct Persian shaping and exact mm sizing                                                      |
| Tests            | pytest, Vitest + Testing Library, Playwright (end-to-end)                               |                                                                                                  |
| Lint/format      | ruff, eslint, prettier, pre-commit                                                      |                                                                                                  |
| Containers       | Docker + Docker Compose                                                                 | Same environment everywhere                                                                      |

The web app can be installed as a PWA later; native wrappers (Capacitor) remain optional.

## Repository layout (monorepo)

```
/
├─ AGENTS.md  README.md  Makefile  docker-compose.yml  .env.example
├─ backend/        Django project (apps: tenancy, accounts, catalog, pricing, receiving,
│                  approvals, offers, labels, returns, expiry, payables, notes, receiving-log, orders, branch-requests, ai_extraction; inventory later)
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

| Environment | Purpose                          | Data                        | Deploys                               |
| ----------- | -------------------------------- | --------------------------- | ------------------------------------- |
| local       | development                      | demo data                   | manual                                |
| dev         | shared testing                   | demo data                   | automatic from `main` after CI        |
| staging     | final checks with realistic data | copy of seed/real-like data | automatic from release tags           |
| production  | Super Arzon live                 | real                        | **only with Ali's explicit approval** |

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
- Accounts are created only by Owner/Manager (the platform creates the first Owner; no self-registration); one-time setup codes force personal password choice at first sign-in; passwords hashed with a modern algorithm (Argon2 or Django's default), checked against common/breached lists; no PINs.
- Each company is served on its own subdomain; usernames are unique per company. Registered-device tokens (for the recent-users list) are revocable by the Owner/Manager; instant user deactivation.
- Later: invite-only Google sign-in (OpenID Connect, matched to invited emails) and real passkey/authenticator verification. E1 demonstrates mandatory privileged second-step setup/challenge locally, explicitly simulated.
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

## Later paid inventory and website readiness

- Inventory is a **separate paid later phase**, requiring cash-register sales; Phase 1 has no stock projection/count UI. Retain company/location-scoped physical receipt/return/transfer events and immutable correction references. Future register integration uses authenticated sales batches, `sale` events, idempotency keys and per-location API credentials; enabling inventory must be planned/priced separately.
- Website: separate module and frontend consuming the same API; customer accounts are a different table and role from employees.

## Observability

Structured logs, request IDs, health endpoints (`/healthz`), error tracking, uptime check, basic dashboards for job failures (especially AI reading and PDF generation).

## C receiving architecture boundaries

Location type is configured (`store`/`warehouse`), with no Cashier assignment/access at a warehouse. Keep stable branch keys and company scoping. An unposted invoice has a reviewer-origin assignment distinct from its receiving location, allowing that reviewer to retarget the invoice without granting general access to another location. Posted location corrections are append-only, with effective-location projections and paired conserved outstanding-liability adjustments; original source/allocations remain immutable.

Orders and Branch requests are separate audited domain records, never fabricated invoices or stock balances. Order receipt/reconciliation is idempotent; case/unit normalization uses retained packs and Decimal arithmetic. Short-dated receipts retain discounted actual costs and expiry evidence separately from regular pricing basis. Phase 0 demonstrates these transactions in its scoped browser store; Phase 1 API must enforce role/endpoint/location/company permissions server-side. No backend/API/schema change is part of C's file scope.

## C3/C4 prototype architecture boundary

C3/C4 remain frontend-only; changes are limited to prototype/, docs/ and seed/ fictional demo/config/pricing cases. Per-company/user table/navigation preferences live in browser storage. Undo uses record-scoped validated inverses and append-only request transfer corrections; no legal/financial Undo. Selling-location config excludes non-selling Warehouse from price/offer effects without altering receiving access/history.

C4 retains original file bytes in browser persistence and previews matching fictional images/actual PDF pages. Posted invoice content corrections append immutable effective versions and compensating references, preserving original invoice/file/payment/allocation/physical evidence. New item order association happens only through explicitly linked reviewed posted lines. Weight quantities retain source kg/lb units and Decimal canonical lb cost; product date preferences/manual entries have scoped audited transitions.

Pickup expected return credits are provisional Owner/Manager-only balance projections, distinct from confirmed supplier ledger credits; worker pickup never grants financial-posting privilege. Actual settlement/written off needs authorized evidence. Replacement releases its expected projection according to the owner's answer, without a new purchase/credit posting. Phase 1 must enforce these transactions server-side; no backend/schema implementation or paid deployment is authorized here.

## C5 presentation boundary

C5 changes prototype/ and docs/ only, after green history-preserving C3/C4 merges. Shared controls enforce intrinsic12 px/40 px text actions, circular icon widgets and visible bordered fields in both themes. New inline date operations reuse scoped validated audits/Undo; identical current offers reuse their existing record and historical versions remain retained. Seed/pricing/backend/CI configuration and protected money/original evidence are unchanged. Browser proof uses the fresh compiled source, actual computed dimensions and unedited UI screenshots; physical printer calibration remains separate.

## E1 authority and future-server boundary

The current source specification defines five configured roles and a private company-scoped Person/credential/session/device authority repository; implementation remains Planned. Async protected Store.command/query reads current actor/setup/epoch and latest persisted business within the same IndexedDB boundary, commits before React and invokes the same central capability/resource/field evaluator as the UI. Domain APIs derive canonical resource scope, not caller role/branch claims. People safety/version/usable Active Owner checks and revocations commit together; usable means Active with complete password and required second-step setup, while promoted Floor Worker stays Invited until setup completes. Shared-browser invalidation and safe protected authorityHistory projection occur after commit; missed messages cannot authorise later operations.

Credentials/challenges stay separate from ordinary business state, exports and History. Normal verified auth migration preserves legacy identities/passwords/forced setup/preferences; reset alone restores six demo fixtures and the configured fictional computer. Browser-local data is not tamper-proof production authentication or synchronized phone data. Future /api/v1 endpoints resolve an actor from an authenticated server session and use database transactions with these same independent role/field/domain rules. No backend/hosted database/resource/deployment change is authorised here.

### Repository-minted system reconciliation

Clock and derived-event jobs require a private runtime witness minted only inside the synchronous company-scoped repository transaction, bound to the exact current draft, source and directory version. Plain/spread/foreign-draft/wrong-source or retained-after-callback objects fail. No public mint, fabricated Manager, asynchronous side effect or authority fallback is permitted. User decisions still require a current authenticated actor.

## E1 damaged legacy History recovery

A healthy existing canonical IndexedDB business record takes precedence over any retired legacy text. Do not read a stale legacy dictionary, falsely quarantine healthy data, recreate people, reset a password, or replace existing company business records during normal startup.

When the company has no canonical business record and its retained legacy History dictionary is invalid, retain that exact legacy string. Before creating a separate fictional quarantine demo, save its exact UTF-8 bytes as a company/storage-key/SHA256 addressed FileDB backup; wait for the write transaction, read it back and verify both exact text and hash. If this verification fails, startup remains blocked, the original text/file bytes stay retained, and no usable business view or fabricated authentication is published. This is not a completed migration or recovery of the damaged business data.

After successful verification, persist a private canonical recovery marker containing only its schema, legacy source key, original digest, verified backup reference and phase. The quarantined business is explicitly a separate fictional demo. Normal sign-in/setup and protected queries/commands use the genuine current company directory, credentials, sessions and capabilities. Existing people, passwords and sessions are preserved. Valid demo edits may persist in the separate canonical quarantine demo; they never overwrite the unreadable legacy string. Reload retains both the private marker and the visible recovery notice. Public business projections contain neither that marker, the raw damaged history nor credential data.

Only an explicitly confirmed, fresh authorized `demo.reset` command can replace the canonical demo and six configured people. Reverify the exact original backup and any remaining legacy source before that transaction. A backup/check/authority/canonical-transaction rejection leaves the current canonical data, directory, original text and recovery notice unchanged. Keep all immutable files and backups.

Canonical Reset and legacy localStorage retirement are different storage transactions. After a successful canonical Reset, persist the `reset_committed` recovery phase until a current authorized command verifies the backup again, retires only the matching old legacy source and clears the marker. Failure in retirement is a **committed Reset with retirement pending**, not a rejected Reset or a silent completed recovery. Retain the original backup and explicit notice; the old text also remains whenever removal did not succeed. A partial retirement can have removed the old text before the marker write failed; its exact verified backup remains and the notice persists. Retry only this already-authorized retirement after a genuine allowed session resumes or signs in, without resetting business or people again. Never remove changed/unverified legacy text.

Recovery notice (English): **Saved history could not be read. Your original data is retained. You are using a separate fictional demo. Allow browser storage, then reload, or choose Reset demo.**

Recovery notice (Persian): **سابقهٔ ذخیره‌شده خوانده نشد. اطلاعات اصلی شما نگه داشته شده است. اکنون از یک دموی ساختگی جداگانه استفاده می‌کنید. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید، یا بازنشانی دمو را انتخاب کنید.**

Committed Reset with retirement pending (English): **Demo reset is complete. Your original history is backed up, but its old browser copy could not be retired. Allow browser storage, then reload.**

Committed Reset with retirement pending (Persian): **بازنشانی دمو کامل شده است. از سابقهٔ اصلی شما نسخهٔ پشتیبان گرفته شده، اما نسخهٔ قدیمی آن در مرورگر پاک‌سازی نشد. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید.**

Specification first; implementation and tests require separate actual-source evidence. No service, account, deployment, or recovery of unreadable financial/physical evidence is implied.

### E1 durable publication and failed legacy file import

The canonical company `business` IndexedDB transaction is E1's durable business publication. Retired legacy `supermarket-prototype-v1` text remains original evidence; normal commands do not rewrite it or publish a second live state there. Browser migration checks observe the real canonical commit and verify exact retained source/backup/file bytes. Decoded canonical History still supports lossless dictionary encode/decode and its genuine guarded Revert.

A valid legacy file import whose original backup cannot be saved and read back stays blocked before canonical business initialization and before protected rendering. Do not display a protected original through a fabricated session or report migration success. Show the actual storage failure, retain the exact original file/source/backups and leave the canonical company business record absent. This is separate from the verified damaged-History quarantine described above.

### Verified quarantine notice boundary

Show the separate fictional-demo notice only after its private marker is present in the actual committed canonical business record. A prepared import is insufficient: a failed canonical write remains blocked, and a concurrent healthy initialization takes precedence. Failed backup metadata/integrity verification reuses the existing blocked-History notice: **Saved history could not be read. Your original data is retained. Allow browser storage, then reload.** / **سابقهٔ ذخیره‌شده خوانده نشد. اطلاعات اصلی شما نگه داشته شده است. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید.** Do not claim a usable fictional quarantine, completed migration, or recovered original data after a failed verification.

### Same-company original-source gate

Before expanding any legacy History dictionary, saving a FileDB backup, or initializing canonical business/authority, valid legacy JSON must explicitly declare version 1 and the actual configured company in `config.company.seed_key`. Missing, malformed or mismatching ownership metadata stays blocked with its original text unchanged; do not archive a foreign company's source under the current company or manufacture a usable quarantine from it. The direct quarantine helper repeats the same gate before any file I/O, and Reset rechecks ownership in the verified original backup. Healthy existing canonical business continues to ignore stale legacy text, including another company's damaged dictionary. This gate never substitutes a default company for missing source metadata or changes genuine existing directory credentials.

## E2 derivation and migration boundary

Derive tasks and personal events from the same protected canonical transaction as public selling-term changes, with private repository-minted System witnesses for clock work. Preserve public source attribution and exact Decimal unit terms without carrying private cost/margin or authority snapshots into task/notification DTOs. Current-source/protected-query checks apply to command, bulk operation, print preparation, badge and linked bell record.

An additive E2 upgrade must durably save, read back and hash-verify the exact pre-upgrade canonical business source before publishing new schema/checkpoint fields. Preserve all files, financial/physical records, credentials and custom settings. Initial effective baseline creates no historical task backlog. Clock reconciliation and task/reminder identities are idempotent. No API/register connection/push/email/background service is added; the future server implements these same transaction/capability rules under its own authenticated session.

## E3 public application shell and cache boundary

The browser prototype now adds installability without changing the future authenticated API architecture. Manifest/icon/standalone configuration uses company branding; each phone/browser/origin retains its separate local data. HTTPS and Access gate delivery but do not make prototype role/session storage production server authentication or synchronized data.

Service worker installation consumes a build-generated exact public file allowlist, including actual hashed JavaScript/module-worker `.mjs`, CSS, fonts and branded static/offline assets. Cache only successful same-origin nonredirected responses with expected content types. Refuse navigation HTML, Access/login pages even under asset paths, API/private JSON, authority/session data and uploaded/original document paths. No blanket cache-first routing, HTML app-shell fallback or business response cache. Offline navigation uses the dedicated No connection page; already-open local business data is not remote offline authority.

Waiting releases use explicit safe activation with real work leases at controller/runtime/file/migration/print boundaries and unsaved form/dialog/selection state. Check readiness immediately before skipWaiting/reload; retain old static release assets for open tabs and all canonical browser data. Never infer idle from an empty UI placeholder while a real promise is pending. No backend/deployment/resource change is authorized by this stage. Cloudflare deployment is documented only, with separate production/preview Access applications and verified anonymous denial before uploading fictional build content.
