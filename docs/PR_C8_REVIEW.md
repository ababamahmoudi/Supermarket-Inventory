# C8 review — fixes and price reductions

C6 and C7 were merged in order after the exact approved heads passed all required GitHub checks. Their commit history was preserved. The gate details are in `docs/evidence/c8-merge-gate.json`.

C8 updates the five reported layouts and the remaining C7 fixes, separates temporary sales from regular prices, adds worker requests and approval decisions, and connects actual cost-changing receipts to sale alerts and delivery instructions. Sales use the current regular price when they end; they pause multi-buy offers only at the affected store. Money retains cents and up to four source decimals. Print geometry is unchanged.

## Run C8 on Ubuntu

The prototype needs Node 22. For a fresh Ubuntu installation, follow the tools section of the [prototype README](../prototype/README.md); then use the C8 branch commands below. From the repository folder:

```bash
git fetch origin
git switch feat/prototype-c8-sales-fixes
git pull --ff-only
cd prototype
npm ci
npm run dev
```

Open `http://localhost:5174` in the Ubuntu browser. Keep the terminal open. Stop with Ctrl+C. The sign-in screen should appear. The fictional Supervisor username is `supervisor`, password `demo1234`. Use Demo → Reset demo for a clean fictional review; reset removes this browser's demo edits and restores the provided fixtures. Every browser keeps independent demo data.

## Click paths

1. **Reported layouts:** choose North York. Products → Black Tea 450 g → Edit. Turn Date tracking on with no dates and click Save product: the missing box should link to Date. Choose a valid date and click Save without Add: it should be retained. Labels → Products shows all rows inside the growing card. Orders → New order shows seven aligned columns. Open a Product page to see its three summary cards and separate detail/history cards.
2. **Running sale:** Lookup → search `0012`. Stainless Steel Pot should show $16.99, Sale, crossed-out Regular $20.99, and an end date ten days from the demo's creation. Offers → Sale price shows the same sale. Open its row or More menu to change it or confirm End sale now. Its regular price returns immediately after an early end.
3. **Change price:** Products → any priced product → Change price. Sale is selected, All stores is the default, and quick percentages round down to configured price endings. Try a price at/above its regular price: saving is blocked. Below the minimum margin requires Use this price anyway; below cost also requires a reason. Choose New regular price to change the manual regular price. During a running sale the summary says this regular price applies after the sale and Regular labels wait until then.
4. **Pending worker request:** Demo → switch to Floor Worker. Products or Lookup → Sunflower Oil `0008` shows approved $9.49 with amber Sale requested $7.99. The seeded request is visible in Offers as Requested. Use the same Change price dialog to request a different product at North York, or edit/withdraw an undecided request.
5. **Approve a request:** Demo → switch to Supervisor → Approvals. Review the Sunflower Oil request, dates and Why. The seeded price is below its minimum margin, so tick Use this price anyway before Approve. Change and approve stays locked to its requested store. Reject asks for a reason. Switch back to Floor Worker and open the bell to see the decision notification; clicking it selects the notification's permitted location and opens the product.
6. **Cost alert from an actual original:** on the clean seeded running pot sale, Demo → Download demo original → HW-5012. Invoices → Upload → attach the downloaded `fictional-hw-5012.svg`. Read the simulated extraction, review and confirm the actual invoice, then Post. The supplier original totals $48.14 (three units at $14.20, $42.60 before tax, $5.54 tax). Alerts now shows the cost increasing $12.60 → $14.20, the continuing $16.99 sale and the pending $23.49 regular proposal. Tick Keep this delivery in the back and decide Keep the sale. Notes has the linked instruction. End the sale: the held-goods reminder is due on the first following local day. The note does not change stock or money.
7. **Labels:** starting a sale adds an actual Promo waitlist entry and selects a matching saved Promo template. It shows SPECIAL, the large sale price and small regular price. Ending the sale adds a Regular intent. If both styles are waiting, the Regular/Promo tabs print one batch at a time and preserve the other. Printing an earlier snapshot never clears a newer price/sale label intent.
8. **Permanent manual price after a changed cost:** set a new regular price, then receive a regular invoice with a different cost. Approvals → open the resulting price approval: Use the new calculated price is the default, or the Supervisor may explicitly Keep the retained manual price. A receiver's Keep choice is a recommendation until this approval. Same-cost and Short-dated receipts leave the manual price unchanged.
9. **Themes and addresses:** toggle EN | فا and the theme button, then narrow the browser. On a Product page change `#product?code=0016` to `#product?code=0006` and press Back/Forward: the product and breadcrumb should change together.

## Verification

The [75-image screenshot gallery](redesign-screenshots/pr-c8/index.html) contains the unedited final-source captures: 15 moments in English light, English dark, Persian light, 900 px and 390 px dark. Every original PNG and all five owner annotations were opened individually. All 75 visual reviews passed; all 150 before/after production guards passed with zero geometry findings or browser errors. Screenshots were captured from source `0303445`, whose fresh build passed. The [evidence index](evidence/c8/verification.json) records actual source hashes and separate run results.

On the preceding source `8d9e7f9`, all **1,124 unit tests**, every seed pricing case, lint, type-check and build passed. [GitHub CI](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38441051423) completed successfully with **700 browser tests passed, 42 existing skips, zero failures and zero flaky outcomes**. Eight focused desktop/phone regression cases also passed without retries. These overlapping runs are not added together.

The final-source adjustment only changes the font of Persian phone table captions. Its own [GitHub run](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38443831934) completed successfully: all lint, unit/pricing and build steps passed; **700 browser cases passed and 42 existing cases were skipped**, with no failed or flaky outcomes. Its production hashes are different, so previous-source results are kept separately. The documentation-only PR head must also pass its own [required checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/21/checks) before the PR is marked ready.

Earlier failures remain in [the evidence folder](evidence/c8/): the initial full run had 154 failures; a later run had 11; another had one sign-in persistence readiness failure before its glyph assertions. The old photo-persistence timeout's cause remains unproven; a focused run and the later full run passed the unchanged 20-original-photo checks. No timeout or assertion was weakened to hide these records. Physical phone installation, register integration, hosting and cross-device synchronization are outside C8.

## Later stacked stages

E1 adds configured roles, multi-location assignments, People and setup/session rules. E2 adds per-store price tasks and general personal notifications. E3 adds phone list rows, installable/offline assets and optional private phone-hosting instructions. Those remain separate stacked pull requests.
