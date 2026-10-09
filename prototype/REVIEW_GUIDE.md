# Prototype review guide

Review branch: `feat/prototype-08-visual-redesign`. **PR1 covers the shared shell and controls plus sign-in, Supervisor dashboard, Cashier lookup, and invoice review.** [Design language v2](../docs/design-language.md) is the visual source of truth. Suppliers and the other page redesigns wait for Ali's PR1 approval before PR2. Earlier operational workflows remain available for regression review.

Codex and CI run technical checks; Ali can review the screenshots and click flows. [README.md](README.md#run-on-ubuntu) includes complete Ubuntu installation commands for Node **22.22.2 or newer, below 23**. Once Node 22 is active, run from the repository root:

```bash
cd prototype
npm ci
npm run build
npm run dev
```

Expected: a successful build and Vite on port **5174**. On your own machine, open the local address Vite prints. Ctrl+C stops it. This browser demo uses fictional data only; AI invoice reading is simulated.

| Account               | Username      | Password             |
| --------------------- | ------------- | -------------------- |
| Supervisor            | `supervisor`  | `demo1234`           |
| Floor Worker          | `floorworker` | `demo1234`           |
| Cashier               | `cashier`     | `demo1234`           |
| First sign-in example | `newemployee` | Temporary `temp1234` |

Throughout this guide, **switch to a role** means open **Demo** and choose **Switch to Demo Supervisor**, **Switch to Demo Floor Worker**, or **Switch to Demo Cashier**. These shortcuts switch immediately. **Reset** means **Demo → Reset demo**, then the dialog's **Reset demo**. It restores business data while preserving your account, language, preferences, and changed password.

## 1. Sign-in and first password

1. In a fresh browser profile, enter `cashier` and a wrong password. Press Enter. Expect **The username or password is incorrect. Try again.** The username remains available to correct the password.
2. Enter `demo1234`, use **Show password** / **Hide password**, then **Sign in**. Expect Cashier lookup and no Payables, costs, or margins.
3. Open the sidebar user menu and choose **Lock**. The app is hidden. Enter `demo1234` and **Unlock**; lookup returns. **Sign out** from the user menu. Click the **Cashier** recent-user chip; it fills `cashier` and clears the password field.
4. Sign in as `newemployee` / `temp1234`. Expect **Choose a new password**. Reload or enter `#dashboard`, `#lookup`, or `#payables` in the address: that password screen must remain the only screen.
5. Enter `short` in both fields and **Save password**: minimum 8-character error. Try `password123`: common-password error. Enter mismatching values to check the correction message.
6. Enter fictional `NewStorePass2026!` in both fields and **Save password**. Expect the Floor Worker's Invoices screen. Sign out; `temp1234` must fail and the new password must succeed. Reset does not undo this password change; repeat in a fresh profile.

This is a browser simulation of account rules. Passwords are not production credentials; an online breached-password service and production server permission enforcement remain future work.

## 2. Shared shell, themes, and controls

1. Switch to Supervisor. Select **Branch 2**, then **All branches** in the branch pill. Switch to Floor Worker and check its branch is fixed; Cashier has only lookup.
2. Switch back to Supervisor. At 1920 × 1080, check the grouped sidebar, logo directly on the sidebar, user menu within the screen, breadcrumbs, and centered content. Collapse and expand the sidebar.
3. Press `/` outside a field. Type `sumac` in the top-bar search and Enter; lookup opens that query. Try `سماق` too.
4. Click **فا**; sidebar, content direction, and directional navigation mirror. Prices, Product Codes, and dates retain Western digits. Click **EN** to return.
5. Click the moon (**Switch to dark theme**), then **Comfortable text size**. Refresh; both remain. Use the sun to return to light. The text-size icon is in the top bar on desktop and phone.
6. At phone width, open the menu, choose Lookup or Invoices, and close it. Menus, fields, checkboxes, date controls, and file dropzones must be styled and keyboard-operable; Tab focus is visible. Tables may scroll inside their card while the page stays within the screen.

## 3. Cashier lookup

1. Reset, then switch to Cashier. **Search products** has focus. Search `sumac`, `سماق`, and Product Code `0005`; each finds Sumac with approved **$1.99**. Try its fictional barcode from `seed/demo-data.json`.
2. Use Arrow Down / Arrow Up and Enter to select a result. Scan or type another complete barcode and Enter; it replaces the previous query.
3. Search `0006`: Lavash shows approved **$1.99** with **New price pending** and secondary proposed **$2.99**. The approved price remains the price to charge.
4. Search `0009`: Chips has **Taxable** and its offer. Search `0015`: Barberries shows muted **No approved price yet** and a pending price rather than a large approved-price number.
5. Switch to Supervisor; search `0004`. Branch 1 Tea is **$6.49**, Branch 2 is **$6.99**. Switch back to Cashier and check costs and stock remain absent.

## 4. Supervisor dashboard

1. Reset and switch to Supervisor, Branch 1. Open **Dashboard**. Expect exactly four KPI cards: **Approvals waiting · Open alerts · Open shorts · Expiring soon**.
2. Inspect **Approvals queue**, **Alerts**, **Recent invoices**, **Returns**, and **Supplier balances**. **Notes for Supervisor** and **Activity** form the right panel on wide screens and move below on smaller screens. Lists hold the configured operational priorities.
3. In **Notes for Supervisor**, click **View** on a note. Notes opens its record. Return to Dashboard.
4. In Lavash's row, **Approve**. In **Review approval**, choose **All branches (default)** under **Apply price to**, inspect the preview, then **Approve price**. Lookup `0006` becomes **$2.99** with no pending tag in every branch.
5. Reset and repeat with **This branch only** for Branch 1. Branch 1 becomes **$2.99**; Branch 2 stays **$1.99**. Queue, connected KPIs, and activity change with the record.
6. Click a KPI to open its connected list. Check branch filtering. Switch to Persian and dark theme and repeat layout inspection.

## 5. Invoice review and preserved receiving rules

1. Reset and switch to Floor Worker. Open **Invoices**. Drop a fictional PDF/photo on the dropzone, or choose **browse**. Expect **Reading invoice…** for about 2.5 seconds, then **Review invoice lines** with six simulated lines and the retained attachment.
2. On a wide screen, inspect preview left and lines right. Expect subtotal, tax, shorts deduction, and payable tiles, plus sticky **Save as draft / Post invoice**. Phone layout becomes one column.
3. Expand **Invoice details**; inspect styled supplier/date/time controls and bounded form width. In Sumac's line, change **Unit cost before tax** `1.30` → `1.60`: selling price **$1.99** → **$2.99**. Restore `1.30`.
4. For Sour Cherry Juice, choose **Unknown — add a note** in **Is the expiry date the same as the stock on hand?** Enter **Demo: previous-stock information unavailable** in the required explanation.
5. On Chips, check **Mark as short**: 4 of 12 missing, **$7.23** deduction, and **$169.79** payable from **$177.02**. Actual received quantities drive stock.
6. Check **Confirm date tracking decision** on every prompted Grocery line and **Confirm this invoice line** on every line. Posting remains blocked until requirements are resolved. **Save as draft**, refresh, and check retained costs, answers, and confirmations.
7. **Post invoice** once. Expect posted status, eight Chips received, and connected approvals, alerts, and supplier ledger rows. Posting again must not add stock twice.
8. Enter **Delivery document reference** `FICTITIOUS-CHIPS-1`, receive 2 Chips with **Receive short delivery**, then repeat with `FICTITIOUS-CHIPS-2` for the remaining 2. Restorations are **$3.62** and **$3.61**, stock 8 → 10 → 12, payable **$177.02**. Refresh preserves both receipts.
9. Reset and **Enter manually without a file**. Add/confirm a line and save a draft. Expect **Add the original invoice (PDF or photo) before posting.**, disabled posting, and no posted ledger entries. Check review in Persian and dark theme.

## 6. Retained operational regression checks

These pages retain earlier workflows and page layouts. Their full redesign, plus Suppliers overview/detail, belongs to PR2 after PR1 approval.

1. **Pricing and Settings:** as Supervisor, enter Grocery cost `1.00`: **$1.49**. Change divisor `0.65` → `0.50`: **$1.99**. Divisor `0` gives a correction error and preserves the previous valid rule. Reset. Rice cost `3.1921` produces **$4.99** using unrounded precision.
2. **Approvals, Alerts, Offers:** reset; approve Dried Barberries for All branches. For Tea's branch conflict, **Mark as intentional**, then show resolved/intentional history. Approve Lavash, switch to Floor Worker, and confirm its **2 for $5** offer suggestion with mix-and-match. Pool membership and approved-price compatibility remain enforced.
3. **Labels:** select products, create **Template 1** with width `60`, height `40`, margins `10`, gaps `4` mm. Save and keep **Starting slot 5**. First four A4 slots remain Used; bilingual labels show logo, approved price, offer, Product Code, size, and Taxable where applicable. **Print labels** opens preview; cancel. Refresh retains the template; reset removes it.
4. **Returns pickup/replacement:** reset, choose Fresh Valley Foods and its 3 Sour Cherry Juice units. **Record pickup** with quantity `3`, representative **Demo Representative**, signed reference `DEMO-SIGNED-SLIP-001`. **Record resolution → Replacement product received**: cover `1` original unit, receive `1` Juice, add representative and receipt `DEMO-REPLACEMENT-001`, leave full resolution off. **Receive replacement** produces Partially resolved; only the actual replacement adds stock, and Payables stays unchanged.
5. **Return cancellation:** choose Golden Grain Distributors' separate **Basmati Rice 4.5 kg** example, Product Code `0001`: two originals picked up, one replacement received covering one original, and zero originals safely recovered. **Request cancellation**, keep safe recovered originals `0`, choose **Supplier still holds originals — restore zero**, add a reason, **Record cancellation disposition**. Expect Needs review. As Supervisor, add settlement review and retain-existing-settlement confirmation, then **Approve cancellation**. **All returns and history** retains the one replacement and its evidence, with zero recovered originals; cancellation adds no stock or supplier credit.
6. **Date tracking and Notes:** clear Lavash; it leaves Expiring soon and remains in **Cleared history**. Save **To order** and **For Supervisor** notes. As Supervisor, **Mark seen**, then **Mark done**; include done notes to see history. Store use requires a product/quantity and reduces existing stock once without changing Payables.
7. **Payables:** reset and post section 5's invoice with Chips shorts open. As Supervisor, choose Fresh Valley Foods: invoice and short-deduction rows produce **$169.79**. **Record external payment** `50.00`, today's date, cheque `DEMO-1001`, receipt `DEMO-PAYMENT-001`; **Preview oldest-due allocations → Confirm and record payment**. Expect **$119.79** balance and retained allocation; no real money moves. **Month-end summary**, **Print summary**, and **Export CSV** remain available. Floor Worker and Cashier menus omit Payables.

The owner's updated seed files stay unchanged. [The compatibility explanation](../docs/REDESIGN_REVIEW.md#configuration-and-operational-continuity) covers retained CAD/HST/Toronto metadata, physical quantities, return evidence, and ledger behavior.

## Automated validation

From `prototype/`, stop an old server on 5174 and run:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

Expected: executed unit suites, clean lint/formatting, successful build, and desktop/phone browser checks. `npm run e2e -- tests/design-v2.spec.ts` targets PR1 account guards, styled controls, keyboard search, layout limits, dashboard actions, theme/text persistence, and RTL. The full suite adds pricing, approvals, receiving, labels, returns, notes, Payables, and offline navigation. Record actual pass/fail/skip results in the PR report; commands alone are not evidence.

Use [the four-screen screenshot matrix](../docs/REDESIGN_REVIEW.md#screenshot-matrix) for Ali's visual review.
