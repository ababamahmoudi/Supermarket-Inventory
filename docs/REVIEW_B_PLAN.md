# Pull request B scope — authorized after A2 approval (2026-10-08)

**Status:** Ali approved A2 on 2026-10-08 and authorized **Parts 1, 2 and 3 together in one pull request B**, without a separate review round between them. First apply the ten A2 leftover fixes, then build Prompt 3C items 26–29 with items 40–43 below and the new Supervisor manual entry in items 44–47. Changes stay in `prototype/` and `docs/`. Part 4, the foundation/prototype CI repair, is a separate small pull request restricted to `.github/workflows/`, `Makefile` and `scripts/`. This scope replaces the earlier A2 approval pause; it does not claim the implementation has passed validation yet.

## Part 1. A2 leftovers first

1. Make every toolbar control 44px tall, fit complete select labels, add search icons/placeholders, and remove the Products toolbar/table spacer.
2. Keep pills and branch names on one line.
3. Widen invoice product columns to preserve names/unit sizes; Approved price notes stay one muted line.
4. Purchases, last 8 weeks uses hover amounts and date-axis labels, with no week-total list beneath it; dashboard cards in each row have equal height.
5. Open returns show Record pickup and Cancel return only; resolution follows pickup and the title uses the standard page size.
6. Labels narrower than 50mm omit the logo; other labels show it at least 8mm tall.
7. Review approval dialogs fit their final column, up to 720px or with wrapped headers.
8. Products sortable headers share muted 13px styling/small arrows; Back to Products uses the same arrow as Back to Returns.
9. Counted nouns use i18n plural forms everywhere.
10. Operational page text drops demo disclaimers. Retain AI invoice reading is simulated on Invoices and Demo with fictional data in Demo only.

## 40. Labels: Products search and live A4 template preview

- Add the search pill to the Products tab (both names, Product Code, barcode). Preserve planned branch-aware Arrived today, Price changed recently, On offer, categories/supplier filters and shared label waitlist.
- Beside the template form, display a live A4 preview scaled to fit the screen; stack below the form on phones. Redraw on every numeric change, including dimensions, margins, gaps, calibration offsets and starting slot.
- Show **N labels per sheet (C × R)** using the documented millimeter geometry; highlight the selected starting slot and show used slots clearly. A scaled screen preview never changes the actual A4/label print dimensions.
- Preserve exact-size browser Print/Save as PDF, multiple sheets, test alignment page, no default template, shared branch waitlist, copy editing, Add all filtered and the printed-correctly confirmation. Successfully printed items leave the waitlist only after confirmation.
- A2 owns valid template saving, the address-independent ID helper and label overflow fixes; this live designer is B work.

## 41. Custom notebooks are custom note categories

Only the Supervisor can **create, edit and archive** a notebook definition; restore is allowed and must retain all entries. Configure the fields from requirements §15: English/Persian name, one/all branch scope, read roles, add roles, enabled product/quantity/date/measurement-and-unit fields, status enabled and Supervisor notification.

Allowed readers/contributors can read/add entries within their role/branch/company scope, but cannot edit definitions. Built-in To order, Store use and For Supervisor behavior remains unchanged. Archive hides the notebook from active tabs while authorized search/history can still retrieve old entries. Definition edits and entry actions record actor/date/branch before/after history. Include the fictional Deli temperatures notebook and a permission test using Supervisor/Floor Worker/Cashier.

## 42. Settings: exact order and working subset

Use these groups in precisely this order:

1. Company
2. Branches
3. People
4. Catalog
5. Pricing and approvals
6. Offers
7. Taxes
8. Receiving
9. Returns/date tracking/labels
10. Notes
11. Notifications
12. Modules
13. Data

The authorized B demo implements **Company**, **Branches**, **Pricing categories** under Catalog (including rounding rules, special corrections, margin and live price tester), **Offers**, **Notebooks** under Notes, **Labels** under Returns/date tracking/labels, and **Modules**. Other groups/areas display their planned structure only, with no false claim that unfinished settings save changes. Catalog categories and new branches come from editable configuration; adding them must work without new code. Actual edits persist, are scoped, and record reversible History.

requirements §22 and screens Settings have been updated to this order and subset. B does not add a backend, real account administration or real AI credentials.

## 43. History and Undo: revised timing and placement

- Place the charcoal action toast at **bottom-left** in English, **bottom-right** in Persian, with action text and an **Undo** link.
- Each toast stays for **5 seconds of unpaused time**. Hover pauses only that toast, and leaving resumes its remaining time. New actions never reset an earlier timer.
- Stack newest on top. Each is independently timed, so normally the oldest bottom toast disappears first; hovering one may change that order. Show at most **3** visible toasts and **+N more** for additional active items. Hidden extra items keep their own timers.
- Record reversible actions with before/after, actor, branch and time; Undo appends an Undone action. Supervisor History/Revert shows a confirmation preview and detects intervening edits. Nothing is erased.
- Posted invoices, stock movements, financial entries and prints use recorded corrections rather than simple Undo; preserves quantity and money history.
- A2's product-edit provenance/reversible entries are the data groundwork only. Active History/Revert/Undo interface ships in B. The old **10 seconds / bottom center** default is superseded in requirements §23, workflows §15 and design-language Toast/Undo toast.

## Part 3. Manual entry — items 44–47

- **44 — Suppliers:** Supervisor-only Add supplier on Suppliers and shared invoice quick-add form; details/contact/payment terms, optional address/notes, optional per-branch/as-of opening balances. Supervisor additions are Confirmed; worker invoice-only additions are Proposed, never see balances, and block posting until confirmation. Warn/link similar names. Edit/Deactivate preserves history and excludes deactivated suppliers from new invoices.
- **45 — Products:** Supervisor-only Add product on Products and shared invoice new mode; bilingual names, unit size, category/pricing category, barcode, supplier, date tracking, four-decimal last unit cost, calculated selling price and optional branch starting counts. Manual changes record an override; below-margin prices require confirmation. Assign the next nonreused Product Code, block barcode conflicts and warn/link similar names. Supervisor additions are Active and recorded in History; starting counts append Opening count movements. Worker invoice additions remain pending without opening counts.
- **46 — Manual invoices:** Upload and Manual entry are adjacent choices. Supervisor selects branch/supplier/number/date/terms, adds any product with quantity/cost, and can create both supplier and product from the same draft. Original photo/PDF remains mandatory before posting; drafts can save without it. Existing posting, review, pricing, date and stock/payables logic is retained.
- **47 — Tests:** prove Supervisor supplier Confirmed, worker supplier Proposed and posting blocker until confirmation, Supervisor product Active with next code and opening stock movement, blocked barcodes, and absent standalone Add supplier/Add product/opening balances for Floor Worker/Cashier. Include transaction-level permission/company/branch checks, not only UI visibility.

The required specification-first changes live in requirements §3/4/6/11/21, screens Suppliers/Products/Invoices and workflows §1/2/2A. They are written before implementation.

## Deferred scope and required review proof

**Item 30 (AI reading look and feel) is deferred to Prompt 3D with real AI reading**, so it is built once. B retains existing simulated reading without introducing a provider, server or credentials. Standalone Stock and Users and devices remain outside this slice; product pages retain branch stock and sign-in/lock/password behavior remains working.

Validate role and branch isolation, exact millimeter printing, persistent notebooks/settings/manual drafts, independent Undo timers and correction rules, plus every pricing regression. Send English light, English dark, Persian and phone screenshots of saved template/live preview, waitlist, custom notebook, each working Settings group, History, stacked Undo, Add supplier, Add product, and a manual invoice using both new records. The final B review report records executed results, branch name, exact Ubuntu commands, click-by-click test paths and any unfinished work.
