# C3 review: presentation, navigation and Undo

C3 starts from the approved and merged C2. It keeps receiving, lookup, pricing and printing, and updates their shared presentation. C4 is a separate pull request based on C3; its workflow changes are not included here.

## Run C3 on your Ubuntu computer

1. Open **Files**, open your `Supermarket-Inventory` folder, right-click an empty area and choose **Open in Terminal**.
2. If the demo is already running, return to its terminal and press **Ctrl+C** once.
3. In the repository terminal, run:

```bash
git status --short
git fetch origin feat/prototype-c3-presentation-navigation:refs/remotes/origin/feat/prototype-c3-presentation-navigation
git switch feat/prototype-c3-presentation-navigation
git pull --ff-only origin feat/prototype-c3-presentation-navigation
```

The first command should print nothing. If it lists changed files, preserve them; if Git then refuses to switch, stop and share the exact message. Do not discard your files. Expect Git to report the C3 branch, followed by `Already up to date` or downloaded changes.

4. Activate Node.js 22.22.2 or a newer 22.x version below 23. If you used the earlier Ubuntu guide:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.2
node --version
```

If `nvm` or its file is missing, follow the installation commands in [the prototype README](../prototype/README.md#run-on-ubuntu) first. Docker is not required for this frontend demo.

5. From the repository root, run:

```bash
cd prototype
npm ci
npm run build
npm run preview
```

Expect dependencies to install, TypeScript/Vite to build successfully and a local address on port **5174**. Keep the terminal open. Open **http://localhost:5174** in your Ubuntu browser. If Vite says the port is in use, stop the earlier demo terminal with **Ctrl+C**, then run `npm run preview` again.

## Click-by-click checks

Use **supervisor** and password **demo1234**. The accounts and data are fictional. **Demo → Reset demo → Reset demo** restores the starting business data and discards demo edits; it retains your account and display preferences.

1. **Products:** compare Edit/View with Add product. Click **Columns**, hide an optional column, close the dialog and refresh. Your choice should remain. Reopen **Columns → Reset columns**; Product stays visible. Switch the top-bar theme to dark, then **فا**; text, numbers and action alignment should remain readable.
2. **Suppliers:** the overview starts with useful columns and a short **Deliveries** heading. Optional contact/term columns live in **Columns**. Open a supplier and use **Back to Suppliers**; the search/tab should remain. Repeat with your browser Back button.
3. **Labels:** choose **North York** in the location pill, use the Products tab and select two products. The bottom bar offers Copies and **Add 2 products to waitlist**. Add them, open Waitlist and change an individual product's copies. Printing retains the label dimensions.
4. **Offers:** **Create offer** opens a dialog. Cancel closes it. A current offer's **Stop offer** is red, asks for confirmation and then offers **Undo**.
5. **Notes:** **Add note** opens a dialog; the main page remains the note list. Save a fictional note and try Undo. Custom notebooks retain their access rules.
6. **Dashboard → Approvals:** product, price, location and buttons occupy separate positions. Open **Approve price** to see the summary and grouped location effects. Warehouse is excluded unless its Settings selling option is enabled. Approve/reject remains audited and reversible when safe.
7. **Settings → Branches:** Warehouse's **Sells to customers** is off by default; stores are on. Enable it, save, verify it appears in selling choices, then **Undo** to restore the default.
8. **Orders → New order:** save without a supplier. The error appears beside Supplier. Choose a confirmed supplier; that error clears immediately. An unrelated field change must not erase another field's error.
9. **Invoices / Orders / Returns / Branch requests:** open a detail, use its top Back link and click each breadcrumb. List tabs and filters should return. Browser Back should also restore the list and its scroll position.
10. **Undo:** reversible actions create separate messages for approximately ten seconds at the lower-right (lower-left in Persian). Keyboard focus or hovering pauses only that message. Posting invoices, payments and legal corrections use confirmation and have no Undo.
11. **Phone:** narrow the browser to about 390 pixels using its responsive-device tool, or open the local demo on your phone if your computer's network permits. The sidebar opens from the top-bar button; dialogs and filters fit. Some large tables may scroll inside their own panel on phones.

## Verification and screenshots

Executed results and the final screenshot index will be recorded here after the complete regression run. A planned check is not a passed check.

## Remaining work

C4 covers clean posted documents and corrections, retained original images/PDFs, realistic packs, temporary order items, weighed pricing, manual date tracking, simplified return claims and optional Persian notebook names. These are documented first and implemented on the separate C4 branch. This prototype remains frontend only, with simulated invoice reading and browser-local data.
