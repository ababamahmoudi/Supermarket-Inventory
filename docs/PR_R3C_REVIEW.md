# R3c — receiving demo corrections

Work remains on `feat/prototype-r2-receiving`, [PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29). Ali stopped R2g and explicitly lifted the earlier freeze. Each P0 item is verified and pushed separately in the latest requested order. This guide records implementation and rehearsal; the PR records the exact pushed commits and CI results.

## Delivery order

| Order | Item                                                 | Status                   |
| ----- | ---------------------------------------------------- | ------------------------ |
| 1     | K0 — final approvals and page error recovery         | Verified; first delivery |
| 2     | K1 — unchanged known products green                  | In implementation        |
| 3     | K2 — printed-name matching and checked-values import | In implementation        |
| 4     | K6 — missing-paper payment default                   | In implementation        |
| 5     | F4 — retained Discard / Cancelled / Undo             | In implementation        |
| 6     | F7 — truthful processing header                      | In implementation        |
| 7     | F3 — native picker before draft creation             | In implementation        |
| 8     | K3 — configurable .49 → .99                          | In implementation        |
| 9     | K4 — selling-price proposal in the line editor       | In implementation        |
| 10    | K5 — reading survives navigation                     | In implementation        |
| 11    | K7 — compact truthful reading progress               | In implementation        |

P1 remains after green P0. No pending row in this table is a claim of delivered behavior.

## Start on the Mac

Use Node 22.22.2 or a later Node 22 release. Keep the existing reader kit in its own folder; run its documented `npm run serve` there and leave it running. Keys remain only in that kit's `keys.env`.

In a second terminal in the app checkout:

```bash
git switch feat/prototype-r2-receiving
git pull --ff-only
cd prototype
npm ci
npm run build
npm run preview
```

Open `http://localhost:5174`, sign in as `manager` / `demo1234`, finish the simulated second step and choose North York. Existing browser data is retained; use a separate browser profile for isolated fictional practice. Stop preview before rebuilding and restart it afterward.

For live rehearsal, open Settings → Receiving → AI reading → Live → Test connection → Save changes. Keep a retained custom address when the reader runs on another computer. On a phone, localhost refers to that phone, so use the Mac's reachable LAN address. The kit must allow the actual app origin through its own network/CORS configuration. F2's exact localhost default belongs to the later P1 work.

## K0 — final approval and page recovery

1. Receive and post a fictional invoice with new-product approvals, or use the existing fictional pending approvals.
2. Open Approvals → Pending and approve requests individually until the final request is approved. The genuine No pending requests message must be in view; navigation and tabs remain usable.
3. Repeat with another fictional invoice group using Approve all, select all eligible products and approve the counted selection. The final empty board must be visible even if the board was scrolled before opening the dialog.
4. With another invoice group above, finish the bottom group: real remaining content must stay in view. Ordinary partial decisions preserve the board's scroll position when remaining content is already visible. Original invoices, receipts and ledger evidence are unchanged by viewing the completed board.
5. A caught page render error has a translated Something went wrong / Reload this page card inside the content area, with the app shell outside it. Automated component coverage triggers a real failing child; there is no production crash button to press.

The unchanged approval component was reproduced through both final individual and Approve all decisions: scroll remained at 480 px, the empty message began at −125 px, and the empty board retained 734 px of height. The partial-batch 2 px scroll guard passed before the final-empty assertion failed. Original-source traces and the actual blank viewport frame are retained privately outside the repository.

A further genuine reproduction retained older fictional approvals above the newly posted group. Finishing that bottom group left no surviving card in the usable viewport. The fix also recovers that case; the normal partial-decision proof checks the same real visible survivor before and after, with the 2 px limit unchanged.

K0 verification passed 33 targeted unit tests across four files, including App, Timesheets navigation and the actual error boundary; full lint, production build and final TypeScript checks passed. Ten unique targeted browser cases passed in English/Persian on desktop/phone across two runs: six new short regressions and four retained 25-line bulk cases, with no skips or retries. Application source was identical across those runs. Subsequent item click paths are added with their separate delivery; the PR records the pushed commit and full CI outcome.

## After the demo — record only

- Read a supplier's order-confirmation/pre-invoice PDF into an expected order, then use that reading when the invoice arrives.
- Allow branch-request senders to add also-sending items, alongside Loaded ticks and Mark all as being sent.
- Edit an offer's terms, dates and mix-and-match membership in place.
- Schema v3 may suggest brand/name for a person to confirm.

Automated examples use fictional media and intercepted reader responses. Real-kit, physical camera and local-network rehearsal remain on Ali's devices. No merge, force-push, provider-key integration, paid resource or deployment is part of this request.
