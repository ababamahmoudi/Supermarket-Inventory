# Source and trace diagnoses for final e47 native run

Read-only diagnoses against `/tmp/e3-complete-final-proof-v2/source` and actual retained Playwright traces. No tracked source edits or heavy tests were performed by this agent. The parent owns all proposed adaptations and actual bounded verification. These notes are diagnoses, not successful rerun claims.

## C8 backup failure fixture was not unloaded

`c8-migration.spec.ts:52–77` assumes `page.route` serves an inert setup document before deleting only authority IndexedDB. Actual trace network shows the setup document is9039-byte Vite app index, title`Supermarket demo`, module`./assets/index-DX541Ird.js`. The request has a service-worker-owned network fetch reference. E3 navigation worker delegates `fetch(request)` (`pwa-build.ts:85–86`), bypassing the page-scoped fixture route. The test therefore removes its database and writes legacy raw while a real app instance is bootstrapping, before installing its failure observer. The observed ordinary C8 Saved Market sign-in does not prove a swallowed migration fault.

Actual failure propagation is intact in source: `e1-bootstrap.ts:334` awaits exact backup; runtime131 awaits the importer and573–576 rethrows; Store270–278 sets storage failure and clears actor; Store748–757 renders actionable status outside the authenticated child. Preserve all original backup-failed/no-publication/exact-raw/no-canonical/no-private-original and recovery oracles.

Root selected the robust narrow setup repair: await unregistering current test registrations, unload into about:blank, then load the original intercepted inert same-origin fixture and assert its actual title, no module script and no topbar before authorityDB deletion. Production service-worker policy and independent PWA tests stay intact. A context-level route alone was only an unverified alternative and Root rejected relying on it. After a real failed first import, recovery should perform the real reload prescribed by its banner before normal sign-in if actual bounded evidence confirms hash-only navigation does not restart the failed Provider.

## Labels designer reloaded before second save committed

`labels-b.spec.ts:74–78` fills width60, clicks Save, then immediately reloads. Actual trace times: fill1360397.130ms, Save1360428.031ms, reload1360514.964ms, approximately87ms after the click. The loaded template still has the previous saved width70. All earlier12-label capacity, x11 calibration, printed12 alignment boxes,210×297mm sheet and print-call-count1 assertions passed.

`TemplateDesigner.save` awaits the real command before setting saved=true (`screens/Labels.tsx:824–858`); number edits clear saved=false; the existing exact `Template saved.` status appears only after completion. Wait for that real success after the changed width, optionally poll the same canonical template width60/offset1, then retain the original reload and exact width/offset assertions. No timeout, geometry or production persistence change is justified by this trace.

## Activity negative unit control no longer recognizes the unit it deliberately breaks

`layout-proof-c6.spec.ts:152` retains the exact first real Activity unit-text node, strips unit markup, then forces width18px. Trace call1271 returns original text`Stainless Steel Pot 24 cm` and original `.unit-fragment` markup around24cm. Clean report lists24cm on one line. Production correctly added cm/mm protection.

The raw-text inspector regex in `scripts/c6-layout-proof.mjs:74` omits cm andmm. Consequently the deliberate split produces actual content-overflow failures for Stainless/Steel/Pot/cm, but never a plain-text unit record24cm, so the required split-specific negative assertion fails. Add cm|mm to that detector, preserving all range, line, glyph, overlap, containment and control thresholds and the unchanged negative assertion. Changing the selected product to avoid24cm or dropping the negative control would weaken coverage.
