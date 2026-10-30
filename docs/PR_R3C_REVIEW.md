# R3c — receiving demo corrections

Work remains on `feat/prototype-r2-receiving`, [PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29). Ali stopped R2g and explicitly lifted the earlier freeze. Each P0 item is verified and pushed separately in the latest requested order. This guide records implementation and rehearsal; the PR records the exact pushed commits and CI results.

## Delivery order

| Order | Item                                                 | Status    |
| ----- | ---------------------------------------------------- | --------- |
| 1     | K0 — final approvals and page error recovery         | Delivered |
| 2     | K1 — unchanged known products green                  | Delivered |
| 3     | K2 — printed-name matching and checked-values import | Delivered |
| 4     | K6 — missing-paper payment default                   | Delivered |
| 5     | F4 — retained Discard / Cancelled / Undo             | Delivered |
| 6     | F7 — truthful processing header                      | Delivered |
| 7     | F3 — native picker before draft creation             | Delivered |
| 8     | K3 — configurable .49 → .99                          | Delivered |
| 9     | K4 — selling-price proposal in the line editor       | Delivered |
| 10    | K5 — reading survives navigation                     | Delivered |
| 11    | K7 — compact truthful reading progress               | Delivered |

P1 remains after green P0. No pending row in this table is a claim of delivered behavior.

## P1 delivery order

| Order | Item                                                             | Status    |
| ----- | ---------------------------------------------------------------- | --------- |
| 1     | K8 — paid/free receiving and exact acquisition                   | Delivered |
| 2     | F1 — unmistakable retained simulation warning                    | Delivered |
| 3     | F2 — exact localhost reader default                              | Delivered |
| 4     | F6 — category for current NEW products                           | Delivered |
| 5     | F8 — active pages and retained originals                         | Planned   |
| 6     | F9 — phone chooser fits                                          | Planned   |
| 7     | F10 — compact actual reader settings                             | Planned   |
| 8     | F11 — scoped safe failure details                                | Planned   |
| 9     | K9 — shared checkboxes, pickup and independent Dashboard columns | Planned   |

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

## F7 — truthful reading header

1. With the existing live reader running and Live saved in Settings → Receiving, open Invoices → **New invoice → Photo (AI reading)** or **PDF (AI reading)** and select a fictional invoice file. The header reads **New invoice** and **Original saved · ready to read**, with no empty reference/supplier/date fragments or Post button.
2. Click **Read invoice**. While its request is active, the header says **Reading with AI…**. Use **Cancel** in the progress card: it changes to **Reading cancelled · original saved** and retains the original. Cancelling never claims a completed read or posts the invoice.
3. Start a separate fictional reading and reload while its request is still active. Reopen it: the inactive recovery header says **Reading interrupted · read again** until you explicitly read again.
4. After a successful reading, check that the ordinary invoice reference/supplier/date and existing review/post workflow return.

The integrated final source passed six header unit tests, a fresh build and all six held-reader/header/Post-guard browser cases across English/Persian and desktop/phone, with no skips or retries. Independent full CI is tracked on PR #29.

## F3 — native picker before draft creation

1. Choose a concrete receiving branch, open Invoices and click **New invoice → Photo (AI reading)**. The native image picker opens immediately. Cancel it: no extra blank invoice appears and the current invoice remains available. Repeat with **PDF (AI reading)** where the role permits it; that picker accepts one PDF.
2. Choose a wholly fictional invoice image. The actual original is retained and the new target opens after saving. With Live saved in Settings → Receiving, the header says **New invoice** and **Original saved · ready to read**; click **Read invoice** explicitly to begin the reader. Selecting the file alone does not start a reader request or post the invoice.
3. Repeat with a fictional PDF, then several fictional image pages. Check that the original viewer shows the selected source/pages in order. Save and close; the previous draft is still available. If the selected photo has completed simulated reading, the list may correctly default to Needs review; select **Drafts** when returning to an earlier manual draft.
4. Repeat the picker/cancel path in Persian and on a phone-sized browser. The app uses an image picker without forcing camera capture. A physical phone's camera/library presentation and the real reader/local network still require rehearsal on the actual device.
5. Invalid/empty choices do not create records. Automated coverage also delays actual source validation, leaves Invoices and returns before validation finishes, and verifies full canonical no-create. The retained manual-original attachment tests also verify that storage rejection releases pending protection and preserves the existing draft.

Integrated verification passed 16 unit tests, a fresh build and all 12 English/Persian desktop/phone picker browser cases, with no skips or retries. Independent full CI is tracked on PR #29.

## K3 — configured .49 to .99 and Use Lower

1. In a fictional demo profile as Owner/Manager, open **Settings → Catalog → Rounding rules**. Default Round selected price endings up is On, Source price endings is **0.49**, and Round up to ending is **0.99**.
2. On the same page, use **Price tester → Each → Grocery**, with unit cost before tax **1.00**. The calculated price is **1.99**. Disable the final rule and Save changes in this fictional profile: it becomes **1.49**. Restore the intended default. Existing approved Products do not reprice.
3. With Simulated saved in Settings → Receiving, enter a fresh fictional PDF through New invoice. Open its first Grocery line (the unchanged fictional six-line simulation): the calculated **1.99** shows **Rounded up from $1.49 (store rule)**. Choose **Use $1.49**. It becomes a manual proposal attributed to the actual receiving person, while calculated price remains 1.99 and approved charge stays unchanged.
4. Choose **Use calculated price** to reset. Or retain the lower proposal, finish the ordinary invoice checks, confirm and post. In Approvals, open that individual manual-price proposal: requested/calculated prices and the original receiver remain visible even if a different Manager posted. Cancel/reject leaves the earlier approved charge intact; approval uses the existing scope/reason guards.

The owner passed 131 focused units, 182 additional pricing tests (overlapping batches), 24 shared Python fixtures, 31 Python reference tests, static/build checks and 14 browser cases. Integrated final-source verification passed 412 combined tests across 21 files, 14 browser cases, 24 shared Python fixtures, 31 Python reference tests, Ruff/static checks and a fresh build, with no browser retries or skips. Independent full CI is tracked on PR #29. Automated fixtures are fictional; no real-provider or physical-device rehearsal is claimed.

## K4 — editable receiving selling price

1. Open a fictional unposted invoice line. **Selling price (per unit)** is editable. Rapidly type **1.83**: the complete amount/focus remain. Close and reopen, or reload and reopen the saved draft: the receiving proposal still shows 1.83 and the actual receiver's name.
2. Clear the amount or enter **0**, then Confirm line. The line stays unconfirmed and the actual Selling price input is marked/focused. Enter valid positive cents again. **Use calculated price** resets the proposal. A rejected repository save restores the committed amount and offers a fresh explicit retry; it never claims an unsaved price was committed.
3. With a permitted Manager/Owner, inspect ordinary margin/minimum/below-cost warnings. A Floor Worker retains the permitted receiving price/cost workflow without private numeric margin/minimum details.
4. For weight, with kg main display and factor **2.20462**, enter **17.61/kg**: retain that exact entered amount/unit and canonical **7.99/lb** proposal. Proposed and earlier approved prices identify the configured display unit. A changed factor requires explicit re-review of the visible entered amount; factor 2 maps 17.61/kg to canonical 8.81/lb.
5. Finish required checks and confirm the lines. Let a different Manager post. In **Approvals → individual manual price → Review approval**, check requested/calculated prices, entered kg amount if relevant, and **Set by the original receiving person during receiving**. Cancel/reject retains the earlier approved charge; genuine final approval uses the existing scope/reason guards.

Integrated verification passed 31 focused units and static/build checks. Browser verification passed 18 main/legacy cases, two final kg/lb comparison cases and six Price tester cases, with no skips/retries. This includes native IndexedDB abort/rollback/retry, real source/receipt workflows and a visible divisor change with a genuine below-minimum warning. Independent full CI is tracked on PR #29. Automated originals and responses are fictional.

## K5 — app-level background reading

1. Configure Live, choose a fictional photo/PDF and explicitly press **Read invoice**. Navigate to **Lookup**, enter a query and leave its field focused. Let the reader respond: Lookup/query/focus remain and a ready notice appears. Click **Open** to review that saved invoice.
2. Repeat while another invoice is selected. Only the first saved draft fills. Changing reader address/mode during a run does not retarget it; those settings apply to a later explicit read.
3. Hold a response, Discard the draft and Undo it. The old response cannot import or show Ready, and Undo does not restart the request. Use **Read again** explicitly. Reload during a reading also requires an explicit new read.
4. Finish a read while a real Timesheets field save is pending, then Open. The existing save/navigation guard retains ownership and the notice stays until navigation is accepted.
5. On a phone, Ready and Undo sit above the actual Post/footer controls and each other, including Persian/RTL and a changing footer height. Test Post, New invoice, Lookup and Undo with the notice visible.

Integrated service/navigation/footer verification passed 95 units, lint and build. The complete final R3/F0/background/footer matrix passed all 58 browser cases in 8.1 minutes, with no retries or skips. The three-file K3 domain-fixture repair separately passed all 52 tests, and the final composed build passed. Independent full CI is tracked on PR #29. All automated originals/responses are fictional; physical-device/local-reader rehearsal remains on Ali's devices.

When a live read completes on the invoice already open, review appears without a redundant Open notice; open a line and More details normally. The genuine foreground/background App regression, pending Timesheets navigation and footer guards pass 17 units and all 20 related desktop/phone EN/FA browser cases, with no skips/retries.

Also start a live read, open another invoice, and return to the first before the response arrives. The same request completes with the same original/attempt; the other draft remains unchanged. This held-response path and retained background/Discard/Undo paths passed all 16 desktop/phone EN/FA cases, with 70 baseline domain tests and a fresh build.

## K7 — truthful compact reading progress

1. With Live and the real local reader configured, select a fictional photo/PDF and press **Read invoice**. Check actual elapsed time beside the estimated usually-about-a-minute caption. The indeterminate bar moves without claiming a percentage.
2. When the reader returns, Reading becomes a check. **Finding products** and **Calculating prices** light up while actual protected local work runs, then review opens. These local steps can be brief. Navigating to Lookup still preserves the request and shows the K5 Ready/Open notice.
3. At desktop widths **1440 and 1000**, the original and progress card share the top edge in two columns. At phone widths **390 and 509**, all three step chips stay in one row with whole words and Cancel at the end. Repeat in Persian/dark.
4. Enable the device/browser reduced-motion setting: animation stops, but elapsed time and actual work continue. Cancel stops the current transport; a held late response cannot import or show Ready. Discard/Undo and full-reload recovery retain their explicit new-read rules.

Integrated verification passed 92 protected matching/paint/service/navigation units, lint and a fresh build. All 34 final selected geometry/509/F0/success/Cancel/stale-target browser cases passed in 4.8 minutes, with no retries or skips. Independent full CI is tracked on PR #29. Root and owner visually reviewed current phone and desktop screenshots. Fictional intercepted responses were used for automation; real-provider/physical-device rehearsal is not claimed.

The retained C8 sale/cost proof helper also uses the genuine native file chooser before draft creation. Its 12 desktop/phone sale/phone-layout scenarios pass with the original source/finance/stock/authority assertions unchanged. Final full CI is tracked on PR #29.

## P1 K8 — one paid/free product with exact source money

1. Import/read a fictional or private local invoice with the same actual product on a paid and zero/blank-cost row. Keep real invoice bytes outside GitHub and fixtures.
2. Open its single merged line. As Floor Worker choose each free-case answer on a fresh draft, inspect the free tag / actual division math / supplier-difference explanation and retain the original viewer.
3. Confirm the line and totals. As Manager post the invoice, open Approvals, inspect the original receiver/choice and approve. Check one Product, correct physical quantity and unchanged paper total.
4. On a paid/free shortage, allocate actual missing/refused member quantities. Receive the free units first and verify no payable restoration; receive paid units and verify only their original cents return. Both members may share a delivery document reference.
5. Create split returns from a grouped receipt; expected credits remain capped at the exact acquisition amount. Recovery/cancellation and actual supplier credit retain their ordinary separate meaning.

Local verification passed 1,165 affected tests, lint/build and all 12 EN/FA desktop/phone cases with actual Floor answer, retained original/hash, Manager Post, visible receiver/choice and genuine approval. No skips or retries. Independent money/privacy review is clear. The final navigation-baseline composition additionally passed 134 focused group/acquisition/live-source/price/audit tests and a fresh build; full CI is tracked on PR #29. Counted groups are supported; grouped weight and posted monetary/date/lot correction edits are conservatively denied.

## P1 F1 — explicit retained simulation provenance

1. In a practice browser profile using Simulated mode, open Invoices → New invoice. Read the prominent warning before selecting Photo or PDF.
2. Cancel the native picker: no blank invoice is added. Choose a wholly fictional image; its review clearly says the uploaded invoice was not read and fictional values were used.
3. Save Live in Settings → Receiving, reopen that simulated invoice and reload. Its warning stays visible.
4. Start a new fictional Live invoice and explicitly read it. Its review has normal Live provenance and no simulation warning. Automated responses are intercepted fictional examples; physical-reader rehearsal remains on the actual device.

Local source verification and independent integrated CI are recorded on PR #29.

## P1 F2 — exact localhost reader fallback

1. Open Settings → Receiving. With no saved custom address, Reader address is exactly `http://localhost:5191`.
2. Enter the reachable address of the actual reader computer if needed, test the connection and save it. Reopen settings: that custom address remains.
3. Click Reset, then Save changes and reload. The address is again `http://localhost:5191`; the selected reading mode is retained.
4. Change only the mode through the Manager Demo control. A saved custom address is preserved. Automated health checks are fictional; keep provider keys only in the reader kit.

Local source verification and independent integrated CI are recorded on PR #29.

## P1 F6 — one protected category choice for current NEW products

1. Use the existing guide's Node 22 install/build/preview steps and open `http://localhost:5174`. Keep the real reader kit running separately; no new provider call is needed for the category operation.
2. Read/import an unposted fictional invoice with at least two genuinely new products, ideally with an unchanged known product beside them. Open its Needs review record as the permitted Floor receiver or Manager.
3. Beside **Invoice lines**, click **Set category for 2 new products**. Choose a configured category. Cancel once: nothing changes.
4. Reopen, choose the category and click **Set category**. Exactly those two NEW rows show it; the known row stays unchanged. Each NEW row still needs its other first-time checks. Printed tax and original amounts stay retained; inferred tax may change and ordinary reconciliation remains visible.
5. Inspect Activity/Undo for the real receiver and restore the category choice if desired. A dialog left open while another genuine edit changes its invoice must keep the selection and explain that the receiver must close/review/reopen before saving.
6. Repeat in Persian on a phone. The dialog's primary action must remain visible, the NEW rows stay amber and the page must not overflow horizontally.

The K8/F6 composition passed 218 tests, full lint/build and all six real EN/FA desktop/phone mixed-row/stale cases without skips/retries. Valid group choices survive the intended category edit; previously stale group evidence does not. Integrated full CI is tracked on PR #29.

## After the demo — record only

- Read a supplier's order-confirmation/pre-invoice PDF into an expected order, then use that reading when the invoice arrives.
- Allow branch-request senders to add also-sending items, alongside Loaded ticks and Mark all as being sent.
- Edit an offer's terms, dates and mix-and-match membership in place.
- Schema v3 may suggest brand/name for a person to confirm.

Automated examples use fictional media and intercepted reader responses. Real-kit, physical camera and local-network rehearsal remain on Ali's devices. No merge, force-push, provider-key integration, paid resource or deployment is part of this request.
