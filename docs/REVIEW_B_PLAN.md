# Pull request B plan — updated after A2 review (2026-10-07)

**Status:** plan only. Build GLOBAL, SCREENS and PROOF of Ali's A2 request in A2; do not start B while A2 is being reviewed. Suppliers overview/detail is now part of A2, not deferred B. The changed B requirements below are items 40–43 of the uploaded A2 request; they supersede older wording only where stated. The remaining previously planned B workflows stay deferred.

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

When authorized, the B demo will implement **Company**, **Branches**, **Pricing categories** under Catalog (including rounding rules, special corrections, margin and live price tester), **Offers**, **Notebooks** under Notes, **Labels** under Returns/date tracking/labels, and **Modules**. Other groups/areas display their planned structure only, with no false claim that unfinished settings save changes. Catalog categories and new branches come from editable configuration; adding them must work without new code. Actual edits persist, are scoped, and record reversible History.

requirements §22 and screens Settings have been updated to this order and subset. B does not add a backend, real account administration or real AI credentials.

## 43. History and Undo: revised timing and placement

- Place the charcoal action toast at **bottom-left** in English, **bottom-right** in Persian, with action text and an **Undo** link.
- Each toast stays for **5 seconds of unpaused time**. Hover pauses only that toast, and leaving resumes its remaining time. New actions never reset an earlier timer.
- Stack newest on top. Each is independently timed, so normally the oldest bottom toast disappears first; hovering one may change that order. Show at most **3** visible toasts and **+N more** for additional active items. Hidden extra items keep their own timers.
- Record reversible actions with before/after, actor, branch and time; Undo appends an Undone action. Supervisor History/Revert shows a confirmation preview and detects intervening edits. Nothing is erased.
- Posted invoices, stock movements, financial entries and prints use recorded corrections rather than simple Undo; preserves quantity and money history.
- A2's product-edit provenance/reversible entries are the data groundwork only. Active History/Revert/Undo interface ships in B. The old **10 seconds / bottom center** default is superseded in requirements §23, workflows §15 and design-language Toast/Undo toast.

## Deferred scope and review proof

The earlier B plan for simulated AI progress steps and highlighted low-confidence fields remains deferred; no real AI call is introduced. Standalone Stock and Users and devices are deliberately outside A2; branch stock remains visible on product pages and existing sign-in/lock/password behavior works. Future minimal user-management/Stock scope needs a separate authorized slice.

After B is authorized, validate role and branch isolation, exact millimeter printing, persistent notebooks/settings, independent Undo timers and correction rules, plus pricing regressions and English/Persian/light/dark/phone screenshots. None of these plan changes implies that B has been built or approved.
