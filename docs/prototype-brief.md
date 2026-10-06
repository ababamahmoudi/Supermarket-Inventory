# Prototype brief (Phase 0)

**Purpose:** a clickable demo to show the Super Arzon owner and win initial approval. It runs entirely in the browser with **no backend, no database, no real AI**. It must look and feel like the real product, because the screens and design will carry over.

## Constraints
- Frontend only, in `prototype/`. Same stack as the real app: React + TypeScript + Vite + Tailwind + shadcn/ui, i18next (English and Persian with RTL).
- Data comes from `seed/demo-data.json` and `seed/arzon-config.json`, held in memory (a small store such as Zustand). Persist to browser storage so a refresh does not wipe the demo, and provide a visible **Reset demo** button.
- The pricing engine is real: implement `pricing-engine.md` in TypeScript (Decimal library), run **every case** in `seed/pricing-test-cases.json` as unit tests, and use it live in the demo (change a cost → price recalculates).
- Follow `design-language.md` exactly; use `assets/arzon-logo.png` on a white tile in the sidebar.
- Honesty: show a small, non-intrusive **"Demo: AI invoice reading is simulated"** note on the upload screen. No real supplier or customer data anywhere.
- Static build deployable to any static host, or runnable locally with `npm run dev` for a meeting. If hosted, use an unlisted URL.
- Keep it light: no animations beyond simple transitions; fast on a laptop.

## Demo users (role switcher)
A "Sign in as" screen with three demo users from the data file: **Demo Supervisor, Demo Floor Worker, Demo Cashier**, each with a PIN pad that accepts the demo PIN. A branch switcher for the Supervisor (Branch 1/2/3). A language toggle (English / فارسی) that flips RTL.

## The moments to build (in this order)
1. **Cashier lookup.** Search "sumac", "سماق", a Product Code, or a barcode. Big price, Taxable tag, offer pill, "New price pending" tag on Lavash Bread.
2. **Receive an invoice (simulated AI).** Floor Worker uploads any PDF/photo (the file is only displayed), a 2–3 second "Reading invoice…" state, then the **review screen** prefilled from `demo_invoice` in the data file: lines matched to products, calculated selling prices computed live by the engine, status badges, a date-tracking control only for Grocery lines, Save as draft and Post invoice. Editing a unit cost recalculates the price immediately.
3. **Same-supplier lower price.** The Sour Cherry Juice line (1.95 → 1.80) asks the three expiry questions; answers create an alert on the Supervisor dashboard.
4. **Short item.** Mark 4 potato chips as Short: the invoice total shows the deduction and the net payable (`payable_after_open_shorts`); resolving restores it.
5. **Approvals.** As Supervisor: new product (Dried Barberries) and the Lavash price change (1.99 → 2.99) appear in Approvals; approve one for **All branches**, one for **This branch only**; the cashier lookup reflects it.
6. **Cross-branch price conflict.** Black Tea: Branch 1 $6.49 vs Branch 2 $6.99 appears on the dashboard with **Mark as intentional** and **Apply to all**.
7. **Offers.** After approval, the AI suggestion "Confirm offer: 2 for $5" appears for the Floor Worker with the mix-and-match toggle; show a pool page where juice and chips share "2 for $5".
8. **Labels.** Pick products, create "Template 1" (width/height/margins/gaps), choose the starting slot on an A4 preview where the first four slots are already used, show a bilingual label preview (logo, name EN + FA, price, offer, product code, unit size, Taxable). Printing can open the browser print dialog.
9. **Returns.** Select Fresh Valley Foods → its open return appears immediately → record pickup (type representative name) → choose resolution; show a replacement-received example that does not affect Payables.
10. **Expiry list.** Lavash (5 days) and Sour Cherry Juice (25 days) as expiring soon; **Cleared** removes one.
11. **Notes.** To order, Store use, For Supervisor, with the Supervisor's unread badge.
12. **Payables.** Supervisor-only: a supplier balance with the invoice, shorts deduction, a payment with cheque number, and a month-end summary view. Show that the Floor Worker menu has no Payables.
13. **Supervisor dashboard** tying it together in the order from `requirements.md` §17.

Out of the prototype: real AI, real printing precision, real auth, real storage, user management screens beyond a static list, settings beyond showing the pricing categories table (make that screen editable so changing a divisor visibly changes prices: it proves the app is configurable for other supermarkets).

## Definition of done
- All 13 moments work for the right role; role menus are correct.
- Pricing tests pass; changing a divisor in Settings changes prices live.
- English and Persian both work with correct RTL.
- Runs offline after load; Reset demo works; no console errors.
- A short `prototype/README.md` explains how to run, reset, and deploy it.

## Demo script (8 to 10 minutes)
1. **Open as Cashier (30 s).** "Anyone at the register can look up a price in a second, in English or Persian. The price shown is always the approved one; if a new price is waiting for a decision, they see a tag."
2. **Switch to Floor Worker; receive an invoice (2 min).** "Drop in the supplier's PDF or a photo. The app reads it into lines. The system calculates every selling price with your own rules, so nobody does it by hand." Edit a cost to show the price update.
3. **Short and lower price (1.5 min).** "If the supplier forgot items, mark them short; the amount comes off the invoice automatically. If a supplier sells us the same item cheaper, the worker answers two quick questions and the Supervisor is alerted."
4. **Switch to Supervisor; approvals and dashboard (2 min).** "Every price change waits for approval. Approve for all branches or just one. If branches ever differ, you get an alert instead of finding out at the register."
5. **Offers and labels (1.5 min).** "Offers like 2 for $5 are suggested automatically; mix-and-match works across any products. Labels print in English and Persian on your own sheet sizes, starting wherever the last sheet stopped."
6. **Returns, expiry, notes (1 min).** "When a supplier arrives, their open returns are right there. Expiring items are listed before they become a problem. The notebook becomes a searchable log."
7. **Payables (30 s).** "Supervisor only: one clean balance per supplier, ready for QuickBooks."
8. **Settings (30 s).** Change a pricing divisor and show prices update: "Your rules live in settings, not in code."
9. **Close.** The roadmap: Phase 1 core app; later the cash register connection (live stock, loss detection) and an online food-ordering site.
Say plainly that AI reading is simulated in the demo. Do not quote prices or timelines in the demo itself.
