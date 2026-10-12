# Pull request C7 — Klead visual retouch

Combined review branch: **`feat/prototype-c7-klead-retouch`**. It includes C6's functional baseline from **`feat/prototype-c6-functional-fixes`**. Final C7 application source: **`ef4dfcc01172f4c7122c940139339fae4d228f5e`**. C7 [PR20](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/20/checks) stacks on C6 [PR19](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/19/checks). Use the C7 branch to review both sets of changes. This guide requests review; it does not imply owner approval or automatic merge.

On final application source `ef4dfcc`, **968 unit tests across 87 files passed**, with zero failed/pending tests; this includes **68 pricing checks and all 23 unchanged seed cases**. Lint, formatting, TypeScript and the production build passed. **32 new rendered regressions passed**, with no failures/skips/flakes, across English/Persian and desktop/phone. The separate **72-case matrix passed**: 32 adaptive layout checks, 32 actual Persian decimal/order checks and eight rendered contrast groups; all eight required widths remain covered. The lowest recorded contrast is **4.5626:1**, above the required 4.5:1. All **79 protected domain, seed, logo and physical-print files** match the exact C6 baseline `7862eac` in Git and the immutable final snapshot. Narrow syntax-tree comparisons preserve business callbacks, controlled values and guards and separately verify the intentional submenu keyboard change.

The final-source package contains **85 original PNGs**, with **zero browser errors and zero geometry findings**. All **85 were freshly opened individually** and compared with the **14 annotated bugs and five unchanged Klead retouches**. The strict **85-image/85-review/19-reference gallery gate passed**, with no unresolved visual failures or warnings, one verified production fingerprint and all 170 before/after asset guards. [Open the final C7 comparison gallery](redesign-screenshots/pr-c7/gallery.html); the [manifest](redesign-screenshots/pr-c7/gallery.manifest.json), [capture record](redesign-screenshots/pr-c7/capture-results.json) and [differences](redesign-screenshots/pr-c7/differences.json) retain its source/hash provenance and review boundaries.

The complete existing/C6/C7 browser suite and latest publication-head CI remain **PENDING**. The older Source7 failure is recorded below rather than relabelled green. Review [PR20's current required checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/20/checks); both jobs, including the complete browser suite, **must pass before merge**. Publication results are verified on that head after push; this document does not invent a future run or green result.

C6's separate [published 85-image gallery](redesign-screenshots/pr-c6/gallery.html) and [guide](PR_C6_REVIEW.md) retain application source `7862eac` and publication `261f544`. Its full live CI [38235989273](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38235989273) passed both required jobs. Root's live refresh records **525 passed, one flaky case passed on retry, and 42 skipped** (568 listed), rather than claiming no retries/skips. The retry was desktop weighed-default persistence. C7 now polls the exact durable saved configuration before reloading, retaining the existing price/permission assertions; its complete latest-head CI rerun is still pending. **No installation or manual testing is required from you** while final publication checks finish; the optional commands and click paths below are available if you want to inspect the app.

## 1. What changed

C7 applies the owner's [Klead design language](design-language.md) and [five unchanged retouch images](design-references/c6-c7-owner-reference-manifest.json) to the existing prototype. The standalone [light/dark tokens](../prototype/src/klead-tokens.css) define screen colours, type, radii and shadows; company branding remains separate. English and numbers use bundled Manrope, Persian uses Vazirmatn, and monetary values retain tabular figures.

- Filled fields, five semantic button treatments, rounded choices, quiet status dots in tables and tinted pills in cards/headers. Resting controls have no glow; keyboard focus remains visible.
- Grouped sidebar, responsive top bar, one phone account control and reachable search/language/theme/text-size/Demo actions. Detail rows gain labelled chevrons and keyboard navigation; lower-priority allowed facts remain available through Columns and expanded details.
- Calm lists with inset dividers, shared dialog footers, existing-record captions and clearer grouped pickup/resolution/date forms. The Supervisor dashboard retains its approved section layout and exactly four solid blue/ink summary cards.
- Lookup retains read-only local dates and actual clearance evidence, with the retouched search/category chips, large price and quiet date/last-received rows. Labels, Orders, Payables, Settings and the other existing screens use the same shared controls.

This PR changes presentation. The pricing engine, company/branch isolation, role permissions, confirmed financial amounts, allocations, signed pickup coverage, immutable history, storage originals and existing workflows remain the C6 behavior. Supplier return memos and supplier orders retain their configured English-default documents; internal picking lists remain bilingual. Physical A4/label dimensions, print components and print-specific styles must remain unchanged. All 79 protected files match the C6 `7862eac` baseline; final-source rendered/geometry checks passed. This named protected set does not imply that every shared UI handler is unchanged. A screen preview does not establish physical-printer alignment.

The references supply style, not copied names, chart values, people or branding. The app continues to use its configured company logo and fictional demo records. Deliberate differences are limited to these documented cases:

- Reference green text `#1A7F45` on its supplied tint measures 4.4451:1. The minimal adjustment to `#197D44` measures 4.56258:1; the [design document](design-language.md) records the reason. This does not replace rendered contrast checks for the other pairs.
- Dark Primary retains an accessible interim treatment while the owner's darker-blue/white versus lighter-blue/ink choice remains open in section 4. The inaccessible lighter-blue/white pairing is not accepted as a passing exception.
- A drawn **Print label** action does not create a new workflow on a screen that did not previously have it. Existing label printing and Add to waitlist remain in the Labels workflow; the reference supplies their treatment, not permission to invent a new action.

Mandatory control styles still apply. Filled fields and icon controls have no resting borders/glows; the explicitly specified page-control hairlines, validation borders and focus rings retain their own rules. A remaining unintended resting border is a defect, not an accepted visual difference.

The [43-item acceptance ledger](C6_C7_ACCEPTANCE.md#test-files-and-click-paths-for-each-item) links each original requirement to real test/source files, named checks and a review path. It also indexes every original red-note image and the five retouches. The C6 specifications updated requirements, model, workflows, screens, policy, questions and decisions before implementation; C7 follows that source without changing financial or permission rules. Final-source unit, rendered, responsive/contrast and protected-source checks passed; individual-gallery publication has passed its strict gate; full latest-head CI remains pending.

One shared UI keyboard behavior deliberately changed: closing a just-opened submenu with Escape or its RTL-aware back arrow now closes only that level, restores its trigger focus and cancels a pending focus frame. A retained late frame cannot steal focus after closure; a second Escape can close the parent. The exact reviewed function and a new controlled-frame unit regression cover this change. All other compared UI callbacks, controlled values and outside-submenu guards are preserved. This is not a claim that every UI handler is byte-identical.

## 2. How to run and test it

For this browser prototype, use the commands below. Docker is not required; the repository's root Makefile belongs to the separate Docker setup. Open the app in a browser on the same Ubuntu Desktop VM or Mac as the terminal. The [prototype README](../prototype/README.md) has the same installation steps and troubleshooting. You can review the final screenshots instead of installing anything.

### Fresh Ubuntu Desktop VM or Mac

Run one block at a time and wait for the normal terminal prompt. If it fails, stop there and keep the command's first error; do not continue to later blocks.

**Ubuntu:** open Terminal with **Ctrl+Alt+T**, then install Git and the download tools:

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
git --version
```

Type your Ubuntu password when asked and press Enter. The password has no visible characters while you type; that is normal. Expect installation to finish and Git to print its version.

**Mac:** open **Finder → Applications → Utilities → Terminal**, then run:

```bash
git --version
```

If macOS offers to install developer tools, click **Install**, wait until it finishes and rerun the command. If Git is missing and no prompt opens, run `xcode-select --install`, complete that installation and check Git again.

**Both computers:** install the supported Node version, which runs the prototype:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm alias default 22.22.2
nvm use 22.22.2
node --version
npm --version
```

Expect **`v22.22.2`** and an npm version. Then download the combined review branch, install its packages, build and start it:

```bash
cd ~
git clone --branch feat/prototype-c7-klead-retouch https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
git branch --show-current
cd prototype
npm ci
npm run build
npm run preview
```

Expect **`feat/prototype-c7-klead-retouch`**, installation without errors, a successful build and a local URL on **5174**. Leave Terminal open. Open **http://localhost:5174** in Firefox/Chrome inside Ubuntu Desktop or Safari/Chrome on the Mac. A funding notice or chunk-size warning with a successful exit does not mean the command failed. **Ctrl+C** in the server terminal stops it. If `Supermarket-Inventory` already exists, preserve it and use the update commands below.

### Update an existing copy

If you already installed those tools and downloaded the repository, stop the old server with **Ctrl+C**, then run this in Terminal:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-c7-klead-retouch
git pull --ff-only origin feat/prototype-c7-klead-retouch
git branch --show-current
cd prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.2
npm ci
npm run build
npm run preview
```

Expect `feat/prototype-c7-klead-retouch`, Node `v22.22.2`, a successful build and a preview URL on **5174**. Leave this terminal open; open **http://localhost:5174** in Firefox/Chrome inside Ubuntu Desktop, or Safari/Chrome on your Mac. If a command fails, stop at that command and preserve its first error. The README explains missing tools, existing folders, stale pages and occupied ports. Do not reset/delete an existing checkout or clear browser data to get past an error.

### Begin with a fresh fictional demonstration

1. Sign in with **Username `supervisor`**, **Password `demo1234`**. Use your changed demo password if you already changed it in this browser. The other accounts are `floorworker`/`demo1234`, `cashier`/`demo1234` and first-sign-in `newemployee`/`temp1234`.
2. If you want to replace earlier fictional edits, open **Demo → Reset demo**, read the confirmation, then confirm. It replaces demo business edits while retaining passwords/preferences. This is optional; use a separate browser profile if you want to keep your current demonstration.
3. Select **North York** from the location pill. Begin in **English light theme**. Use the target-language **فا** button for Persian and **EN** to return; the sun/moon control changes theme. On phones those presentation controls are in **More**.
4. Repeat the relevant views in English dark, Persian, about **900 px** wide and **390 px** phone width. Drag the window narrower for a quick check. For an exact width in Chrome, open developer tools (**Ctrl+Shift+I** on Ubuntu, **Option+Command+I** on Mac), click its phone/tablet toolbar icon, select **Responsive**, and enter the width. Close developer tools to return to an ordinary window. This is optional; the final automated matrix separately checks all eight required widths in both languages.

### The 17 required screenshot scenes

Each row states how to reach the real screen and what to inspect. Use the sidebar icon's hover/focus label at intermediate width; on a phone, open the sidebar with its top-bar button. These steps do not require a real supplier document or printer.

| Scene                            | Click path and expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Top bar                       | Open **Dashboard**. At 900 px the breadcrumb shows the current page and search is an icon that opens the search field. Location, language, theme, text size, bell and Demo stay reachable. The sidebar never scrolls independently; only one account control is shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2. Lookup with dates/clearance   | Click **Lookup**, enter `0003`, then press **Enter**. Dates are read-only; Last received includes its actual source. To create the captured clearance state, use the fictional dated-receipt setup below, then **Products → Sour Cherry Juice → its dated lot → Create clearance**; enter `2.49` and confirm. Return to Lookup at North York: the local clearance price, expiry and ordinary price/offer are separate. Other locations do not inherit that clearance.                                                                                                                                                                                                                                                                                                                   |
| 3. Date tracking                 | Click **Date tracking**. In Product search enter `0006`, choose Lavash Bread, open Date and choose **Today**. Open **More** to enter optional quantity `20`, lot `REVIEW-SHELF-06` and note `Shelf check`; click **Add**. The entry appears under **Due soon**. Inspect whole dates/names, compact actions, custom fields and the optional suffix.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4. Edit product/date group       | Click **Products**, search `0006`, open Lavash Bread and click **Edit**. Choose Date tracking **Yes** if needed. The same dialog immediately reveals reminder days, North York's dates and the inline date-entry fields. The date added in step 3 is present. **Cancel** saves nothing; **Save product** saves product/date edits together.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5. Invoices list                 | Click **Invoices → Posted**. Whole invoice references and suppliers fit without overlapping; status is dot plus words. Click a row/chevron to open its actual invoice, then use Back. **Columns** still controls permitted facts; hidden values are available in expanded details.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6. Manual invoice/What's missing | Click **Invoices → New invoice → Manual entry**, select **Fresh Valley Foods**, enter a fictional invoice reference and click **Add line**. Click **Post invoice** before attaching an original or confirming the line/date decision. The amber **What's missing** box lists all real blockers. Click each link: its exact field scrolls into view, receives focus/highlight and has its matching red message. Fixing one field clears that field's issue. No Undo appears merely for typing/autosave.                                                                                                                                                                                                                                                                                  |
| 7. Products                      | Click **Products**. Names, translated fallback, prices, codes and compact row actions stay readable. Search by name/code; try **Columns**, hide an allowed optional field and **Reset columns**. English/Persian names and unit fragments remain intact. Edit is neutral; additional row actions are in More.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8. Received/date range           | Click **Received → Date range → This month**. There is one control with **From** and **To**, plus **Today/This week/This month** choices. Invoice references open their actual records. Product units such as **400 g**, quantities, dates and money stay together; narrow tables omit lower-priority columns instead of squeezing text.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 9. Returns list                  | Click **Returns → Open**. Waiting for pickup uses blue; Waiting for credit uses amber. The reference, supplier, progress and next action stay separate. Click a row or its chevron, or focus the row and press **Enter**; it opens that return. **History** preserves closed/cancelled records.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 10. Pickup with shortfall        | Start from a fresh demo; open **Returns → Return #1 → Record pickup**. For its quantity `3`, enter actual pickup `2`. Enter shortfall reason `Rep refused: not covered by the return policy`; choose **Keep for next pickup**. Enter representative `Fictional Representative` and signed-paper reference `REVIEW-PICKUP-01`. Inspect **Item photo (optional)** and **Note (optional)**. Leaving reason/outcome/evidence missing explains what is required; a successful save locks this pickup. A later kept remainder uses a new signed event.                                                                                                                                                                                                                                        |
| 11. Partial resolution           | Use a separate fresh demo or reset your fictional edits. Record all `3` units from Return #1 with representative and a new signed-paper reference. Click **Record resolution → Outcome Replaced**, keep Replacement product actually received as Sour Cherry Juice, enter Original quantity covered `1`, Actual replacement quantity `1`, Supplier representative name `Fictional Representative` and Replacement receipt reference `REVIEW-REPLACEMENT-01`. Confirm Received date, then open **Remaining expected date** and choose a date. Click **Record resolution**. Reopen it: picked up `3`, resolved `1`, still outstanding `2`; pickup quantities stay locked. The return remains Waiting for credit and no replacement purchase/confirmed-credit amount is added to Payables. |
| 12. Return memo                  | After a real demo pickup, click its **RM-0001** button. The supplier document defaults to English, including when the surrounding interface is Persian. Store/address/date, supplier, item code/quantity/cost/expected credit, total and driver/store-staff signature lines are separated. Unknown address remains the displayed em dash rather than invented. **Print** opens the system print dialog; cancel it or choose Save as PDF.                                                                                                                                                                                                                                                                                                                                                |
| 13. Payables ledger              | As Supervisor, click **Payables → Fresh Valley Foods**. Inspect exactly four summary cards, whole amounts/dates and **Columns in the Supplier ledger title**. Supplier rows also open by chevron/Enter. Open **Record external payment**, leave required fields blank and preview allocations: linked missing-field messages appear; no payment posts. Cancel any later financial confirmation unless you intentionally want fictional money changes.                                                                                                                                                                                                                                                                                                                                   |
| 14. Supplier cards               | Click **Suppliers → Fresh Valley Foods**. **Last delivery** opens its invoice; **Deliveries this month** opens this supplier's filtered Invoices list; **Open returns** opens its scoped open Returns. **Balance** is static. Repeat as Floor Worker: supplier money/margins/Payables are absent, including Columns and expanded details.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15. Dashboard                    | As Supervisor, click **Dashboard**. Exactly four blue/ink summary cards are followed by the existing approval queue/alerts, recent invoices/returns, supplier balances, purchase charts, arrivals/price changes, notes and activity in the approved layout. Values come from demo records; the references' chart values are not copied. Narrow layouts stack without losing facts/actions.                                                                                                                                                                                                                                                                                                                                                                                              |
| 16. Approvals                    | Click **Approvals → Pending**. Existing cards retain old/new price, cost, margin, branch/source and Approve/Reject. Inspect rounded tabs, readable captions and consistent status tones. In this review you can inspect without approving anything; if you act, use only fictional records.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 17. Settings                     | Click **Settings → Returns/date tracking/labels**. Inspect default reminder `30`, separate **Return memo language** and **Printed supplier order language**, and the existing Label waitlist/Templates controls. English-only supplier documents are separate from internal bilingual labels. Missing required Save data shows linked validation. Geometry dimensions remain the stored physical values.                                                                                                                                                                                                                                                                                                                                                                                |

To make the Lookup clearance scene through real UI, use **New invoice** and the included fictional original `prototype/public/demo-originals/fictional-fv-20417.png`. Browse to that file in your downloaded repository; simulated reading opens its six lines. Set Invoice date to the document's `2026-10-09`. For Sour Cherry Juice choose **Short-dated (expiry discount)** and a date about five days from today; choose **No** for date tracking on the other lines and confirm each line. Click **Post invoice**, inspect the confirmation, then confirm this fictional posting. Its dated lot then appears on the product page. This setup deliberately adds a demo receipt; reset only if you want to discard your fictional edits afterward.

### Additional presentation checks

- **Labels:** click **Labels → Products tab** → select a permitted product → tinted **Add to waitlist** → Waitlist → choose **Regular** or **Promo** → preview. Tinted Print opens the unchanged physical output; **No** in the print confirmation leaves the waitlist. Remove/Archive retain their existing guarded behavior. A browser preview cannot establish your printer's physical alignment.
- **Supplier items:** **Suppliers → Fresh Valley Foods → Supplier items**. A Supervisor can focus an item row and press **Enter**, or click its history chevron, to open **Price history**. Quoted cost is separate from a recorded purchase; an item without history stays empty. The small Edit action is independent. A Floor Worker sees item identity/pack/history dates but no cost or edit control.
- **Orders:** click **Orders → New order** → choose North York and Fresh Valley Foods → enter Cases `1` for an item → **Save as draft**. Back to Orders → open its reference/chevron or focus its row and press Enter. Existing quantity/cost/totals are retained. **Print order** uses its document-language setting; no real order is sent to a supplier.
- **Undo/focus:** Remove an eligible draft line/date, then try Undo or ×. One capsule appears for about eight seconds above bottom actions. Use Tab to check visible focus and keyboard-reachable menus. Financial posting/corrections do not gain Undo.
- **Roles/sign-in:** Sign out through the account menu; sign in as `floorworker` and `cashier`. Presentation must not reveal private money or editing capabilities. In a separate fresh browser profile, `newemployee` must choose a new password; no PIN pad returns.

### Additional C6 behavior included in this branch

These checks are optional for you. The linked acceptance ledger specifies which automated evidence still has to pass; none of these steps require real documents or money.

1. **Both stop choices:** after adding a fictional date for `0006`, open **Date tracking → its row's More → Stop tracking this product**. Choose **Stop tracking, keep the date on the product** and complete the confirmation. It leaves Due soon/All dates and sends no more reminders, while Lookup keeps the date. In a separate fresh demonstration, repeat with **Stop tracking and clear the dates**: the active list and Lookup date are cleared, with retained History. Removing only one date is a different action and still asks its reason.
2. **Product reminder:** in **Products → Lavash Bread → Edit → Date tracking Yes**, set **Remind me** days, add an expiry within that window and Save product. Open **Date tracking → Due soon**, **Alerts** and the bell; the date has one reminder. Refresh and check that it does not create another. Settings supplies default `30`; changing the default does not overwrite an explicit product reminder.
3. **Reuse another store's date:** record a recent fictional expiry for the same product/supplier at a second allowed location. Return to North York and review a tracked matching delivery line. Its date section offers **Use this date** with the other location/date; choosing it fills the current line's date without importing the other location's quantities, cost or invoice. A date outside the last seven days or from another supplier is not a candidate.
4. **Invoice terms/total:** in Manual entry, select **Weekly (7 days)**, **Every 2 weeks (14 days)** or **Monthly (30 days)** and inspect the due date. **Other → Number of days** accepts nonnegative whole days. Due date remains editable; choosing a different term deliberately recomputes it. Subtotal `400` and Tax `20` fill Final total `420`; changing Final total to `419` gives a warning and retains your deliberate amount through ordinary edits. Store-local received date/time is separate from UTC persistence.
5. **Supplier review:** Manual entry → **Add supplier**. Optional contacts let you save a draft. A new/incomplete supplier stays in Needs review: as Supervisor open its **Edit supplier** action, fill the required review details and save, then click **Confirm supplier**. Confirming the supplier does not itself post the invoice or change money. Post still needs its own missing fields and explicit confirmation.
6. **Locked evidence and partial credit:** after a signed pickup, a resolution shows each picked/resolved/outstanding quantity without editable pickup boxes. Different partial credit notes need their real note numbers, covered original quantities and amounts; a Supervisor verifies/posts confirmed credit. Replacement goods and a remaining expected date stay distinct. Do not enter a second note for the same covered units. The unresolved Owner/Manager mapping does not silently enable Correct pickup for the Supervisor.
7. **File persistence:** attach the included fictional invoice image, refresh, open **Original invoice → Download** and confirm the original still opens. The automatic twenty-photo test generates its own files and compares exact downloaded bytes; you do not need to create or upload twenty photos yourself. Keep browser data when testing legacy migration.

### Optional local automated checks

You are not required to run these. If you want to, stop preview with **Ctrl+C**, open Terminal in `prototype/`, and run:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.2
npm test
npm run lint
npm run build
```

For the pricing suite alone: `npm test -- src/pricing.test.ts`. The full test run must include every existing case and all **23 seed pricing cases**; the terminal must show actual passing counts. Install Chromium using the OS-specific README command, then run `npm run e2e`. Playwright starts its own built preview, so keep the ordinary preview stopped. It runs Chromium desktop/phone tests; explicit width-specific skips are reported separately from failures. These optional commands run the same local checks; the publication-head complete GitHub browser suite still needs its own passing result.

## 3. What is not finished yet

### Final verification ledger

These results belong to application source **`ef4dfcc01172f4c7122c940139339fae4d228f5e`**. Documentation publication has a separate head and must pass its own required checks.

| Required evidence                            | Actual final-source result                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete unit suite/pricing                  | **968 passed, 87 files, 0 failed/pending**; includes 68 pricing checks/all 23 seed cases                                                            |
| Lint, format, TypeScript, production build   | **Passed**, actual successful runner exit                                                                                                           |
| New rendered regressions                     | **32 passed, 0 failed/skipped/flaky**, both languages and desktop/phone; includes Lookup/header editor entry in light/dark                          |
| Responsive/actual decimal/contrast matrix    | **72 passed, 0 failed/skipped/flaky**: 32 adaptive + 32 actual decimal/order + 8 rendered contrast groups; minimum observed 4.5626:1                |
| Protected C6 baseline                        | **79 protected files byte-identical** to C6 `7862eac`, in Git and immutable final snapshot                                                          |
| Narrow syntax-tree proofs                    | Invoice/Returns business callbacks/values/guards preserved; exact intentional submenu keyboard change separately verified                           |
| Five-variant capture                         | **85 original PNGs**, actual exit 0; 170 before/after asset guards, 0 browser errors, 0 geometry findings                                           |
| Individual reviews/strict gallery            | **Passed:** 85 fresh individual openings, 19 unchanged references and the complete strict gate; no unresolved visual failures/warnings              |
| Whole existing/C6/C7 browser suite/latest CI | **Pending** [current PR20 checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/20/checks); both required jobs must pass before merge |
| Twenty focused C6/C7 checks                  | No fresh Source9 aggregate is claimed here; focused counts are separate from whole CI and overlapping runs are not added                            |
| Safari/physical printer                      | **Not independently verified**; protected print geometry and Chromium previews do not establish actual printer alignment                            |

The exact final-source unit JSON has SHA-256 `c8117c1f2317c4f47e9d8e14973202bd7d419b0780f5be87e18b7a6095adc6cc`; its actual runner exit is 0. The 32-case summary SHA-256 is `f248f848c66b9aa1343098250754716461b00a3218dac938c6d6d1a1573a8587`; the 72-case summary is `a9a32e8b70ffb9b3a7fd11fb31b26038d321a160916f096883109df56bbc9045`. Both actual runtime records have exit 0. The fresh 85-image capture manifest has SHA-256 `e6f1a9ad05ff5c067e76be5e32bc6160875601d44e245e9cc98be47773b2ebad` and production fingerprint `5f1150cf962cbe50f4b4418da570f5163ff6188ba9b875068af25c92d5cbd665`; Root verified exit 0, all 170 before/after asset guards, zero browser errors and zero geometry findings. These totals are separate runs with overlapping cases and are not added together.

**Superseded sources remain diagnostics.** Source `3510329` had six capture findings and 20 reported CI failures. Source `873fe4a` still failed individual visual review across all five variants; its CI timed out during Chromium installation, so skipped browser steps are not a passing suite. An earlier 32-case diagnostic had 26 passes and six failures: four test-context errors and two real row-CSS defects were corrected. Source `7f589ea` passed local unit/rendered/matrix/capture runs, but its live [CI run 38242006551](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38242006551) reported **4 failed, 4 flaky, 42 skipped and 590 passed**. The four final failures were the Supervisor/Floor Worker Lookup audit in desktop/phone: an obsolete text-action radius assertion was applied to the required pill chips. Four other cases passed on retry; they remain reported as flaky. Source7's separate visual reviews also found three header/code-wrapping occurrences. Source `ceaf042` passed local checks but its actual individual review exposed a dialog Cancel that wrongly inherited the page-header white/hairline treatment. Those superseded images and verdicts are not final proof; Source9 corrects the selector scope and tests both actual header-entry and Lookup-entry editor contexts in light/dark.

The [published C7 verification record](evidence/c7-final-verification.json) retains exact source/artifact hashes. The [43-item evidence map](C6_C7_ACCEPTANCE.md#test-files-and-click-paths-for-each-item) retains every original requirement, named test, real source and click path. The [screenshot review instructions](redesign-screenshots/README.md) explain offline comparison. Static images cannot establish money/permission/file durability/Undo timing; those require separate real tests. No failed visual review becomes passed merely because geometry is zero.

### Screenshot matrix

Each of the **17 scenes above** requires English light, English dark, Persian light, English at **900 px**, and dark phone at **390 px**: **85 original C7 screenshots**. All 85 fresh Source9 originals were individually opened and the strict gallery passed. The broader matrix also verifies Persian phones and the other required widths. Captured product-editor framing is scrolled to Date tracking; upper name/pricing fields are covered separately. The top-bar image is an element crop. Phone-only evidence wrapping and submenu focus are not inferred from English desktop pixels.

The C6 [offline gallery](redesign-screenshots/pr-c6/gallery.html) remains separately available. [C7's final offline gallery](redesign-screenshots/pr-c7/gallery.html), [capture manifest](redesign-screenshots/pr-c7/capture-results.json), [strict gate](redesign-screenshots/pr-c7/gallery.manifest.json) and [differences](redesign-screenshots/pr-c7/differences.json) are available. Fresh reviews are recorded for [English light](redesign-screenshots/pr-c7/visual-review-en-light.json), [English dark](redesign-screenshots/pr-c7/visual-review-en-dark.json), [Persian](redesign-screenshots/pr-c7/visual-review-fa-light.json), [900 px](redesign-screenshots/pr-c7/visual-review-mid-900.json) and [phone dark](redesign-screenshots/pr-c7/visual-review-phone-dark.json). Do not substitute superseded-source screenshots. The [original-note index](C6_C7_ACCEPTANCE.md#every-original-annotation-must-be-checked) retains all 14 annotated bugs plus the five untouched retouches.

## 4. What is needed from you

**No local installation, file upload or manual testing is required.** Once final evidence and checks are published, you can inspect the C7 screenshots or optionally run the app using section 2. Review/merge approval is a separate owner step.

Two previously asked choices remain open in [open questions](open-questions.md):

1. **Correct pickup authority:** should Supervisor represent Owner/Manager for this permission, or should pickup correction require a separate permission? Signed pickup stays immutable; no unresolved Supervisor authority is silently granted and Floor Workers/Cashiers gain none.
2. **Dark Primary:** darker blue **`#2B59C3` with white**, or lighter blue **`#7397F0` with ink**. Lighter-blue/white fails the mandatory 4.5:1. An accessible interim colour is not your approval of a final palette.

The supplied Klead language is the design source; these new implementation changes still require your review. No automatic merge is authorized by this guide.
