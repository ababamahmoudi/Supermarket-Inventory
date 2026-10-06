# Prototype review guide

The seven review branches form a chain: each is based on the preceding part. Part 1 is based on `feat/phase-0-1-foundation`, whose pull request is still open. Review and merge in that order; none of these branches pushes directly to `main`.

Cloud validation is handled by Codex and CI. Ali does not need to install tools or run checks locally. The commands below are for anyone who wants to run the demo on a machine with the pinned Node.js 22 version installed.

From the repository root, after selecting the review branch:

```bash
cd prototype
npm ci
npm run dev
```

Open `http://localhost:5174` on that machine. To stop the server, press Ctrl+C in its terminal. This app uses fictional browser data only. Demo PINs: Supervisor `1111`, Floor Worker `2222`, Cashier `3333`. Reset demo restores all fictional seed data.

## 1. Shell and design system

Branch: `feat/prototype-01-shell`

1. Select Cashier, enter PIN `3333`, and click Sign in.
2. Check that only Cashier lookup appears in the menu.
3. Change the Role switcher to Supervisor and sign in with `1111`.
4. Change Branch 1 to Branch 2, then select فارسی and inspect the mirrored layout.
5. On a phone-sized window, open the menu and navigate with the keyboard.
6. Click Reset demo, then confirm Reset demo. Language and role stay selected.

At this stage the business screens are placeholders; the later review branches replace them in the requested order.

## 2. Pricing engine and Settings

Branch: `feat/prototype-02-pricing`

1. Sign in as Supervisor with `1111` and open Settings.
2. Grocery cost `1.00` gives `1.49`; change its divisor from `0.65` to `0.50` and watch the price become `1.99`.
3. Enter divisor `0`: the screen explains how to fix it and keeps the previous valid rule. Reload and confirm valid edits persisted.
4. Reset demo, enter Grocery cost `1.12`, and see the below-margin review at `24.83%` with price `1.49`.
5. Choose Rice and enter cost `3.1921`: displayed raw is `3.99`, but the final selling price is `4.99` because Rice uses the unrounded value.
6. Switch to فارسی and verify that the same calculations work in the mirrored layout.

## 3. Cashier lookup and Products

Branch: `feat/prototype-03-catalog`

1. Sign in as Cashier with `3333`. In Search products, try `sumac`, `سماق`, or code `0001`. Copy a fictional barcode from `seed/demo-data.json` to try a scanner-style search.
2. Search `0006`: Lavash shows the approved `1.99` and a New price pending tag. Search `0009` to see the Taxable tag.
3. Switch to Supervisor with `1111`. Search `0004`: Branch 1 shows Tea `6.49`; Branch 2 shows `6.99`.
4. Open Products. Try the category, taxable, offer, and pending filters, sort a column, then click View beside a product to inspect its details.
5. Switch to Floor Worker with `2222`. Products still works, while supplier costs and Supervisor-only pages stay hidden.

## 4. Invoice receiving

Branch: `feat/prototype-04-invoices`

1. Sign in as Floor Worker with `2222`; Invoices opens. Upload any fictional PDF or photo. Wait about 2.5 seconds for Reading invoice to finish. The file is retained only in your browser; all extracted lines are simulated.
2. In Review invoice lines, edit Sumac's unit cost from `1.30` to `1.60`: its proposed selling price changes from `1.99` to `2.99`. Put the cost back.
3. On Sour Cherry Juice, answer the lower-price stock/date questions. Choose Unknown and enter a fictional explanation if you do not have old-stock dates.
4. On Potato Chips, check Mark as short: 4 units of 12 are short, deduction `7.23`, payable `169.79`.
5. Confirm each Grocery date-tracking decision and each invoice line. Click Save as draft, refresh, and check that your choices are retained. Click Post invoice once.
6. Receive 2 chips with reference `FICTITIOUS-CHIPS-1`, then 2 with `FICTITIOUS-CHIPS-2`. The restored amounts are `3.62` and `3.61`; chips stock moves from 8 to 10 to 12 and payable returns to `177.02`.
7. Try Enter manually without a file on a new draft: posting requires the original invoice. Switch to فارسی to inspect the same review in RTL.

## 5. Approvals, alerts and offers

Branch: `feat/prototype-05-approvals`

1. Reset demo. Sign in as Supervisor with `1111` and open Approvals.
2. For Dried Barberries, click Approve product, select All branches, inspect the price preview, then confirm Approve product. For Lavash, click Approve price, select This branch only, then confirm.
3. Open Cashier lookup and search `0006`: Branch 1 shows `2.99`; Branch 2 keeps `1.99`. Search `0015`: Barberries is approved in every branch.
4. Open Alerts. Tea shows Branch 1 `6.49` and Branch 2 `6.99`. Click Mark as intentional; enable Show resolved and intentional alerts to see the saved decision. Reset to try Apply this price to all and confirm; all three branches use the selected price.
5. Approve Lavash again for Branch 1. Switch to Floor Worker with `2222`, then open Offers. Its suggested Confirm offer: 2 for $5 appears. Try the mix-and-match toggle and confirm the offer.
6. Click Mix-and-match pools: Juice, Chips and Lavash share the same pool. Switch to فارسی to inspect the same task and pool in RTL.

## 6. Bilingual A4 labels

Branch: `feat/prototype-06-labels`

1. Sign in as Floor Worker with `2222`, or Supervisor with `1111`, choose Branch 1, and open Labels.
2. Keep the default Juice, Sumac and Chips selected with Copies per product `1`. No template is preselected.
3. Create Template 1: width `60`, height `40`, margins `10` and gaps `4` millimetres. Click Save template.
4. Keep Starting slot `5`: the first four slots are gray and marked Used. New bilingual labels start in slot 5.
5. Check the logo, English/Persian names, approved price, offer, Product Code and unit size. Chips has a Taxable tag. Barcodes and promotion expiry dates are excluded.
6. Click Print labels, inspect A4 preview, then Cancel to avoid using paper. Increase Copies per product to see multiple sheets. Used slots remain blank on the printed sheet.
7. Switch to فارسی; labels stay bilingual. Refresh preserves Template 1; Reset demo removes it. Selecting All branches asks you to choose one branch before printing its approved prices.

## 7. Returns, expiry, notes, Payables and dashboard

Branch: `feat/prototype-07-operations`

Review PR #8: https://github.com/ababamahmoudi/Supermarket-Inventory/pull/8

### Record an actual pickup and a partial replacement

1. Reset the demo. Sign in as **Floor Worker** with **2222**. Click **Returns** and choose supplier **Fresh Valley Foods**. Its open return for **3 Sour Cherry Juice** units should appear immediately.
2. Expand **Staff return checklist and supplier terms**. Read the pickup/evidence checklist. Supplier terms are missing demo information; pickup alone does not promise a credit.
3. On that return click **Record pickup**. In the form enter **3** actual pickup units, representative name **Demo Representative**, and fictional signed paper reference **DEMO-SIGNED-SLIP-001**. Leave the item photo empty; it is optional. Click the form's **Record pickup** button.
4. Expect **Picked up: 3** and the signed-slip reference to be displayed. The notice says no stock was deducted again. No new purchase invoice is needed for pickup.
5. Click **Record resolution**. Leave **Resolution type** at **Replacement product received**. Enter **1** for **Original units this settlement covers**, choose Sour Cherry Juice as the actual replacement product, and enter actual replacement quantity **1**. Keep the displayed received date, enter representative **Demo Representative**, and fictional receipt **DEMO-REPLACEMENT-001**.
6. Leave **Fully resolves the original return (otherwise partial)** unchecked. Click **Receive replacement**. Expect **Partially resolved**, **Settled: 1**, and the message that stock increased while Payables did not change. Only the one replacement actually received adds stock; two original units remain unsettled.

### Cancel a return with an existing replacement

1. Still on **Returns**, choose **Golden Grain Distributors**. Its separate seeded Sumac example has **2 originals picked up**, **1 unit settled by a replacement**, and **0 originals safely recovered**.
2. Click **Request cancellation**. Leave **Actual safe originals recovered** at **0**. For **Actual disposition**, choose **Supplier still holds originals — restore zero**. Enter cancellation reason **Demo: supplier still holds both originals; retain the replacement already received**. Leave the physically recovered/safe checkbox unchecked because no originals were returned.
3. Click **Record cancellation disposition**. Expect **Needs review**. Originals recovered stays **0**; the received replacement and its history remain. Cancellation paperwork adds no fictitious stock or supplier credit.
4. Change the **Role switcher** to **Supervisor**, sign in with **1111**, choose **Branch 1**, reopen **Returns**, and select **Golden Grain Distributors**.
5. Enter **Settlement review and reason**: **Demo: retain the one replacement; both originals remain with supplier**. Check **I reviewed the history. Existing replacement or compensation is retained; no reversal is needed.** Click **Approve cancellation**.
6. Change **View** to **All returns and history**. The cancelled example stays available, with **Originals safely recovered: 0**, the retained replacement, and **Preserved evidence and history**. Cancelling does not erase or duplicate a replacement or automatically reverse compensation.

### Clear an expiry entry and send a Supervisor note

1. Switch to **Floor Worker**, sign in with **2222**, and open **Date tracking**. In **Expiring soon**, the original Lavash example has **5 days** left and Sour Cherry Juice **25 days** left. Extra tracked dates can appear if you posted an invoice.
2. Click **Cleared** on Lavash. It disappears from the active list. Change **Time window** to **Cleared history** to see its retained record. This records a date-list action; it does not prove that stock remains on the shelf.
3. Open **Notes**. Select **To order**, enter **Demo: please order more sunflower oil**, and click **Save note**. The saved card includes author, branch, and time.
4. Select **For Supervisor**, enter **Demo: please check the tea glass set price**, and click **Save note**.
5. Switch to **Supervisor**, sign in with **1111**, choose **Branch 1**, and open **Notes → For Supervisor**. Its unread count includes the new note. Click **Mark seen** on your new card: its badge changes to **Seen** and the unread count falls. **Mark done** closes it; check **Include done and ordered notes** to see retained completed cards.
6. **Store use** is a separate Notes tab. To try it, first post the demo invoice below so stock exists, then choose Lavash, enter quantity **1** and a fictional staff-use note, and click **Save note**. The actual quantity is deducted once from estimated sellable stock; Payables is unchanged. Choosing a product and quantity is required for this tab.

### Post the invoice before testing Payables

1. As **Floor Worker** with **2222**, open **Invoices**. If no demo invoice has been posted since the last reset, complete the Part 4 invoice steps first. Upload a fictional PDF or photo; the app simulates reading it for about 2.5 seconds.
2. Keep the original seeded costs. Answer the Sour Cherry Juice lower-price question with **Unknown — add a note**, and enter **Demo: previous-stock information unavailable**. On Potato Chips, use **Mark as short** so **4 of 12** are missing. Confirm every prompted date-tracking decision and **Confirm this invoice line** on each line, then click **Post invoice** once. The original attachment is required for posting.
3. For this Payables example, leave those shorts open. The invoice should show **$7.23** deducted and **$169.79** payable from a **$177.02** original total. If you already recorded both later chip deliveries from Part 4, payable is **$177.02** instead: both restoration records remain visible. A reset clears the ledger, so the invoice must be posted again afterward.
4. Switch to **Supervisor**, sign in with **1111**, choose **Branch 1**, and open **Payables**. Select **Fresh Valley Foods**. Expect the original invoice and **Short deduction** ledger rows; later deliveries, if recorded, also appear as **Short restoration** rows.
5. Click **Record external payment**. Enter fictional amount **50.00**, keep today's displayed payment date, enter cheque number **DEMO-1001**, and fictional payment receipt reference **DEMO-PAYMENT-001**.
6. Click **Preview oldest-due allocations**. Inspect the proposed **$50.00** allocation to the posted invoice, then click **Confirm and record payment**. The message confirms that no money was transferred. This records an imagined payment already made outside the demo.
7. Expect the supplier balance to fall to **$119.79** if the shorts remain open, or **$127.02** if both later deliveries were recorded, provided this is the only invoice/payment/credit. Check the payment row for its cheque number, payment date, and allocation.
8. Change **View** to **Month-end summary** and select the month containing the displayed invoice/payment dates. Inspect the ledger summary. **Print summary** opens print preview; **Export CSV** downloads the fictional bookkeeping report. Both are optional.
9. Switch to **Floor Worker** with **2222** and inspect the sidebar: **Payables** is absent. Switch to **Cashier** with **3333**: only **Cashier lookup** is available. These are prototype role demonstrations; production permission enforcement will be built in Phase 1.

### Dashboard, Persian, refresh, and reset

1. Switch to **Supervisor** with **1111**, select **Branch 1**, and open **Dashboard**. The cards follow the configured priority: approvals; same-supplier lower-price alerts; cross-branch price conflicts; tax discrepancies; barcode conflicts; invoices waiting for review; reading failures; open shorts; open supplier returns; returns waiting for credit; upcoming expiries; overdue invoices; supplier balances; recent posted invoices; employee activity.
2. Click **Open shorts**, **Open supplier returns**, or **Upcoming expiries** to open its connected page. Click **Employee activity** to jump to the recent-activity list. Reopen Dashboard to check the posted invoice and your recorded actions.
3. Click **فارسی**. Inspect dashboard, returns, notes, and Payables in the mirrored layout. Click **English** to return. Refresh the browser and confirm your fictional changes remain.
4. To finish with a clean demonstration, click **Reset demo**, then confirm **Reset demo**. The original two returns, both expiry examples, pending approvals, and starting notes return. Invoice/payment activity and created templates clear. Your role and language stay selected.

Expected: replacement receipt and safe physical recovery are distinct from financial compensation; cancelled records retain evidence; cleared dates and completed notes remain in history; Payables is Supervisor-only; all connected figures come from the fictional browser state.
