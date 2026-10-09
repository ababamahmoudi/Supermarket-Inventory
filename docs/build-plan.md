# Build plan and acceptance checklist

Build in small slices. After each slice the app must run, tests must pass, and Ali must be able to click through the result. Do not start a slice until the previous one's exit criteria are met.

## Phase 0: Prototype and setup

| Step                     | Deliverable                                                                                                                                                              | Exit criteria                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 0.1 Repo and local setup | Monorepo skeleton, Docker Compose, Makefile, CI running on an empty project, README quick-start                                                                          | `make setup && make up` works on Ali's computer; CI green                |
| 0.2 Prototype            | Frontend-only demo per `prototype-brief.md`, including design fixes, label waitlist/real printing, notebooks, grouped Settings, History/Undo and Supervisor manual entry | Ali can run the demo script end to end; pricing tests pass in TypeScript |
| 0.3 Real AI reading      | One small server piece holding the AI key, provider chosen by Ali, spending cap, simulated fallback switch, rehearsal with 5–10 invoices                                 | A real invoice is read into reviewable lines; fallback works             |
| 0.4 Demo hosting         | Prototype reachable by link (or run locally for a meeting)                                                                                                               | Ali approves the demo                                                    |

## Phase 1: Core app

| Slice                             | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Exit criteria                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation                      | Company/branch tenancy (Supervisor can add/edit branches), settings framework with the groups in `requirements.md` §22, History (audit log with revert support), users with one role each, username + password sign-in, temporary passwords with forced change at first sign-in, Supervisor password reset and unlock, lockout after failed attempts, device registration (recent users list), idle lock, audit log, settings, i18n (EN/FA, RTL), app shell in the design language, seed loader | Role menus correct; cross-company/branch isolation tests pass; seed loads idempotently                                           |
| 2 Catalog and pricing             | Products, codes, barcodes, suppliers (basic list and supplier page without money), supplier products, pricing categories from config, pricing engine, price/pending display, cashier lookup, AI category field                                                                                                                                                                                                                                                                                  | All 21 pricing cases pass; lookup shows pending/taxable/offer correctly                                                          |
| 3 Invoices (manual)               | Drafts, header and lines, file upload, branch, supplier proposal/confirmation, posting, stock ledger, supplier ledger entry, system-assigned invoice numbers                                                                                                                                                                                                                                                                                                                                    | Posting rules enforced; stock and ledger correct; drafts survive reloads                                                         |
| 4 Approvals and alerts            | Price proposals, approvals queue (scope all/this branch), new products, barcode conflicts, same-supplier lower-price flow, other-supplier alert, cross-branch conflict, tax discrepancy                                                                                                                                                                                                                                                                                                         | Each workflow in `workflows.md` has an automated test                                                                            |
| 5 AI reading                      | Provider interface, background job, extraction JSON, review screen, failure fallback, AI categories                                                                                                                                                                                                                                                                                                                                                                                             | Sample invoices produce reviewable lines; failures never block manual entry                                                      |
| 6 Offers and labels               | Offer definitions, suggestions, mix-and-match pools, label product list with filters, shared label waitlist, label templates with calibration, A4 slot printing with Persian text, test alignment page                                                                                                                                                                                                                                                                                          | Test PDF prints correctly at exact mm size from a chosen start slot                                                              |
| 7 Shorts and returns              | Short flow, return flow with all resolution types, history                                                                                                                                                                                                                                                                                                                                                                                                                                      | State diagrams enforced; payables effects correct                                                                                |
| 8 Date tracking                   | Prompts per category, entries, expiring soon list, Cleared                                                                                                                                                                                                                                                                                                                                                                                                                                      | Every invoice line requires an explicit Track date: Yes / No answer; Grocery recommends tracking, Rice/Kitchenware default to No |
| 9 Payables and Suppliers overview | Branch/supplier ledger, payments, credits, adjustments, opening balance, disputes, month-end summary/CSV; full Suppliers overview (last delivery, deliveries this month, open returns/shorts, balance, overdue, next due date) and supplier page tabs                                                                                                                                                                                                                                           | Floor Workers cannot reach any payables data or money columns (tested)                                                           |
| 10 Notes, stock, dashboard        | Built-in and custom notebooks, stock counts, supervisor dashboard and worker home                                                                                                                                                                                                                                                                                                                                                                                                               | Dashboard order matches requirements                                                                                             |
| 11 Hardening                      | Performance, accessibility pass, backups and restore test, error tracking, security review, load test with realistic data                                                                                                                                                                                                                                                                                                                                                                       | Checklist below fully passes                                                                                                     |
| 12 Staging and go-live            | Staging environment, data import (products, suppliers, opening balances), training notes, production deploy                                                                                                                                                                                                                                                                                                                                                                                     | Ali's explicit go-live approval                                                                                                  |

## Later phases

Phase 2: register integration. Phase 3: website with food ordering. Plan separately; do not build now.

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
- [ ] Posting creates correct stock movements and supplier-ledger entry; a posted invoice is locked.
- [ ] Subtotal + tax ≠ total raises a tax discrepancy alert without blocking.
- [ ] New invoice has adjacent Upload/Manual entry choices; manual draft keeps edited header/lines when adding a supplier or product, saves without an original and remains blocked from posting until it has one.

**Same-supplier lower price**

- [ ] A lower cost from the same supplier asks the worker the expiry questions and creates a Supervisor alert with their answers; the Supervisor can mark Taken care of / Still pending.
- [ ] The same item from a different supplier is registered under that supplier and raises an alert.

**Shorts**

- [ ] Marking a line Short deducts its amount (and proportional tax) from the payable total and adds no stock.
- [ ] Resolving restores the amount and adds stock; the Supervisor can close as Not delivered.

**Returns**

- [ ] Selecting a supplier immediately shows its open returns.
- [ ] Pickup requires the representative's typed name; photo is optional; pickup works with no invoice.
- [ ] A return with several lines can be resolved once; a credit is linked to one invoice only.
- [ ] Replacement received adds stock, records details, and never changes Payables; partial replacement keeps the return open.
- [ ] Cancelling after pickup needs no approval and restores stock.

**Offers and labels**

- [ ] A product at 1.99/2.99/3.99 with no offer creates a worker suggestion; a product never has two active offers.
- [ ] Mix-and-match combines any products in the same pool across categories and suppliers.
- [ ] A label shows name, description, price, offer, product code, logo, unit size, tax indicator, in English and Persian; no barcode; no promotion expiry.
- [ ] Labels print at exact template size on A4, starting at the chosen slot; the shared branch waitlist survives refresh and there is no default template. Omit logos below 50mm label width; otherwise render them at least 8mm tall.

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
- [ ] Optional branch starting counts append Opening count movements; barcode conflicts block and similar-name warnings link existing products.
- [ ] Worker/Cashier cannot invoke standalone Add supplier/Add product or opening financial/count transactions; workers retain invoice-only proposals.

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
