# Requirements v1

Sources: Super Arzon's workflow notes, the owner's brainstorm, and recorded planning decisions. Historical **(assumed)** labels identify defaults adopted under Ali's 2026-10-06 delegation; remaining inputs are listed in `open-questions.md`.

On 2026-10-06 Ali confirmed Toronto, Ontario, Canada; CAD; 13% HST and accepted the developer's resolutions of the document gaps. Business time is `America/Toronto` (including daylight-saving changes); timestamps are stored in UTC. Decisions and operational policies are in `decisions.md` and `return-policy.md`.

## 1. Purpose and phases
Give a supermarket an **inventory and receiving system** where none exists, with price calculation, approvals, offers, labels, expiry tracking, supplier returns, supplier balances, and internal notes.

| Phase | Content |
|---|---|
| 0 | Step 0.1: runnable project foundation with a placeholder web page and API health checks. Step 0.2: clickable browser-only prototype to pitch the owner. No operational business workflows yet. |
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
Three roles. Everyone signs in with their own account. A shared in-store computer is expected; see §16.

| Capability | Cashier | Floor Worker | Supervisor |
|---|:-:|:-:|:-:|
| Look up products and prices (including "Pending" labels) | Yes | Yes | Yes |
| See supplier unit costs | No | Only on invoices they handle | Yes |
| See margins or supplier catalog costs | No | No | Yes |
| Create/edit products (name, unit size, barcode); propose new products | No | Yes | Yes |
| Approve new products, price changes, tax-profile changes, barcode conflicts, manual overrides, below-margin prices | No | No | Yes |
| Create invoices, upload PDFs/photos, save drafts, post invoices | No | Yes | Yes |
| Quick-add a supplier (proposal) | No | Yes | Yes |
| Confirm a new supplier | No | No | Yes |
| Mark an invoice line Short / mark it Resolved | No | Yes | Yes |
| Close a short as "not delivered" | No | No | Yes |
| Create returns, record pickup/replacements, submit resolution claims | No | Yes | Yes |
| Cancel an unsettled return; request cancellation of a settled return | No | Yes | Yes |
| Post or reverse return credits, payments, financial compensation | No | No | Yes |
| Create/stop offers and mix-and-match; confirm AI-suggested offers | No | Yes | Yes |
| Create label templates and print labels | No | Yes | Yes |
| Record store-use, to-order items, notes for the Supervisor | No | Yes | Yes |
| Record stock counts and adjustments | No | Yes (logged) | Yes |
| Payables, supplier balances, payments, credits, opening balances | No | **No** | Yes |
| Manage users, devices, settings, pricing rules | No | No | Yes |
| Supervisor dashboard, all branches | No | No | Yes |

Floor Workers never see supplier balances or payables. Cashier = lookup only **(assumed: cashiers cannot add notes)**.
Costs on an invoice are visible only to its creator, assigned receiver/reviewer, and Supervisor within their permitted branch. Return claims may include the quantity, reason, and supplier's supporting document; ledger amounts and margins are Supervisor-only. Settled-return cancellation requires Supervisor review so stock and previous compensation cannot be counted twice.

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
- Seed tax profiles are `non_taxable` (0%) and `hst_13` (13%). Category taxability proposes a profile; the product's Supervisor-approved tax profile is authoritative. A category alone cannot establish the tax treatment of every product. Rates and profiles remain editable per company; preserve the profile/rate snapshot on each posted invoice line.
- Minimum-margin thresholds are per category: Grocery and Grocery (Taxable) 25%, Rice 20%, Kitchenware 25%. A breach requires Supervisor review even when the selling price is unchanged; it does not block receiving or silently change prices. Supervisor keeps the approved price with a reason or proposes a manual override. An empty category threshold disables the margin check; identical review contexts are deduplicated as specified in `pricing-engine.md`.

## 6. Approvals
Every calculated selling-price change needs Supervisor approval.

| Event | Approval |
|---|---|
| New product | Always |
| Sales-tax profile change | Always |
| Barcode conflict | Always |
| Manual selling-price override | Always |
| Calculated price below the minimum margin, including unchanged price | Always; price change or margin-only review |
| Ordinary calculated price change | Yes (Supervisor review) |
| Ordinary supplier cost change only | No, if selling price is unchanged and no minimum-margin breach |

**Pending prices:** a proposed price is visible in the Products section, clearly labeled **Pending**, so workers and cashiers know it still has to be confirmed. The cashier keeps charging the **last approved price** and never sells at a pending lower price. **(assumed)** For a brand-new product with no approved price, the lookup shows the proposed price labeled "Pending: confirm with a Supervisor before selling". **(assumed)**

When approving, the Supervisor chooses **Apply to all branches** (default) or **This branch only**.
For an unchanged-price margin review, **Keep approved price** acknowledges that branch's received cost/price/rule context with a reason; it creates no price update or offer change. **Propose manual override** creates the usual price-change proposal. Margin review never blocks invoice posting, and cashier lookup retains the last approved price.

## 7. Same-supplier lower price and different-supplier price
When a received item's unit cost is **lower than the last cost from the same supplier**, the Floor Worker (or invoice reviewer) is asked:
1. Is the expiry date the same as the stock already on hand?
2. If **yes**: how many units are left that were bought at the higher cost?
3. If **no**: what are both expiry dates?

The answers plus the item and both costs become an **alert** for the Supervisor, who marks it **Taken care of** or **Still pending**.

Use the last posted, non-voided receipt of that supplier product **in the same branch** as the comparison; no prior receipt means no lower-cost comparison. If dates are not tracked, the worker can answer **Dates not tracked**; if no old stock remains, **No previous stock**; if information is unavailable, **Unknown** with a note. These answers create an alert and allow posting; never require an invented date or quantity.

When the same item arrives from a **different supplier** at a different price, register it under that supplier (supplier name, SKU, etc.) and still raise an alert to the Supervisor. Compare posted receipts in the same branch and identify each supplier and receipt in the alert.

## 8. Offers and mix-and-match
- Offers are **fixed by selling price**. Default mapping **(assumed from the arithmetic; configurable)**: $1.99 → "3 for $5", $2.99 → "2 for $5", $3.99 → "2 for $7".
- A product has **at most one effective active offer in a branch** at a time. A branch offer replaces the company offer there; a branch price override never inherits an offer for a different selling price. Only the effective offer is shown, printed, or applied.
- **No approval is needed** for offers. Floor Workers and Supervisors can create and stop them.
- Start and end dates are **optional**. An offer can stay active until manually stopped.
- **Mix-and-match** uses **pools per company, branch, and offer definition**: all eligible products in one store's "2 for $5" pool can combine regardless of category or supplier. Pools never combine companies, branches, currencies, or different offer definitions.
- **AI-suggested offers:** when a product's price becomes effective at $1.99, $2.99, or $3.99 and it has no offer yet, create a suggestion task for the Floor Worker: confirm the offer and whether it joins the mix-and-match pool. It waits for the worker's confirmation.
- Offers follow the scope of the price they belong to (company default or a branch override).
- When a price changes, stop any incompatible offer in the affected scope, including when the new price has no configured mapping. Suggest a newly mapped offer for worker confirmation; never silently switch to it. Price changes and branch override removal re-evaluate effective offers for every affected branch.
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
- **Shorts:** record invoiced, delivered, and missing quantities separately, in units after case conversion. Add the delivered quantity to stock immediately; deduct only missing units' cost and proportional tax from the payable total. Each later partial delivery adds only the newly received quantity and restores only its withheld payable amount. Cumulative delivery cannot exceed the invoiced quantity; the Supervisor may close the remaining missing quantity as **Not delivered** without another deduction or credit. See `workflows.md` for allocation and rounding.
- **Tax discrepancy:** if subtotal + tax ≠ final total, or tax does not match taxable lines at the configured rate (within a tolerance), raise a Supervisor alert (does not block posting).
- Posting an invoice: adds stock movements, creates price proposals and alerts, creates the invoice entry in that branch's supplier balance. Posted invoices are locked; only the Supervisor can correct them, with an audit entry.
- **Corrections and voids:** preserve the original file and postings. Supervisor previews linked stock, shorts, credits, allocations, and downstream movements, then creates compensating stock/financial entries with a reason. If stock has been consumed or replaced, resolve its actual disposition first; never blindly reverse quantities or delete history. A corrected invoice links to the original and cannot post twice.
- **AI reading:** an uploaded PDF/photo is read automatically into structured lines (see `data-model.md`). A person must review and confirm before posting. Failures fall back to manual entry.

## 12. Supplier returns
Flow:
1. Supplier arrives. Floor Worker selects/searches the supplier.
2. The app immediately shows that supplier's **open returns** (for the worker's branch).
3. Worker selects the items being picked up and records the pickup.
4. A pickup needs the **supplier representative's typed name**, actual quantities, and a signed **paper pickup slip** (required). Store a scan/photo or reference to its retained paper original; goods must not be handed over without the slip. The app records the signed-in employee who submitted it. Item photos are optional.
5. Resolution types: **Credit on current invoice · Credit on a later invoice · Replacement product received · Cash or other compensation · No compensation · Cancelled.**
6. Completed and cancelled returns stay in history.

Rules:
- A supplier can pick up a return **without any new invoice**.
- **One return record may contain several product lines.**
- A return is credited **once**, on a **single** invoice with a supplier credit note/document; duplicate document references or postings are blocked. Floor Workers submit claims; only a Supervisor posts the ledger credit. Keep the signed pickup slip and credit note even after cancellation.
- **Replacement product received:** record product, quantity, date, receiving employee, supplier representative, optional photo/note, and whether it **fully or partially** resolves the return. **No money is added to Payables.**
- Damaged/set-aside items leave sellable stock when the return is created. Cancellation restores only original units physically present and confirmed safe and sellable by the receiving employee, up to the quantity previously removed and not already restored. After pickup, record actual recovery before restoring anything; the supplier still holding goods produces **zero** restored stock. Damaged goods remaining on-site stay excluded.
- Cancellation never automatically reverses replacements or credits. If any settlement has been received/posted, the Supervisor must review a cancellation request and append justified reversals or document retained compensation before closing it. Worker cancellation of an unsettled return needs no approval, but always requires a reason and actual stock disposition.
- Replacement and original recovered quantities are recorded separately. Each resolution states which original return lines/quantities it settles; cumulative settlement cannot exceed them. Outstanding quantities remain open; a Supervisor may close them as **No compensation** with a reason.
- Follow the supplier-specific written return terms and evidence checklist in `return-policy.md`. Record disputed/missing documents and escalate to the Supervisor; never assume a pickup automatically means the supplier has accepted a credit.

## 13. Payables (Supervisor only)
Purpose: organize each supplier's balance so the Supervisor can enter it into QuickBooks manually. No QuickBooks integration now.
Record, per branch and supplier: supplier invoices, supplier credits, payments made outside the app, cheque number, payment date, partial payments, manual adjustments, **opening balance** at first deployment, notes and disputes.
Show: balance, open invoices, overdue invoices, month-end summary that is printable and exportable (CSV). Floor Workers and Cashiers must never see any of it.
Payments and credits are allocated to specific open invoices in the same company, branch, supplier, and currency. The default is oldest due invoice first (then invoice date/id), with a Supervisor preview and editable allocations. Overpayments remain visible as unapplied supplier credit. The net ledger balance and per-invoice outstanding amounts must reconcile; reversing an allocation appends history rather than deleting it.

## 14. AI categories
AI assigns each product a flexible **AI category** from its name (beans, juices, meat, spices…), used to **filter product lookup**. It is editable by Floor Workers and Supervisors and separate from the four pricing categories.

## 15. Notes and logs (replaces paper notebooks)
Three simple sections, each entry stamped with author, branch, and time:
- **To order**: "we're out of this" reminders. Status open / ordered.
- **Store use**: items taken from the floor for the store's own use. Creates a stock movement.
- **Notes for the Supervisor**: reminders and hand-over notes (status open / seen / done).
The Supervisor is notified of new items.

## 16. Sessions and the shared store computer
- Per-employee accounts. A **registered store computer** supports quick sign-in: choose name + short PIN. PIN sign-in works **only** on registered devices.
- Auto-lock after idle time (setting, default 5 minutes **(placeholder)**). Every action is stamped with the signed-in user, so forgotten sign-outs must not misattribute work.
- Approvals, payables, settings, and user management require the full password even on a registered device.
- The Supervisor's laptop signs in with email/password from anywhere.

## 17. Supervisor dashboard
Order of importance: approvals waiting (new products, price changes, barcode conflicts, supplier proposals) → same-supplier lower-price alerts → cross-branch price conflicts → tax discrepancies → AI invoices waiting for review and AI failures → open shorts → open supplier returns and returns waiting for credit → upcoming expiries → overdue invoices and supplier balances → recent posted invoices → employee activity. (No "labels waiting to print"; there is no label queue.)

## 18. Terminology (use exactly)
Invoices (subtitle: "Deliveries and supplier invoices") · Floor Worker · Kitchenware · Grocery (Taxable) · Returns (subtitle: "Supplier returns and credits") · Product Code · Selling Price · Date tracking (Expiry or Best before). Persian equivalents are stored as translations and reviewed by Ali.

## 19. Platform
Web app first (responsive; works on desktop, tablet, phone browsers; installable later). Native phone and desktop apps are later options. Hosting on AWS later; development happens locally in containers.

## 20. Non-functional
Fast tables with search and filters; keyboard-friendly entry; clear audit trail; daily backups; data export; no data loss on refresh (drafts auto-save); accessible contrast; works with a barcode scanner (keyboard wedge) and a document scanner or phone camera for invoice images.
