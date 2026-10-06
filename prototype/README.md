# Browser prototype

This is the Phase 0.2 browser demo. All people, suppliers, files, and activity are fictional. It has no server, database, real authentication, or AI connection. Uploaded files stay in your browser. Demo PINs are shown on the sign-in screen.

## Run

Use Node.js 22.23.3 (pinned in `frontend/.nvmrc`) and npm. The prototype does not require Docker or Python.

```bash
cd prototype
npm ci
npm run dev
```

Expect `Local: http://localhost:5174/`. Open that address in a browser. Port 5174 keeps this demo separate from the Phase 0.1 app on 5173. Keep the terminal open; press Ctrl+C to stop.

1. Select Supervisor, Floor Worker, or Cashier.
2. Enter the PIN shown beneath the PIN field (1111, 2222, or 3333).
3. Click **Sign in**.
4. Select a page from the sidebar. On a phone, click **Open menu** first.
5. Click **فارسی** to switch to Persian and a right-to-left layout. Click **English** to switch back.
6. Use **Role switcher** to try another role, then enter its demo PIN. Floor Workers and Cashiers stay in their assigned branch; Supervisors can change branches.
7. Click **Reset demo**, then confirm **Reset demo**, to restore the original fictional data. Refreshing preserves changes; resetting preserves your role and language.
8. Click **Lock** or **Sign out** to return to the PIN screen.

The full part 7 branch, `feat/prototype-07-operations`, includes all 13 moments: lookup, invoice review, lower-price questions, partial shorts, approvals, branch-price conflicts, offers, labels, returns, expiry, notes, payables, and the Supervisor dashboard. Settings proves the pricing rules are configurable. Earlier review branches contain the requested stages in order.

[REVIEW_GUIDE.md](REVIEW_GUIDE.md) gives detailed click-by-click instructions and expected results for each of the seven pull requests. They form a chain starting from the unmerged foundation branch. Review and merge the foundation first, then parts 1 through 7. Codex and GitHub run the technical checks; Ali does not need to install tools or run tests to review the proposed work.

If `npm` is missing, install the supported Node version before running these commands. If the port is already in use, stop the process using it or run `npm run dev -- --port 5175` and open the address printed by Vite. If browser storage is unavailable, the demo still works until the page closes and shows a clear warning.

## Check

```bash
npm test
npm run lint
npm run build
npx playwright install chromium
npm run e2e
```

Expect each command to finish with passed checks. The browser tests start a Vite server automatically; stop an existing server on 5174 first. `npm run build` writes a self-contained static site to `dist/`, including locally bundled English/Persian fonts, logo, and fictional seed data. It makes no runtime requests to a backend or external font server and works offline after it loads.

## Static hosting

Upload the contents of `dist/` to a static web host and use an unlisted demo URL. Hash navigation works without server route rewrites; the relative asset base also supports a subdirectory. Do not connect this demo to production data. Creating a paid host or deploying production needs the owner's approval; the build itself creates no cloud resources.
