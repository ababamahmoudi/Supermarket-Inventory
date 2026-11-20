# Supermarket browser prototype — R2b review

This demo runs in your browser. All supplier records, documents and people are fictional; invoice reading and the privileged second sign-in step are simulated. There is no backend or real AI. Canonical business and people/session records are in browser-local IndexedDB, with uploaded files in a separate IndexedDB store and interface preferences in browser settings storage. No Docker or Python is needed. Each browser and phone keeps its own separate data.

Current review branch: **`feat/prototype-r2-receiving`**. Use the [R2b review guide](../docs/PR_R2B_REVIEW.md) for all twenty items, public fictional import files and staged rename/correction click paths. [PR #29/latest checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29/checks) records exact-commit verification; all seven checks are required before completion. The [earlier R2 guide](../docs/PR_R2_REVIEW.md), [C9 guide](../docs/PR_C9_REVIEW.md) and [combined C8/E review](../docs/PR_C8_E1_E2_E3_REVIEW.md) retain earlier context. The [device-access guide](../docs/phone-demo-hosting.md) explains same-Wi-Fi access, virtual machines and optional private Internet hosting.

`npm run preview` already listens on `0.0.0.0:5174`. Use its **Local** address on the serving computer and its **Network** address on other devices on the same Wi-Fi. Do not override it with `--host 127.0.0.1`, which prevents those other devices from connecting. A public Internet address requires a hosted HTTPS deployment; running preview alone does not publish the app.

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
nvm install 22.23.3
nvm alias default 22.23.3
nvm use 22.23.3
node --version
npm --version
```

Expect **`v22.23.3`** and an npm version. Any Node 22 version at least 22.22.2 and below 23 is supported; do not use Node 24 for this package.

3. Download this review branch:

```bash
cd ~
git clone --branch feat/prototype-c9 https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
git branch --show-current
```

Expect **`feat/prototype-c9`**. If the folder already exists, use the update instructions below.

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
nvm install 22.23.3
nvm alias default 22.23.3
nvm use 22.23.3
node --version
npm --version
```

Expect `v22.23.3` and an npm version. Download and run:

```bash
cd ~
git clone --branch feat/prototype-c9 https://github.com/ababamahmoudi/Supermarket-Inventory.git
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
git switch feat/prototype-c9
git pull --ff-only origin feat/prototype-c9
git branch --show-current
cd prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.23.3
npm ci
npm run build
npm run preview
```

Expect the C9 branch name, then `Already up to date` or downloaded changes, a successful build and port 5174. This branch includes the merged C8, E1, E2 and E3, so there is no manual combining of branches. If Git says local changes would be overwritten, stop and preserve them; do not reset or delete the folder. If the branch is unknown, keep the `git fetch` error and check that you are using the repository above.

## Sign in, reset and test

| Role              | Username        | Demo password | Locations                    |
| ----------------- | --------------- | ------------- | ---------------------------- |
| Owner             | `owner`         | `demo1234`    | All locations                |
| Manager           | `manager`       | `demo1234`    | All locations                |
| Branch Supervisor | `rh-supervisor` | `demo1234`    | Richmond Hill and Newmarket  |
| Floor Worker      | `ny-floor`      | `demo1234`    | North York                   |
| Floor Worker      | `wh-floor`      | `demo1234`    | Warehouse                    |
| Cashier           | `cashier`       | `demo1234`    | North York and Richmond Hill |

The old username `supervisor` signs in as the same Manager. After entering an Owner, Manager or Branch Supervisor password, complete the explicitly simulated second step shown on screen: **Use simulated passkey**, or the configured authenticator code. No real phone authenticator is required. Retained people and changed passwords survive migration; an existing legacy `newemployee` account keeps its forced first-password-change requirement. Newly invited people use their one-time setup code, choose a password, and complete their role's second step before opening business pages.

The **Demo** menu switches among these six fictional people. The location pill contains only assigned locations, plus **All my locations** when applicable; Owner/Manager also have **All locations**. The **فا / EN** and theme/text-size controls change presentation. On phones **More** holds the remaining controls.

**Reset demo** is inside Demo and asks for confirmation. It replaces fictional business edits and the People directory with the six configured users, all with `demo1234`, and revokes replaced sessions. Preferences and retained file/backup evidence are kept. Custom users and invitations are removed from the current directory; their historical author names remain on retained evidence. Use a separate browser profile for a fresh demonstration without disturbing another saved demo.

Start with these checks; the [E1 review guide](../docs/PR_E1_REVIEW.md) includes People, invitation, location and permission checks:

1. Resize to about 900 px. Sidebar uses icons, breadcrumb is current page, search opens from its icon; tables keep whole words and values. At phone width tables become cards. Check light/dark and Persian with the language/theme controls (inside More on phones). Fields have a soft fill; resting buttons have no glow; focus is visible when using Tab.
2. Lookup → choose a product: dates are read-only, plus Last received and current-location clearance/expiry when recorded. Owner/Manager Edit → Date tracking Yes → add a date in the same form → Save product. Refresh and confirm it remains.
3. Date tracking → quick-add an entry using Enter. Try Stop tracking Keep and Clear separately: both leave the active list; Keep leaves the date on Lookup, Clear retains History. Settings → Returns/date tracking/labels has the default reminder; product reminders can override it.
4. New invoice → Manual entry. Click Post while required information is missing: **What's missing** lists links that focus/highlight fields, with local messages. Choose payment terms and check due date. Subtotal+Tax fills Final total; a deliberate difference warns. Invoiced/Delivered labels and Remove line/Undo are present. Received date/time uses store local time.
5. Returns → open a waiting-pickup return → Record pickup. Enter a smaller actual quantity: reason and remaining-unit outcome are required. Saved pickup is locked. Record a partial item resolution; still-outstanding quantities remain visible. Return memo uses its RM number and default English supplier layout.
6. Attach a fictional invoice photo/PDF, refresh and open Original invoice → Download. It should still preview and download the original. Existing files migrate automatically without deleting source evidence. Automated storage checks below create their own fictional 20-photo set; you do not have to prepare files.
7. Received → one From/To range and Today/This week/This month. Supplier page → Last delivery, Deliveries this month and Open returns open their actual records; Balance is static. Payables ledger Columns is in its title row.
8. Open Orders and Payables. Detail rows have a chevron and open by clicking the row or pressing Enter on it. Columns still exposes allowed hidden facts; private money remains Owner/Manager-only. Labels → select a product → Add to waitlist → Waitlist → choose a saved template → preview. Print controls are tinted; Remove/Archive remain clearly destructive. Cancel the system print dialog if you do not want paper.

Owner and Manager see Payables, margins and supplier money. Branch Supervisors see purchase costs on allowed invoices, Orders and Supplier items, but no supplier balances or margins. Floor Workers retain their permitted operational workflows; Cashier Lookup has no catalog or date editing. Only Owner/Manager can correct a signed pickup or financially settle returns. See [the current permission table](../docs/requirements.md#3-roles-and-permissions).

## Automated checks

Open a **second terminal**, leaving the app stopped while browser checks run, and enter the prototype folder:

```bash
cd ~/Supermarket-Inventory/prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.23.3
npm test
npm run lint
npm run build
```

Expect unit tests to end with passed counts and no failures. All 23 seed pricing cases must pass. Lint checks code/formatting; build checks types and creates `dist/`. These are commands and expected results for your computer. Current executed checks and outstanding browser work are recorded in the E1 guide; `npm test` runs the app tests and then the separate genuine authority SDK suite.

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

This generates twenty distinct fictional photos of at least 3 MB, checks preview resizing, exact original downloads, refresh and legacy file migration. It can take several minutes; keep the terminal open. No real invoice or customer documents are needed.

## If something fails

- **`git: command not found`:** install Git using your OS steps above, then retry.
- **`nvm: command not found`:** run the two `NVM_DIR`/`. nvm.sh` lines again in this terminal. If `nvm.sh` is missing, keep the installer error.
- **Wrong Node version / `EBADENGINE`:** run `nvm use 22.23.3` and confirm `node --version`, then retry `npm ci`.
- **Folder already exists:** use Update an existing copy; do not delete saved work.
- **Port 5174 already in use:** Ctrl+C in the earlier app terminal; run preview again. For browser checks, stop preview and let Playwright start it.
- **Build/install/test error:** stop, copy the first error and command here, and keep existing files. Do not run later steps over the failure.
- **Old page:** rebuild after updating, restart preview, then hard refresh: Ctrl+Shift+R on Ubuntu or Command+Shift+R on Mac.
- **Storage warning:** use a normal browser window with site storage enabled; preserve current browser data and share the exact message. Clearing site data is not a migration fix and would remove saved local records/files.

To restart another day:

```bash
cd ~/Supermarket-Inventory/prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.23.3
npm run preview
```

Build again after pulling code changes. The preview supports this computer and other devices on the same network; a private Internet link requires HTTPS hosting. Real authentication, real AI, production storage and physical-printer alignment remain separate work. The combined review guide records source-specific automated results and screenshots. Each device/browser/site address keeps separate fictional records.
