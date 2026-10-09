# Browser prototype

This Phase 0.2 demo runs entirely in the browser. People, suppliers, files, and activity are fictional; invoice reading is simulated. There is no backend, database, production authentication, or AI connection. Uploaded files and saved changes stay in this browser.

The current working branch, `feat/prototype-c2-orders-requests`, stacks C2 on **pull request C1 (#14)**. C2 implementation and validation are in progress; its guide will include the executed results and gallery before review. C1 final tip is `95f4fe4`. It includes approved B and adds Received, named store/Warehouse locations, safe invoice-location corrections, manual-price flags and Supervisor cost history, ready Regular/Promo grayscale labels, and the All branches notebook fix. It removes visible stock estimates and opening counts: inventory is a separate later paid phase. The [C review guide](../docs/PR_C_REVIEW.md) contains exact Ubuntu commands, click-by-click checks, screenshots and remaining scope. C2 adds Orders, supplier items/packs, linked invoice differences and short-dated receiving, and Branch requests. Its final guide will record executed verification and screenshot evidence. The [B review guide](../docs/PR_B_REVIEW.md) records the earlier approved review; real AI/item 30 remains deferred to Prompt 3D.

## Run on Ubuntu

First get the review branch. If you already tested the project, open Ubuntu **Files**, find your `Supermarket-Inventory` folder, right-click inside it, and choose **Open in Terminal**. Stop the previous demo with Ctrl+C in its terminal, then run:

```bash
git fetch origin feat/prototype-c2-orders-requests:refs/remotes/origin/feat/prototype-c2-orders-requests
git switch feat/prototype-c2-orders-requests
git pull --ff-only origin feat/prototype-c2-orders-requests
```

Expect Git to say it switched to `feat/prototype-c2-orders-requests`, followed by `Already up to date` or a list of downloaded changes. If Git reports local changes would be overwritten, stop and share that message; preserve those files.

For a fresh copy instead, open a terminal in the folder where you keep projects and run:

```bash
git clone --branch feat/prototype-c2-orders-requests https://github.com/ababamahmoudi/Supermarket-Inventory.git
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
npm run preview
```

Expect Node `v22.22.2`, a successful TypeScript/Vite build, and the preview serving on port **5174**. On your own Ubuntu machine, open the local address printed by Vite. Keep the terminal open; Ctrl+C stops it. If 5174 is occupied, stop the existing demo server first. Cloud checks use internal requests; cloud onboarding does not publish a browser preview.

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

[PR_C_REVIEW.md](../docs/PR_C_REVIEW.md) is the current guide for C1 and the C2 workflow. [PR_B_REVIEW.md](../docs/PR_B_REVIEW.md) records the earlier approved B review. [DESIGN_A2_REVIEW.md](../docs/DESIGN_A2_REVIEW.md) records the earlier A2 review. [REVIEW_GUIDE.md](REVIEW_GUIDE.md) and [REDESIGN_REVIEW.md](../docs/REDESIGN_REVIEW.md) record the earlier four-screen PR1 review.

## Meaningful checks

Run from `prototype/`, with supported Node active:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

Expect unit suites to exercise pricing fixtures, configuration, account/password/session behavior, control keyboard behavior, company/branch scope, receiving/posted relocation, warehouse rules, manual-price provenance, All branches notebook addition, exact Regular/Promo geometry, Supplier item/pack snapshots, Orders/To order/discrepancy/short-dated receiving, request endpoint/checklist/residual-copy rules, returns and ledger rules. Lint checks code/formatting; build checks types and produces `dist/`. Playwright exercises desktop and phone flows, including the retained A2 controls/operational flows and B's live label designer/waitlist/printing, custom notebook roles, saved Settings, History/Revert/independent Undo timers, new supplier/product guards, manual invoice posting blockers, Persian RTL and theme/text persistence. It previews built `dist/`, so build first and stop any stale server on 5174. `npm run e2e -- tests/alignment-a2.spec.ts` targets A2 table/dialog proof; the full command also checks the earlier sign-in/layout work and retained workflows.

These are commands and expected results; the PR validation report records actual run results. A check with no executed tests is not a pass.

## Configuration and retained operational data

C updates `seed/arzon-config.json` only for configured North York, Richmond Hill, Newmarket and Warehouse names/types. The owner's `seed/demo-data.json` and pricing cases remain unchanged. [src/config.ts](src/config.ts) adapts their updated schema using [configuration.json](src/compat/configuration.json) and [operational-data.json](src/compat/operational-data.json). Current seed values take precedence; fields absent from the updated files retain earlier confirmed metadata: CAD, `America/Toronto`, 13% HST and tax profiles, actual received quantities, return evidence/settlements, and ledger rules. This preserves receiving and returns without dropping history. Compatibility data belongs to the prototype and remains configurable. A2 adds explicit fictional historical invoices and historical physical movements in [a2-demo-data.json](src/fixtures/a2-demo-data.json), loaded by [demo-fixtures.ts](src/demo-fixtures.ts). Matching posted invoice/payment ledger entries support the supplier balances, open invoices, overdue amounts and purchase charts. C preserves historical counts/receipts/returns/store-use events, but shows no stock estimates and accepts no new opening counts. They are retained for later register-based inventory, not current sales tracking.

The historical Fresh Valley invoice **FV-20390** contributes $169.79. The current upload example **FV-20417** is a separate delivery: posting it after marking the four chips short adds another $169.79; Fresh Valley becomes $339.58. The historical records never replace the uploaded invoice’s amount. A2 preserves existing saved custom changes. Before extending old browser data, it writes and verifies an exact backup under `supermarket-prototype-before-a2-fixtures`; a failed backup leaves the original data unchanged. B also writes and verifies an additive exact backup under `supermarket-prototype-before-b` before extending existing saved state. **Reset demo** restores the coherent fictional starting records, so use it only when you want to discard your demo business edits.

## Static build

`npm run build` writes `dist/`, including local fonts, the logo, and fictional data. Hash navigation needs no route rewrites; relative assets support a subdirectory. The loaded demo works without backend or font-server requests. Static files can be reviewed before choosing an unlisted host. Hosting and production release are separate from this PR.
