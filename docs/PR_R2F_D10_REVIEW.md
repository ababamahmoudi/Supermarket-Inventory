# R2f D10 — New branch request

The form follows the three approved Branch request pictures and their `source/requests.mjs` composition. It uses the existing branch-request draft/send commands and keeps the list, detail, fulfilment, receipt, print and residual-copy workflows.

## What changed

- Back link, title and explanation; paired Ask this location and Deliver to fields.
- Plain item rows with thin dividers, selected-language names and code/size or Not in the catalog. Quantity is centred at 88px, Unit is 132px and the danger bin is 44px; all three share a 44px centre line. Phones put the name above 72px Quantity, flexible Unit and 44px bin.
- Notes display quietly under the name, with Edit or Add note. The actual inline editor retains shared auto-growing text and Done.
- Full-width product search retains the query after Add. Existing request products show disabled Added, and cannot be added twice. The final genuine action adds the typed description as a free-text item; its 32px plus is centred against both copy lines.
- Cancel abandons local edits; editing Cancel returns to the unchanged draft. Repeated Save/Send activation starts one guarded command. Current actor, company, branch, quantity, pack and immutable-transfer rules remain authoritative.

## Click by click

1. Sign in as Owner or Floor Worker, select North York, then open Branch requests → New request. Check the back link and paired location fields. Select Richmond Hill in Ask this location; Deliver to retains North York.
2. Search `0001`, click Add and leave the search open. The result now says Added and is disabled. Clicking it cannot create another row.
3. Set Quantity to `2` and Unit to Cases. Open the compact pack Edit link and enter `12` units per case, then close it. The quantity still means two cases; the saved normalized quantity is 24 units.
4. Search an invented name such as `Fictional bakery tray`. Click the final Add “…” as a new item row. Set its quantity to `10`, click Add note, type a note and click Done. The item says Not in the catalog and shows one quiet note line with Edit.
5. Click Save as draft twice quickly. There is one draft containing both items. Open Edit draft, change a local quantity and Cancel: the original draft remains unchanged.
6. Edit again and click Send request twice quickly. The existing request becomes Requested once. The receiving location can continue through its existing sending/arrival checklist; no request action changes stock or supplier balances.
7. Start another new request, add an invented item, then Cancel or use the back link. Neither creates a saved record. A Cashier cannot open this form.
8. Repeat in Persian/dark theme and at 1440px, 1000px and 390px. Check column/control centres, mirrored reading direction, no horizontal overflow, the round plus against the complete two-line copy and full-width Send under Cancel/Save on phones. Typing into the focused search must move none of its edges by more than 2px.

## Reference differences and defaults

- Existing configured store branding, real catalog choices, location names and current permissions replace the reference's decorative data. Examples in tests are fictional.
- Deliver to remains pinned to a concrete top-bar location and while editing an existing draft. An authorized person can choose it for a new request from All locations; the redesign grants no extra location access. The shared back link retains its 32px target instead of the reference generator’s intrinsic text height.
- The existing required case-pack editor is retained behind a compact metadata disclosure; missing required catalog pack evidence opens it automatically. Unknown free-text pack evidence remains optional and never invents stock. The design reference does not show this necessary evidence control.
- The live search popup uses the existing bounded/flipping portal. Its measured content height chooses placement, so it can open above near a viewport edge; it never adds the reference generator's artificial empty spacer. Phone names stack above their controls and footer actions follow the supplied responsive composition.
- Genuine actions retain action semantics. C5 qualifies the owned search composition from the actual route, fields, typed query, exact translated copy, Add/Added state, dimensions and icon/copy centres. A shifted plus or forged title fails the same validator. The shared R0 helper has only exact 24px note/pack disclosure registrations.

## Validation

- Unit: 24 tests across `src/screens/BranchRequests.test.tsx` and `src/branch-requests.test.ts` pass. They cover catalog deduplication, exact saved case normalization and note, cancel without writes, existing scope/actor clearing and command permissions/transfer invariants.
- TypeScript (`tsc --noEmit`), affected ESLint/Prettier checks and production build pass.
- Browser: **14/14 affected cases pass** across `tests/r2f-requests.spec.ts` and `tests/branch-requests-c2.spec.ts` on the final application source. It includes the real EN-light/FA-dark draft/edit-cancel/send flow at 1440px/1000px/390px, open-note and search C5, strict R0 portal/row/column/icon measurements, ≤2px typing stability, one input focus border, phone header/footer geometry, shifted-icon/forged-title negative controls, Cashier denial and the existing Warehouse fulfil/receive/close/residual-copy/A4 regressions.
- The new C2 test interactions only open the intentionally collapsed pack/note editors; all existing business, stock, money, immutable print and transfer assertions remain.

Final PR CI belongs to the integrated root branch, not this detached worktree. No merge, push, deployment or real attachment data is included in this child task.

Twelve final form/search images cover the six language/theme/width states. The three approved reference scenes and the extra FA-phone/1000px states were opened and visually reviewed; no final overflow, control-centre, note-centre or glyph-column failures remain. The deliberately preserved differences are listed above.
