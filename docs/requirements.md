# Requirements v1

Sources: Super Arzon's workflow notes, the owner's brainstorm, and every decision made in planning. Where something was assumed rather than stated, it is marked **(assumed)** and listed in `open-questions.md`.

**Vision: AI and automation are the point of this product.** A supplier invoice (PDF or photo) is uploaded, AI reads it into structured lines, the app matches products, calculates prices, and flags what needs attention; people review and approve instead of typing. Every feature should move routine work from people to the system, while keeping a human check wherever money, prices, or stock are at stake.

## 1. Purpose and phases

Give a supermarket an **inventory and receiving system** where none exists, with price calculation, approvals, offers, labels, expiry tracking, supplier returns, supplier balances, and internal notes.

| Phase     | Content                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | Clickable prototype (no backend) to pitch the owner                                                                                      |
| 1         | Core app: receiving, products, pricing, approvals, offers, labels, expiry, returns, shorts, payables, notes, dashboard, stock per branch |
| 2 (later) | Cash-register connection: sales reduce stock; shrinkage (loss/theft) detection                                                           |
| 3 (later) | Customer website with food ordering, sign-in, scheduled pickup, receipt printer                                                          |

Until Phase 2, "stock on hand" is an estimate (received − returned − damaged − store use ± counts). The ledger design (see `data-model.md`) must make Phase 2 a plug-in, not a rewrite.

## 2. Tenancy and branches

- **Company** (e.g., Super Arzon) → **Branches** (Super Arzon has three). Every record belongs to a company; branch-level records also belong to a branch.
- **Shared across a company's branches:** product catalog (product codes are company-wide), supplier list, offer definitions, settings, pricing rules.
- **Separate per branch:** inventory, invoices, returns, shorts, expiry entries, supplier balances and payables, notes, to-order list, stock counts.
- **Prices:** each product has a company default price. A branch may have its own price (override). Different branch prices are allowed. When two branches differ, the Supervisor is alerted (see `workflows.md`, "Cross-branch price conflict").
- Floor Workers and Cashiers see only their assigned branch. The Supervisor can see and switch between all branches.
- Branch and company names, logo, and terminology are settings.
- The Supervisor can **add branches**, edit branch details (name, address, phone, opening hours, tax region) and deactivate a branch in Settings → Branches. A deactivated branch keeps its history.

## 3. Roles and permissions

Three roles. **Each employee has exactly one role**, and the app they see (menus, screens, data) is decided by that role. Everyone signs in with their own username and password; see §16. A shared in-store computer is expected.

| Capability                                                                                                         |        Cashier         |      Floor Worker       | Supervisor  |
| ------------------------------------------------------------------------------------------------------------------ | :--------------------: | :---------------------: | :---------: |
| Look up products and prices (including "Pending" labels)                                                           |          Yes           |           Yes           |     Yes     |
| See supplier costs and margins                                                                                     |           No           | On invoices they handle |     Yes     |
| Propose products and correct invoice matching/details during receiving                                             |           No           |           Yes           |     Yes     |
| Open the shared product editor and edit the catalog or approved selling price                                      |           No           |           No            |     Yes     |
| Approve new products, price changes, tax-profile changes, barcode conflicts, manual overrides, below-margin prices |           No           |           No            |     Yes     |
| Create invoices, upload PDFs/photos, save drafts, post invoices                                                    |           No           |           Yes           |     Yes     |
| Quick-add a supplier (proposal)                                                                                    |           No           |           Yes           |     Yes     |
| Confirm a new supplier                                                                                             |           No           |           No            |     Yes     |
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
| Record stock counts and adjustments                                                                                |           No           |      Yes (logged)       |     Yes     |
| Payables, supplier balances, payments, credits, opening balances                                                   |           No           |         **No**          |     Yes     |
| Suppliers overview: contact, last delivery, open returns, open shorts                                              |           No           |           Yes           |     Yes     |
| Suppliers overview: balance, overdue amount, next due date, payments                                               |           No           |         **No**          |     Yes     |
| Create employee accounts, reset passwords, deactivate users                                                        |           No           |           No            |     Yes     |
| Manage branches, devices, and all Settings (§22)                                                                   |           No           |           No            |     Yes     |
| Supervisor dashboard, all branches                                                                                 |           No           |           No            |     Yes     |

Floor Workers never see supplier balances or payables. Cashier = lookup only, unless the Supervisor gives cashiers access to a custom notebook.

## 4. Products and product codes

- Every product has: **Product Code**, name (English), name (Persian), description (English/Persian, optional), unit size (e.g., "400 g"), pricing category, tax profile, AI category (see §14), barcode(s) (optional, multiple allowed), status.
- **Product codes are permanent.** Never reused. Archived products can be reactivated. Codes are strings, zero-padded to at least four digits (`0001`…`9999`), then continue as five digits (`10000`…). **(assumed: start at 0001)**
- Statuses: `pending_approval` (new product), `active`, `archived`.
- **Barcode conflict:** if a barcode being added already belongs to a different product, block it and create a Supervisor approval ("Barcode conflict") showing both products.
- In the A2 prototype, approving a blocked barcode conflict keeps the existing mappings; rejecting rejects the attempted change. Either choice preserves prices, overrides and offers. A future barcode reassignment needs a separate explicit decision.
- **Supplier products:** the same product may arrive from different suppliers with different supplier SKUs, names, pack sizes, and costs. A `supplier_product` record links supplier SKU/name to a product. An item from a different supplier at a different price is registered under that supplier (own SKU/name) and still raises an alert to the Supervisor (see §8).
- **Pack size:** invoices often list cases. Each supplier product stores `units_per_case`. Pricing always uses **unit cost before tax** = line total before tax ÷ (quantity × units per case).
- **Shared product editor (A2):** only the Supervisor may edit catalog names (English/Persian), description, unit size, AI category, pricing category, barcode, supplier association, date tracking, and approved selling price. The same editor opens from Lookup, every Products row, and the product page. Product Code is read-only. Receiving proposals and worker invoice matching remain available under their existing permissions.
- **Manual price change:** ask for **All branches** (default) or **This branch only**, preview the affected prices/overrides, and record the Supervisor's save as the manual-override approval decision. The approved change runs the normal offer and cross-branch-conflict checks. Preserve the invoice calculation and its invoice number; do not overwrite the recorded cost basis. The product card and page show both **Calculated from invoice FV-20417: $2.99 · Changed by [name] on [date]: $3.29** when those are the real recorded values. Names, invoice numbers, dates and prices are isolated in Persian.
- Product-detail and price edits append reversible History entries with actor, branch/scope, time and before/after values. A2 stores these entries; the History/Revert interface is deferred to pull request B. Revert must later detect intervening changes rather than silently overwriting them.

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
| New product                               | Always                                  |
| Sales-tax profile change                  | Always                                  |
| Barcode conflict                          | Always                                  |
| Manual selling-price override             | Always                                  |
| Calculated price below the minimum margin | Always                                  |
| Ordinary calculated price change          | Yes (Supervisor review)                 |
| Supplier cost change only                 | No, unless it changes the selling price |

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
- Languages: **English and Persian** together.
- Multiple labels per A4 sheet, and **start at a selected slot** on a partially used sheet.
- **No default template.** Users create and save their own presets (Template 1, Template 2…), each with width, height, margins, gaps, and **calibration offsets** (shift left/right/up/down in mm) because every printer shifts slightly. Each template can print a **test alignment page**.
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
- **Branch** is set on the invoice (from the document or chosen at upload).
- **New suppliers:** a Floor Worker can quick-add a supplier proposal while entering an invoice. The invoice cannot be **posted** until the Supervisor confirms the supplier.
- **Shorts:** when the supplier forgot an item that is on the invoice, the worker marks that line **Short**; its amount (plus its proportional tax) is **deducted from the payable total**. If the supplier brings it later, the worker marks the line **Resolved** and the amount returns. If it never comes, the Supervisor sees the invoice and the deducted amount and closes it as **Not delivered**.
- **Tax discrepancy:** if subtotal + tax ≠ final total, or tax does not match taxable lines at the configured rate (within a tolerance), raise a Supervisor alert (does not block posting).
- Posting an invoice: adds stock movements, creates price proposals and alerts, creates the invoice entry in that branch's supplier balance. Posted invoices are locked; only the Supervisor can correct them, with an audit entry.
- **AI reading:** an uploaded PDF/photo is read automatically into structured lines (see `data-model.md`). A person must review and confirm before posting. Failures fall back to manual entry.

## 12. Supplier returns

**Returns overview (A2):** the Returns landing page lists all returns visible to the user across suppliers and allowed branches. Columns: **Return # · Supplier · Branch · Created · Items · Status · Next action**. Default status filter is **Pending**, meaning every status except resolved/cancelled. One compact toolbar has a search pill, supplier (default **All suppliers**), status, branch, **Clear filters**, and the result count. Search covers return number, supplier and product names. Selecting a row opens that return's own page; filtering never exposes another company or a worker's unassigned branch.

**Return page:** header **Return #1 · created [date] by [name]**, status pill, status-driven primary action at the top right, and a **Return policy** link opening a centered dialog. Lines are in their own card; **Evidence and history** is a separate card below. Creation date and employee are required for new returns and supplied explicitly for fictional starting returns; preserve signed pickup evidence and financial permissions.

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
- Damaged items leave sellable stock when the return is created (stock movement), and return to stock only if cancelled.

## 13. Payables (Supervisor only)

Purpose: organize each supplier's balance so the Supervisor can enter it into QuickBooks manually. No QuickBooks integration now.
Record, per branch and supplier: supplier invoices, supplier credits, payments made outside the app, cheque number, payment date, partial payments, manual adjustments, **opening balance** at first deployment, notes and disputes.
Show: balance, open invoices, overdue invoices, month-end summary that is printable and exportable (CSV). Floor Workers and Cashiers must never see any of it.

**Payables filters (A2):** one compact toolbar with a supplier-name search pill, branch, **Overdue only**, **With balance**, **Clear filters**, and the result count. Supervisor can select allowed branches or All branches. Filters affect the supplier overview and selected financial totals consistently; they do not change any ledger entries.

Demo balances must be supported by explicitly fictional posted invoices, payments/credits/adjustments and corresponding stock receipts, not an unexplained aggregate added to the ledger. Recent invoices, open invoice count, due/overdue amounts, Supplier balances and Payables must reconcile from the same scoped records. Earlier snapshot-only presentation is superseded for the A2 demo; financial allocation, correction and four-decimal unit-cost rules remain unchanged.

## 14. AI categories

AI assigns each product a flexible **AI category** from its name (beans, juices, meat, spices…), used to **filter product lookup** and separate from the four pricing categories. Receiving may propose a category; the A2 shared catalog editor is Supervisor-only, including direct category edits (§4).

## 15. Notes and notebooks (replaces paper notebooks)

Every entry is stamped with author, branch, and time. Three **built-in notebooks** keep their special behavior:

- **To order**: "we're out of this" reminders. Status open / ordered.
- **Store use**: items taken from the floor for the store's own use. Creates a stock movement.
- **For Supervisor**: reminders and hand-over notes (status open / seen / done). The Supervisor is notified.

**Custom notebooks** are the requested **custom note categories**. Only the Supervisor can create, edit the definition/settings of, and archive them; allowed readers/contributors cannot change the notebook definition. The Supervisor creates notebooks such as "Cleaning log", "Deli temperatures", or "Lost and found". Settings per notebook: name (English and Persian), branch (one branch or all), which roles can read and which can add, optional fields (product, quantity, date, a number with unit such as a temperature), whether entries have a status (open/done), and whether the Supervisor is notified. Notebooks can be archived and restored (entries stay searchable for authorized readers); editing a definition preserves existing entries and records before/after History. Search across all notebooks the user can read.

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

Add **Low stock**, drawn from branch stock-movement estimates and open To order notes (include nonpositive stock or an open To order reminder, with the recorded estimate), and **Price changes this week**, drawn from effective approved/manual price-change records dated in the current company-timezone week. Do not invent demand, sales history or low-stock thresholds. Charts/lists follow the layouts in `design-language.md`.

## 18. Terminology (use exactly)

Invoices (subtitle: "Deliveries and supplier invoices") · Suppliers · Last delivery · Floor Worker · Kitchenware · Grocery (Taxable) · Returns (subtitle: "Supplier returns and credits") · Product Code · Selling price · Date tracking (Expiry or Best before) · Label waitlist · Notebooks · History. Persian equivalents are stored as translations and reviewed by Ali.

## 19. Platform

Web app first (responsive; works on desktop, tablet, phone browsers; installable later). Native phone and desktop apps are later options. Hosting on AWS later; development happens locally in containers.

## 20. Non-functional

Fast tables with search and filters; keyboard-friendly entry; clear audit trail; daily backups; data export; no data loss on refresh (drafts auto-save); accessible contrast; works with a barcode scanner (keyboard wedge) and a document scanner or phone camera for invoice images.

## 21. Suppliers overview

A dedicated **Suppliers** section (company-wide supplier list; figures shown for the selected branch, or all branches for the Supervisor).

**Overview table:** supplier name · status (Confirmed / Proposed) · **last delivery** (date of the most recent posted invoice for that supplier in the branch) · deliveries this month · open returns · open shorts · payment terms · sales representative and phone. **Supervisor only:** balance · overdue amount · next due date.
Filters: branch, overdue (Supervisor), has open returns, has open shorts, waiting for confirmation. Search by name. Sort by any column.

**Supplier page tabs:** Overview (contact details, sales representative, default payment terms, key figures) · Invoices · Products supplied (their SKU, pack size, last cost, cost history) · Returns and credits · Shorts · Price alerts · Payments (**Supervisor only**) · Notes.

"Last delivery" always means the last **delivery/invoice received**. The app does not record purchase orders.
Floor Workers see the same section without any money columns or the Payments tab (enforced on the server).

## 22. Settings and store customization

Each supermarket must be able to shape the app to its own way of working without code changes. Settings are grouped like a standard back-office system; each setting is company-wide unless marked per branch.

| Group                        | Settings                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company                      | name, logo, brand color, currency, time zone, languages, date format, text size default                                                                                                                           |
| Branches                     | add, edit, deactivate; name, address, phone, opening hours, tax region                                                                                                                                            |
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

**Exact group order:** Company → Branches → People → Catalog → Pricing and approvals → Offers → Taxes → Receiving → Returns/date tracking/labels → Notes → Notifications → Modules → Data. These are the B groups; A2 changes the plan, not the grouped Settings implementation.

**Working in the B demo:** Company, Branches, Pricing categories under Catalog (including rounding rules and the price tester), Offers, Notebooks under Notes, Labels under Returns/date tracking/labels, Modules. All other groups/areas show their structure only; they must not imply that nonworking actions save changes. Every actual settings change is recorded in History and can be reverted by the Supervisor.

## 23. History and undo

- **History page:** every action (who, what, when, branch, before → after), filterable by person, branch, type, and date. Floor Workers see their own actions; the Supervisor sees all.
- **Undo (B):** after reversible simple actions (stop an offer, clear a date entry, remove from the waitlist, mark a note done, edit a draft), a toast appears at **bottom-left** in English, **bottom-right** in Persian, with the action text and an **Undo** link. Each toast lasts **5 seconds of unpaused display time** and pauses its own timer while hovered. Several stack newest on top; independently timed oldest items normally disappear from the bottom first. Show at most **3** toasts plus **+N more** for additional active items. Remaining items retain their own timers; a new action must not restart another toast's timer. This supersedes the earlier 10-second/bottom-center rule. A2 stores reversible audit entries but does not implement the B toast/History interface.
- **Revert:** the Supervisor can revert reversible changes from History (prices, offers, product details, settings, notebook entries). Reverting is itself a new recorded action; nothing is erased.
- **Corrections instead of undo** for posted invoices, stock movements, and payables: the app adds a correcting entry and keeps the original visible, so stock and balances stay traceable.
- Printed labels cannot be "unprinted"; History simply records the print.
