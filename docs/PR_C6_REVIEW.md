# Pull request C6 — testing fixes

Branch: **`feat/prototype-c6-functional-fixes`**, from the owner-approved C5 merge `2dbb64aab13cdbb6ecfe5a540c590ebb32c503ce`. C5 merged only after all required CI passed and retained its history. C6 covers owner Part 2(items 1–23); C7 will stack on it for the all-screen Klead retouch. Build/review both together without an intermediate approval stop; neither new PR merges automatically.

**Evidence status:** implementation verification is in progress. Official final-source unit/browser counts, all required screenshots, individual annotation comparisons and latest-head CI are **pending**. Focused development runs are not added together or presented as a complete final suite. This guide records how to test and what must be demonstrated; it is not a claim of completion.

## What changed

- Adaptive icon sidebar/intermediate top bar, prioritized table columns/expanded details and phone cards, including Payables Columns placement.
- One 8-second closable action Undo, no field-edit/autosave notifications, and linked **What's missing** plus field errors on incomplete Save/Post/Send.
- Required/optional product fields, same-form product dates/reminders, read-only Lookup dates, explicit tracking-off Keep/Clear, deduplicated reminders and narrow recent other-location date reuse.
- One company product/barcode with first-added provenance; immutable local dated lots and store/lot clearance without regular repricing or stock estimates.
- Optional manual supplier intake with explicit review, editable term-derived due dates, automatic/editable totals with warning, store-local date/time and draft line removal.
- Actual partial signed pickup, locked evidence, item progress/partial resolutions, default-English supplier documents, Received range and supplier summary links.
- Separate IndexedDB files, exact original bytes, resized previews, verified raw migration backups and lossless repeated History representation; preserve business/financial/physical evidence.

Only prototype/, docs/ and seed/ are permitted. No backend, real AI, paid deployment or inventory is authorized. The source [Klead design language](design-language.md) was replaced and the eight behavior docs updated before prototype work. C6 new components use it; C7 applies it everywhere.

## Exact run commands

Fresh Ubuntu/Mac installation, supported Node 22, expected output and troubleshooting are in [prototype README](../prototype/README.md). Docker is not needed. For an existing Ubuntu or Mac checkout, stop the previous app with Ctrl+C, then:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-c6-functional-fixes
git pull --ff-only origin feat/prototype-c6-functional-fixes
cd prototype
nvm use 22.22.2
npm ci
npm run build
npm run preview
```

Expect branch `feat/prototype-c6-functional-fixes`, successful install/build and local port 5174. Open **http://localhost:5174** in the browser on the same Ubuntu Desktop/Mac. Sign in **supervisor/demo1234**, or your previously changed demo password. Keep Terminal open. A fresh VM uses the Git/Node installation steps in README first. Do not discard local Git changes or browser data to work around an error.

## Click-by-click checks

1. **Layout:** resize the browser to390, 768, 900, 1024 and 1180 px, then desktop. At 900 px, sidebar icons have labels on hover/focus; current-page breadcrumb and search icon do not overlap. In Products/Returns/Dates/Invoices/Received/Suppliers/Payables, no heading splits mid-word or price/date overlaps. Columns and expanded details retain omitted permitted data; at phone width table rows are cards. Repeat with **فا**, then return to EN.
2. **Quiet Undo:** Invoices → New invoice → Manual entry. Type header/line values: no Edit draft Undo stack. Remove a draft line and use Undo. Stop an offer or remove a date: one closable message above page buttons, replaced by a newer eligible action. Financial posting/correction still uses confirmation and has no destructive Undo.
3. **Missing fields:** click an incomplete Save/Post/Send. The top amber list tells you what is missing; click a link to focus/highlight the field. Its local message clears when repaired; other issues stay. Try Notes, Branch requests and Supplier items as well as invoices. Save draft uses genuine draft requirements, not all posting gates.
4. **Product/date form:** Products → Supervisor Edit(or Add product). English name and pricing category are required; clear Persian name and verify English fallback. Choose Date tracking Yes: section appears in this form, with reminder and current-location dates. Add/change/remove a date; Save persists product and dates together, Cancel discards both. No Lookup date-entry controls remain.
5. **Quick dates and stop choices:** Date tracking → scan/type a product → choose date/location → Enter. Product clears/refocuses and row highlights; optional Type/Quantity/Lot/Note remain under More. Stop tracking Keep leaves the active list/reminders but date stays Lookup; repeat separately with Clear, which leaves History. Removing one date still asks its reason.
6. **Reminders/reuse:** Settings → Returns/date tracking/labels → Default date reminder(days), initially 30. Product-specific reminder overrides it. A date in its window appears Due soon and has one Alerts/bell event, without duplicate on refresh. In tracked delivery review, select a same-product/supplier date entered at another location within 7 days using Use this date; the hint never reveals its costs/quantities/invoice.
7. **Company product/local clearance:** add a delivery-created product once, then switch allowed stores and search it; barcode identity is shared with first-added location. Date entries stay local. A recorded short-dated local lot clearance appears only in that store's Lookup with expiry and its actual Promo label; regular price/cost basis remain unchanged.
8. **Manual invoice:** New invoice → Manual entry → +Add supplier. Optional phone/email/rep/rep-phone/terms permit saving draft; new/incomplete supplier requires Supervisor review before posting. Choose Cash on delivery/Weekly/Every 2 weeks/Monthly/Other; due date fills and remains editable. Subtotal+Tax fills Final total; deliberately different total shows a warning, not mismatch error. Invoiced/Delivered and Remove line are present. Received time is Toronto local per configuration, including late-evening dates.
9. **Partial pickup:** Returns → waiting-pickup return → Record pickup. Enter actual quantity per line. A smaller quantity requires reason and Keep for next pickup/Put back on shelf/Throw away. Save with representative/signed-paper evidence: pickup becomes locked. A kept remainder needs a new signed event rather than editing the earlier event. Correct pickup authorization awaits the owner role answer below.
10. **Partial resolution:** Record resolution after actual signed pickup. Credit/replacement only the covered item quantity and keep another outstanding with expected date. Progress remains Waiting for credit until outstanding claims/remainders are dealt with. Distinct credit notes never overlap coverage; Supervisor verifies money, worker records operational evidence. Original pickup/money/physical records remain intact.
11. **Documents:** open Return memo: actual RM number, store/address/date, supplier/items/code/quantity/cost/expected amount/total and driver/staff signature lines; English default. Settings independently changes Return memo/Print order to bilingual if desired; internal picking list remains bilingual. Print preview keeps physical page size; real printer alignment is a separate check.
12. **Received/supplier/payables:** Received has one From/To range and Today/This week/This month. Supplier Last delivery opens its actual invoice; deliveries/month opens filtered Invoices; Open returns opens filtered Returns. Balance has no click effect. Payables supplier-ledger Columns is in card title. Worker has no supplier money or Payables.
13. **Files:** attach a fictional invoice PDF/photo, refresh, open Original invoice and Download. Preview is readable and download retains exact original. Old inline uploads migrate with verified backup before replacement; browser history/evidence stays. The automatic20-photo test below generates its own fictional set, so manual preparation is optional. Do not clear browser site data to test migration.

## Verification ledger — final evidence pending

| Check                                                              | Current review status                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Full unit suite and all 23 seed pricing cases                      | 931 tests passed across 85 files; all 23 pricing cases included             |
| Lint, format, TypeScript and production build                      | Passed; final browser snapshot and screenshots still pending               |
| Existing browser suite plus C6 workflows                           | Pending full final-source run; focused development runs not summed        |
| Eight widths × EN/FA, actual words/collisions/inner bounds         | Pending complete frozen-source proof                                      |
| Twenty distinct 3 MB photos, resize/hash/reload/legacy migration   | Pending final real-browser evidence                                       |
| Token-only components and actual text contrast both themes         | Pending final-source audit; owner dark-primary choice pending             |
| 17 scenes × five variants and individual annotation/retouch review | Pending all 85 final images per PR                                        |
| Latest-head required GitHub CI                                     | Pending latest review-head run                                            |
| Safari/physical printer                                            | Not established by Chromium/PDF automation; report actual separate checks |

From `prototype/` run `npm test`, `npm run lint`, `npm run build`, then install Chromium using the OS-specific README command and `npm run e2e`. The latter starts its built preview; stop old 5174 servers first. `npm run e2e -- tests/storage-c6.spec.ts` targets the required photo/migration proof. Commands and expected results are not executed evidence.

## Screenshots and original notes

[All43 acceptance criteria and 17-scene matrix](C6_C7_ACCEPTANCE.md) defines EN light/EN dark/FA/900px/phone. Original 14bug screenshots and five retouches are preserved unchanged with a [SHA256 manifest](design-references/c6-c7-owner-reference-manifest.json). Final screenshots and visual review are pending; no missing image link is presented as proof. Capture actual UI/source hashes, open every image and record every unmatched note.

## Docs updated and remaining questions

Requirements, data-model, workflows, screens, return-policy, open-questions, decisions, prototype-brief, design-language and build-plan record the current behavior; CHANGELOG and acceptance ledger distinguish specifications from final results. [Storage decisions](decisions.md) explain retained originals/verified backups and reversible History representation.

Two owner choices remain pending: Owner/Manager permission mapping for Correct pickup, and whether dark Primary uses darker blue/white or lighter blue/ink to meet 4.5:1. The source [open questions](open-questions.md) records both without silently deciding. C7's full-screen retouch, official final screenshots/checks and physical-printer/Safari verification are not claimed complete. Nothing requires the owner to install software or run these checks unless they choose to test locally.
