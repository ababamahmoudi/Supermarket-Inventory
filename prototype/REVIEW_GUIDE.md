# Prototype review guide

Current E1 review branch: `feat/prototype-e1-location-roles`, stacked on C8. It includes configured roles, assigned locations, People and genuine browser-local sign-in/session workflows. [E1 click-by-click guide and exact evidence](../docs/PR_E1_REVIEW.md) records what passed and what is still being checked. [C8 review](../docs/PR_C8_REVIEW.md) retains the sales and layout checks.

The owner authorized C8 → E1 → E2 → E3 together, without an intermediate review pause. This is an in-progress E1 checkpoint, not a final joint delivery. No new PR is automatically merged.

[README](README.md#fresh-ubuntu-desktop) gives fresh Ubuntu installation, expected outputs and troubleshooting. Once the supported Node 22 is installed, run:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-e1-location-roles
git pull --ff-only origin feat/prototype-e1-location-roles
cd prototype
npm ci
npm run build
npm run preview
```

Open `http://localhost:5174` inside Ubuntu Desktop and keep Terminal open. Docker is unnecessary for this frontend prototype. The final joint delivery will give the E3 branch commands, which include all four stages.

For E1, start as `owner` / `demo1234`, complete the simulated passkey step, then open Settings → People. The guide covers invitation/first-password setup, role/location edits, cross-tab deactivation, registered computers, and the Branch Supervisor dashboard. Demo → `rh-supervisor` shows only Richmond Hill/Newmarket; Demo → `cashier` gives North York/Richmond Hill Lookup. Reset demo explicitly restores the six configured people and replaces sessions.

Technical checks:

```bash
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

Stop preview before the browser suite so its owned preview cannot reuse an old build. Every pricing fixture must pass. Existing width-specific skips are reported separately; a command list is not evidence that the checks already passed. Actual results, source fingerprints, screenshots and limitations belong in the E1 review guide.

Each browser/phone has separate fictional data. No backend authentication, real invitation or second-factor verification, remote synchronization, deployment or physical-device result is claimed.
