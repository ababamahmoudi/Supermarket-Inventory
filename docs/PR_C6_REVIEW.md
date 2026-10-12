# Pull request C6 — testing fixes

Branch: **`feat/prototype-c6-functional-fixes`**, from the owner-approved C5 merge `2dbb64aab13cdbb6ecfe5a540c590ebb32c503ce`. C5 merged only after all required CI passed and retained its history. C6 covers owner Part 2 (items 1–23); C7 stacks on it for the all-screen Klead retouch. Build/review both together without an intermediate approval stop; neither new PR merges automatically.

**C6 application source:** `7862eacfd89558729f72aa9d427fb8a70881d63e`. The final local unit run passed **962 tests across 87 files**, including all **23 unchanged seed pricing cases** within **68 pricing checks**. Lint, formatting, TypeScript and production build passed. All **85 final C6 screenshots** were captured and individually reviewed with no browser/layout/real-review findings; the strict gallery gate passed. [Open the gallery](redesign-screenshots/pr-c6/gallery.html) or [read the verification record](evidence/c6-final-verification.json).

Both required jobs passed for this source in [CI run 38228438796](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38228438796), including the complete prototype browser workflow. The coordinating agent independently checked the **live GitHub API, refreshed at 10:03:11 UTC on 2026-10-12**; the [live CI proof](evidence/c6-7862eac-ci-live-proof.json) retains that result. The documentation agent did not perform a separate live query. Local test/capture results are recorded separately. Focused runs are not added together or substituted for the complete browser workflow. Later documentation commits need their own latest-head checks before merge.

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

Fresh Ubuntu/Mac **Git/Node installation** and troubleshooting are in [prototype README](../prototype/README.md). For C6, use the branch commands here; the combined C7 branch remains separately in progress. Docker is not needed. If you have not downloaded the repository, install Git/Node first, then run:

```bash
cd ~
git clone --branch feat/prototype-c6-functional-fixes https://github.com/ababamahmoudi/Supermarket-Inventory.git
```

For a downloaded checkout, stop the previous app with **Ctrl+C**, then run each command in Terminal:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-c6-functional-fixes
git pull --ff-only origin feat/prototype-c6-functional-fixes
git branch --show-current
cd prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.2
npm ci
npm run build
npm run preview
```

Expect branch `feat/prototype-c6-functional-fixes`, successful install/build and local port 5174. Open **http://localhost:5174** in the browser on the same Ubuntu Desktop/Mac. Sign in **supervisor/demo1234**, or your previously changed demo password. Keep Terminal open. A fresh VM uses the Git/Node installation steps in README first. Do not discard local Git changes or browser data to work around an error.

## Click-by-click checks

1. **Layout:** resize to 390, 768, 900, 1024, 1180, 1280, 1440 and 1920 px, then repeat in Persian. At 900 px, sidebar icons have labels on hover/focus; current-page breadcrumb and search icon do not overlap. In Products/Returns/Dates/Invoices/Received/Suppliers/Payables, no heading splits mid-word or price/date overlaps. Columns and expanded details retain omitted permitted data; at phone width table rows are cards. Repeat with **فا**, then return to EN.
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
13. **Files:** attach a fictional invoice PDF/photo, refresh, open Original invoice and Download. Preview is readable and download retains exact original. Old inline uploads migrate with verified backup before replacement; browser history/evidence stays. The automatic 20-photo test below generates its own fictional set, so manual preparation is optional. Do not clear browser site data to test migration.

## Verification ledger — final C6 source

| Check                                                                               | Recorded result and boundary                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit suite                                                                          | **962 passed, 0 failed, 0 pending**, across **87 test files** on source `7862eac`; actual Vitest JSON retained and hashed in the verification record.                                                                                                     |
| Pricing                                                                             | **68 pricing checks passed**, including **all 23 unchanged seed cases**. These are included in the 962 tests, not added to that total.                                                                                                                    |
| Lint, formatting, TypeScript and production build                                   | **Passed** on the same application source. The build's chunk-size warning is not a failure.                                                                                                                                                               |
| Complete existing/C6 browser workflow                                               | The required prototype CI job **PASSED** in run **38228438796**, independently verified through the live GitHub API. Its complete workflow runs `npm run e2e -- --workers=2`; no guessed full-browser pass/skip count is presented.                       |
| Focused final CI regressions                                                        | **9 passed, 0 failed, 1 existing desktop-only skip, 0 flaky** on the same source. This is a selected local run, not the complete suite and not added to the CI result.                                                                                    |
| Eight widths × EN/FA, words/collisions/inner bounds                                 | The required browser workflow includes 390, 768, 900, 1024, 1180, 1280, 1440 and 1920 px. All final capture layouts also record positive measured word counts and **0 findings**. Source-specific screenshots are not substitutes for dynamic assertions. |
| Twenty 3 MB photos, resize/hash/reload/migration; company/role/file/print workflows | Included in the successful final CI workflow; exact-source unit/file guards also passed. The protection model and original-byte checks remain retained. Actual Safari behavior and physical printer alignment are not established.                        |
| Token-only screen styles and composited contrast                                    | C6 checks are included in its successful unit/browser verification. **Final C7 all-screen retouch/audits remain separate; the dark Primary owner choice is still pending.**                                                                               |
| Screenshot capture                                                                  | **85 images, 0 browser errors, 0 layout findings**, actual runner exit **0**; one before/after-verified production fingerprint.                                                                                                                           |
| Individual image review and strict gallery                                          | **85/85 originals individually opened**, 5 review reports; **19/19 unchanged references** verified. Strict generation passed with **no diagnostic mode and no warnings**. Per-image C7 differences/framing limitations remain visible.                    |
| Required CI statuses                                                                | Both **Foundation** and **Prototype** jobs passed for source `7862eac`, independently verified by the coordinating agent through the live GitHub API, with the saved result refreshed at 10:03:11 UTC. The saved live proof records provenance.           |
| Safari / physical printer / final C7                                                | **Not verified / not verified / pending.** C6 is ready for review of the recorded evidence, not an automatic merge or a claim that C7 is finished.                                                                                                        |

The cloud's **SIMULATED `reserved.invalid` transport applies only to the nonsecure HTTP origin used for file/crypto tests**, not to the live GitHub API verification. Those tests still perform real browser IndexedDB writes, original-file downloads and byte checks. No final complete cloud-local browser run on `7862eac` is claimed: complete browser success is the verified GitHub CI result, and the nine local passes are selected regressions. Earlier local runs on superseded sources, including a failing full run on `2cc8237`, are not presented as final passing results. No focused counts are summed into a complete-suite claim. The [compact verification JSON](evidence/c6-final-verification.json) records source, exact counts, source-artifact hashes, live CI URL/provenance and screenshot provenance.

From `prototype/` run `npm test`, `npm run lint`, `npm run build`, then install Chromium using the OS-specific README command and `npm run e2e`. The latter starts its built preview; stop old 5174 servers first. `npm run e2e -- tests/storage-c6.spec.ts` targets the required photo/migration proof. These commands let you repeat the checks locally; the executed results and their limits are recorded above. No local installation or manual testing is required from you unless you choose to review that way.

## Screenshots and original notes

Open the [final offline C6 comparison gallery](redesign-screenshots/pr-c6/gallery.html). It shows all **17 scenes × five variants = 85 unchanged PNGs**, beside a selectable one of the **14 original bug annotations and five Klead retouches**. On Ubuntu use Files, or on Mac use Finder: repository → `docs` → `redesign-screenshots` → `pr-c6` → double-click `gallery.html`. No app server or printer is needed. **Actual size** reveals original pixels; **Next screenshot** moves through the full set. [Detailed gallery instructions](redesign-screenshots/README.md) explain the controls.

The [capture manifest](redesign-screenshots/pr-c6/capture-results.json), [strict gallery result](redesign-screenshots/pr-c6/gallery.manifest.json) and five actual reviews retain image/source hashes and per-image notes: [English light](redesign-screenshots/pr-c6/visual-review-en-light.json), [English dark](redesign-screenshots/pr-c6/visual-review-en-dark.json), [Persian](redesign-screenshots/pr-c6/visual-review-fa-light.json), [900 px](redesign-screenshots/pr-c6/visual-review-mid-900.json) and [phone dark](redesign-screenshots/pr-c6/visual-review-phone-dark.json). All use source `7862eacfd89558729f72aa9d427fb8a70881d63e` and production fingerprint `ab56e36e829b674039e2420b38b7385b9c62e40d88f27649eccad5ce21765ce1`. The [19-reference manifest](design-references/c6-c7-owner-reference-manifest.json) still matches the original byte counts and hashes.

C6 fixes the functional issues and blocking overlaps. Its [explicit remaining C7 presentation differences](redesign-screenshots/pr-c6/differences.json), such as final Lookup hierarchy, calm list treatment, inner field-group surfaces, semantic variants and shell finishing, remain listed rather than marked matched. Topbar crops and product dialogs scrolled to their Date tracking group have framing limits in the individual reports. English-only supplier memo defaults are intentional; unknown address is not invented. The reference green adjustment and unanswered dark Primary choice are documented. Screenshots cannot prove dynamic permissions, money calculations, retained-file durability or physical printing by themselves.

The [43-item acceptance ledger](C6_C7_ACCEPTANCE.md) remains the requirement map. C7 uses **`feat/prototype-c7-klead-retouch`**, its separate final production source and its own **85-image gallery**, still pending; earlier C6 images do not establish C7 completion.

## Docs updated and remaining questions

Requirements, data-model, workflows, screens, return-policy, open-questions, decisions, prototype-brief, design-language and build-plan record the current behavior; CHANGELOG and acceptance ledger distinguish specifications from final results. [Storage decisions](decisions.md) explain retained originals/verified backups and reversible History representation.

Two owner choices remain pending: Owner/Manager permission mapping for Correct pickup, and whether dark Primary uses darker blue/white or lighter blue/ink to meet 4.5:1. The source [open questions](open-questions.md) records both without silently deciding. C7's final retouch/screenshots/checks and physical-printer/Safari verification are not claimed complete. Neither PR merges automatically; later review-head checks and owner approval remain separate. Nothing requires the owner to install software or run these checks unless they choose to test locally.
