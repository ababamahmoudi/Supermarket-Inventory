# E2 price-update UI review

The prototype now exposes real per-Store price tasks, the register/label checklist, Manager progress, a Cashier price-change hint, personal bell notifications and configurable notification roles. The task views use protected reads and real configured people. A queued label or opened preview does not count as a physically printed label.

## Run on Ubuntu

Use the E2 pull-request branch being reviewed. These are frontend commands; Docker is unnecessary for this prototype.

1. Open Terminal in the repository folder.
2. Run `node --version`. It must report a supported Node 22 version (at least 22.22.2, below 23). If Node is unavailable, follow the repository's Ubuntu Node installation instructions first.
3. Run `cd prototype` and then `npm ci`.
4. Run `npm run dev`. Keep that terminal open. Expected: Vite prints `http://localhost:5174/`.
5. Open that address in the Ubuntu browser. If it reports the port is occupied, close the earlier prototype terminal with Ctrl+C, then repeat `npm run dev`.

## Click through the genuine flow

1. Start from a reset demo. Sign in as the configured Manager account (`manager`); use the demo password and simulated second step printed in the repository's demo-account instructions. Subsequent account changes below use the actual small **Demo** menu.
2. Select **All locations** in the top bar. Open **Alerts**. In the Black Tea card, choose the North York row's **Apply this price to all** action, then confirm **Apply price to all branches**.
3. In this unchanged fixture North York and the other Store already charge $6.49. Richmond Hill changes from $6.99 to $6.49. Therefore only Richmond Hill receives a pending task; do not expect invented extra Store tasks.
4. Open **Demo → Switch to Demo Richmond Hill Supervisor**. Select **Richmond Hill**, then open **Price updates**. Open the Black Tea task. Check the actual old/new price, Store, source action and deciding person.
5. Open the top-bar bell. It contains this person's actual task notification. Open it and verify it returns to the permitted task and Store. **Mark all as read** updates the actual records.
6. Open **Demo → Switch to Demo Cashier**, keep Richmond Hill selected, and search `0004` in **Lookup**. The approved price is $6.49; the **Price changed** pill shows the actual crossed $6.99. No staff decision or cost is exposed to the Cashier.
7. Switch back to **Demo Richmond Hill Supervisor** and reopen the task. Select **Changed on the cash register** only after the register step is done. Choose **Print label now**. A real print sheet and native browser print flow are used. Answer **No** once: the label step must remain unconfirmed. Print again, then answer **Yes** only if the label printed correctly. This browser review exercises the explicit confirmation; it does not prove a hardware printer's alignment.
8. Alternatively, the authorized Supervisor may select **No label needed**, enter a real reason and save it. The reason and confirming person must remain visible. This waiver does not claim that a label was printed.
9. Once the register plus print/waiver requirements are satisfied, choose **Mark as done**. The task moves to Done. The Cashier pill disappears. As Manager, open Store progress: the completed Richmond Hill row shows the real completing person and time.
10. A Floor Worker can handle the permitted label work but cannot tick the register or create a managerial waiver. Floor completion is disabled by default. The Manager's **Settings → Notifications** contains eight role matrices, reminder hours and the optional Floor completion setting. Role names follow company configuration.
11. Use the language and theme controls to repeat the task views in Persian and dark mode. At phone width the amount transition still reads old → new. Warehouse users receive no price-update task; manually entered foreign task links stay unavailable.

## Actual checks

- Final browser verification: 8/8 native cases and 4/4 capture cases, producing 24 primary screenshots plus four supplemental live dashboard card details; no skipped/retried cases and no captured browser page/console errors.
- Thirteen affected UI cases pass, including four genuine Provider cases, the retained C8 personal-notification case and eight retained sale-label cases.
- Full TypeScript compilation and production Vite build pass. Scoped ESLint has no errors or warnings; all 18 UI source files pass Prettier.
- Source and built assets match their pre-run fingerprints. The exact engine and UI source hashes, raw reports and per-image SHA-256 are retained beside this file. The engine's separate 260-case result is not presented as a full combined application suite.
- The first native run exposed a missing unavailable-page header; early manual captures exposed a concatenated History line and reversed Persian price direction. Those failed results remain in the compressed raw reports, with two illustrative superseded images. The corrected final set was reviewed anew.

## Limits and remaining stack work

The optional Undo toast was dismissed through its real public control for the captures. These images therefore do not verify an active Undo toast at short phone heights. A real overlap with the task waiver control was separately found; E3 owns the inline reserved-host correction and its final composed-stack proof. No hardware printer was used.

Root still owns final combined application/SDK checks, CI and pull-request completion. This evidence records E2 captured-state readiness, not final E3 release approval. No real supplier, register, backend or hardware printing was connected.

[Screenshot gallery](../../redesign-screenshots/pr-e2/README.md) · [Verification](ui-browser-verification.json) · [Manual review](ui-manual-review.json)
