# Screens and navigation

Layout follows `design-language.md`. Menus show only what the signed-in role may use.

## Navigation by role
| Menu item | Cashier | Floor Worker | Supervisor |
|---|:-:|:-:|:-:|
| Lookup (Products) | Yes (lookup only) | Yes | Yes |
| Home / Dashboard | Lookup is home | Worker home | Supervisor dashboard |
| Invoices ("Deliveries and supplier invoices") | | Yes | Yes |
| Returns ("Supplier returns and credits") | | Yes | Yes |
| Products | | Yes | Yes |
| Offers | | Yes | Yes |
| Labels | | Yes | Yes |
| Expiry (Date tracking) | | Yes | Yes |
| Notes (To order · Store use · For Supervisor) | | Yes | Yes |
| Stock | | Yes | Yes |
| Suppliers | | Yes (no balances) | Yes |
| Approvals | | | Yes |
| Payables | | | Yes |
| Users and devices | | | Yes |
| Settings | | | Yes |

Top bar: branch name (Supervisor gets a branch switcher including "All branches"), language toggle (English / فارسی), **Lock** button, user menu.

## Screens

### Sign-in and lock
- **Store computer:** grid of employee names → PIN pad (large keys). Lock screen after idle shows the last user's name and asks for the PIN.
- **Anywhere else:** email + password.
- Re-prompt for the password before approvals, payables, settings.

### Cashier lookup (also the first tab for everyone)
One very large search box (scan or type: name, Product Code, barcode, Persian or English). Filters: AI category. Result card: name (EN + FA), unit size, **Selling Price** (large, before tax), tags: **Taxable**, offer pill ("2 for $5"), **New price pending** (amber). Shows the price to charge now; pending price appears only as a tag/secondary text. No costs, no stock numbers for cashiers.

### Floor Worker home
Cards: my drafts, invoices under review, open returns for today's suppliers, offers to confirm (AI suggestions), items expiring soon, open shorts, notes assigned to me. Quick actions: New invoice, Upload invoice, New return, Print labels, Add note.

### Supervisor dashboard
Stat cards in the order of `requirements.md` §17, then **Approvals queue** (pending tasks with priority badges), **Alerts** (same-supplier lower price, cross-branch price conflicts, tax discrepancies), **Recent activity**. Branch switcher filters everything.

### Invoices
- Tabs: **Drafts · Processing · Needs review · Ready to post · Posted · Cancelled**. Search by supplier, number, date.
- **New invoice** → choose branch/supplier (quick-add supplier) → upload PDF/photo (or enter manually) → header form → lines table.
- **Lines table (review):** description, matched product (or "New product"), qty, unit/units per case, unit cost, line total, calculated selling price, current price, status badges, **Date tracking** control (Expiry/Best before + date + optional lot, only where the category prompts), **Mark as short**, and the lower-price questions where triggered.
- Banner for blockers (supplier not confirmed, original file missing). Bottom bar: **Save as draft** and **Post invoice**.
- Invoice detail (posted): read-only with history, shorts, linked returns/credits.

### Products
Table with search, filters (pricing category, AI category, status, supplier, has pending price, has offer). Product detail: names EN/FA, description, unit size, code (read-only), category, tax profile, barcodes, price block (approved / pending / branch overrides), supplier products (SKU, pack size, last cost), offer, stock per branch (Supervisor sees all), history. New product created from invoices appears as **Pending approval**.

### Approvals (Supervisor)
Tabs: **New products · Price changes · Tax profile changes · Barcode conflicts · Manual overrides · Below margin · Suppliers**. Each row shows old → new price, cost basis, margin, who and which branch; actions **Approve** (choose All branches / This branch only) and **Reject**.

### Alerts (Supervisor)
Same-supplier lower price: item, supplier, old/new cost, worker's answers (same expiry? units left? both dates) → **Taken care of / Still pending** + note. Other-supplier price, cross-branch conflict (**Mark as intentional / Apply to all**), tax discrepancy.

### Offers
List of active offers with product, price, offer, mix-and-match pool, start/end (optional), created by; **Stop**. "To confirm" tab with AI suggestions: **Confirm** (toggle: join mix-and-match) / **Dismiss**. Pool view: all products in "2 for $5", etc.

### Labels
Steps: select products → pick template (or **New template**: name, width, height, margins, gaps) → starting slot on the A4 grid → preview → print. No queue. Template manager lists saved presets.

### Returns
Supplier selector (search) → immediately lists that supplier's **open returns** → select lines → **Record pickup** (supplier representative name required; optional photo; note) → resolution panel (types in `requirements.md` §12; for replacements: product, qty, date, fully/partially). History tab with filters.

### Expiry (Date tracking)
Table: product, branch, date, type, days left, supplier/invoice. Filters: expiring soon (default 30 days), expired, AI category. Row action **Cleared**.

### Notes
Three tabs: **To order · Store use · For Supervisor**. Fast add form (type, text, optional product and quantity). Supervisor sees unread count in the sidebar.

### Stock
Per-branch stock on hand (estimate until register integration), movement history per product, **Stock count** flow with variance, store-use entry.

### Suppliers
List and detail (contact, supplier products and SKUs, history). Floor Workers see no money. Supervisor sees the balance tab. New suppliers show **Proposed** until confirmed.

### Payables (Supervisor)
Supplier list with balance per branch; detail with ledger (invoices, credits, payments with cheque number and date, adjustments, opening balance, disputes with notes); **month-end summary** (print/CSV).

### Users and devices, Settings (Supervisor)
Users: roles, branches, reset PIN/password, deactivate immediately. Devices: register the store computer. Settings: company/branch names, logo and brand color, pricing categories (divisor, rounding), special corrections, offer definitions, minimum margin, expiring-soon days, idle lock, terminology, tax profiles/rate, languages.

## Responsive behavior
Desktop/large store monitor is the primary target; tablet and phone browsers must work (sidebar collapses; tables scroll inside their container; forms become one column; camera upload works for invoice photos).
