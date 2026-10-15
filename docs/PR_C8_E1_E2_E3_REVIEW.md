# Review C8, E1, E2 and E3 together on Ubuntu

Use **`feat/prototype-e3-phones`** to try all four changes together. These are stacked pull requests: each later branch includes the earlier work. You do not need to merge four pull requests or download each branch separately to review them. Nothing new has been merged into `main`.

| Pull request | What it adds | Branch | Built on |
| --- | --- | --- | --- |
| [C8 — #21](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/21) | Layout corrections, temporary sales, permanent prices, requests and sale-cost alerts | `feat/prototype-c8-sales-fixes` | `main` |
| [E1 — #22](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/22) | Five roles, People, assigned locations, setup and sign-in rules | `feat/prototype-e1-location-roles` | C8 |
| [E2 — #23](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/23) | Store price-update tasks, checklists, progress and personal notifications | `feat/prototype-e2-price-updates` | E1 |
| [E3 — #24](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/24) | Phone list rows, installation/offline assets and phone-hosting instructions | `feat/prototype-e3-phones` | E2 |

The demo uses fictional records stored in one browser. The **Demo** menu switches people in that browser. Your phone, another browser profile and another site address each have separate records; they do not synchronise. A prototype sign-in or simulated passkey is not production authentication.

## 1. Install the tools on a fresh Ubuntu Desktop

If Git and Node 22.23.3 are already installed, go to step 2. Otherwise open **Terminal** with **Ctrl+Alt+T**. Run each block separately and wait until it finishes.

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
```

Ubuntu may ask for your Ubuntu password. Nothing appears while you type it; press Enter. Expect both commands to finish without an error.

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.23.3
nvm alias default 22.23.3
nvm use 22.23.3
node --version
npm --version
```

Expect `v22.23.3` and an npm version. If `nvm` is not found, close and reopen Terminal, then repeat the `export`, `.`, and `nvm` lines. This frontend review needs **no Docker, Docker Desktop or `make setup`**.

## 2. Download or update the combined branch

If you have never downloaded this repository, run:

```bash
cd ~
git clone --branch feat/prototype-e3-phones https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
```

If the folder already exists, first run only:

```bash
cd ~/Supermarket-Inventory
git status --short
```

No output means there are no changed files. If files are listed, keep them and stop before switching branches; do not delete or discard them. When there are no changed files, run:

```bash
git fetch origin
git switch feat/prototype-e3-phones
git pull --ff-only origin feat/prototype-e3-phones
```

`--ff-only` refuses to overwrite different local history. If Git refuses the switch or pull, save the complete message; do not use `reset --hard` to force it.

## 3. Build and open the app

From `~/Supermarket-Inventory` run:

```bash
git branch --show-current
cd prototype
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort
```

Expect the branch name **`feat/prototype-e3-phones`**, a completed dependency installation, a successful TypeScript/Vite build and **`http://127.0.0.1:5174/`**. Leave Terminal open. Open Chrome or Firefox **inside Ubuntu Desktop** and enter **http://localhost:5174**. You should see Sign in. A funding notice or chunk-size warning is harmless when the command succeeds.

If the port is occupied, stop your earlier demo Terminal with **Ctrl+C**, then start preview again. If installation/build fails or the page is blank, keep the full Terminal error together with `node --version` and the branch name. Do not proceed past a failed build. The [phone guide](phone-demo-hosting.md) has VM, Wi-Fi and firewall troubleshooting.

## 4. Start from the intended demo accounts

Sign in with **Username `manager`**, **Password `demo1234`**. Choose **Use simulated passkey** when the second step appears. These credentials apply to a fresh/reset demo; a password you previously changed is preserved by normal updates.

For repeatable results, open the small **Demo** menu, choose **Reset demo** and read its confirmation before confirming. This discards this browser's fictional business/People changes and restores the six supplied people; do not reset a review you want to keep. If sign-in appears again, use `manager` / `demo1234`.

| Username | Role | Locations |
| --- | --- | --- |
| `owner` | Owner | All, including Warehouse |
| `manager` | Manager | All, including Warehouse |
| `rh-supervisor` | Branch Supervisor | Richmond Hill and Newmarket |
| `ny-floor` | Floor Worker | North York |
| `wh-floor` | Floor Worker | Warehouse |
| `cashier` | Cashier | North York and Richmond Hill |

All six use `demo1234` after a reset. The old `supervisor` username signs into the same Manager; it does not add a seventh person. After initial sign-in, switch through **Demo → Switch to Demo Manager**, **Demo Richmond Hill Supervisor**, **Demo North York Floor Worker**, **Demo Warehouse Floor Worker** or **Demo Cashier**, as appropriate. The menu's names are the supplied fictional people.

## 5. C8: check the corrected screens and sales

1. As Manager, choose **North York** in the location pill. Open **Products → Black Tea 450 g → Edit**. Sections have separators; dropdowns fill their columns. With Date tracking set to Yes and no date, **Save product** must show **Add an expiry date, or turn off date tracking** and focus its date field. Pick a valid future date and Save without pressing Add; the date must be retained. If the product already has an open date, first use a product with no open dates or remove the demo dates through their ordinary controls.
2. Open **Labels → Products**. The list grows inside its card; rows stay inside it and selection remains usable. Open **Orders → New order**: headers, quantities, case costs and totals align. Cancel the order if you do not intend to save it.
3. Open **Products → Stainless Steel Pot 24 cm** (`0012`). Its page has three summary cards and separate Details, Prices by store, Deliveries, Lots, Cost history and History cards. At North York the starting sale is **$16.99**, with **Regular $20.99** crossed out. **Lookup → search `0012`** shows the same actual customer price and sale end date. The fixture's date is relative to demo creation, not a promised fixed calendar date.
4. On a different product, open **Change price**. Try entering its regular price as a Sale: saving is blocked. Try a below-margin price: acknowledgement is required; below-cost also needs a reason. Cancel rather than change this review's other fixtures.
5. On a Product page, change only the code in the address from `#product?code=0016` to `#product?code=0006` and press Enter, then use browser Back/Forward. Both product content and breadcrumb follow the address.
6. Review **Received, Returns, Suppliers, Payables, Date tracking, Offers, History and Settings → Company**. Look for end-position row arrows, filled filters inside cards, readable money, compact date alerts and the logo/colour swatches. Repeat in Persian and dark theme. The [C8 review](PR_C8_REVIEW.md) describes the remaining individual checks; its old Supervisor/Floor Worker names are replaced by the six users above on the combined branch.

## 6. E1: People and location permissions

1. Switch to Manager. Open **Settings → People**. Search/filter the six demo people. Open **Add person** and enter fictional English name `Review Person`, username `review-person`, and email `review-person@example.com`. Choose **Floor Worker**, select **North York**, then save. Copy the **One-time setup code** before closing its dialog; it is shown once. No real invitation is sent.
2. Sign out through the account menu. Sign in as `review-person` using that setup code, then choose and confirm a new password when prompted. The new person sees only the allowed location and actions. Sign back in as Manager. If testing a privileged new person's second step, invite a Branch Supervisor with a different username; use the simulated passkey/authenticator setup shown by the app.
3. In People, edit the invited/test person's role or assigned locations and give a reason. History retains before/after. Deactivate that test person with a reason: the records remain, and their local sessions are revoked. Reactivate through People if needed. The app rejects changing your own role/deactivating yourself or removing the last usable Owner.
4. Switch to **Demo Richmond Hill Supervisor**. The location pill offers Richmond Hill, Newmarket and **All my locations**. It does not offer North York, Warehouse or company-wide All locations. The location dashboard has operational cards without supplier balances. At an aggregate location, choose an actual Store before an operation that needs one.
5. Switch to **Demo Cashier**. Lookup is available; private costs, Payables and People are unavailable. Switch to **Demo Warehouse Floor Worker**: Warehouse remains its only assignment and receives no price-update task.
6. Switch to Manager, choose North York and open **Invoices → New invoice → Manual entry**. Wait for the new form before typing; New/Manual/original-file transitions must not put edits onto the previous draft. Cancel or leave the fictional draft if it is not part of your intended invoice review.

## 7. E2: Black Tea price change → store task → completion

Start this script from **Reset demo** so the given prices match. Use the same browser for every person switch.

1. As Manager select **All locations**, then open **Alerts**. Find Black Tea and choose the **North York** row's **Apply this price to all**, then confirm **Apply price to all branches**.
2. North York and Newmarket already charge **$6.49**. Richmond Hill changes from **$6.99 → $6.49**. Only Richmond Hill should receive a task; a Store whose price did not change and Warehouse should not receive invented tasks.
3. Switch to **Demo Richmond Hill Supervisor**, choose **Richmond Hill**, then **Price updates**. Open the Black Tea task. Review old/new price, location, reason and deciding person. Open the bell: the real person's task notification opens that permitted task. **Mark all as read** updates the unread count.
4. Before completing the task, switch to **Demo Cashier**, choose **Richmond Hill**, open **Lookup**, search `0004` and press Enter. The new customer price is **$6.49** with **Price changed** and the crossed-out old **$6.99**. This is the moment to check the pending Cashier pill.
5. Switch back to the Richmond Hill Supervisor and reopen the task. **Changed on the cash register** is a manual staff confirmation: the prototype does not connect to a real register. For this fictional review, tick it to represent the work being done.
6. Choose **Print label now**. Review the real label preview/browser print flow. Afterward answer **No** to **Did the labels print correctly?** once: **New label printed** must stay unconfirmed. If you actually print successfully, repeat and answer Yes. Opening a preview or adding to the label waitlist is not proof of printing. Without a printer, choose the permitted **No label needed**, enter an honest fictional-review reason, then choose **Save reason**. Do not claim a physical print by answering Yes when nothing printed.
7. With register confirmation plus a real print confirmation or allowed waiver, choose **Mark as done**. The task moves to Done. The Cashier's ordinary Price changed pill disappears.
8. Switch to Manager → **Price updates → Store progress**. Richmond Hill shows Done with the actual completing person and time. This fixture has no other changed Store to show as pending; create another real change if you want to inspect multiple Stores.
9. Manager → **Settings → Notifications** shows event-role choices and 24/48-hour reminder settings. Floor Workers can do permitted label work but not confirm a register change or grant a managerial no-label waiver; Floor completion is off by default. Calendar/reminder timing is covered by automated checks rather than asking you to wait two days.

## 8. Sales request and all-Store task script

Start from a separate **Reset demo** if you want the supplied request and prices back. Reset discards the preceding script's changes.

1. Switch to **Demo North York Floor Worker**. Products/Lookup → Sunflower Oil `0008` shows the existing **Sale requested $7.99** while the approved price remains **$9.49**. There is already a pending request in this fixture.
2. To test sending your own fresh request, open **Offers**, find the requested Sunflower Oil row, choose **Withdraw request** from its ordinary action/menu and confirm. Reopen Sunflower Oil → **Request a sale**. Choose $7.99, Today, 2 weeks, Why `slow seller`, then **Send request**. Check the pending display again in Products and Lookup. Alternatively, keep the supplied request and continue directly to approval; do not try to create a duplicate pending request.
3. Switch to Manager → **Approvals**. Open the Sunflower Oil request. Review Store, dates and reason; tick **Use this price anyway** if the minimum-margin warning requires it, then **Approve**. Switch back to the requesting North York Floor Worker: the bell shows that person's decision. North York gets a real sale-start price task.
4. Switch to Manager, select North York, then Products → Stainless Steel Pot `0012` → **Change sale**. North York already has a running $16.99 sale; edit that existing sale. Choose **All stores**, keep or set **$16.99**, choose **Today** and **1 week**, read the live summary and save using the dialog's action. Warehouse is not offered. All three selling Stores should show the reviewed sale; only actual price/terms changes create or update pending tasks.
5. Switch to **Demo Richmond Hill Supervisor → Richmond Hill → Price updates**. Open the pot's start task and complete it using the register/print-or-waiver steps above. Return to Manager's progress to see actual per-Store results. Sales keep the Sale pill in Cashier Lookup; the ordinary Price changed pill is for non-sale changes.

## 9. Actual invoice original → cost-increase alert

Use the original seeded North York pot sale, or keep it active at $16.99 after the previous script. If the pot's cost was already changed by an earlier review, Reset demo first. Post this fictional invoice once per reset.

1. As Manager choose **North York**. Open **Demo** and choose **Download demo original · HW-5012**. Keep the downloaded `fictional-hw-5012.svg`; the prototype reads the actual selected original, not an invented attachment name.
2. Open **Invoices → New invoice**. Wait for the new upload workspace. Use **Upload a PDF or photo** and select that downloaded SVG. Wait for **Review invoice lines** before editing or confirming; the reading is simulated.
3. Check **HomeWare Imports**, invoice **HW-5012**, **3 units at $14.20**, subtotal **$42.60**, tax **$5.54**, total **$48.14**. Review the original and the pot line. Tick **Confirm this invoice line**. Resolve any visible missing-information box through its linked field.
4. Choose **Post invoice**, review the confirmation and choose **Post invoice** again. Open **Alerts**: **Cost went up during a sale** shows cost **$12.60 → $14.20**, the continuing $16.99 sale and the $23.49 regular proposal.
5. Select **Keep this delivery in the back until the sale ends** and **Keep the sale as it is** if those are your intended fictional decisions. **Notes** shows the linked staff instruction. This is an instruction, not stock or a money adjustment. Ending the sale restores the current regular price; the held-goods reminder is due the next local day.

## 10. E3: phone presentation and installation boundaries

1. Use the browser menu → Developer tools → device toolbar/responsive mode. In Firefox use **Ctrl+Shift+M**. Set width **390**, then **430** pixels. This simulates layout; it is not a physical phone installation test.
2. Repeat in English light, English dark and Persian. Open People/Add/Edit, the assigned-location dashboard/picker, Price updates/task, bell, Change price and the cost alert. Content, popups and actions should stay inside the viewport. At narrow heights the active Undo control should keep space for the actions underneath it.
3. Open Products, Labels, Received, Suppliers, Payables and the dashboard's Recent invoices/Returns. Each phone row has names, one muted facts line, the important value and one end arrow. Tap the row to open the record. Labels keeps its separate start checkbox; selecting it must not accidentally open the record. Short units such as `24 cm` should remain together.
4. For a physical phone on the same Wi-Fi, or a private HTTPS link and Home Screen install, follow [phone-demo-hosting.md](phone-demo-hosting.md). It includes Ubuntu VM network/firewall steps, HTTPS requirements, separate Cloudflare production/preview protection and taking the site offline. No account/site has already been created. You do not need hosting to review inside Ubuntu.
5. An ordinary `http://192.168…` phone address cannot demonstrate secure-context installation or camera APIs. A live camera barcode decoder is not implemented: Scan barcode currently focuses search. Each phone/site address keeps separate fictional data. No physical Home Screen install, real printer alignment, live register connection or Cloudflare policy has been claimed as tested.

## 11. Optional automated checks on your Ubuntu computer

You do not need to rerun automated checks just to review the screens. To run them, stop preview with **Ctrl+C**, then from `~/Supermarket-Inventory/prototype` run one command at a time:

```bash
npm test
npm run lint
npm run build
```

`npm test` runs the application tests followed by the separate permission SDK tests. Each command must finish successfully. Keep actual passed/failed/skipped totals; a skipped or unexecuted test is not a pass.

For the whole browser suite, first let the build above complete, then run:

```bash
npx playwright install --with-deps chromium
npm run e2e -- --workers=2 --retries=0
```

The installation may ask for Ubuntu administrator approval. The browser command opens its own preview on 5174, so leave your manual preview stopped. The complete suite can take a long time; the listing distinguishes passed, failed and skipped cases. A failure's output identifies its saved trace under `test-results`. Do not delete failures or increase timeouts to make a result look green. Start preview again when finished.

## 12. Actual results and screenshots

This section is deliberately scoped to recorded evidence; final combined results must be inserted before the review is presented as finished.

- C8: its final-source CI recorded **700 browser passes, 42 existing skips, zero failed/flaky outcomes**. Earlier-source **1,124 unit tests** passed. The **75** final screenshots were reviewed individually. [Review and source-specific evidence](PR_C8_REVIEW.md).
- E1: **1,323/1,323 application tests**, **75/75 SDK tests**, normal lint/build and **12/12 sign-in/setup/reset browser cases** passed on their recorded source versions. All **20** final images were reviewed or verified byte-identical to individually reviewed images. Its intentionally interrupted whole-browser attempt is not a full pass. [Review](PR_E1_REVIEW.md) · [20-image gallery](redesign-screenshots/pr-e1/README.md).
- E2: engine **260 scoped cases**, UI **13 scoped cases**, native **8/8** and capture **4/4** cases passed; **24 primary + 4 supplemental** images were individually reviewed. These overlap and are not added into a whole-app total. [Review](evidence/e2/ui-review.md) · [28-image gallery](redesign-screenshots/pr-e2/README.md).
- Final combined source `f1545df`: **1,430/1,430 application tests** and **75/75 SDK tests** passed, zero failed/pending cases and no global application errors. Normal full lint and a new normal TypeScript/Vite build also exited **0**, with tracked inputs unchanged. All 23 seed pricing cases are included. [Actual results and original outputs](evidence/e3/final-combined-f154/verification.json). The interrupted source7964 attempt and its failing test-observer lint are retained separately; the corrected observer uses a layout effect. Earlier post-print results remain [source-specific evidence](evidence/e3/post-print-final/verification.json).
- Complete older browser runs remain recorded as failures: `5741353` had **710 passed, 60 failed, 42 existing intentional skips**; `e47e0c6` had **759 passed, 11 failed, 42 existing intentional skips** with no unexecuted/flaky/retried cases. The later run took about 53 minutes. Every failure family was diagnosed; corrections include two real UI races (invoice Back and Payables search) as well as test readiness/compact-layout assumptions. The corrected original cases passed bounded followups; these do not turn historical full-run failures into passes. Both **complete original desktop and phone projects are now running** on the exact final `f1545df` source and a fresh build, with unchanged case keys, budgets, retry and skip rules. Final complete-browser results are not claimed yet. [Retained e47 matrix and original outputs](evidence/e3/retained-native-full-e47/).
- E3 corrected capture: **13/13 passed**, zero skips/flaky/retries, exact `90ad0f5` source and all 61 served output files unchanged. **79 accepted original screenshots**: 18 changed images freshly opened, 61 exact matching earlier passing images with explicit review provenance. Both previously failed Persian Received frames were freshly reviewed. [Final gallery](redesign-screenshots/pr-e3/README.md).
- GitHub required checks at 20:04 UTC on October 15: C8 is green. Exact E1 `f9cdd1d`, E2 `b59de22` and E3 `f1545df` have successful foundation, prototype lint, unit/pricing and build steps; browser steps are still running. Older exact runs exceeded the 30-minute job limit and also had genuine assertions fail; those causes are retained separately. No workflow file has been changed.

No blocking product answer is currently needed from you. Review the four pull requests together after the final results are recorded. Approval of the review does not itself deploy a site or connect a real backend, register or printer.
