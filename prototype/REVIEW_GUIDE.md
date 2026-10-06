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
