# R3c — receiving demo corrections

Work remains on `feat/prototype-r2-receiving`, [PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29). Ali stopped R2g and explicitly lifted the earlier freeze. Each P0 item is verified and pushed separately in the latest requested order. This guide records implementation and rehearsal; the PR records the exact pushed commits and CI results.

## Delivery order

| Order | Item                                                 | Status            |
| ----- | ---------------------------------------------------- | ----------------- |
| 1     | K0 — final approvals and page error recovery         | Delivered         |
| 2     | K1 — unchanged known products green                  | Delivered         |
| 3     | K2 — printed-name matching and checked-values import | Delivered         |
| 4     | K6 — missing-paper payment default                   | Delivered         |
| 5     | F4 — retained Discard / Cancelled / Undo             | Delivered         |
| 6     | F7 — truthful processing header                      | In implementation |
| 7     | F3 — native picker before draft creation             | In implementation |
| 8     | K3 — configurable .49 → .99                          | In implementation |
| 9     | K4 — selling-price proposal in the line editor       | In implementation |
| 10    | K5 — reading survives navigation                     | In implementation |
| 11    | K7 — compact truthful reading progress               | In implementation |

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

## K1 — repeat deliveries become green

1. Start in a separate practice browser profile if you want an isolated rehearsal. Use Settings → Data to import a wholly fictional delivery, review its first-time name/pack/category checks and post it normally. Product approval may remain pending.
2. Import/read a second invoice from the same supplier with the same items. Import complete offers **Open Ready to post** when no real blocker remains. Open it: unchanged lines are green with a check and **Same as last delivery**, with no comparable check count and no line-confirmation click.
3. The progress strip shows same/changed/new counts. Press Post invoice to open its ordinary confirmation, then Cancel if you are only inspecting. Reading and opening the confirmation have not posted anything or changed the original Product/approval/ledger.
4. Read a third fictional delivery with one changed cost. Exactly that row is amber; it shows the actual old/new case cost and earlier-delivery date, and its question leads to the editable Case cost. Changed codes/packs and unrelated real source/date/quantity discrepancies still ask for review.
5. Open and edit a known line: stale automatic evidence is invalidated. Check another company/location/role only through its genuine permissions; internal evidence IDs/fingerprints are never displayed or exported as public invoice facts.

K1 owner verification passed 236 tests across 18 importer/check/matching files, full lint/build and six actual browser cases (four new English/Persian desktop/phone plus two retained rename/cross-supplier cases), with no skips or retries. The unchanged baseline causally failed the second-delivery automatic-confirmation assertion. Real Each→lb and Weight→Each regressions retain incomparable cost questions. Combined K0+K1 verification then passed 42 units, four desktop/phone English/Persian browser cases and a fresh build. Full CI results are recorded with delivery on the PR.

CI213 verified K0's 2,652 unit tests, 75 SDK tests, foundation and three browser shards, but the remaining progressing shard reached the 40-minute job cap. Subsequent runs allow 50 minutes with all individual tests unchanged. Each separately pushed item retains its own full CI run instead of being canceled by the next push. One older notification case recovered on retry in CI213; it is recorded rather than described as a first-attempt pass.

## K2 — clean checked names still match supplier print

1. In a separate practice browser profile, open Settings → Data → Choose file and select your cleaned invoice-readings export. Choose **My checked values**, review the actual destinations and preview, then import additively. Duplicate originals/numbers remain protected; this does not remove existing business records.
2. Open an imported invoice and inspect a new line. The product name uses the clean checked brand/item/individual size; carton count belongs in pack. More details retains the original printed description separately and has optional English/Persian Description fields. Confirm required first-time checks and post normally.
3. Read a later delivery from the same supplier with the same printed descriptions and a new invoice number. It matches the cleanly named Product and uses K1's green comparison when known facts agree. Product approval may still be pending; another supplier or ambiguous source still requires review.
4. Open More details for an existing Product. Extra Description is saved with this delivery, as the visible hint says; use Edit product for guarded catalog changes. First-time new-Product descriptions are copied at posting.
5. Compare checked-mode preview with final review: supplied corrections and original printed evidence produce the same check counts. Raw originals, amounts and source pack/quantity remain unchanged.

Owner verification passed 267 tests across 19 files, full lint/build and 18 actual browser cases with no skips/retries: four checked-import → post → fictional raw live-response cases, four retained K1 cases, two matching cases and eight legacy import/name-layout cases. The independent audit follow-up passed 27 tests for real History projection, nested/path redaction, preserved supplier fields and unchanged canonical evidence. Integrated final-source checks and full CI are recorded on the PR. Automated reader responses and invoice papers are fictional; the real-kit rehearsal remains on the Mac.

## K6 — missing-paper payment default

1. Use the guide's Mac startup steps, sign in as Manager and choose North York. Open Settings → Data, find **Import invoice readings**, click **Choose file…** and select `prototype/tests/fixtures/r3c-monthly-fictional-readings-export.json` from the checkout.
2. Import the selected fictional invoice, open Needs review and open **FICTIONAL-MONTHLY-31**. Expand Invoice details. Payment terms shows **Monthly** and **Default: first of next month**, without an amber terms question; Due date is **2027-01-01** for the printed **2026-12-31** invoice date. The separate order-reference question remains.
3. Choose **Net 30 (30 days)** in Payment terms. The default hint disappears and Due date becomes **2027-01-30**. The same invoice/original remains available; this does not post it.
4. A reading with actual printed/checked terms keeps those terms. Existing manual drafts and stored invoices retain their prior values.

Combined K0/K1/K2/K6 verification passed 85 targeted unit tests, four English/Persian desktop/phone browser cases and a fresh build, with no browser skips or retries. Independent full CI is recorded on PR #29.

## F4 — retained Discard, Cancelled and Undo

1. In Invoices, click **New invoice → Manual entry**, then **Save and close** without entering content. Open Drafts → the row's **More → Discard invoice**. It moves to Cancelled immediately, with no confirmation dialog.
2. Open an unposted invoice that has an original or entered fields. Click **Discard invoice** in its header. Click the dialog's Discard button with an empty Reason: **Add a reason** appears and nothing is changed. Cancel the dialog; the invoice is unchanged.
3. Open Discard again, enter a fictional reason and confirm. Open **Cancelled**, then the record. Check its reason/person/time and original. The record has no Post or editing controls.
4. Open another invoice, then click the **Undo** toast. Return to the discarded record: its draft is restored and the invoice you opened meanwhile is unchanged. For a restored live-reading draft, use **Read again** explicitly; Undo itself does not restart reading.
5. For a draft already entered by hand, Discard → Undo restores its manual-entry workflow. Continue adding a line with the original permitted role.

The integrated final source passed 129 targeted units, a fresh build and eight English/Persian desktop/phone browser cases, with no skips or retries. Independent full CI is tracked on PR #29.

## After the demo — record only

- Read a supplier's order-confirmation/pre-invoice PDF into an expected order, then use that reading when the invoice arrives.
- Allow branch-request senders to add also-sending items, alongside Loaded ticks and Mark all as being sent.
- Edit an offer's terms, dates and mix-and-match membership in place.
- Schema v3 may suggest brand/name for a person to confirm.

Automated examples use fictional media and intercepted reader responses. Real-kit, physical camera and local-network rehearsal remain on Ali's devices. No merge, force-push, provider-key integration, paid resource or deployment is part of this request.
