# A2 review — presentation, products, suppliers and recorded operations

A2 implements the GLOBAL, SCREENS and PROOF items in Ali’s uploaded review. B is **plan only** in [REVIEW_B_PLAN.md](REVIEW_B_PLAN.md). All changed files belong to `prototype/` or `docs/`; the owner’s seed files, pricing algorithm, main branch and backend remain untouched.

The review branch is `fix/prototype-10-review-a2`, based on A’s `fix/prototype-09-design-language-polish`. Use this branch to test the complete combined prototype. Earlier review pull requests remain separate and unmerged.

## What changed

- Centered shared dialogs with dimmed backdrops, focus restoration, Escape and backdrop dismissal; shared table columns/padding and logical number alignment; compact filters; fitting custom selects; spacing, sentence case, two-decimal display and Persian isolation corrections.
- Supervisor-only shared product editor, its own Product page and Back link, invoice/manual price provenance, all-branch/one-branch scope, reversible recorded edits and protected barcode-conflict approvals. Existing barcode mappings stay unchanged when a conflict is reviewed.
- Sticky invoice document, expandable compact lines, explicit Yes/No date-tracking choice for every line, full-width posting surface and invoice-derived proposal cost/employee/reference metadata. The fictional answer control is only inside Demo.
- Returns starts with a cross-supplier overview, Pending by default, then opens a dated return detail with policy dialog, its own lines and evidence/history cards.
- Suppliers overview and tabbed supplier pages. Floor Workers receive a read model with financial fields removed, and cannot see cost, balance, overdue or payment columns/tabs. Supervisors can inspect financial details.
- Dashboard rows and actions use a common grid; purchases by supplier/current month, last eight weeks, low stock and this week’s price changes derive from recorded scoped data. Offers and Payables have the requested combined filters.

## Fictional fixture additions

The owner’s `seed/` remains unchanged. Added source: [prototype/src/fixtures/a2-demo-data.json](../prototype/src/fixtures/a2-demo-data.json), loaded by [demo-fixtures.ts](../prototype/src/demo-fixtures.ts).

Twelve historical posted invoices were added: **GG-11794, SB-7801, FV-20241, GG-11810, FV-20296, HW-4910, SB-7848, GG-11842, HW-4936, SB-7862, GG-11879 and FV-20390**. Each records Demo Floor Worker as receiver and has a matching ledger invoice plus an allocated fictional payment recorded by Demo Supervisor (24 ledger rows). Branch 2/3 documents are fully paid.

Five invoices have a remaining balance:

| Invoice   |   Outstanding |     Overdue |
| --------- | ------------: | ----------: |
| GG-11842  |       $210.00 |     $210.00 |
| GG-11879  |       $632.10 |       $0.00 |
| HW-4936   |     $1,260.00 |       $0.00 |
| SB-7862   |        $96.40 |      $96.40 |
| FV-20390  |       $169.79 |       $0.00 |
| **Total** | **$2,368.29** | **$306.40** |

Recorded opening counts, receipts, return removals and store use support stock per branch. The two existing returns gain dates/authors and links to FV-20390/GG-11842; both existing expiry rows gain invoice/date metadata. Two historical Supervisor actions retain seed prices for Black Tea and Red Kidney Beans. Lavash’s historical approval uses cost **1.5500**, proposal **$2.99**, margin **48.16%** and the historical invoice reference.

The current upload **FV-20417** is a separate delivery. Post it with the four chips short: payable **$169.79**, total before the short **$177.02**, deduction **−$7.23**. Fresh Valley’s balance then becomes **$339.58**. Posting refreshes linked proposals with that delivery’s actual cost and receiver; it does not use the older historical cost.

Existing saved browser state is backed up exactly under `supermarket-prototype-before-a2-fixtures`, verified by reading it back before additive, idempotent hydration. Failed backup verification/storage preserves original data. Tests exercise backup/restore, custom-edit retention, idempotence and reconciliation.

## Test on Ubuntu

1. Stop the old running prototype with **Ctrl+C** in its terminal.
2. In Ubuntu **Files**, open `Supermarket-Inventory`, right-click inside the folder, and choose **Open in Terminal**.
3. Paste these commands, one line at a time:

```bash
git fetch origin
git switch fix/prototype-10-review-a2
git pull --ff-only origin fix/prototype-10-review-a2
cd prototype
node --version
npm ci
npm run build
npm run dev
```

Expected: Git switches to the A2 branch; Node is **22.22.2 or newer in Node 22, below 23**; install/build succeed; Vite prints **http://localhost:5174/**. Keep the terminal open and open that address in Firefox or Chrome. Docker, `make setup` and `make up` are unnecessary for this frontend prototype. If Node is missing/unsupported, follow the exact Node installation commands in [prototype/README.md](../prototype/README.md). If Git reports local files would be overwritten, stop and keep those files; share the exact message. If port 5174 is in use, stop the old Vite terminal before retrying.

4. Sign in as **supervisor**, password **demo1234**. Dashboard is first. Use **Demo → Reset demo → Reset demo** only to return demo business data to the fictional starting records.
5. Check the four Dashboard KPIs, purchase charts, invoice/return lists and supplier balances. Choose Branch 2 and All branches from the top bar and check that the data follows the chosen scope.
6. Open **Lookup**, search `0009`, click **Edit**. Change price to `3.29`; choose **All branches** or **This branch only**, then **Save product**. Check the price/provenance, and verify it in a second branch. Open **Products → View** for the same product; it opens its own page with a Back link. Open the editor again; **Escape** and clicking the dimmed backdrop must close it.
7. Open **Invoices** and upload the [fictional invoice picture](redesign-screenshots/pr1/fictional-fv-20417.png). Wait for Review invoice lines. Open **Demo → Use fictional demo answer**. On the chips line choose **Mark as short**. For each line explicitly choose **Track date: Yes** (and supply a date) or **No**, then **Confirm this invoice line**; confirmed lines collapse and can be reopened. **Post invoice** remains disabled until all decisions/blockers are resolved. Post it, then inspect Approvals, Date tracking, product stock, Suppliers and Payables.
8. Open **Returns**. It initially shows Pending returns for all suppliers/allowed branches. Search a supplier, clear filters and open **#1**. Check number/date/author, the line card, **Return policy** and Evidence and history. Back to Returns opens the overview. Existing pickup, replacement, compensation and cancellation operations remain available under their existing rules.
9. Open **Suppliers → Fresh Valley Foods → View**. Check Invoices, Products, Returns and (as Supervisor) Payments. Open **Demo → Switch to Demo Floor Worker** and repeat: money/cost columns and payment tabs must be absent. Worker data stays in the assigned branch.
10. Open **Labels**, keep/select products, enter a named valid template and click **Save template**. Check the saved template and preview: price largest, offer bold, names below, code/unit smaller, optional small logo. Zero dimensions or an overlarge template produce a specific error. **Print labels** opens the browser’s print dialog; test Save as PDF at actual size/100%, with browser headers/footers off. Physical printer calibration remains a later B task.
11. Check the compact filters on Products, Date tracking, Notes, Returns, Offers and Payables. Use **EN | فا**, theme toggle and a narrow browser window to review Persian, dark and phone layouts. Sign out and sign in as **newemployee**, temporary password **temp1234**, to check the required password-selection step.

## Automated validation and screenshots

Executed on Ubuntu/Linux with Node **22.23.3** and Chromium, against the final production build. The structured [validation report](redesign-screenshots/pr-a2/validation-results.json) lists every browser/pricing case and per-view alignment measurements; the [unit output](redesign-screenshots/pr-a2/unit-test-results.txt) records the full unit run.

| Check                                                    | Actual result                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                                               | **250 passed**, 15 files, 0 failures                                                                                                                           |
| Pricing subset                                           | **66 passed**, including **all 21 owner seed cases** and 3 retained boundary fixtures; algorithm unchanged                                                     |
| Full desktop/phone browser suite                         | **139 passed, 3 intentional skips, 0 failures**, 142 collected; no retries/flaky cases                                                                         |
| Expanded English/Persian table and centered-dialog proof | **6 passed**; **1784 header/cell pairs**, four desktop/phone × language runs, maximum edge difference **0px** (limit 2px), matching padding and text alignment |
| ESLint and Prettier                                      | Passed                                                                                                                                                         |
| TypeScript and Vite build                                | Passed; nonfatal large-bundle warning                                                                                                                          |
| Pre-commit                                               | JSON/private-key/whitespace/end-of-file checks passed; YAML/foundation hook skipped because no applicable changed files                                        |
| Screenshot geometry and console checks                   | **156 images passed**, 0 browser errors                                                                                                                        |

The three intentional phone skips are desktop top-bar search keyboard behavior, the 1920×1080 sidebar/form-width check, and the desktop sticky two-column invoice preview. Phone sign-in/search/sidebar, stacked invoice review, date decisions and ordinary **Save as draft** clicks are covered by other passing tests. The final invoice phone regression also confirms the layout/visual viewport stays exactly 390px wide.

Alignment proof includes Products, **Alerts**, Return overview/detail, Date tracking, Offers, Payables, Labels and the populated six-line invoice review, plus Suppliers overview and the populated Invoices/Products/Returns/Payments tabs. Four reports each measured 446 pairs across 18 views; the separate centered-editor test checked focus trapping, Escape/backdrop closing and restored trigger focus on desktop and phone.

Local prototype validation is separate from GitHub CI. The earlier A draft's repository-wide CI failed during **Prepare the environment**, before prototype checks ran; its root cause remains unconfirmed. A2 stays draft, and its own GitHub result will be recorded after publication. Root tooling/CI files are outside the authorized A2 scope.

Screenshots use real UI actions and the existing fictional invoice picture, with no edited images or injected business state. There are **156 screenshots: 39 states in four variants**. The phone viewport is **390 × 844 px**. Dialog pictures use the visible viewport so their centering can be inspected. Wide table contents scroll inside their table container.

| Screen / state                          | English light                                                                | English dark                                                                | Persian light                                                                | Phone                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sign-in and recent users                | [View](redesign-screenshots/pr-a2/signin-en-light.png)                       | [View](redesign-screenshots/pr-a2/signin-en-dark.png)                       | [View](redesign-screenshots/pr-a2/signin-fa-light.png)                       | [View](redesign-screenshots/pr-a2/signin-phone.png)                       |
| Supervisor dashboard                    | [View](redesign-screenshots/pr-a2/dashboard-en-light.png)                    | [View](redesign-screenshots/pr-a2/dashboard-en-dark.png)                    | [View](redesign-screenshots/pr-a2/dashboard-fa-light.png)                    | [View](redesign-screenshots/pr-a2/dashboard-phone.png)                    |
| Cashier lookup                          | [View](redesign-screenshots/pr-a2/lookup-en-light.png)                       | [View](redesign-screenshots/pr-a2/lookup-en-dark.png)                       | [View](redesign-screenshots/pr-a2/lookup-fa-light.png)                       | [View](redesign-screenshots/pr-a2/lookup-phone.png)                       |
| Products                                | [View](redesign-screenshots/pr-a2/products-en-light.png)                     | [View](redesign-screenshots/pr-a2/products-en-dark.png)                     | [View](redesign-screenshots/pr-a2/products-fa-light.png)                     | [View](redesign-screenshots/pr-a2/products-phone.png)                     |
| Product page                            | [View](redesign-screenshots/pr-a2/product-detail-en-light.png)               | [View](redesign-screenshots/pr-a2/product-detail-en-dark.png)               | [View](redesign-screenshots/pr-a2/product-detail-fa-light.png)               | [View](redesign-screenshots/pr-a2/product-detail-phone.png)               |
| Centered product editor dialog          | [View](redesign-screenshots/pr-a2/product-editor-dialog-en-light.png)        | [View](redesign-screenshots/pr-a2/product-editor-dialog-en-dark.png)        | [View](redesign-screenshots/pr-a2/product-editor-dialog-fa-light.png)        | [View](redesign-screenshots/pr-a2/product-editor-dialog-phone.png)        |
| Invoices and drafts                     | [View](redesign-screenshots/pr-a2/invoices-en-light.png)                     | [View](redesign-screenshots/pr-a2/invoices-en-dark.png)                     | [View](redesign-screenshots/pr-a2/invoices-fa-light.png)                     | [View](redesign-screenshots/pr-a2/invoices-phone.png)                     |
| Approvals                               | [View](redesign-screenshots/pr-a2/approvals-en-light.png)                    | [View](redesign-screenshots/pr-a2/approvals-en-dark.png)                    | [View](redesign-screenshots/pr-a2/approvals-fa-light.png)                    | [View](redesign-screenshots/pr-a2/approvals-phone.png)                    |
| Alerts                                  | [View](redesign-screenshots/pr-a2/alerts-en-light.png)                       | [View](redesign-screenshots/pr-a2/alerts-en-dark.png)                       | [View](redesign-screenshots/pr-a2/alerts-fa-light.png)                       | [View](redesign-screenshots/pr-a2/alerts-phone.png)                       |
| Offers                                  | [View](redesign-screenshots/pr-a2/offers-en-light.png)                       | [View](redesign-screenshots/pr-a2/offers-en-dark.png)                       | [View](redesign-screenshots/pr-a2/offers-fa-light.png)                       | [View](redesign-screenshots/pr-a2/offers-phone.png)                       |
| Offer pools                             | [View](redesign-screenshots/pr-a2/offer-pools-en-light.png)                  | [View](redesign-screenshots/pr-a2/offer-pools-en-dark.png)                  | [View](redesign-screenshots/pr-a2/offer-pools-fa-light.png)                  | [View](redesign-screenshots/pr-a2/offer-pools-phone.png)                  |
| Labels and saved template               | [View](redesign-screenshots/pr-a2/labels-en-light.png)                       | [View](redesign-screenshots/pr-a2/labels-en-dark.png)                       | [View](redesign-screenshots/pr-a2/labels-fa-light.png)                       | [View](redesign-screenshots/pr-a2/labels-phone.png)                       |
| Saved label print preview               | [View](redesign-screenshots/pr-a2/label-preview-en-light.png)                | [View](redesign-screenshots/pr-a2/label-preview-en-dark.png)                | [View](redesign-screenshots/pr-a2/label-preview-fa-light.png)                | [View](redesign-screenshots/pr-a2/label-preview-phone.png)                |
| Returns overview                        | [View](redesign-screenshots/pr-a2/returns-en-light.png)                      | [View](redesign-screenshots/pr-a2/returns-en-dark.png)                      | [View](redesign-screenshots/pr-a2/returns-fa-light.png)                      | [View](redesign-screenshots/pr-a2/returns-phone.png)                      |
| Return page                             | [View](redesign-screenshots/pr-a2/return-detail-en-light.png)                | [View](redesign-screenshots/pr-a2/return-detail-en-dark.png)                | [View](redesign-screenshots/pr-a2/return-detail-fa-light.png)                | [View](redesign-screenshots/pr-a2/return-detail-phone.png)                |
| Return policy dialog                    | [View](redesign-screenshots/pr-a2/return-policy-dialog-en-light.png)         | [View](redesign-screenshots/pr-a2/return-policy-dialog-en-dark.png)         | [View](redesign-screenshots/pr-a2/return-policy-dialog-fa-light.png)         | [View](redesign-screenshots/pr-a2/return-policy-dialog-phone.png)         |
| Date tracking                           | [View](redesign-screenshots/pr-a2/expiry-en-light.png)                       | [View](redesign-screenshots/pr-a2/expiry-en-dark.png)                       | [View](redesign-screenshots/pr-a2/expiry-fa-light.png)                       | [View](redesign-screenshots/pr-a2/expiry-phone.png)                       |
| Notes                                   | [View](redesign-screenshots/pr-a2/notes-en-light.png)                        | [View](redesign-screenshots/pr-a2/notes-en-dark.png)                        | [View](redesign-screenshots/pr-a2/notes-fa-light.png)                        | [View](redesign-screenshots/pr-a2/notes-phone.png)                        |
| Payables                                | [View](redesign-screenshots/pr-a2/payables-en-light.png)                     | [View](redesign-screenshots/pr-a2/payables-en-dark.png)                     | [View](redesign-screenshots/pr-a2/payables-fa-light.png)                     | [View](redesign-screenshots/pr-a2/payables-phone.png)                     |
| Supplier payable detail                 | [View](redesign-screenshots/pr-a2/payables-detail-en-light.png)              | [View](redesign-screenshots/pr-a2/payables-detail-en-dark.png)              | [View](redesign-screenshots/pr-a2/payables-detail-fa-light.png)              | [View](redesign-screenshots/pr-a2/payables-detail-phone.png)              |
| Month-end report                        | [View](redesign-screenshots/pr-a2/payables-month-en-light.png)               | [View](redesign-screenshots/pr-a2/payables-month-en-dark.png)               | [View](redesign-screenshots/pr-a2/payables-month-fa-light.png)               | [View](redesign-screenshots/pr-a2/payables-month-phone.png)               |
| Settings                                | [View](redesign-screenshots/pr-a2/settings-en-light.png)                     | [View](redesign-screenshots/pr-a2/settings-en-dark.png)                     | [View](redesign-screenshots/pr-a2/settings-fa-light.png)                     | [View](redesign-screenshots/pr-a2/settings-phone.png)                     |
| Suppliers as Supervisor                 | [View](redesign-screenshots/pr-a2/suppliers-en-light.png)                    | [View](redesign-screenshots/pr-a2/suppliers-en-dark.png)                    | [View](redesign-screenshots/pr-a2/suppliers-fa-light.png)                    | [View](redesign-screenshots/pr-a2/suppliers-phone.png)                    |
| Supplier overview as Supervisor         | [View](redesign-screenshots/pr-a2/supplier-supervisor-detail-en-light.png)   | [View](redesign-screenshots/pr-a2/supplier-supervisor-detail-en-dark.png)   | [View](redesign-screenshots/pr-a2/supplier-supervisor-detail-fa-light.png)   | [View](redesign-screenshots/pr-a2/supplier-supervisor-detail-phone.png)   |
| Supplier invoices as Supervisor         | [View](redesign-screenshots/pr-a2/supplier-supervisor-invoices-en-light.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-invoices-en-dark.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-invoices-fa-light.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-invoices-phone.png) |
| Supplier products as Supervisor         | [View](redesign-screenshots/pr-a2/supplier-supervisor-products-en-light.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-products-en-dark.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-products-fa-light.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-products-phone.png) |
| Supplier returns as Supervisor          | [View](redesign-screenshots/pr-a2/supplier-supervisor-returns-en-light.png)  | [View](redesign-screenshots/pr-a2/supplier-supervisor-returns-en-dark.png)  | [View](redesign-screenshots/pr-a2/supplier-supervisor-returns-fa-light.png)  | [View](redesign-screenshots/pr-a2/supplier-supervisor-returns-phone.png)  |
| Supplier payments as Supervisor         | [View](redesign-screenshots/pr-a2/supplier-supervisor-payments-en-light.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-payments-en-dark.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-payments-fa-light.png) | [View](redesign-screenshots/pr-a2/supplier-supervisor-payments-phone.png) |
| Historical posted invoice               | [View](redesign-screenshots/pr-a2/historical-invoice-en-light.png)           | [View](redesign-screenshots/pr-a2/historical-invoice-en-dark.png)           | [View](redesign-screenshots/pr-a2/historical-invoice-fa-light.png)           | [View](redesign-screenshots/pr-a2/historical-invoice-phone.png)           |
| Approval confirmation dialog            | [View](redesign-screenshots/pr-a2/approval-dialog-en-light.png)              | [View](redesign-screenshots/pr-a2/approval-dialog-en-dark.png)              | [View](redesign-screenshots/pr-a2/approval-dialog-fa-light.png)              | [View](redesign-screenshots/pr-a2/approval-dialog-phone.png)              |
| Suppliers as Floor Worker               | [View](redesign-screenshots/pr-a2/supplier-worker-overview-en-light.png)     | [View](redesign-screenshots/pr-a2/supplier-worker-overview-en-dark.png)     | [View](redesign-screenshots/pr-a2/supplier-worker-overview-fa-light.png)     | [View](redesign-screenshots/pr-a2/supplier-worker-overview-phone.png)     |
| Supplier overview as Floor Worker       | [View](redesign-screenshots/pr-a2/supplier-worker-detail-en-light.png)       | [View](redesign-screenshots/pr-a2/supplier-worker-detail-en-dark.png)       | [View](redesign-screenshots/pr-a2/supplier-worker-detail-fa-light.png)       | [View](redesign-screenshots/pr-a2/supplier-worker-detail-phone.png)       |
| Supplier products as Floor Worker       | [View](redesign-screenshots/pr-a2/supplier-worker-products-en-light.png)     | [View](redesign-screenshots/pr-a2/supplier-worker-products-en-dark.png)     | [View](redesign-screenshots/pr-a2/supplier-worker-products-fa-light.png)     | [View](redesign-screenshots/pr-a2/supplier-worker-products-phone.png)     |
| Invoice ready to post / collapsed lines | [View](redesign-screenshots/pr-a2/invoice-review-en-light.png)               | [View](redesign-screenshots/pr-a2/invoice-review-en-dark.png)               | [View](redesign-screenshots/pr-a2/invoice-review-fa-light.png)               | [View](redesign-screenshots/pr-a2/invoice-review-phone.png)               |
| Invoice with expanded line              | [View](redesign-screenshots/pr-a2/invoice-expanded-line-en-light.png)        | [View](redesign-screenshots/pr-a2/invoice-expanded-line-en-dark.png)        | [View](redesign-screenshots/pr-a2/invoice-expanded-line-fa-light.png)        | [View](redesign-screenshots/pr-a2/invoice-expanded-line-phone.png)        |
| Posted invoice                          | [View](redesign-screenshots/pr-a2/invoice-posted-en-light.png)               | [View](redesign-screenshots/pr-a2/invoice-posted-en-dark.png)               | [View](redesign-screenshots/pr-a2/invoice-posted-fa-light.png)               | [View](redesign-screenshots/pr-a2/invoice-posted-phone.png)               |
| Dashboard after posting invoice         | [View](redesign-screenshots/pr-a2/dashboard-after-post-en-light.png)         | [View](redesign-screenshots/pr-a2/dashboard-after-post-en-dark.png)         | [View](redesign-screenshots/pr-a2/dashboard-after-post-fa-light.png)         | [View](redesign-screenshots/pr-a2/dashboard-after-post-phone.png)         |
| Lock screen                             | [View](redesign-screenshots/pr-a2/lock-en-light.png)                         | [View](redesign-screenshots/pr-a2/lock-en-dark.png)                         | [View](redesign-screenshots/pr-a2/lock-fa-light.png)                         | [View](redesign-screenshots/pr-a2/lock-phone.png)                         |
| First-sign-in password selection        | [View](redesign-screenshots/pr-a2/new-password-en-light.png)                 | [View](redesign-screenshots/pr-a2/new-password-en-dark.png)                 | [View](redesign-screenshots/pr-a2/new-password-fa-light.png)                 | [View](redesign-screenshots/pr-a2/new-password-phone.png)                 |

The [capture report](redesign-screenshots/pr-a2/capture-results.json) records theme/language, width, native controls, sidebar geometry and KPI counts for each picture. All 156 checks pass: no page-width overflow, visible native controls, textarea resize handles, more than four KPIs, incorrect theme/language or scrolling desktop sidebar; no browser console/page errors were captured.

To reproduce on a test machine, run the built preview on port 5174, then in a second terminal in `prototype/` run `node scripts/capture-design-a2.mjs` with Playwright Chromium installed. `CAPTURE_VARIANTS=phone node scripts/capture-design-a2.mjs` refreshes only phone images and keeps the other recorded variants. These capture commands are developer proof; Ali only needs to open the image links.

## Deferred work and review needed

B’s live A4 template designer, label waitlist/calibration workflow, custom notebooks, expanded Settings, History/Revert/Undo and simulated AI progress/low-confidence refinements remain planned. History stays inactive. Standalone Stock and Users and devices are omitted because the current prototype brief has no separate moment for them; product pages show recorded branch stock, and sign-in/lock/password workflows work.

No real AI, backend, database, authentication service, payments, sales integration or deployment is added. Browser role/domain guards are prototype logic; production permission enforcement still needs the future server.

Ali only needs to review A2’s appearance and workflows. B will wait for approval.
