# R2b: receiving, import and invoices

These steps use only invented documents in [the main fictional export](../prototype/tests/fixtures/r2b-fictional-readings-export.json) and [the staged matching export](../prototype/tests/fixtures/r2b-matching-readings-export.json). The main file contains eight fictional invoices, nine item lines and embedded fictional PNG originals; the matching file contains three separate invented papers. Neither is based on a private invoice. The guide describes the implemented behavior; final exact-commit CI results are recorded in PR #29 and its latest checks.

[PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29) remains unmerged. Keep real exports, names, amounts, photos and screenshots outside GitHub.

## Run locally

Use Node **>=22.22.2 and <23**. From your existing checkout:

```sh
git fetch origin
git switch feat/prototype-r2-receiving
git pull --ff-only origin feat/prototype-r2-receiving
cd prototype
npm ci
npm run build
npm run preview
```

Open `http://localhost:5174`, or the displayed Network address from a phone on the same Wi-Fi. Restart preview after every rebuild. No deployment or merge is needed.

Sign in as Owner, choose North York (the fictional fixture's `Branch 1`) and English. For an isolated run, Settings → Data → Remove fictional data… → inspect Keeps/Removes → type DELETE → confirm. This explicit reset preserves configuration, locations, people and sign-in. It is separate from JSON import: adding a JSON invoice must never erase existing business records.

Settings → Data → Choose file… → select `prototype/tests/fixtures/r2b-fictional-readings-export.json` → AI reading → check all eight destinations → Import 8 invoices → Open Needs review. New invoice → JSON file is the additive alternative in item 3.4.

Keep **BFP-0810 and the main review examples unposted until the review, phone and Persian checks are finished**. The separate matching sequence in 1.10 deliberately posts MATCH-1 first. Open a draft from Needs review by its invoice number. On phones, expand Invoice details with its chevron; use Received → Change and Totals → Edit when needed. A field's ! explains its question. Use Looks right only after comparing the fictional original.

## Fictional papers and expected starting values

Dates/times below are in the configured company timezone. Currency fallback follows company settings; with the unchanged demo configuration it is CAD.

| Invoice  | Supplier               | Expected starting facts                                                                                                                                                                                                                                                                                                                              |
| -------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BFP-0810 | BLUEFINCH PANTRY INC.  | Invoice 2026-08-10; handwriting Received **2026-08-12 09:20**; Due upon receipt → COD, due **2026-08-10**. Only total supplied: subtotal **32.00**, tax **0.00**, total **32.00**; filled amounts are Calculated. One CTN × 8, case cost **32.0000**, unit cost **4.0000**.                                                                          |
| WJG-0811 | Willow Jet Grains Ltd. | Invoice/Received **2026-08-11 12:00**; NET 45 → due **2026-09-25**; printed **USD** retained. Highground Rice, **4 × 5 lb** pack; 0.5 case becomes **2 units**, cost **4.6000**, line/subtotal/total **9.20**, calculated tax **0.00**.                                                                                                              |
| BFP-0818 | BLUEFINCH PANTRY INC.  | Invoice/Received **2026-08-18 12:00**. Blank terms infer COD from earlier BFP-0810, flagged for checking. Plum Preserve: **6 × 330 g**, case **12.0000**, unit **2.0000**, line **12.00**. Second line offers **Orchard Fig Preserve**, pack **5 × 150 g**, case **5.0000**, unit **1.0000**, line **5.00**. Subtotal/total **17.00**, tax **0.00**. |
| FVP-0819 | Fable Vale Produce Co. | Invoice 2026-08-19; handwriting Received **2026-08-20 13:40**. COD replaces the contradictory due date with **2026-08-19**, flagged. Summer Squash **1.375 kg × 11.0000/kg = 15.13**. All header totals remain blank and need entry.                                                                                                                 |
| OFG-0820 | Opal Fern Grocers Ltd. | Invoice/Received **2026-08-20 12:00**; Net 30 days → due **2026-09-19**, flagged instead of the contradictory printed date. Fresh Red Peppers **2.25 lb × 4.3000/lb = 9.68**; printed subtotal **9.68**, tax **1.26**, total **10.94** remain unchanged.                                                                                             |
| FVP-1220 | Fable Vale Produce Co. | Invoice/Received **2026-12-20 12:00**; Monthly → due **2027-01-01**. Two Garden Herb Sauce at **3.2500**, subtotal **6.50**, tax **0.00**, calculated total **6.50**.                                                                                                                                                                                |
| WJG-0822 | Willow Jet Grains Ltd. | Invoice/date-only handwriting Received **2026-08-22 12:00**; Other **17** days → due **2026-09-08**. Summerberry Jam **3 × 125 g**, two BOX cases, case **5.1000**, unit **1.7000**, subtotal/total **10.20**, calculated tax **0.00**.                                                                                                              |
| BFP-0823 | BLUEFINCH PANTRY INC.  | Invoice/Received **2026-08-23 12:00**; Weekly → due **2026-08-30**. Printed code/name **CARROT 24**, one CS × 24, case **24.0000**, unit **1.0000**, total **24.00**. This is one paper, not the two-import rename test.                                                                                                                             |

Supplier tax number and line barcode are explicitly AI-flagged but empty in this fixture. Ordinary unflagged optional blanks stay quiet. The file has **no in-file duplicate pair** and **no saved checked answers**. Separate existing fictional tests cover those scenarios; do not expect them to appear by importing this file alone.

## Group 1 — import fills in what it can

### 1.1 — Received dates describe the delivery

Open BFP-0810: Received is 2026-08-12 09:20, from handwriting, not the time you imported. Open WJG-0811: Received is invoice date at 12:00. Inspect each ! explanation, then Change to see date/time/receiver in the small popover; Done closes it. Manual entry and simulated Photo/PDF still use now. After posting BFP-0810 later, Received and Last delivery use its delivery date while import/post History retains the actual action time.

### 1.2 — Missing currency uses configuration

Check BFP-0810's currency against company settings. WJG-0811 keeps USD from the paper and may show a company-currency comparison warning. No exchange-rate conversion or rewritten invoice amount is implied.

### 1.3 — Missing totals are filled or precisely explained

BFP-0810 shows 32.00 subtotal/0.00 tax/32.00 total; WJG-0811 calculates tax 0.00; FVP-1220 calculates total 6.50. Derived amounts carry Calculated · not on the paper until checked. FVP-0819 opens Totals in Edit with all three amounts blank. Attempt Post and use the tax message's Show: the tax input is marked and focused. For this fictional exercise, enter subtotal **15.13**, tax **0.00**, total **15.13**, then compare and Looks right. Printed OFG-0820 amounts must not be silently replaced by line arithmetic.

### 1.4 — Terms and due dates

Check the table's COD/Net 45/Net 30/Other 17 dates. On FVP-1220, Monthly gives 2027-01-01; selecting Net 30 gives **2027-01-19**. Select Monthly again to restore the paper. Other puts Number of days inline beside the selector in the same 44px row; Due date/Location stay level. Corrected contradictory due dates and inferred terms remain questions.

For a separate staged history check in a fresh isolated browser: first import only BFP-0810. Reopen the file and import only BFP-0818; it infers COD from that strictly earlier same-supplier invoice. BFP-0823's later Weekly terms must not win. Earlier selected papers in one batch also count, so importing all eight already exercises this. A separate first import of BFP-0818 alone has no history: terms stay blank and flagged, rather than inventing a default. Do not reset your main review session to do this optional separate run.

### 1.5 — Names, packs and printed evidence

Open WJG-0811: clean name Highground Rice, pack 4 × 5 lb, pack count 4; More details retains `71011 HIGHGROUND RICE - 4 x 5 lb / Case` exactly. BFP-0818 line 1 is Plum Preserve, pack 6 × 330 g. Line 2 offers Use 'Orchard Fig Preserve' as the name; click once and check it saves. Its printed description remains `Box of 5 x 150g`. An uncertain split remains a name question.

### 1.6 — Missing codes have honest provenance

BFP-0818 line 1 has code Plum Preserve with muted Filled from the name. It is not an amber code question. WJG-0811's printed code **71011** and BFP-0810's **BF-HZ8** remain unchanged. Save and reopen to verify the inferred/printed distinction survives.

### 1.7 — Supplier contacts and readable legal name

Open BLUEFINCH PANTRY INC. → Edit supplier. Address is **12 Fictional Lane, Exampletown**; Phone **+1 (416) 555-0142**; Email **billing@bluefinch.example**; Website **https://bluefinch.example**. These are invented reserved-example contacts. Accept the suggested **Bluefinch Pantry Inc.** if desired; Inc. stays and later invoices still recognize the supplier. Save/reopen. Contacts remain optional; existing curated details are not overwritten by subsequent papers.

### 1.8 — Cases, fractions and weights

BFP-0810 CTN and BFP-0823 CS mean Cases; WJG-0822 BOX means Cases. WJG-0811's half case is exactly 2 units at 4.6000, retaining the 9.20 line total. FVP-0819 and OFG-0820 use kg/lb quantities and costs with no Units per case field. With unchanged company pricing and Grocery selected, the kg example's canonical cost is **4.9895/lb** and proposed price **7.49/lb**; the lb example proposes **6.49/lb**. Source display remains 11.0000/kg or 4.3000/lb. Other company/category settings legitimately change selling prices, not source evidence.

### 1.9 — Acknowledge an explicitly flagged absence

In BFP-0810 details More details, use **Not on the invoice** beside the empty Supplier tax number !. Open line 1/More details and do the same for Barcode. These shared label actions are 32px; labels/fields must not shift. The inputs stay empty, markers/counts clear and reopening keeps them clear. History/check receipts record who/when and the absence. Ordinary unflagged blank lot/expiry/note fields have no question. Required fields cannot be dismissed this way. More details auto-opens only for **nonempty** hidden questions; an explicit Next/Show may reveal an empty flagged one.

### 1.10 — A rename survives the next supplier import

Use `prototype/tests/fixtures/r2b-matching-readings-export.json`, which has three invented originals. You can add these to the main review session; do not remove its data. The main eight-paper file has only one CARROT 24 paper and cannot prove this sequence.

1. Settings → Data → Choose file… → select the **matching export** → keep AI reading → select **only MATCH-1** (untick MATCH-2 and MATCH-3) → set North York → Import 1 invoice → Open Needs review → MATCH-1. Check its Northstar Test Foods original: one case × 24, case cost **30.0000**, unit cost **1.2500**, total **30.00**. Check details/totals, open the line, choose Grocery and Confirm line. Resolve any remaining named requirements, then Post invoice → confirm.
2. Products → open its **CARROT 24** product → Edit → change English name to **Crafted Carrot Jam** (optional Persian: **مربای هویج آزمایشی**) → Save product. Keep the same product; do not create another one.
3. Settings → Data → choose the **same matching export** again. MATCH-1 is Already in the app. Select **only MATCH-2**, Northstar Test Foods → Import 1 invoice → Open Needs review → MATCH-2 → open its line. Matched product is Crafted Carrot Jam and explains **Matched to “Crafted Carrot Jam” from an earlier delivery.** Its printed description stays CARROT 24; the existing product identity survives the rename. Leave this draft unposted.
4. Reopen the matching export once more and select **only MATCH-3**, Elmwood Test Supply → import/open its line. It offers the same product through the earlier other-supplier evidence and adds **Check the match**. Review that question rather than treating it as an unquestioned same-supplier match. Repeat in Persian/dark on phone if desired.

[r2b-matching.spec.ts](../prototype/tests/r2b-matching.spec.ts) uses these exact fictional papers for the staged workflow and verifies retained product identity and the fallback question.

## Group 2 — review works end to end

### 2.1 — Original remains loaded and typing stays intact

Leave BFP-0810's original visible and edit a line. The original does not flash through a skeleton or replace the loaded image. For a safe fictional rapid-typing check, choose Units, enter **20** quickly as invoiced and delivered quantity, leave the field and reopen: it stays 20. Restore Cases **1**, pack **8**, case cost **32.0000** afterward. Type a decimal cost quickly and restore it too. Actual file/page changes still update the viewer; losing permission clears it. [r2b-original.spec.ts](../prototype/tests/r2b-original.spec.ts) instruments zero placeholders/img replacements during ordinary edits.

### 2.2 — Checks really clear and Next reaches them

On BFP-0818 line 2, apply the name suggestion or edit a highlighted field. Reopen/refresh: it remains checked in saved data. Confirm a valid line once to acknowledge its remaining checks. Next to check focuses the next open question, including details, totals and safe extra-reading fields. Counts use only outstanding questions and correct English/Persian wording; the compact line status retains its accessible count without inflating every long row. Confirm/Close keep the same row; no other line is automatically opened.

### 2.3 — Posting names the exact fix

Before filling FVP-0819 totals, Post explains the empty Tax and how to enter 0.00, then Show opens/focuses Tax. Invalid terms, lower-cost follow-up fields and order differences likewise point to their actual controls; narrow order rows expand before focus. An incomplete attempt explains requirements without saving/posting. Permission-denied and actively reading states remain disabled. Canonical no-write and rendered-target cases are in [r2b-blockers.spec.ts](../prototype/tests/r2b-blockers.spec.ts); the shared file does not itself contain orders/lower-cost history, so do not expect those extra blockers in it.

### 2.4 — Readable, level details

Expand details/More details: Bill to/Ship to are two-line textareas. This fixture has a short bill-to value; paste a long **invented** address if you want a manual wrap check, then restore it. Other/Number of days remains one 44px row, level with Due date and Location at 1000px. Edited receiving/correction groups opt in to shared `ui-form-surface` white/surface fields with normal borders; unrelated fields keep their foundation styling.

Before posting, repeat the relevant review at **1440px, 1000px and 390px**, in **light/dark and English/Persian**. Check no sideways page/table scroll, visible status, readable labels and original, white attached editor, level controls, top-layer sidebar tooltip and AI hints above inputs. On phones, Confirm stays visible and Yes → No date collapse does not move the control; deliberate touch scrolling still works. Do not post until these checks are complete.

## Group 3 — post, inspect and correct

Prepare BFP-0810: compare its paper, choose Grocery for its new product, confirm its line, check details and totals, and resolve the remaining optional questions. To exercise the posted handwriting action, **only in this fictional test**, first use Received → Change to set **2026-08-11 12:00**; Done and check details. This intentional difference lets you restore the handwriting after posting.

### 3.1 — Posted count and list agree

Post BFP-0810 and confirm the posting dialog. Invoices → Posted at North York shows it within one second; the count and row agree. All locations shows it exactly once. Reopen and Back; it stays present. Draft/workspace and saved copies are de-duplicated by invoice ID.

### 3.2 — Posted page retains the evidence

BFP-0810 has the original on the right from 1180px, supplier link, location/date/Posted badge and top-right Correct invoice/Move invoice. Its line reads one case × 8 · 8 units, cost 4.0000 and total 32.00; totals are aligned rows. No tracked-date column appears without actual tracked dates. Its shared-fixture Reading notes list is empty, so no notes disclosure is expected here; [r2b-group3.spec.ts](../prototype/tests/r2b-group3.spec.ts) and `src/screens/PostedInvoice.r2b.test.tsx` supply fictional notes/tracked dates for those checks.

The handwritten row shows Aug 12, 2026 / 9:20 am. Because of the deliberate pre-post date above, click Use as received date: Received becomes **2026-08-12 09:20**. Received/Deliveries and supplier Last delivery use that effective date; History records an attributed metadata correction. Original files, posted source, money and physical event records remain retained; payable remains **32.00**. If you left the original default unchanged, expect Used as received date instead of an action. Move invoice may be inspected and cancelled without moving this test record.

### 3.3 — A correction is staged and reasoned

Correct invoice → all lines start closed → open the line. Enter case cost **40.0000**: unit cost is **5.0000**. This is staged; Cancel leaves the posted total **32.00**. Reopen, repeat, and click Preview correction without a reason: it explains/focuses Reason. Enter **Correct the fictional case cost**, preview and check old → new plus payable **32.00 → 40.00**, delta **8.00**, with no receipt-quantity change. Continue → Confirm correction appends the version/delta once; original source/files/history remain. No/Yes order is consistent. Pending prices remain proposals.

Nonterminating case-cost division, invalid local cost, stale preview, archived-product switch-away/back and converted-case-basis safety are covered by `src/invoice-corrections-c4.test.ts`, `src/screens/Invoices.c4.test.tsx` and [r2b-corrections.spec.ts](../prototype/tests/r2b-corrections.spec.ts); they are not extra papers in the shared file. Do not change real money to reproduce them.

### 3.4 — Four ways to add without clearing

Invoices → blue New invoice → Photo (AI reading), PDF (AI reading), Manual entry, JSON file. Photo/PDF are still simulated; their pickers accept the correct file type. Choose a concrete location for Photo/PDF/Manual. JSON is available to authorized importers even with All locations selected; destinations are checked in preview.

Choose JSON file and reselect the shared file: already imported papers are disabled as Already in the app, and existing invoices/products/receipts/ledger remain. Cancel. To see a new additive import, use a fresh session, first import only BFP-0810, then New invoice → JSON file → select the same file and import one different paper, such as WJG-0811; the earlier invoice stays and the new draft opens. The in-file duplicate-choice example is the separate `tests/fixtures/r2-fictional-readings-export.json`, which contains competing copies of **R2-FICTIONAL-025**. [r2b-invoice-entry.spec.ts](../prototype/tests/r2b-invoice-entry.spec.ts) exercises it without clearing anything.

## Group 4 — the two dialogs

### 4.1 — Empty store is clear and gated

Inspect this at the **end** or in a separate browser so you do not erase the review run. Settings → Data → Remove fictional data…. On desktop it is wide enough for the Keeps/Removes lists; on phone it fits the viewport. Focus the empty input: its ring clears the footer divider. The normal label emphasizes DELETE (حذف in Persian); the disabled destructive button is visibly red at reduced opacity. Only the exact phrase enables it. Cancel preserves all records. Test actual removal only deliberately in the isolated session.

### 4.2 — Import preview tells one truth

Choose the shared file in an isolated session: each row has Ready or Ready · N to check, normal Location fields, separated dots, consistent thumbnails and a short source-switch explanation. Checked mode falls back to AI for these papers because they contain no checked answers; it must not claim Checked by you alongside unresolved questions. Use the separate R2 duplicate fixture for Same invoice twice in this file. The fixed dialog frame stays stable while source/selection changes; Status remains visible on phone and desktop.

## Defaults and limits to report

- Historical imports use clear handwriting in company time, otherwise invoice-date local noon; date-only notes use noon and omitted years use the invoice year. Ambiguous/competing/expiry/phone dates are not guessed; absent valid dates remain blocked. **Ali still needs to confirm this requested migration default.** Live/manual use now; action/audit time remains actual time.
- Missing currency uses configuration; explicit paper currency wins. Missing totals are derived only from supplied compatible values, never guessed from a tax category. Negative/impossible derivations remain a field to resolve.
- Usual terms come from the latest strictly earlier same-supplier recognized invoice/selected paper, with lexical invoice-number/ID tie-break. No history leaves blank terms plus a check. Monthly is calendar next-month first; Net 30 is 30 days.
- Unknown brand prefixes stay; explicit packs win. Nested/conflicting packs remain questions. Fractional cases convert only to exact positive whole units, never rounded units. Exact imported case basis is retained until meaningful cost/pack changes or explicit reentry; client conversion metadata is not trusted.
- Extract only unambiguous contact values and preserve curated contacts; extra evidence stays in the address/raw reading. Title Case is a suggestion preserving legal suffix.
- Ordinary blank optional evidence is quiet. An explicitly flagged empty optional field stays a check until edited, confirmed or acknowledged Not on the invoice with who/when. Required blanks remain blockers. More details auto-opens only for nonempty hidden evidence; explicit Next/Show may reveal empty questions.
- Posted received-date correction is append-only metadata. Financial/physical/source evidence and authority remain protected. Corrections stage locally, require a reason and canonical preview, and apply once.
- Retained R2 responsive variants remain: Original switches at 1180px; Rotate moves into More below a 340px toolbar width; phone action grids deliberately stretch while ordinary buttons remain intrinsic. The 25-line/2700px long-review limit, 2px/F9 stability, keepTyping and Firefox guards remain.
- Separate screenshot comments about the offer picker, notifications and approval styling are tracked separately; this numbered guide does not claim extra scope or results for them.

## Verification

Final exact-commit CI results are recorded in [PR #29 and its latest checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29/checks). All seven checks are required before completion. This guide is not a test-result claim. Keep the existing pricing, financial, permission, canonical-data, original-byte, approval-position and 2px/F9 stability checks; intentionally updated selectors and entry flows do not relax those guards.

Focused fictional browser examples are [r2b-import-group1.spec.ts](../prototype/tests/r2b-import-group1.spec.ts), [r2b-matching.spec.ts](../prototype/tests/r2b-matching.spec.ts), [r2b-original.spec.ts](../prototype/tests/r2b-original.spec.ts), [r2b-checks.spec.ts](../prototype/tests/r2b-checks.spec.ts), [r2b-blockers.spec.ts](../prototype/tests/r2b-blockers.spec.ts), [r2b-details-layout.spec.ts](../prototype/tests/r2b-details-layout.spec.ts), [r2b-group3.spec.ts](../prototype/tests/r2b-group3.spec.ts), [r2b-corrections.spec.ts](../prototype/tests/r2b-corrections.spec.ts), [r2b-invoice-entry.spec.ts](../prototype/tests/r2b-invoice-entry.spec.ts) and [r2b-dialogs.spec.ts](../prototype/tests/r2b-dialogs.spec.ts). Physical phone/Safari/printer results must be reported separately from automated browser proof.
