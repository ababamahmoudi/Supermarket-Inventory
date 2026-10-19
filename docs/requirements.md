# Requirements (current owner workflow, C8/E — 2026-10-12)

C6/C7 supersede earlier presentation and interaction requirements where explicitly stated below. Historical acceptance sections record prior releases, not current defaults. Klead design language v1 is the sole current visual specification.

Sources: Super Arzon's workflow notes, the owner's brainstorm, and every decision made in planning. Where something was assumed rather than stated, it is marked **(assumed)** and listed in `open-questions.md`.

**Vision: AI and automation are the point of this product.** A supplier invoice (PDF or photo) is uploaded, AI reads it into structured lines, the app matches products, calculates prices, and flags what needs attention; people review and approve instead of typing. Every feature should move routine work from people to the system, while keeping a human check wherever money, prices, or stock are at stake.

## 1. Purpose and phases

Give a supermarket a **receiving and store-operations system** with price calculation, approvals, offers, labels, expiry tracking, supplier returns, supplier balances, orders, location requests and internal notes. **Phase 1 has no inventory system and shows no stock levels or stock estimates.**

| Phase     | Content                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | Clickable prototype (no backend) to pitch the owner                                                                                                                    |
| 1         | Core app: receiving log, products, pricing, approvals, offers, labels, expiry, returns, shorts, payables, notes, dashboard, orders and location requests; no inventory |
| 2 (later) | Separate paid inventory phase, after cash-register sales integration; accurate stock levels and shrinkage detection                                                    |
| 3 (later) | Customer website with food ordering, sign-in, scheduled pickup, receipt printer                                                                                        |

Record immutable physical movements (deliveries, returns, replacements, store use and transfers) now so the later inventory module can use them. Do not sum them into visible on-hand estimates, accept opening counts, or provide stock-count/adjustment screens in Phase 1. Inventory requires cash-register sales and is a separately paid phase; no paid resource or production deployment is authorized by C.

## 2. Tenancy and branches

- **Company** (e.g., Super Arzon) → **Locations** (Super Arzon has three stores and a warehouse). Every record belongs to a company; branch-level records also belong to a branch.
- **Shared across a company's branches:** product catalog (product codes are company-wide), supplier list, offer definitions, settings, pricing rules.
- **Separate per location:** invoices, delivery-log entries, orders, location requests, returns, shorts, expiry entries, supplier balances and payables, notes and To order entries. Stable `branch_id` remains the internal location key.
- **Prices:** each product has a company default price. A branch may have its own price (override). Different branch prices are allowed. When two branches differ, the Supervisor is alerted (see `workflows.md`, "Cross-branch price conflict").
- Floor Workers and Cashiers see only their assigned branch. The Supervisor can see and switch between all branches.
- Branch and company names, logo, and terminology are settings.
- The Supervisor can **Add location**, edit branch details (name, address, phone, opening hours, tax region) and deactivate a branch in Settings → Branches. A deactivated location keeps its history. Locations have type **Store** or **Warehouse**. Warehouse has no Cashier access; receiving, orders, returns, notes, Received and Branch requests still work. Demo store names are **North York**, **Richmond Hill**, **Newmarket**, plus **Warehouse**, loaded from configuration. Settings → Branches can add, rename and change location type and **Sells to customers**. Stores default to selling; Warehouse defaults to not selling. Non-selling locations are excluded from selling-price approval effects, offers and per-location price lists, while receiving, orders, requests, notes and returns remain available. Retain original stable Branch 1/2/3 storage IDs while replacing only the unedited demo EN/FA display names from configuration; Warehouse has its own distinct ID. Preserve saved custom names/data during additive migration.

## 3. Roles and permissions

Three roles. **Each employee has exactly one role**, and the app they see (menus, screens, data) is decided by that role. Everyone signs in with their own username and password; see §16. A shared in-store computer is expected.

| Capability                                                                                                         |        Cashier         |      Floor Worker       | Supervisor  |
| ------------------------------------------------------------------------------------------------------------------ | :--------------------: | :---------------------: | :---------: |
| Look up products and prices (including "Pending" labels)                                                           |          Yes           |           Yes           |     Yes     |
| See invoice costs (margins Supervisor-only)                                                                        |           No           | On invoices they handle |     Yes     |
| Propose products and correct invoice matching/details during receiving                                             |           No           |           Yes           |     Yes     |
| Open the shared product editor and edit the catalog or approved selling price                                      |           No           |           No            |     Yes     |
| Approve new products, price changes, tax-profile changes, barcode conflicts, manual overrides, below-margin prices |           No           |           No            |     Yes     |
| Create invoices, upload PDFs/photos, save drafts, post invoices                                                    |           No           |           Yes           |     Yes     |
| Quick-add a supplier (proposal)                                                                                    |           No           |           Yes           |     Yes     |
| Confirm a new supplier                                                                                             |           No           |           No            |     Yes     |
| Add a Confirmed supplier from Suppliers; edit or deactivate a supplier                                             |           No           |           No            |     Yes     |
| Add an Active product from Products (no opening counts)                                                            |           No           |           No            |     Yes     |
| Enter supplier opening balances per branch with an as-of date                                                      |           No           |           No            |     Yes     |
| Mark an invoice line Short / mark it Resolved                                                                      |           No           |           Yes           |     Yes     |
| Close a short as "not delivered"                                                                                   |           No           |           No            |     Yes     |
| Create returns, record pickup, record resolution, cancel a return                                                  |           No           |           Yes           |     Yes     |
| Create/stop offers and mix-and-match; confirm AI-suggested offers                                                  |           No           |           Yes           |     Yes     |
| Create label templates, use the label waitlist, print labels                                                       |           No           |           Yes           |     Yes     |
| Record store-use, to-order items, notes for the Supervisor                                                         |           No           |           Yes           |     Yes     |
| Create, edit, and archive custom notebooks                                                                         |           No           |           No            |     Yes     |
| Read and add to a custom notebook                                                                                  | If the notebook allows | If the notebook allows  |     Yes     |
| See History; undo own action within the undo window                                                                |           No           |       Own actions       | All actions |
| Revert a change from History                                                                                       |           No           |           No            |     Yes     |
| View Received; create/send/receive Branch requests                                                                 |           No           |           Yes           |     Yes     |
| Create, edit and place Orders                                                                                      |           No           | Setting; off by default |     Yes     |
| Edit supplier items, see catalog costs and margins                                                                 |           No           |           No            |     Yes     |
| Payables, supplier balances, payments, credits, opening balances                                                   |           No           |         **No**          |     Yes     |
| Suppliers overview: contact, last delivery, open returns, open shorts                                              |           No           |           Yes           |     Yes     |
| Suppliers overview: balance, overdue amount, next due date, payments                                               |           No           |         **No**          |     Yes     |
| Create employee accounts, reset passwords, deactivate users                                                        |           No           |           No            |     Yes     |
| Manage branches, devices, and all Settings (§22)                                                                   |           No           |           No            |     Yes     |
| Supervisor dashboard, all branches                                                                                 |           No           |           No            |     Yes     |

Floor Workers never see supplier balances or payables. Cashier = lookup only, unless the Supervisor gives cashiers access to a custom notebook.

**Manual entry (B, items 44–47):** **Add supplier** on the Suppliers overview and **Add product** on Products are Supervisor-only. Floor Workers and Cashiers never see these catalog actions or opening-balance controls, including when opening a form through a direct route. Floor Workers retain the invoice-only **+ Add supplier** and **+ Add new product** proposal flows: they create a Proposed supplier or Pending approval product, not a confirmed/active catalog record. A Supervisor uses the same forms from an invoice, with the direct-entry permissions below. Permission checks apply to the transaction and its fields, not only button visibility; the Phase 0 implementation enforces these checks in the scoped browser store, and the future API must enforce them on the server.

## 4. Products and product codes

- Every product has: **Product Code**, name (English, required), name (Persian, optional with English fallback), description (English/Persian, optional), unit size (e.g., "400 g"), **Sold by: Each / Weight**, pricing category, tax profile, AI category (see §14), date tracking (`Yes` / `No` / not set), barcode(s) (optional, multiple allowed), status. Each is the compatibility default. Weight pricing and source quantity/cost units follow §5 and pricing-engine.md.
- **Product codes are permanent.** Never reused. Archived products can be reactivated. Codes are strings, zero-padded to at least four digits (`0001`…`9999`), then continue as five digits (`10000`…). **(assumed: start at 0001)**
- Statuses: `pending_approval` (new product), `active`, `archived`.
- **Supervisor Add product (B):** the shared product editor also has a new mode for names EN/FA, unit size, category, pricing category, barcode, supplier, date tracking, last unit cost before tax and selling price, with no opening-count fields. The engine calculates selling price from the entered four-decimal unit cost and pricing category. A changed selling price records the Supervisor's manual-override decision; a price below the configured minimum margin requires explicit confirmation before saving. Unlike a receiving proposal, the Supervisor-added product is **Active immediately**, with no separate pending approval. Record its creation and price provenance in History; never claim a manual cost came from an invoice.
- **Next Product Code:** allocate the next company-wide code without reusing any previously assigned code, including archived or reverted records. Keep the existing zero padding and five-digit continuation. Block conflicting barcodes exactly as in the editor and warn when a name is close to an existing product, with a link to that product. A name warning does not replace the barcode block.
- **C scope change:** new products create no opening-count movement. Preserve previously recorded movements and historical records; hide their stock estimates and remove the starting-count controls.
- **Barcode conflict:** if a barcode being added already belongs to a different product, block it and create a Supervisor approval ("Barcode conflict") showing both products.
- In the A2 prototype, approving a blocked barcode conflict keeps the existing mappings; rejecting rejects the attempted change. Either choice preserves prices, overrides and offers. A future barcode reassignment needs a separate explicit decision.
- **Supplier products:** the same product may arrive from different suppliers with different supplier SKUs, names, pack sizes, and costs. A `supplier_product` record links supplier SKU/name to a product. An item from a different supplier at a different price is registered under that supplier (own SKU/name) and still raises an alert to the Supervisor (see §8).
- **Pack size:** invoices support **Cases** or **Units**. Each supplier item stores a positive integer `units_per_case`; all Units quantities are positive whole units, and fractional Cases are accepted only when exact Decimal quantity × pack yields positive whole units. Case quantities convert to units exactly (3 cases × 12 = 36 units). Unit-entry quantities are already units and must not be multiplied again. Price per case = exact unit cost × units per case for Each products. Weight products may use a retained case weight such as **Case of 10 kg**, with quantity/cost units explicit; selling-price units follow §5. Supplier item pack edits affect future entry only, never previously posted snapshots.
- **Shared product editor (A2):** only the Supervisor may edit catalog names (English/Persian), description, unit size, AI category, pricing category, barcode, supplier association, date tracking, and approved selling price. The same editor opens from Lookup, every Products row, and the product page. Product Code is read-only. Receiving proposals and worker invoice matching remain available under their existing permissions.
- **Manual price change:** ask for **All branches** (default) or **This branch only**, preview the affected prices/overrides, and record the Supervisor's save as the manual-override approval decision. The approved change runs the normal offer and cross-branch-conflict checks. Preserve the invoice calculation and its invoice number; do not overwrite the recorded cost basis. The product card and page show both **Calculated from invoice FV-20417: $2.99 · Changed by [name] on [date]: $3.29** when those are the real recorded values. Names, invoice numbers, dates and prices are isolated in Persian.
- Product-detail and price edits append reversible History entries with actor, branch/scope, time and before/after values. B builds the History/Revert interface on A2's stored entries. Revert must detect intervening changes rather than silently overwriting them.

## 5. Pricing categories and selling price

Four categories, defined as configuration (see `pricing-engine.md` for the exact algorithm and tests):

| Category          | Cost divisor | Rounding                        | Taxable | Date-tracking prompt |
| ----------------- | ------------ | ------------------------------- | ------- | -------------------- |
| Grocery           | 0.65         | Bands + 2.49/3.49 correction    | No      | Yes                  |
| Grocery (Taxable) | 0.65         | Bands + 2.49/3.49 correction    | Yes     | Yes                  |
| Rice              | 0.80         | Always up to next .99           | No      | **No**               |
| Kitchenware       | 0.60         | Bands (no 2.49/3.49 correction) | Yes     | No                   |

- All calculations use **cost before tax**.
- The selling price is always **displayed before tax**. Taxable products carry a clear **Taxable** label so the cashier adds tax at the register. (This also applies to labels: tax indicator on.)
- The pricing category drives pricing rules. It is separate from the **AI category** used for filtering (§14).

## 6. Approvals

Every calculated selling-price change needs Supervisor approval.

| Event                                     | Approval                                |
| ----------------------------------------- | --------------------------------------- |
| New product proposed during receiving     | Always                                  |
| Sales-tax profile change                  | Always                                  |
| Barcode conflict                          | Always                                  |
| Manual selling-price override             | Always                                  |
| Calculated price below the minimum margin | Always                                  |
| Ordinary calculated price change          | Yes (Supervisor review)                 |
| Supplier cost change only                 | No, unless it changes the selling price |

**Supervisor manual-entry exception (B):** saving Add product is the Supervisor's creation/price decision, so it activates the product without a separate approval step. Manual overrides are recorded, and a below-minimum-margin price requires an explicit confirmation. Worker invoice-created products remain pending and use the normal approval flow.

**Pending prices:** a proposed price is visible in the Products section, clearly labeled **Pending**, so workers and cashiers know it still has to be confirmed. The cashier keeps charging the **last approved price** and never sells at a pending lower price. **(assumed)** For a brand-new product with no approved price, the lookup shows the proposed price labeled "Pending: confirm with a Supervisor before selling". **(assumed)**

When approving, the Supervisor chooses **All branches** (default) or **This branch only** among active selling locations. Warehouse/non-selling locations never appear in affected selling-price/offer rows unless Sells to customers is enabled. A receipt at a non-selling location may still create the normal Supervisor proposal; an all-locations decision affects selling locations, and a non-selling branch-only selling-price decision is unavailable.

Invoice-derived approvals are created **only when that invoice posts**, with the invoice number/line, actual four-decimal cost basis, posting employee and date. A draft or Ready to post invoice creates no live approval. The starting demo may contain a separate pending approval from an earlier fictional posted invoice; its cost, calculated price and margin must agree. Display unit cost to two decimals (for example, `$1.40`); retain four decimals for computation, editing and stored provenance. The margin is calculated from the retained exact cost, never from rounded display text.

## 7. Same-supplier lower price and different-supplier price

When a received item's unit cost is **lower than the last cost from the same supplier**, the Floor Worker (or invoice reviewer) is asked:

1. Is the expiry date the same as the stock already on hand?
2. If **yes**: how many units are left that were bought at the higher cost?
3. If **no**: what are both expiry dates?

The answers plus the item and both costs become an **alert** for the Supervisor, who marks it **Taken care of** or **Still pending**.

When the same item arrives from a **different supplier** at a different price, register it under that supplier (supplier name, SKU, etc.) and still raise an alert to the Supervisor.

## 8. Offers and mix-and-match

- Offers are **fixed by selling price**. Default mapping **(assumed from the arithmetic; configurable)**: $1.99 → "3 for $5", $2.99 → "2 for $5", $3.99 → "2 for $7".
- A product has at most one effective regular offer per selling location, applying the existing company/branch precedence. A dated-lot clearance is a separate, explicitly scoped offer under §33; never create a second catalog product or multiple conflicting prices for one barcode at one store.
- **No approval is needed** for offers. Floor Workers and Supervisors can create and stop them.
- Start and end dates are **optional**. An offer can stay active until manually stopped.
- **Mix-and-match** uses **global pools per offer**: every product flagged "Mix & Match: 2 for $5" can be combined with every other product in that pool, regardless of category or supplier (a juice can be mixed with a can of beans).
- **AI-suggested offers:** when a product's price becomes effective at $1.99, $2.99, or $3.99 and it has no offer yet, create a suggestion task for the Floor Worker: confirm the offer and whether it joins the mix-and-match pool. It waits for the worker's confirmation.
- Offers follow the scope of the price they belong to (company default or a branch override), and apply only to locations configured to sell to customers. Non-selling Warehouse is excluded from offer creation/suggestion scopes and effect lists by default.
- **Offers filters (A2):** one compact toolbar with a search pill plus status, category, supplier, branch and offer type. Search matches either product name, Product Code and the offer label. Filters combine, remain within the user's allowed branch/company scope, and include **Clear filters** and the result count. Branch-scoped roles cannot broaden their access through the branch filter.
- **C5 Current / Past offers:** Current contains active/scheduled offers only, one row per product grouping permitted scopes and preserving valid branch overrides. Stopped/ended records remain in Past newest first. An identical repeat submission in the same scope returns the existing current offer without adding history/audit churn; changed terms retain the stopped predecessor. Keep mix-and-match, scope and Undo.
- Not needed: promotion margin display, label queue.

## 9. Labels

- **Product list for labels:** every product, searchable (name in either language, Product Code, barcode), with filters: **Arrived today** (on an invoice posted today in this branch), **Price changed recently** (approved in the last N days, setting, default 3), **On offer**, **Pricing category**, **AI category**, **Supplier**. Rows: checkbox, names EN + FA, Product Code, Selling price and Offer. **Select all filtered** selects the current filtered set. Selection reveals a sticky bar **Copies [1] · Add N products to waitlist**; no per-row Copies/Add action in Products. Individual copies remain editable in Waitlist. Bulk addition uses existing scope, merging and price eligibility rules.
- **Label waitlist** (this reverses the earlier "no label queue" decision): a shared list per branch, so one worker can add items and another can print them. Change copies, remove items, clear the list. Printed items leave the list automatically. Adding is manual; a setting can add products automatically when a new price is approved (**off by default**).
- **Printing must really work:** the app produces an exact-size A4 layout (in millimeters) that prints from the browser or saves as PDF, with Persian text rendered correctly.
- Fields on the default Super Arzon label: product name, description, price, offers, **product code**, **Super Arzon logo**, **unit size**, **tax indicator**. **Not** shown: barcode, promotion expiry date. Label fields are a setting.
- Omit the logo on labels narrower than **50 mm**. When the logo is shown on a label at least 50 mm wide, make it at least **8 mm tall** and preserve exact-size containment; never shrink it to illegible decoration.
- Languages: **English and Persian** together.
- Multiple labels per A4 sheet, and **start at a selected slot** on a partially used sheet.
- **Built-in templates (C reverses no default template): Regular and Promo are ready to use.** Regular uses the tested 60 × 40 mm shelf-label layout, 10 mm A4 margins and 4 mm gaps; Promo uses exact half-A4, 210 × 148.5 mm, zero page margins/gaps, exactly two labels per sheet. Its 1.5 mm thick black border and content are inset at least 5 mm from the physical edges. These are editable geometry presets. Duplicate, edit, archive and restore templates; never delete them or overwrite saved user templates during migration. Each template retains calibration offsets and a **test alignment page**. Promo has a thick black border, solid black band with white **SPECIAL / ویژه**, very large bold offer, smaller **Regular $2.99** and both product names. Regular labels with active offers get a small black SPECIAL band. Provide a grayscale preview; print stays exact-size and monochrome-safe regardless of app theme. Regular's active-offer SPECIAL marker is mandatory even if optional offer text is disabled. If Promo is used without an active offer, show the regular approved price large and omit SPECIAL/offer text rather than inventing a promotion.
- **B template designer:** the Products tab has a search pill. Beside the template form, show a live A4 preview scaled to fit the screen and redrawn after each numeric change; display **N labels per sheet (C × R)** and highlight the selected starting slot. Exact millimeter geometry remains the printing source, independent of scaled screen preview.
- Output must render Persian text correctly (see `architecture-devops.md`).

## 10. Date tracking (expiry and best-before)

- One area called **Date tracking**, with **Expiry** or **Best before**. Explicit product Yes/No initializes invoice Track date; unset asks. Yes requires a valid type/date and normal line confirmation. Short-dated receipts require an actual expiry regardless of prior preference.
- Products have configurable **Remind me ___ days before expiry**, defaulting to the existing Settings expiry window (`expiry.expiring_soon_days`, currently 30). Each date uses its product's reminder days. No duplicate global default is introduced. When an active tracked date enters its window, create one scoped alert for that date in Alerts and the bell; e.g. **Lavash Bread expires in 5 days · North York**. Refresh, repeated evaluation and day changes never create duplicate alerts. Resolve/suppress that reminder when removed or tracking stops; History remains.
- **Add/Edit product:** English name and pricing category required; Persian name, descriptions and category optional. Date tracking Yes immediately reveals a section in the same form: current concrete location's dates, add/change/remove with type, quantity and lot, and reminder days. Save product and edited date entries together atomically; Cancel commits neither. Optional labels use **Name (optional)**. Missing Persian name displays English, not an invented translation.
- **Lookup is read-only for dates for every role.** Remove its tracking switch and date/Add field completely. Show retained scoped expiry such as **Expires 2026-10-23 · North York**, close-date pill and Last received. Supervisor Edit opens the shared product form; operational workers retain the quick-add page, not Lookup catalog editing.
- **Fast entry remains:** Date tracking scan/name/code/barcode product → date/current allowed concrete location → Enter/Add; clear and refocus product, retain date/location, clear optional evidence, pin/highlight new entry. More reveals Expiry(default)/Best before, Quantity/Lot/Note. Products ⋯ Add date opens the quick bar preselected. Quantity is recorded evidence, never on-hand stock.
- **Stop tracking:** every turn-off flow (Edit product or permitted row ⋯) requires one explicit choice: **Stop tracking, keep the date on the product** or **Stop tracking and clear the dates**. Both set preference No, remove the product from operational Date tracking lists (including All dates), and stop reminders. Keep retains dates on Lookup; clear marks dates removed and preserves History. Never leave an untracked product in an active list. Existing Removed/history evidence remains searchable. Catalog preference changes remain Supervisor-only; workers retain scoped entry add/remove, not general preference editing.
- **Remove one date:** Sold out / Thrown away / Returned to supplier / Entered by mistake; preserve actor/time/reason and eligible Undo. This is not an automatic physical movement, inventory adjustment or supplier credit.
- **Reuse another location's date:** during delivery review, for tracked same-company/product/supplier lines, show dates entered at other locations in the preceding seven days with location, entered day, type/date and optional lot; **Use this date** fills the draft. Explicit action required. This narrow worker sharing exception reveals no other-location costs, quantities, invoices or unrelated records, and grants no broader access. Date evidence entered here remains at the receiving location.

## 11. Invoices and receiving

Invoices arrive as PDF (sent to the Supervisor) and on paper (handed to Floor Workers). Both end up in the app.

Header fields:

- **Mandatory:** supplier, invoice date, received date and time, receiving employee, branch, subtotal, tax, final total, original image/PDF (required before posting).
- **Optional:** supplier invoice number (if blank, auto-assign 1, 2, 3… per supplier and mark "system-assigned" **(assumed: per supplier)**), due date, payment terms.

Rules:

- **Drafts:** an invoice that is neither cancelled nor submitted stays as a **Draft** (like an email draft). Workers are often busy and cannot attach the image right away. A draft can be saved at any time and cannot be posted without the original file.
- **New invoice (B):** **Upload** and **Manual entry** are clear adjacent choices. In manual entry the Supervisor chooses branch, supplier (including **+ Add supplier**), supplier invoice number, invoice date and payment terms; adds any product (including **+ Add new product**) with quantity and unit cost; then reviews the same calculated prices/date decisions/shorts as an uploaded invoice. Manual entry does not bypass the original-photo/PDF requirement, supplier confirmation, matching or line-review rules. A draft can be saved without the original; posting cannot.
- **Location** defaults to the signed-in user's own allowed location (Supervisor current location when concrete). An extracted delivery-address match such as **Ship to: North York** suggests that location and requires reviewer confirmation; it never silently changes location. The authorized reviewer handling the unposted invoice may choose any active receiving location in the company, including Warehouse, without gaining general access to that location's other records. Retain the reviewer's origin location/assignment to authorize this draft and its posting; posted visibility follows effective receiving location. After posting, only Supervisor can **Move invoice** with a reason and correction preview; preserve the original posted header and append linked corrections that moves effective Received entries, current outstanding supplier liability and source-linked approval location, with History. See workflows §1A.
- **New suppliers:** a Floor Worker can quick-add a supplier proposal while entering an invoice. The invoice cannot be **posted** until the Supervisor confirms the supplier.
- The invoice **+ Add supplier** uses the Suppliers form. Phone, email, sales representative, sales representative phone and payment terms are optional during creation. This new/missing-details review gate applies to manual entry; pre-existing uploaded invoice supplier behavior is preserved. Invoice-created suppliers are Proposed for both creating roles, with an explicit invoice-review-required marker; only their Supervisor confirmation completes that review. A new supplier, or any missing contact/terms detail, routes that invoice to **Needs review** for the Supervisor; it cannot post until the Supervisor fills required review details and explicitly confirms the supplier. Standalone Supervisor supplier creation keeps its existing Confirmed behavior, but invoice-created new suppliers require this explicit review. Floor Worker additions are Proposed and have no opening-balance field. Deactivated suppliers are excluded from new-invoice choices while existing invoice links remain intact. **+ Add new product** likewise uses the shared editor's new mode: Supervisor additions are Active; Floor Worker proposals remain Pending approval and have no opening-count controls.
- **Shorts:** when the supplier forgot an item that is on the invoice, the worker marks that line **Short**; its amount (plus its proportional tax) is **deducted from the payable total**. If the supplier brings it later, the worker marks the line **Resolved** and the amount returns. If it never comes, the Supervisor sees the invoice and the deducted amount and closes it as **Not delivered**.
- **Payment terms:** styled dropdown **Cash on delivery · Weekly (7 days) · Every 2 weeks (14 days) · Monthly (30 days) · Other** (nonnegative whole days producing a valid due date). Compute due date from invoice date and selected day count; due date stays editable. **Final total** follows Decimal Subtotal + Tax until explicitly edited; a different entered total is a warning, not a posting error.
- **Store time:** staff enter/see the configured store time zone (`America/Toronto` in the demo), never UTC labels; store UTC internally. Local received date/time must fit on one line and survive UTC-midnight/daylight-saving boundaries.
- **Draft/manual lines:** **Remove line** with action Undo; quantity fields **Invoiced** and **Delivered**. Counted units use singular/plural everywhere.
- **Tax discrepancy:** if subtotal + tax ≠ final total, or tax does not match taxable lines at the configured rate (within a tolerance), raise a Supervisor alert (does not block posting).
- Posting an invoice: records actually received movements and delivery-log entries, creates price proposals and alerts, and creates the invoice entry in that location's supplier balance. Posted invoice source records are immutable and display as clean read-only documents; only the Supervisor can **Correct invoice** with a required reason, preview and appended linked correction. See §30; no disabled draft form or auto-save message.
- **AI reading:** an uploaded PDF/photo is read automatically into structured lines (see `data-model.md`). A person must review and confirm before posting. Failures fall back to manual entry.

## 12. Supplier returns

**Overview:** **Open / History** tabs. Open contains **Waiting for pickup** and **Waiting for credit**; History contains **Closed** (subtype **Credited**, **Replaced** or **Written off**) and **Cancelled**. Map retained `open` → Waiting for pickup, `picked_up`/`partially_resolved` → Waiting for credit, `resolved` → Closed with its actual outcome, `cancelled` → Cancelled; never rewrite historical physical evidence to rename a status. Compact search/supplier/status/location filters combine within role/company scope. The supplier page's Returns tab uses the same tabs, filters and statuses. No Returned to stock column.

**Return page:** created date/employee, status and next action, Back to Returns and Return policy dialog. While waiting for pickup: **Record pickup** Primary and **Cancel return** Danger; after pickup: **Record resolution** when permitted. Product lines and evidence/history use separate cards. Financial balance columns and confirmed-credit posting remain Supervisor-only; workers record operational evidence/claims under the existing policy.

- A return can contain several products and be picked up without a new invoice. Pickup requires actual quantities, supplier representative's typed name and retained signed-paper evidence; photo optional. Preserve actual set-aside/pickup/replacement/safe-original-recovery events, no stock estimate.
- **Record pickup** retains a printable supplier-facing **Return memo**, English by default with a per-document language setting, with a stable **RM-0001**-style reference, supplier/location/date/items/quantities/unit costs/expected credit/driver name/signature line. It records expected claim evidence, not a supplier-issued credit note. Printing does not settle the return.
- At pickup, company setting **Deduct expected credit at pickup** defaults On. The Supervisor's Payables projection deducts the retained expected amount and labels it **Pending credit**: $600 − $30 = **$570 owed, $30 pending credit**. This is a provisional claim projection; it must not create a confirmed financial credit or change protected financial evidence merely because a worker recorded pickup.
- **Credited:** Supervisor verifies the credit note number, actual amount and evidence, then posts each distinct authorized item settlement once with allocation/coverage checks. C6 permits multiple distinct partial credit notes for disjoint outstanding item coverage, retaining one linked invoice; duplicate credit-note references and overlapping coverage are blocked. Replace the expected projection with actual confirmed credit, never double deduct. Expected $30, actual $25 leaves $575 owed; the missing $5 becomes owed again. Workers may submit evidence, not confirm money.
- **Replaced:** link actual replacement delivery/invoice and retain actual product/quantity/date/employee/evidence. Replacement creates no invoice payable or financial credit. Owner confirmed: release the provisional expected credit when the return is replaced, restoring projected owed ($570 → $600). This is removal of a claim projection, not a new purchase payable or confirmed financial-credit posting.
- **Written off:** require a reason and Supervisor financial authorization, remove pending credit and restore the amount owed through a recorded outcome, preserving claim/evidence. $570 owed with $30 pending returns to $600 owed.
- **Cancelled:** preserve safe-original disposition checks; cancellation does not prove recovery and cannot erase already received replacements or posted settlements. Unsettled operational cancellation remains available to workers, but financial reversal/settled cancellation needs Supervisor review.
- Create one Supervisor alert when waiting-for-credit age exceeds **14 days** (configurable); resolve/deduplicate it as the recorded outcome changes. Completed/cancelled/removed audit evidence stays searchable.

## 13. Payables (Supervisor only)

Purpose: organize each supplier's balance so the Supervisor can enter it into QuickBooks manually. No QuickBooks integration now.
Record, per branch and supplier: supplier invoices, supplier credits, payments made outside the app, cheque number, payment date, partial payments, manual adjustments, **opening balance** at first deployment, notes and disputes.
Show: balance, separately labeled pending return credits, open invoices, overdue invoices, month-end summary that is printable and exportable (CSV). The pickup expected-credit setting changes the projected owed amount only; distinguish pending claims from confirmed ledger credits and reconcile each projection to its retained return memo/outcome. Floor Workers and Cashiers must never see any of it.

**Payables filters (A2):** one compact toolbar with a supplier-name search pill, branch, **Overdue only**, **With balance**, **Clear filters**, and the result count. Supervisor can select allowed branches or All branches. Filters affect the supplier overview and selected financial totals consistently; they do not change any ledger entries.

Demo balances must be supported by explicitly fictional posted invoices, payments/credits/adjustments and corresponding recorded delivery receipts, not an unexplained aggregate added to the ledger. Recent invoices, open invoice count, due/overdue amounts, Supplier balances and Payables must reconcile from the same scoped records. Earlier snapshot-only presentation is superseded for the A2 demo; financial allocation, correction and four-decimal unit-cost rules remain unchanged.

## 14. AI categories

AI assigns each product a flexible **AI category** from its name (beans, juices, meat, spices…), used to **filter product lookup** and separate from the four pricing categories. Receiving may propose a category; the A2 shared catalog editor is Supervisor-only, including direct category edits (§4).

## 15. Notes and notebooks (replaces paper notebooks)

Every entry is stamped with author, branch, and time. Three **built-in notebooks** keep their special behavior:

- **To order**: "we're out of this" reminders. Status open / ordered.
- **Store use**: items taken from the floor for the store's own use. Records a physical movement for later inventory, without displaying or calculating a stock level.
- **For Supervisor**: reminders and hand-over notes (status open / seen / done). The Supervisor is notified.

**Custom notebooks** are the requested **custom note categories**. Only the Supervisor can create, edit the definition/settings of, and archive them; allowed readers/contributors cannot change the notebook definition. The Supervisor creates notebooks such as "Cleaning log", "Deli temperatures", or "Lost and found". Settings per notebook: English name required, Persian name optional (fall back to English when absent), branch (one branch or all), which roles can read and which can add, optional fields (product, quantity, date, a number with unit such as a temperature), whether entries have a status (open/done), and whether the Supervisor is notified. Notebooks can be archived and restored (entries stay searchable for authorized readers); editing a definition preserves existing entries and records before/after History. Search across all notebooks the user can read. New custom notebooks default to allowing **Supervisor and Floor Worker** to read/add. In **All branches**, Supervisor sees the add form and chooses one allowed location before saving; the entry always has a concrete location. If adding is unavailable, explain the actual cause (archived notebook, read-only permission, no allowed location, or location outside notebook scope). Never hide the form silently.

## 16. Accounts, sign-in, and the shared store computer

- **The store registers its employees.** Nobody can create their own account. The platform owner (Ali) creates the first Supervisor account for each company; the Supervisor creates every other account: name, **username** (unique within the company), role, branch(es), and a **temporary password**.
- **First sign-in:** the employee must choose a new password before doing anything else.
- **Forgotten password:** the Supervisor resets it to a new temporary password; the forced change happens again. (No email is needed, so staff without an email address are fine.)
- **Password rules:** at least 8 characters; common and breached passwords are blocked; no other complexity rules. After 5 wrong attempts the account is locked for 15 minutes (settings), and the Supervisor can unlock it.
- **No PINs.**
- **Registered store computer:** shows a "recent users on this computer" list, so an employee taps their name and types their password. Unregistered devices show a plain username + password form.
- **Idle lock:** after idle time (setting, default 5 minutes **(placeholder)**) the screen locks and asks for the same user's password, or lets a different user sign in. Every action is stamped with the signed-in user, so forgotten sign-outs must not misattribute work.
- Approvals, payables, settings, and user management ask for the password again if it was last entered more than 15 minutes ago (setting).
- **Each company has its own web address** (e.g., `arzon.<product-domain>`), so the same username can exist at two different supermarkets.
- **Later options, not now:** invite-only "Sign in with Google" (works only for emails the Supervisor has added; mainly for the Supervisor), and a second sign-in step (authenticator app code) for Supervisors.

## 17. Supervisor dashboard

Order of importance: approvals waiting (new products, price changes, barcode conflicts, supplier proposals) → same-supplier lower-price alerts → cross-branch price conflicts → tax discrepancies → AI invoices waiting for review and AI failures → open shorts → open supplier returns and returns waiting for credit → upcoming expiries → overdue invoices and supplier balances → recent posted invoices → employee activity. No additional KPI cards beyond the specified four.

**A2 supporting content:** **Purchases by supplier, this month** (bar chart) and **Purchases, last 8 weeks** (line chart), computed from posted, non-voided purchase invoices in the selected company/branch and company time zone. Use net invoice purchases after open shorts and linked purchase credits/compensating invoice corrections; exclude payments, opening balances and unrelated manual adjustments. Retain Decimal aggregation until chart rendering. Display an honest empty state where there are no purchases. These are purchase charts, never sales/revenue charts: no cash-register sales data exists yet.

Add **Arrived this week**, drawn from actual posted Received entries in the current company-timezone week, and **Price changes this week**, drawn from effective approved/manual price-change records. Arrivals show product, delivered cases/units, location/date and invoice link, never stock levels. Do not invent demand, sales history or low-stock thresholds. Charts/lists follow the layouts in `design-language.md`.

## 18. Terminology (use exactly)

Invoices (subtitle: "Deliveries and supplier invoices") · Suppliers · Last delivery · Floor Worker · Kitchenware · Grocery (Taxable) · Returns (subtitle: "Supplier returns and credits") · Product Code · Selling price · Date tracking (Expiry or Best before) · Label waitlist · Notebooks · History · Received · Location · Store cost · Manual price · Rule price · Orders · Branch requests · Short-dated (expiry discount). Persian equivalents are stored as translations and reviewed by Ali.

## 19. Platform

Web app first (responsive; works on desktop, tablet, phone browsers; installable later). Native phone and desktop apps are later options. Hosting on AWS later; development happens locally in containers.

## 20. Non-functional

Fast tables with search and filters; keyboard-friendly entry; clear audit trail; daily backups; data export; no data loss on refresh (drafts auto-save); accessible contrast; works with a barcode scanner (keyboard wedge) and a document scanner or phone camera for invoice images.

## 21. Suppliers overview

A dedicated **Suppliers** section (company-wide supplier list; figures shown for the selected branch, or all branches for the Supervisor).

**Overview table:** supplier name · status (Confirmed / Proposed) · **last delivery** (date of the most recent posted invoice for that supplier in the branch) · deliveries this month · open returns · open shorts · payment terms · sales representative and phone. **Supervisor only:** balance · overdue amount · next due date.
**Compact defaults:** Supplier, Status, Last delivery, Deliveries, Open returns, Open shorts, Balance and Overdue for Supervisor (eight columns); workers omit money (six). C5 clickable names/rows replace redundant View and the empty Actions column. Payment terms, sales representative/phone and next due date start hidden but remain available in permitted Columns choices/details. Extra selected columns wrap/group within desktop width.
Filters: branch, overdue (Supervisor), has open returns, has open shorts, waiting for confirmation. Search by name. Sort by any column.

**Supplier page tabs:** Overview (contact details, sales representative, default payment terms, key figures) · Invoices · Supplier items (supplier code, pack, last bought case/unit price, date/invoice, price history) · Received · Returns and credits · Shorts · Price alerts · Payments (**Supervisor only**) · Notes.

**Add supplier (B, item 44):** the Supervisor-only primary action on the overview opens a form no wider than **720 px**: name, phone, email, sales representative and their phone, payment terms, optional address and notes, and optional opening balance for each allowed branch with an **as of** date. Warn before saving if the name is close to an existing supplier, with a link to that supplier; the warning helps prevent duplicates and does not silently merge records. A Supervisor save creates a **Confirmed** supplier immediately. Each entered branch balance becomes a separate **Opening balance** supplier-ledger entry with its as-of date, Supervisor and company/branch scope, and appears in Payables. It is not a purchase invoice and does not enter purchase charts.

The same form opens from the invoice Supplier field's **+ Add supplier**. A Floor Worker can use that invoice-only flow, without opening-balance fields, and creates **Proposed**; posting stays blocked until the Supervisor confirms it. The supplier page has Supervisor-only **Edit** and **Deactivate**, never Delete. Deactivation removes the supplier from new-invoice choices but preserves contact/creation history, all prior invoices, returns, supplier products and ledger entries. Record additions, confirmations, edits and deactivation in History; existing financial history is corrected with entries rather than erased.

"Last delivery" always means the last actual **delivery/invoice received**, not an order date. Orders are separate records; an unreceived order never changes deliveries or Payables. Supplier items are built from posted invoice lines and can also be added/edited manually by Supervisor; clicking a row opens its price history. Costs are Supervisor-only here; workers can see product, supplier code, pack, date and invoice reference without monetary columns.
Floor Workers see the same section without any money columns or the Payments tab (enforced on the server).

## 22. Settings and store customization

Each supermarket must be able to shape the app to its own way of working without code changes. Settings are grouped like a standard back-office system; each setting is company-wide unless marked per branch.

| Group                        | Settings                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company                      | name, logo, brand color, currency, time zone, languages, date format, text size default                                                                                                                                                                                                        |
| Branches                     | **Add location**, edit, deactivate; bilingual name, location type (Store/Warehouse), Sells to customers (Store On/Warehouse Off), address, phone, opening hours, tax region                                                                                                                    |
| People                       | employees, roles and permissions, password rules, lockout, idle lock, registered store computers                                                                                                                                                                                               |
| Catalog                      | pricing categories (add, edit, archive; cost divisor, rounding rule, special corrections, taxable, date-tracking prompt), AI categories (rename, merge), units, Product Code format                                                                                                            |
| Pricing and approvals        | which changes need approval, minimum margin per category, default approval scope (all branches / this branch), cross-branch conflict alerts on/off; Weighed items: main display lb (default) or kg, show second unit On, use rounding bands On                                                 |
| Offers                       | price-to-offer mappings, mix-and-match pools, AI offer suggestions on/off                                                                                                                                                                                                                      |
| Taxes                        | tax profiles, rates, extra fees such as container deposits                                                                                                                                                                                                                                     |
| Receiving                    | required invoice fields, automatic invoice numbering, tax-mismatch tolerance, AI reading on/off and the confidence level below which fields are highlighted, same-supplier lower-price questions on/off                                                                                        |
| Returns/date tracking/labels | resolution types, photo required/optional, representative-name policy, Deduct expected credit at pickup On, waiting-for-credit alert after 14 days; expiring-soon days, category prompts; label fields/languages, waitlist auto-add (off by default), recent-price days, templates/calibration |
| Notes                        | built-in notebook behavior; create, edit, archive and restore custom notebooks with read/add permissions and fields (§15)                                                                                                                                                                      |
| Notifications                | which events notify whom (in-app now; email later)                                                                                                                                                                                                                                             |
| Modules                      | turn sections on or off per company (e.g., Returns, Payables, Labels; later Register, Online orders)                                                                                                                                                                                           |
| Data                         | import and export (CSV), History                                                                                                                                                                                                                                                               |

**Exact group order:** Company → Branches → People → Catalog → Pricing and approvals → Offers → Taxes → Receiving → Returns/date tracking/labels → Notes → Notifications → Modules → Data. These are the B groups; Ali approved implementation after A2 on 2026-10-08.

**Working in the B demo:** Company, Branches, Pricing categories under Catalog (including rounding rules and the price tester), Offers, Notebooks under Notes, Labels under Returns/date tracking/labels, Modules. All other groups/areas show their structure only; they must not imply that nonworking actions save changes. Every actual settings change is recorded in History and can be reverted by the Supervisor.

## 23. History and undo

- **History page:** every action (who, what, when, branch, before → after), filterable by person, branch, type, and date. Floor Workers see their own actions; the Supervisor sees all.
- **Undo (C6):** one action message at bottom inline end (right EN / left FA), about **8 seconds**, dark ink with Undo and ×. A new eligible action replaces it; no stacking. Reserve space above sticky page actions. Show for remove, stop, approve, reject, send or complete transitions, including date/line removal and supported mark-done actions; **never for field edits or autosave**. Keep existing safe reversible transactions/History, even when no transient message is shown.
- Undo restores only the action's affected values, not an entire stale store snapshot. Recheck company/role/location/entity versions, refuse a conflicting reversal, preserve later independent changes and append audit/corrective physical evidence. Place order and linked To order status may Undo only before any receipt or later edit, preserving the order reference and audit trail. Request sent/received reversal retains actual transfer events and appends transfer_correction evidence referencing the original; never claim goods moved back, erase a recorded delivery or fabricate goods. Physical/financial irreversible actions remain outside simple Undo.
- **Revert:** the Supervisor can revert reversible changes from History (prices, offers, product details, settings, notebook entries). Reverting is itself a new recorded action; nothing is erased.
- **Confirmation and corrections instead of Undo** for invoice posting, payments, Move invoice, Correct invoice and legal/financial records. Preserve original invoices, ledger allocations and physical events; no destructive Undo of them. Subsequent corrections append evidence and impact changes.
- Printed labels cannot be "unprinted"; History simply records the print.

## 24. Received (delivery log)

- Columns: **Product · Quantity in cases and units · Location · Supplier · Invoice number · Date · Received by**. Every row traces to an actual posted receipt; drafts, refused lines and order-only missing items add nothing. Replacement and later short deliveries retain their own evidence/receipt links.
- Filters combine: date range, location, supplier, product and a search pill; Supervisor can use All branches, workers stay within assigned locations, Cashiers have no access. Product page shows **Last received** per allowed location; Supplier page has a **Received** tab. Dashboard uses **Arrived this week**, replacing Low stock.
- Preserve original records; corrections determine effective location and voided receipts without double-counting. No on-hand stock total.

## 25. Store cost and manual prices

- Products list: Supervisor-only **Store cost** (last regular unit cost before tax) and **Margin %**. Product page shows cost history with supplier/location/date/invoice and retained four-decimal cost. Floor Worker/Cashier visibility remains unchanged. Short-dated receipts appear in history but never replace regular cost.
- Supervisor may set a selling price above or below the rule with existing below-margin confirmation. A **Manual price** pill follows the effective branch/company price wherever staff see it, including Lookup, Products, invoice selling-price review and Labels selection; Products has a **Manual prices** filter. Show **Rule price $X.XX · Manual price $Y.YY**; margin is Supervisor-only except existing authorized invoice-cost visibility. This flag is price-scope provenance, not a comparison based solely on today's rule.
- **C8 supersedes the earlier receiving-only decision:** every accepted normal receipt with an actual changed cost and a retained manual regular price creates a Supervisor approval, even if the receiver recommends Keep. The receiving choice is a recommendation, not the final price decision. The approval defaults to **Use the new calculated price $X** and also offers **Keep $Y** through the existing **Selling price** dropdown. Explicit Keep applies only at the original receiving store and preserves its approved price and manual provenance. Either Use calculated or Keep requires a reason if the selected price is below the configured minimum margin or below cost; missing-reason copy is **Add a reason.** / **یک دلیل اضافه کنید.** Until approval, the current approved regular price remains; during a sale, customers still pay the sale price. Same-cost and short-dated receipts do not change this manual-price decision. Only an effective approved Use-calculated decision replaces the regular price and removes the applicable manual flag.

## 26. Supplier items and packs

- Replace **Products supplied** with the supplier's **Supplier items** list, populated idempotently from posted invoices; Supervisor can also add/edit product association, supplier item code and pack. Every row: product, optional supplier code, **Case of 12**, last bought price before tax per case/per unit, last bought date and last invoice number. Money and price history remain Supervisor-only in Suppliers. An explicitly enabled Floor Worker may see supplier-item order cost snapshots/expected amounts **only inside Orders**, without supplier cost-history/catalog privileges.
- Keep full purchase-price history including short-dated lots and regular receipts. **Last bought price** is the latest recorded purchase; regular pricing basis separately excludes short-dated expiry discounts. Retain snapshot packs/costs on invoices/orders; editing the current pack never rewrites history.

## 27. Orders

- **Orders** is a new sidebar section, Supervisor-only by default; company setting can explicitly allow Floor Workers. Cashiers have no access. All actions enforce company and allowed location, including Warehouse.
- New order: location defaults to current concrete location/user's own location → confirmed active supplier → full-width supplier item table showing last price and pack (phone item cards, no sideways scroll) → positive cases per item → exact expected total **before tax** → **Save as draft / Place order**. Expected totals are estimates, never supplier ledger entries. Save line snapshots and allocate a stable order reference. Company setting **`orders.allow_floor_worker`** defaults to `false`. A manually created supplier item with no purchase has no bought cost/date/invoice: show blanks, not invented historical metadata. Unless an actual supplier purchase or explicit Supervisor quote supplies a cost, require **Expected unit cost** before Place order; never silently borrow product regular/catalog cost. A quote is separately marked quoted/expected, never last bought.
- Print order produces a clean supplier-facing A4 sheet, English by default with its own document-language setting, for phone orders or Save as PDF, with company/location, supplier, reference/date, names, supplier codes, cases, pack, units and before-tax expected prices/total.
- Statuses: **Draft → Ordered → Partially received → Received**, or **Cancelled**. List filters: status, supplier, location, date and search. Cancellation preserves History; receiving updates quantities from linked posted invoices without duplicates. No stock counts.
- Open **To order** notes can be added to an order in one click. A free-text note without a catalog product requires an explicit existing supplier-item selection or an intentionally created **New item** temporary line; every linked note requires an explicit Cases quantity before placement. Do not invent the item, pack or quantity. Preserve the note and its source link; only successful placing marks it ordered, and only explicitly selected source notes are changed.

## 28. Invoice compared with its order

- Suggest open Orders for the same supplier/location; reviewer confirms the link. Never match an order from another company/location/supplier. Compare normalized units using each order/invoice line's retained pack. Do not silently combine different supplier codes into one line.
- **Delivered as ordered:** OK. **Fewer delivered:** Short using the existing invoice short flow for invoiced-but-missing goods. **Ordered but absent from invoice:** explicit **Short / Back-ordered / Cancelled** decision; order-only missing goods do not create a payable deduction against an amount never invoiced. Back-ordered/Short remains outstanding; Cancelled closes that quantity with History. A billed 3-case invoice against a 4-case order leaves 1 case outstanding for Short/Back-ordered/Cancelled; it does not create a deduction for that uninvoiced case.
- **Delivered but not ordered:** **Keep it (we pay for it)** or **Refused / sent back with the driver**. Refused quantities never enter effective invoice payable, Received, product regular cost or price approvals. Retain original invoice line/document and record the decision and conserved proportional original tax.
- **Unit cost changed:** show old/new before-tax unit and case costs, retain comparison evidence and require a decision. Every difference blocks posting until resolved in the existing blockers style. After posting, update linked order receipt/remaining quantities and create **one Supervisor alert listing all differences**, without duplicate alerts on retries. For a linked invoice, retain regular lower-price answers as evidence inside this consolidated `order_differences` alert; do not add a second same-supplier lower-price alert. Invoices without an order still use existing review/short/lower-price rules and alerts.

## 29. Short-dated expiry discounts and Branch requests

**Short-dated (expiry discount):** offer this choice when incoming cost is lower than the relevant supplier's last bought price. Require an actual expiry date and create Date tracking at posting. Record received quantity and actual discounted invoice payable, but preserve the product's regular cost and selling price, create no price-change approval and no regular lower-cost repricing. Supervisor can optionally create a clearance offer and print Promo labels. Other lower-price explanations keep the existing same-supplier questions and allowed unknown/no-previous-stock answers. Linked-order invoices consolidate their answers into the one order-differences alert; unlinked invoices retain existing lower-price alerts.

**Branch requests:** new sidebar item for Supervisor/Floor Worker, no Cashier access; **Incoming / Outgoing** tabs and an actionable count pill. Requesting location selects a different active same-company Store/Warehouse, then catalog products or free-text items such as bread, quantity in **Units / Cases**, optional note and **Send**. Cases require a retained positive pack for conversion where a product is known; free-text case requests without a pack require positive whole Cases and remain cases without inventing units. Fractional Cases require an explicit positive integer pack and exact positive whole normalized units.

Receiving/sending location opens its incoming checklist, ticks items actually being sent or marks them **Short**, then **Mark as sent**. A bilingual picking list prints. Requesting location ticks actual arrivals or marks **Missing**, then **Mark as received** and **Close request**. States: **Draft → Requested → Sent → Received → Closed**, or **Cancelled** (Draft/Requested only); sent/received physical evidence remains and is reviewed/closed rather than erased through cancellation. Only actors at the responsible endpoint (or Supervisor with explicit endpoint context) may advance that side. Received with missing quantities remains visibly annotated. **Copy short or missing items** starts a new draft without mutating the original or sending twice. Record lifecycle/actual physical transfer movements with company/location/employee/time and History; requests do not change stock or supplier Payables.

## 30. Posted invoice correction and originals (C4)

- Posted view: clean header, lines with product/retained case and unit quantities/unit cost/line total/tracked date, short/extra/short-dated decisions, totals, original and History. Never show disabled draft fields or “Changes save automatically in this browser”.
- Supervisor **Correct invoice** starts with the current effective posted lines and changes quantity, cost, product, pack or date, with a required reason. Preview the exact payable delta (including retained original tax treatment), effective Received changes, affected pending price proposals and active date entries. Recheck source version and protected downstream allocations/shorts/returns/order links before saving; unsupported conflicts block with a reason instead of silently replaying them.
- Append a correction linked to the immutable original and preceding version, actor/time/reason/before/after/impact references. Never change the original lines/header/totals/file or existing payment/credit allocations. Apply only new compensating financial/physical effects at effective location, idempotently. A reduction below already allocated money keeps excess explicitly unapplied/corrective rather than deleting payment evidence. Do not reapply previously approved prices automatically; create/supersede only warranted source-linked pending proposals. Removed/replaced date evidence remains in History.
- Display **Corrected** and permit both original and corrected versions from invoice/History. Correcting a correction appends another version. No Undo; preview followed by confirmation.
- Retain each uploaded original photo/PDF with the invoice and across refresh: image fit/zoom; PDF viewer/pages/Download. Manual no-file state says **No original attached** and **Attach original**, with posting still blocked. Demo originals are fictional matching images with supplier header, bill-to location, case packs, subtotal/tax/total, never placeholder .txt evidence.
- Correct demo packs to realistic supplier cases (cans/jars 12, lavash 10, 4.5 kg rice 4, kitchenware 1–6 where appropriate), entering invoices in cases when suitable while preserving every pre-existing monetary total. Received and Orders show **2 cases (24 units)** when retained packs establish this.

## 31. Weighed items and temporary order lines (C4)

- **Sold by: Each / Weight** drives labels and quantity rules. Each retains existing whole-unit case conversion. Weight invoice quantity is kg/lb with up to three decimals; cost unit explicitly kg/lb; optional case weight retains its own unit. Never multiply a per-kg source cost by lb quantity without exact conversion. Actual invoice totals use source quantity/cost evidence and Decimal; canonical pricing conversion follows pricing-engine.md.
- Normalize weight cost to lb with configured conversion factor **2.20462**; kg cost ÷ factor, half-up to four decimals; then unchanged divisor/bands/special correction. Example $11/kg → $4.9895/lb → raw $7.68 → **$7.49/lb**. Converted display kg price = approved lb price × factor, rounded half-up cents → **$16.51/kg**. Display-unit choice does not reprice the canonical approved lb amount. Each labels Selling price (per unit); Weight uses Selling price (per lb) or configured kg display and optional second-unit text. Existing tax/manual/pending/margin rules remain.
- **New item** intentionally adds an order-only temporary name, optional pack and expected cost, without inventing a product or purchase history. Retain a New item pill on order and print. A placement can retain unknown expected-cost information explicitly rather than borrowing catalog cost; the expected total identifies incomplete estimates. Cases/quantity remains required. Invoice review requires an explicit unique link between temporary order line and actual invoice line/product; normal product proposal permissions apply. Only posting the resolved invoice adds the supplier-item association and receipt; draft previews create no purchase history. Reject cross-company/supplier/location links and repeated consumption of a temporary line.

## 32. C3/C4 acceptance evidence

Change only prototype/, docs/ and seed/ demo/config/pricing fixtures. C3 and C4 are stacked, no review pause between them. Keep Lookup, requests, exact label printing, invoice posting and existing Decimal cases working.

Automated proof covers all existing and new pricing cases (kg and lb examples), product tracking initialization/add/remove/stop, full return/pending-credit/smaller-credit lifecycle, append-only invoice correction with preserved allocations, temporary order-to-invoice association, field errors clearing, unique sidebar icons, scoped conflict-aware Undo, and **every visible table/panel at 1280/1440/1920 with no sideways scroll or text clipping**. Include English/Persian logical alignment and phone Orders cards.

Screenshots in English light, English dark, Persian and phone: Suppliers/Products buttons, Columns chooser, Labels selection bar, Offers/Notes dialogs, dashboard queue/approval dialog, posted original/correction preview, named invoice/order comparison, New item order, weighed Lookup/label, Add date/Remove, Returns Open/History/memo/Payables pending credit and Undo. Open every final screenshot and compare against all 14 owner annotated images; report executed results separately from remaining physical-printer checks. Final review includes branch names, exact Ubuntu commands and click-by-click steps.

## 33. C6 functional contracts and C7 retouch (2026-10-11)

**Company product, location prices and lots.** A delivery-created product belongs to the company and appears in Lookup/Products at every allowed location with **First added at North York** provenance; dates stay at their entered location. One company-wide barcode maps to one catalog product. Lots are keyed by company, product, supplier, location and actual expiry date; same key merges identity, not immutable invoice evidence. Retain supplier, date, source quantity received and exact cost history. No stock balance/estimate is introduced. Different regular branch prices retain cross-branch alerts. A short-dated lot may have one current clearance offer for that product/location, linked to its lot and expiry, separate from ordinary offers. Current-location Lookup shows its approved regular price and eligible clearance/expiry, never another store's prices/lots. Promo labels print the actual lot clearance. Do not infer sales depletion or change a regular price because a date is entered.

**Pickup and partial item outcomes.** Record actual quantity per item. If below return quantity, require a reason and disposition: **Keep for next pickup · Put back on the shelf · Throw away**. Keep permits a new later signed pickup event; it never edits the earlier event. Once recorded, pickup quantities/representative/evidence are locked. Only authorized **Correct pickup** with reason can append a correction; Owner/Manager only: current Supervisor represents them until E1; no worker or cashier receives the permission. Coverage of credits/replacements/write-offs cannot exceed actual cumulative pickup. Each item shows settled and outstanding quantities. Partial resolution supports credit note/amount, actual replacement quantity/covered original units, or still outstanding with expected date/note. Return stays **Waiting for credit** until every picked-up claim is credited/replaced/written off and any kept next-pickup remainder is dealt with. Financial authorization stays Supervisor-only. Multiple credits use distinct notes and non-overlapping coverage; actual money may differ from the expected before-tax estimate and follows existing tax/allocation/unapplied-credit rules. Preserve immutable pickup/resolution/physical/ledger evidence and release provisional expected credit only for settled coverage.

**Supplier documents.** `supplier_documents.return_memo` and `.supplier_order` independently select `en` (default) or `bilingual`; internal picking lists remain bilingual. Return memo uses store/address/RM number/date, supplier details, product/code/quantity/unit cost/expected credit, total, and driver/store-staff signature lines with name/date. No internal ID or accidental Persian in default supplier output.

**Other screens.** Received has one From/To date range with Today/This week/This month in store time. Supplier summary Last delivery opens that invoice; Deliveries this month opens scoped supplier/current-month Invoices; Open returns opens scoped open Returns. Static Balance has no hover, glow or pointer. Payables supplier-ledger Columns sits in the card title. Below 1280 collapse sidebar and shorten breadcrumb/current page/search icon; table priorities/cards follow design-language across all required widths.

**Missing-field validation.** Every incomplete Save/Post/Send action stays clickable and opens a concise **What's missing** list at form top, with scroll/focus/highlight links and matching inline field errors. Correcting a field clears only its own issue. Draft save checks draft requirements, not posting-only original/line gates. Permissions/stale-record failures remain separate concise transaction errors.

**Browser files.** Store files in IndexedDB, separately from JSON business state, using company-scoped `idb-file:v1:<company>:<hash>` references. Preserve exact original invoice PDF/image bytes; photo display derivatives shrink to longest side ≤2000 px before normal photo persistence. Logo/photo/original references never embed base64 in the main state. Legacy inline files migrate only after durable write/read-back/hash verification and verified backup; do not remove old bytes or references on failure. Type/size/permission errors are actionable and recover after a successful retry. Test twenty 3MB photos across reload with no main-state quota failure. Local browser evidence is not production storage or a backup service.

**Scope and proof.** C5 merges with history only after all CI passes (completed merge 2dbb64aab13cdbb6ecfe5a540c590ebb32c503ce). C6 starts from main and implements items1–23; C7 stacks on C6 and applies items24–41 across every screen. Build both without a review pause, merge neither automatically. Change only prototype/docs/seed; no backend, real AI, paid deployment or inventory. Source docs update first. Items42/43 require all existing tests, new workflow/storage/contrast/token/layout checks and individually reviewed five-variant screenshots of all17 listed scenes. Complete mapping is in build-plan.

**C6 exact implementation defaults:** Selecting payment terms deliberately recomputes due date and resumes automatic mode. A manual due-date edit survives ordinary edits; changing invoice date recomputes only in automatic mode. Custom days allow nonnegative whole values producing a valid due date. Subtotal/Tax/line edits keep a deliberately different entered Final total, with warning. Parse ambiguous daylight-saving local time using the earlier occurrence unless editing the same stored wall time can preserve its prior offset; nonexistent local time shows a precise field error and blocks saving. Product form's EN/pricing-category requirement and FA/category optional change does not waive existing real supplier/cost/unit/price validation where pricing needs it; never invent zero cost/price.

Every **new** pickup/resolution/credit/replacement write requires actual retained signed pickup evidence and quantity coverage; legacy imported settled records remain readable without invented pickup events or new-write bypass. Browser files use database `supermarket-prototype-files-v1`, stores `files` and `backups`; verified old state/backups migrate to immutable Blob backups before localStorage rewrite. Reset demo does not delete file evidence/history. Exact original invoice PDFs **and original invoice photos** remain downloadable; reduced image derivatives are separate.

**C6 working Settings:** Returns/date tracking/labels exposes **Default date reminder (days)**, audited Supervisor/company-scoped nonnegative whole value, updating the existing expiry default(30). Product reminder overrides remain independent. Author note-edit permission remains its existing10second window, separate from the new8second Undo display.

## 34. C8: fixes, sales and new regular prices (2026-10-12)

This section is the current C8 contract. It supersedes earlier conflicting rules about direct price entry in Edit product, two-decimal-only cost display, fractional-case display, filter placement and the two pending owner choices. The detailed numbered requirements below reproduce the owner's new request; examples use fictional demo records.

C6 and C7 were approved and merged in that order, preserving history, after required CI passed. C8 starts from main `3b6da31`. Build four stacked pull requests in order: C8, E1, E2, E3, without an intermediate review pause. The owner reviews all four together; the deadline is October 30. Update source docs before implementing each stage. Change only prototype/, docs/ and seed/. This remains a browser prototype, with no new backend, hosted database, real AI, stock system, remote accounts/resources or deployment.

### Resolved owner choices

- Correcting a signed pickup is Owner/Manager only. Until E1 exists, today's Supervisor represents them for this permission. Nobody else gains it. Keep required reasons, settled-quantity checks, impact review and append-only evidence.
- Dark filled Primary buttons and solid blue summary cards use **#2B59C3 with white text**. **#7397F0** is reserved for links, icons, selected tabs and focus rings on dark surfaces. Keep the accessible green adjustment and all actual 4.5:1 text checks.

### Five annotated layout fixes

1. Edit product → Date tracking (1.png).
   - Each date row is one line, vertically centred: a status dot (red when past, amber inside the reminder window, green otherwise), "Expiry 2026-11-06", "25 days left" (one space, not two), and the ×.
   - In the add-date row, the Type, Date, Quantity and Lot labels sit on one line. Add is the same 44 px height as the fields and lines up with them.
   - In the whole dialog, dropdowns fill their column like text fields do (Pricing category, Sold by, Category, Supplier). Only short number fields, like "Remind me 30 days", stay compact.
   - Separate the sections (Names, Pricing, Details, Date tracking) with a hairline above each section title.
2. Saving with date tracking on and no date (2.png).
   - If Date tracking is Yes and the product has no open date at any location, Save product doesn't save. It shows the What's missing box with "Add an expiry date, or turn off date tracking", links to the date field and focuses it.
   - If someone picked a date but didn't press Add, Save product adds that date itself instead of dropping it.
3. Labels → Products (3.png). The rows run out of the white card, and the sidebar stops partway down the page.
   - Cause: c3-labels-notes-offers.css gives .labels-product-table max-block-size: 560px (480px on phones) with overflow-y: auto, but :root .ui-data-table { overflow: visible } in c6-shared.css and c3-components.css wins. The rows spill out of the card, the app shell ends where the card ends, and the sticky sidebar scrolls away with it.
   - Remove the height cap. The list grows with the page, its header stays sticky under the top bar, and the existing selection bar stays sticky at the bottom.
   - Make the sidebar fill the full window height and stay in place however long the page is (app shell at least 100dvh; sidebar sticky with its own full-height background).
   - Columns: checkbox (48 px) | Product (takes the free space) | Product Code | Offer | Selling price, right-aligned at the card's right edge. No gap after the checkbox and no empty space after the last column.
   - Add a layout test: on every page at 390, 900 and 1440 px, no table row extends past its card.
4. New order items (4.png).
   - Fixed columns, each header over its own content, numbers right-aligned under right-aligned headers: Product | Pack | Cases (input) | Units ("= 48 units", worked out) | Expected unit cost (input, with "Last bought $18.40" under it) | Case cost | Before-tax total.
   - "Expected total before tax" sits right-aligned under the Before-tax total column, above the buttons.
   - The inputs use the filled style, not outlined.
   - Money everywhere: show at least 2 and at most 4 decimals, dropping zeros after the second. 18.4000 shows as 18.40; 1.5525 stays 1.5525. Keep storing 4 decimals. Check invoice lines, supplier items and orders too.
5. Product page (5.png). It's one long card: sections run together, there's an orphan "lb Approved" line, "Last received No deliveries yet" has no separator, and "Store cost: $4.99 /lb" floats on its own. Rebuild it:
   - Header: the name and Persian name, then chips for Product Code, size (or "Sold by weight"), tax and status. On the right: Change price (Part 3), Edit and ⋯.
   - A row of three cards, stacked when narrow:
     - Price at [location]: big price, scope, any offer or sale, "Calculated from invoice FV-20417", and Last received with its date and invoice.
     - Cost and margin (Supervisor only): store cost, margin, pricing category with its divisor, and the minimum margin.
     - Dates at [location]: open dates with their dots, and an Add date button.
   - Then full-width cards, each with its own title: Details (two columns with a hairline between rows: barcode, AI category, pricing category, tax, supplier, sold by, unit size, first added at), Prices by store, Deliveries, Lots, Cost history and History.
   - An empty section shows one short muted line inside its card.
   - Drop the sentence "Received quantities are invoice evidence, not stock on hand" from the page. It can be a hint on the Lots title.

### Additional reviewed fixes

6. The product page doesn't update when you go from one product to another. Open #product?code=0016, then change the address to #product?code=0006, or press Back: the breadcrumb changes, but the page still shows Bulk Almonds. ProductPage reads window.location.hash only once. Re-render on hashchange (Back and Forward too) and test it.
7. Received shows fractions of cases: "3.3333 cases (40 units)", "2.6667 cases (16 units)", "7.5 cases (30 units)". Show whole cases plus loose units, like "3 cases + 4 units", everywhere cases are shown.
8. Dashboard → Purchases by supplier: Fresh Valley Foods' bar ($181.22) is so pale it looks empty. Every bar uses the accent blue, or at least 3:1 contrast against its track.
9. A fresh demo shows a half-started invoice on Invoices → Drafts: fictional-fv-20417.svg is attached, with no lines and no way to continue, above "No drafts". Either list it as a draft row ("Not read yet · Continue") or start the demo without it. Its file name also shows twice.
10. One row, one chevron. Received, Suppliers, Payables, Returns, Date tracking and the dashboard's Recent invoices put a › or a ˅ (Received and Suppliers both) in the middle of the row, right after the name or number.

- Every row opens its record when clicked, with a single › at the row's end.
- Show the ˅ (hidden columns) only when columns are actually hidden, also at the row's end.
- Give the name column enough room (at least 240 px at 1440 px), so names like "Canned Fava Beans 400 g" don't wrap onto three lines.

11. Products:

- On rows without a ⋯ menu (Dried Barberries), Edit jumps right. Keep the ⋯ slot so Edit always lines up.
- Write per-unit prices the same way everywhere: "$4.99/lb", not "$4.99 /lb".
- Show 25 products per page, not 8.

12. Orders and History use two unlabelled "Choose date" fields. Use the same single Date range control as Received (From, To, and Today / This week / This month).
13. History: the Item column says "Product Code 0004" and Before → after says "Recorded action". Show the product name and the real values, for example "Black Tea 450 g · $6.99 → $6.49".
14. Alerts: the cards are about half the page wide, with empty space on the right. Make them full width like other pages, and show date-tracking alerts as compact list rows instead of one large card each.
15. Offers:

- A red Stop offer button on every row is loud. Put Stop offer in the row's ⋯ menu and let the row open the offer.
- Remove the empty gap inside the Offer cell, between the price and "Mix-and-match".
- When there are no suggestions, show one short line instead of a large empty card.

16. Dashboard:

- The Returns card title is bigger than the other card titles. Match them, and move "View all returns" to the right side of the title row, like other cards.
- Date-tracking alert chips are red. Use amber, and red only when a date has passed.

17. Date tracking → Add date: Add is 40 px tall and sits higher than the 44 px fields. At 900 px, Location wraps and Add floats far to the right. Keep Product, Date, Location and Add together as one row that wraps as a group. The note under the list touches the card; give it some space.
18. At 900–1100 px, where the sidebar shows icons only, the group headers appear as bare › and ˅ arrows. Hide them in icon mode and separate the groups with a short divider.
19. Filter bars sit inside the list's card on Received, Returns, Suppliers, Orders and Labels, but on the grey page on Products, Offers, Payables and Date tracking. So the same controls look different (white with a border on some pages, filled on others). Put every filter bar inside its list card, at the top, so they all use the filled style.
20. Lookup:

- The selected result is wider than the other rows and has a blue bar at its start. Keep the same inset as the other rows and show selection with the tint only.
- "Taxable" uses the same blue as offers. Make it a neutral grey chip so offers stand out.

21. Settings → Company: show a colour swatch next to each brand colour. Show the current logo with a Replace button instead of an empty dropzone.
22. Seed data: Dried Barberries' Persian name uses Western digits ("زرشک خشک 100 گرمی"), while the other products use Persian digits. Make it consistent.

### C8 price reductions

Our offers come from the price-to-offer mapping ($1.99, $2.99, $3.99), so a $20.99 item can't go on offer at all. I want to lower any price, for a while or for good, with settings that are very easy to use.
Two words, used the same way everywhere:

- A "sale" is a temporary lower price. The regular price comes back by itself.
- A "new regular price" is a permanent change. It is today's manual price.

1. One "Change price" dialog for the Supervisor (Floor Workers get a request version of it, item 9), opened from:
   - the product page header
   - the Lookup product card, and Products' ⋯ menu
   - Offers → Create offer → "Sale price"
   - Edit product, where Selling price becomes the current price shown with a "Change price" link. Nobody types a new price straight into Edit product any more.
2. The dialog, top to bottom (example: Stainless Steel Pot 24 cm at $20.99):
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
3. Checks, in plain words, using the What's missing pattern:
   - A sale price must be lower than the regular price. If it isn't: "A sale price must be lower than $20.99. To raise the price, choose New regular price."
   - Below the pricing category's minimum margin: an amber note and a "Use this price anyway" checkbox.
   - Below cost: a red note and a required reason.
   - A product can have one sale per store at a time, and scheduled sales can't overlap. If a sale already exists, the dialog opens that sale to change it.
4. While a sale runs at a store:
   - That store charges the sale price. Lookup, for every role, shows the sale price large, a "Sale" pill, "Regular $20.99" crossed out, and "Until Oct 31" (or "No end date").
   - Products shows the sale price with the pill and the regular price under it. Add an "On sale" filter.
   - Offers lists sales under Current offers with the type "Sale price". Add an offer type filter: Multi-buy, Sale price, Clearance. Ended sales move to Past offers.
   - Labels: the "On offer" filter includes sales. Promo labels show the sale price large and "Regular $20.99" smaller, using the existing Promo template.
   - A multi-buy offer on that product pauses at that store ("Paused during sale") and comes back afterwards. Sale items don't join mix-and-match pools, even when the sale price matches a mapping.
   - A lot's clearance price stays separate, as in C6. Lookup shows both.
   - Weighed items: the sale price is per main unit, and the second unit is worked out as today.
5. Changing and ending a sale:
   - On the product page, in Offers and in Lookup (Supervisor only): "Change sale" (price, last day, stores) and "End sale now", with a confirmation.
   - After the last day, at the start of the next day in the store's time zone, the price goes back to the regular price by itself. If a new regular price was approved during the sale, that one applies.
   - A sale with no end date: remind the Supervisor every 14 days (a setting): "Stainless Steel Pot has been on sale at North York for 14 days." with Keep it and End sale.
   - Every start, change and end goes to History with its before and after values, and can be reverted from History.
6. New regular price (permanent). This is today's manual price, set through the same dialog. It stays until a regular invoice brings a different cost. Then the approval offers "Use the new calculated price $X" (selected by default) or "Keep $Y". An invoice at the same cost changes nothing.
7. When an invoice changes the cost during a sale (a receipt at that store):
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
8. Settings → Offers gets a short "Sales" section:
   - default sale length (2 weeks)
   - remind me about sales with no end date every [14] days
   - add Promo labels when a sale starts (on)
   - add regular labels when a sale ends (on)
9. Who:
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
10. Demo data and docs:

- Add one running sale (Stainless Steel Pot 24 cm, $16.99 at North York, ending 10 days after today), and a fictional invoice in the demo originals that raises its cost to $14.20, so I can see the alert by posting it.
- Add one pending sale request from the Demo Floor Worker (Sunflower Oil 1.8 L, $7.99 at North York for 2 weeks, "Why?": "slow seller"), so the pending display and the Approvals card are visible right away.
- Put both click paths in the review doc.
- Docs: a new section in requirements, plus data-model, workflows, screens, decisions and open-questions. In open-questions, record two later options: putting several products on sale at once, and "until sold out" (needs stock counts, so Phase 2).
  C8 PROOF
- Tests for:
  - the product page following the address, and Back
  - no table row past its card, on every page at 390, 900 and 1440 px
  - the date-tracking save rule, including a picked date that wasn't added
  - the money display rule, and whole cases plus units
  - sales: starting, scheduled start, automatic end restoring the current regular price, ending early, one sale per store, the lower-price rule, the below-margin and below-cost checks, multi-buy pausing and resuming, and the reminder for sales with no end date
  - Floor Worker sale requests: the pending display everywhere, Approve, Change and approve, Reject, withdrawing, and expiry
  - new regular price, and "Use the new calculated price" as the default
  - both invoice alerts, and the hold note with its reminder
  - Promo labels for a sale, and reverting a sale from History All existing tests must still pass.
- Screenshots in English light, English dark, Persian, 900 px and phone:
  - my five screens after the fixes
  - the Change price dialog, with Sale and with New regular price
  - the Floor Worker's "Request a sale" dialog, the requested sale on Products and Lookup, and its Approvals card
  - Lookup with a sale, and Offers with a sale and the type filter
  - the "Cost went up during a sale" alert
  - a Promo label preview for a sale

### Implementation boundaries agreed before code

- **Open date** means an active, unremoved date, including a past date shown in red. Any same-company location qualifies for the product-save rule; do not silently require a future date or disclose another location's private details. Save product validates and includes a picked-but-unadded date atomically; failure and Cancel write neither product nor dates.
- Existing **Edit product** shows its current price and a Change price link. **Add product** keeps its initial calculated/manual price entry and minimum-margin checks; no sale is created for an unsaved product.
- A sale stores the exact entered two-decimal amount and its main unit (each/kg/lb). Compare price/cost in a common unit using full Decimal precision; convert the secondary display as today. Do not round a requested kg sale through canonical lb cents and change the entered price. Regular approved weight prices retain the existing canonical basis.
- All stores means the concrete eligible stores reviewed in the transaction. Exclude Warehouse, inactive and non-selling locations. Check the lower-price and margin/cost rules against every affected store's actual regular price and cost. An existing sale is changed through its guarded record/revision; an employee request never changes it directly or creates an overlapping duplicate.
- Validate the lower-price rule when saving a new or changed sale. A later regular-price/cost change does not silently stop an existing sale: the owner's explicit Keep the sale choice remains available on the alert.
- Regular receipt cost uses actual posted, accepted, non-short-dated evidence at that store. Capture the previous cost before posting changes the projection. The existing regular-cost fallback is used only where no such receipt evidence exists; never invent a cost. Clearance eligibility uses the regular price, independently of the sale charge.
- A changed-cost manual regular-price approval is required regardless of the receiver's Keep/Use recommendation. Default **Use the new calculated price $X**; explicit **Keep $Y** retains the original store's approved price and manual provenance. Both choices require a reason when the selected price is below minimum or below cost; show **Add a reason.** / **یک دلیل اضافه کنید.** if missing. Use the shared exact note **“This price is below the minimum margin.”** / **“این قیمت کمتر از حداقل حاشیهٔ سود است.”** Same-cost and short-dated receipts remain unchanged.
- A sale alert says **waiting in Approvals** only when its actual linked regular-price approval is still pending. Otherwise show the current approved regular price with **Current regular price** / **قیمت عادی فعلی**; retain the original alert snapshots and decision evidence.
- Evaluate starts, inclusive last days, automatic ending, request expiry and reminders with a supplied UTC clock and the configured store time zone (company zone fallback). Use local calendar boundaries, not UTC date slices or fixed 24-hour offsets. Repeated checks/posting are idempotent.
- History Revert uses existing scope/version/conflict guards and the current clock. It never restores a stale regular price or reactivates an elapsed sale. Corrective labels may be newly queued; a physical print cannot be undone.
- Automatic label entries need an actual Regular/Promo template preference, source and reason. Preserve explicit user template choice and exact physical geometry. A new regular price saved during a running sale must not silently replace the currently required Promo label; defer its automatic Regular-label addition until the actual sale ends and preserve the current Promo intent. Use the exact summary: **“Regular labels are added when the sale ends. The current Promo label stays.”** / **“برچسب‌های عادی پس از پایان حراج اضافه می‌شوند. برچسب حراج فعلی باقی می‌ماند.”**
- In request mode, Why? remains optional and costs/margins remain private. Validate public price/date/scope rules on submission; enforce minimum-margin acknowledgement and below-cost reason at the approver's decision, without making the worker's optional Why? secretly required.
- Display **every currency amount** with at least two and at most four decimals, dropping only trailing zeros after the second. Keep unit costs at four decimals in storage. This includes cost text on invoices, supplier items, orders and printed documents; mapped offer values remain unchanged while displayed currency follows the same formatter (for example, 2 for $5.00).
- Whole-cases-plus-loose-units is a display decomposition of exact retained units/pack. Fractional Cases entry remains permitted under the existing exact-conversion rule. Do not rewrite quantity evidence or treat Weight quantities as Each units.

## 35. E1, E2 and E3: authorized next stages, not built in C8

The following work is authorized after C8. Its status is **Planned** until that stage's implementation and actual evidence exist. The detailed request is retained below so later sessions cannot omit a rule.

### Planned E1 permission table

Role labels come from configuration. Each person has one role; Owner/Manager cover all company locations, including future locations. Other roles have explicit assignments. Cashier never has Warehouse access. Different roles at different locations is a later option.

| Capability                                                          | Owner and Manager                                 | Branch Supervisor                            | Floor Worker                                              | Cashier                              |
| ------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| Location access                                                     | Every company location, including later additions | Assigned locations                           | Assigned locations                                        | Assigned stores, never Warehouse     |
| Lookup, sales and pending display                                   | Yes                                               | Yes                                          | Existing access                                           | Existing access                      |
| Create, review and post invoices                                    | Yes                                               | Own locations                                | Existing handled-invoice rules                            | No                                   |
| Costs on invoices, supplier items and orders                        | Yes                                               | Own locations                                | Existing invoice/explicit Orders opt-in only              | No                                   |
| Product/catalog margins and supplier financial balances             | Yes                                               | No                                           | No                                                        | No                                   |
| Received, labels, dates, notes, requests and returns through pickup | Yes                                               | Own locations                                | Existing scoped operations                                | Existing custom notebook grants only |
| Orders                                                              | Yes                                               | Own locations                                | Existing setting, off by default                          | No                                   |
| Approve prices, products and sale requests                          | Yes                                               | No; view own pending and propose             | No                                                        | No                                   |
| Start/change/end sales and new regular prices                       | Yes                                               | Request only                                 | Request only                                              | No                                   |
| Hold a delivery on a sale-cost alert                                | Yes                                               | Own locations                                | Existing note access only; no price decision              | No                                   |
| Payables, financial credits and supplier confirmation               | Yes                                               | No                                           | No                                                        | No                                   |
| Correct signed pickup                                               | Yes                                               | No                                           | No                                                        | No                                   |
| Settings, People and devices                                        | Yes                                               | No                                           | No                                                        | No                                   |
| Price update register confirmation / completion (E2)                | Every store                                       | Own stores                                   | Label confirmation; completion only if explicitly enabled | Read-only Lookup pill                |
| Dashboard                                                           | Current Supervisor dashboard                      | Own operational dashboard, no supplier money | Existing worker home                                      | Lookup                               |

Enforce capabilities and field projections in one permission layer; every transaction still checks company and allowed location. Future server APIs must reuse these rules rather than trust hidden buttons.

### Detailed E1/E2/E3 contract (planned)

Start E1 from C8's branch.
The managers at Super Arzon asked for three things: roles set per branch, price-change tasks for each branch, and using the app on their phones.
This is still the browser prototype, and everything is stored in one browser. The demo shows flows between people by switching users from the Demo menu. Design the roles, permissions and tasks so the real server build can reuse them unchanged.
E1: ROLES PER LOCATION, PEOPLE AND SIGN-IN

1. Five roles (their labels come from config, not code):
   - Owner and Manager: exactly the same access, company-wide, at every location, including locations added later. Together they replace today's Supervisor.
   - Branch Supervisor: runs one or more locations.
   - Floor Worker: one or more locations.
   - Cashier: one or more stores, never the Warehouse. Each person has one role and, except for Owner and Manager, one or more locations. For example: a cashier at North York and Richmond Hill, or a Branch Supervisor at all three stores. Record "different roles at different locations" in open-questions as a later option.
2. Permissions. Put this table in requirements.md. Enforce it in one place (the permission layer) instead of the many "supervisor" checks in the code today, and test it.
   - Owner and Manager: everything today's Supervisor can do. That includes approving prices, new products and sale requests, starting, changing and ending sales and new regular prices (C8), Payables and supplier money, confirming suppliers, correcting a signed pickup, closing returns with a credit, Settings, People and devices, and every location's price updates and History.
   - Branch Supervisor, at their own locations only:
     - Can: enter, review and post invoices (including seeing costs on invoices, supplier items and orders), Received, returns (up to recording the pickup), labels, date tracking, notes, branch requests, orders and price updates (E2). They can propose price changes and request a sale; a request goes to Approvals for the Owner or a Manager. On a "Cost went up during a sale" alert, they can tick "Keep this delivery in the back". They can view pending approvals for their locations, without approving them.
     - Can't: approve prices or new products, start, change or end a sale or a new regular price themselves, open Payables or supplier balances, correct a signed pickup, close a return with a credit, change Settings, or manage people.
   - Floor Worker: what Floor Workers can do today, at their locations, including requesting a sale (C8).
   - Cashier: what Cashiers can do today, at their stores.
   - Dashboards:
     - Owner and Manager get today's Supervisor dashboard.
     - A Branch Supervisor gets a location dashboard without supplier money: arrivals, price updates to apply, sales running at their stores, expiring dates, open returns, branch requests, and notes for them. Add tests for every role at an allowed location and at a location they don't have.
3. Location picker:
   - It shows only the person's own locations, plus "All my locations" for people with more than one.
   - Owner and Manager also get "All locations".
   - A registered store computer defaults to its own location.
4. Settings → People (Owner and Manager only).
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
5. Demo users. Replace the three demo accounts with these, all with password demo1234 and fictional names:
   - owner (Owner)
   - manager (Manager)
   - rh-supervisor (Branch Supervisor at Richmond Hill and Newmarket)
   - ny-floor (Floor Worker at North York)
   - wh-floor (Floor Worker at the Warehouse)
   - cashier (Cashier at North York and Richmond Hill) The Demo menu can switch to any of them, and Reset demo restores them. The old username "supervisor" keeps working and signs in as the Manager.
     E2: PRICE UPDATES (TASKS FOR EACH STORE)
6. When a product's selling price changes at a store, that store gets a price update task. This applies whatever caused the change: a price approval, "Apply this price to all" on a branch price conflict, a new regular price, a sale starting, changing or ending (C8), another offer starting or ending, or a weighed item's price.
   - The price in the app changes right away. But staff still have to change it on the store's own cash register and put up a new shelf label, so the task stays Pending until someone confirms both.
   - Only stores whose price actually changes get a task. The Warehouse never gets one.
   - Sales: a sale's start task appears on the morning of its first day. Its end task appears on the morning of its last day, titled "Sale ends after today: back to $20.99 tomorrow", so staff can change the register and labels at closing.
7. Each task shows:
   - the product (both names, code, barcode) and old → new price, including any offer or sale
   - when it takes effect, why it changed, and who decided
   - two checkboxes: "Changed on the cash register" and "New label printed", with "Print label now" and "Add to label waitlist" buttons that pick the Regular or Promo template automatically "Mark as done" needs both boxes ticked. The alternative is "No label needed" with a reason (for example, the product has no shelf label).
8. Who sees what:
   - The Branch Supervisors of that store get a notification and own the task. They (or an Owner or Manager) can tick "Changed on the cash register" and mark the task done.
   - Floor Workers at that store see the list and can tick "New label printed". A setting can let them mark tasks done too (off by default).
   - Cashiers at that store see a "Price changed" pill on the product in Lookup, with the old price crossed out, until the task is done. For a sale, they see C8's Sale pill instead.
   - Owner and Manager see every store: for each change, which stores are done (by whom, when) and which are still pending.
9. Where it appears:
   - A new sidebar item, "Price updates", with a count badge.
   - A dashboard card, "Price updates to apply".
   - The notification bell. The Price updates page has filters for Pending or Done, location and date. You can select several tasks and then "Print labels" (adds them all to the label waitlist) or "Mark as done".
10. Changes on top of changes:

- If the price changes again before the task is done, update that same task to the newest price (keeping the earlier step in its history) instead of adding a second task.
- If the change is undone before anyone has acted on it, cancel the task.

11. Reminders:

- If a task is still pending after 24 hours (a setting), remind that store's Branch Supervisors.
- After 48 hours (a setting), alert the Owner and Manager, for example "Richmond Hill has 3 price updates waiting".

12. Notifications in general:

- The bell lists each person's notifications, newest first, with an unread count, "Mark all as read", and a link to the item.
- Settings → Notifications decides which roles get which events: price updates, approvals waiting, branch requests, returns waiting for credit, expiring dates, sale requests and their decisions, and costs that went up during a sale.
- Plan this in the docs, but don't build it yet: in the real build, notifications also arrive on phones as push notifications once the app is installed on the home screen (Android, and iPhone with iOS 16.4 or newer), with email as an option.
  E3: PHONES

13. Phones. C6 already made every screen work from 390 px up.

- Check the new screens (People, Add/Edit person, Price updates, a price update task, the location dashboard, the bell, the Change price dialog and the sale alert) at 390 px and 430 px, in English and Persian, using the same layout checks as C6.
- Phone lists: Products, Labels, Received, Suppliers, Payables and the dashboard's Recent invoices and Returns currently turn each row into a card of label/value pairs ("Product", "Product Code", "Details", a lone chevron under "Action"). On phones, use list rows like Lookup's: the name and Persian name on the left, the key value (price, amount or status) on the right, a chevron at the end, and secondary facts in one muted line. Tapping a row opens it. The Labels list keeps its checkbox at the start of each row.

14. Installable app: add a web app manifest, icons (the Super Arzon logo), the name "Super Arzon", light and dark theme colours, and standalone display. "Add to Home Screen" should open the app full screen with its own icon, like a normal app. Show a simple "No connection" page when offline.
15. Testing on phones: don't create any accounts or resources; write the steps for me in docs/phone-demo-hosting.md:

- Same Wi-Fi: how to open the prototype on a phone using my computer's address, what to check if it doesn't load (firewall, virtual machine network mode), and why the camera barcode scanner and Add to Home Screen don't work this way (they need HTTPS).
- Private link: step by step, putting the built prototype on Cloudflare Pages (free) behind Cloudflare Access (free for under 50 users), so only people whose email I add can open it, over HTTPS. Include how to update it after each merge to main, and how to turn it off.
- Explain clearly that each phone keeps its own separate demo data, so changes on one phone don't reach another until the real server build.
  E PROOF 16. Tests for:
- the permission table: every role at an allowed location and at one they don't have
- the People rules: the last Owner, no changing your own role, deactivation signing someone out
- a price change creating one task per affected store (none for the Warehouse)
- a sale creating its start and end tasks on the right mornings
- a newer price replacing a pending task, and Undo cancelling it
- the rules for marking a task done
- reminder timing
- the Cashier's "Price changed" pill
- the manifest being valid All existing tests must still pass.

17. Screenshots in English light, English dark, Persian and phone width:

- the People list, Add person with locations, and Edit person
- the Branch Supervisor's location picker and location dashboard
- the Price updates list (as a Branch Supervisor) and a task with its checkboxes
- the Manager's per-store progress view
- the Cashier's "Price changed" pill in Lookup
- the dashboard card and the bell
- Products and Received as phone list rows
- the app opened from the home screen (phone)

18. A click-by-click demo script for the review doc, using the Black Tea price conflict:

- As manager, open Alerts and choose "Apply this price to all" with North York's price.
- Switch to rh-supervisor: Richmond Hill's task appears with a notification. Print the label, tick both boxes, mark done.
- Switch to cashier at Richmond Hill: the pill shows until the task is done.
- Switch back to manager: the progress view shows Richmond Hill done (by whom, when) and any other store still pending. Add a second script for sales:
- As ny-floor, request a sale on Sunflower Oil at North York; show the pending pill on Products and Lookup.
- As manager, approve it in Approvals; ny-floor gets a notification and North York gets its start task.
- As manager, put Stainless Steel Pot on sale at all stores until next week; switch to rh-supervisor and complete Richmond Hill's start task.
- Post the fictional cost-increase invoice at North York and show the "Cost went up during a sale" alert.

All implementation, test and screenshot entries in [C8/E acceptance](C8_E_ACCEPTANCE.md) start Planned. These specifications are not a claim that E roles, tasks, phone installation or hosted collaboration already work.
