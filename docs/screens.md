# Screens and navigation

Layout follows `design-language.md`. Menus show only what the signed-in role may use.

## Navigation by role

| Menu item                                     |       Cashier        |     Floor Worker     |      Supervisor      |
| --------------------------------------------- | :------------------: | :------------------: | :------------------: |
| Lookup (Products)                             |  Yes (lookup only)   |         Yes          |         Yes          |
| Home / Dashboard                              |    Lookup is home    |     Worker home      | Supervisor dashboard |
| Invoices ("Deliveries and supplier invoices") |                      |         Yes          |         Yes          |
| Returns ("Supplier returns and credits")      |                      |         Yes          |         Yes          |
| Products                                      |                      |         Yes          |         Yes          |
| Offers                                        |                      |         Yes          |         Yes          |
| Labels (product list, waitlist, templates)    |                      |         Yes          |         Yes          |
| Expiry (Date tracking)                        |                      |         Yes          |         Yes          |
| Notes (built-in and custom notebooks)         | If a notebook allows |         Yes          |         Yes          |
| Received                                      |                      |         Yes          |         Yes          |
| Orders                                        |                      | Setting; default off |         Yes          |
| Branch requests                               |                      |         Yes          |         Yes          |
| Suppliers                                     |                      |  Yes (no balances)   |         Yes          |
| Approvals                                     |                      |                      |         Yes          |
| Payables                                      |                      |                      |         Yes          |
| Users and devices                             |                      |                      |         Yes          |
| Settings                                      |                      |                      |         Yes          |
| History                                       |                      |     Own actions      |         Yes          |

Sidebar groups (Daily · Catalog · Supervisor · Admin), the top bar, and the right panel are defined in `design-language.md` (App shell). Lock and Sign out are in the user menu at the bottom of the sidebar.

## Screens

### Sign-in and lock

- **Sign-in:** centered card with the company logo, **Username** and **Password** fields, **Sign in** button, and the line "Forgot your password? Ask your Supervisor to reset it." On a registered store computer, a "Recent users on this computer" row of name chips appears above the form; tapping a chip fills the username.
- **Choose a new password:** shown at first sign-in and after a reset; nothing else is reachable until it is done. Shows the password rule in one line.
- **Lock screen:** after idle time; shows the signed-in user's name and a password field, plus "Sign in as someone else".
- **Locked account message:** "Too many attempts. Try again in 15 minutes or ask your Supervisor."
- Password re-prompt dialog before approvals, payables, settings, and users when the last entry is older than 15 minutes.

### Cashier lookup (also the first tab for everyone)

One very large search box (scan or type: name, Product Code, barcode, Persian or English). Filters: AI category. Result card: name (EN + FA), unit size, **Selling price** (large, before tax), tags: **Taxable**, offer pill ("2 for $5"), **New price pending** (amber). Shows the price to charge now; pending price appears only as a tag/secondary text. No costs, no stock numbers for cashiers. Results mirror the same grid in Persian: name block at inline start; price and pills in a fixed inline-end column. The selected row uses `--nav-active` and the 3 px accent bar so offer pills remain visible. **Edit** appears on the selected product card for the Supervisor only and opens the shared product editor described under Products. The card preserves invoice-calculated versus manually changed price provenance.

### Floor Worker home

Layout in `design-language.md` (Key layouts). KPI row: My drafts · Needs review · Offers to confirm · Expiring soon. Then today's suppliers with open returns, open shorts, and my notes. Quick actions: New invoice, New return, Print labels, Add note.

### Supervisor dashboard

Exact layout in `design-language.md` (Key layouts): four KPI cards, then actionable lists (Approvals queue, Alerts, Recent invoices, Returns, Supplier balances) and the right panel (Notes for Supervisor, Activity). The priority order of `requirements.md` §17 decides what appears first inside these lists. No wall of zero counters. The branch pill filters everything. Add purchase-by-supplier/current-month bars, last-eight-weeks purchase line, Arrived this week, and Price changes this week under the existing four-KPI layout; all are derived from real scoped prototype ledger/history data, with no sales series. Cards in each 12-column-grid row have equal height, common list rows and a fixed action column. Returns uses a header link to **View all returns**.

### Invoices

- Tabs: **Drafts · Processing · Needs review · Ready to post · Posted · Cancelled**. Search by supplier, number, date.
- **New invoice** presents **Upload** and **Manual entry** as adjacent clear choices. Upload retains the existing reading/review flow. Manual entry opens the same header and lines without waiting for AI: the Supervisor chooses branch, supplier (with **+ Add supplier**), supplier invoice number, invoice date and payment terms, then adds products (with **+ Add new product**), quantity and unit cost. The existing subtotal/tax/final-total, receiving employee/date and other mandatory fields remain in the review form.
- **+ Add supplier** opens the same max-720 px form as Suppliers. A Supervisor save is Confirmed; a Floor Worker save is Proposed, with no opening-balance fields. Supervisor confirmation is required before posting the worker's invoice. Deactivated suppliers are absent from new-invoice choices; their old invoice links remain readable.
- **+ Add new product** opens the shared product editor in new mode. Supervisor additions are Active immediately; Floor Worker additions remain Pending approval with no opening-count controls. Selecting a newly saved supplier or product returns to and updates the same invoice without losing existing header/line edits.
- Manual drafts can be saved without an original. The original photo/PDF dropzone stays available, and posting remains blocked until the original is attached and every existing posting/line-review requirement is met.
- **Lines table (review):** compact rows with shared column headers: description, matched product, qty, unit/units per case, unit cost, line total, calculated selling price, current price, status badges. Matched/confirmed lines stay collapsed; lines needing decisions open automatically; each line can be opened on click. An unassigned code reads **No Product Code yet** in muted text.
- Each line needs one required segmented choice **Track date: Yes / No**; an unanswered choice blocks posting. Yes reveals Expiry/Best before, date and optional lot. Preserve categories' prompting/default rules and stored four-decimal costs. **Mark as short** and lower-price questions remain available. A pending calculated price uses a **Pending** pill with **Goes to approval when posted** below; it is not an existing approval before posting.
- The document pane is sticky beneath the sticky top bar on wide screens. The invoice-amount note sits directly below the four summary tiles. **Use fictional demo answer** is available only in the top-bar Demo menu.
- Banner for blockers (supplier not confirmed, original file missing) above the bottom bar. Bottom bar spans the review width with `--surface` fill: **Save as draft** and **Post invoice**. Reserve content space so it never obscures fields.
- Invoice detail (posted): read-only with history, shorts, linked returns/credits.

### Products

One-line toolbar: search pill, compact filters (pricing category, AI category, status, supplier, has pending price, has offer, **Manual prices**), **Clear filters**, result count. Table headers share the body column widths, padding and logical alignment. **View** opens the product's own page with breadcrumb **Products / [name]** and a Back link; no detail panel below the list.

Product page: current-language name primary, other-language name directly below and muted; details within 960 px. Show names EN/FA, description, unit size, Product Code (read-only), category, tax profile, barcodes, approved/pending/branch prices, supplier products (SKU, pack size, last cost, role restrictions), offer, **Last received** per location and recorded changes. No stock estimate. Supervisor sees **Store cost**, **Margin %** in the list and cost history on the product page; staff prices retain the **Manual price** pill and rule/manual pair, with margin hidden from Worker/Cashier. New products created from invoices appear as **Pending approval**.

**Edit** appears on every product row and the product page for the Supervisor only. The same dialog opens from Lookup. Fields: names EN/FA, description, unit size, category, pricing category, barcode, supplier, date tracking, selling price. A price change asks for **All branches** (default) / **This branch only**, records the Supervisor decision, retains invoice-calculated price and invoice number, and appends a reversible before/after History entry. Example provenance, only when these values exist: **Calculated from invoice FV-20417: $2.99 · Changed by [name] on [date]: $3.29**. Worker receiving proposals are unaffected; Floor Workers and Cashiers do not see Edit.

**Add product (B, item 45)** is a Supervisor-only action at the top right of Products. It uses the same editor in new mode: names EN/FA, unit size, category, pricing category, barcode, supplier, date tracking, last unit cost before tax, selling price. No Opening count field in Phase 1. Product Code is assigned by the app and is never reused. Pricing fills the selling price; a changed value records a manual override and a below-minimum-margin value needs confirmation. Warn about a similar product name with a link and block a conflicting barcode. Save creates an Active product and History entry; no stock-count transaction is available; historical movements remain retained. Floor Workers and Cashiers have no standalone Add product; a worker's invoice-only **+ Add new product** remains a proposal.

### Approvals (Supervisor)

Tabs: **New products · Price changes · Tax profile changes · Barcode conflicts · Manual overrides · Below margin · Suppliers**. Each row shows old → new price, invoice number, actual invoice cost basis (displayed to two decimals, calculated/stored to four), margin, **Triggered by** employee name and which branch; actions **Approve** (choose All branches / This branch only) and **Reject**.

Barcode-conflict approvals show the attempted barcode and both products; A2 resolves them without transferring a barcode or changing approved prices.

### Alerts (Supervisor)

Same-supplier lower price: item, supplier, old/new cost, worker's answers (same expiry? units left? both dates) → **Taken care of / Still pending** + note. Other-supplier price, cross-branch conflict (**Mark as intentional / Apply to all**), tax discrepancy.

### Offers

List of active offers with product, price, offer, mix-and-match pool, start/end (optional), created by; **Stop**. "To confirm" tab with AI suggestions: **Confirm** (toggle: join mix-and-match) / **Dismiss**. Pool view: all products in "2 for $5", etc. Toolbar: search pill and compact filters for status, category, supplier, branch, offer type, **Clear filters**, result count; all combine within role scope.

### Labels

Three tabs: **Products · Waitlist (count) · Templates**.

- **Products:** search pill, filter chips (Arrived today, Price changed recently, On offer, pricing category, AI category, supplier), a scrollable table (name EN + FA, Product Code, price, offer pill, copies stepper, **Add to waitlist**), "Add all filtered". Products already on the waitlist show "On waitlist (2)".
- **Waitlist:** table of waiting items (copies editable, remove), template picker, A4 preview with clickable starting slot (used slots grayed), live bilingual label preview, **Print** (primary). After printing: "Did the labels print correctly?" Yes / No.
- **Templates (B):** saved presets; **New template** form (name; width, height, four margins, two gaps, two calibration offsets as narrow mm inputs); live A4 preview beside the form, scaled to fit the screen, redrawn on each numeric edit. Show **N labels per sheet (C × R)** and highlight the selected starting slot; **Print test alignment page**. Millimeter output remains exact regardless of preview scale.

### Returns

**Overview first:** shared table with **Return # · Supplier · Branch · Created · Items · Status · Next action**. One-line toolbar: search pill, supplier (default **All suppliers**), status (default **Pending**, excluding resolved/cancelled), branch, **Clear filters**, result count. Row click opens the return page. Selecting a supplier still immediately narrows to its visible open returns.

**Return page:** header **Return #1 · created [date] by [name]**, using the normal 24 px page-title style, status pill, status-driven primary action at the top right, and **Return policy** link opening a centered dialog. While Open, show only **Record pickup** (primary) and **Cancel return**; **Record resolution** appears after pickup when permitted by the state. A separate card contains the lines table; **Evidence and history** is below in another card. Pickup requires the representative name; optional photo/note. Resolution types remain those in §12 and the return policy, including recorded physical dispositions and fully/partially covered replacement quantities. History stays searchable; monetary posting remains Supervisor-only.

### Expiry (Date tracking)

Table: product, branch, date, type, days left, supplier/invoice. One-line toolbar: search pill, compact expiring-soon/expired/AI-category/branch filters, **Clear filters**, result count. Dates use Inter with tabular numerals. Show the linked invoice number/date instead of invented demo-stock wording. Row action **Mark as cleared**.

### Notes

Tabs for each notebook the user can read: built-in (**To order · Store use · For Supervisor**) then custom notebooks, each with an unread count pill. Fast add form showing only the fields the notebook enables. One-line search/filter toolbar across readable notebooks, **Clear filters**, result count. Supervisor: **New notebook**, **Edit notebook**, and **Archive notebook** actions; notebook settings dialog (name EN/FA, branch, read/add roles, fields, status, notify). These custom notebooks are the requested custom note categories. Other roles can read/add only as granted; they cannot change the definition. Archived entries remain searchable within permissions. B implements custom notebooks, including definition restoration without deleting entries.

### Received

Delivery-log table: **Product · Cases and units · Location · Supplier · Invoice number · Date · Received by**. Search pill plus date-range, location, supplier and product filters. Supervisor can see All branches; workers see assigned locations. Refused quantities, drafts and uninvoiced order-only shortages are excluded. Corrections show effective location with original invoice/history links. No stock total. Dashboard **Arrived this week** and product **Last received** use this same source.

### Suppliers

Defined in `requirements.md` §21.

- **Overview table:** supplier · status pill (Confirmed / Proposed) · last delivery · deliveries this month · open returns · open shorts · payment terms · sales rep and phone; **Supervisor only:** balance · overdue · next due date. Toolbar: search, branch pill, filter chips (Overdue, Open returns, Open shorts, Waiting for confirmation). Row click opens the supplier page.
- **Supplier page:** header with name, status, contact, sales rep, payment terms, and four KPI cards (Last delivery · Deliveries this month · Open returns · **Balance** for Supervisor, Open shorts for Floor Worker). Tabs: Overview · Invoices · Supplier items · Received · Returns and credits · Shorts · Price alerts · Payments (Supervisor only) · Notes.
- **Add supplier (B, item 44):** primary top-right action on the overview for Supervisor only; opens a max-720 px form with name, phone, email, sales rep and their phone, payment terms, optional address/notes, and optional opening balance per allowed branch plus an **as of** date. Before saving, warn about a similar existing name and link to that supplier. Supervisor save is Confirmed immediately; entered balances appear as **Opening balance** ledger rows in Payables.
- The supplier page shows Supervisor-only **Edit** and **Deactivate**, never Delete. A deactivated supplier keeps history and disappears from new-invoice choices. The invoice-only **+ Add supplier** opens this same form: Floor Workers see no opening-balance field, save Proposed, and cannot post until Supervisor confirmation.
- Floor Workers never see money columns, the Balance card, the Payments tab, the standalone Add supplier action or opening balances. Only worker-created invoice proposals remain Proposed until confirmed; Supervisor additions are Confirmed immediately.

### Payables (Supervisor)

One-line toolbar: supplier-name search pill, branch filter, **Overdue only**, **With balance**, **Clear filters**, result count. Supplier list with balance per branch; detail with ledger (invoices, credits, payments with cheque number and date, adjustments, opening balance, disputes with notes); **month-end summary** (print/CSV).

### Users and devices (Supervisor)

Users: list (name, username, role, branch, status, last sign-in); **New employee** (name, username, role, branch(es); the app generates a temporary password shown once); **Reset password**; **Unlock**; **Deactivate** immediately. Devices: register the store computer.

### Settings (Supervisor)

Two-column layout: a settings menu on the side (groups from `requirements.md` §22: Company, Branches, People, Catalog, Pricing and approvals, Offers, Taxes, Receiving, Returns/date tracking/labels, Notes, Notifications, Modules, Data) and the selected group's cards on the other side. Each group: short description, settings in cards, **Save changes** in a sticky bar when something changed, and a "Changed by … on …" line linking to History.

- **B demo boundary:** Company, Branches, Pricing categories (within Catalog), Offers, Notebooks (within Notes), Labels (within Returns/date tracking/labels), and Modules work. Other groups show structure only. B builds grouped Settings while preserving the existing price tester.
- **Branches:** table (bilingual name, Store/Warehouse location type, address, phone, status) + **Add branch**, edit dialog, deactivate.
- **Pricing categories:** table + **Add category**; edit dialog with cost divisor, rounding rule (bands with editable thresholds and endings, or "always up to next .99"), special corrections list, taxable, date-tracking prompt, minimum margin; a live **price tester** beside it (cost in → each calculation step → final price, values right next to their labels).

### History

Table: time, person, branch, action, item, before → after, with filters (person, branch, type, date range). Row action **Revert** (Supervisor, reversible entries only) with a confirmation dialog showing what will change and a conflict message instead of silently overwriting intervening changes. B Undo toasts use bottom-left/bottom-right-in-Persian placement, five seconds with hover pause, newest-first stacking, at most three visible plus **+N more**; each has action text and an **Undo** link. Floor Workers see their own scoped actions; Supervisors see all permitted company/branch actions. Creation and preserved historical opening-count/opening-balance records remain visible in History; physical/money corrections never erase originals or free a Product Code for reuse.

## Prototype navigation boundary after A2 approval

Suppliers overview/detail (moment 14) was implemented in A2 for Supervisor and Floor Worker. B activates History for Supervisor/all and Floor Worker/own actions, the authorized notebook access for Cashiers, and the working grouped Settings subset. Standalone Stock and Users and devices pages remain deliberately omitted: the brief contains no standalone Stock moment and permits minimal future user management. C removes product-page stock estimates and all opening-count fields. Existing physical movement history and sign-in/lock/password behavior remain retained; Received replaces visible stock information. Do not present unbuilt destinations as disabled working features. The navigation table above defines the full product, not a claim that every page ships in this prototype slice.

## Responsive behavior

Desktop/large store monitor is the primary target; short windows up to 1020px height use collapsible sidebar section headers with the current group open, preserving reachable Settings/user menu without sidebar scrolling, including the Orders and Branch requests links. The 1080p sidebar remains fully grouped/expanded. Tablet and phone browsers must work (sidebar collapses; tables scroll inside their container; forms become one column; camera upload works for invoice photos).

## C screen additions and changes (2026-10-09)

- **Notes:** Supervisor at All branches sees the add form with a styled concrete-location picker. New custom notebook defaults to Supervisor/Floor Worker read/add. Archived/read-only/scope restrictions explain why adding is unavailable. Saving a note persists its actual notebook/location and author.
- **Invoice review:** receiving Location defaults to own/current location; Ship to evidence suggests, never silently changes. An authorized reviewer may change to an active same-company location including Warehouse while retaining origin assignment. Show Units/Cases, editable remembered pack, and **3 cases × 12 = 36 units**. Manual price rows show **Rule price / Manual price** with **Keep manual price / Use rule price**. Linked order comparison opens difference rows and uses existing posting blocker banner for unresolved Short, Not delivered, kept/refused extras, price changes and short-dated date decisions.
- **Posted invoice:** Supervisor-only centered **Move invoice** dialog: destination, reason, old/new effective location, receipt/approval impact, allocated-payment evidence and outstanding supplier balance transfer preview. Save appends a correction/History; original remains read-only.
- **Suppliers → Supplier items:** product, supplier code, Case of N, last bought unit/case prices, date, invoice. Clicking opens history. Supervisor-only Add/Edit item and monetary columns/history; workers retain nonfinancial product/code/pack/date/invoice view. A manual item with no purchase shows bought metadata as blanks; explicit Supervisor quote is separate expected-cost provenance. Opt-in workers see order cost snapshots/expected amounts inside Orders only. **Received** tab reuses the supplier-filtered log.
- **Orders:** Supervisor-only sidebar item unless worker permission explicitly enabled in Settings. List: reference, location, supplier, date, before-tax expected total, status; compact status/supplier/location/date/search filters. New order is a bounded form with location/supplier then supplier-item table, narrow positive cases fields, pack/units/last purchase or explicit quoted prices, required **Expected unit cost** when no actual purchase/quote exists, expected before-tax total, **Save as draft / Place order**. Open To order notes have **Add to order**; free-text notes require an explicit supplier item and all linked notes require explicit Cases before placement, without an invented quantity. Detail shows receipt progress, linked invoice and **Print order** with clean bilingual A4 output.
- **Branch requests:** Incoming/Outgoing segmented tabs, count pill, location/status/search filters. New request selects different destination, catalog search or free-text item, Units/Cases/quantity, optional note; **Save as draft / Send**. Incoming request has custom checkboxes and **Short**, **Mark as sent**, **Print picking list**. Receiving checklist has actual arrived/missing decisions then **Mark as received / Close request**. **Copy short or missing items** creates a linked new draft. No costs, supplier balance or stock counters. Cancel applies only to Draft/Requested; Sent/Received keeps physical evidence and proceeds through receiving/closing.
- **Labels:** saved built-in **Regular** and **Promo** visible immediately, with Duplicate/Edit/Archive/Restore. Regular 60 × 40 mm/margins 10/gaps 4; Promo 210 × 148.5 mm/zero page margins-gaps/two per A4 with black border/content inset 5 mm. Promo active-offer preview is monochrome black SPECIAL/ویژه band, huge bold offer, smaller regular price and both names. Regular active offers automatically get small SPECIAL band. **Grayscale preview** shows actual print content regardless of app theme; an unpromoted Promo label shows huge approved regular price without false SPECIAL. Physical printer alignment still requires the operator's test page.
- All C screens use the existing shared styled controls, borderless cards, bounded fields, four-KPI maximum and English/Persian logical layout; no new native controls or sidebar scrolling at 1080p.
