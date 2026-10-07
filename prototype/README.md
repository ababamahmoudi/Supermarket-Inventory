# Browser prototype

This Phase 0.2 demo runs entirely in the browser. People, suppliers, files, and activity are fictional; invoice reading is simulated. There is no backend, database, production authentication, or AI connection. Uploaded files and saved changes stay in this browser.

The current branch, `feat/prototype-08-visual-redesign`, is **redesign PR1**: the shared shell and controls, sign-in, Supervisor dashboard, Cashier lookup, and invoice review. It follows [design language v2](../docs/design-language.md). Suppliers and the other page redesigns belong to PR2 after Ali approves PR1. Existing operational pages keep their workflows and earlier page layouts.

## Run on Ubuntu

First get the review branch. If you already tested the project, open Ubuntu **Files**, find your `Supermarket-Inventory` folder, right-click inside it, and choose **Open in Terminal**. Stop the previous demo with Ctrl+C in its terminal, then run:

```bash
git fetch origin
git switch feat/prototype-08-visual-redesign
git pull --ff-only
```

Expect Git to say it switched to `feat/prototype-08-visual-redesign`, followed by `Already up to date` or a list of downloaded changes. If Git reports local changes would be overwritten, stop and share that message; preserve those files.

For a fresh copy instead, open a terminal in the folder where you keep projects and run:

```bash
git clone --branch feat/prototype-08-visual-redesign https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
```

Use Node.js **22.22.2 or newer in the 22.x series, below 23**, as required by this package. These commands install the minimum supported version using nvm. If supported Node 22 is already active, start at `cd prototype`. Docker and Python are not required.

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.22.2
nvm use 22.22.2
node --version
npm --version
```

From the repository root:

```bash
cd prototype
npm ci
npm run build
npm run dev
```

Expect Node `v22.22.2`, a successful TypeScript/Vite build, and Vite serving on port **5174**. On your own Ubuntu machine, open the local address printed by Vite. Keep the terminal open; Ctrl+C stops it. If 5174 is occupied, stop the existing demo server first. Cloud checks use internal requests; cloud onboarding does not publish a browser preview.

## Sign in and review

| Role             | Username      | Demo password        |
| ---------------- | ------------- | -------------------- |
| Supervisor       | `supervisor`  | `demo1234`           |
| Floor Worker     | `floorworker` | `demo1234`           |
| Cashier          | `cashier`     | `demo1234`           |
| New Floor Worker | `newemployee` | Temporary `temp1234` |

1. Enter a username and password, then click **Sign in**. Supervisor opens Dashboard, Floor Worker opens Invoices, and Cashier opens lookup.
2. With `newemployee`, **Choose a new password** is the only available screen until both password fields are valid. Use at least 8 characters; common values such as `password123`, `demo1234`, and `temp1234` are blocked. Try fictional `NewStorePass2026!`. The temporary password stops working after **Save password**.
3. The small **Demo** menu in the top bar switches fictional users and contains **Reset demo**. **Switch to Demo Supervisor**, **Switch to Demo Floor Worker**, and **Switch to Demo Cashier** switch immediately for review. Sign-in and unlocking use the password form.
4. Supervisor uses the branch pill to choose a branch or **All branches**. Other roles stay in their assigned branch. Use **EN | فا** for English/Persian, sun/moon for theme, and **Comfortable text size** for larger text. The text-size icon is in the top bar on desktop and phone. Theme and text size are remembered per user/device.
5. Open the user menu at the bottom of the sidebar for **Lock** or **Sign out**. Recent-user chips fill the username without retaining a typed password. On a phone, open the sidebar first.
6. Choose **Demo → Reset demo → Reset demo** in the confirmation dialog to restore fictional business data. Refresh preserves changes. Reset preserves the account, language, preferences, and changed passwords; use a fresh browser profile to repeat the first-sign-in example.

[REVIEW_GUIDE.md](REVIEW_GUIDE.md) gives click-by-click PR1 and operational checks. [REDESIGN_REVIEW.md](../docs/REDESIGN_REVIEW.md) contains the screenshot matrix and visual acceptance guide.

## Meaningful checks

Run from `prototype/`, with supported Node active:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

Expect unit suites to exercise pricing fixtures, configuration, account/password/session behavior, control keyboard behavior, company/branch scope, receiving, returns, and ledger rules. Lint checks code/formatting; build checks types and produces `dist/`. Playwright exercises desktop and phone flows, including PR1 layouts, Persian RTL, theme/text persistence, invoice blockers, approved-price lookup, and operational regressions. It previews built `dist/`, so build first and stop any stale server on 5174. `npm run e2e -- tests/design-v2.spec.ts` targets PR1; the full command also checks retained workflows.

These are commands and expected results; the PR validation report records actual run results. A check with no executed tests is not a pass.

## Configuration and retained operational data

The owner's current `seed/arzon-config.json` and `seed/demo-data.json` remain unchanged. [src/config.ts](src/config.ts) adapts their updated schema using [configuration.json](src/compat/configuration.json) and [operational-data.json](src/compat/operational-data.json). Current seed values take precedence; fields absent from the updated files retain earlier confirmed metadata: CAD, `America/Toronto`, 13% HST and tax profiles, actual received quantities, return evidence/settlements, and ledger rules. This preserves receiving and returns without fabricating stock or dropping history. Compatibility data belongs to the prototype and remains configurable.

## Static build

`npm run build` writes `dist/`, including local fonts, the logo, and fictional data. Hash navigation needs no route rewrites; relative assets support a subdirectory. The loaded demo works without backend or font-server requests. Static files can be reviewed before choosing an unlisted host. Hosting and production release are separate from this PR.
