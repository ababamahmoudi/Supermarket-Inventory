# C8 / E1 / E2 / E3 acceptance ledger

This is the comprehensive checklist for the owner's request received 2026-10-12. **C8 implementation and visual review are complete; final-source browser CI passed; the documentation-only head check remains separate. E1 implementation is present; its latest completed full app/pricing run passed 1,294/1,294 and four bounded repaired native checks passed. Current-root SDK passed 75/75 and build exited 0; final required lint passed at its recorded v2 inputs. The complete 742-case retained-browser attempt was interrupted with unresolved failures; final browser proof and original screenshots remain pending. E2/E3 remain Planned.** Root reports that C6 then C7 were approved and merged with preserved history after required CI passed, and that C8 starts from main `3b6da31`; that completed prerequisite is not new-stage test evidence.

Build four stacked PRs in order, without an intermediate review pause: **C8 → E1 → E2 → E3**. The owner reviews all together; deadline October 30. Update the source docs before each stage. Change only prototype/, docs/ and seed/. No new hosted service, real AI, inventory, remote accounts/resources or deployment is authorized. Browser user switching simulates people; each device has separate demo data.

Sources: [requirements §34–35](requirements.md#34-c8-fixes-sales-and-new-regular-prices-2026-10-12), [data model](data-model.md#c8-independent-sale-records-and-guarded-price-apis-2026-10-12), [workflows](workflows.md#22-c8-price-changes-sales-and-requests-2026-10-12), [screens](screens.md#c8-screen-changes-2026-10-12), [design language](design-language.md#c8-visual-refinements-2026-10-12), [open questions](open-questions.md#c8e-owner-answers-and-later-options-2026-10-12), [decisions](decisions.md#028-owner-approval-resolved-choices-and-c8e-order-2026-10-12) and [prototype brief](prototype-brief.md#c8--e1--e2--e3-current-authorized-work-2026-10-12). Requirements retains the literal owner clauses. Request SHA-256: `da91a5015ef3daf57cae58a67c7f2c1ae55395fe3841a00acce99f6214fa3dc1`.

“Planned” is not implemented or tested. Change status only after actual final-source evidence. Keep failed/superseded runs, retry/skipped counts and real visual findings. Owner approval is distinct from developer verification; no automatic merge of these new stages is implied.

## Resolved owner choices

| ID     | Required proof                                                                                                                                                                                     | Status                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| C8-D01 | Correct signed pickup: Supervisor represents Owner/Manager until E1; only Owner/Manager afterwards. All other roles denied. Reason, impact, immutable original and settled-coverage guards remain. | Executed; final source PASS; PR-head check separate |
| C8-D02 | Dark filled Primary and solid blue summary cards are #2B59C3/white. #7397F0 only dark links/icons/selected tabs/focus. Actual text contrast remains at least 4.5:1.                                | Executed; final source PASS; PR-head check separate |

## C8 — All 22 fixes, literal owner checklist

### C8-F01 — Implemented; executed proof recorded

- [x] Edit product → Date tracking (1.png).

- Each date row is one line, vertically centred: a status dot (red when past, amber inside the reminder window, green otherwise), "Expiry 2026-11-06", "25 days left" (one space, not two), and the ×.
  - In the add-date row, the Type, Date, Quantity and Lot labels sit on one line. Add is the same 44 px height as the fields and lines up with them.
  - In the whole dialog, dropdowns fill their column like text fields do (Pricing category, Sold by, Category, Supplier). Only short number fields, like "Remind me 30 days", stay compact.
  - Separate the sections (Names, Pricing, Details, Date tracking) with a hairline above each section title.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F02 — Implemented; executed proof recorded

- [x] Saving with date tracking on and no date (2.png).

- If Date tracking is Yes and the product has no open date at any location, Save product doesn't save. It shows the What's missing box with "Add an expiry date, or turn off date tracking", links to the date field and focuses it.
  - If someone picked a date but didn't press Add, Save product adds that date itself instead of dropping it.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F03 — Implemented; executed proof recorded

- [x] Labels → Products (3.png). The rows run out of the white card, and the sidebar stops partway down the page.

- Cause: c3-labels-notes-offers.css gives .labels-product-table max-block-size: 560px (480px on phones) with overflow-y: auto, but :root .ui-data-table { overflow: visible } in c6-shared.css and c3-components.css wins. The rows spill out of the card, the app shell ends where the card ends, and the sticky sidebar scrolls away with it.
  - Remove the height cap. The list grows with the page, its header stays sticky under the top bar, and the existing selection bar stays sticky at the bottom.
  - Make the sidebar fill the full window height and stay in place however long the page is (app shell at least 100dvh; sidebar sticky with its own full-height background).
  - Columns: checkbox (48 px) | Product (takes the free space) | Product Code | Offer | Selling price, right-aligned at the card's right edge. No gap after the checkbox and no empty space after the last column.
  - Add a layout test: on every page at 390, 900 and 1440 px, no table row extends past its card.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F04 — Implemented; executed proof recorded

- [x] New order items (4.png).

- Fixed columns, each header over its own content, numbers right-aligned under right-aligned headers: Product | Pack | Cases (input) | Units ("= 48 units", worked out) | Expected unit cost (input, with "Last bought $18.40" under it) | Case cost | Before-tax total.
  - "Expected total before tax" sits right-aligned under the Before-tax total column, above the buttons.
  - The inputs use the filled style, not outlined.
  - Money everywhere: show at least 2 and at most 4 decimals, dropping zeros after the second. 18.4000 shows as 18.40; 1.5525 stays 1.5525. Keep storing 4 decimals. Check invoice lines, supplier items and orders too.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F05 — Implemented; executed proof recorded

- [x] Product page (5.png). It's one long card: sections run together, there's an orphan "lb Approved" line, "Last received No deliveries yet" has no separator, and "Store cost: $4.99 /lb" floats on its own. Rebuild it:

- Header: the name and Persian name, then chips for Product Code, size (or "Sold by weight"), tax and status. On the right: Change price (Part 3), Edit and ⋯.
  - A row of three cards, stacked when narrow:
    - Price at [location]: big price, scope, any offer or sale, "Calculated from invoice FV-20417", and Last received with its date and invoice.
    - Cost and margin (Supervisor only): store cost, margin, pricing category with its divisor, and the minimum margin.
    - Dates at [location]: open dates with their dots, and an Add date button.
  - Then full-width cards, each with its own title: Details (two columns with a hairline between rows: barcode, AI category, pricing category, tax, supplier, sold by, unit size, first added at), Prices by store, Deliveries, Lots, Cost history and History.
  - An empty section shows one short muted line inside its card.
  - Drop the sentence "Received quantities are invoice evidence, not stock on hand" from the page. It can be a hint on the Lots title.
    Found by Claude:

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F06 — Implemented; executed proof recorded

- [x] The product page doesn't update when you go from one product to another. Open #product?code=0016, then change the address to #product?code=0006, or press Back: the breadcrumb changes, but the page still shows Bulk Almonds. ProductPage reads window.location.hash only once. Re-render on hashchange (Back and Forward too) and test it.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F07 — Implemented; executed proof recorded

- [x] Received shows fractions of cases: "3.3333 cases (40 units)", "2.6667 cases (16 units)", "7.5 cases (30 units)". Show whole cases plus loose units, like "3 cases + 4 units", everywhere cases are shown.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F08 — Implemented; executed proof recorded

- [x] Dashboard → Purchases by supplier: Fresh Valley Foods' bar ($181.22) is so pale it looks empty. Every bar uses the accent blue, or at least 3:1 contrast against its track.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F09 — Implemented; executed proof recorded

- [x] A fresh demo shows a half-started invoice on Invoices → Drafts: fictional-fv-20417.svg is attached, with no lines and no way to continue, above "No drafts". Either list it as a draft row ("Not read yet · Continue") or start the demo without it. Its file name also shows twice.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F10 — Implemented; executed proof recorded

- [x] One row, one chevron. Received, Suppliers, Payables, Returns, Date tracking and the dashboard's Recent invoices put a › or a ˅ (Received and Suppliers both) in the middle of the row, right after the name or number.

- Every row opens its record when clicked, with a single › at the row's end.
- Show the ˅ (hidden columns) only when columns are actually hidden, also at the row's end.
- Give the name column enough room (at least 240 px at 1440 px), so names like "Canned Fava Beans 400 g" don't wrap onto three lines.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F11 — Implemented; executed proof recorded

- [x] Products:

- On rows without a ⋯ menu (Dried Barberries), Edit jumps right. Keep the ⋯ slot so Edit always lines up.
- Write per-unit prices the same way everywhere: "$4.99/lb", not "$4.99 /lb".
- Show 25 products per page, not 8.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F12 — Implemented; executed proof recorded

- [x] Orders and History use two unlabelled "Choose date" fields. Use the same single Date range control as Received (From, To, and Today / This week / This month).

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F13 — Implemented; executed proof recorded

- [x] History: the Item column says "Product Code 0004" and Before → after says "Recorded action". Show the product name and the real values, for example "Black Tea 450 g · $6.99 → $6.49".

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F14 — Implemented; executed proof recorded

- [x] Alerts: the cards are about half the page wide, with empty space on the right. Make them full width like other pages, and show date-tracking alerts as compact list rows instead of one large card each.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F15 — Implemented; executed proof recorded

- [x] Offers:

- A red Stop offer button on every row is loud. Put Stop offer in the row's ⋯ menu and let the row open the offer.
- Remove the empty gap inside the Offer cell, between the price and "Mix-and-match".
- When there are no suggestions, show one short line instead of a large empty card.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F16 — Implemented; executed proof recorded

- [x] Dashboard:

- The Returns card title is bigger than the other card titles. Match them, and move "View all returns" to the right side of the title row, like other cards.
- Date-tracking alert chips are red. Use amber, and red only when a date has passed.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F17 — Implemented; executed proof recorded

- [x] Date tracking → Add date: Add is 40 px tall and sits higher than the 44 px fields. At 900 px, Location wraps and Add floats far to the right. Keep Product, Date, Location and Add together as one row that wraps as a group. The note under the list touches the card; give it some space.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F18 — Implemented; executed proof recorded

- [x] At 900–1100 px, where the sidebar shows icons only, the group headers appear as bare › and ˅ arrows. Hide them in icon mode and separate the groups with a short divider.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F19 — Implemented; executed proof recorded

- [x] Filter bars sit inside the list's card on Received, Returns, Suppliers, Orders and Labels, but on the grey page on Products, Offers, Payables and Date tracking. So the same controls look different (white with a border on some pages, filled on others). Put every filter bar inside its list card, at the top, so they all use the filled style.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F20 — Implemented; executed proof recorded

- [x] Lookup:

- The selected result is wider than the other rows and has a blue bar at its start. Keep the same inset as the other rows and show selection with the tint only.
- "Taxable" uses the same blue as offers. Make it a neutral grey chip so offers stand out.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F21 — Implemented; executed proof recorded

- [x] Settings → Company: show a colour swatch next to each brand colour. Show the current logo with a Replace button instead of an empty dropzone.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-F22 — Implemented; executed proof recorded

- [x] Seed data: Dried Barberries' Persian name uses Western digits ("زرشک خشک 100 گرمی"), while the other products use Persian digits. Make it consistent.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

## C8 — All 10 price-reduction requirements, literal owner checklist

### C8-S01 — Implemented; executed proof recorded

- [x] One "Change price" dialog for the Supervisor (Floor Workers get a request version of it, item 9), opened from:

- the product page header
  - the Lookup product card, and Products' ⋯ menu
  - Offers → Create offer → "Sale price"
  - Edit product, where Selling price becomes the current price shown with a "Change price" link. Nobody types a new price straight into Edit product any more.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S02 — Implemented; executed proof recorded

- [x] The dialog, top to bottom (example: Stainless Steel Pot 24 cm at $20.99):

- The product, and its current price at the selected location with how it was worked out.
  - Two large choices, with Sale selected by default:
    - "Sale, for a while": "The regular price comes back by itself."
    - "New regular price": "Stays until a new invoice changes the cost."
  - The price: an input, plus quick picks for 10%, 15%, 20% and 25% off, each rounded down to the store's .49 or .99 endings (for $20.99: $18.49, $17.49, $16.49 and $15.49). Under it, for example at $16.99: "Customers save $4.00 (19% off)" and, for the Supervisor only, "Margin at this price 26%".
  - Stores: All stores (the default), Only [current location], or Choose stores (checkboxes). Never the Warehouse or any other location that doesn't sell to customers.
  - For a sale only:
    - Starts: Today (the default), Tomorrow, or a date.
    - Ends: a "Last day" date, with quick picks for 1 week, 2 weeks and End of month; or "When I end it".
  - "Add Promo labels to the label waitlist", on by default for a sale. For a new regular price, "Add regular labels to the label waitlist" is on by default.
  - A plain summary box that updates as you type. For example: "From today until Saturday, October 31, all 3 stores sell Stainless Steel Pot 24 cm at $16.99 instead of $20.99. On Sunday, November 1, it goes back to $20.99 by itself."
  - Buttons: Cancel, and "Start sale" ("Schedule sale" when it starts later) or "Save new price".

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S03 — Implemented; executed proof recorded

- [x] Checks, in plain words, using the What's missing pattern:

- A sale price must be lower than the regular price. If it isn't: "A sale price must be lower than $20.99. To raise the price, choose New regular price."
  - Below the pricing category's minimum margin: an amber note and a "Use this price anyway" checkbox.
  - Below cost: a red note and a required reason.
  - A product can have one sale per store at a time, and scheduled sales can't overlap. If a sale already exists, the dialog opens that sale to change it.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S04 — Implemented; executed proof recorded

- [x] While a sale runs at a store:

- That store charges the sale price. Lookup, for every role, shows the sale price large, a "Sale" pill, "Regular $20.99" crossed out, and "Until Oct 31" (or "No end date").
  - Products shows the sale price with the pill and the regular price under it. Add an "On sale" filter.
  - Offers lists sales under Current offers with the type "Sale price". Add an offer type filter: Multi-buy, Sale price, Clearance. Ended sales move to Past offers.
  - Labels: the "On offer" filter includes sales. Promo labels show the sale price large and "Regular $20.99" smaller, using the existing Promo template.
  - A multi-buy offer on that product pauses at that store ("Paused during sale") and comes back afterwards. Sale items don't join mix-and-match pools, even when the sale price matches a mapping.
  - A lot's clearance price stays separate, as in C6. Lookup shows both.
  - Weighed items: the sale price is per main unit, and the second unit is worked out as today.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S05 — Implemented; executed proof recorded

- [x] Changing and ending a sale:

- On the product page, in Offers and in Lookup (Supervisor only): "Change sale" (price, last day, stores) and "End sale now", with a confirmation.
  - After the last day, at the start of the next day in the store's time zone, the price goes back to the regular price by itself. If a new regular price was approved during the sale, that one applies.
  - A sale with no end date: remind the Supervisor every 14 days (a setting): "Stainless Steel Pot has been on sale at North York for 14 days." with Keep it and End sale.
  - Every start, change and end goes to History with its before and after values, and can be reverted from History.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S06 — Implemented; executed proof recorded

- [x] New regular price (permanent). This is today's manual price, set through the same dialog. It stays until a regular invoice brings a different cost. Then the approval offers "Use the new calculated price $X" (selected by default) or "Keep $Y". An invoice at the same cost changes nothing.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S07 — Implemented; executed proof recorded

- [x] When an invoice changes the cost during a sale (a receipt at that store):

- The regular price proposal goes to Approvals as usual, marked "Applies after the sale". Customers keep paying the sale price.
  - If the cost went up, the Supervisor gets an alert, "Cost went up during a sale", in Alerts, the bell and the dashboard. It shows:
    - Stainless Steel Pot 24 cm · North York · invoice HW-5012
    - Cost $12.60 → $14.20 · Sale $16.99 until Oct 31 · Margin at the sale price 26% → 16% (minimum 25%)
    - After the sale: $20.99 → $23.49 (waiting in Approvals)
  - Its choices: Keep the sale as it is, Change the sale, or End the sale now.
  - Plus a checkbox, "Keep this delivery in the back until the sale ends". It adds a note to that store's notebook ("Keep HW-5012's Stainless Steel Pots in the back until the sale ends on Oct 31") and a reminder on the first day after the sale: "Sale ended: put the held Stainless Steel Pots on the shelf." We have no stock counts, so this is an instruction for staff, not a stock record.
  - The alert stays open until someone decides.
  - If the cost went down so far that the new regular price would be at or below the sale price, alert: "The new regular price $15.99 would be lower than the sale price $16.99", with End sale now and Keep the sale.
  - A Short-dated (expiry discount) receipt changes nothing here, as today.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S08 — Implemented; executed proof recorded

- [x] Settings → Offers gets a short "Sales" section:

- default sale length (2 weeks)
  - remind me about sales with no end date every [14] days
  - add Promo labels when a sale starts (on)
  - add regular labels when a sale ends (on)

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S09 — Implemented; executed proof recorded

- [x] Who:

- The Supervisor starts, changes and ends sales and new regular prices. Saving is the approval, as with manual prices today.
  - Floor Workers can request a sale for their own location. They use the same dialog in request mode:
    - the title is "Request a sale", with only the Sale choice
    - no cost or margin is shown
    - an optional "Why?" field (for example "slow seller" or "close to expiry")
    - the summary says "The manager approves this first. Until then, the regular price stays."
    - the button is "Send request"
  - Until it's approved, the request shows wherever the price shows, the same way a pending price does today. The approved price stays the big price customers pay, next to an amber "Sale requested $16.99 · Oct 13–31" pill and "Waiting for approval". This applies on Products (the "Has pending price" filter includes sale requests), Lookup, the product page, and Offers, where it's listed as Requested.
  - The request goes to Approvals as a "Sale request" card. It shows the product, stores, sale price, dates, who asked and why, plus the margin for the approver. The choices are Approve, Change and approve, or Reject with a reason. The requester gets a notification either way.
  - If it's approved after its start date, the sale starts at approval and keeps its last day. If its last day passes before anyone decides, the request expires and the requester is told.
  - One open request per product per store. The requester can change or withdraw it until it's decided.
  - Cashiers see sales and requested sales but can't request or change them. E1 maps all of this to the new roles.

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8-S10 — Implemented; executed proof recorded

- [x] Demo data and docs:

- Add one running sale (Stainless Steel Pot 24 cm, $16.99 at North York, ending 10 days after today), and a fictional invoice in the demo originals that raises its cost to $14.20, so I can see the alert by posting it.
- Add one pending sale request from the Demo Floor Worker (Sunflower Oil 1.8 L, $7.99 at North York for 2 weeks, "Why?": "slow seller"), so the pending display and the Approvals card are visible right away.
- Put both click paths in the review doc.
- Docs: a new section in requirements, plus data-model, workflows, screens, decisions and open-questions. In open-questions, record two later options: putting several products on sale at once, and "until sold out" (needs stock counts, so Phase 2).

Implementation: **Complete**. Executed evidence: [unit/pricing/lint/build and full-browser results](evidence/c8/verification.json); [current-source original screenshots and individual review](redesign-screenshots/pr-c8/index.html). Final-source browser CI passed separately: 700 passed, 42 existing skips, zero failed/flaky outcomes. Owner approval remains outstanding.

### C8 technical guards agreed before code

| ID     | Required proof                                                                                                                                                                                                                                     | Status                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| C8-T01 | Existing Edit product has current price/Change price link. Add product retains initial price/manual-override/margin validation; no sale for an unsaved product.                                                                                    | Executed; final source PASS; PR-head check separate |
| C8-T02 | Tracking Yes checks active/unremoved dates at any same-company location, including past dates. Valid unadded inline date saves atomically; invalid/missing/cancel leaves all staged records unchanged and exposes no private other-location facts. | Executed; final source PASS; PR-head check separate |
| C8-T03 | Sale keeps exact main-unit cents and price_unit, with full-precision Decimal normalization/secondary conversion. Regular canonical prices and source cost/quantity evidence stay unchanged.                                                        | Executed; final source PASS; PR-head check separate |
| C8-T04 | Every reviewed target is an eligible same-company selling store; Warehouse/inactive/non-selling excluded. Validate regular price/cost/minimum per store; no company or location leakage through direct domain calls.                               | Executed; final source PASS; PR-head check separate |
| C8-T05 | Existing sale change requests link sale/revision and remain pending. Worker Why optional; no private cost/margin leak. Approver enforces margin acknowledgement and below-cost reason.                                                             | Executed; final source PASS; PR-head check separate |
| C8-T06 | Clock uses configured IANA zone/local dates and handles DST/midnight, inclusive last day, scheduled starts, request expiry and idempotent reminders/history/labels.                                                                                | Executed; final source PASS; PR-head check separate |
| C8-T07 | Current regular price is independent of sale; ordinary offer pause/mix exclusion and clearance comparison use separate projections. Revert refuses stale conflicts and never revives elapsed schedules/restores stale regular price.               | Executed; final source PASS; PR-head check separate |
| C8-T08 | New regular price during an active sale defers automatic Regular labels until actual end, preserves Promo intent and explains timing. Label preferences/reasons/source identities are real, not a counter-only queue change; geometry unchanged.   | Executed; final source PASS; PR-head check separate |
| C8-T09 | Capture old regular cost before invoice post mutation; use actual accepted non-short-dated same-store evidence. Four alert keys: sale_cost_increase, sale_regular_not_above_sale, sale_no_end_reminder, sale_delivery_release.                     | Executed; final source PASS; PR-head check separate |
| C8-T10 | Hold instruction links actual sale/invoice/product/store; changed/early/natural end updates one first-day-after reminder. No stock or financial movement and no invented delivery evidence.                                                        | Executed; final source PASS; PR-head check separate |
| C8-T11 | Fresh/reset fixture dates anchor once to configured local Today and persist absolute dates. Reload does not slide an existing sale/request window or overwrite custom records/passwords/files.                                                     | Executed; final source PASS; PR-head check separate |
| C8-T12 | Display currency min2/max4 across UI and printed costs, preserving four-decimal storage/allocations; whole-case display does not prohibit valid fractional input or alter exact units.                                                             | Executed; final source PASS; PR-head check separate |

## C8 required automated proof

| ID     | Required proof                                                                                                                                                                              | Status                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| C8-P01 | Product page follows address change, Back and Forward, including direct product0016→0006 without stale content.                                                                             | Executed; final source PASS; PR-head check separate |
| C8-P02 | Every working page/visible table row is contained by its own card at 390, 900 and 1440 px; retain broader EN/FA whole-word/control/inner-bound negative checks.                             | Executed; final source PASS; PR-head check separate |
| C8-P03 | Date save Yes/no open date, existing past/open other-location date, valid picked-but-unadded date, invalid staged date, error focus and atomic cancel/failure.                              | Executed; final source PASS; PR-head check separate |
| C8-P04 | Currency18.4000→18.40,1.5525 retained, negative/offer/printed costs; whole cases+loose units with retained pack and valid fractional-entry boundary.                                        | Executed; final source PASS; PR-head check separate |
| C8-P05 | Starting/scheduled sale, automatic ending restores current regular, early end, no overlapping sale per store, lower-price/min-margin/below-cost guards and company/store permissions.       | Executed; final source PASS; PR-head check separate |
| C8-P06 | Multi-buy pauses/resumes only in affected store, sale cannot mix even at a mapped amount, clearance independent, weighed main/secondary price correct.                                      | Executed; final source PASS; PR-head check separate |
| C8-P07 | No-end reminder timing/Keep/End and repeated load/evaluation idempotency.                                                                                                                   | Executed; final source PASS; PR-head check separate |
| C8-P08 | Pending sale request display on Products/Lookup/product/Offers; Approve/Change and approve/Reject(reason)/withdraw/edit/expiry, notifications and current charge unchanged before decision. | Executed; final source PASS; PR-head check separate |
| C8-P09 | New regular price persists at same cost; changed regular receipt defaults Use calculated, explicit Keep retains manual, applies-after-sale approval never changes current sale.             | Executed; final source PASS; PR-head check separate |
| C8-P10 | Both cost-up and lower/equal-regular sale alerts with retained old/new cost/margin/approval, explicit Keep/Change/End, Short-dated exclusion and no duplicate posting effects.              | Executed; final source PASS; PR-head check separate |
| C8-P11 | Actual hold note and first-day-after reminder for changed/early/natural end; no-end without fabricated date or stock record.                                                                | Executed; final source PASS; PR-head check separate |
| C8-P12 | Promo/Regular automatic waitlist preferences, label contents/exact physical geometry, explicit template override and deferred regular intent.                                               | Executed; final source PASS; PR-head check separate |
| C8-P13 | Sale start/change/end History values and conflict-safe Revert; later regular approval and elapsed schedule remain correct.                                                                  | Executed; final source PASS; PR-head check separate |
| C8-P14 | Every existing unit/pricing/browser/lint/type/build check remains; all seed cases retained and passed on final head. Record counts without summing overlapping runs.                        | Executed; final source PASS; PR-head check separate |

## C8 screenshot matrix

Every row below requires **English light, English dark, Persian, 900 px and phone**:15 states × 5 variants=75 requested originals. Capture real fictional UI actions on one recorded final production source; no image editing/masks or copied reference data. Individually open every final original and compare the five new annotated screenshots and retained Klead references. Record framing limits/real mismatches; zero geometry alone is not a visual pass.

| ID     | Required proof                                                                                            | Status        |
| ------ | --------------------------------------------------------------------------------------------------------- | ------------- |
| C8-V01 | Edit product Date tracking: centered dotted rows, labels/44px Add/select columns/section hairlines.       | Reviewed PASS |
| C8-V02 | Edit product Save with tracking Yes/no open date: exact linked What’s missing and focused date field.     | Reviewed PASS |
| C8-V03 | Labels Products: contained uncapped list, header/selection sticky, full-height sidebar and exact columns. | Reviewed PASS |
| C8-V04 | New order: aligned fixed columns, filled inputs, Last bought and grand total under final column.          | Reviewed PASS |
| C8-V05 | Product page: rebuilt header, three cards and titled full-width related sections.                         | Reviewed PASS |
| C8-V06 | Change price dialog, Sale mode, real price/scope/date/label/summary state.                                | Reviewed PASS |
| C8-V07 | Change price dialog, New regular price mode.                                                              | Reviewed PASS |
| C8-V08 | Floor Worker Request a sale dialog, no private fields.                                                    | Reviewed PASS |
| C8-V09 | Products with pending sale request and actual charge.                                                     | Reviewed PASS |
| C8-V10 | Lookup with pending sale request and actual charge.                                                       | Reviewed PASS |
| C8-V11 | Sale request approval card with real requester/why and approver-only margin.                              | Reviewed PASS |
| C8-V12 | Lookup with active sale, regular comparison/end and independent clearance if present.                     | Reviewed PASS |
| C8-V13 | Offers with sale and Multi-buy/Sale price/Clearance type filter.                                          | Reviewed PASS |
| C8-V14 | Cost went up during a sale alert with actual cost/margin/regular proposal and hold option.                | Reviewed PASS |
| C8-V15 | Promo label preview for a sale, unchanged exact template.                                                 | Reviewed PASS |

C8 evidence scope: 1,124 unit/pricing tests and 700 browser passes/42 existing skips are from `8d9e7f9`. All 75 current-source captures and reviews are from `0303445`; its fresh build passed and its separate CI run passed all required steps with 700 browser passes/42 existing skips and zero failed/flaky outcomes. Linked invalid-save boxes above a scrolled dialog, sticky behavior, hidden columns and print behavior require their executed browser checks, not the static images alone. E1 privacy/roles, E2 tasks and E3 phone installation are not claimed by C8.

## E1 — Implemented; final browser and visual verification pending

The current role/account contract is in requirements §2/§3/§16 and data-model/workflows/screens. This ledger preserves literal owner clauses. Implementation is present. Completed full app/pricing v5 passed 1,294/1,294; four bounded repaired native checks passed. Current-root SDK 75/75 and build passed; final required lint passed at its recorded v2 inputs. Complete retained-browser execution and visual results remain pending after an interrupted failing attempt. See [E1 exact-source evidence](evidence/e1/verification.json). It does not reinstate the older three-role model.

### E1-R01 — Implemented; verification in progress

- [x] Five roles (their labels come from config, not code):

- Owner and Manager: exactly the same access, company-wide, at every location, including locations added later. Together they replace today's Supervisor.
  - Branch Supervisor: runs one or more locations.
  - Floor Worker: one or more locations.
  - Cashier: one or more stores, never the Warehouse. Each person has one role and, except for Owner and Manager, one or more locations. For example: a cashier at North York and Richmond Hill, or a Branch Supervisor at all three stores. Record "different roles at different locations" in open-questions as a later option.

Implementation: **Present**. Completed full app/pricing v5 **1,294/1,294**; bounded repaired native **4/4**. Current-root SDK **75/75** and build **PASS**; final required lint **PASS**. Full 742-case retained-browser attempt **interrupted, not complete**; corrected full browser proof and original screenshots **Pending**. [Source fingerprints and executed results](evidence/e1/verification.json); owner approval remains outstanding.

### E1-R02 — Implemented; verification in progress

- [x] Permissions. Put this table in requirements.md. Enforce it in one place (the permission layer) instead of the many "supervisor" checks in the code today, and test it.

- Owner and Manager: everything today's Supervisor can do. That includes approving prices, new products and sale requests, starting, changing and ending sales and new regular prices (C8), Payables and supplier money, confirming suppliers, correcting a signed pickup, closing returns with a credit, Settings, People and devices, and every location's price updates and History.
  - Branch Supervisor, at their own locations only:
    - Can: enter, review and post invoices (including seeing costs on invoices, supplier items and orders), Received, returns (up to recording the pickup), labels, date tracking, notes, branch requests, orders and price updates (E2). They can propose price changes and request a sale; a request goes to Approvals for the Owner or a Manager. On a "Cost went up during a sale" alert, they can tick "Keep this delivery in the back". They can view pending approvals for their locations, without approving them.
    - Can't: approve prices or new products, start, change or end a sale or a new regular price themselves, open Payables or supplier balances, correct a signed pickup, close a return with a credit, change Settings, or manage people.
  - Floor Worker: what Floor Workers can do today, at their locations, including requesting a sale (C8).
  - Cashier: what Cashiers can do today, at their stores.
  - Dashboards:
    - Owner and Manager get today's Supervisor dashboard.
    - A Branch Supervisor gets a location dashboard without supplier money: arrivals, price updates to apply, sales running at their stores, expiring dates, open returns, branch requests, and notes for them. Add tests for every role at an allowed location and at a location they don't have.

Implementation: **Present**. Completed full app/pricing v5 **1,294/1,294**; bounded repaired native **4/4**. Current-root SDK **75/75** and build **PASS**; final required lint **PASS**. Full 742-case retained-browser attempt **interrupted, not complete**; corrected full browser proof and original screenshots **Pending**. [Source fingerprints and executed results](evidence/e1/verification.json); owner approval remains outstanding.

### E1-R03 — Implemented; verification in progress

- [x] Location picker:

- It shows only the person's own locations, plus "All my locations" for people with more than one.
  - Owner and Manager also get "All locations".
  - A registered store computer defaults to its own location.

Implementation: **Present**. Completed full app/pricing v5 **1,294/1,294**; bounded repaired native **4/4**. Current-root SDK **75/75** and build **PASS**; final required lint **PASS**. Full 742-case retained-browser attempt **interrupted, not complete**; corrected full browser proof and original screenshots **Pending**. [Source fingerprints and executed results](evidence/e1/verification.json); owner approval remains outstanding.

### E1-R04 — Implemented; verification in progress

- [x] Settings → People (Owner and Manager only).

- List: name, role, locations, status (Active, Invited, Deactivated) and last sign-in, with search and filters by role and location.
  - Add person:
    - Fields: English name, Persian name (optional), username, phone or email (for invites and password resets), role, and locations. Locations are hidden for Owner and Manager; the Warehouse isn't offered for Cashiers.
    - Saving shows a one-time setup code, once. In the real build, it's sent by text or email.
    - On first sign-in, the person sets their own password. Owner, Manager and Branch Supervisor also set up a second sign-in step: a passkey or an authenticator app code (simulated in the prototype).
  - Edit person: change role or locations, with a reason. History records old → new.
  - Deactivate: signs the person out everywhere immediately. Their records stay, and Reactivate is possible.
  - Safety rules:
    - Nobody can change their own role or deactivate themselves.
    - There is always at least one active Owner.
    - Only an Owner or Manager can make someone an Owner or Manager.
  - Registered store computers: keep the current list, and show which location each computer belongs to.

Implementation: **Present**. Completed full app/pricing v5 **1,294/1,294**; bounded repaired native **4/4**. Current-root SDK **75/75** and build **PASS**; final required lint **PASS**. Full 742-case retained-browser attempt **interrupted, not complete**; corrected full browser proof and original screenshots **Pending**. [Source fingerprints and executed results](evidence/e1/verification.json); owner approval remains outstanding.

### E1-R05 — Implemented; verification in progress

- [x] Demo users. Replace the three demo accounts with these, all with password demo1234 and fictional names:

- owner (Owner)
  - manager (Manager)
  - rh-supervisor (Branch Supervisor at Richmond Hill and Newmarket)
  - ny-floor (Floor Worker at North York)
  - wh-floor (Floor Worker at the Warehouse)
  - cashier (Cashier at North York and Richmond Hill) The Demo menu can switch to any of them, and Reset demo restores them. The old username "supervisor" keeps working and signs in as the Manager.

Implementation: **Present**. Completed full app/pricing v5 **1,294/1,294**; bounded repaired native **4/4**. Current-root SDK **75/75** and build **PASS**; final required lint **PASS**. Full 742-case retained-browser attempt **interrupted, not complete**; corrected full browser proof and original screenshots **Pending**. [Source fingerprints and executed results](evidence/e1/verification.json); owner approval remains outstanding.

### E1 required proof

| ID     | Required proof                                                                                                                                                                                 | Status                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| E1-P01 | Central permission table: every role at allowed and unassigned locations and across companies, including field privacy, Owner/Manager future locations and no Cashier Warehouse.               | Unit/SDK proof executed; final browser pending |
| E1-P02 | People no own-role change/self-deactivation, at least one active Owner, promotion authorization, reasoned edits, deactivation invalidates all browser sessions, reactivation retains evidence. | Unit/SDK proof executed; final browser pending |
| E1-P03 | Invitation code shown once, forced password/privileged simulated second factor, aliases and six demo/reset users without production-auth/delivery claims.                                      | Unit/SDK proof executed; final browser pending |
| E1-V01 | People list with roles/locations/status/filters/last sign-in.                                                                                                                                  | Planned                                        |
| E1-V02 | Add person with locations and correct role-specific availability.                                                                                                                              | Planned                                        |
| E1-V03 | Edit person with reason/history.                                                                                                                                                               | Planned                                        |
| E1-V04 | Branch Supervisor assigned-location picker.                                                                                                                                                    | Planned                                        |
| E1-V05 | Branch Supervisor location dashboard without supplier money.                                                                                                                                   | Planned                                        |

## E2 — Literal planned store-task and notification checklist

### E2-R06 — Planned

- [ ] When a product's selling price changes at a store, that store gets a price update task. This applies whatever caused the change: a price approval, "Apply this price to all" on a branch price conflict, a new regular price, a sale starting, changing or ending (C8), another offer starting or ending, or a weighed item's price.

- The price in the app changes right away. But staff still have to change it on the store's own cash register and put up a new shelf label, so the task stays Pending until someone confirms both.
  - Only stores whose price actually changes get a task. The Warehouse never gets one.
  - Sales: a sale's start task appears on the morning of its first day. Its end task appears on the morning of its last day, titled "Sale ends after today: back to $20.99 tomorrow", so staff can change the register and labels at closing.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2-R07 — Planned

- [ ] Each task shows:

- the product (both names, code, barcode) and old → new price, including any offer or sale
  - when it takes effect, why it changed, and who decided
  - two checkboxes: "Changed on the cash register" and "New label printed", with "Print label now" and "Add to label waitlist" buttons that pick the Regular or Promo template automatically "Mark as done" needs both boxes ticked. The alternative is "No label needed" with a reason (for example, the product has no shelf label).

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2-R08 — Planned

- [ ] Who sees what:

- The Branch Supervisors of that store get a notification and own the task. They (or an Owner or Manager) can tick "Changed on the cash register" and mark the task done.
  - Floor Workers at that store see the list and can tick "New label printed". A setting can let them mark tasks done too (off by default).
  - Cashiers at that store see a "Price changed" pill on the product in Lookup, with the old price crossed out, until the task is done. For a sale, they see C8's Sale pill instead.
  - Owner and Manager see every store: for each change, which stores are done (by whom, when) and which are still pending.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2-R09 — Planned

- [ ] Where it appears:

- A new sidebar item, "Price updates", with a count badge.
  - A dashboard card, "Price updates to apply".
  - The notification bell. The Price updates page has filters for Pending or Done, location and date. You can select several tasks and then "Print labels" (adds them all to the label waitlist) or "Mark as done".

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2-R10 — Planned

- [ ] Changes on top of changes:

- If the price changes again before the task is done, update that same task to the newest price (keeping the earlier step in its history) instead of adding a second task.
- If the change is undone before anyone has acted on it, cancel the task.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2-R11 — Planned

- [ ] Reminders:

- If a task is still pending after 24 hours (a setting), remind that store's Branch Supervisors.
- After 48 hours (a setting), alert the Owner and Manager, for example "Richmond Hill has 3 price updates waiting".

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2-R12 — Planned

- [ ] Notifications in general:

- The bell lists each person's notifications, newest first, with an unread count, "Mark all as read", and a link to the item.
- Settings → Notifications decides which roles get which events: price updates, approvals waiting, branch requests, returns waiting for credit, expiring dates, sale requests and their decisions, and costs that went up during a sale.
- Plan this in the docs, but don't build it yet: in the real build, notifications also arrive on phones as push notifications once the app is installed on the home screen (Android, and iPhone with iOS 16.4 or newer), with email as an option.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E2 required proof

| ID     | Required proof                                                                                                                                                             | Status  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| E2-P01 | One task per actually affected store for approval/conflict/manual/sale/offer/weighed changes; none for Warehouse or unchanged effect.                                      | Planned |
| E2-P02 | Sale first-day morning start task and last-day morning end preparation; app regular price changes tomorrow, not early. Local-zone/DST boundaries retained.                 | Planned |
| E2-P03 | Newest change coalesces same pending task retaining history; unacted Undo cancels. Preserve evidence of prior physical acknowledgements and recheck current required work. | Planned |
| E2-P04 | Register/label/waiver/Done actor/location guards, Floor Worker opt-in off, bulk allowed-only operations and actual Regular/Promo template choice.                          | Planned |
| E2-P05 | 24h supervisor reminder and 48h Owner/Manager escalation, configurable/deduplicated; personal newest-first bell, unread/read-all/routing.                                  | Planned |
| E2-P06 | Cashier Price changed pill until Done, old crossed-out; Sale uses Sale pill. Manager per-store progress actor/time and pending stores.                                     | Planned |
| E2-V01 | Price updates list as Branch Supervisor.                                                                                                                                   | Planned |
| E2-V02 | Task with both checkboxes, print/waitlist and waiver.                                                                                                                      | Planned |
| E2-V03 | Manager per-store progress.                                                                                                                                                | Planned |
| E2-V04 | Cashier Lookup Price changed pill.                                                                                                                                         | Planned |
| E2-V05 | Dashboard Price updates to apply card.                                                                                                                                     | Planned |
| E2-V06 | Personal notification bell.                                                                                                                                                | Planned |

## E3 — Literal planned phone/install/hosting checklist

### E3-R13 — Planned

- [ ] Phones. C6 already made every screen work from 390 px up.

- Check the new screens (People, Add/Edit person, Price updates, a price update task, the location dashboard, the bell, the Change price dialog and the sale alert) at 390 px and 430 px, in English and Persian, using the same layout checks as C6.
- Phone lists: Products, Labels, Received, Suppliers, Payables and the dashboard's Recent invoices and Returns currently turn each row into a card of label/value pairs ("Product", "Product Code", "Details", a lone chevron under "Action"). On phones, use list rows like Lookup's: the name and Persian name on the left, the key value (price, amount or status) on the right, a chevron at the end, and secondary facts in one muted line. Tapping a row opens it. The Labels list keeps its checkbox at the start of each row.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E3-R14 — Planned

- [ ] Installable app: add a web app manifest, icons (the Super Arzon logo), the name "Super Arzon", light and dark theme colours, and standalone display. "Add to Home Screen" should open the app full screen with its own icon, like a normal app. Show a simple "No connection" page when offline.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E3-R15 — Planned

- [ ] Testing on phones: don't create any accounts or resources; write the steps for me in docs/phone-demo-hosting.md:

- Same Wi-Fi: how to open the prototype on a phone using my computer's address, what to check if it doesn't load (firewall, virtual machine network mode), and why the camera barcode scanner and Add to Home Screen don't work this way (they need HTTPS).
- Private link: step by step, putting the built prototype on Cloudflare Pages (free) behind Cloudflare Access (free for under 50 users), so only people whose email I add can open it, over HTTPS. Include how to update it after each merge to main, and how to turn it off.
- Explain clearly that each phone keeps its own separate demo data, so changes on one phone don't reach another until the real server build.

Implementation: **Planned**. Automated/visual evidence: **Planned**. Record exact source, test names/results and screenshot findings here after execution; do not infer them from a checked plan.

### E3 required proof

| ID     | Required proof                                                                                                                                                                                     | Status  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| E3-P01 | Manifest valid/configured name/logo/icons/light-dark colours/standalone; actual offline No connection page.                                                                                        | Planned |
| E3-P02 | People/Add-Edit/task/list/location dashboard/bell/Change price/sale alert at 390/430 EN/FA, keyboard/focus/reachability/whole text/inner card bounds.                                              | Planned |
| E3-P03 | Products/Labels/Received/Suppliers/Payables/Recent invoices/Returns compact phone rows with required names/key value/end chevron/secondary line; Labels checkbox retained.                         | Planned |
| E3-P04 | phone-demo-hosting.md gives LAN/firewall/VM mode/HTTPS limits plus private free Cloudflare Pages/Access owner setup/update/turn-off and independent per-device data. Create no accounts/resources. | Planned |
| E3-V01 | Products as compact phone list rows.                                                                                                                                                               | Planned |
| E3-V02 | Received as compact phone list rows.                                                                                                                                                               | Planned |
| E3-V03 | App actually opened from a phone home screen, if real device available. Do not fabricate an installed-phone frame; report unavailable physical-device proof.                                       | Planned |

## E screenshot variants and real-device limits

People, picker/dashboard, task/progress, cashier pill and bell scenes require English light, English dark, Persian and phone screenshots. All new screen layouts additionally pass390/430 English/Persian checks. Phone-only list/home-screen scenes remain phone evidence; do not invent desktop installed-phone images. All old tests still pass. Real push/email is planned only; HTTPS install/camera and actual device verification are reported separately from Chromium viewport tests.

## Required review demo scripts

| ID    | Required proof                                                                                                        | Status  |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------- |
| E-D01 | As manager, Alerts → Black Tea conflict → Apply this price to all using North York price.                             | Planned |
| E-D02 | As rh-supervisor, Richmond Hill task and notification → Print label → tick both boxes → Mark as done.                 | Planned |
| E-D03 | As cashier at Richmond Hill, show Price changed pill until task Done.                                                 | Planned |
| E-D04 | As manager, per-store progress shows Richmond Hill done with actor/time and other pending stores.                     | Planned |
| E-D05 | As ny-floor, request Sunflower Oil sale at North York; pending Products/Lookup.                                       | Planned |
| E-D06 | As manager, approve request; ny-floor notification and North York start task.                                         | Planned |
| E-D07 | As manager, Stainless Steel Pot sale at all stores until next week; rh-supervisor completes Richmond Hill start task. | Planned |
| E-D08 | Post fictional North York cost-increase original and show Cost went up during a sale.                                 | Planned |

## Final delivery and evidence records

| ID     | Required proof                                                                                                                                                                                                                     | Status  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| ALL-01 | Each stage has source docs before implementation and its own final unit/pricing/lint/type/build/complete browser CI evidence, with exact source hashes and actual failures/skips/retries.                                          | Planned |
| ALL-02 | All existing tests/seed pricing fixtures stay; no skipped real failure or relaxed permission/financial/geometry/contrast guard.                                                                                                    | Planned |
| ALL-03 | Unedited final screenshots individually reviewed against owner annotations with source/build/image hashes, findings/differences/framing. Exact print geometry and retained original-file/migration evidence stay.                  | Planned |
| ALL-04 | Finish with what changed, all four actual branch names, exact fresh/update commands for the last branch, click-by-click scripts and anything unavailable. No local action required merely to compensate for incomplete cloud work. | Planned |
| ALL-05 | PR descriptions contain What changed, How Ali can test it, Tests added, Docs updated, Open questions. Owner reviews all four; no unapproved automatic merge/resources/deployment.                                                  | Planned |

## Actual results

C8 final-source browser CI and the 75 original screenshot reviews are recorded above. They do not establish E1/E2/E3 completion.

E1 [full app/pricing v5](evidence/e1/app-full-v5.json) completed with **1,294/1,294 passed**, zero failures/pending/todo and actual exit **0**, unchanged 553-input fingerprint `2c4d5709d4538d8d01cd45309712556fc2e6fb849ce4467ae641bdb47a767539`. [Current-source comparison](evidence/e1/app-v5-current-source-match.json) records seven unsupported ByRole-option removals, runtime formatting with identical emitted JavaScript, and three retained browser fixture/readiness changes. Seed/assets and all other inputs remain unchanged; eight original C5 cases passed in v13 and final two foreign-event cases passed separately in v14; no complete retained742 pass is claimed. This is not a new whole-unit execution.

E1 [bounded repaired native v11](evidence/e1/native-repaired-v11.json) completed **4/4**, actual TypeScript/Vite/browser exits **0**, zero skips/flaky/retries/unhandled errors, unchanged 553 inputs and 55 built/served assets. The retained **742-case** attempt was interrupted at actual **exit 130**: [95 passed, four failed, one interrupted, 642 NOT_RUN, zero actual conditional skips](evidence/e1/retained-full-v12-classification.json). Raw reporter skipped=643 must not be misreported as intentional skips. [Required standard checks](evidence/e1/final-standard-checks.json) passed final required lint **exit 0** at recorded v2 inputs, with SDK **75/75** and full build **exit 0** at their separately recorded v1 inputs; no same-input rerun is implied. Bounded native v13 retained **eight original C5 passes and two foreign-reading failures**; final revised public-event two-case proof passed separately **2/2** in v14; corrected full browser verification, the 20 E1 screenshots/individual review, stacked draft PR and exact-head CI remain pending. Recovery is implemented and all 14 genuine cases are covered in the full app run. Earlier overlapping/failing runs remain preserved separately. E2/E3 and physical-phone installation are separate stages.
