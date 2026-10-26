# R2c approval review

## 4.1 Compact approval rows

Each request uses a blue product link with size/category/supplier/code evidence, one type/status badge group, Unit cost/Price/Margin and a single muted location/creator/invoice source line. First prices say first price; changed prices retain the previous amount and percentage. A margin below the configured category minimum is amber and labelled. Decision actions are ordered Edit and approve, plain danger Reject, primary Approve, with an 8px gap and 44px targets. Specialized margin/manual/collision decision guards and decided evidence remain.

Test: Approvals → Pending, compare a new product and a price change; inspect a below-minimum request and phone/FA views. Product names and the source invoice open their real records.

## 4.2 Full staged product editing and approval

Edit and approve opens the existing ProductEditor with the proposed selling price and category, EN/FA names, size, date tracking, barcode, supplier and supplier code, and tax choice. Fields stay local until Save and approve: one current-authority transaction validates the full product, original proposal/supplier/pricing snapshot, actual cost, selling scope, tax profile and existing manual/margin decision rules. It then edits and approves with one attributed before/after audit entry. Cancel writes nothing; a rejected/stale/forbidden save publishes no partial metadata, supplier item, price, date or decision.

The category recalculates through the existing Decimal engine; typing a different price is an explicit override. Below-cost/minimum prices require acknowledgment and reason. The existing manual-price review retains its genuine rule/keep choice; margin reviews use the existing keep/propose-and-decide operations atomically. Selling-unit type is retained. New supplier-code metadata keeps old source-code associations and original invoice evidence; a manually changed code loses its inferred marker. Default approval scope is all selling locations; receiving-location-only is available. Existing financial and physical evidence is never rewritten.

Test: Approvals → Pending → Edit and approve. Edit names/size/category/tax/barcode/supplier code, Cancel, reopen and verify nothing saved. Repeat, choose Save and approve, then inspect Product, History and Approvals → Approved. Try a duplicate barcode or below-margin price: the form stays open, explains the fix and leaves canonical records untouched. Return to the list at the same scroll position.

Automated: approval-product-editor.r2c.test.ts (26 domain/security/atomicity cases), approvals.r2c-ui.test.tsx (ordered rows, full shared-editor cancel and atomic save).

## 4.3 Invoice approval review dialog

The invoice batch review uses the standard icon/title/description/footer, with Cancel then a counted primary action. Its compact table shows select-all, Product, Category, Unit cost, Price and Margin. Below-minimum rows use a light amber tint and explicit label. Individual-review-only requests remain disabled and explained. Select-all acts only on eligible rows. Phone rows retain every value and checkbox directly, with no unexplained chevrons or hidden-column actions.

Saving keeps the dialog open while the current snapshot/authority/selected batch is validated; errors stay in the dialog and publish no subset. The same canonical batch command, approval scope and scroll-position protection remain.

Test: open an invoice group’s Approve all… button, toggle select-all, deselect one product, inspect costs/prices/margins and the primary count, then approve. Only selected eligible products change; Cancel changes none. A stale batch stays open with a refresh message.

## Validation

- Production TypeScript/Vite build and targeted ESLint/Prettier checks pass.
- 76 focused domain, financial read model, audit, shared product editor, date tracking and approval UI cases pass. The new edit/approval domain has 26 cases covering current authority, stale snapshots, all-or-nothing failure, manual/margin choices, supplier associations, audit attribution and unchanged invoice/ledger/stock evidence.
- The fictional browser proof exercises 1440/1000/390px, light/dark, English/Persian (12 variants; 36 captures). It checks full editor Cancel and Save scroll positions within 2px, no canonical writes on Cancel, real atomic product edit/approval, category price recalculation, selected-only batch decisions, source/financial/physical evidence retention, row paints, no overflow and 44px action targets. Narrow C5 exceptions include 32px and invalid-composition negative controls.
- Existing approval browser flows remain in the verification set. The canonical receiving/approval integration keeps its original 2700px layout and 2px scroll bounds; only the checkbox count gains the requested select-all control.

The new browser export contains only independently invented products, supplier, invoice and a newly drawn original page. Uploaded business screenshots and recordings are not committed.
