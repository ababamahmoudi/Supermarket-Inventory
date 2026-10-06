# Build plan and acceptance checklist

Build in small slices. After each slice the app must run, tests must pass, and Ali must be able to click through the result. Do not start a slice until the previous one's exit criteria are met.

## Phase 0: Prototype and setup
| Step | Deliverable | Exit criteria |
|---|---|---|
| 0.1 Repo and local setup | Monorepo skeleton; Docker Compose for API/web/Postgres/Redis/local S3/worker; Makefile; fake `.env.example`; linting, test runners and pre-commit; pull-request CI; README quick-start; bootstrap configuration and demo supervisor | `make setup`, `make up`, `make down`, `make test`, and `make lint` pass; placeholder page at `http://localhost:5173`; API liveness/readiness pass; all reference pricing fixtures pass; pull-request CI green; Ali follows the OS-specific quick-start |
| 0.2 Prototype | Frontend-only demo per `prototype-brief.md` | Ali can run the demo script end to end; pricing tests pass in TypeScript |
| 0.3 Demo hosting | Prototype reachable by link (or run locally for a meeting) | Ali approves the demo |

Step 0.1 establishes tooling and an English/Persian placeholder shell, not the operational app. Its bootstrap company/branch/configuration records and development supervisor support repeatable setup. Full company/branch permission enforcement, device/PIN authentication, audit trails, business settings tables, and business workflows remain Phase 1. The clickable demo is Step 0.2; a health endpoint is not evidence that these workflows exist. No AWS resources or automatic deployment are part of Step 0.1.

## Phase 1: Core app
| Slice | Content | Exit criteria |
|---|---|---|
| 1 Foundation | Company/branch tenancy, users, roles, device registration, PIN + password sign-in, idle lock, audit log, settings, i18n (EN/FA, RTL), app shell in the design language, seed loader | Role menus correct; cross-company/branch isolation tests pass; seed loads idempotently |
| 2 Catalog and pricing | Products, codes, barcodes, suppliers, supplier products, branch-specific receipt costs, numeric pricing rules from config, pricing engine, price/pending display, cashier lookup, AI category field | Every seed pricing case passes; configuration edits change results; lookup shows pending/taxable/offer correctly |
| 3 Invoices (manual) | Drafts, header and lines, file upload, branch, supplier proposal/confirmation, posting, stock ledger, supplier ledger entry, system-assigned invoice numbers | Posting rules enforced; stock and ledger correct; drafts survive reloads |
| 4 Approvals and alerts | Price proposals, approvals queue (scope all/this branch), new products, barcode conflicts, same-supplier lower-price flow, other-supplier alert, cross-branch conflict, tax discrepancy | Each workflow in `workflows.md` has an automated test |
| 5 AI reading | Provider interface, background job, extraction JSON, review screen, failure fallback, AI categories | Sample invoices produce reviewable lines; failures never block manual entry |
| 6 Offers and labels | Offer definitions, suggestions, mix-and-match pools, label templates, A4 slot printing with Persian text | Test PDF prints correctly at exact mm size from a chosen start slot |
| 7 Shorts and returns | Partial short deliveries, quantity/tax allocations, returns/pickup evidence, covered original quantities, safe original recovery, claims/settlement review, history; staff policy in `return-policy.md` | State diagrams enforced; stock/payable effects idempotent and capped; paperwork and cancellation do not create fictitious stock/credits |
| 8 Date tracking | Prompts per category, entries, expiring soon list, Cleared | Rice and Kitchenware never prompt; Grocery does |
| 9 Payables | Branch/supplier ledger, invoice allocations, unapplied credits, payments, credits, linked reversals, adjustments, opening balance, disputes, month-end summary/CSV | Ledger and per-invoice outstanding amounts reconcile; Floor Workers cannot reach payables/margins/catalog costs (tested) |
| 10 Notes, stock, dashboard | To order, store use, supervisor notes, stock counts, supervisor dashboard and worker home | Dashboard order matches requirements |
| 11 Hardening | Performance, accessibility pass, backups and restore test, error tracking, security review, load test with realistic data | Checklist below fully passes |
| 12 Staging and go-live | Staging environment, data import (products, suppliers, opening balances), training notes, production deploy | Ali's explicit go-live approval |

## Later phases
Phase 2: register integration. Phase 3: website with food ordering. Plan separately; do not build now.

## Acceptance checklist (each item becomes an automated or scripted manual test)
**Pricing**
- [ ] All cases in `seed/pricing-test-cases.json` pass.
- [ ] Changing a divisor/band in settings changes results with no code change.
- [ ] Displayed selling price never includes tax; taxable products show a Taxable tag.
- [ ] An ordinary cost change with unchanged selling price and no margin breach creates no approval.
- [ ] Grocery cost 1.12 / approved price 1.49 produces a deduplicated below-25% margin review despite unchanged calculated price; posting continues, cashier price stays 1.49, and Supervisor can keep with a reason or propose an override. Retries/same context reuse review; changed cost/price/rules re-evaluate it.

**Approvals and prices**
- [ ] A changed calculated price creates a Pending proposal; cashier lookup still shows the last approved price with a pending tag.
- [ ] A new product appears as Pending approval; barcode conflict blocks and creates an approval.
- [ ] Approving with "This branch only" does not change other branches; "All branches" does.
- [ ] All-branch approval previews and archives every active product override in that company; stale previews cannot approve changed records.
- [ ] Two branches with different prices raise a conflict alert; "Mark as intentional" silences it until a price changes.

**Invoices**
- [ ] A draft saves without an image and cannot be posted until the original is attached.
- [ ] A proposed supplier blocks posting until the Supervisor confirms it.
- [ ] Missing supplier invoice number is auto-assigned per supplier and marked system-assigned.
- [ ] Posting creates correct stock movements and supplier-ledger entry; a posted invoice is locked.
- [ ] Subtotal + tax ≠ total raises a tax discrepancy alert without blocking.
- [ ] Supervisor correction/void preserves originals and appends compensations; consumed stock and allocations are reviewed; duplicate requests cannot post twice.

**Same-supplier lower price**
- [ ] A lower cost from the same supplier asks the worker the expiry questions and creates a Supervisor alert with their answers; the Supervisor can mark Taken care of / Still pending.
- [ ] The same item from a different supplier is registered under that supplier and raises an alert.
- [ ] Cost comparisons use posted, non-voided receipts in the same branch; no-stock/not-tracked/unknown answers permit posting with the required alert/note.

**Shorts**
- [ ] Marking 4 of 12 units Short adds the 8 delivered units and deducts only the missing 4 units' cost/tax.
- [ ] Multiple later deliveries add only actual received quantities and restore proportional withheld amounts, conserving tax pennies; overdelivery/duplicate posting is blocked.
- [ ] Supervisor Not delivered closure keeps the remaining deduction without adding another credit.

**Returns**
- [ ] Selecting a supplier immediately shows its open returns.
- [ ] Pickup requires the representative's typed name, actual quantities, and signed paper slip scan/reference; item photo is optional; pickup works with no purchase invoice.
- [ ] A return with several lines can be resolved once; a credit is linked to one invoice only.
- [ ] Replacement received adds stock, records details, and never changes Payables; partial replacement keeps the return open.
- [ ] Cancellation restores no stock by itself; only physically present/recovered originals confirmed safe and sellable add stock, once and within quantity limits.
- [ ] Settlement cancellation is reviewed by Supervisor; replacements and credits are not automatically erased/reversed. Worker claims cannot post financial credits or expose balances.

**Offers and labels**
- [ ] A product at 1.99/2.99/3.99 with no offer creates a worker suggestion; a product never has two active offers.
- [ ] Mix-and-match combines any products in the same pool across categories and suppliers.
- [ ] Effective offers use branch-over-company precedence and match approved price; unmapped price changes stop old offers. Pools never cross companies/branches/currencies.
- [ ] A label shows name, description, price, offer, product code, logo, unit size, tax indicator, in English and Persian; no barcode; no promotion expiry.
- [ ] Labels print at exact template size on A4, starting at the chosen slot; there is no label queue and no default template.

**Date tracking**
- [ ] Grocery and Grocery (Taxable) prompt; Rice and Kitchenware do not; AI lines require reviewer confirmation.
- [ ] Items within 30 days show as expiring soon (setting); Cleared removes them from the list.

**Payables and permissions**
- [ ] Supervisor can record invoices, credits, payments (cheque number, date, partial), adjustments, opening balance, disputes.
- [ ] Allocations are capped and scoped to company/branch/supplier/currency; outstanding invoices and unapplied amounts reconcile to the ledger; reversals preserve history.
- [ ] Floor Worker and Cashier cannot see balances anywhere (UI and API).
- [ ] Floor Workers see unit costs only on their own/assigned invoices and never margins or catalog supplier costs.
- [ ] Cashier can only look up products; direct API calls to other endpoints are refused.

**Sessions and platform**
- [ ] PIN works only on a registered device; idle lock engages; approvals re-prompt for the password.
- [ ] Every action in the audit log shows the signed-in user.
- [ ] Layout is correct in English and Persian (RTL), on desktop and phone widths.
- [ ] Cross-company and cross-branch data access tests pass.

**Operations**
- [ ] `make setup && make up && make test` works from a clean machine.
- [ ] CI blocks merges that fail; a restore from backup has been demonstrated; no secrets in the repository.
