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

## 3. Build and open the app on your computer and other devices

From `~/Supermarket-Inventory` run:

```bash
git branch --show-current
cd prototype
npm ci
npm run build
npm run preview
```

Expect the branch name **`feat/prototype-e3-phones`**, a completed dependency installation, a successful TypeScript/Vite build and both **Local** and **Network** addresses on port **5174**. Leave Terminal open. `npm run preview` already listens on `0.0.0.0`, which allows connections through Ubuntu's network interfaces. Do not add `--host 127.0.0.1`: that overrides the network setting and allows only Ubuntu itself to connect.

On Ubuntu, open Chrome or Firefox and enter **http://localhost:5174**. On a phone, tablet or another computer **on the same Wi-Fi**, open the **Network** address printed in Terminal, for example **http://192.168.1.20:5174**, using your actual address. `localhost` on a phone means that phone; `0.0.0.0` is a listening setting, not an address to type. A fresh browser should show Sign in; an existing browser keeps its saved demo account and records. A funding notice or chunk-size warning is harmless when the command succeeds.

If you cannot identify the right address, open a second Ubuntu Terminal and run `ip -brief -4 address show scope global`; use the address of the active Wi-Fi/Ethernet interface. If Ubuntu is a virtual machine, its default NAT address may be unreachable from your phone: follow the [bridged-network or VM port-forwarding steps](phone-demo-hosting.md#if-ubuntu-is-inside-virtualbox-vmware-or-another-vm). The same guide covers a narrowly scoped firewall rule if needed.

**For an Internet link that works away from your Wi-Fi**, the built app needs HTTPS hosting. Starting preview does not publish a website. Follow the [private Cloudflare Pages and Access option](phone-demo-hosting.md#3-optional-private-https-link-with-cloudflare-pages-and-access) or connect a hosting account so deployment can be configured. No public site has been created. Local HTTP is enough to test phone layouts and demo flows; HTTPS is needed for the intended installed-app/service-worker checks.

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
7. Open **Invoices → Posted**, open an existing posted invoice, then use the browser's **Back** arrow. The Posted list and your selected columns must return and stay there. As Manager open **Payables**, use the branch filter inside its Suppliers card to choose **North York**, select **North York** again, then type `Fresh` into **Search suppliers**. The text/focus must stay and matching suppliers remain visible. **Clear filters** still clears the filters deliberately.

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
3. Open Products, Labels, Received, Suppliers, Payables and the dashboard's Recent invoices/Returns. Each phone row has names, one muted facts line, the important value and one end arrow. Tap the row to open the record. Labels keeps its separate start checkbox; selecting it must not accidentally open the record. Short units such as `24 cm` and the complete Persian `۲۴ سانتی‌متری` fragment should remain together, including inside sale delivery-release notes.
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

Results belong to the named source and scope. A later correction or selected pass does not relabel an earlier failed complete run.

- **C8:** exact head `0c80d38` has successful required CI: **700 browser passes, 42 pre-existing intentional skips, zero failed/flaky outcomes**. All **75** original screenshots were individually reviewed. [C8 review](PR_C8_REVIEW.md).
- **Combined application at `0786ea2`: 1,444/1,444 passed**, separate **SDK 75/75 passed**, fresh normal lint and TypeScript/Vite build all exited **0**, with no global application errors or source changes. All **23 seed pricing cases** remain included. [Original outputs and source guards](evidence/e3/final-0786-application/). These are recorded-source results, not a claim that every later test-only source has already been verified.
- **Selected final native checks at `0786ea2`: 72/72 passed**, Desktop **36/36**, Phone **36/36**, actual exits **0**, no skips/retries/global errors. Four complete selected files retain their original assertions/budgets and stronger English/Persian controls; source, build and all **61** served files stayed unchanged. The actual English and Persian release-note originals were opened and visually passed, with the complete unit fragment kept together. [Original results and reviewed frames](evidence/e3/final-0786-native/README.md). This is **not** a complete current-source 812-case replay.
- **Whole-browser history remains separate:** full `f1545df` finished **769 passed, 1 actual unit-wrap failure, 42 pre-existing intentional skips**, with every original case accounted for. The earlier `431bdba` selected native run passed **28/28**, but its Persian manual frame failed; that failure remains retained. The shared formatter and raw oracle were corrected, including 14 new unit cases and genuine old-fail/new-pass controls. Earlier full `5741353` (**710/60/42**) and `e47e0c6` (**759/11/42**) also remain failures. [Full f154 record](evidence/e3/retained-native-full-f154/) · [failed 431 Persian manual review](evidence/e3/sale-inline-units-native/manual-review.json) · [formatter/oracle controls](evidence/e3/persian-compound-units-private/).
- **Screenshots:** [C8 75](redesign-screenshots/pr-c8/index.html), [E1 20](redesign-screenshots/pr-e1/README.md), [E2 28](redesign-screenshots/pr-e2/README.md), [E3 79](redesign-screenshots/pr-e3/README.md) retain exact capture/review provenance. E3's main capture passed **13/13** at `90ad0f5`: 18 changed images were freshly opened and 61 exact filename/SHA matches retain prior individual review. Later corrected English/Persian release frames belong to the new native packet, not that older capture source.
- **Required GitHub CI:** At the [recorded corrected-code snapshot](evidence/e3/exact-ci-a6c66dc/README.md), C8 required CI passed; E1/E2/E3 current full required checks remained unfinished. Corrected E3 `a6c66dc` [run38808926292](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38808926292) passed foundation, prototype lint, unit/pricing and build, and entered browsers. E1/E2 exact statuses and superseded concurrency cancellations are retained separately. The earlier exact0786 [color assertion failure](evidence/e3/exact-ci-0786/) remains a failure; the corrected code now passed that CI unit step. [Older explicit30m0s job-limit failures](evidence/e3/exact-ci-f154/) are distinct. No current complete812/required-CI pass is inferred. All four PRs remain unmerged; main is unchanged. A later docs-only publication can enqueue fresh checks and does not relabel these recorded results.

<!-- FINAL_TEST_ONLY_VERIFICATION -->
Latest test-only source `a6c66dc`: **1,444/1,444 application tests and 75/75 SDK tests passed**, actual exits **0**, zero failed/pending cases, no global application errors and all595 inputs unchanged. Normal full lint and a fresh build passed; all61 output files exactly match the native-tested `0786ea2` build. E1/E2 each passed their entire11-case palette/store file plus scoped lint/format checks. The three original exact colors and default1,000ms wait budget remain. The initial formatting failures and the first archived-run PDF import failure (1,392 assertions passed, nine suites unloaded/52 cases unexecuted, SDK not run) are retained separately. The fresh complete replay uses only the documented private dependency-path adapter, without production/module/assertion/timeout changes. [Actual final validation](evidence/e3/final-a6c66dc-validation/). Full current812 browser/required CI remains incomplete.

<!-- FINAL_CI_RESULTS -->
The full current 812-case browser/required-CI result remains incomplete. The [concrete unapplied CI proposal](ci-prototype-time-budget.md) changes only the prototype job from **30 to 90 minutes**; its other checks and the foundation job's 30-minute limit stay as configured. The [owner request](owner-requests/C8-E1-E2-E3-2026-10-12.md) allows only `prototype/`, `docs/` and `seed/`, so editing `.github/workflows/ci.yml` requires that precise owner exception after the authorized fixes and proof are ready. A timeout change does not repair assertion failures. No workflow edit has been applied.

No product answer is needed. No physical Home Screen installation, actual Safari/hardware-phone certification, printer alignment, live register connection, deployed site or Cloudflare policy validation was performed. Every device/browser/site address retains separate fictional records. Main remains unchanged and the four PRs remain unmerged; approval does not itself deploy or connect a real service.
