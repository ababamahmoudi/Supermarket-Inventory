# C5 review: compact controls and fast dates

Branch: **`feat/prototype-c5-design-fixes`**. C5 starts from the approved C3/C4 merged main (`0767844`). C3 [#16](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/16) and C4 [#17](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/17) were merged in that order with their original commit history after passing checks. The subsequent [main integration run](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38023516156) passed before C5 began.

The prototype runs on your Ubuntu computer and saves fictional demo changes in that browser. Invoice reading is simulated. **Docker is not needed.** C5 changes only `prototype/` and `docs/`; the merged seed data and pricing rules stay unchanged.

## What changed

- Text action buttons use the C2 rounded rectangle: 12 px corners, 40 px height, width that fits their text. Secondary has a thin blue border/glow; Danger a red border/glow; Primary remains solid blue. Row actions sit together at the end, with rare actions in ⋯. Click names/references to open detail; redundant View buttons are removed.
- Top-bar controls share 40 px height/border/glow. The single round language button shows **فا** in English and **EN** in Persian. Fields/dropdowns are visible in both themes. Returns use consistent visible-label colors; Columns sits beside the count or Invoices card title.
- Posted invoices have an aligned header, paired totals and whole-page original preview with 25–400% zoom. Returns have a clearer header and 640 px numbered policy dialog. Products stacks weight prices and says Sold by weight.
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

Expect the branch name `feat/prototype-c5-design-fixes`, then `Already up to date` or downloaded changes. If switch says the branch is unknown after a successful fetch, run:

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

Use **Demo → Reset demo → Reset demo** only if you want to discard saved fictional business edits. It restores the starting examples and uploaded demo files; changed account passwords/display preferences remain. Your existing data need not be reset to use C5.

1. **Top bar:** click فا; the page switches to Persian/RTL and the button becomes EN. Click EN to return. Toggle the sun/moon. Search, location, notifications, text size and Demo should share the same height/glow. The user menu stays at the sidebar bottom.
2. **Products:** click the product name to open detail; use Back to Products. Supervisor Edit is compact; ⋯ contains Add date. Search the weighed item and check a price like `$7.49/lb` above smaller `$16.51/kg`, with Sold by weight.
3. **Invoices:** open Posted. Columns is beside the card title. Click **GG-11794** to open its posted document. Number/status share a line; Correct invoice and Move invoice match. Totals sit below the lines with adjacent amounts and bold Payable.
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

## Executed evidence

Final Node 22 verification: **767 unit tests in 65 files passed**, including all **23 unchanged seed pricing cases**; lint/formatting and the production build passed. Financial and permission regressions passed. The final desktop/phone browser suite, compiled-source fingerprints, 60 screenshots and complete measured button audit are being finalized in this draft; their completed evidence will replace this paragraph before the pull request is ready for review.

## Remaining scope

No real backend/auth/database/AI integration or paid hosting is included. Physical printer alignment still depends on your printer and its existing test page; C5 preserves the prior exact millimetre layout. C5 is a review pull request; it is not merged automatically. No technical setup or action is needed from you before the completed screenshots/results are supplied.
