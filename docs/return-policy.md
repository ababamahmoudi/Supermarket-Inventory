# Supplier return and shortage policy

**Effective project policy: 2026-10-09 (C no-inventory scope; existing safe-return controls retained).** This is the staff operating procedure for the future Phase 1 app. Step 0.1 only provides development setup; it does not yet enforce these controls. Supervisor means the employee responsible for supplier balances and approvals. The policy covers supplier returns, not customer refunds.

## Before accepting a supplier's return terms

The Supervisor obtains written terms from each supplier and records the version/contact in Suppliers. Confirm accepted reasons, claim deadlines, packaging/condition, collection arrangements, credit versus replacement, tax treatment shown on credit notes, transport fees, and how disputes are escalated. Do not assume every supplier accepts expired/damaged goods or every pickup guarantees a credit. If terms are missing or the deadline is close, alert the Supervisor before promising a settlement. Changes to the supplier's agreement do not rewrite existing claims.

## When goods are set aside

1. Select the correct company, branch, supplier, product, and original receipt where available.
2. Count the actual units, record the reason and storage location, and mark the goods clearly to keep them off the sales floor. Record expiry/best-before/lot details when known; item photos are useful but optional.
3. Create the return once and record the physical set-aside event; do not record a duplicate removal at pickup. Phase 1 shows no stock level/estimate.
4. Keep purchase invoice originals and return evidence linked to the record. Preserve paper originals; a scan/photo supplements or references them. Never discard evidence because a return is closed/cancelled.

## At supplier pickup

1. Open that supplier's outstanding returns for the branch. Check actual lines and quantities with the representative; a partial pickup leaves the remainder at its recorded location.
2. Prepare the retained bilingual **Return memo (RM-0001)** identifying location/supplier/date/return, products/quantities/unit costs/expected credit, driver/representative name and a signature line. Snapshot the pickup details; give the supplier a copy and retain the signed store copy.
3. Obtain the representative's signature **before releasing the goods**. Keep the signed store copy; give the supplier a copy. Attach a scan/photo or record where the retained signed original is filed. If the representative will not sign or quantities disagree, hold the goods and contact the Supervisor.
4. Record pickup time, actual quantities, representative name, signed evidence reference, and signed-in employee. A new purchase invoice is not required. Pickup records collection and a pending expected-credit claim, not a supplier-confirmed financial credit. The configured expected-credit deduction affects only the Supervisor payable projection; preserve the separate claim and original ledger/evidence.

## Receiving a resolution

- **Credit:** obtain the supplier's credit note or invoice showing the credit, its document number/date, referenced return, amount/tax, and affected goods. The worker submits the evidence; the Supervisor checks terms, quantities, duplicate references, and invoice allocation before posting. A return is credited once on one linked invoice. If the promised credit is absent, keep the claim open/disputed; never invent a credit note.
- **Replacement:** count and inspect actual goods received, record the replacement product/quantity, original return quantities it covers, date, receiver, representative, and supporting delivery document/note. Record only replacements actually received as physical receipt events. Replacement receipt does not add an invoice payable. Partial replacement leaves the uncovered return quantity open; different replacement products need explicit coverage, not an assumed one-for-one conversion.
- **Cash or other compensation:** obtain supporting receipt/agreement and submit the claim. Supervisor verifies and records its financial treatment without recording a second invoice credit for the same settlement.
- **Written off / no compensation:** Supervisor closes the uncovered quantity with required reason, evidence of refusal/decision and any dispute note. Release any provisional pickup credit, restoring that expected amount owed; preserve its claim/outcome and do not invent recovery of goods.

Check outstanding pickup/credit claims during each supplier visit and Supervisor review. Waiting-for-credit alert defaults to14 days after pickup and is configurable; deduplicate alerts and resolve them when the retained outcome closes the claim. Keep unresolved disputes visible until the Supervisor records an outcome.

## Cancellation and recovered original goods

Cancelling a record is paperwork; it does **not** prove that goods are in the shop. Before or after pickup, record actual original units physically present/recovered and inspect their condition. Restore only units confirmed safe and sellable by the receiving employee; zero is a valid answer. Do not restore goods still held by the supplier, unsafe/damaged goods, or replacements already counted. Recovery is capped at original units set aside minus earlier recoveries and records its own receipt/event.

Workers may cancel an unsettled return with a reason and disposition of every line. If a replacement or financial settlement has already occurred, request Supervisor review. Keep previous receipts/credits visible. Supervisor documents whether replacements/compensation are retained, returned, or reversed, with supporting evidence and linked corrective entries. Goods already consumed cannot be assigned a fabricated recovery or reverse-receipt event. Never create a second credit, silently erase the first, or restore both originals and replacements by pressing Cancel.

Examples:

- Three leaking juice cartons picked up; supplier still holds all three → cancel records **0** recovered units.
- Two original units recovered, one safe and one damaged → restore **1**; keep the damaged unit excluded with its disposition recorded.
- Two torn rice bags returned, one replacement received → physical receipts include the **1 replacement**; cancellation does not restore the two supplier-held originals. Supervisor reviews any existing settlement before closing the request.

## Missing items on a delivery invoice

Count invoiced, physically delivered, and missing units separately, including units inside cases. Record the shortage on the paper delivery/invoice and request supplier acknowledgement where possible; retain that document. Only actually delivered units enter Received as physical receipts. Only missing units' cost and original tax portion are withheld from Payables. Later partial deliveries need an actual quantity, receiving employee/date, and supporting receipt; only that actually delivered portion enters Received and returns to Payables. The app carries the final rounding remainder so the total withheld/restored amount agrees with the original invoice. The Supervisor closes goods never delivered without issuing a duplicate deduction/credit.

## Record preservation and access

Use personal employee accounts. Workers record physical events and evidence; Supervisors post/reverse money and review settled cancellations. Retain purchase invoices, signed pickup slips, replacement receipts, credit notes, disputes, and correction history together. Restrict financial balances/margins to Supervisors. Backup/retention schedules and a tested restore procedure are required before go-live; evidence is never removed through normal business-record deletion.

## Orders, refused extras and short-dated deliveries (C)

Check the invoice against its linked same-supplier/location order. Ordered-but-uninvoiced missing goods require an explicit Short/Back-ordered/Cancelled decision but create no invented invoice deduction. Unordered delivered extras require Keep (pay and record receipt) or Refused/sent back (exclude payable and Received, retain original evidence and proportional tax). Every difference needs a review decision before posting; one Supervisor alert lists the differences.

A lower-cost short-dated expiry discount requires the actual expiry date and Date tracking, but never changes regular cost/approved selling price or creates a price-change approval. Preserve the actual discounted payable/receipt and price-history flag. Transfers/requests and delivery/return events remain recorded for later inventory; none calculate or show Phase 1 stock.

## C4 payable projection and closing outcomes

Return overview and Supplier Returns use **Open / History** and **Waiting for pickup / Waiting for credit / Closed (Credited, Replaced, Written off) / Cancelled**. Preserve old status/partial-coverage evidence and safe-original controls. Remove the Returned to stock column; Phase 1 has no inventory projection.

**Deduct expected credit at pickup** defaults On. Retain actual pickup expected-credit snapshot and show it separately to Supervisor: confirmed owed $600 less pending $30 = displayed owed570 with pending $30. This is a provisional claim, not proof of supplier agreement, a payment allocation, or an employee-authorized confirmed financial credit. Floor Workers can record pickup/evidence; money remains private and only Supervisor verifies/posts actual settlement.

For **Credited**, require credit-note number/amount/evidence and verify existing one-credit/one-invoice allocation rules. Remove expected deduction and post actual credit once; expected $30/actual $25 yields owed $575, preserving the missing $5 owed. Do not deduct expected plus actual. **Written off** requires reason and releases expected deduction (owed $600 again), keeping all evidence. **Replaced** links an actual replacement delivery/invoice, creates no payable purchase or confirmed credit, and preserves coverage/recovery caps; owner confirmed replacement releases an already deducted expected-credit projection, so owed $570 returns to $600. This release is not a new payable purchase or confirmed financial credit; retain actual replacement/outcome evidence.

A cancellation never erases confirmed settlements or physical pickups/replacements. Previously settled/financially affected records need Supervisor review and appended corrective evidence. There is no Undo for financial settlement; confirmation and subsequent correction preserve audit history.
