# R2c Group 1 review — Manager dashboard

The three approved fictional PNGs are retained in [design-reference/r2c-dashboard](design-reference/r2c-dashboard/README.md). The current app shell and permitted business data are used throughout.

## What changed

- Five equal surface KPI tiles show Approvals waiting, Price updates to apply, Open alerts, Open shorts and Expiring soon, each with a status dot, one-line breakdown, muted zero and whole-tile navigation. `SummaryTile` is shared with other screens; a value without a destination remains static.
- The header names the configured Manager role, selected location and current local weekday/date, with Review N approvals. Desktop cards form the approved 2:1 grid and size to their content. Card headings use 17px/800, counts use pills, and empty states use one quiet line.
- Six approval rows show linked bilingual product names, code/category/supplier, a type badge, actual first price or old→new comparison, canonical margin and appropriately guarded action. Below-minimum sale requests show amber margin and Review. Existing snapshot-based approval/rejection commands remain unchanged.
- Recent invoices include exact retained totals and effective selected-location scope. Price updates show their real target and first-price/previous-price context. Supplier balances show real overdue amounts and due dates, with linked suppliers.
- Monthly purchases retain exact Decimal aggregation and ranked supplier bars plus month total. Eight Monday–Sunday calendar weeks use bars, highlight this week and expose exact amounts/dates through keyboard and pointer tooltips. Compact chart labels are presentation only.
- Activity groups by company-local day with 24-hour times. Notes retain their source text and the empty state is one check-mark line.
- Phone cards follow Approvals → Price updates → Alerts → Recent invoices → Balances → Purchases → Notes → Activity. All five tiles remain in two columns. Narrow desktop layouts stack the main/sidebar regions below 950px to keep tables usable. Prior Returns, Arrived this week and Price changes this week remain under More operations.
- Single-line metadata actually renders the text that fits, retaining its complete value in a tooltip. This keeps clipped, invisible text from overlapping adjacent values without reducing fonts or weakening the loaded-font checks.

## How to test, click by click

1. Sign in as **manager / demo1234**, complete **Use simulated passkey**, select **North York**, and open **Dashboard**. Compare the five surface tiles and two-column hierarchy with the approved references; the numbers reflect your actual records.
2. Open each KPI tile and use browser Back. Each reaches its actual list. Switch to All locations and verify totals/list scope refresh; switch back to North York and verify Recent invoices contains that location only.
3. In Approvals waiting, open a blue product name. Return to Dashboard. A new product shows **first price**; an existing price change shows old → new plus percentage; a sale request requiring review has **Review**, with an amber below-minimum margin where applicable.
4. With fictional demo data, find **Lavash Bread 500 g**, click **Approve**, review the real locations/effects and approve the price. The actual proposal is decided, the count changes, and Lookup shows the approved amount. Existing authority, stale-preview and audit rules still apply.
5. Click **Open price updates** after an actual approval. Return to Dashboard and verify the task count/target agrees with the real pending list; no historical tasks are invented merely to populate the design.
6. Open a blue Recent invoice reference. Use Done/Back to return. In Supplier balances, open a supplier; the supplier statement route is completed by R2c Group 3.3.
7. Hover or keyboard-focus each weekly purchase bar. The tooltip gives its full date range and exact amount. The supplier ranking and monthly total agree with posted, non-voided net purchase evidence; payments and opening balances are excluded.
8. Expand **More operations**. Returns, actual arrivals and weekly price changes retain their existing links and scoped data. Switch location and verify those figures change appropriately.
9. Switch Persian/English and light/dark, and resize to 1440, 1000 and 390px. The header primary, ordinary actions and More targets are 44px, text/controls have breathing room, phone order is retained and the page never scrolls sideways. At 390px all five KPI values remain available; Notes, Activity and More operations follow Purchases.

## Local verification

The protected summary tests cover exact totals/ranking, effective location selection, pending-task company/location/status scope, first-price/old-price semantics, canonical below-minimum sale margin without writes, calendar/year boundaries, role denials and cross-company denial. Shared tile tests prove static values do not acquire fake actions. The original dashboard/notes/approval tests remain.

The new browser matrix covers all 12 width/language/theme combinations and checks equal surface tiles, card order, 17px/800 headings, actual 44px actions, no page overflow/errors and truthful first-price/Review behavior. C5 proof checks the complete composition, then proves that a 32px action and a missing required tile cannot use the scoped exception; restoring the exact composition passes again.

Existing composition tests were deliberately updated for five surface tiles, content-height cards, weekly bars, the new approval title and More operations. Financial values, actual approval→Lookup behavior, current-location arrivals, permission assertions, text/contrast requirements and loaded-font collision negative controls remain. No worker, retry, timeout, skip or numerical stability budget was changed.

Execution results and final commit CI are recorded by the combined R2c/R2d report. Hardware phone/Safari/physical-printer execution is not claimed.

## Defaults and reference differences

- The fifth KPI stays available on phones in the next row; the PNG's four-tile phone subset does not hide Open shorts. R2d may add the authorized On shift now tile afterward.
- Bilingual product names, actual numbers, recorded dates and real nonempty notes can make cards taller than the illustrative English reference. Cards retain content height and alignment.
- Existing operational lists remain under More operations; Notes and Activity remain reachable at the end of the phone layout. No business function is removed to match a screenshot.
- Weekly purchase ranges are calendar Monday–Sunday; the current week includes only recorded purchases through today. No sales or inventory estimate is introduced.
