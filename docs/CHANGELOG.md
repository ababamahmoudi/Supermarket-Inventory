# Project changelog

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
