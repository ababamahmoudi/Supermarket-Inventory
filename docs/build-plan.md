# Build plan and acceptance checklist

Build in small slices. After each slice the app must run, tests must pass, and Ali must be able to click through the result. Do not start a slice until the previous one's exit criteria are met.

## Phase 0: Prototype and setup

| Step                     | Deliverable                                                                                                                                                                                                                                               | Exit criteria                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0.1 Repo and local setup | Monorepo skeleton, Docker Compose, Makefile, CI running on an empty project, README quick-start                                                                                                                                                           | `make setup && make up` works on Ali's computer; CI green                |
| 0.2 Prototype            | Frontend-only demo per `prototype-brief.md`, including design fixes, label waitlist/real printing, notebooks, grouped Settings, History/Undo, Supervisor manual entry, Received, locations/manual prices/Regular-Promo labels, Orders and Branch requests | Ali can run the demo script end to end; pricing tests pass in TypeScript |
| 0.3 Real AI reading      | One small server piece holding the AI key, provider chosen by Ali, spending cap, simulated fallback switch, rehearsal with 5–10 invoices                                                                                                                  | A real invoice is read into reviewable lines; fallback works             |
| 0.4 Demo hosting         | Prototype reachable by link (or run locally for a meeting)                                                                                                                                                                                                | Ali approves the demo                                                    |

## Phase 1: Core app

| Slice                                            | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Exit criteria                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation                                     | Company/branch tenancy (Supervisor can add/edit branches), settings framework with the groups in `requirements.md` §22, History (audit log with revert support), users with one role each, username + password sign-in, temporary passwords with forced change at first sign-in, Supervisor password reset and unlock, lockout after failed attempts, device registration (recent users list), idle lock, audit log, settings, i18n (EN/FA, RTL), app shell in the design language, seed loader | Role menus correct; cross-company/branch isolation tests pass; seed loads idempotently                                           |
| 2 Catalog and pricing                            | Products, codes, barcodes, suppliers (basic list and supplier page without money), supplier products, pricing categories from config, pricing engine, price/pending display, cashier lookup, AI category field                                                                                                                                                                                                                                                                                  | All 21 pricing cases pass; lookup shows pending/taxable/offer correctly                                                          |
| 3 Invoices (manual)                              | Drafts, header and lines, file upload, branch, supplier proposal/confirmation, posting, physical receiving log, supplier ledger entry, append-only location corrections, system-assigned invoice numbers                                                                                                                                                                                                                                                                                        | Posting rules enforced; Received and financial ledger correct; no inventory projection; drafts survive reloads                   |
| 4 Approvals and alerts                           | Price proposals, approvals queue (scope all/this branch), new products, barcode conflicts, same-supplier lower-price flow, other-supplier alert, cross-branch conflict, tax discrepancy                                                                                                                                                                                                                                                                                                         | Each workflow in `workflows.md` has an automated test                                                                            |
| 5 AI reading                                     | Provider interface, background job, extraction JSON, review screen, failure fallback, AI categories                                                                                                                                                                                                                                                                                                                                                                                             | Sample invoices produce reviewable lines; failures never block manual entry                                                      |
| 6 Offers and labels                              | Offer definitions, suggestions, mix-and-match pools, label product list with filters, shared label waitlist, label templates with calibration, A4 slot printing with Persian text, test alignment page                                                                                                                                                                                                                                                                                          | Test PDF prints correctly at exact mm size from a chosen start slot                                                              |
| 7 Shorts and returns                             | Short flow, return flow with all resolution types, history                                                                                                                                                                                                                                                                                                                                                                                                                                      | State diagrams enforced; payables effects correct                                                                                |
| 8 Date tracking                                  | Prompts per category, entries, expiring soon list, Cleared                                                                                                                                                                                                                                                                                                                                                                                                                                      | Every invoice line requires an explicit Track date: Yes / No answer; Grocery recommends tracking, Rice/Kitchenware default to No |
| 9 Payables and Suppliers overview                | Branch/supplier ledger, payments, credits, adjustments, opening balance, disputes, month-end summary/CSV; full Suppliers overview (last delivery, deliveries this month, open returns/shorts, balance, overdue, next due date) and supplier page tabs                                                                                                                                                                                                                                           | Floor Workers cannot reach any payables data or money columns (tested)                                                           |
| 10 Notes, receiving, orders, requests, dashboard | Built-in/custom notebooks with All branches add, Received, Orders and invoice comparisons, supplier items/packs, Branch requests, supervisor dashboard and worker home; no stock counts                                                                                                                                                                                                                                                                                                         | Dashboard order matches requirements                                                                                             |
| 11 Hardening                                     | Performance, accessibility pass, backups and restore test, error tracking, security review, load test with realistic data                                                                                                                                                                                                                                                                                                                                                                       | Checklist below fully passes                                                                                                     |
| 12 Staging and go-live                           | Staging environment, data import (products, suppliers, opening balances), training notes, production deploy                                                                                                                                                                                                                                                                                                                                                                                     | Ali's explicit go-live approval                                                                                                  |

## Later phases

Separate paid inventory phase after register-sales integration: stock counts/levels and loss detection. Later website with food ordering. Plan/prices/approval separately; do not enable inventory in Phase 1.

## Acceptance checklist (each item becomes an automated or scripted manual test)

**Pricing**

- [ ] All cases in `seed/pricing-test-cases.json` pass.
- [ ] Changing a divisor/band in settings changes results with no code change.
- [ ] Displayed selling price never includes tax; taxable products show a Taxable tag.
- [ ] A cost change that does not change the selling price creates no approval.

**Approvals and prices**

- [ ] A changed calculated price creates a Pending proposal; cashier lookup still shows the last approved price with a pending tag.
- [ ] A worker invoice-created product appears as Pending approval; Supervisor direct creation is Active immediately with recorded price decision/below-margin confirmation; barcode conflict blocks and creates an approval.
- [ ] Approving with "This branch only" does not change other branches; "All branches" does.
- [ ] Two branches with different prices raise a conflict alert; "Mark as intentional" silences it until a price changes.

**Invoices**

- [ ] A draft saves without an image and cannot be posted until the original is attached.
- [ ] A proposed supplier blocks posting until the Supervisor confirms it.
- [ ] Missing supplier invoice number is auto-assigned per supplier and marked system-assigned.
- [ ] Posting records correct actual physical deliveries/Received and supplier-ledger entry; a posted invoice is locked.
- [ ] Subtotal + tax ≠ total raises a tax discrepancy alert without blocking.
- [ ] New invoice has adjacent Upload/Manual entry choices; manual draft keeps edited header/lines when adding a supplier or product, saves without an original and remains blocked from posting until it has one.

**Same-supplier lower price**

- [ ] A lower cost from the same supplier asks the worker the expiry questions and creates a Supervisor alert with their answers; the Supervisor can mark Taken care of / Still pending.
- [ ] The same item from a different supplier is registered under that supplier and raises an alert.

**Shorts**

- [ ] Marking a line Short deducts its amount (and proportional tax) from the payable total and adds no Received quantity.
- [ ] Resolving restores the amount and records actual incoming quantities; the Supervisor can close as Not delivered.

**Returns**

- [ ] Selecting a supplier immediately shows its open returns.
- [ ] Pickup requires the representative's typed name; photo is optional; pickup works with no invoice.
- [ ] A return with several lines can be resolved once; a credit is linked to one invoice only.
- [ ] Replacement received records actual physical receipts, records details, and never changes Payables; partial replacement keeps the return open.
- [ ] Unsettled cancellation after pickup records only actually recovered safe originals; settlement requires Supervisor review. Never invent a recovery or duplicate replacements.

**Offers and labels**

- [ ] A product at 1.99/2.99/3.99 with no offer creates a worker suggestion; a product never has two active offers.
- [ ] Mix-and-match combines any products in the same pool across categories and suppliers.
- [ ] A label shows name, description, price, offer, product code, logo, unit size, tax indicator, in English and Persian; no barcode; no promotion expiry.
- [ ] Labels print at exact template size on A4, starting at the chosen slot; the shared branch waitlist survives refresh and built-in Regular/Promo are ready, editable, duplicable and archivable (no deletion). Exact geometry: Regular 60 × 40 mm, Promo 210 × 148.5 mm/two per A4. Promo border/band/offer is monochrome-safe and grayscale preview works. Omit logos below 50 mm label width; otherwise render them at least 8 mm tall.

**Date tracking**

- [ ] Every invoice line requires a human Track date: Yes / No answer before posting; Grocery categories recommend tracking, Rice/Kitchenware default to No, and Yes requires valid type/date fields.
- [ ] Items within 30 days show as expiring soon (setting); Cleared removes them from the list.

**Suppliers overview**

- [ ] Last delivery equals the latest posted invoice date for that supplier in the selected branch.
- [ ] Open returns and open shorts counts match the Returns and Shorts screens.
- [ ] Floor Workers see the overview without balance, overdue, next due date, Balance card, or Payments tab (UI and API).
- [ ] Supervisor Add supplier creates Confirmed; branch/as-of Opening balance appears once in Payables. Worker invoice quick-add creates Proposed, has no balances and blocks posting until confirmation.
- [ ] Similar-name warnings link existing suppliers; Deactivate removes new-invoice choices but retains all history.

**Manual Products**

- [ ] Supervisor Add product creates Active with the next never-reused Product Code, engine price/manual-override record and below-margin confirmation when needed.
- [ ] Add product has no Opening count fields/transactions; barcode conflicts block and similar-name warnings link existing products. Retain historical movements without a stock projection.
- [ ] Worker/Cashier cannot invoke standalone Add supplier/Add product or opening financial transactions; workers retain invoice-only proposals.

**Payables and permissions**

- [ ] Supervisor can record invoices, credits, payments (cheque number, date, partial), adjustments, opening balance, disputes.
- [ ] Floor Worker and Cashier cannot see balances anywhere (UI and API).
- [ ] Cashier can only look up products; direct API calls to other endpoints are refused.

**Sessions and platform**

- [ ] Only the Supervisor can create accounts; a new account must change its temporary password at first sign-in; a reset forces another change.
- [ ] 5 wrong passwords lock the account for 15 minutes; the Supervisor can unlock it; there is no PIN anywhere.
- [ ] A registered store computer shows recent users; idle lock engages and asks for the password; approvals re-prompt after 15 minutes.
- [ ] The same username can exist in two companies without conflict.
- [ ] Every action in the audit log shows the signed-in user.
- [ ] Layout is correct in English and Persian (RTL), on desktop and phone widths.
- [ ] Cross-company and cross-branch data access tests pass.

**Labels, notebooks, settings, history**

- [ ] Label filters (Arrived today, Price changed recently, On offer, categories, supplier) return the right products for the branch.
- [ ] The waitlist is shared per branch, survives refresh, and printed items leave it only after "printed correctly".
- [ ] A printed test page matches the template size in millimeters; calibration offsets move the output.
- [ ] A Supervisor can create a custom notebook; only the allowed roles can read or add; archived notebooks stay searchable.
- [ ] A Supervisor can add and edit branches and add a pricing category with its own rules, and prices follow the new rules without code changes.
- [ ] Every action appears in History; Undo works within the window; Revert works for reversible entries and is itself recorded; posted invoices and payables are corrected, never erased.

**Operations**

- [ ] `make setup && make up && make test` works from a clean machine.
- [ ] CI blocks merges that fail; a restore from backup has been demonstrated; no secrets in the repository.

## C acceptance proof (both pull requests, one review round)

- [ ] Supervisor creates a custom notebook and adds a note, including All branches with an explicit location; workers default to allowed add, denied cases explain why.
- [ ] No stock estimates, Low stock or Opening count controls remain. Physical deliveries/returns/transfers remain recorded without any stock-level projection.
- [ ] North York/Richmond Hill/Newmarket/Warehouse are configuration-driven, preserve original store IDs/custom names, and Warehouse has no Cashier access. Settings can change name/type.
- [ ] Received date/location/supplier/product/search filters, Last received per location, supplier Received tab and Arrived this week reconcile with actual delivery entries.
- [ ] Invoice own-location default, Ship to confirmation and original-reviewer retargeting work; posted move adds immutable correction, scoped receipt/approval effective location and conserved outstanding liability, with allocation preview.
- [ ] Supervisor sees Store cost/margin/history; other roles retain visibility. Manual provenance persists across receipts, is flagged/filterable, and keep/rule decisions never silently replace approved price.
- [ ] Supplier item history includes posted/manual items, remembered packs and exact cases-to-units; selling prices stay per unit.
- [ ] Orders draft/place/partial/received/cancel transitions, filters, To order linkage, before-tax totals and bilingual print work without Payables/stock mutation.
- [ ] Test all invoice comparison cases: fewer delivered, absent Short/Back-ordered/Cancelled, extra kept/refused, old/new price and short-dated expiry. Every difference blocks until decided; refused/absent uninvoiced quantities add neither payable nor Received.
- [ ] Short-dated actual costs/receipts/payable/date tracking persist, but regular cost/selling price stay and no price-change approval is created. One Supervisor order-differences alert per posting.
- [ ] Full Branch request Draft/Requested/Sent/Received/Closed lifecycle, partial Short/Missing, cancellation, print/residual-copy and endpoint/company/role checks pass; no stock or financial mutation.
- [ ] All seed pricing tests still pass. Regular/Promo print/PDF measure exact millimetres; physical printer alignment remains a distinct operator check.
- [ ] Required C screenshots in English light/dark/Persian/phone and exact Ubuntu command/click guide are supplied with actual executed results.
