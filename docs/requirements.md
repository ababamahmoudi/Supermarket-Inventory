# Requirements (current owner workflow, C — 2026-10-09)

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
- The Supervisor can **add branches**, edit branch details (name, address, phone, opening hours, tax region) and deactivate a branch in Settings → Branches. A deactivated location keeps its history. Locations have type **Store** or **Warehouse**. Warehouse has no Cashier access; receiving, orders, returns, notes, Received and Branch requests still work. Demo store names are **North York**, **Richmond Hill**, **Newmarket**, plus **Warehouse**, loaded from configuration. Settings → Branches can add, rename and change location type. Retain original stable Branch 1/2/3 storage IDs while replacing only the unedited demo EN/FA display names from configuration; Warehouse has its own distinct ID. Preserve saved custom names/data during additive migration.

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

- Every product has: **Product Code**, name (English), name (Persian), description (English/Persian, optional), unit size (e.g., "400 g"), pricing category, tax profile, AI category (see §14), barcode(s) (optional, multiple allowed), status.
- **Product codes are permanent.** Never reused. Archived products can be reactivated. Codes are strings, zero-padded to at least four digits (`0001`…`9999`), then continue as five digits (`10000`…). **(assumed: start at 0001)**
- Statuses: `pending_approval` (new product), `active`, `archived`.
- **Supervisor Add product (B):** the shared product editor also has a new mode for names EN/FA, unit size, category, pricing category, barcode, supplier, date tracking, last unit cost before tax and selling price, with no opening-count fields. The engine calculates selling price from the entered four-decimal unit cost and pricing category. A changed selling price records the Supervisor's manual-override decision; a price below the configured minimum margin requires explicit confirmation before saving. Unlike a receiving proposal, the Supervisor-added product is **Active immediately**, with no separate pending approval. Record its creation and price provenance in History; never claim a manual cost came from an invoice.
- **Next Product Code:** allocate the next company-wide code without reusing any previously assigned code, including archived or reverted records. Keep the existing zero padding and five-digit continuation. Block conflicting barcodes exactly as in the editor and warn when a name is close to an existing product, with a link to that product. A name warning does not replace the barcode block.
- **C scope change:** new products create no opening-count movement. Preserve previously recorded movements and historical records; hide their stock estimates and remove the starting-count controls.
- **Barcode conflict:** if a barcode being added already belongs to a different product, block it and create a Supervisor approval ("Barcode conflict") showing both products.
- In the A2 prototype, approving a blocked barcode conflict keeps the existing mappings; rejecting rejects the attempted change. Either choice preserves prices, overrides and offers. A future barcode reassignment needs a separate explicit decision.
- **Supplier products:** the same product may arrive from different suppliers with different supplier SKUs, names, pack sizes, and costs. A `supplier_product` record links supplier SKU/name to a product. An item from a different supplier at a different price is registered under that supplier (own SKU/name) and still raises an alert to the Supervisor (see §8).
- **Pack size:** invoices support **Cases** or **Units**. Each supplier item stores a positive integer `units_per_case`; all Units quantities are positive whole units, and fractional Cases are accepted only when exact Decimal quantity × pack yields positive whole units. Case quantities convert to units exactly (3 cases × 12 = 36 units). Unit-entry quantities are already units and must not be multiplied again. Price per case = exact unit cost × units per case; selling prices are always per unit. Supplier item pack edits affect future entry only, never previously posted snapshots.
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

When approving, the Supervisor chooses **All branches** (default) or **This branch only**.

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
- A product has **at most one active offer** at a time (an item at $2.99 can never be both "3 for $5" and "2 for $5").
- **No approval is needed** for offers. Floor Workers and Supervisors can create and stop them.
- Start and end dates are **optional**. An offer can stay active until manually stopped.
- **Mix-and-match** uses **global pools per offer**: every product flagged "Mix & Match: 2 for $5" can be combined with every other product in that pool, regardless of category or supplier (a juice can be mixed with a can of beans).
- **AI-suggested offers:** when a product's price becomes effective at $1.99, $2.99, or $3.99 and it has no offer yet, create a suggestion task for the Floor Worker: confirm the offer and whether it joins the mix-and-match pool. It waits for the worker's confirmation.
- Offers follow the scope of the price they belong to (company default or a branch override).
- **Offers filters (A2):** one compact toolbar with a search pill plus status, category, supplier, branch and offer type. Search matches either product name, Product Code and the offer label. Filters combine, remain within the user's allowed branch/company scope, and include **Clear filters** and the result count. Branch-scoped roles cannot broaden their access through the branch filter.
- Not needed: promotion margin display, label queue.

## 9. Labels

- **Product list for labels:** every product, scrollable and searchable (name in either language, Product Code, barcode), with filters: **Arrived today** (on an invoice posted today in this branch), **Price changed recently** (approved in the last N days, setting, default 3), **On offer**, **Pricing category**, **AI category**, **Supplier**. Each row: name (EN + FA), Product Code, price, offer, and **Add to waitlist** with a copy count. "Add all filtered" adds every product in the current filter.
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

- One area called **Date tracking** with a choice of **Expiry** or **Best before**.
- **Grocery** and **Grocery (Taxable)** recommend date tracking; **Rice** and **Kitchenware** default to No. The A2 invoice-review rule supersedes the earlier grocery-only confirmation UI: **every line** must receive an explicit **Track date: Yes / No** answer before posting; Yes reveals the required type/date fields. No automatic answer counts as human confirmation.
- AI-extracted lines require the reviewer to confirm this choice.
- One date per invoice line (no multiple dates per line). **No quantity** per date. **Lot number** optional.
- "Expiring soon" = within **30 days** (a setting).
- Without sales data, the system cannot know the stock is gone, so each date entry has a manual **Cleared** action (removed, sold out, or checked). **(assumed)**

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
- The invoice **+ Add supplier** uses the Suppliers form. Supervisor additions are Confirmed immediately; Floor Worker additions are Proposed and have no opening-balance field. Deactivated suppliers are excluded from new-invoice choices while existing invoice links remain intact. **+ Add new product** likewise uses the shared editor's new mode: Supervisor additions are Active; Floor Worker proposals remain Pending approval and have no opening-count controls.
- **Shorts:** when the supplier forgot an item that is on the invoice, the worker marks that line **Short**; its amount (plus its proportional tax) is **deducted from the payable total**. If the supplier brings it later, the worker marks the line **Resolved** and the amount returns. If it never comes, the Supervisor sees the invoice and the deducted amount and closes it as **Not delivered**.
- **Tax discrepancy:** if subtotal + tax ≠ final total, or tax does not match taxable lines at the configured rate (within a tolerance), raise a Supervisor alert (does not block posting).
- Posting an invoice: records actually received movements and delivery-log entries, creates price proposals and alerts, and creates the invoice entry in that location's supplier balance. Posted invoices are locked; only the Supervisor can correct them, with an audit entry.
- **AI reading:** an uploaded PDF/photo is read automatically into structured lines (see `data-model.md`). A person must review and confirm before posting. Failures fall back to manual entry.

## 12. Supplier returns

**Returns overview (A2):** the Returns landing page lists all returns visible to the user across suppliers and allowed branches. Columns: **Return # · Supplier · Branch · Created · Items · Status · Next action**. Default status filter is **Pending**, meaning every status except resolved/cancelled. One compact toolbar has a search pill, supplier (default **All suppliers**), status, branch, **Clear filters**, and the result count. Search covers return number, supplier and product names. Selecting a row opens that return's own page; filtering never exposes another company or a worker's unassigned branch.

**Return page:** header **Return #1 · created [date] by [name]**, status pill, status-driven primary action at the top right, and a **Return policy** link opening a centered dialog. Lines are in their own card; **Evidence and history** is a separate card below. Creation date and employee are required for new returns and supplied explicitly for fictional starting returns; preserve signed pickup evidence and financial permissions.

While a return is **Open**, show **Record pickup** as the primary action and **Cancel return** as the other action. **Record resolution** appears only after pickup, when the state permits it. The return title uses the standard page-title size.

Flow:

1. Supplier arrives. Floor Worker selects/searches the supplier.
2. The app immediately shows that supplier's **open returns** (for the worker's branch).
3. Worker selects the items being picked up and records the pickup.
4. A pickup needs the **supplier representative's typed name** (required). The representative signs the **paper** copy; the app records the signed-in employee who submitted it. **Photo is optional.**
5. Resolution types: **Credit on current invoice · Credit on a later invoice · Replacement product received · Cash or other compensation · No compensation · Cancelled.**
6. Completed and cancelled returns stay in history.

Rules:

- A supplier can pick up a return **without any new invoice**.
- **One return record may contain several product lines.**
- A return is credited **once**, on a **single** invoice. A single supplier credit does not need to be split across returns. If the supplier credits through one invoice, link that credit to the return.
- **Replacement product received:** record product, quantity, date, receiving employee, supplier representative, optional photo/note, and whether it **fully or partially** resolves the return. **No money is added to Payables.**
- Cancelling a return after pickup does **not** need Supervisor approval.
- Record physical set-aside, pickup, replacement and confirmed safe-original recovery events without displaying stock levels. Cancellation alone never proves recovery; the safe-return rules in `return-policy.md` remain mandatory.

## 13. Payables (Supervisor only)

Purpose: organize each supplier's balance so the Supervisor can enter it into QuickBooks manually. No QuickBooks integration now.
Record, per branch and supplier: supplier invoices, supplier credits, payments made outside the app, cheque number, payment date, partial payments, manual adjustments, **opening balance** at first deployment, notes and disputes.
Show: balance, open invoices, overdue invoices, month-end summary that is printable and exportable (CSV). Floor Workers and Cashiers must never see any of it.

**Payables filters (A2):** one compact toolbar with a supplier-name search pill, branch, **Overdue only**, **With balance**, **Clear filters**, and the result count. Supervisor can select allowed branches or All branches. Filters affect the supplier overview and selected financial totals consistently; they do not change any ledger entries.

Demo balances must be supported by explicitly fictional posted invoices, payments/credits/adjustments and corresponding recorded delivery receipts, not an unexplained aggregate added to the ledger. Recent invoices, open invoice count, due/overdue amounts, Supplier balances and Payables must reconcile from the same scoped records. Earlier snapshot-only presentation is superseded for the A2 demo; financial allocation, correction and four-decimal unit-cost rules remain unchanged.

## 14. AI categories

AI assigns each product a flexible **AI category** from its name (beans, juices, meat, spices…), used to **filter product lookup** and separate from the four pricing categories. Receiving may propose a category; the A2 shared catalog editor is Supervisor-only, including direct category edits (§4).

## 15. Notes and notebooks (replaces paper notebooks)

Every entry is stamped with author, branch, and time. Three **built-in notebooks** keep their special behavior:

- **To order**: "we're out of this" reminders. Status open / ordered.
- **Store use**: items taken from the floor for the store's own use. Records a physical movement for later inventory, without displaying or calculating a stock level.
- **For Supervisor**: reminders and hand-over notes (status open / seen / done). The Supervisor is notified.

**Custom notebooks** are the requested **custom note categories**. Only the Supervisor can create, edit the definition/settings of, and archive them; allowed readers/contributors cannot change the notebook definition. The Supervisor creates notebooks such as "Cleaning log", "Deli temperatures", or "Lost and found". Settings per notebook: name (English and Persian), branch (one branch or all), which roles can read and which can add, optional fields (product, quantity, date, a number with unit such as a temperature), whether entries have a status (open/done), and whether the Supervisor is notified. Notebooks can be archived and restored (entries stay searchable for authorized readers); editing a definition preserves existing entries and records before/after History. Search across all notebooks the user can read. New custom notebooks default to allowing **Supervisor and Floor Worker** to read/add. In **All branches**, Supervisor sees the add form and chooses one allowed location before saving; the entry always has a concrete location. If adding is unavailable, explain the actual cause (archived notebook, read-only permission, no allowed location, or location outside notebook scope). Never hide the form silently.

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
Filters: branch, overdue (Supervisor), has open returns, has open shorts, waiting for confirmation. Search by name. Sort by any column.

**Supplier page tabs:** Overview (contact details, sales representative, default payment terms, key figures) · Invoices · Supplier items (supplier code, pack, last bought case/unit price, date/invoice, price history) · Received · Returns and credits · Shorts · Price alerts · Payments (**Supervisor only**) · Notes.

**Add supplier (B, item 44):** the Supervisor-only primary action on the overview opens a form no wider than **720 px**: name, phone, email, sales representative and their phone, payment terms, optional address and notes, and optional opening balance for each allowed branch with an **as of** date. Warn before saving if the name is close to an existing supplier, with a link to that supplier; the warning helps prevent duplicates and does not silently merge records. A Supervisor save creates a **Confirmed** supplier immediately. Each entered branch balance becomes a separate **Opening balance** supplier-ledger entry with its as-of date, Supervisor and company/branch scope, and appears in Payables. It is not a purchase invoice and does not enter purchase charts.

The same form opens from the invoice Supplier field's **+ Add supplier**. A Floor Worker can use that invoice-only flow, without opening-balance fields, and creates **Proposed**; posting stays blocked until the Supervisor confirms it. The supplier page has Supervisor-only **Edit** and **Deactivate**, never Delete. Deactivation removes the supplier from new-invoice choices but preserves contact/creation history, all prior invoices, returns, supplier products and ledger entries. Record additions, confirmations, edits and deactivation in History; existing financial history is corrected with entries rather than erased.

"Last delivery" always means the last actual **delivery/invoice received**, not an order date. Orders are separate records; an unreceived order never changes deliveries or Payables. Supplier items are built from posted invoice lines and can also be added/edited manually by Supervisor; clicking a row opens its price history. Costs are Supervisor-only here; workers can see product, supplier code, pack, date and invoice reference without monetary columns.
Floor Workers see the same section without any money columns or the Payments tab (enforced on the server).

## 22. Settings and store customization

Each supermarket must be able to shape the app to its own way of working without code changes. Settings are grouped like a standard back-office system; each setting is company-wide unless marked per branch.

| Group                        | Settings                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company                      | name, logo, brand color, currency, time zone, languages, date format, text size default                                                                                                                           |
| Branches                     | add, edit, deactivate; bilingual name, location type (Store/Warehouse), address, phone, opening hours, tax region                                                                                                 |
| People                       | employees, roles and permissions, password rules, lockout, idle lock, registered store computers                                                                                                                  |
| Catalog                      | pricing categories (add, edit, archive; cost divisor, rounding rule, special corrections, taxable, date-tracking prompt), AI categories (rename, merge), units, Product Code format                               |
| Pricing and approvals        | which changes need approval, minimum margin per category, default approval scope (all branches / this branch), cross-branch conflict alerts on/off                                                                |
| Offers                       | price-to-offer mappings, mix-and-match pools, AI offer suggestions on/off                                                                                                                                         |
| Taxes                        | tax profiles, rates, extra fees such as container deposits                                                                                                                                                        |
| Receiving                    | required invoice fields, automatic invoice numbering, tax-mismatch tolerance, AI reading on/off and the confidence level below which fields are highlighted, same-supplier lower-price questions on/off           |
| Returns/date tracking/labels | resolution types, photo required/optional, representative-name policy; expiring-soon days, category prompts; label fields/languages, waitlist auto-add (off by default), recent-price days, templates/calibration |
| Notes                        | built-in notebook behavior; create, edit, archive and restore custom notebooks with read/add permissions and fields (§15)                                                                                         |
| Notifications                | which events notify whom (in-app now; email later)                                                                                                                                                                |
| Modules                      | turn sections on or off per company (e.g., Returns, Payables, Labels; later Register, Online orders)                                                                                                              |
| Data                         | import and export (CSV), History                                                                                                                                                                                  |

**Exact group order:** Company → Branches → People → Catalog → Pricing and approvals → Offers → Taxes → Receiving → Returns/date tracking/labels → Notes → Notifications → Modules → Data. These are the B groups; Ali approved implementation after A2 on 2026-10-08.

**Working in the B demo:** Company, Branches, Pricing categories under Catalog (including rounding rules and the price tester), Offers, Notebooks under Notes, Labels under Returns/date tracking/labels, Modules. All other groups/areas show their structure only; they must not imply that nonworking actions save changes. Every actual settings change is recorded in History and can be reverted by the Supervisor.

## 23. History and undo

- **History page:** every action (who, what, when, branch, before → after), filterable by person, branch, type, and date. Floor Workers see their own actions; the Supervisor sees all.
- **Undo (B):** after reversible simple actions (stop an offer, clear a date entry, remove from the waitlist, mark a note done, edit a draft), a toast appears at **bottom-left** in English, **bottom-right** in Persian, with the action text and an **Undo** link. Each toast lasts **5 seconds of unpaused display time** and pauses its own timer while hovered. Several stack newest on top; independently timed oldest items normally disappear from the bottom first. Show at most **3** toasts plus **+N more** for additional active items. Remaining items retain their own timers; a new action must not restart another toast's timer. This supersedes the earlier 10-second/bottom-center rule. B builds the interface on A2's reversible audit records.
- **Revert:** the Supervisor can revert reversible changes from History (prices, offers, product details, settings, notebook entries). Reverting is itself a new recorded action; nothing is erased.
- **Corrections instead of undo** for posted invoices, stock movements, and payables: the app adds a correcting entry and keeps the original visible, so stock and balances stay traceable.
- Printed labels cannot be "unprinted"; History simply records the print.

## 24. Received (delivery log)

- Columns: **Product · Quantity in cases and units · Location · Supplier · Invoice number · Date · Received by**. Every row traces to an actual posted receipt; drafts, refused lines and order-only missing items add nothing. Replacement and later short deliveries retain their own evidence/receipt links.
- Filters combine: date range, location, supplier, product and a search pill; Supervisor can use All branches, workers stay within assigned locations, Cashiers have no access. Product page shows **Last received** per allowed location; Supplier page has a **Received** tab. Dashboard uses **Arrived this week**, replacing Low stock.
- Preserve original records; corrections determine effective location and voided receipts without double-counting. No on-hand stock total.

## 25. Store cost and manual prices

- Products list: Supervisor-only **Store cost** (last regular unit cost before tax) and **Margin %**. Product page shows cost history with supplier/location/date/invoice and retained four-decimal cost. Floor Worker/Cashier visibility remains unchanged. Short-dated receipts appear in history but never replace regular cost.
- Supervisor may set a selling price above or below the rule with existing below-margin confirmation. A **Manual price** pill follows the effective branch/company price wherever staff see it, including Lookup, Products, invoice selling-price review and Labels selection; Products has a **Manual prices** filter. Show **Rule price $X.XX · Manual price $Y.YY**; margin is Supervisor-only except existing authorized invoice-cost visibility. This flag is price-scope provenance, not a comparison based solely on today's rule.
- On new regular receipts, preserve the approved manual price and show the new rule price. Reviewer must choose **Keep manual price** or **Use rule price**. Keep preserves manual provenance and any configured below-margin review evaluated against the actual manual price and new regular cost. Use creates the normal invoice-posting price proposal even when rule/manual values happen to match, leaving the manual approved price effective until explicit Supervisor approval. Only the effective approved decision replaces/removes the manual flag.

## 26. Supplier items and packs

- Replace **Products supplied** with the supplier's **Supplier items** list, populated idempotently from posted invoices; Supervisor can also add/edit product association, supplier item code and pack. Every row: product, optional supplier code, **Case of 12**, last bought price before tax per case/per unit, last bought date and last invoice number. Money and price history remain Supervisor-only in Suppliers. An explicitly enabled Floor Worker may see supplier-item order cost snapshots/expected amounts **only inside Orders**, without supplier cost-history/catalog privileges.
- Keep full purchase-price history including short-dated lots and regular receipts. **Last bought price** is the latest recorded purchase; regular pricing basis separately excludes short-dated expiry discounts. Retain snapshot packs/costs on invoices/orders; editing the current pack never rewrites history.

## 27. Orders

- **Orders** is a new sidebar section, Supervisor-only by default; company setting can explicitly allow Floor Workers. Cashiers have no access. All actions enforce company and allowed location, including Warehouse.
- New order: location defaults to current concrete location/user's own location → confirmed active supplier → supplier item list showing last price and pack → positive cases per item → exact expected total **before tax** → **Save as draft / Place order**. Expected totals are estimates, never supplier ledger entries. Save line snapshots and allocate a stable order reference. Company setting **`orders.allow_floor_worker`** defaults to `false`. A manually created supplier item with no purchase has no bought cost/date/invoice: show blanks, not invented historical metadata. Unless an actual supplier purchase or explicit Supervisor quote supplies a cost, require **Expected unit cost** before Place order; never silently borrow product regular/catalog cost. A quote is separately marked quoted/expected, never last bought.
- Print order produces a clean bilingual A4 sheet for phone orders or Save as PDF, with company/location, supplier, reference/date, names, supplier codes, cases, pack, units and before-tax expected prices/total.
- Statuses: **Draft → Ordered → Partially received → Received**, or **Cancelled**. List filters: status, supplier, location, date and search. Cancellation preserves History; receiving updates quantities from linked posted invoices without duplicates. No stock counts.
- Open **To order** notes can be added to an order in one click. A free-text note without a catalog product requires an explicit supplier-item selection; every linked note requires an explicit Cases quantity before placement. Do not invent the item, pack or quantity. Preserve the note and its source link; only successful placing marks it ordered, and only explicitly selected source notes are changed.

## 28. Invoice compared with its order

- Suggest open Orders for the same supplier/location; reviewer confirms the link. Never match an order from another company/location/supplier. Compare normalized units using each order/invoice line's retained pack. Do not silently combine different supplier codes into one line.
- **Delivered as ordered:** OK. **Fewer delivered:** Short using the existing invoice short flow for invoiced-but-missing goods. **Ordered but absent from invoice:** explicit **Short / Back-ordered / Cancelled** decision; order-only missing goods do not create a payable deduction against an amount never invoiced. Back-ordered/Short remains outstanding; Cancelled closes that quantity with History. A billed 3-case invoice against a 4-case order leaves 1 case outstanding for Short/Back-ordered/Cancelled; it does not create a deduction for that uninvoiced case.
- **Delivered but not ordered:** **Keep it (we pay for it)** or **Refused / sent back with the driver**. Refused quantities never enter effective invoice payable, Received, product regular cost or price approvals. Retain original invoice line/document and record the decision and conserved proportional original tax.
- **Unit cost changed:** show old/new before-tax unit and case costs, retain comparison evidence and require a decision. Every difference blocks posting until resolved in the existing blockers style. After posting, update linked order receipt/remaining quantities and create **one Supervisor alert listing all differences**, without duplicate alerts on retries. For a linked invoice, retain regular lower-price answers as evidence inside this consolidated `order_differences` alert; do not add a second same-supplier lower-price alert. Invoices without an order still use existing review/short/lower-price rules and alerts.

## 29. Short-dated expiry discounts and Branch requests

**Short-dated (expiry discount):** offer this choice when incoming cost is lower than the relevant supplier's last bought price. Require an actual expiry date and create Date tracking at posting. Record received quantity and actual discounted invoice payable, but preserve the product's regular cost and selling price, create no price-change approval and no regular lower-cost repricing. Supervisor can optionally create a clearance offer and print Promo labels. Other lower-price explanations keep the existing same-supplier questions and allowed unknown/no-previous-stock answers. Linked-order invoices consolidate their answers into the one order-differences alert; unlinked invoices retain existing lower-price alerts.

**Branch requests:** new sidebar item for Supervisor/Floor Worker, no Cashier access; **Incoming / Outgoing** tabs and an actionable count pill. Requesting location selects a different active same-company Store/Warehouse, then catalog products or free-text items such as bread, quantity in **Units / Cases**, optional note and **Send**. Cases require a retained positive pack for conversion where a product is known; free-text case requests without a pack require positive whole Cases and remain cases without inventing units. Fractional Cases require an explicit positive integer pack and exact positive whole normalized units.

Receiving/sending location opens its incoming checklist, ticks items actually being sent or marks them **Short**, then **Mark as sent**. A bilingual picking list prints. Requesting location ticks actual arrivals or marks **Missing**, then **Mark as received** and **Close request**. States: **Draft → Requested → Sent → Received → Closed**, or **Cancelled** (Draft/Requested only); sent/received physical evidence remains and is reviewed/closed rather than erased through cancellation. Only actors at the responsible endpoint (or Supervisor with explicit endpoint context) may advance that side. Received with missing quantities remains visibly annotated. **Copy short or missing items** starts a new draft without mutating the original or sending twice. Record lifecycle/actual physical transfer movements with company/location/employee/time and History; requests do not change stock or supplier Payables.
