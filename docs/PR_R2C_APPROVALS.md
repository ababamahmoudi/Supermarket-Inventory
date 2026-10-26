# R2c approval review

## 4.1 Compact approval rows

Each request uses a blue product link with size/category/supplier/code evidence, one type/status badge group, Unit cost/Price/Margin and a single muted location/creator/invoice source line. First prices say first price; changed prices retain the previous amount and percentage. A margin below the configured category minimum is amber and labelled. Decision actions are ordered Edit and approve, plain danger Reject, primary Approve, with an 8px gap and 44px targets. Specialized margin/manual/collision decision guards and decided evidence remain.

Test: Approvals → Pending, compare a new product and a price change; inspect a below-minimum request and phone/FA views. Product names and the source invoice open their real records.

## 4.2 Full staged product editing and approval

Edit and approve opens the existing ProductEditor with the proposed selling price and category, EN/FA names, size, date tracking, barcode, supplier and supplier code, and tax choice. Fields stay local until Save and approve: one current-authority transaction validates the full product, original proposal/supplier/pricing snapshot, actual cost, selling scope, tax profile and existing manual/margin decision rules. It then edits and approves with one attributed before/after audit entry. Cancel writes nothing; a rejected/stale/forbidden save publishes no partial metadata, supplier item, price, date or decision.

The category recalculates through the existing Decimal engine; typing a different price is an explicit override. Below-cost/minimum prices require acknowledgment and reason. The existing manual-price review retains its genuine rule/keep choice; margin reviews use the existing keep/propose-and-decide operations atomically. Selling-unit type is retained. New supplier-code metadata keeps old source-code associations and original invoice evidence; a manually changed code loses its inferred marker. Default approval scope is all selling locations; receiving-location-only is available. Existing financial and physical evidence is never rewritten.

Test: Approvals → Pending → Edit and approve. Edit names/size/category/tax/barcode/supplier code, Cancel, reopen and verify nothing saved. Repeat, choose Save and approve, then inspect Product, History and Approvals → Approved. Try a duplicate barcode or below-margin price: the form stays open, explains the fix and leaves canonical records untouched. Return to the list at the same scroll position.

Automated: approval-product-editor.r2c.test.ts (26 domain/security/atomicity cases), approvals.r2c-ui.test.tsx (ordered rows, full shared-editor cancel and atomic save).
