# Pull request B — workflows and manual entry review

Review branch: **`feat/prototype-11-b-workflows`**. It includes approved A2 plus all three authorized B parts. Test this branch to review everything together; you do not need to combine the earlier pull requests yourself.

B adds the shared label waitlist/live A4 designer, custom notebooks, grouped Settings, recorded History/Revert, independently timed Undo toasts, Supervisor supplier/product creation, and manual invoices that use both shared creation forms. It also addresses the ten A2 presentation/copy corrections. Foundation/CI repair is a separate pull request.

This remains a browser prototype: saved changes and uploaded files stay in this browser on this computer. Real account administration, a backend/database and real AI are outside B. Item 30, AI reading look and feel, is deferred to Prompt 3D with real AI reading.

## 1. Start the review on Ubuntu

Docker is not required for this prototype. Use the commands below instead of `make setup` or `make up`.

1. Open Ubuntu **Files**, open **Supermarket-Inventory**, right-click empty space and choose **Open in Terminal**.
2. If your previous app is running, press **Ctrl+C** in that terminal first.
3. Paste these commands into the terminal opened at your project:

```bash
git fetch origin feat/prototype-11-b-workflows:refs/remotes/origin/feat/prototype-11-b-workflows
git switch feat/prototype-11-b-workflows
git pull --ff-only origin feat/prototype-11-b-workflows
git branch --show-current
```

The last line must print `feat/prototype-11-b-workflows`. `Already up to date` is normal. If Git says local changes would be overwritten or branches have diverged, stop and share the exact message. Do not delete files or use `git reset --hard`.

For a fresh copy, open a terminal where you keep projects and use this alternative:

```bash
git clone --branch feat/prototype-11-b-workflows https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
```

Check Node.js:

```bash
node --version
npm --version
```

Node must be **22.22.2 or newer in the 22.x series, below 23**. If a supported version is already active, skip the following installation. If Node is missing or a different major version is active, use:

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm use 22.22.2
node --version
```

Ubuntu may ask for your computer password after `sudo`. Characters do not appear while you type; press Enter when finished. Expect `v22.22.2` from the last command.

From the project folder:

```bash
cd prototype
npm ci
npm run build
npm run preview
```

Expect dependency installation to finish without an error, TypeScript/Vite to build successfully, and the preview to print an address on **5174**. Open **http://localhost:5174** in Firefox or Chrome on this Ubuntu computer. Keep the terminal open; **Ctrl+C** stops the app.

If the older page remains, press **Ctrl+Shift+R**. If 5174 is occupied, stop the old app in its terminal and run `npm run preview` again. If a command fails, copy the command and full error text. Do not repeatedly run `make setup` for this browser prototype.

### Sign in and choose appearance

1. Use **`supervisor`** / **`demo1234`** and click **Sign in**.
2. Select **Branch 1** in the top-bar pill. On phones, use the menu button to open sidebar navigation.
3. Use **EN | فا** for language and the sun/moon button for light/dark theme. Choices remain saved for this user/device.
4. Use **Demo → Switch to Demo Floor Worker** or **Switch to Demo Cashier** for role checks, then switch back to **Demo Supervisor**. Their sign-in accounts are `floorworker` / `demo1234` and `cashier` / `demo1234`.
5. **Demo → Reset demo** restores fictional business data. Use it only when you want to discard review edits. It preserves account/password and appearance preferences.

The existing `newemployee` account with temporary `temp1234` still requires choosing a new password before accessing the app.

## 2. Labels: live template, waitlist and printing

1. Open **Labels**. With no saved template, **Templates** opens first.
2. Enter template name **A4 shelf labels**. The initial example is 60mm × 40mm with the displayed margins/gaps.
3. Change **Width (mm)** from `60` to `70`. The A4 preview immediately redraws and capacity changes from **18** to **12 labels per sheet**. Set it back to `60`.
4. Try **Horizontal offset (mm)** `1`: the preview shifts by 1mm. Return it to `0` for the initial example. Click a preview slot or change **Starting slot**; the starting slot is highlighted and earlier slots are marked used.
5. Click **Save template**. The saved selector should show **A4 shelf labels**. Refresh, open Templates and select it to check persistence.
6. Open **Products**, search **`0003`**, set **Copies for 0003** to **`20`**, and click **Add to waitlist**.
7. Open **Waitlist**. Choose **A4 shelf labels** if necessary and set **Starting slot** to **`5`**. The list has 20 copies; the preview has two A4 sheets.
8. Try editing copies/removing a row, or **Add all filtered** on Products. Branch 2 has its separate waitlist. Return to Branch 1; an allowed coworker on this browser can share that branch list.
9. For alignment, open Templates and click **Print test alignment page**. For queued labels, open Waitlist and click **Print labels**.
10. In the print window choose your printer or **Save as PDF**, **A4**, **Actual size / 100%**, no browser margins, and disable headers/footers. Do not choose Fit to page. For a physical printer, measure the test rectangle before using adhesive paper.
11. After closing the print window, answer **Did the labels print correctly?** **No** preserves the waitlist if output is wrong or you cancelled. **Yes** removes the successfully printed items only after you checked them.

Pending products or unapproved prices remain blocked. Labels narrower than 50mm omit the logo; wider labels display it at least 8mm tall. Physical alignment must be checked on the actual printer.

## 3. Custom notebooks and permissions

1. As Supervisor, open **Notes → New notebook**.
2. Enter **Cold room checks** and **بازرسی سردخانه**. Select **Branch 1**.
3. In **Who can read**, retain Supervisor/Floor Worker and enable **Cashier**. Keep Cashier disabled in **Who can add**. Enable **Measurement** and enter unit **`°C`**.
4. Click **Save notebook** and open its Cold room checks tab.
5. Enter note **Morning cold room check**, measurement **`3.5`**, and click **Save note**. The saved entry includes author, branch, date and `3.5 °C`. Refresh: it remains saved.
6. On the entry, click **Edit note**, change the note/measurement, then **Save changes**. The update is recorded in History. Workers can edit their own allowed entry only within its original five-second window; Supervisor can edit allowed entries after that window.
7. **Edit notebook** changes its definition/permissions. Existing entries retain the unit recorded when they were added.
8. Switch to Floor Worker: allowed readers/contributors can read/add within their branch, but cannot create/edit/archive definitions.
9. Switch to Cashier: the granted custom notebook is readable, but the note form, definition editing and unpermitted built-in notebooks are absent.
10. Switch back to Supervisor and **Archive notebook**. The tab disappears, but searching **Morning cold room check** still finds its archived entry.
11. Open **Settings → Notes → Restore notebook** for Cold room checks. Return to Notes: the tab and earlier entry return.

The seeded **Deli temperatures** notebook supplies an immediate example. Built-in To order, Store use and For Supervisor behavior is retained.

## 4. Grouped Settings

Open **Settings**. The exact order is Company, Branches, People, Catalog, Pricing and approvals, Offers, Taxes, Receiving, Returns/date tracking/labels, Notes, Notifications, Modules, Data.

These seven areas work and save changes. Other groups show planned structure without a misleading Save button.

| Group                                     | What to click                                                                                                                                                                | Expected result                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Company**                               | Change bilingual name, currency/time zone, branding, language or text-size preference; click **Save changes**; refresh. Keep both EN/Persian enabled for translation review. | Values persist, relevant display preferences apply, History records edits, invalid time zones are rejected.               |
| **Branches**                              | **Add branch** → enter bilingual names/details → **Save changes**; open top-bar branch pill. Try Deactivate/Reactivate.                                                      | New branch works without code changes; deactivation hides active choices but preserves history.                           |
| **Catalog → Pricing categories**          | Enter cost/category in **Price tester**. **Add category**, enter names/divisor, apply, then **Save changes**. Refresh/select it.                                             | Decimal results update live; categories persist and feed other selectors. Approved product prices do not silently change. |
| **Offers**                                | Edit mappings/preferences or toggle **AI offer suggestions** → **Save changes**.                                                                                             | Preferences persist; real AI remains deferred.                                                                            |
| **Returns/date tracking/labels → Labels** | Edit label fields/languages or save a template in the live designer.                                                                                                         | Saved preferences are used by Labels; preview responds to dimensions/offsets.                                             |
| **Notes → Notebooks**                     | Edit fields/roles and save; archive/restore a review notebook.                                                                                                               | Definitions/permissions persist without deleting entries.                                                                 |
| **Modules**                               | Disable Returns → **Save changes**, then enable/save it again.                                                                                                               | Navigation hides/restores Returns; existing returns remain intact.                                                        |

On phones, swipe horizontally inside a wide table to reach its remaining columns/actions.

Typing alone does not save the grouped form; click Save changes where shown. Restore review settings before comparing against starting-seed screenshots.

## 5. History, Revert and corner Undo

1. As Supervisor, open **Cashier lookup**, search **`0009`**, and click **Edit Potato Chips…**.
2. Append **shelf review** to its English name and click **Save product**.
3. The English bottom-left charcoal toast offers **Undo** for five seconds. Click Undo: the original name returns; History adds **Undone** and retains the earlier Save product entry.
4. Edit again, wait for the toast to disappear, then open **History**.
5. Click **Revert** on the Save product row. The dialog shows actor/date/branch and before/after values. **Revert change** restores the old value and records a new reversal.
6. For conflict protection, save two successive name edits, then try reverting the older one. Confirmation must be disabled with an explanation that the record changed again.
7. Make several reversible edits quickly. Up to three toasts stack newest first, with **+N more** for extra active items. Each has its own five-second timer. Hover pauses only that toast; leaving resumes its remaining time. Persian mirrors the stack to bottom-right.
8. Posted invoices, stock movements, financial entries and prints use their normal correction workflows and do not offer simple Undo. Workers see only their own allowed History; Cashiers cannot use History/Revert.

## 6. Add a supplier

1. As Supervisor, open **Suppliers → Add supplier** at the top-right.
2. Enter **North Orchard Supply**, contact details, sales representative/phone and payment terms such as **Net 30**. Address/notes are optional.
3. Optionally enter Branch 1 opening balance **`125.50`** and check its **As of** date. Leave other branches blank.
4. Click **Add supplier**. Its page opens with **Confirmed** status. Branch 1 **Payables** shows the new amount from an **Opening balance** entry.
5. On the supplier page use **Edit** for details. **Deactivate** removes it from new-invoice choices while preserving history; there is no Delete action.
6. Try another name **Fresh Valley**. The warning links existing **Fresh Valley Foods**. Follow it to inspect the existing supplier, or explicitly confirm continuing with a distinct name.

Workers/Cashiers have no standalone Add supplier or opening balances. A worker may quick-add only inside an invoice; the supplier is **Proposed**, creates Supervisor review and blocks posting until confirmed.

## 7. Add a product

1. As Supervisor, open **Products → Add product**.
2. Enter **Orchard Oat Crackers**, **کراکر جو باغ**, unit **500 g**, category **Snacks**, pricing category **Grocery**, and your new supplier.
3. Enter unique barcode **ORCHARD-OAT-500** and last unit cost before tax **`1.4000`**. The pricing engine fills selling price.
4. Optionally enter Branch 1 starting count **`12`**, then click **Add product**.
5. The product is **Active**, receives the next unused Product Code, appears in History, and stock is backed by an **Opening count** movement.
6. Try editing the calculated selling price before saving. It records a manual override; a below-minimum-margin price requires a separate confirmation.
7. Another draft using an existing barcode must fail with an explanation. Similar names warn/link instead of silently reusing a product.

Codes are never reused. Workers/Cashiers have no standalone Add product or starting counts. Worker invoice quick-add remains pending until approval.

## 8. Manual invoice using both quick-add forms

To match the supplied original exactly, use a fresh browser profile, or use Demo → Reset demo only if you want to discard your review edits. This sequence creates the same North Orchard supplier/product shown in the screenshots; if you retain your earlier examples, choose those existing records instead of creating duplicates.

1. Open **Invoices → Manual entry**, next to Upload, as Supervisor.
2. Choose Branch 1, then Supplier **+ Add supplier**. Create **North Orchard Supply** with **Net 30** using the same form and save.
3. Enter supplier invoice number **ORCHARD-1001**, set invoice date **2026-10-08** to match the supplied invoice image, and check payment terms.
4. Click **+ Add new product**. Create **Orchard Oat Crackers** / **کراکر جو باغ**, unit **500 g**, Snacks category, Grocery pricing, unique **ORCHARD-OAT-500** barcode and cost **`1.4000`**. Save: its line appears.
5. Edit quantities/costs or add existing products as required.
6. Click **Save as draft** without an original: draft saves, **Post invoice** remains unavailable.
7. Attach a fictional photo/PDF. You can use `docs/redesign-screenshots/pr-b/fictional-orchard-1001.png` from this project for this review. Your manually entered lines must remain unchanged.
8. Complete the existing line review: answer the old-stock question, confirm every line, and supply required dates/received quantities. Posting becomes available only with an original and all reviews complete.
9. Click **Post invoice** and inspect the posted record, received stock and supplier ledger. Do not post a second copy of the same draft.
10. Check worker invoice supplier quick-add: Proposed status keeps posting blocked until Supervisor approval. Workers do not get the Supervisor manual workflow or opening balances/counts.

## 9. A2 corrections to inspect

- **Products, Offers, Date tracking, Returns, Notes:** toolbar controls are 44px tall, searches have icons/placeholders, select wording is complete. Products has no large toolbar/table gap; sortable headings use muted 13px text/small arrows.
- **Date tracking/Dashboard:** pills and short branch names stay on one line.
- **Invoice review:** wider product column and one muted approved-price note.
- **Dashboard:** cards share row height; the eight-week chart uses dates/hover amounts without a repeated totals list.
- **Returns:** open #1 has **Record pickup** and **Cancel return**, normal title size, and resolution appears after pickup.
- **Approvals:** review dialog fits its last table column within 720px or wraps its heading.
- **Counts/copy:** one matching note reads **1 note**. The removed operational disclaimers are gone; the invoice simulation note remains, with “Demo with fictional data” inside Demo.

Repeat the main features in dark theme, Persian, and a narrow phone browser.

## 10. Automated checks and screenshots

Executed local results for this release used Node **22.23.3**:

| Check                       | Result                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests                  | **357 passed**, across 24 files, including every pricing fixture and business-rule regressions.                                            |
| Lint/formatting             | Passed.                                                                                                                                    |
| TypeScript/static build     | Passed.                                                                                                                                    |
| Desktop/phone browser tests | **216 passed, 4 intentional phone skips, 0 failures and 0 flaky results** (220 scenarios).                                                 |
| Screenshots                 | **64**, with 16 each in English light, English dark, Persian and phone width; zero runtime errors or recorded presentation-check failures. |

The four skipped phone cases cover desktop-only search/navigation geometry, the 1080p sidebar, mouse hover timing and a desktop sticky pane. Their desktop counterparts passed; phone workflows ran separately. Full browser results are recorded in the pull request. Those tests cover the retained workflows, new labels/notebooks/Settings/History/Undo/manual entry, role/branch permissions, Persian and phone layouts.

These optional commands run the same checks from `prototype/`, after stopping preview with Ctrl+C:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

Unit tests include all pricing cases/business rules. Lint checks code/formatting; build checks types. Playwright launches desktop/phone Chromium and starts the built preview itself. Its first installation may request your Ubuntu password for system dependencies. A failed command or a run with no tests is not a pass.

The screenshots use real interface actions in fresh browser profiles. Templates, waitlists, notebooks, suppliers/products, manual drafts and edits are created through the UI. The controlled Playwright clock clears ordinary expired toasts before each image and retains the five-second stack only for the Undo scene. Business data is never injected and screenshots are never edited. The matching review original is a generated invoice document, supplied as PDF and rendered PNG; the screenshot upload uses PNG because managed cloud Chromium blocks embedded PDF viewing. [Capture results](redesign-screenshots/pr-b/capture-results.json) record language/theme, dimensions, runtime errors and presentation checks.

| Screen                                | English light                                                           | English dark                                                           | Persian                                                                 | Phone, 390px                                                         |
| ------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Dashboard                             | [Open](redesign-screenshots/pr-b/dashboard-en-light.png)                | [Open](redesign-screenshots/pr-b/dashboard-en-dark.png)                | [Open](redesign-screenshots/pr-b/dashboard-fa-light.png)                | [Open](redesign-screenshots/pr-b/dashboard-phone.png)                |
| Saved label template/live preview     | [Open](redesign-screenshots/pr-b/label-template-preview-en-light.png)   | [Open](redesign-screenshots/pr-b/label-template-preview-en-dark.png)   | [Open](redesign-screenshots/pr-b/label-template-preview-fa-light.png)   | [Open](redesign-screenshots/pr-b/label-template-preview-phone.png)   |
| Label waitlist                        | [Open](redesign-screenshots/pr-b/label-waitlist-en-light.png)           | [Open](redesign-screenshots/pr-b/label-waitlist-en-dark.png)           | [Open](redesign-screenshots/pr-b/label-waitlist-fa-light.png)           | [Open](redesign-screenshots/pr-b/label-waitlist-phone.png)           |
| Custom notebook                       | [Open](redesign-screenshots/pr-b/custom-notebook-en-light.png)          | [Open](redesign-screenshots/pr-b/custom-notebook-en-dark.png)          | [Open](redesign-screenshots/pr-b/custom-notebook-fa-light.png)          | [Open](redesign-screenshots/pr-b/custom-notebook-phone.png)          |
| Settings: Company                     | [Open](redesign-screenshots/pr-b/settings-company-en-light.png)         | [Open](redesign-screenshots/pr-b/settings-company-en-dark.png)         | [Open](redesign-screenshots/pr-b/settings-company-fa-light.png)         | [Open](redesign-screenshots/pr-b/settings-company-phone.png)         |
| Settings: Branches                    | [Open](redesign-screenshots/pr-b/settings-branches-en-light.png)        | [Open](redesign-screenshots/pr-b/settings-branches-en-dark.png)        | [Open](redesign-screenshots/pr-b/settings-branches-fa-light.png)        | [Open](redesign-screenshots/pr-b/settings-branches-phone.png)        |
| Settings: Catalog/pricing             | [Open](redesign-screenshots/pr-b/settings-catalog-pricing-en-light.png) | [Open](redesign-screenshots/pr-b/settings-catalog-pricing-en-dark.png) | [Open](redesign-screenshots/pr-b/settings-catalog-pricing-fa-light.png) | [Open](redesign-screenshots/pr-b/settings-catalog-pricing-phone.png) |
| Settings: Offers                      | [Open](redesign-screenshots/pr-b/settings-offers-en-light.png)          | [Open](redesign-screenshots/pr-b/settings-offers-en-dark.png)          | [Open](redesign-screenshots/pr-b/settings-offers-fa-light.png)          | [Open](redesign-screenshots/pr-b/settings-offers-phone.png)          |
| Settings: Labels                      | [Open](redesign-screenshots/pr-b/settings-labels-en-light.png)          | [Open](redesign-screenshots/pr-b/settings-labels-en-dark.png)          | [Open](redesign-screenshots/pr-b/settings-labels-fa-light.png)          | [Open](redesign-screenshots/pr-b/settings-labels-phone.png)          |
| Settings: Notebooks                   | [Open](redesign-screenshots/pr-b/settings-notebooks-en-light.png)       | [Open](redesign-screenshots/pr-b/settings-notebooks-en-dark.png)       | [Open](redesign-screenshots/pr-b/settings-notebooks-fa-light.png)       | [Open](redesign-screenshots/pr-b/settings-notebooks-phone.png)       |
| Settings: Modules                     | [Open](redesign-screenshots/pr-b/settings-modules-en-light.png)         | [Open](redesign-screenshots/pr-b/settings-modules-en-dark.png)         | [Open](redesign-screenshots/pr-b/settings-modules-fa-light.png)         | [Open](redesign-screenshots/pr-b/settings-modules-phone.png)         |
| History                               | [Open](redesign-screenshots/pr-b/history-en-light.png)                  | [Open](redesign-screenshots/pr-b/history-en-dark.png)                  | [Open](redesign-screenshots/pr-b/history-fa-light.png)                  | [Open](redesign-screenshots/pr-b/history-phone.png)                  |
| Stacked Undo                          | [Open](redesign-screenshots/pr-b/stacked-undo-en-light.png)             | [Open](redesign-screenshots/pr-b/stacked-undo-en-dark.png)             | [Open](redesign-screenshots/pr-b/stacked-undo-fa-light.png)             | [Open](redesign-screenshots/pr-b/stacked-undo-phone.png)             |
| Add supplier                          | [Open](redesign-screenshots/pr-b/add-supplier-dialog-en-light.png)      | [Open](redesign-screenshots/pr-b/add-supplier-dialog-en-dark.png)      | [Open](redesign-screenshots/pr-b/add-supplier-dialog-fa-light.png)      | [Open](redesign-screenshots/pr-b/add-supplier-dialog-phone.png)      |
| Add product                           | [Open](redesign-screenshots/pr-b/add-product-dialog-en-light.png)       | [Open](redesign-screenshots/pr-b/add-product-dialog-en-dark.png)       | [Open](redesign-screenshots/pr-b/add-product-dialog-fa-light.png)       | [Open](redesign-screenshots/pr-b/add-product-dialog-phone.png)       |
| Manual invoice using both new records | [Open](redesign-screenshots/pr-b/manual-invoice-en-light.png)           | [Open](redesign-screenshots/pr-b/manual-invoice-en-dark.png)           | [Open](redesign-screenshots/pr-b/manual-invoice-fa-light.png)           | [Open](redesign-screenshots/pr-b/manual-invoice-phone.png)           |

## What remains and what Ali needs to do

No additional input or installation is needed to finish development checks. Ali can review screenshots or use the Ubuntu click paths above. Physical printer alignment needs its test page checked on that printer. Real AI/item 30 belong to Prompt 3D. Planned Settings groups, production hosting/accounts/backend and previously out-of-scope integrations are not claimed as implemented.
