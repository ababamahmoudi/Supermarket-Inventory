# R2c suppliers and payables

## 3.1 Supplier list and remembered incomplete-profile filter

The remembered legacy `proposed` chip means Profile incomplete, based on actual missing profile fields rather than obsolete supplier approval status. Unknown retired filter values no longer silently apply an unrelated incomplete-profile predicate. The authoritative supplier list remains company shared through posting, correction, movement, reload and role/location changes; delivery and money facts remain scoped.

A failed protected read previously became the empty array and showed 0 suppliers / No suppliers yet. Read failures now show Suppliers unavailable and Try again, never a false empty-company claim. While a fresh authorized read is pending, the count says Loading suppliers. An active filter/search always yields No suppliers match these filters and a Clear filters action, including an empty company. The no-suppliers starting message appears only after a successful unfiltered empty read. Selected chips have an accent border and inset ring without changing geometry.

## 3.2 Supplier details

The header contains the supplier name once, its status and one Edit / More action group. One padded contact card always shows Phone, Email, Website, Address, Sales representative, Sales rep phone and Payment terms; empty values say Not added. Incomplete profiles have one Complete profile link. Contacts use two columns, stacking on a phone. Existing tabs and source/notes evidence remain. The four KPIs reuse the dashboard SummaryTile surface and status dot; a tile is a button only when it opens its record, list or section. Supplier names and record links are blue.

To test: Suppliers → Corner Spice Co. Verify the seven contacts and one Complete profile link, Edit once and close, then use the KPI tiles and retained tabs. Sign in as Floor Worker: purchase balances and payment tabs remain absent.

## 3.3 Supplier statement routes

Payables supplier rows are blue links to `#payables?supplier=<stable supplier ID>`. The statement is its own top-level view with All suppliers, retaining current branch, statement modes, genuine payment/adjustment/print/export actions and scoped amounts. The list and duplicate supplier picker are absent from the statement. Legacy name routes still resolve authorized company suppliers. Unknown or unauthorized IDs never become another company's supplier.

The list's saved scroll target is captured before rendering the new route and restored after its protected read renders; browser Back and All suppliers return to the same list position. List filters cannot hide the statement a person deliberately opened. Record external payment opens the chosen statement and retains the usual concrete-location checks and external-payment confirmation.

To test: Payables → scroll down → click a supplier → see the statement at the top with All suppliers and no supplier dropdown → browser Back returns to that list row. Open the same supplier again and use All suppliers. Refresh a statement URL; it retains the selected supplier. Floor Worker and Cashier cannot open Payables.

## Shared control sizing and validation

Finished supplier/payables pages and the supplier editor opt into 44 px ordinary actions, filter chips, tabs and fields through `r2c-screen`. Existing genuine table disclosures and 32 px invoice field-label actions keep their explicit contracts. Summary tiles keep their card sizing. The C5 browser inspector requires the real page route, direct main/header and supplier/payables section composition, or the real open supplier-editor form; a copied class grants no exception. Width, radius, contrast, table and clipping checks still run. Browser mutations prove rejection of a 40 px action, a missing contact section and a counterfeit opt-in.

Validation uses invented fixtures only: 47 affected domain/component tests; the real three-branch import → post → correction → move → reload → role/location pipeline on desktop and phone; EN/FA contact and route refresh checks; 30 complete C5 page/dialog inspections plus six negative mutations across desktop/phone and EN light, FA light and EN dark. The immediate browser Back / All suppliers scroll test passes five repetitions per viewport within 2 px, without a test delay. Existing partial-cheque, outstanding-balance, CSV, print, worker-privacy and invalid-money no-write browser regressions pass on both viewports. Thirty-six final captures cover 1440/1000/390 px, EN/FA and light/dark, with no page errors or document overflow.

The fictional normal lifecycle retained every incomplete supplier. It did not reproduce the private screenshot's exact data-loss state. The separate failed-query-to-empty-state defect is reproduced and fixed; the immediate post → Suppliers reproduction also exposed and fixed a real late navigation callback (R2c 0.2 follow-up). No private invoice, supplier, screenshot transcription or upload data appears in these fixtures.

Integration verification preserves the visibly selected filter ring through the existing shared `--shadow-selected` token. Token-audit rules remain unchanged.
