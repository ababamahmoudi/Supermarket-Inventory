# R2c 7.1 — Create a supplier return

## What changed

Returns has a primary **New return** action. Owner, Manager, Branch Supervisor, Floor Worker and Cashier can create a return at their current permitted location. At All locations, choose the responsible location in the form. Cashier gains only operational Returns read/create; invoice evidence, supplier contacts, costs, balances, pickup and settlement permissions remain independently protected.

Supplier/product choices come from actual positive accepted receipts on posted invoices at that location. They follow supplier aliases, effective invoice content/location/received-time corrections and genuine later deliveries. Catalog-only products, draft invoices and fully refused receipts are excluded. The form searches English/Persian product names, product code and barcode. It shows the latest receipt date and, only with existing supplier-cost permission, its four-decimal unit cost.

The selected receipt is pinned until the person explicitly chooses or refreshes it. A source edit/move, access change or conflicting latest cost requires review; no catalog-cost fallback, silent receipt substitution or invented cost is used. Equal-time latest receipts with different cost/unit/currency remain explicitly unavailable. A receipt in another currency is shown with a manager-review message and cannot create a return: this prototype does not invent FX conversion or relabel its cost as company currency.

Receipt currency comes only from retained original/effective invoice currency and same-company invoice ledger posting evidence. A manual invoice with no import-currency field uses its actual posting currency. Missing or contradictory historical evidence stays unavailable for manager review; today's company setting never supplies an old receipt's currency.

The created return also retains its source currency. A later Company settings currency change does not convert that cost: Payables keeps the original amount and ISO currency, flags manager review, and excludes it from the new currency total. Pickup, pickup corrections and monetary credit submission/posting reject the mismatch before any write. Restoring the original currency permits the original snapshot; this prototype does not implement FX settlement. Unrelated later receipts, including equal-time conflicting prices, cannot invalidate or replace this already frozen creation cost. Legacy returns retain their existing ambiguity checks.

Enter a positive quantity in the received product's canonical unit: whole units for each, or lb for weight. Reason is Damaged, Expired, Wrong item, Short-dated or Other; Other needs a note. Damaged/Expired needs at least one durable photo. Camera/file inputs accept supported image formats. Notes stay visible and typed text is buffered. The form has consistent surface fields, 44 px controls, one desktop grid and a full-screen phone sheet with a fixed footer.

Creating returns an actual return id and opens **Waiting for pickup**, with the genuine creator/time, translated reason and protected original photos. Its receipt cost/provenance is immutable creation evidence. Every create is audited. Retrying the same genuine request creates one record; changed payload under the same request id is rejected. Separate intentional requests may contain identical goods, because the prototype has no on-hand stock model.

## How to test, click by click

1. Build/start the current branch following the prototype README. Sign in as `manager` / `demo1234`, complete **Use simulated passkey**, choose **North York**.
2. Use a supplier/product from a Posted invoice already in the app. If the store is empty, import `prototype/tests/fixtures/r2b-fictional-readings-export.json` through **Invoices → New invoice → JSON file**, review and post one fictional invoice using `docs/PR_R2B_REVIEW.md` first. An unposted reading intentionally does not populate return choices.
3. Open **Returns → New return**. Confirm the location. Open the Supplier picker and search its name; choose the supplier. Open Product and search by name/code/barcode. Confirm the last-received date. Manager/Owner and an authorized Branch Supervisor see its actual source cost; Floor Worker/Cashier do not.
4. Enter **2** for an each product, choose **Damaged**, and click **Create return** before attaching a photo. **What's missing** names the required photo and links to its controls; no return is created.
5. Click **Add photos** and choose `prototype/tests/fixtures/r2c-fictional-return-condition.png`, an independently invented image. Wait for **1 photo saved**. Optionally enter a note. Click **Create return**.
6. The actual new return opens as **Waiting for pickup**. Check who created it, the quantity, translated reason and History entries **Created return / Return photo**. Reload: the same return and original photo remain.
7. Open **Suppliers → that supplier → Returns**. The return appears in the open list. Open **Payables → that supplier's statement**. **Waiting for pickup · Expected credit · Not deducted yet** links to the return; owed and pending credit have not changed merely because goods were set aside.
8. Record a genuine pickup using the existing signed-pickup workflow. Only then does its estimate move to the existing pending-credit calculation, once. Existing verified-credit/replacement/cancellation rules remain in force.
9. Use Demo to switch to `cashier`, then `ny-floor`, at their allowed Store and repeat New return. Both can create and reload photos. Cashier sees neither pickup/cancellation actions nor money/supplier administration pages. Use `rh-supervisor` at Richmond Hill to test Branch Supervisor scope with a posted receipt there.
10. Repeat in Persian and dark theme, and at 1440 / 1000 / 390 px. Phone form fills the viewport; body scrolls while title/footer stay reachable. Fast typing keeps the same quantity/note controls. Cancel changes no business records.

### Predictable automated fictional example

The browser tests install a separate fictional Cloudbay Wholesale receipt through the existing protected test-fixture helper: Meadow Jar, unit cost 7.1250, 20 received units, invoice/ledger 142.50. A return of 2 units shows an informational 14.25 before pickup while owed remains 142.50. Actual pickup moves 14.25 to pending credit and owed becomes 128.25. No legal credit ledger posting is fabricated. This example is test data, not a production initialization or a copy of private invoices.

## Security, file integrity and financial boundaries

New creation photos use a separate opaque upload proof; existing-return photo APIs remain unchanged. Before and after asynchronous storage/hash readback, current authority and the exact selected source are resolved again. Proofs bind company, user, session, authority/person versions, location selection, request and receipt fingerprint. Copied objects, raw file references, wrong requests or another person's proof fail. Final creation revalidates all fields/source/proofs in one fresh canonical transaction. An outer transaction failure retains the valid proof for a safe retry.

Sources are stored privately with exact hash/readback verification. UI previews are temporary object URLs and are revoked on removal/unmount/access change. After creation, the existing protected evidence reader authorizes the actual return and event. Cancelled/failed uploads may leave unlinked content-addressed files; there is no unsafe blind deletion of shared digests and no business association to those bytes.

Creation changes no ledger, price, approval, stock estimate or physical pickup event. The new Payables preview is separate from pending credit and is explicitly **not deducted**. Financial amounts and private receipt identities are absent from cashier/floor return DTOs, creation choices, command results and audit snapshots. General financial permissions are unchanged.

The secure boundary remains the prototype's private canonical IndexedDB repository with current authenticated command/query guards. This is not a deployed network service, payroll service or cross-device sync.

## Validation

- Domain/async-photo authority: `npx vitest run src/return-create.r2c.test.ts src/return-create-photos.r2c.test.ts --maxWorkers=1`.
- Existing affected return-photo, workflow, signed-pickup, collision, financial projection, supplier-balance and return-screen suites remain enforced. The Cashier SDK test adds precise new read/create grants and explicit denied pickup/settlement/cost/supplier powers.
- Browser role flows: `npx playwright test tests/return-create-r2c.spec.ts --project desktop` and `--project phone`.
- Visual/stability: `npx playwright test tests/return-create-visual-r2c.spec.ts --project desktop` and `--project phone`.
- Each real role flow checks creation attribution, no premature financial/stock changes, exact fixture source hash/bytes, photo reload, supplier integration and the separate Payables preview. Visual checks cover EN/FA, light/dark, 1440/1000/390, full-screen phone bounds, complete 44 px field coverage, input identity and ≤2 px typing stability.

Recorded verification: the 26 new domain/photo/currency cases and 164 existing affected cases passed (190 unique cases). One existing Return-screen provider-readiness assertion initially timed out under concurrent browser load; its unchanged nine-case file passed when rerun alone. All 75 SDK cases passed. Actual create/photo-reload/supplier/Payables flows passed for all five roles on desktop and phone (10 cases). The 12 distinct width/language/theme visual states passed and their 24 top/photo captures were inspected. TypeScript/Vite build, targeted ESLint, Prettier and whitespace checks passed. The currency/snapshot follow-up passed all 103 cases in its six affected suites, including actual Company settings currency changes, atomic pickup/correction/credit rejection, restored-currency success, frozen cost survival and the unchanged legacy ambiguity guard. Its real Settings → Payables denomination checks passed on desktop and phone (two additional browser cases); both captures were inspected. The historical-currency follow-up passed all 113 cases in seven affected suites; its two new cases exercise genuine manual invoice creation, line entry and posting before a currency settings change, plus restored-currency success and missing/conflicting evidence rejection. The duplicate phone-device visual matrix was intentionally stopped to avoid redundant concurrent browser load; the 12 distinct visual states include the full-screen 390 px layouts.

Physical phone camera/printer execution is not claimed. Camera capture uses the native browser input; automated tests use the real file-upload path and IndexedDB persistence. Foreign-currency and ambiguous/missing-cost source receipts require manager review rather than a guessed return valuation.
