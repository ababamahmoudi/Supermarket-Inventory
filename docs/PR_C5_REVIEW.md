# C5 review: compact controls and fast dates

Branch: **`feat/prototype-c5-design-fixes`**. C5 starts from the approved C3/C4 merged main (`0767844`). C3 [#16](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/16) and C4 [#17](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/17) were merged in that order with their original commit history after passing checks. The subsequent [main integration run](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38023516156) passed before C5 began.

The prototype runs on your Ubuntu computer and saves fictional demo changes in that browser. Invoice reading is simulated. **Docker is not needed.** C5 changes only `prototype/` and `docs/`; the merged seed data and pricing rules stay unchanged.

## What changed

- Text action buttons use the C2 rounded rectangle: 12 px corners, 40 px height, width that fits their text. Secondary has a thin blue border/glow; Danger a red border/glow; Primary remains solid blue. Row actions sit together at the end, with rare actions in ⋯. Click names/references to open detail; redundant View buttons are removed.
- Top-bar controls share 40 px height/border/glow. The single round language button shows **فا** in English and **EN** in Persian. Fields/dropdowns are visible in both themes. Returns use consistent visible-label colors; Columns sits beside the count or Invoices card title.
- Posted invoices have an aligned header, paired totals and whole-page original preview with 25–400% zoom. Returns have a clearer header and 640 px numbered policy dialog. Products stacks the weighed price on two lines and says Sold by weight.
- Date tracking has quick-add instead of an Add date dialog. Lookup has Dates, authorized On/Off and inline Add. Adding when Off enables tracking in the same reversible action. Current offers excludes stopped history and groups one row per product; Past keeps earlier versions. Repeating identical terms does not add a new version.
- The approved dashboard, Approvals tabs, round choices, invoice/return settlements, exact label printing and other C3/C4 workflows remain.

## Run it on Ubuntu

1. Open **Files**, open your `Supermarket-Inventory` folder, right-click an empty area and choose **Open in Terminal**. If an earlier demo is running in another terminal, press **Ctrl+C** there once.
2. Copy these commands into the terminal in the repository folder:

```bash
git fetch origin feat/prototype-c5-design-fixes:refs/remotes/origin/feat/prototype-c5-design-fixes
git switch feat/prototype-c5-design-fixes
git pull --ff-only origin feat/prototype-c5-design-fixes
git branch --show-current
```

The final command should print `feat/prototype-c5-design-fixes`. The pull command above it prints `Already up to date` or downloads the branch changes. If switch says the branch is unknown after a successful fetch, run:

```bash
git switch -c feat/prototype-c5-design-fixes origin/feat/prototype-c5-design-fixes
git pull --ff-only origin feat/prototype-c5-design-fixes
```

If Git reports local files would be overwritten or divergent commits, stop and retain the message; do not reset or discard those files. If `git` is missing, install it with `sudo apt-get update` followed by `sudo apt-get install -y git`, then repeat step 2.

3. Activate supported **Node 22.22.2 or newer 22.x, below 23**. If you installed nvm from the earlier guide:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm use 22.22.2
node --version
npm --version
```

Expect `v22.22.2` (another supported 22.x is also suitable). If nvm is missing, run these first and repeat step 3:

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Ubuntu may ask for your computer password; it shows no characters while you type. Enter the password and press Enter. If download/install fails, keep the first error and share it; continue only when Node is supported.

4. From the repository folder, run:

```bash
cd prototype
npm ci
npm run build
npm run preview
```

`npm ci` installs the recorded versions. Build should complete without errors. Preview prints a local address on port **5174** and keeps running. Leave the terminal open; open Firefox/Chrome and enter **http://localhost:5174**. Sign in with **supervisor / demo1234**. If you changed that demo password earlier, use your changed password.

If 5174 is in use, stop the earlier demo in its own terminal with Ctrl+C and repeat preview. If you see an old page, press **Ctrl+Shift+R**. If build fails, keep its first error and `node --version`; do not run an older build. To stop the demo, press Ctrl+C in its terminal.

## Click-by-click checks

Use **Demo → Reset demo → Reset demo** only if you want to discard saved fictional business edits. It discards saved demo business changes, including files you attached, and restores the starting fictional examples. Changed account passwords and display preferences remain. Your existing data need not be reset to use C5.

1. **Top bar:** click فا; the page switches to Persian/RTL and the button becomes EN. Click EN to return. Toggle the sun/moon. Search, location, notifications, text size and Demo should share the same height/glow. The user menu stays at the sidebar bottom.
2. **Products:** click the product name to open detail; use Back to Products. Supervisor Edit is compact; ⋯ contains Add date. Search the weighed item and check a price like `$7.49/lb` above smaller `$16.51/kg`, with Sold by weight.
3. **Invoices:** open Posted. Columns is beside the card title. Click **FV-20390** to open its posted document. Number/status share a line; Correct invoice and Move invoice match. Totals sit below the lines with adjacent amounts and bold Payable.
4. **Original:** scroll to Original invoice; the whole page is visible. Click Fit width, − until 25%, + to zoom in, then Fit page. Download keeps the actual original. Open Correct invoice and check visible product/quantity/date dropdowns; Cancel to leave the invoice unchanged.
5. **Returns:** Open shows pickup blue and credit amber. Open a numbered return: status follows its title, creation information is below, policy/next action line up. Return policy has five numbered titled rules; Download full policy downloads existing policy, Close dismisses it. History retains closed/cancelled evidence.
6. **Date tracking:** scan/type a product name, Product Code or barcode in the top bar. Choose a date and current location; click Add. The new highlighted row is first, product clears and keeps focus; date/location remain. Type the next code and press Enter to add it. More exposes optional Type/Quantity/Lot/Note. Undo reverses the specific add, retaining later unrelated edits. Remove asks a reason; ⋯ contains Supervisor Stop tracking and its explicit keep/remove-existing choice.
7. **Lookup Dates:** search a product as Supervisor or Floor Worker. Dates shows the concrete location and open dates. Switch tracking Off: existing dates remain. Choose a date and Add; it turns On and says so. Undo restores the earlier preference/date. Cashier has no switch or add controls.
8. **Offers:** Current offers has one row per product, active/scheduled only. Stop an offer; it moves to Past offers. Undo restores it. Create an identical current offer again: it does not create another historical version. Different branch scopes remain listed within the product row; changed terms preserve history.
9. **Alerts/Approvals:** check compact action buttons and the same round Pending/Approved/Rejected tabs and approved layout. Other menus/forms use the same action geometry; ordinary Cancel, Reset columns and Undo have visible styles.
10. **Other roles/languages:** Demo switches to Floor Worker/Cashier. Check their permitted screens, then Persian/dark theme. On a phone, open the sidebar with its top toggle; tables may scroll within their own container, Orders uses item cards, and controls remain reachable.

## Optional automated checks

You can review the screenshots without installing test browsers. To repeat checks yourself, stop preview with Ctrl+C; remain in `prototype/` with supported Node active:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

These run pricing/workflow unit tests, lint/format/type/build and desktop/phone browser tests. A failed command prints an error; retain it and `node --version`. A zero-test run is not verification.

## Screenshot matrix

**All 60 final screenshots were individually opened and inspected**, covering the 15 scenes requested for C5 in English light, English dark, Persian light and English light at phone width. No visual findings remain. The [visual review](redesign-screenshots/pr-c5/visual-review.json) records each image hash and annotation comparison; the [capture report](redesign-screenshots/pr-c5/capture-results.json) records actual browser measurements and the frozen production source.

Desktop uses a 1440 × 1080 viewport; phone uses 390 × 844. Full-page images can be taller. All scenes use the Supervisor in North York with fresh browser profiles and real interface actions on the retained fictional examples. Top bar and desktop whole-page original are element captures; dialogs are viewport captures. Phone Original is a full-page capture so the actual sticky controls do not obscure its document heading. Before capture, the real page scroll and table pan return to the beginning and temporary focus is cleared. No elements are hidden and no screenshots are edited.

| Screen                            | English light                                                       | English dark                                                       | Persian light                                                       | Phone                                                            |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Top bar                           | [Open](redesign-screenshots/pr-c5/topbar-en-light.png)              | [Open](redesign-screenshots/pr-c5/topbar-en-dark.png)              | [Open](redesign-screenshots/pr-c5/topbar-fa-light.png)              | [Open](redesign-screenshots/pr-c5/topbar-phone.png)              |
| Invoices list                     | [Open](redesign-screenshots/pr-c5/invoices-list-en-light.png)       | [Open](redesign-screenshots/pr-c5/invoices-list-en-dark.png)       | [Open](redesign-screenshots/pr-c5/invoices-list-fa-light.png)       | [Open](redesign-screenshots/pr-c5/invoices-list-phone.png)       |
| Products: weighed price           | [Open](redesign-screenshots/pr-c5/products-weight-en-light.png)     | [Open](redesign-screenshots/pr-c5/products-weight-en-dark.png)     | [Open](redesign-screenshots/pr-c5/products-weight-fa-light.png)     | [Open](redesign-screenshots/pr-c5/products-weight-phone.png)     |
| Alerts                            | [Open](redesign-screenshots/pr-c5/alerts-en-light.png)              | [Open](redesign-screenshots/pr-c5/alerts-en-dark.png)              | [Open](redesign-screenshots/pr-c5/alerts-fa-light.png)              | [Open](redesign-screenshots/pr-c5/alerts-phone.png)              |
| Returns list                      | [Open](redesign-screenshots/pr-c5/returns-list-en-light.png)        | [Open](redesign-screenshots/pr-c5/returns-list-en-dark.png)        | [Open](redesign-screenshots/pr-c5/returns-list-fa-light.png)        | [Open](redesign-screenshots/pr-c5/returns-list-phone.png)        |
| Return detail                     | [Open](redesign-screenshots/pr-c5/return-detail-en-light.png)       | [Open](redesign-screenshots/pr-c5/return-detail-en-dark.png)       | [Open](redesign-screenshots/pr-c5/return-detail-fa-light.png)       | [Open](redesign-screenshots/pr-c5/return-detail-phone.png)       |
| Return policy dialog              | [Open](redesign-screenshots/pr-c5/return-policy-en-light.png)       | [Open](redesign-screenshots/pr-c5/return-policy-en-dark.png)       | [Open](redesign-screenshots/pr-c5/return-policy-fa-light.png)       | [Open](redesign-screenshots/pr-c5/return-policy-phone.png)       |
| Date tracking: quick-add          | [Open](redesign-screenshots/pr-c5/date-quick-add-en-light.png)      | [Open](redesign-screenshots/pr-c5/date-quick-add-en-dark.png)      | [Open](redesign-screenshots/pr-c5/date-quick-add-fa-light.png)      | [Open](redesign-screenshots/pr-c5/date-quick-add-phone.png)      |
| Lookup: Dates                     | [Open](redesign-screenshots/pr-c5/lookup-dates-en-light.png)        | [Open](redesign-screenshots/pr-c5/lookup-dates-en-dark.png)        | [Open](redesign-screenshots/pr-c5/lookup-dates-fa-light.png)        | [Open](redesign-screenshots/pr-c5/lookup-dates-phone.png)        |
| Current offers                    | [Open](redesign-screenshots/pr-c5/offers-current-en-light.png)      | [Open](redesign-screenshots/pr-c5/offers-current-en-dark.png)      | [Open](redesign-screenshots/pr-c5/offers-current-fa-light.png)      | [Open](redesign-screenshots/pr-c5/offers-current-phone.png)      |
| Past offers                       | [Open](redesign-screenshots/pr-c5/offers-past-en-light.png)         | [Open](redesign-screenshots/pr-c5/offers-past-en-dark.png)         | [Open](redesign-screenshots/pr-c5/offers-past-fa-light.png)         | [Open](redesign-screenshots/pr-c5/offers-past-phone.png)         |
| Posted invoice: header and totals | [Open](redesign-screenshots/pr-c5/posted-invoice-en-light.png)      | [Open](redesign-screenshots/pr-c5/posted-invoice-en-dark.png)      | [Open](redesign-screenshots/pr-c5/posted-invoice-fa-light.png)      | [Open](redesign-screenshots/pr-c5/posted-invoice-phone.png)      |
| Original invoice: whole page      | [Open](redesign-screenshots/pr-c5/original-whole-page-en-light.png) | [Open](redesign-screenshots/pr-c5/original-whole-page-en-dark.png) | [Open](redesign-screenshots/pr-c5/original-whole-page-fa-light.png) | [Open](redesign-screenshots/pr-c5/original-whole-page-phone.png) |
| Correct invoice dialog            | [Open](redesign-screenshots/pr-c5/correct-invoice-en-light.png)     | [Open](redesign-screenshots/pr-c5/correct-invoice-en-dark.png)     | [Open](redesign-screenshots/pr-c5/correct-invoice-fa-light.png)     | [Open](redesign-screenshots/pr-c5/correct-invoice-phone.png)     |
| Approvals tabs                    | [Open](redesign-screenshots/pr-c5/approvals-tabs-en-light.png)      | [Open](redesign-screenshots/pr-c5/approvals-tabs-en-dark.png)      | [Open](redesign-screenshots/pr-c5/approvals-tabs-fa-light.png)      | [Open](redesign-screenshots/pr-c5/approvals-tabs-phone.png)      |

Posted/original/correction captures use **FV-20390**. The Returns list records the demo pickup to show Waiting for credit; Past offers stops the existing juice offer through its confirmation dialog. Quick-add shows the expanded optional fields, and Lookup shows inline Dates. Successful adds, highlighting, auto-enable and Undo are checked through interaction tests; a still image alone does not prove those behaviors.

## Owner annotation comparison

Every final image was opened individually and compared with the applicable notes from the nine individually opened source images in **BugScreenshots-Prototype-c4.zip**. All nine reference hashes and all 60 final image hashes were verified. This table maps every exact owner filename to the correction and completed comparison.

| Owner screenshot                   | Final note mapping                                                                                                                                           | Final scenes                        | Actual review                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------ |
| `Screenshot 2026-10-09 225656.png` | Single target-language circle; uniform 40 px top-bar controls with border/glow; authorized inline Lookup Dates.                                              | Top bar; Lookup Dates               | Verified in all four variants. |
| `Screenshot 2026-10-09 230242.png` | Compact rectangle actions; invoice-number navigation replaces View; Columns sits in the card-title row.                                                      | Invoices list                       | Verified in all four variants. |
| `Screenshot 2026-10-09 230606.png` | Number/status header and matched actions; paired totals with bold Payable; whole-page default with compact 25–400% viewer controls.                          | Posted invoice; Original whole page | Verified in all four variants. |
| `Screenshot 2026-10-09 230807.png` | Visible correction dropdown border/resting glow; text/number/date field border and focus glow in both themes.                                                | Correct invoice                     | Verified in all four variants. |
| `Screenshot 2026-10-09 232039.png` | Return title/status together; creation/supplier/location subtitle below; aligned Secondary policy and Primary next action.                                   | Return detail                       | Verified in all four variants. |
| `Screenshot 2026-10-09 232140.png` | About 640 px desktop policy dialog; five numbered titled steps without an inner card; Secondary download and Primary Close.                                  | Return policy                       | Verified in all four variants. |
| `Screenshot 2026-10-09 232254.png` | Waiting for credit uses amber for every underlying state; distinct readable Items/Status columns and consistent settlement tones.                            | Returns list; Return detail         | Verified in all four variants. |
| `Screenshot 2026-10-09 232510.png` | Intrinsic Remove plus ⋯ Stop tracking; Columns beside count; quick-add product/date/location/Add and More fields.                                            | Date quick-add; Lookup Dates        | Verified in all four variants. |
| `Screenshot 2026-10-09 232627.png` | Current active/scheduled offers group one row per product; Past retains history; identical submissions are idempotent and changed terms retain predecessors. | Current offers; Past offers         | Verified in all four variants. |

The owner's additional written requests for Products' two-line weighed price, Alerts' compact actions and unchanged round Approvals tabs have their own matrix scenes. Every other screen's actions and semantic widgets belong in the complete measured button audit.

## Executed evidence

Final local Node **22.23.3** verification: **771 unit tests in 67 files passed**, including all **23 unchanged seed pricing cases**. Lint/formatting and the typed production build passed. On the frozen production source `f96d36944bc72e16b09d8a7d25cc964d584dce23`, the **40 C5 browser checks and 14 additional conditional checks passed**, without skips or retries. These cover desktop/phone presentation, financial and permission regressions, quick-add/Lookup tracking with scoped Undo, immutable/idempotent offers, correction/reversal, return evidence and printing dialogs.

The complete GitHub browser suite contains **462 cases in 50 files**: the 408 existing cases plus these 54 C5 cases. Its desktop-only cases intentionally skip in the phone project. The [current PR checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/18/checks) rerun unit tests, lint, production build, all browser cases and service smoke checks on the final review commit. The pull request becomes ready only when both CI jobs pass on that final head. A local baseline from an earlier C5 source is not presented as final-source coverage.

The screenshot [capture results](redesign-screenshots/pr-c5/capture-results.json) record **60 actual images, zero browser errors and zero computed layout findings**, with 1,357 rendered controls measured. Before and after every image, 120 checks verified the same loaded production HTML/JavaScript/CSS fingerprint; the [build manifest](redesign-screenshots/pr-c5/build-manifest.json) records all 50 compiled-file hashes. Visual inspection and its image hashes are recorded separately from computed geometry.

The [complete button audit](PR_C5_BUTTON_AUDIT.md) includes **313 source callsites in 34 modules**, the required shape/size contract for each, and actual measurements for **598 distinct states across 133 screens/forms**, **15,227 rendered control instances**, and **134 count/Columns groups**. There are **zero measured violations and zero status-color conflicts across 100 observed status groups**. Four identical observations are counted once. [Raw audit JSON](PR_C5_BUTTON_AUDIT.json) retains the measurements and provenance. Source-only conditional controls are explicitly identified; the audit does not claim they were all clicked.

## Remaining scope

C5 preserves pricing, permissions, invoice/return settlements, original document bytes, exact label dimensions and seed records. Fast date entry and offer version handling are the authorized behavior updates. Several Lavash rows were retained historical versions mixed into the current list, and repeating Create lacked an exact-terms guard. C5 separates current/past and prevents identical repeats while preserving legitimate location-specific scopes and Undo.

Older offer records do not all have timestamps. Past uses retained stop/end/creation dates when available; otherwise newest retained insertion comes first. It does not invent an exact old stop time. New create/stop actions record timestamps; creating a stopped offer again preserves its retired version and appends the active one.

The screenshot matrix shows Supervisor views. Worker/Cashier permissions and branch privacy are verified separately through interaction tests. Persian captures are light theme; phone captures are English light. Physical printer alignment still depends on your printer and its existing test page; browser geometry does not verify a physical printer.

No real backend/auth/database/AI integration or paid hosting is included. The prototype uses browser-local fictional data and simulated invoice reading; Docker is not needed for its Node/npm quick-start. C5 is a review pull request and is not merged automatically. You can review the screenshots first without installing anything. C5 remains unmerged for your review; no action is needed until you choose to review or run it.
