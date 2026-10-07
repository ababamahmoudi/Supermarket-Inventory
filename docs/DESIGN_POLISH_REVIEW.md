# Design and language fixes — pull request A

Review branch: `fix/prototype-09-design-language-polish`. Pull request: **[Open the A review branch](https://github.com/ababamahmoudi/Supermarket-Inventory/tree/fix/prototype-09-design-language-polish)**.

This is **pull request A**, the 25 design and language fixes in Ali's latest review. It builds on the earlier unmerged [redesign pull request #9](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/9). Its base is `feat/prototype-08-visual-redesign`, which includes the owner's updated `main` documents and seed files. Review A against that base; no change is pushed directly to `main`.

The [design language](design-language.md) and [reference images](design-references/) are the visual source of truth. Reference branding, avatars, sample names, illustrations, and chart data are not copied. Existing receiving, pricing, approval, return, stock, payment, and printing workflows remain available. This browser prototype uses fictional data and simulated invoice reading.

## What changed

- Styled controls now cover every existing page: selects, checkboxes, radios, dates, times, quantities, file dropzones, and expandable sections. Textareas have no browser resize handle. Fields are bounded; short quantities and dimensions stay narrow.
- Shared spacing, segmented tabs, borderless cards, compact pills, visible striped-row actions, sticky top bar, centered dialogs, and the light/dark `--accent-fill` make the presentation consistent.
- The sidebar has the dark-theme white logo tile, aligned counts, compact user chip, and collapsed tooltips/count dots. The top bar has the readable language toggle, Aa control, shortcut hint, and bell count. Suppliers and History navigation positions are present; their new pages remain deferred.
- Shared formatting keeps prices symbol-first, dates YYYY-MM-DD, and English/numeric fragments isolated in Persian. Current-language product names are primary; branch and demo-user labels are translated. Old/new prices and count pills are separate and readable.
- Lookup uses the continuous search pill and compact results. Invoices has the six documented tabs and upload card above drafts. Returns uses readable numbering, a borderless line table, status-dependent actions, and destructive cancellation. Approvals shows old/new prices, cost, margin, branch, and recorded author with an explicit approval scope.
- Dashboard and Payables load the owner's supplier-balance figures. Payables starts with all suppliers, then a selected supplier's four summary tiles and ledger. Settings uses the configured **25%** minimum-margin placeholder for every category instead of the earlier invented Rice 20%, and keeps price-tester values beside their labels.

A includes presentation fixes and the two requested data corrections; it does not introduce the new features reserved for B.

## Recorded validation

Executed results from the cloud Ubuntu review environment on 2026-10-07:

| Check                                 | Actual result                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                            | 211 passed, 0 failed, 0 skipped                                                                                                                                                                                                                                |
| Pricing tests included above          | All 21 current seed cases and 3 retained boundary fixtures passed, with pricing boundary/property checks included in the unit run                                                                                                                              |
| ESLint and formatting                 | **PASS — ESLint, zero warnings; Prettier check clean**                                                                                                                                                                                                         |
| TypeScript and Vite build             | **PASS — TypeScript and production Vite build; existing bundle-size advisory**                                                                                                                                                                                 |
| Desktop/phone browser tests           | 74 passed, 2 intentional skips, 0 failed; 18 focused approval/presentation checks passed after the final spacing change                                                                                                                                        |
| Screenshot capture and screen metrics | **PASS — 92 PNGs; zero page errors, page overflow, visible native controls, resize handles, excess KPIs, or desktop sidebar scrolling**                                                                                                                        |
| GitHub workflow                       | Earlier redesign PR #9: failed at **Prepare the environment**; subsequent checks were skipped. A workflow result: **A workflow result is checked after opening the draft PR. Earlier PR #9 fails at “Prepare the environment”; its later checks are skipped.** |

The unit and browser checks cover money/stock regressions as well as presentation: seeded balances, Fresh Valley invoice reconciliation, partial shorts, role/branch visibility, custom controls, Persian formatting, phone layout, sticky top bar, and centered password re-check.

The repository's existing GitHub workflow runs the separate foundation setup. Its result must be reported separately from these prototype checks. This PR changes only `prototype/` and `docs/`; any foundation repair outside those folders needs a separate change.

## Run A on your Ubuntu computer

Reviewing the screenshots is enough to give design feedback. These steps are available if you also want to click through the app. You do not need Docker for this prototype.

1. Open Ubuntu **Files**, open your `Supermarket-Inventory` folder, right-click inside it, and choose **Open in Terminal**. If the old demo is still running, go to that terminal and press **Ctrl+C** once.
2. In the repository terminal, download and switch to A:

   ```bash
   git fetch origin
   git switch fix/prototype-09-design-language-polish
   git pull --ff-only origin fix/prototype-09-design-language-polish
   ```

   Expect `Switched to branch` or `Already on` followed by the branch name, then `Already up to date` or a list of updates. This checks out the complete review branch; you do not need to merge the pending pull requests yourself. If Git says local changes would be overwritten, stop and share its exact message. Keep those files.

3. If you want a separate fresh copy, use this instead of step 2, from a folder where you keep projects:

   ```bash
   git clone --branch fix/prototype-09-design-language-polish https://github.com/ababamahmoudi/Supermarket-Inventory.git Supermarket-Inventory-review-a
   cd Supermarket-Inventory-review-a
   ```

4. Check Node:

   ```bash
   node --version
   npm --version
   ```

   Node must be **22.22.2 or newer in the 22.x series, below 23**. If you have that version, continue to step 5. If Node is missing or has another major version, run:

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

   Enter your Ubuntu password if `sudo` asks; typing it shows no characters. Expect the last command to print `v22.22.2`. In a later terminal, run `nvm use 22.22.2` before the prototype commands.

5. From the repository root, install the locked dependencies, build, and start:

   ```bash
   cd prototype
   npm ci
   npm run build
   npm run dev
   ```

   Expect dependencies to install, a successful TypeScript/Vite build, and a line containing `Local: http://localhost:5174/`. Keep this terminal open.

6. On this same Ubuntu computer, open Firefox or Chrome and type **http://localhost:5174/** into the address bar. The username/password Sign-in card appears. Press **Ctrl+C** in the server terminal when you finish.

If `git` is missing, install it with `sudo apt-get install -y git` and retry. If GitHub asks you to authenticate, use your normal repository access. If `npm ci` fails, share the first error and check Node's version; do not remove the lockfile. If port 5174 is in use, stop the previous demo terminal with Ctrl+C and retry `npm run dev`. If the browser cannot connect, make sure the server terminal still shows Vite and the address includes port **5174**. Use the new review guide below; the older PR1 guide records the earlier screen layouts.

## Accounts and reset

| Role                  | Username      | Demo password        |
| --------------------- | ------------- | -------------------- |
| Supervisor            | `supervisor`  | `demo1234`           |
| Floor Worker          | `floorworker` | `demo1234`           |
| Cashier               | `cashier`     | `demo1234`           |
| First-sign-in example | `newemployee` | Temporary `temp1234` |

**Switch roles** means open the top-bar **Demo** menu and choose the named demo user. **Reset** means **Demo → Reset demo**, then **Reset demo** in the confirmation dialog. Reset restores fictional business data; it preserves changed passwords, your account, and preferences. Use a fresh browser profile to repeat `newemployee` after changing its password.

## Click-by-click checks

Start each independent business example with Reset, then select the required role and **Branch 1**. On a phone, open the sidebar with the top-bar menu button before choosing a page. Change to **فا**, dark theme, and phone width while reviewing the same pages; numbers and English names should remain in their own reading direction.

1. **Sign-in and lock:** sign in as `cashier` / `demo1234`. Open the sidebar's user menu and choose **Lock**. Enter `demo1234`, click **Unlock**, then **Sign out**. Click the Cashier recent-user chip: it fills the username and leaves the password empty. In a fresh browser profile, sign in as `newemployee` / `temp1234`; complete **Choose a new password** with fictional `NewStorePass2026!` in both fields. The temporary password then stops working.
2. **Shell:** switch to Supervisor. Collapse/expand the sidebar and check count dots/tooltips. Change the branch, click **فا**, switch light/dark theme, and use **Aa**. Refresh to check remembered preferences. Scroll a long Settings page: the top bar stays visible. Open a menu and use Tab/Escape; focus remains visible.
3. **Lookup:** switch to Cashier, search Product Code `0009`, and select Potato Chips. Check the price, Taxable and offer pills. Search `0006`: Lavash's approved **$1.99** stays the price to charge beside pending **$2.99**. Search `0015`: no approved price is shown as muted text. In Persian, the Persian product name is bold above the English name; price, code, and `1 L` retain their direction. Use arrow keys and Enter to select search results.
4. **Products:** switch to Supervisor and open **Products**. Use the styled category/supplier filters, then **View** a product. Check current-language name first, code/unit size beneath it, and aligned headers/values in Persian. Switch to Floor Worker and check catalog supplier costs and margins remain hidden.
5. **Dashboard:** reset, switch to Supervisor, and select Branch 1. Check exactly four KPI cards, approvals/alerts, invoices/returns, top-five supplier balances, and Notes/Activity. The cross-branch Tea alert says **Conflict** in a red pill. Actions remain visible on striped rows.
6. **Invoices and review:** reset and switch to Floor Worker. Open **Invoices**; inspect **Drafts, Processing, Needs review, Ready to post, Posted, Cancelled**. Save [the fictional invoice image](redesign-screenshots/pr1/fictional-fv-20417.png) to your computer. Click **Browse** in the dropzone, choose that image, and wait about 2.5 seconds for simulated reading. Check preview/lines, styled invoice details, four summary tiles, and sticky actions. For Sour Cherry Juice, choose **Unknown — add a note** and type a fictional explanation. Mark Chips short: 4 of 12 missing, **$7.23** deduction and **$169.79** payable. Confirm each prompted date decision and invoice line. Save a draft, refresh, then post once. The posted invoice is retained and only actual received stock is added. Two later short deliveries of 2 Chips restore **$3.62** and **$3.61**, bringing payable to **$177.02**.
7. **Approvals:** reset and switch to Supervisor. Open **Approvals**, inspect old/new price, unit cost, margin, branch, and author. Approve Lavash using **All branches**, the default under **Apply price to**, then **Approve price**. Lookup becomes **$2.99** everywhere. Reset and repeat with **This branch only** in Branch 1: Branch 2 keeps **$1.99**.
8. **Alerts and Offers:** reset as Supervisor. Open **Alerts** and check the red **Conflict** pill, readable row actions, styled history checkbox, and old/new price labels. In **Offers**, inspect active offers and the **Mix-and-match pools** tab. After approving Lavash, switch to Floor Worker and confirm its suggested **2 for $5** offer. Existing price compatibility and branch/pool restrictions still apply.
9. **Returns:** reset and switch to Floor Worker. Open **Returns** and inspect its toolbar and line table. Fresh Valley's open return offers **Record pickup**; record all 3 Juice units with a fictional representative and signed-slip reference. It then offers **Record resolution**. Record a partial replacement for 1 unit with a fictional receipt reference: only the received replacement adds stock, and money stays unchanged. **Cancel return** has the destructive style; cancellation still requires the existing physical-stock disposition and Supervisor review when needed. Use **View → All returns and history** to inspect history.
10. **Date tracking:** reset and open **Date tracking**. Click Lavash's **Mark as cleared** action. It leaves the active list and remains under **Cleared history**. Inspect visible actions, YYYY-MM-DD dates, and matching Persian header/cell alignment.
11. **Notes:** reset and open **Notes**. Check the three existing notebook tabs, with a separate count pill on **For Supervisor**. Save a fictional **To order** or **For Supervisor** note. As Supervisor, **Mark seen**, then **Mark done**. Store use still requires product/quantity and reduces stock once. Custom notebooks are B work.
12. **Labels:** reset and open **Labels**. Select products and enter a template name, width `60`, height `40`, margins `10`, and gaps `4` mm. **Save template**; set **Starting slot** to `5`. Check the first four slots are marked Used, current-language name is primary, and prices/offers remain symbol-first. **Print labels** opens the existing browser print dialog; cancel it to return. A changes this screen's presentation. The new waitlist, filters, calibration, and print-confirmation flow wait for B.
13. **Payables:** reset, switch to Supervisor, and select Branch 1. Open **Payables**: the all-suppliers table comes first. Fresh Valley is **$169.79**, Golden Grain **$842.10**, HomeWare **$1,260.00**, Sunrise **$96.40**, and Corner Spice **$0.00**. Together these are **$2,368.29**, with **$306.40** overdue. Click Fresh Valley's **View**; inspect four tiles and **Current ledger / Month-end summary**. Use **Export CSV** or **Print summary**. To test the existing payment flow, post the invoice with Chips shorts from step 6, select Fresh Valley, and click **Record external payment**. Enter Payment amount `50.00`, keep today's Payment date, enter fictional receipt reference `DEMO-PAYMENT-001` and optional Cheque number `DEMO-1001`. Click **Preview oldest-due allocations**, review the amount, then **Confirm and record payment**. Its balance becomes **$119.79**. No real money moves.
14. **Settings:** reset as Supervisor. Open **Settings** and inspect narrow divisor fields against striped rows and adjacent price-tester labels/values. Each category uses the configured **25%** minimum margin. In **Price tester**, Grocery cost `1.00` gives **$1.49**. Changing Grocery divisor `0.65` to `0.50` gives **$1.99**. Zero gives a correction message and preserves the last valid rule. Reset before finishing.

## Screenshot matrix

The requested set covers **23 screen states × four variants = 92 screenshots**. Desktop is 1600 × 1080; phone is 390 × 844, English/light. The Persian column uses the light theme. The capture uses real UI actions and the seed-derived fictional invoice attachment, without edited screenshots or injected business state. Business-page captures use Supervisor, Branch 1; account screens show their respective sign-in/lock/new-password state.

| Screen/state          | English light                                                   | English dark                                                  | Persian light                                                     | Phone                                                        |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Sign-in               | [Light](redesign-screenshots/pr-a/signin-en-light.png)          | [Dark](redesign-screenshots/pr-a/signin-en-dark.png)          | [Persian](redesign-screenshots/pr-a/signin-fa-light.png)          | [Phone](redesign-screenshots/pr-a/signin-phone.png)          |
| Choose a new password | [Light](redesign-screenshots/pr-a/new-password-en-light.png)    | [Dark](redesign-screenshots/pr-a/new-password-en-dark.png)    | [Persian](redesign-screenshots/pr-a/new-password-fa-light.png)    | [Phone](redesign-screenshots/pr-a/new-password-phone.png)    |
| Lock                  | [Light](redesign-screenshots/pr-a/lock-en-light.png)            | [Dark](redesign-screenshots/pr-a/lock-en-dark.png)            | [Persian](redesign-screenshots/pr-a/lock-fa-light.png)            | [Phone](redesign-screenshots/pr-a/lock-phone.png)            |
| Supervisor dashboard  | [Light](redesign-screenshots/pr-a/dashboard-en-light.png)       | [Dark](redesign-screenshots/pr-a/dashboard-en-dark.png)       | [Persian](redesign-screenshots/pr-a/dashboard-fa-light.png)       | [Phone](redesign-screenshots/pr-a/dashboard-phone.png)       |
| Cashier lookup        | [Light](redesign-screenshots/pr-a/lookup-en-light.png)          | [Dark](redesign-screenshots/pr-a/lookup-en-dark.png)          | [Persian](redesign-screenshots/pr-a/lookup-fa-light.png)          | [Phone](redesign-screenshots/pr-a/lookup-phone.png)          |
| Products              | [Light](redesign-screenshots/pr-a/products-en-light.png)        | [Dark](redesign-screenshots/pr-a/products-en-dark.png)        | [Persian](redesign-screenshots/pr-a/products-fa-light.png)        | [Phone](redesign-screenshots/pr-a/products-phone.png)        |
| Product details       | [Light](redesign-screenshots/pr-a/product-detail-en-light.png)  | [Dark](redesign-screenshots/pr-a/product-detail-en-dark.png)  | [Persian](redesign-screenshots/pr-a/product-detail-fa-light.png)  | [Phone](redesign-screenshots/pr-a/product-detail-phone.png)  |
| Invoices              | [Light](redesign-screenshots/pr-a/invoices-en-light.png)        | [Dark](redesign-screenshots/pr-a/invoices-en-dark.png)        | [Persian](redesign-screenshots/pr-a/invoices-fa-light.png)        | [Phone](redesign-screenshots/pr-a/invoices-phone.png)        |
| Invoice review        | [Light](redesign-screenshots/pr-a/invoice-review-en-light.png)  | [Dark](redesign-screenshots/pr-a/invoice-review-en-dark.png)  | [Persian](redesign-screenshots/pr-a/invoice-review-fa-light.png)  | [Phone](redesign-screenshots/pr-a/invoice-review-phone.png)  |
| Approvals             | [Light](redesign-screenshots/pr-a/approvals-en-light.png)       | [Dark](redesign-screenshots/pr-a/approvals-en-dark.png)       | [Persian](redesign-screenshots/pr-a/approvals-fa-light.png)       | [Phone](redesign-screenshots/pr-a/approvals-phone.png)       |
| Alerts                | [Light](redesign-screenshots/pr-a/alerts-en-light.png)          | [Dark](redesign-screenshots/pr-a/alerts-en-dark.png)          | [Persian](redesign-screenshots/pr-a/alerts-fa-light.png)          | [Phone](redesign-screenshots/pr-a/alerts-phone.png)          |
| Offers                | [Light](redesign-screenshots/pr-a/offers-en-light.png)          | [Dark](redesign-screenshots/pr-a/offers-en-dark.png)          | [Persian](redesign-screenshots/pr-a/offers-fa-light.png)          | [Phone](redesign-screenshots/pr-a/offers-phone.png)          |
| Mix-and-match pools   | [Light](redesign-screenshots/pr-a/offer-pools-en-light.png)     | [Dark](redesign-screenshots/pr-a/offer-pools-en-dark.png)     | [Persian](redesign-screenshots/pr-a/offer-pools-fa-light.png)     | [Phone](redesign-screenshots/pr-a/offer-pools-phone.png)     |
| Labels                | [Light](redesign-screenshots/pr-a/labels-en-light.png)          | [Dark](redesign-screenshots/pr-a/labels-en-dark.png)          | [Persian](redesign-screenshots/pr-a/labels-fa-light.png)          | [Phone](redesign-screenshots/pr-a/labels-phone.png)          |
| Label preview         | [Light](redesign-screenshots/pr-a/label-preview-en-light.png)   | [Dark](redesign-screenshots/pr-a/label-preview-en-dark.png)   | [Persian](redesign-screenshots/pr-a/label-preview-fa-light.png)   | [Phone](redesign-screenshots/pr-a/label-preview-phone.png)   |
| Returns               | [Light](redesign-screenshots/pr-a/returns-en-light.png)         | [Dark](redesign-screenshots/pr-a/returns-en-dark.png)         | [Persian](redesign-screenshots/pr-a/returns-fa-light.png)         | [Phone](redesign-screenshots/pr-a/returns-phone.png)         |
| Return history        | [Light](redesign-screenshots/pr-a/return-history-en-light.png)  | [Dark](redesign-screenshots/pr-a/return-history-en-dark.png)  | [Persian](redesign-screenshots/pr-a/return-history-fa-light.png)  | [Phone](redesign-screenshots/pr-a/return-history-phone.png)  |
| Date tracking         | [Light](redesign-screenshots/pr-a/expiry-en-light.png)          | [Dark](redesign-screenshots/pr-a/expiry-en-dark.png)          | [Persian](redesign-screenshots/pr-a/expiry-fa-light.png)          | [Phone](redesign-screenshots/pr-a/expiry-phone.png)          |
| Notes                 | [Light](redesign-screenshots/pr-a/notes-en-light.png)           | [Dark](redesign-screenshots/pr-a/notes-en-dark.png)           | [Persian](redesign-screenshots/pr-a/notes-fa-light.png)           | [Phone](redesign-screenshots/pr-a/notes-phone.png)           |
| Payables overview     | [Light](redesign-screenshots/pr-a/payables-en-light.png)        | [Dark](redesign-screenshots/pr-a/payables-en-dark.png)        | [Persian](redesign-screenshots/pr-a/payables-fa-light.png)        | [Phone](redesign-screenshots/pr-a/payables-phone.png)        |
| Supplier ledger       | [Light](redesign-screenshots/pr-a/payables-detail-en-light.png) | [Dark](redesign-screenshots/pr-a/payables-detail-en-dark.png) | [Persian](redesign-screenshots/pr-a/payables-detail-fa-light.png) | [Phone](redesign-screenshots/pr-a/payables-detail-phone.png) |
| Month-end summary     | [Light](redesign-screenshots/pr-a/payables-month-en-light.png)  | [Dark](redesign-screenshots/pr-a/payables-month-en-dark.png)  | [Persian](redesign-screenshots/pr-a/payables-month-fa-light.png)  | [Phone](redesign-screenshots/pr-a/payables-month-phone.png)  |
| Settings              | [Light](redesign-screenshots/pr-a/settings-en-light.png)        | [Dark](redesign-screenshots/pr-a/settings-en-dark.png)        | [Persian](redesign-screenshots/pr-a/settings-fa-light.png)        | [Phone](redesign-screenshots/pr-a/settings-phone.png)        |

[Capture metadata](redesign-screenshots/pr-a/capture-results.json) records page errors, widths, themes, languages, native-control visibility, resize handles, KPI counts, and sidebar scrolling. Read the actual capture result above before treating the gallery as complete.

To reproduce after building, start `npm run preview` in one terminal. In a second terminal, from `prototype/`, run:

```bash
npx playwright install --with-deps chromium
node scripts/capture-design-a.mjs
```

Screenshots are written to `docs/redesign-screenshots/pr-a/`. Browser tests must run against a current build; stop an old dev server before testing.

## Data limits and what waits for B

- The uploaded seed omits return creation dates/authors. Existing returns therefore show **created — by —** rather than a made-up date/name. Approval actors unavailable in the source show **Not recorded**. Newly recorded activity retains its actual demo actor.
- Supplier figures are aggregate demo snapshots, not historical invoice detail. They remain separate from the operational ledger. Fresh Valley's original seed invoice is reconciled when posted so its **$169.79** is not counted twice. New payments, receipts, and invoices retain their existing ledger rules. CSV discloses the dated demo figure separately.
- The current configured minimum margin supersedes the earlier Rice 20% default. Existing untouched demo defaults migrate to 25%; explicit saved custom choices are preserved. The pricing algorithm is unchanged.
- **B stays paused until Ali approves A.** Its scope is label waitlist/filters/calibration/print confirmation; custom notebooks; grouped editable Settings; History/Undo/Revert; and simulated-reading progress/low-confidence highlighting. Suppliers overview/detail from the earlier approved requirements is also still pending; the sidebar position is not a built supplier page. History is likewise a pending destination.
- Production authentication, database/backend integration, real AI, and deployment remain outside this browser prototype.

## Optional technical checks

Stop the review server with Ctrl+C. From `prototype/` with supported Node active:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

Expect executed tests, clean lint/formatting, a successful build, and desktop/phone browser results. `npm run e2e -- tests/design-polish.spec.ts` targets A's shared-control/layout checks. These commands describe how to repeat validation; only the recorded results above claim what was actually run.

Ali's next action is to review the screenshots and approve A or identify the screen/variant to change. B starts after that approval. Merging and deployment are separate decisions.
