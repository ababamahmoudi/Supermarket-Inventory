# Project changelog

## 2026-10-08 — Pull request B: labels, notebooks, Settings, History and manual entry

- Recorded Ali's A2 approval and authorization to build A2 leftovers, Prompt 3C items 26–29 with revised 40–43, and manual-entry items 44–47 together in B. Deferred item 30's AI presentation to Prompt 3D with real AI; the CI fix remains a separate tightly scoped pull request.
- Updated requirements/roles, Suppliers/Products/Invoices screens and workflows before manual-entry code: Supervisor Confirmed suppliers and Active products, worker invoice-only proposals, confirmation posting gate, shared forms, similar-name links, barcode blocks and preserved deactivation history.
- Defined branch/as-of Opening balance ledger entries, branch Opening count stock movements, nonreused Product Codes, unchanged Decimal pricing/manual override/minimum-margin confirmation and original-required manual posting with attachment-free drafts.
- Aligned the B plan, brief, data model, acceptance checklist and design rules for 44px complete-text toolbars, one-line short values, invoice columns, chart hover/date labels, return actions, legible label logos, shared table/back styling, i18n plurals and Demo-only disclaimers.
- Preserved the exact 13 Settings groups and working subset, notebook permissions, exact millimeter label printing and independent five-second corner Undo rules. Implemented the approved B workflows, safe History/Revert and independent corner Undo. The [B review guide](PR_B_REVIEW.md) records executed checks, exact Ubuntu commands and screenshots.

## 2026-10-08 — Phase 0.2 pull request A2: implementation and review proof

- Implemented shared centered dialogs, table alignment, compact filters, fitting custom selects, Persian isolation, source copy and formatting corrections across existing screens.
- Added the shared Supervisor product editor and dedicated product page with scoped manual-price provenance and reversible records; compact invoice receiving requires an explicit date choice per line and creates source-linked approvals only when posting.
- Added the Returns overview/detail and active Suppliers overview/tabbed pages, with financial fields removed from Floor Worker views. Offers/Payables filters and dashboard purchase, low-stock and price-change content use scoped recorded data.
- Added twelve fictional historical invoices, matching invoice/payment ledger rows and believable branch stock in `prototype/src/fixtures/a2-demo-data.json`; kept owner seed files unchanged and verified additive browser-state backup/restore.
- Fixed label saving without `crypto.randomUUID`, precise template errors and physical label containment. Fixed phone invoice label positioning so normal Save as draft clicks and page widths work.
- Added a reproducible 156-image gallery (39 states in English light, English dark, Persian and phone), an Ubuntu click-by-click guide and executed validation in `docs/DESIGN_A2_REVIEW.md`.
- Updated B's label designer, notebooks, Settings and five-second corner Undo plan only; B implementation waits for Ali's review.

## 2026-10-07 — Phase 0.2 pull request A2: specification-first corrections

- Defined the Supervisor-only shared product editor, manual-price scope/provenance and reversible audit records before implementation; History UI remains B.
- Specified the Returns overview/page, active Suppliers moment 14, recorded-purchase charts, low-stock/recent-price lists, Offers/Payables filters, shared table alignment proof and centered accessible dialogs.
- Required explicit date-tracking Yes/No on every invoice line, posting-only invoice approvals, two-decimal cost display with four-decimal computation, and coherent historical invoice/stock/payable fixtures with return creation metadata.
- Authorized prototype-only fictional data files, superseding A's snapshot-only balances while preserving the owner seed files and existing operational/money rules.
- Updated B planning only: live label-template A4 preview/search, Supervisor notebook create/edit/archive, exact Settings groups/working subset, five-second hover-paused stacked corner Undo toasts. No B feature implementation is authorized in A2.
- Recorded navigation omissions and the implementation/review boundary in `docs/REVIEW_B_PLAN.md` and Decision 014. Executed implementation/test/screenshot results belong in the final A2 review report; this entry records specification changes only.

## 2026-10-07 — Phase 0.2 pull request A: design and language fixes

- Integrated the owner's updated main-branch documents and seed into the earlier redesign branch; A is stacked on that branch and changes only prototype/docs.
- Applied styled controls, shared segmented tabs/spacing, bounded fields, visible striped-row actions, dark-theme button contrast, sticky top bar, and centered dialogs across every existing screen.
- Refined sidebar/top-bar details, compact lookup, invoice tabs/drafts layout, return numbering/actions, approval context/scope, dashboard balances, Payables overview, and adjacent Settings tester values.
- Centralized symbol-first money, YYYY-MM-DD dates, offers, translated branch/demo-user labels, current-language product names, and isolated mixed-direction fragments.
- Loaded Supervisor-only supplier-balance demo snapshots separately from the ledger, reconciled the original Fresh Valley invoice to avoid double counting, and restored the configured 25% minimum-margin defaults while preserving explicit saved custom edits.
- Added balance/migration and all-screen presentation regressions, a reproducible 23-state/four-variant screenshot capture, and current Ubuntu instructions in `docs/DESIGN_POLISH_REVIEW.md`. Final executed results are recorded there.
- Paused B's new labels, notebooks, grouped Settings, History/Undo, and simulated-reading enhancements pending A approval. Suppliers/History page destinations remain unbuilt. Missing source return dates/authors are displayed as missing rather than invented.

## 2026-10-07 — Phase 0.2 redesign PR1: shell and four screens

- Applied design language v2 to shared shell/controls, sign-in, Supervisor dashboard, Cashier lookup, and invoice review, with light/dark themes, comfortable text, responsive layouts, and Persian RTL.
- Replaced role/PIN sign-in with fictional username/password accounts, recent-user chips, password-based locks, and a forced first-sign-in password change; role switching and business reset live in the Demo menu.
- Retained operational workflows and compatible CAD/HST/Toronto, physical-quantity, returns, and ledger metadata while leaving the owner's seed files unchanged and giving current values precedence.
- Added account/control/layout and working-action checks; updated Ubuntu instructions, click flows, and the screenshot matrix in `docs/REDESIGN_REVIEW.md`. Actual results belong to the PR validation report.
- Deferred Suppliers overview/detail and remaining page redesigns to PR2 after Ali approves PR1.

## 2026-10-06 — Phase 0.2, part 7: operations and dashboard

- Completed returns with signed pickup/replacement evidence, partial settlement, reviewed cancellations, safe-original dispositions and Supervisor-only financial claims.
- Added expiry clearing/history, three Notes tabs with stock-use accounting and unread reviews, supplier Payables with partial external payments, cheque references, allocations, CSV and printable month-end summaries.
- Added the 15 configured dashboard priorities, scoped bilingual activity, company-timezone business dates and responsive stat cards.
- Added meaningful operations unit and desktop/phone browser checks, including invalid-action rollback, supplier-held stock, replacement-versus-money separation and historical month boundaries.
- Embedded the logo in the browser bundle and added all-screen offline checks in both languages, avoiding image revalidation requests when pages remount offline.
- Added redacted CI setup failure annotations while preserving the original failing command's exit status.
- Updated all prototype review/run documentation and the root README to distinguish the complete browser demo from the production backend roadmap.

## 2026-10-06 — Phase 0.2, part 6: bilingual labels

- Added saved user-created templates, A4 geometry validation, copies, starting-slot offsets and multipage layout without preselected templates.
- Added compact bilingual logo/name/price/offer/code/unit/tax labels using only the selected branch's approved prices.
- Added used-slot previews and print layout that preserves separate A4 sheets, with unit and desktop/phone browser checks.

## 2026-10-06 — Phase 0.2, part 5: approvals, alerts and offers

- Added scoped product/price approval previews, all-branch override clearing, margin review acknowledgement, and deliberate branch-price conflict decisions.
- Added approval-linked offer tasks, confirmation, scoped price-compatible offers, and mix-and-match pools with bilingual controls/history.
- Added cross-module invoice-to-approval-to-offer tests and desktop/phone workflows preserving approved cashier prices until confirmation.
- Made store transactions validate synchronously and publish atomically; exact Product Code matches take priority over barcode substrings.

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
