# R2f approval and original-viewer review

## D6 — Approvals

1. Sign in as Manager or Owner, choose a branch and open Approvals. Compare the ordinary invoice cards and sale request with the approved references.
2. Check the linked primary/other-language names, context, badges, real unit cost or regular price, large proposed/sale price, dates and margin/minimum. At 1440 px every numbers box is 521 px wide and all three numeric values share a baseline.
3. On a phone, Approve fills the top action row; Edit/Change and Reject share the row below. Ordinary controls keep 8 px gaps; in-card controls are 40 px on desktop and 44 px on phone.
4. For a below-minimum price, click Approve before checking its amber acknowledgment. The checkbox receives focus and no decision occurs. Check it and open the normal protected review. Cancel leaves all business records unchanged. Changed costs, price, minimum, person or location require a new acknowledgment.
5. For a sale below the minimum, the existing acknowledgment and below-cost reason checks still control the actual command. Edit and approve remains a full staged form with atomic save. Specialized margin-review Keep/Override and barcode decisions remain available.
6. Use Approve all (N), change the checked rows and confirm a selected subset. Pending counts, reasons, private margins, retained invoice evidence and the reserved footer/Undo behavior remain protected.

Numbers and dates can differ from the reference because the screen uses actual fictional records and the pricing engine. Decided sale requests retain their immutable approved sale terms; an explicitly labelled current regular price is not presented as historical approval evidence.

## D9 — Original invoice viewer

1. Sign in as Manager, choose Branch 1 and open Invoices. Open the first actual invoice and choose Read invoice. At 1440 px compare the original panel with both approved EN/light and FA/dark references: title, file/page subtitle, plain Expand/Hide, four divided toolbar groups and More at the end.
2. Confirm all seven controls fit the 44 px tinted toolbar. At 1000 px the viewer stays above the invoice work; at 390 px open the original from its thumbnail. The phone media and close action remain inside the viewport. The adjacent Add line and Select share a 44 px row.
3. Use Zoom in, Rotate, Fit width and More → Fit page. Previous/Next remains disabled for the genuine single-page fixture. A real multi-page original retains its ordinary PDF/image navigation. Hide then Show the original and open/close Expand.
4. Use More → Download. The new browser proof compares the actual saved bytes’ SHA-256 with the retained original hash and checks invoice total and every line unchanged. Existing original-source permission, stale-source and page-storage tests remain in force.
5. Switch language and theme at 1440, 1000 and 390 px. The toolbar keeps its groups and actual state. The 44 px transparent hit targets preserve the approved 36 px visual icon slots; narrow panes shrink the slots to fit rather than hiding Rotate or requiring sideways scroll.

Executed proof for D6/D9 covers visible EN/FA flows in both themes, strict shared alignment checks, the original byte hash, selected/atomic approval guards, worker sale privacy and the existing geometry oracle’s negative controls. Source-controlled tests retain fictional data only; final screenshots were individually opened for review outside the repository. The D9 oracle’s prior flat 36×36 controls and hidden Rotate are replaced with the approved four groups and all seven 44 px-high controls; containment and no-overflow assertions remain strict.

## CI follow-up — explicit company-default preview fixture

The existing approval-header browser test now explicitly installs its fictional company-default-only product through the native repository fixture and verifies that no branch prices remain before opening the preview. C14's ordinary demo receipts retain actual location prices, so the default seeded product correctly shows an Override removed consequence when an all-location decision replaces them. The original one-group, store-only, no-false-warning, contained-text and shared-navigation assertions remain unchanged. Existing C3 cases continue to verify real branch-override warnings separately.

## CI follow-up — repeat the retained offer's exact scope

The repeated-offer browser test explicitly chooses Company default price to match its retained active offer. Selecting a product with actual branch price evidence correctly defaults a new offer to that branch, which is a distinct permitted scope rather than an idempotent repeat. The test verifies the retained scope, then keeps its original no-new-offer/no-new-History, stop-to-Past and Undo-to-Current checks. Both affected browser cases pass on desktop and phone against the fresh production build; application offer deduplication and permission guards are unchanged.

## Integrated number-slot regression

The shared number-group grid and slot rules are defaults with zero specificity, so the approved composed five-column grid and its responsive slot placement remain authoritative. Desktop approval panels stay 521 px on every card. A baseline alone cannot prove that a label describes the number beneath it: the D6 browser test now checks the actual logical text edges of each label, value and note. On phones it checks cost/price across the top, Margin's label/value below the cost column, and its minimum note in the opposite lower cell, matching the approved design.

The same tests deliberately move a real Price/Margin label into the wrong grid column and widen a real panel by 4 px, require detection, restore the actual component and require a clean result. The existing 1.5 px association/baseline limits, 521 px width, 26 px price, no-overflow and action-order checks remain intact. All four EN/FA desktop/phone cases and four existing worker sale/privacy/acknowledgment cases pass on the fresh integrated production build. Final approved D6 screenshots were copied and individually reviewed at `/tmp/r2f-d6-final-associations/` outside the repository.

The approved phone PNG renders a 20 px card-content inset, overriding the generator snippet's 16 px declaration. The real phone cards now follow the PNG: the card spans CSS x16–374 and the numbers panel x36–354. This was confirmed directly from the reference's 2× pixels and the production capture's 3× pixels. The browser regression measures the actual heading, numbers panel and full-width Approve edges against that 20 px inset, deliberately restores the old 16 px inset to prove failure, and then restores the approved result. All eight D6/worker cases remain green after this correction.

## CI203 — Native commit and completed approval review

The individual-review component case now holds delivery of the actual accepted native repository result after its real authority-checked write. While held, it verifies the one selected approval is canonical, the other three approvals and their individual reasons/choices are unchanged, and the modal stays busy with its actions disabled and individual rows unchecked. Releasing that result lets the real derived reconciliation and authorized refresh finish; the existing DOM-readiness observer waits for the actual modal close, and the test rechecks all canonical outcomes afterward. Test timeouts, retries and production command/permission behavior are unchanged. This distinguishes a published write from full UI completion under concurrent unit-file load.
