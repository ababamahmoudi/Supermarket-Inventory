# Changelog

## 2026-10-06 — Phase 0.1 foundation

- Confirmed Toronto/Ontario, CAD, America/Toronto, and 13% HST company settings.
- Resolved the document review findings; added staff return/shortage policy and
  dated decisions. Signed supplier evidence, actual physical quantities, scoped
  offers/costs, and Supervisor-only financial corrections are Phase 1 requirements.
- Added Django/DRF/Celery scaffolding, PostgreSQL bootstrap models/migrations,
  public health and dependency readiness, offline API documentation, and an
  idempotent development seed/supervisor loader.
- Added a responsive English/Persian React placeholder, RTL, local fonts,
  configured branding, real API connection status, and component/browser tests.
- Added Docker Compose, development commands, exact/hash-verified dependency
  locks, lint/format checks, pre-commit hooks, PR-only CI, and Windows/macOS guides.
- Added verified backup restoration before pending migrations and volume-safe stop.
- Replaced unavailable, unmaintained MinIO community images with digest-pinned
  SeaweedFS 4.48 for private local S3; production remains AWS S3.
- Expanded configuration-driven reference pricing fixtures from 21 to 24 cases.

Full business decisions and future workflow rules are in `docs/CHANGELOG.md` and
`docs/decisions.md`. The clickable prototype and operational features are not built.
No cloud resources were created and no deployment or merge is included.

Validation on the Linux cloud host: 58 backend tests (including all 24 pricing
cases), 5 component tests, and 3 Playwright browser tests passed. All five required
Make targets, web build, lint, pre-commit, runtime audits, authenticated S3 smoke,
Redis outage/readiness handling, populated backup restore, and record-preserving
stop/restart passed. See the pull request's Checks tab for GitHub-hosted CI results;
Ali's own computer remains unverified.
