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
| Labels (product list, waitlist, templates) | | Yes | Yes |
| Expiry (Date tracking) | | Yes | Yes |
| Notes (built-in and custom notebooks) | If a notebook allows | Yes | Yes |
| Stock | | Yes | Yes |
| Suppliers | | Yes (no balances) | Yes |
| Approvals | | | Yes |
| Payables | | | Yes |
| Users and devices | | | Yes |
| Settings | | | Yes |
| History | | Own actions | Yes |

Sidebar groups (Daily · Catalog · Supervisor · Admin), the top bar, and the right panel are defined in `design-language.md` (App shell). Lock and Sign out are in the user menu at the bottom of the sidebar.

## Screens

### Sign-in and lock
- **Sign-in:** centered card with the company logo, **Username** and **Password** fields, **Sign in** button, and the line "Forgot your password? Ask your Supervisor to reset it." On a registered store computer, a "Recent users on this computer" row of name chips appears above the form; tapping a chip fills the username.
- **Choose a new password:** shown at first sign-in and after a reset; nothing else is reachable until it is done. Shows the password rule in one line.
- **Lock screen:** after idle time; shows the signed-in user's name and a password field, plus "Sign in as someone else".
- **Locked account message:** "Too many attempts. Try again in 15 minutes or ask your Supervisor."
- Password re-prompt dialog before approvals, payables, settings, and users when the last entry is older than 15 minutes.

### Cashier lookup (also the first tab for everyone)
One very large search box (scan or type: name, Product Code, barcode, Persian or English). Filters: AI category. Result card: name (EN + FA), unit size, **Selling Price** (large, before tax), tags: **Taxable**, offer pill ("2 for $5"), **New price pending** (amber). Shows the price to charge now; pending price appears only as a tag/secondary text. No costs, no stock numbers for cashiers.

### Floor Worker home
Layout in `design-language.md` (Key layouts). KPI row: My drafts · Needs review · Offers to confirm · Expiring soon. Then today's suppliers with open returns, open shorts, and my notes. Quick actions: New invoice, New return, Print labels, Add note.

### Supervisor dashboard
Exact layout in `design-language.md` (Key layouts): four KPI cards, then actionable lists (Approvals queue, Alerts, Recent invoices, Returns, Supplier balances) and the right panel (Notes for Supervisor, Activity). The priority order of `requirements.md` §17 decides what appears first inside these lists. No wall of zero counters. The branch pill filters everything.

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
Three tabs: **Products · Waitlist (count) · Templates**.
- **Products:** search pill, filter chips (Arrived today, Price changed recently, On offer, pricing category, AI category, supplier), a scrollable table (name EN + FA, Product Code, price, offer pill, copies stepper, **Add to waitlist**), "Add all filtered". Products already on the waitlist show "On waitlist (2)".
- **Waitlist:** table of waiting items (copies editable, remove), template picker, A4 preview with clickable starting slot (used slots grayed), live bilingual label preview, **Print** (primary). After printing: "Did the labels print correctly?" Yes / No.
- **Templates:** saved presets; **New template** form (name; width, height, four margins, two gaps, two calibration offsets as narrow mm inputs); **Print test alignment page**.

### Returns
Supplier selector (search) → immediately lists that supplier's **open returns** → select lines → **Record pickup** (supplier representative name required; optional photo; note) → resolution panel (types in `requirements.md` §12; for replacements: product, qty, date, fully/partially). History tab with filters.

### Expiry (Date tracking)
Table: product, branch, date, type, days left, supplier/invoice. Filters: expiring soon (default 30 days), expired, AI category. Row action **Cleared**.

### Notes
Tabs for each notebook the user can read: built-in (**To order · Store use · For Supervisor**) then custom notebooks, each with an unread count pill. Fast add form showing only the fields the notebook enables. Search across readable notebooks. Supervisor: **New notebook** button and a notebook settings dialog (name EN/FA, branch, read/add roles, fields, status, notify).

### Stock
Per-branch stock on hand (estimate until register integration), movement history per product, **Stock count** flow with variance, store-use entry.

### Suppliers
Defined in `requirements.md` §21.
- **Overview table:** supplier · status pill (Confirmed / Proposed) · last delivery · deliveries this month · open returns · open shorts · payment terms · sales rep and phone; **Supervisor only:** balance · overdue · next due date. Toolbar: search, branch pill, filter chips (Overdue, Open returns, Open shorts, Waiting for confirmation). Row click opens the supplier page.
- **Supplier page:** header with name, status, contact, sales rep, payment terms, and four KPI cards (Last delivery · Deliveries this month · Open returns · **Balance** for Supervisor, Open shorts for Floor Worker). Tabs: Overview · Invoices · Products supplied · Returns and credits · Shorts · Price alerts · Payments (Supervisor only) · Notes.
- Floor Workers never see money columns, the Balance card, or the Payments tab. New suppliers show **Proposed** until confirmed.

### Payables (Supervisor)
Supplier list with balance per branch; detail with ledger (invoices, credits, payments with cheque number and date, adjustments, opening balance, disputes with notes); **month-end summary** (print/CSV).

### Users and devices (Supervisor)
Users: list (name, username, role, branch, status, last sign-in); **New employee** (name, username, role, branch(es); the app generates a temporary password shown once); **Reset password**; **Unlock**; **Deactivate** immediately. Devices: register the store computer.

### Settings (Supervisor)
Two-column layout: a settings menu on the side (groups from `requirements.md` §22: Company, Branches, People, Catalog, Pricing and approvals, Offers, Taxes, Receiving, Returns, Date tracking, Labels, Notebooks, Notifications, Modules, Data) and the selected group's cards on the other side. Each group: short description, settings in cards, **Save changes** in a sticky bar when something changed, and a "Changed by … on …" line linking to History.
- **Branches:** table (name, address, phone, status) + **Add branch**, edit dialog, deactivate.
- **Pricing categories:** table + **Add category**; edit dialog with cost divisor, rounding rule (bands with editable thresholds and endings, or "always up to next .99"), special corrections list, taxable, date-tracking prompt, minimum margin; a live **price tester** beside it (cost in → each calculation step → final price, values right next to their labels).

### History
Table: time, person, branch, action, item, before → after, with filters (person, branch, type, date range). Row action **Revert** (Supervisor, reversible entries only) with a confirmation dialog showing what will change.

## Responsive behavior
Desktop/large store monitor is the primary target; tablet and phone browsers must work (sidebar collapses; tables scroll inside their container; forms become one column; camera upload works for invoice photos).
