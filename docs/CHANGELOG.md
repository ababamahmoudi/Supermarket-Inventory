# Project changelog

## 2026-10-06 — Phase 0.2, part 4: invoice receiving

- Added simulated upload reading, retained fictional originals, editable review/drafts, live pricing, date decisions, lower-price questions, and scoped approvals/alerts.
- Added posting and later short deliveries with immutable stock receipts and conserved tax/cent deductions; duplicate posting and receipt retries cannot double count.
- Added invoice unit tests and desktop/phone end-to-end checks for the 169.79 payable and 3.62/3.61 partial restorations.

## 2026-10-06 — Phase 0.2, part 3: lookup and Products

- Added English/Persian, Product Code, and barcode search with approved branch prices, pending tags, tax profiles, and scoped offers.
- Added filterable, sortable, paginated Products and role-aware details; catalog supplier costs stay Supervisor-only.
- Added scoped catalog unit checks and desktop/phone browser workflows, including direct-route role guards.

## 2026-10-06 — Phase 0.2, part 2: pricing and Settings

- Ported the configuration-driven pricing reference to TypeScript with decimal.js; all shared fixtures and configurable boundary/property checks are covered.
- Added editable pricing divisors and a live Settings sandbox with validation, intermediate values, margin flags, persistence, and Persian translations.
- Added desktop/phone browser checks for editing, invalid inputs, Rice precision, and Reset demo.

## 2026-10-06 — Phase 0.2, part 1: browser demo shell

- Added the standalone `prototype/` React/TypeScript/Vite app and shared design tokens, local fonts, logo, bilingual components, and responsive RTL shell.
- Added fictional role/PIN sign-in, role-specific navigation, branch selection, browser persistence, and Reset demo. This demo does not contact the backend.
- Added prototype lint, unit, build, and desktop/phone browser checks to pull-request CI and pre-commit.
- Run and review instructions are in `prototype/README.md` and `prototype/REVIEW_GUIDE.md`.

## 2026-10-06 — Document decisions and Phase 0.1 foundation

- Confirmed Toronto, Ontario, Canada, CAD, `America/Toronto`, and 13% HST; seeded explicit non-taxable/HST profiles and editable branding.
- Resolved unsafe cancellation: restore only physically present/recovered safe originals; review settled cancellations; keep replacements and money separate. Added the supplier return/shortage policy, signed slip/credit-note requirements, and evidence retention.
- Defined partial shortage receiving/deliveries with quantity caps, idempotent receipts, original tax allocations and conserved rounding remainders.
- Defined Supervisor-only financial posting/reversal, invoice correction impact reviews, capped invoice payment/credit allocation and unapplied credits.
- Restricted Floor Workers to own/assigned invoice costs, hiding margins and catalog costs. Scoped supplier cost comparisons by branch; explicit no-stock/not-tracked/unknown answers prevent blocked receiving.
- Defined all-branch price previews/archive of every override, one effective branch offer, price compatibility and company/branch/currency-scoped mix-and-match pools.
- Made pricing band thresholds/endings/corrections explicit configuration data and margin flags category-specific. Added exact `.73` and Rice exact/just-above `.99` four-decimal fixtures (24 pricing cases).
- Clarified unchanged-price costs: no approval for ordinary changes without a margin breach; below-margin results still receive deduplicated Supervisor review without blocking receiving or changing the approved cashier price.
- Separated Step 0.1 setup/placeholder/bootstrap records from Step 0.2 demo and Phase 1 operational business features. Added reusable development tooling and pull-request CI; see the root `CHANGELOG.md` and README for implementation/verification details.
