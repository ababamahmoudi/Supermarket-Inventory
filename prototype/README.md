# Supermarket browser prototype — C6 review

This demo runs in your browser. Supplier records, documents and people are fictional; invoice reading is simulated. There is no backend, server database or real AI. Changes and uploaded files are saved in this browser: small business records in browser settings storage, files separately in IndexedDB. No Docker or Python is needed.

Current branch: **`feat/prototype-c6-functional-fixes`**. C5 is approved and merged; C6 fixes the owner's testing issues. C7 will stack on C6 and finish the visual retouch, with both reviewed together. [C6 review guide](../docs/PR_C6_REVIEW.md) contains the click checks and actual verification status. [Klead design language](../docs/design-language.md) replaces the older glowing controls; [all 43 acceptance items](../docs/C6_C7_ACCEPTANCE.md) remain pending until final evidence is supplied.

## Fresh Ubuntu Desktop

Open Terminal with **Ctrl+Alt+T**. Run each block separately; wait for the normal prompt before the next. If a command fails, keep its error and stop there.

1. Install Git and download tools:

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
```

When Ubuntu asks for your computer password, type it and press Enter. Nothing appears while you type; that is normal. Expect installation to finish without an error.

2. Install the supported Node 22 version:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm alias default 22.22.2
nvm use 22.22.2
node --version
npm --version
```

Expect **`v22.22.2`** and an npm version. Any Node 22 version at least 22.22.2 and below 23 is supported; do not use Node 24 for this package.

3. Download this review branch:

```bash
cd ~
git clone --branch feat/prototype-c6-functional-fixes https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
git branch --show-current
```

Expect **`feat/prototype-c6-functional-fixes`**. If the folder already exists, use the update instructions below.

4. Install, build and start:

```bash
cd prototype
npm ci
npm run build
npm run preview
```

Expect installation to finish, a successful TypeScript/Vite build, and a local URL using **port 5174**. Keep this terminal open. In Firefox or Chrome **inside Ubuntu Desktop**, open **http://localhost:5174**. Ctrl+C in the server terminal stops it. npm funding notices and a large-chunk build warning do not mean failure when the command exits successfully.

## Fresh Mac

Open **Finder → Applications → Utilities → Terminal**. Check Git:

```bash
git --version
```

If macOS asks to install developer tools, choose **Install**, wait until it finishes, then run `git --version` again. If no prompt appears and Git is missing, run:

```bash
xcode-select --install
```

Then install supported Node 22; these commands work on Apple silicon and Intel Macs:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm alias default 22.22.2
nvm use 22.22.2
node --version
npm --version
```

Expect `v22.22.2` and an npm version. Download and run:

```bash
cd ~
git clone --branch feat/prototype-c6-functional-fixes https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory/prototype
npm ci
npm run build
npm run preview
```

Open **http://localhost:5174** in Safari or Chrome on this Mac. Leave Terminal open. Using Safari to review does not imply the automated Chromium checks have already run in Safari; actual browser verification is listed in the review guide.

## Update an existing copy

Stop the old server with **Ctrl+C** in its terminal. In a new terminal:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-c6-functional-fixes
git pull --ff-only origin feat/prototype-c6-functional-fixes
git branch --show-current
cd prototype
nvm use 22.22.2
npm ci
npm run build
npm run preview
```

Expect the C6 branch name, then `Already up to date` or downloaded changes, a successful build and port 5174. If Git says local changes would be overwritten, stop and preserve them; do not reset or delete the folder. If the branch is unknown, keep the `git fetch` error and check that you are using the repository above.

## Sign in, reset and test

| Role             | Username      | Demo password        |
| ---------------- | ------------- | -------------------- |
| Supervisor       | `supervisor`  | `demo1234`           |
| Floor Worker     | `floorworker` | `demo1234`           |
| Cashier          | `cashier`     | `demo1234`           |
| New Floor Worker | `newemployee` | temporary `temp1234` |

Use your changed demo password if you previously changed it in this browser. `newemployee` must choose a new password before opening the app; the temporary password then stops working. The Demo menu switches fictional roles. The location pill changes allowed location; target-language **فا/EN** and theme/text-size controls change presentation. Account menu gives Lock/Sign out. On phones the same account may move to the top bar.

**Reset demo** is inside Demo and asks for confirmation. It replaces your fictional business edits, while retaining passwords and user preferences. Files and retained backup evidence are not automatically deleted. Use reset only when you want a fresh demonstration, and use a separate browser profile to repeat first-sign-in.

Start with these checks; the [detailed review guide](../docs/PR_C6_REVIEW.md) includes expected results and all requested scenes:

1. Resize to about 900 px. Sidebar uses icons, breadcrumb is current page, search opens from its icon; tables keep whole words and values. At phone width tables become cards.
2. Lookup → choose a product: dates are read-only, plus Last received and current-location clearance/expiry when recorded. Supervisor Edit → Date tracking Yes → add a date in the same form → Save product. Refresh and confirm it remains.
3. Date tracking → quick-add an entry using Enter. Try Stop tracking Keep and Clear separately: both leave the active list; Keep leaves the date on Lookup, Clear retains History. Settings → Returns/date tracking/labels has the default reminder; product reminders can override it.
4. New invoice → Manual entry. Click Post while required information is missing: **What's missing** lists links that focus/highlight fields, with local messages. Choose payment terms and check due date. Subtotal+Tax fills Final total; a deliberate difference warns. Invoiced/Delivered labels and Remove line/Undo are present. Received date/time uses store local time.
5. Returns → open a waiting-pickup return → Record pickup. Enter a smaller actual quantity: reason and remaining-unit outcome are required. Saved pickup is locked. Record a partial item resolution; still-outstanding quantities remain visible. Return memo uses its RM number and default English supplier layout.
6. Attach a fictional invoice photo/PDF, refresh and open Original invoice → Download. It should still preview and download the original. Existing files migrate automatically without deleting source evidence. Automated storage checks below create their own fictional 20-photo set; you do not have to prepare files.
7. Received → one From/To range and Today/This week/This month. Supplier page → Last delivery, Deliveries this month and Open returns open their actual records; Balance is static. Payables ledger Columns is in its title row.

Only the Supervisor sees Payables, margins and supplier money. Floor Workers retain receiving/returns/date quick entry; Cashier Lookup has no catalog or date editing. Owner/Manager Correct pickup mapping and the dark Primary colour/text choice are still awaiting the owner's explicit answer; see [open questions](../docs/open-questions.md).

## Automated checks

Open a **second terminal**, leaving the app stopped while browser checks run, and enter the prototype folder:

```bash
cd ~/Supermarket-Inventory/prototype
nvm use 22.22.2
npm test
npm run lint
npm run build
```

Expect unit tests to end with passed counts and no failures. All23 seed pricing cases must pass. Lint checks code/formatting; build checks types and creates `dist/`. These are commands and expected results, not evidence that this computer has passed them yet.

On **Ubuntu**, install Chromium and its Linux dependencies:

```bash
npx playwright install --with-deps chromium
```

On **Mac**, install Chromium:

```bash
npx playwright install chromium
```

Then run the complete browser checks from `prototype/`:

```bash
npm run e2e
```

The test runner starts its own built preview on 5174. Stop any old server first so it cannot reuse stale files. It runs desktop and phone Chromium workflows; some tests intentionally skip a width where they do not apply. Success means no failed tests, not zero skipped tests. For only the required file-storage proof:

```bash
npm run e2e -- tests/storage-c6.spec.ts
```

This generates twenty distinct fictional photos of at least3MB, checks preview resizing, exact original downloads, refresh and legacy file migration. It can take several minutes; keep the terminal open. No real invoice or customer documents are needed.

## If something fails

- **`git: command not found`:** install Git using your OS steps above, then retry.
- **`nvm: command not found`:** run the two `NVM_DIR`/`. nvm.sh` lines again in this terminal. If `nvm.sh` is missing, keep the installer error.
- **Wrong Node version / `EBADENGINE`:** run `nvm use 22.22.2` and confirm `node --version`, then retry `npm ci`.
- **Folder already exists:** use Update an existing copy; do not delete saved work.
- **Port5174 already in use:** Ctrl+C in the earlier app terminal; run preview again. For browser checks, stop preview and let Playwright start it.
- **Build/install/test error:** stop, copy the first error and command here, and keep existing files. Do not run later steps over the failure.
- **Old page:** rebuild after updating, restart preview, then hard refresh: Ctrl+Shift+R on Ubuntu or Command+Shift+R on Mac.
- **Storage warning:** use a normal browser window with site storage enabled; preserve current browser data and share the exact message. Clearing site data is not a migration fix and would remove saved local records/files.

To restart another day:

```bash
cd ~/Supermarket-Inventory/prototype
nvm use 22.22.2
npm run preview
```

Build again after pulling code changes. The demo is local; hosting, real authentication, real AI, production storage and physical-printer alignment remain separate work. Earlier C3/C4/C5 guides retain their historical proof, not current C6 counts.
