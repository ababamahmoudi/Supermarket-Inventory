# Requirements v1

Sources: Super Arzon's workflow notes, the owner's brainstorm, and every decision made in planning. Where something was assumed rather than stated, it is marked **(assumed)** and listed in `open-questions.md`.

## 1. Purpose and phases
Give a supermarket an **inventory and receiving system** where none exists, with price calculation, approvals, offers, labels, expiry tracking, supplier returns, supplier balances, and internal notes.

| Phase | Content |
|---|---|
| 0 | Clickable prototype (no backend) to pitch the owner |
| 1 | Core app: receiving, products, pricing, approvals, offers, labels, expiry, returns, shorts, payables, notes, dashboard, stock per branch |
| 2 (later) | Cash-register connection: sales reduce stock; shrinkage (loss/theft) detection |
| 3 (later) | Customer website with food ordering, sign-in, scheduled pickup, receipt printer |

Until Phase 2, "stock on hand" is an estimate (received − returned − damaged − store use ± counts). The ledger design (see `data-model.md`) must make Phase 2 a plug-in, not a rewrite.

## 2. Tenancy and branches
- **Company** (e.g., Super Arzon) → **Branches** (Super Arzon has three). Every record belongs to a company; branch-level records also belong to a branch.
- **Shared across a company's branches:** product catalog (product codes are company-wide), supplier list, offer definitions, settings, pricing rules.
- **Separate per branch:** inventory, invoices, returns, shorts, expiry entries, supplier balances and payables, notes, to-order list, stock counts.
- **Prices:** each product has a company default price. A branch may have its own price (override). Different branch prices are allowed. When two branches differ, the Supervisor is alerted (see `workflows.md`, "Cross-branch price conflict").
- Floor Workers and Cashiers see only their assigned branch. The Supervisor can see and switch between all branches.
- Branch and company names, logo, and terminology are settings.

## 3. Roles and permissions
Three roles. **Each employee has exactly one role**, and the app they see (menus, screens, data) is decided by that role. Everyone signs in with their own username and password; see §16. A shared in-store computer is expected.

| Capability | Cashier | Floor Worker | Supervisor |
|---|:-:|:-:|:-:|
| Look up products and prices (including "Pending" labels) | Yes | Yes | Yes |
| See supplier costs and margins | No | On invoices they handle | Yes |
| Create/edit products (name, unit size, barcode); propose new products | No | Yes | Yes |
| Approve new products, price changes, tax-profile changes, barcode conflicts, manual overrides, below-margin prices | No | No | Yes |
| Create invoices, upload PDFs/photos, save drafts, post invoices | No | Yes | Yes |
| Quick-add a supplier (proposal) | No | Yes | Yes |
| Confirm a new supplier | No | No | Yes |
| Mark an invoice line Short / mark it Resolved | No | Yes | Yes |
| Close a short as "not delivered" | No | No | Yes |
| Create returns, record pickup, record resolution, cancel a return | No | Yes | Yes |
| Create/stop offers and mix-and-match; confirm AI-suggested offers | No | Yes | Yes |
| Create label templates and print labels | No | Yes | Yes |
| Record store-use, to-order items, notes for the Supervisor | No | Yes | Yes |
| Record stock counts and adjustments | No | Yes (logged) | Yes |
| Payables, supplier balances, payments, credits, opening balances | No | **No** | Yes |
| Suppliers overview: contact, last delivery, open returns, open shorts | No | Yes | Yes |
| Suppliers overview: balance, overdue amount, next due date, payments | No | **No** | Yes |
| Create employee accounts, reset passwords, deactivate users | No | No | Yes |
| Manage devices, settings, pricing rules | No | No | Yes |
| Supervisor dashboard, all branches | No | No | Yes |

Floor Workers never see supplier balances or payables. Cashier = lookup only **(assumed: cashiers cannot add notes)**.

## 4. Products and product codes
- Every product has: **Product Code**, name (English), name (Persian), description (English/Persian, optional), unit size (e.g., "400 g"), pricing category, tax profile, AI category (see §14), barcode(s) (optional, multiple allowed), status.
- **Product codes are permanent.** Never reused. Archived products can be reactivated. Codes are strings, zero-padded to at least four digits (`0001`…`9999`), then continue as five digits (`10000`…). **(assumed: start at 0001)**
- Statuses: `pending_approval` (new product), `active`, `archived`.
- **Barcode conflict:** if a barcode being added already belongs to a different product, block it and create a Supervisor approval ("Barcode conflict") showing both products.
- **Supplier products:** the same product may arrive from different suppliers with different supplier SKUs, names, pack sizes, and costs. A `supplier_product` record links supplier SKU/name to a product. An item from a different supplier at a different price is registered under that supplier (own SKU/name) and still raises an alert to the Supervisor (see §8).
- **Pack size:** invoices often list cases. Each supplier product stores `units_per_case`. Pricing always uses **unit cost before tax** = line total before tax ÷ (quantity × units per case).

## 5. Pricing categories and selling price
Four categories, defined as configuration (see `pricing-engine.md` for the exact algorithm and tests):

| Category | Cost divisor | Rounding | Taxable | Date-tracking prompt |
|---|---|---|---|---|
| Grocery | 0.65 | Bands + 2.49/3.49 correction | No | Yes |
| Grocery (Taxable) | 0.65 | Bands + 2.49/3.49 correction | Yes | Yes |
| Rice | 0.80 | Always up to next .99 | No | **No** |
| Kitchenware | 0.60 | Bands (no 2.49/3.49 correction) | Yes | No |

- All calculations use **cost before tax**.
- The Selling Price is always **displayed before tax**. Taxable products carry a clear **Taxable** label so the cashier adds tax at the register. (This also applies to labels: tax indicator on.)
- The pricing category drives pricing rules. It is separate from the **AI category** used for filtering (§14).

## 6. Approvals
Every calculated selling-price change needs Supervisor approval.

| Event | Approval |
|---|---|
| New product | Always |
| Sales-tax profile change | Always |
| Barcode conflict | Always |
| Manual selling-price override | Always |
| Calculated price below the minimum margin | Always |
| Ordinary calculated price change | Yes (Supervisor review) |
| Supplier cost change only | No, unless it changes the selling price |

**Pending prices:** a proposed price is visible in the Products section, clearly labeled **Pending**, so workers and cashiers know it still has to be confirmed. The cashier keeps charging the **last approved price** and never sells at a pending lower price. **(assumed)** For a brand-new product with no approved price, the lookup shows the proposed price labeled "Pending: confirm with a Supervisor before selling". **(assumed)**

When approving, the Supervisor chooses **Apply to all branches** (default) or **This branch only**.

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
- Not needed: promotion margin display, label queue.

## 9. Labels
- Fields on the default Super Arzon label: product name, description, price, offers, **product code**, **Super Arzon logo**, **unit size**, **tax indicator**. **Not** shown: barcode, promotion expiry date.
- Languages: **English and Persian** together.
- Print on **A4** with multiple labels per sheet, and **start at a selected slot** on a partially used sheet.
- **No default template.** Users create and save their own presets (Template 1, Template 2…), each with its own dimensions (width, height, margins, gaps).
- **No label queue.** Printing is: choose products → choose a template → choose the starting slot → preview → print.
- Output must render Persian text correctly (see `architecture-devops.md`).

## 10. Date tracking (expiry and best-before)
- One area called **Date tracking** with a choice of **Expiry** or **Best before**.
- **Grocery** and **Grocery (Taxable)** prompt the receiver to decide whether date tracking is needed. **Rice** and **Kitchenware** do not prompt.
- AI-extracted lines require the reviewer to confirm date tracking.
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

## 14. AI categories
AI assigns each product a flexible **AI category** from its name (beans, juices, meat, spices…), used to **filter product lookup**. It is editable by Floor Workers and Supervisors and separate from the four pricing categories.

## 15. Notes and logs (replaces paper notebooks)
Three simple sections, each entry stamped with author, branch, and time:
- **To order**: "we're out of this" reminders. Status open / ordered.
- **Store use**: items taken from the floor for the store's own use. Creates a stock movement.
- **Notes for the Supervisor**: reminders and hand-over notes (status open / seen / done).
The Supervisor is notified of new items.

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
Order of importance: approvals waiting (new products, price changes, barcode conflicts, supplier proposals) → same-supplier lower-price alerts → cross-branch price conflicts → tax discrepancies → AI invoices waiting for review and AI failures → open shorts → open supplier returns and returns waiting for credit → upcoming expiries → overdue invoices and supplier balances → recent posted invoices → employee activity. (No "labels waiting to print"; there is no label queue.)

## 18. Terminology (use exactly)
Invoices (subtitle: "Deliveries and supplier invoices") · Suppliers · Last delivery · Floor Worker · Kitchenware · Grocery (Taxable) · Returns (subtitle: "Supplier returns and credits") · Product Code · Selling Price · Date tracking (Expiry or Best before). Persian equivalents are stored as translations and reviewed by Ali.

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
