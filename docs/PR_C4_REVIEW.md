# C4 review: invoices, orders, weighed items, dates and returns

C4 is based on C3. Running the C4 branch includes both pull requests, so you can review them together. Start with [the C3 presentation and navigation guide](PR_C3_REVIEW.md), then use the checks below for the added workflows.

This is a fictional frontend prototype. It runs on your Ubuntu computer, uses your browser to retain demo changes and files, and simulates invoice reading. Docker is not needed.

## Run the combined C3 and C4 prototype on Ubuntu

### 1. Open your project terminal

Open Ubuntu **Files**, open your `Supermarket-Inventory` folder, right-click an empty area and choose **Open in Terminal**. If a previous demo is running in another terminal, return to that terminal and press **Ctrl+C** once to stop it.

Run these commands from the `Supermarket-Inventory` folder:

```bash
git status --short
git fetch origin feat/prototype-c4-workflows:refs/remotes/origin/feat/prototype-c4-workflows
git switch feat/prototype-c4-workflows
git pull --ff-only origin feat/prototype-c4-workflows
```

The first command should print nothing. If it lists changed files, keep those files. If Git refuses to switch because they would be overwritten, stop and send the exact message; do not discard your work. The other commands should report that you are on `feat/prototype-c4-workflows`, followed by `Already up to date` or a list of downloaded changes. The explicit fetch command downloads the review branch even when your original clone was configured to fetch only `main`.

If `git switch` says the branch is unknown after a successful fetch, run `git switch -c feat/prototype-c4-workflows origin/feat/prototype-c4-workflows`, then repeat the `git pull --ff-only` command above. If Ubuntu says `git: command not found`, run `sudo apt-get update` and `sudo apt-get install -y git`, then repeat the Git commands.

If you do not have a copy of the repository, open a terminal in the folder where you keep projects and run this instead:

```bash
git clone --branch feat/prototype-c4-workflows https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
```

### 2. Activate the supported Node.js version

Node.js runs the frontend build tools. The supported version is **22.22.2 or a newer 22.x version below 23**.

If you already installed nvm using the earlier Ubuntu guide, run:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm use 22.22.2
node --version
npm --version
```

Expect `node --version` to show `v22.22.2`, or another supported 22.x version if you selected one. If the terminal says the nvm file is missing or `nvm: command not found`, install it with these commands, then repeat the commands above:

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Ubuntu may ask for your computer password after `sudo`. The terminal does not show characters while you type it; type the password and press Enter.

### 3. Install, build and open the app

From the repository root, run:

```bash
cd prototype
npm ci
npm run build
npm run preview
```

Expected results:

- `npm ci` installs the versions recorded in this branch.
- `npm run build` completes the TypeScript check and Vite production build without errors. A bundle-size advisory alone does not mean the build failed.
- `npm run preview` prints a local address on port **5174** and keeps running.

Keep that terminal open. Open Firefox or Chrome and enter **http://localhost:5174** in the address bar. Sign in with username **supervisor** and password **demo1234**.

If you see a blank page or an earlier version, check that the terminal reports port 5174, then press **Ctrl+Shift+R** in the browser. If Vite reports that port 5174 is already in use, stop the earlier demo with **Ctrl+C** in its terminal and run `npm run preview` again. If installation or the build fails, copy the first error and the output of `node --version`; do not continue with an old build.

## Review controls and saved data

- Use the top-bar **EN | فا** control for language and the sun/moon button for light or dark theme.
- The Supervisor's location pill selects **North York**, another location, or **All branches**. Workers and cashiers retain their allowed locations.
- **Demo → Switch to Demo Floor Worker** and **Demo → Switch to Demo Cashier** change the fictional account for role checks. Switch back using **Demo → Switch to Demo Supervisor**. On a phone, open the sidebar using its top-bar button to reach page links.
- **Demo → Reset demo → Reset demo** restores the starting fictional business data and discards your demo edits and uploaded demo files. Use it if you want the fresh packs and weighed-product examples. Saved account passwords and display preferences remain.
- Existing browser data receives an additive update only after the app saves and verifies an exact backup. The backup key is `supermarket-prototype-before-c4`. Existing custom prices, packs, transactions and uploaded files are retained. Refreshing does not reset your work.

You can test the following sections in any order. For an exact fresh-data example, reset the demo before that section; resetting also discards changes made in the earlier sections.

## Posted invoice, retained original and correction

1. As Supervisor, choose **North York**, open **Invoices**, and open the posted **FV-20390** invoice. The page shows a readable document with header, lines, received decisions and totals. It must not show greyed-out editing fields or a draft auto-save message.
2. Find **Original invoice**. The fictional image should show Fresh Valley Foods, its bill-to location, invoice number, packs, lines and matching totals. Use its zoom controls and **Download**. Refresh and reopen the invoice; the retained original should remain available.
3. Click **Correct invoice**. Its fields start with the current posted values. In the first Canned Fava Beans line, change **Unit cost before tax** from `0.9800` to `1.0100`. Leave its quantity and pack unchanged. Enter `Correct the bean unit cost` in **Reason (required)**.
4. Click **Preview correction**. For the fresh FV-20390 example, the payable increases by **$0.72**: 24 units × $0.03. Review the payable, Received, approval and Date tracking effects before proceeding. Existing payment allocations remain visible.
5. Click **Continue**, read the confirmation and confirm the correction. The invoice should show **Corrected**. This creates a linked correction; it does not overwrite the original. Financial/legal corrections have no Undo message.
6. Open **History**, find the **Correct invoice** action and open its **View original** and **View corrected** links. If there is an earlier correction, its **View previous version** link is available too. The original still shows the old cost and original file; the current document shows the corrected cost. Open **Received** to check the corresponding latest corrected receipt details.
7. Switch to Floor Worker, reopen that invoice and check that **Correct invoice** is unavailable. Workers can read their authorized document; correction is Supervisor-only.

A correction can be blocked when a later delivery or supplier-return record relies on the quantity, product or pack being changed. The preview identifies the affected line. Preserve that later evidence and try a permitted cost/date correction, or resolve the linked workflow first.

## Uploads, PDFs and a manual invoice without an original

1. As Supervisor, open **Invoices → New invoice → Manual entry**. A manual invoice without a file shows **No original attached** and **Attach original**. Floor Workers can start **Invoices → New invoice → Upload** for their permitted file-based flow; Manual entry remains Supervisor-only.
2. Click **Attach original** and use the styled dropzone to attach a harmless test invoice photo or PDF. The selected file should appear in **Original invoice**. A photo fits the panel and supports zoom; a PDF has page navigation and **Download**.
3. Save the draft, refresh and reopen it from Drafts. The same original should remain. As Supervisor, you may also attach an original to an authorized posted manual invoice that has none; the attachment is audited without changing its money or receipt.
4. If you test posting, complete every required invoice field and line decision first. Posting still requires a valid original and a confirmation. The app's AI reading remains simulated; attaching a file does not connect to real AI.

The file-picker window that opens after clicking the custom dropzone belongs to your operating system. The app itself should not show a default **Choose File / No file chosen** field or a native PDF toolbar.

## Realistic packs, temporary New items and order comparison

1. As Supervisor, open **Received** and inspect FV-20390. Canned Fava Beans should show **2 cases (24 units)** with a 12-unit pack; Lavash uses a 10-unit pack. Invoice totals stay unchanged.
2. Open **Orders → New order**, select **Fresh Valley Foods**, and inspect the existing items. Short quantity/cost fields remain together and the item area uses the available page width.
3. Click **New item**. Enter `Sample barley biscuits` as **Name**, `12` as **Units per case (optional)**, `2` as **Cases**, and `1.25` as **Expected unit cost (optional)**. Click **Add item**. The temporary line should show a **New item** pill and an expected total of **$30.00**. Optional pack/cost fields may be left empty; an unknown estimate must remain visibly incomplete instead of being invented.
4. Click **Save as draft**, reopen the draft, then **Place order** when you are ready. Open **Print order**. The complete A4 page is scaled into the preview; the New item pill remains, and each English heading sits with its matching Persian heading, including Cases and Units. Cancel the browser print window if you only want to inspect the preview.
5. Open **Invoices**, create or review a draft for Fresh Valley Foods and use **Order (optional)** to select the order you just placed. In **Compare with order**, product names and difference choices must remain visible.
6. For the temporary item, use **Match invoice line — Sample barley biscuits** to select its actual invoice line. Choose or create the actual product for that line, complete the required pack/quantity/cost/date decisions and attach the original. Matching is explicit; similar names alone do not select a product.
7. After a confirmed posting, open the supplier's **Supplier items** tab. The actual product is associated with the supplier and the temporary order line retains its link. Reopening or refreshing must not create a duplicate association or receipt.
8. At phone width, repeat **New order → New item**. Each order item becomes a card with Cases and Expected cost visible. The items must not require sideways scrolling.

## Weighed products and pricing settings

1. With fresh demo data, open **Lookup** and search for Product Code **0016**, **Bulk Almonds**. Expect **$7.49/lb** with **$16.51/kg** smaller beside it. Repeat as Cashier and Floor Worker; selling prices remain visible while Supervisor-only costs and margins stay private.
2. Switch back to Supervisor, open **Products**, search for `0016` and click **Edit**. **Sold by** should be **Weight**, and the editable selling-price label names the unit. Each products keep their per-unit label and existing pricing rules.
3. Open **Labels → Products**, search for `0016`, select it and use the bottom bar to add one copy to the waitlist. Open **Waitlist** and inspect the label: the weighed prices include `/lb` and the optional `/kg` line. Existing print dimensions remain unchanged.
4. As Supervisor, open **Settings → Pricing and approvals → Weighed items**. Defaults are **Main display unit: lb**, **Show second unit: on**, and **Use rounding bands: on**. Select kg, save changes, and revisit Lookup to inspect the alternate presentation. Display settings do not silently rewrite an already approved price. Use Undo to restore the setting if offered.
5. In an invoice line for a weighed product, enter its source quantity in kg or lb with up to three decimal places and select the cost unit. A weighed case uses its actual case weight and kg/lb unit. The documented example is **$11.00/kg → $4.9895/lb cost → $7.49/lb rule selling price**. The ordinary Each and rice calculations still use their existing rules.

## Date tracking and its Undo

1. As Supervisor, open **Products**, edit a product and set **Date tracking** to **Yes**. The editor offers **Add a date now**. Save the product, then start or select an invoice line for it: **Track date? Yes** is pre-selected, and the date is still required. Setting No pre-selects No; a product with no choice still asks.
2. Open **Date tracking → Add date**. Choose a product, allowed location, **Expiry** or **Best before**, and a calendar date. Quantity, lot and note are optional. Click **Add date**. The entry should appear and offer Undo; entering a date does not create inventory or money.
3. Search for the product in **Lookup** and **Products**. Its next scoped tracked date should appear, with an appropriate warning pill when it is inside the configured warning window. Both pages also offer **Add date** for authorized staff.
4. Return to **Date tracking**, find the new date and click **Remove**. Choose **Sold out**, **Thrown away**, **Returned to supplier** or **Entered by mistake**, then confirm. The entry leaves the open list and remains available through the **Removed** filter.
5. Click **Undo** in the approximately ten-second message to restore the open date. The message sits at the lower-right in English and lower-left in Persian. Hovering or keyboard focus pauses that message while you inspect it.
6. Use **Stop tracking this product**. Review whether to keep or remove its open dates, then confirm. The product's Date tracking setting turns off, the chosen date treatment is retained and a safe Undo is available. Removed history is retained.

## Returns, the retained Return memo and Payables

1. For a fresh example, reset the demo, choose **North York** and open **Returns**. **Open** contains Waiting for pickup or Waiting for credit; **History** contains closed and cancelled records. The previous Returned to stock column is absent.
2. Open the Fresh Valley Foods return and click **Record pickup**. Enter the quantity actually picked up, a fictional **Supplier representative name** and a fictional **Signed paper pickup slip reference**. Record the pickup. A retained reference such as **RM-0001** should appear.
3. Open that RM reference. The bilingual Return memo includes supplier, location, date, picked-up quantities, snapshotted unit costs, expected credit, driver name and signature line. Open its print preview, then close the browser print window if you do not want to print. Refresh and reopen it; it must remain the same retained memo.
4. As Supervisor, open **Payables**, find Fresh Valley Foods and click **View**. The supplier balance separates **Confirmed balance** from **Pending credit** and links back to the Return memo. With the default setting, the displayed amount owed is reduced by the actual pickup's expected credit. Pickup alone does not post a confirmed supplier credit.
5. Return to the claim and open its closing/settlement action. For **Credited**, record the credit-note number, supporting evidence, covered quantities and **Actual credit amount**, then confirm the Supervisor financial posting. A smaller actual credit releases the difference back to the owed balance. The documented example is $600 confirmed owed, $30 expected credit, then $25 actual credit: displayed owed moves **$600 → $570 → $575**. This arithmetic example is separate from the smaller fictional Fresh Valley demo balance.
6. In a separate claim/example, choose **Replaced** and link the actual replacement delivery or invoice with its product, quantity and coverage evidence. Your confirmed answer is applied: replacing the full $30 claim releases its pending deduction, so the example's displayed owed returns **$570 → $600**. The replacement creates no new purchase invoice or confirmed credit. A partial replacement retains the uncovered claim.
7. In another example, choose **Written off** and provide a reason. The expected deduction is released and the balance rises again. Existing evidence remains in History. Financial settlement uses confirmation and has no Undo.
8. As Supervisor, open **Settings → Returns/date tracking/labels → Returns**. **Deduct expected credit at pickup** defaults on; **Waiting-credit reminder (days)** defaults to **14**. An overdue waiting-credit claim appears in Alerts without duplicated reminders. Changes apply to later pickups rather than rewriting an existing memo's saved settings.
9. Open **Suppliers → Fresh Valley Foods → Returns and credits**. Its Open/History tabs should agree with Returns. Switch to Floor Worker and repeat: the permitted physical/evidence workflow remains, while money columns, pending-credit amounts and financial posting are inaccessible. Columns must not reveal hidden Supervisor amounts.

Cancellation still requires a reason and disposition of the original goods. A cancelled form does not prove supplier-held goods returned to the shop. Previously settled returns require Supervisor review and retain earlier replacement/credit evidence.

## Notebook names, Add location and role checks

1. As Supervisor, open **Notes → New notebook**. Click **Save notebook** without a name; the error belongs beside **Name (English)**. Typing only in **Name (Persian, optional)** must not clear the missing-English error. Type `Evening checks` in English; that error should clear immediately. Leave Persian empty and save.
2. Switch to **فا**. The notebook should still display **Evening checks** as its fallback name. Refresh; the name and access rules remain.
3. Open **Settings → Branches**. The action and dialog now say **Add location**, because Warehouse is a location too. Existing location permissions and selling settings remain.
4. Switch between Supervisor, Floor Worker and Cashier. Check C3's button visibility, custom controls, theme, Persian alignment and Back navigation alongside the new features. Supervisor-only balances, margins, pending-credit projections and financial posting must remain private in their relevant views and column choosers. Pickup documents retain the supplier evidence required for the physical workflow.

## Optional automated checks on Ubuntu

The executed review results are recorded below. You do not need to run these commands to review the screenshots. If you want to repeat the checks yourself, stop the preview with **Ctrl+C**, remain in `prototype/` with supported Node 22 active, and run:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

The first command runs pricing and workflow unit tests; lint checks source and formatting; build checks types and creates the compiled app. Playwright installs its browser and runs desktop/phone interface tests against the compiled build. A failed command prints an error: keep that output and send it with `node --version`.

## Verification status

The frozen application and seed source is **`cbdc2bf0afbc0b8f39d954d72efd32ef1892899a`**. The final evidence commit adds the screenshots, review records, guide and capture framing only; it does not change the application or seed used for these checks.

| Check                           | Executed result                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests                      | **719 passed across 62 files**, including all **23** cases in `seed/pricing-test-cases.json` and retained pricing boundary tests                                   |
| Lint and formatting             | **Passed**                                                                                                                                                         |
| Type check and production build | **Passed**; Vite's bundle-size advisory is informational                                                                                                           |
| New C4 browser checks           | **37 passed**, **9 intentionally skipped** duplicate desktop-only checks in the phone project; zero failures or retries                                            |
| Updated legacy browser checks   | **38 passed**, zero failures, skips or retries, covering the changed cases in eleven existing specifications on desktop and phone                                  |
| Desktop layout matrix           | English and Persian at **1280, 1440 and 1920 px**; all six checks passed with strict panel/table/text bounds                                                       |
| Screenshot capture              | **52 real-interface PNGs**, zero browser errors or layout/native-control findings; one frozen production asset fingerprint verified before and after every capture |
| Individual visual review        | All **52** exact PNGs opened individually and their SHA-256 hashes checked; zero remaining issues                                                                  |
| Fictional originals             | All **14** originals opened individually; retained image hashes and line/subtotal/tax/total arithmetic verified                                                    |
| Complete GitHub CI              | Open [C4's current Checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/17/checks) for the result on the latest evidence commit                     |

The browser checks exercise retained photo/PDF bytes and page navigation, correction versions and money, temporary order associations, all three roles' weighed prices and financial privacy, physical label dimensions, date/Undo persistence, return memo/pending-credit reconciliation, and notebook/location copy. The updated legacy assertions preserve money, stock, ledger, branch scope, original files, retained drafts, code allocation and supplier approval checks. An earlier diagnostic full run found obsolete pre-C4 fixture/presentation expectations; its failed result is not counted as a passing run. The complete final suite is the GitHub CI check linked above.

Machine-readable evidence is attached in [verification-results.json](redesign-screenshots/pr-c4/verification-results.json), [capture-results.json](redesign-screenshots/pr-c4/capture-results.json), [visual-audits.json](redesign-screenshots/pr-c4/visual-audits.json), [legacy-browser-results.json](redesign-screenshots/pr-c4/legacy-browser-results.json) and [demo-original-audit.json](redesign-screenshots/pr-c4/demo-original-audit.json).

## Screenshot index

All 52 final files below were captured from the frozen production build and opened individually. Each row has English light, English dark, Persian light and a **390 px** phone version. Phone scenes may focus on the relevant document, dialog or action. Desktop captures use 1440 px; the separate six-check width matrix also covers 1280 and 1920 px in both languages. Phones may pan inside appropriate data tables; order items become cards. A4 documents and 60 × 40 mm labels retain their physical print dimensions while their previews scale to fit.

| Scene                       | English light                                                            | English dark                                                            | Persian                                                                  | Phone                                                                 |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Posted invoice and original | [Open](redesign-screenshots/pr-c4/posted-invoice-original-en-light.png)  | [Open](redesign-screenshots/pr-c4/posted-invoice-original-en-dark.png)  | [Open](redesign-screenshots/pr-c4/posted-invoice-original-fa-light.png)  | [Open](redesign-screenshots/pr-c4/posted-invoice-original-phone.png)  |
| Correct invoice preview     | [Open](redesign-screenshots/pr-c4/correct-invoice-preview-en-light.png)  | [Open](redesign-screenshots/pr-c4/correct-invoice-preview-en-dark.png)  | [Open](redesign-screenshots/pr-c4/correct-invoice-preview-fa-light.png)  | [Open](redesign-screenshots/pr-c4/correct-invoice-preview-phone.png)  |
| Invoice compared with order | [Open](redesign-screenshots/pr-c4/invoice-order-comparison-en-light.png) | [Open](redesign-screenshots/pr-c4/invoice-order-comparison-en-dark.png) | [Open](redesign-screenshots/pr-c4/invoice-order-comparison-fa-light.png) | [Open](redesign-screenshots/pr-c4/invoice-order-comparison-phone.png) |
| New order with New item     | [Open](redesign-screenshots/pr-c4/new-order-new-item-en-light.png)       | [Open](redesign-screenshots/pr-c4/new-order-new-item-en-dark.png)       | [Open](redesign-screenshots/pr-c4/new-order-new-item-fa-light.png)       | [Open](redesign-screenshots/pr-c4/new-order-new-item-phone.png)       |
| Weighed Lookup              | [Open](redesign-screenshots/pr-c4/weighed-lookup-en-light.png)           | [Open](redesign-screenshots/pr-c4/weighed-lookup-en-dark.png)           | [Open](redesign-screenshots/pr-c4/weighed-lookup-fa-light.png)           | [Open](redesign-screenshots/pr-c4/weighed-lookup-phone.png)           |
| Weighed label               | [Open](redesign-screenshots/pr-c4/weighed-label-en-light.png)            | [Open](redesign-screenshots/pr-c4/weighed-label-en-dark.png)            | [Open](redesign-screenshots/pr-c4/weighed-label-fa-light.png)            | [Open](redesign-screenshots/pr-c4/weighed-label-phone.png)            |
| Add date                    | [Open](redesign-screenshots/pr-c4/add-date-en-light.png)                 | [Open](redesign-screenshots/pr-c4/add-date-en-dark.png)                 | [Open](redesign-screenshots/pr-c4/add-date-fa-light.png)                 | [Open](redesign-screenshots/pr-c4/add-date-phone.png)                 |
| Remove date                 | [Open](redesign-screenshots/pr-c4/remove-date-dialog-en-light.png)       | [Open](redesign-screenshots/pr-c4/remove-date-dialog-en-dark.png)       | [Open](redesign-screenshots/pr-c4/remove-date-dialog-fa-light.png)       | [Open](redesign-screenshots/pr-c4/remove-date-dialog-phone.png)       |
| Returns Open                | [Open](redesign-screenshots/pr-c4/returns-open-en-light.png)             | [Open](redesign-screenshots/pr-c4/returns-open-en-dark.png)             | [Open](redesign-screenshots/pr-c4/returns-open-fa-light.png)             | [Open](redesign-screenshots/pr-c4/returns-open-phone.png)             |
| Returns History             | [Open](redesign-screenshots/pr-c4/returns-history-en-light.png)          | [Open](redesign-screenshots/pr-c4/returns-history-en-dark.png)          | [Open](redesign-screenshots/pr-c4/returns-history-fa-light.png)          | [Open](redesign-screenshots/pr-c4/returns-history-phone.png)          |
| Return memo                 | [Open](redesign-screenshots/pr-c4/return-memo-en-light.png)              | [Open](redesign-screenshots/pr-c4/return-memo-en-dark.png)              | [Open](redesign-screenshots/pr-c4/return-memo-fa-light.png)              | [Open](redesign-screenshots/pr-c4/return-memo-phone.png)              |
| Payables pending credit     | [Open](redesign-screenshots/pr-c4/payables-pending-credit-en-light.png)  | [Open](redesign-screenshots/pr-c4/payables-pending-credit-en-dark.png)  | [Open](redesign-screenshots/pr-c4/payables-pending-credit-fa-light.png)  | [Open](redesign-screenshots/pr-c4/payables-pending-credit-phone.png)  |
| Undo                        | [Open](redesign-screenshots/pr-c4/undo-en-light.png)                     | [Open](redesign-screenshots/pr-c4/undo-en-dark.png)                     | [Open](redesign-screenshots/pr-c4/undo-fa-light.png)                     | [Open](redesign-screenshots/pr-c4/undo-phone.png)                     |

## Recorded rules and remaining limits

[Design language](design-language.md), [screens](screens.md), [workflows](workflows.md), [pricing engine](pricing-engine.md) and [return policy](return-policy.md) describe the implemented contracts. [Open questions](open-questions.md#c3c4-recorded-defaults-and-owner-resolutions-2026-10-09) records the weighed/display/return defaults. [Decision 019](decisions.md#019--c4-return-claims-versus-confirmed-settlement-2026-10-09) records your answer that replacement releases the expected-credit deduction and returns the example owed balance to $600.

The prototype has no backend, database, real AI, production authentication, automatic sales/inventory feed, email delivery, accounting integration or production deployment. Files and demo state are local to one browser profile; another computer does not automatically receive them. Roles and scope are exercised in the frontend for this demo; production server enforcement is a later implementation. The signed references and signatures entered during review are fictional evidence, not real supplier confirmations.

Browser checks verify full A4 previews and the labels' physical millimeter dimensions. A real printer's paper feed, margins and calibration cannot be tested in this cloud environment. Before using physical labels, print the existing alignment page on your printer and check its measurements.

C3 [#16](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/16) and C4 [#17](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/17) remain separate review pull requests and have not been merged. C4 includes C3, so use the C4 branch to review both together. The screenshot matrices and Ubuntu click paths are complete; the current GitHub Checks links show the latest full CI results. Your next action is to review both and report any remaining behavior or visual changes you want.
