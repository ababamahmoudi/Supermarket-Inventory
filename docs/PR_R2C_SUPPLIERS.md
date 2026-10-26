# R2c suppliers and payables

## 3.1 Supplier list and remembered incomplete-profile filter

The remembered legacy `proposed` chip means Profile incomplete, based on actual missing profile fields rather than obsolete supplier approval status. Unknown retired filter values no longer silently apply an unrelated incomplete-profile predicate. The authoritative supplier list remains company shared through posting, correction, movement, reload and role/location changes; delivery and money facts remain scoped.

A failed protected read previously became the empty array and showed 0 suppliers / No suppliers yet. Read failures now show Suppliers unavailable and Try again, never a false empty-company claim. While a fresh authorized read is pending, the count says Loading suppliers. An active filter/search always yields No suppliers match these filters and a Clear filters action, including an empty company. The no-suppliers starting message appears only after a successful unfiltered empty read. Selected chips have an accent border and inset ring without changing geometry.

## 3.2 Supplier details

The header contains the supplier name once, its status and one Edit / More action group. One padded contact card always shows Phone, Email, Website, Address, Sales representative, Sales rep phone and Payment terms; empty values say Not added. Incomplete profiles have one Complete profile link. Contacts use two columns, stacking on a phone. Existing tabs and source/notes evidence remain. The four KPIs reuse the dashboard SummaryTile surface and status dot; a tile is a button only when it opens its record, list or section. Supplier names and record links are blue.

To test: Suppliers → Corner Spice Co. Verify the seven contacts and one Complete profile link, Edit once and close, then use the KPI tiles and retained tabs. Sign in as Floor Worker: purchase balances and payment tabs remain absent.
