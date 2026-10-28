# R2f D3 — weight Product add/edit

The approved weight-product reference uses the existing protected catalog/pricing/package domain. Names, Each/By weight, pricing category, cost/unit, real price/rule card, package rows/live New size, category and supplier form one draft. Descriptions, barcode/unit and actual date tracking remain under More details. Screenshot numbers are illustrative; displayed amounts use actual configured Decimal rules and approved location prices.

## Click review

1. Sign in as **Manager**, choose **North York**, open **Products → Bulk Almonds → Edit** (or the same Product through Lookup). Switch per lb/per kg: the helper changes and returning to lb retains the exact canonical cost. Check language/theme and desktop/phone layouts.
2. In **New size**, type **250**, choose **g**. The Price uses the actual parent-approved/size/container/category calculation. **Add size** stages a row; new code/barcode say **Assigned on save**. The row menu stages Edit or Archive with a reason. A pending archive keeps its row with Undo. **Cancel** writes nothing and consumes no code.
3. Reopen, add a size, **Save product**. If the parent already requires expiry evidence, its existing missing-date message opens **More details**: enter an actual date or make the existing explicit Stop tracking decision. Save assigns the child its own code, checked in-store EAN-13 and derived approved price atomically. New packages default date tracking Off; no expiry/receipt/stock is invented. Reload/reopen to verify. Archive retains identity/history.
4. Change an existing cost. The card keeps the approved price and labels the calculated proposal **Pending**; package rows show pending derived prices. Save, then review in **Approvals**. Only actual approval changes the approved charge/package prices. Retained manual regular prices use the normal **Keep current / Use rule** choice.
5. Change cost, then **Change price**. The genuine price dialog previews margin using that newly typed cost/category. **Apply to draft** changes only the outer draft; outer Cancel discards everything. Repeat and Save to apply the authorized Manager decision together with cost/metadata/package changes. Existing below-margin/below-cost and active-Sale choices remain required.
6. **Products → Add product**, enter a fictional name, choose **By weight**, enter cost and stage packages. **Add product** creates parent and valid children together. Failure allocates no identity and retains the form. If source/pricing settings change while open, reopen before saving.
7. Sign in as **Branch Supervisor**, choose assigned **Richmond Hill**, open the weight Product/Lookup result, **Package sizes**. Package-only editing has no cost or parent metadata fields. Add/edit/archive and **Save changes** use the guarded command. Cashier/Floor Worker have no package write authority.

## Atomicity and evidence

The real authority command checks fresh actor/company/location, parent/children/dates, costs, proposals/Sales and pricing snapshots, then publishes one authority-bound candidate. Cancel, inner Apply to draft, validation failure and stale source publish nothing. Codes/barcodes allocate only at successful Save.

Private manual-cost decisions retain actual attribution and an effective receipt-basis fingerprint: source-line ID, four-place cost, sold-by unit, posting time and later-delivery identity/time. A new genuine receipt, same-line correction or later Short delivery supersedes it. The editor never rewrites original invoices, movements or payables. Each child's private cost/margin uses current actual parent cost at that branch. A branch without local receipt/manual evidence retains the existing company-level latest-known-cost fallback; another branch's actual receipt wins.

An unrelated pending invoice-price review is decided before a new cost edit. A same-scope earlier manual-cost proposal may be superseded; another branch's pending proposal is preserved. A concrete branch cannot partially replace an existing All locations review. Explicit Manager regular-price decisions reuse existing authority without a redundant second approval. Package own-Sale conflict/Keep/Change/End remains unchanged.

## Validation

`src/weight-product-editor.r2f.test.ts` uses real repository initialization/sign-in/commands, protected package creation, invoice posting/correction/later delivery and real approvals. Coverage includes private branch costs, immutable evidence, pending/approved prices, staged explicit price, manual Keep/Rule, stale configuration, full rollback/fresh allocation, branch review scope and Supervisor financial masking/denials.

`tests/r2f-weight-product.spec.ts` drives actual UI Cancel/Save/package lifecycle/reload, lb/kg conversion, new parent/package, staged price/Cancel/Save and strict R0 alignment plus ≤2px typing/Add size/cost-unit/HowSold at 1440/1000/390 in EN/FA light/dark. D3 has no alignment exception. Actual final approved reference variants are captured and visually inspected. Existing pricing, product/date editor, manual-entry, selling-price, package and cost-history assertions/budgets remain. Executed results and final integrated 7/7 CI belong to PR #29's combined report.

## Reference differences and defaults

Use the actual selected fictional product and engine amounts instead of the illustration's Sumac values. Assigned on save, pending proposals, archive Undo and optional More details expose real state absent from a static picture. The Size header aligns with size glyphs after their decorative icon for the strict R0 audit. At All locations, choose a concrete permitted preview location: a company default is not accepted local pricing. The D3 price card uses canonical lb large/kg beneath as approved; normal catalog unit settings elsewhere remain configurable. Physical printer/device checks and a production HTTP backend are outside this prototype change.

Executed on the D3 worktree: **9 affected unit files / 163 tests passed**, including all10 new canonical atomic/source cases; TypeScript and targeted source/test ESLint passed. The strict12-variant matrix (1440/1000/390, EN/FA, light/dark) passed before adding the extra per-variant archive assertion, with actual Supervisor lifecycle and all required typing/Add/unit/HowSold checks. The actual new-parent/packages and staged explicit-price/Cancel/Save path passed on desktop. Final production-preview desktop/phone proof is recorded in the follow-up verification entry and integrated PR report.
