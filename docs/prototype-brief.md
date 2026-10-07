# Prototype brief (Phase 0)

**Purpose:** a clickable demo to show the Super Arzon owner and win initial approval. It runs entirely in the browser with **no backend, no database, no real AI**. It must look and feel like the real product, because the screens and design will carry over.

## Constraints
- Frontend only, in `prototype/`. Same stack as the real app: React + TypeScript + Vite + Tailwind + shadcn/ui, i18next (English and Persian with RTL).
- Data comes from `seed/demo-data.json` and `seed/arzon-config.json`, held in memory (a small store such as Zustand). Persist to browser storage so a refresh does not wipe the demo, and provide a visible **Reset demo** button.
- The pricing engine is real: implement `pricing-engine.md` in TypeScript (Decimal library), run **every case** in `seed/pricing-test-cases.json` as unit tests, and use it live in the demo (change a cost → price recalculates).
- Follow `design-language.md` (v2) exactly, including its Hard rules, and match the style of `docs/design-references/`; use `assets/arzon-logo.png` directly on the white sidebar.
- Honesty: show a small, non-intrusive **"Demo: AI invoice reading is simulated"** note on the upload screen. No real supplier or customer data anywhere.
- Static build deployable to any static host, or runnable locally with `npm run dev` for a meeting. If hosted, use an unlisted URL.
- Keep it light: no animations beyond simple transitions; fast on a laptop.

## Demo users (role switcher)
A **username and password** sign-in screen (layout in `design-language.md`) with demo accounts from the data file: **supervisor, floorworker, cashier**, all with the demo password shown in a small hint under the form ("Demo accounts: … / password demo1234"). A fourth account, **newemployee**, signs in with a temporary password and must choose a new one, to show the first-sign-in flow. A "recent users on this computer" row appears after the first sign-in. No PIN pad. Inside the app, switching role and resetting the demo happen in a small **Demo** menu in the top bar (never as labeled form fields). The Supervisor uses the branch pill (Branch 1/2/3). The language toggle (EN | فا) flips RTL; the theme toggle switches light/dark.

## The moments to build (in this order)
1. **Cashier lookup.** Search "sumac", "سماق", a Product Code, or a barcode. Big price, Taxable tag, offer pill, "New price pending" tag on Lavash Bread.
2. **Receive an invoice (AI reading).** Floor Worker uploads a PDF/photo. Simulated mode must look exactly like the real product: a progress state with steps ("Reading the invoice" → "Finding products" → "Calculating prices"), the original document shown beside the lines, and **low-confidence fields highlighted** (use `confidence` in the demo data; below the setting, default 0.80, the field gets a soft amber highlight and a tooltip "Please check"). Then the **review screen** prefilled from `demo_invoice` in the data file: lines matched to products, calculated selling prices computed live by the engine, status badges, a date-tracking control only for Grocery lines, Save as draft and Post invoice. Editing a unit cost recalculates the price immediately.
3. **Same-supplier lower price.** The Sour Cherry Juice line (1.95 → 1.80) asks the three expiry questions; answers create an alert on the Supervisor dashboard.
4. **Short item.** Mark 4 potato chips as Short: the invoice total shows the deduction and the net payable (`payable_after_open_shorts`); resolving restores it.
5. **Approvals.** As Supervisor: new product (Dried Barberries) and the Lavash price change (1.99 → 2.99) appear in Approvals; approve one for **All branches**, one for **This branch only**; the cashier lookup reflects it.
6. **Cross-branch price conflict.** Black Tea: Branch 1 $6.49 vs Branch 2 $6.99 appears on the dashboard with **Mark as intentional** and **Apply to all**.
7. **Offers.** After approval, the AI suggestion "Confirm offer: 2 for $5" appears for the Floor Worker with the mix-and-match toggle; show a pool page where juice and chips share "2 for $5".
8. **Labels (must really print).** Products tab with search and filters (Arrived today, Price changed recently, On offer, categories, supplier) → add products to the **waitlist** with copies → create "Template 1" (sizes, margins, gaps, calibration offsets) → A4 preview with the first four slots grayed and printing from slot 5 → bilingual label preview (logo, name EN + FA, price, offer, Product Code, unit size, Taxable) → **Print** opens the browser print dialog at exact size (or Save as PDF), multiple pages if needed → "Did the labels print correctly?" removes printed items. Include the test alignment page. Use `last_received_relative_days` from the demo data for "Arrived today".
9. **Returns.** Select Fresh Valley Foods → its open return appears immediately → record pickup (type representative name) → choose resolution; show a replacement-received example that does not affect Payables.
10. **Expiry list.** Lavash (5 days) and Sour Cherry Juice (25 days) as expiring soon; **Cleared** removes one.
11. **Notes and notebooks.** Built-in To order, Store use, For Supervisor (unread badge), plus the demo custom notebook "Deli temperatures" from the data file; as Supervisor, create a new notebook live and add an entry as Floor Worker.
12. **Payables.** Supervisor-only: a supplier balance with the invoice, shorts deduction, a payment with cheque number, and a month-end summary view. Show that the Floor Worker menu has no Payables.
13. **Supervisor dashboard** tying it together in the order from `requirements.md` §17.
14. **Suppliers overview** (`requirements.md` §21): table with last delivery, deliveries this month, open returns, open shorts, payment terms, sales rep; Supervisor also sees balance, overdue, next due date. Supplier page with tabs. Switch to Floor Worker to show the money columns disappear.
15. **Settings.** Working groups: Branches (add a fourth branch, edit details), Pricing categories (add a category with its own divisor and rounding; edit one and watch prices change; price tester), Offers (mappings), Notebooks, Labels. Other groups visible with their structure from `requirements.md` §22.
16. **History and undo.** Stop an offer → **Undo** toast restores it. As Supervisor, open History, find a price approval or a product name change, and **Revert** it.

Out of the prototype: real auth, real storage, and real AI reading **until step 0.3** (see below). User management can stay a simple list with New employee and Reset password. Printing must be real (browser print at exact size).

## Definition of done
- All 16 moments work for the right role; role menus are correct; sign-in uses username and password, and the first-sign-in password change works.
- Pricing tests pass; changing a divisor in Settings changes prices live.
- English and Persian both work with correct RTL.
- Runs offline after load; Reset demo works; no console errors.
- A short `prototype/README.md` explains how to run, reset, and deploy it.

## Demo script (8 to 10 minutes)
1. **Open as Cashier (30 s).** "Anyone at the register can look up a price in a second, in English or Persian. The price shown is always the approved one; if a new price is waiting for a decision, they see a tag."
2. **Switch to Floor Worker; receive an invoice (2 min).** "Drop in the supplier's PDF or a photo. The app reads it into lines. The system calculates every selling price with your own rules, so nobody does it by hand." Edit a cost to show the price update.
3. **Short and lower price (1.5 min).** "If the supplier forgot items, mark them short; the amount comes off the invoice automatically. If a supplier sells us the same item cheaper, the worker answers two quick questions and the Supervisor is alerted."
4. **Switch to Supervisor; approvals and dashboard (2 min).** "Every price change waits for approval. Approve for all branches or just one. If branches ever differ, you get an alert instead of finding out at the register."
5. **Offers and labels (2 min).** "Offers like 2 for $5 are suggested automatically; mix-and-match works across any products." Filter Labels by "Price changed recently", add them to the waitlist, print a real sheet: "English and Persian, your own sheet sizes, starting wherever the last sheet stopped."
6. **Returns, expiry, notes (1 min).** "When a supplier arrives, their open returns are right there. Expiring items are listed before they become a problem. The notebook becomes a searchable log."
7. **Suppliers and payables (1 min).** Open Suppliers: "Every supplier at a glance: last delivery, open returns, shorts." Then as Supervisor: "and only you see the balances, overdue amounts and payments, ready for QuickBooks."
8. **Settings and history (1 min).** Add a branch, add a pricing category, change a divisor and watch prices update: "Your rules live in settings, not in code." Stop an offer, press Undo: "Mistakes can always be undone or reverted."
9. **Close.** The roadmap: Phase 1 core app; later the cash register connection (live stock, loss detection) and an online food-ordering site.
If real AI reading is ready (step 0.3), ask the owner for any invoice from today's delivery and read it live; otherwise say plainly that the reading is simulated. Do not quote prices or timelines in the demo itself.

## Step 0.3: Real AI invoice reading for the demo (after the design work)
- Add one small server piece (for example, a single serverless function or a tiny local server) whose only job is to send the uploaded invoice to an AI provider and return the extraction JSON from `data-model.md`. The AI key lives **only** there, never in browser code or the repository.
- Before building it, list 2–3 vision-capable AI providers with the estimated cost per invoice and trade-offs, recommend one, and wait for Ali's choice. Set a monthly spending cap on the provider account.
- The browser sends the file, shows the same progress steps, and fills the same review screen with real lines and real confidence values. Matching, pricing, and approvals stay in the existing app logic; the AI never writes prices or stock directly.
- Keep the simulated mode: a **"Simulated reading"** switch in the Demo menu, and an automatic fallback to it (with a calm message) if the real call fails or takes longer than 30 seconds.
- Rehearse with 5–10 invoices of different layouts that Ali is allowed to use, and list what went wrong and what was fixed. Never commit real invoices to the repository.
