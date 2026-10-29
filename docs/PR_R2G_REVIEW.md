# R2g Tier 1 review

Work stays on `feat/prototype-r2-receiving`, [PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29), on top of the completed R3 live reader. The [approved reference](design-reference/r2g/README.md) and all 47 supplied fictional PNGs are retained byte-identically. Private annotated review files remain outside the repository.

## Scope and schedule

Tier 1 integrates **B1 → B4 → B2 → B3 → C1 → A2 → A5 → A7**. Its deadline is Thursday, October 29 at **18:00 Toronto time**, including seven green CI checks. Code freezes at **22:00 Toronto**; no subsequent push is authorized until Ali says so after the demo. Tier 2 may start only after green Tier 1 and with time before freeze. Incomplete items stay off the pushed branch.

## Start the app

Use Node 22.22.2 or a later Node 22 release. From the repository:

```bash
git switch feat/prototype-r2-receiving
git pull --ff-only
cd prototype
npm ci
npm run build
npm run preview
```

Open `http://localhost:5174` on the app computer, or `http://<app-computer-LAN-IP>:5174` from another device on the same network. Stop preview with Ctrl+C before rebuilding, then restart it. Use a separate browser profile for fictional practice; updating preserves existing saved data.

## Check desktop and Firefox at 509 px

First follow each path on a normal desktop window. In Firefox, open Responsive Design Mode with **Ctrl+Shift+M** on Ubuntu or **Command+Option+M** on the Mac, enter **509** for width and repeat. Also try 360, 390 and 760. Keep browser zoom at 100%. On phones, language/theme actions are inside More. Repeat English/light and Persian/dark; the latter also checks right-to-left layout.

### B1 — Sign-in, passkey and lock

1. At Sign in, inspect the centred card, configured store logo, full-width fields, Forgot password beside Password, full-width primary action, quiet demo account box and genuine Klead logo below the card.
2. Enter `manager` and one incorrect password. The password must clear and regain focus with readable feedback; the card, field, primary action and maker footer must remain stable.
3. Enter `demo1234`, press Sign in and inspect the passkey explanation, Continue with passkey, Simulated note and Sign in as someone else. Continue into the app and choose a concrete location.
4. Use the person menu's Lock action. Inspect the same finished card, actual signed-in identity and Unlock action. Wrong password still clears/focuses; correct password restores the session. Sign in as someone else returns to genuine sign-in.

### B4 — Invoice review

1. Open **Invoices → New invoice** and choose a fictional practice photo/PDF in Simulated mode, or use the existing JSON import. R3 Live is also available as described in its [rehearsal guide](PR_R3_REVIEW.md).
2. Inspect full product names, rounded amber rows, checks beside category and uninterrupted Delivered/short text. Open a line, type a correction and confirm it; the selected control stays anchored.
3. Inspect Other charges and credits inside the lines card. Add a charge or credit, type its description and signed amount, switch No tax/Taxable and remove it. Each field appears once. A subtotal currently calculated from lines/charges updates with complete evidence; printed or human-entered totals stay for reconciliation. Existing confidence checks and totals remain real.
4. Inspect grouped totals, label-adjacent provenance and highlighted Payable. Add line, Add new product and Add charge or credit share the card footer.
5. At 509 px, open the original: its thumbnail stays inside the full-width card. Charge cards match the line cards, tax captions remain complete, and the picker/Add line and paired secondary actions fit. Next to check and Post invoice share the bottom row equally. Nothing posts automatically.

### B2 — Change price

1. Open **Lookup**, select a product and press **Change price** as Manager.
2. Inspect the current price in the subtitle, two type cards, large currency entry and percentage tiles containing their resulting prices. The phone type cards omit the longer descriptions.
3. Clear the price: there must be no invented savings, margin or comparison. Enter a valid price and inspect actual facts.
4. Try a price below cost/minimum margin. Inspect one warning with its full-width reason and Use this price anyway. Type a reason and check focus/position; existing permission and required-reason rules still apply.
5. Inspect Stores/Starts and try 1 week, 2 weeks, End of month, Date and No end. Date reveals its field; the until caption follows the real choice. Inspect the combined summary/promo-label box, then Cancel to keep this rehearsal from changing a price.

The current configuration uses a 14-day default, so **2 weeks** is selected. The reference's illustrative 1 week does not replace the actual configured duration.

### B3 — Lookup

1. Open **Lookup**. Type a product name/code, use the common filters and open Filters for the remaining choices. Choose a quick chip twice: its colour toggles and clears without a check icon or shifted text.
2. Inspect Search results/count on one line and the active-only filter description. Each result aligns its name and price; names wrap rather than truncate, sizes stay together and zero sizes is absent. Real tax/status/other-location/size facts use quiet tags; Mix & match appears only for an actual pooled offer.
3. Select a product. Inspect the separated Product Code/size, icon-led open-date and receipt facts, with actual supplier/invoice beneath the receipt.
4. At 509 px, Persian names and offer/tags have their own rows without overlap. Product actions follow the price: Change price and Edit share their row, with More at the end. Values reach their intended inner end edge.
5. Change the selected location after typing a search. The typed query stays; actual prices, dates, products and authority are re-read for the new location.

### C1 — Weight-product editing

1. Open **Products**, choose a product whose How it's sold is By weight, then Edit. Also test opening Edit directly from a Products row.
2. Inspect logical-start section/field alignment, the separate product caption, standard Details gap, start-aligned empty package state and one-line New captions for unassigned package codes/barcodes.
3. A weight parent does not require Unit size. Inspect actual 2–4-place cost and two-place per-kg context; entered/canonical costs retain their exact precision.
4. Stage a new package and a cost change, then Cancel. Reopen: no partial package, code, price or metadata change was saved. Use the normal outer Save only for an intended practice edit.

### A2 — Shared chips

Open **Products**, **Lookup**, **Payables** and **Alerts**. Try the quick filters, including Payables' Overdue only and With balance. Every boolean filter uses centred colour-only selection. Click again, Space and Enter all toggle it; text and neighbouring controls remain stable. Business acknowledgements are still genuine checkboxes.

### A5 — Shared dialogs

1. Open Change price, Edit product, Add note, Edit notebook and a password-confirmation dialog. Small dialogs fit their content. Long content scrolls with no visible native scrollbar; soft edge fades indicate more content.
2. At 509 px, dialogs are full-width bottom sheets. Actions use the approved full-width or equal-row arrangement. There are no empty body/footer bands; helpers appear with the content they explain.
3. On Offers, perform a reversible page action such as Stop offer, then open an unrelated dialog. That page's Stop offer/Undo message must not appear inside the dialog. Close it to find the page Undo again. An action performed in a dialog may show only that same dialog's own feedback; normal Undo eligibility remains unchanged.

### A7 — Phone page actions

At 509 px, open **Dashboard** and inspect Review approvals. The page's primary action fills its row. Check the primary actions on the other touched pages; record, filter and toolbar buttons retain their own compositions.

## Verification record

Final executed results, exact commit and all seven CI conclusions are recorded in the task report and PR #29. Focused proofs use fictional data and actual rendered components. They cover the four phone widths, both language directions, both themes, control/glyph containment, negative controls and the existing 2 px interaction limit. A narrow Firefox project executes the tagged real 509 px cases in CI; existing Chromium, Firefox receiving and WebKit projects remain required. The 25-line density fixture measures 3213 px in both languages against a 3216 px bound derived from its individual parts; extra row padding, row gaps, metadata wrapping and empty fixed sections each fail independently.

No real reader/provider call or physical-phone claim follows from intercepted browser tests. The R3 real-kit rehearsal remains available separately.

## Screenshot precedence and actual data

- The supplied auth PNG has a 24 px desktop card inset, even though its source markup requests 32 px. The implementation follows the PNG: 24 px desktop and 20 px on the smaller phone layout.
- The approved phone Lookup places the full-width hero search above the Filters/scrolling-chip row. This takes precedence over A3's general search-plus-Filters wording for this drawn screen.
- Change price uses the approved 52 px amount entry and percentage tiles. They remain the drawn exception to the generic 44 px fields; phone Stores/Starts and amount/picks stack as shown. Cancel/Start and receiving's Next/Post retain their drawn equal-row arrangements.
- The receiving PNG retains 16 px phone line corners and inserts 14 px charge-card corners. That drawn pair takes precedence over the prose's “same radius”; desktop attention rows use the approved 10 px corner. The broader A4 phone-list redesign remains Tier 2.
- Actual configured sale duration, eligible offers, permissions, names, prices, costs, dates and counts remain real data. The illustrative numbers in a mock do not replace the pricing engine or invent an eligible pooled offer. At narrow widths the complete offer/Mix pair may wrap below the unchanged large price, staying adjacent and above the actions.
- The actual receiving progress bar remains fixed to the viewport bottom. As the reference README explains, the approved full-page illustration draws that bar at the page end instead.
- The receiving reference contains six rows. The earlier 25-line/2700 px test used 3 px cell padding; the approved 12 px padding adds 450 px for 25 rows by itself. The current density proof therefore checks exact row spacing, complete canonical content and tight component-derived page bounds, with padding/wrapping/empty-section negative controls. It does not trim records, shrink text or substitute a larger arbitrary page cap. Closed Category/check metadata stays compact; source SKU and printed pack remain in the real expanded line.

## Remaining scope

- **Conditional Tier 2:** B5/B6 Offers, B8 New order, B9 phone Timesheets, A1 fields, A3 other filter bars and A4/B7 phone lists. Do not treat their retained reference PNGs as implemented work.
- **After the demo:** A6 tables/checkbox alignment, A8 all-screen alignment expansion, C2 Manager-reviewed posted weight-cost repair, C4 approval checkboxes, remaining C5 Labels alignment, remaining C6 notebook role/section fixes, C7 audited selected name cleanup/aliases and C8 branch-request details. Shared A5 also addresses C3's empty password band and notebook scrolling.
- **Group D, recorded only:** persistent per-item Loaded per request/person with who/when; Mark all as being sent followed by individual Short choices.

No merge, force-push, deployment, paid resource or private invoice fixture is part of this work.
