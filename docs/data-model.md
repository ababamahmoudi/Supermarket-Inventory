# Data model

Database: PostgreSQL. This document defines entities and rules, not exact column types; the AI developer finalizes migrations and records changes here.

## Conventions

- Primary keys: UUID. Every table has `created_at`, `updated_at`, `created_by` where a person acts.
- Every business table has `company_id`; branch-level tables also have `branch_id`. Enforce scoping in a shared base query layer and test it.
- Money: `Decimal(12,2)` for selling prices, invoice totals, ledger amounts; `Decimal(12,4)` for unit costs.
- No hard deletes. Use status/archived flags or void with a reason.
- Free text and names in two languages: `*_en` and `*_fa` columns (or a translations table). Do not store one language only.
- Use an append-only `audit_log` for sensitive actions.

## ERD (main relationships)

```mermaid
erDiagram
  COMPANY ||--o{ BRANCH : has
  COMPANY ||--o{ USER : employs
  USER }o--o{ BRANCH : "assigned to"
  BRANCH ||--o{ DEVICE : registers
  COMPANY ||--o{ PRICING_CATEGORY : configures
  COMPANY ||--o{ PRODUCT : catalogs
  PRICING_CATEGORY ||--o{ PRODUCT : prices
  PRODUCT ||--o{ PRODUCT_BARCODE : has
  PRODUCT }o--|| AI_CATEGORY : "filtered by"
  COMPANY ||--o{ SUPPLIER : lists
  SUPPLIER ||--o{ SUPPLIER_PRODUCT : sells
  PRODUCT ||--o{ SUPPLIER_PRODUCT : "sourced as"
  PRODUCT ||--o{ PRODUCT_PRICE : "priced at"
  BRANCH ||--o{ PRODUCT_PRICE : "optional override"
  PRODUCT ||--o{ PRICE_PROPOSAL : "proposed"
  PRICE_PROPOSAL ||--o| APPROVAL : "decided by"
  PRODUCT ||--o{ PROMOTION : "offered"
  OFFER_DEFINITION ||--o{ PROMOTION : "defines"
  BRANCH ||--o{ INVOICE : receives
  SUPPLIER ||--o{ INVOICE : issues
  INVOICE ||--o{ INVOICE_FILE : "has originals"
  INVOICE ||--o{ INVOICE_LINE : contains
  INVOICE_LINE }o--o| SUPPLIER_PRODUCT : "matches"
  INVOICE_LINE ||--o| DATE_TRACKING_ENTRY : "may have"
  INVOICE_FILE ||--o{ AI_EXTRACTION_JOB : "read by"
  INVOICE_LINE ||--o{ SHORT_ITEM : "may be short"
  BRANCH ||--o{ RETURN_RECORD : owns
  SUPPLIER ||--o{ RETURN_RECORD : "returned to"
  RETURN_RECORD ||--o{ RETURN_LINE : contains
  RETURN_RECORD ||--o{ RETURN_RESOLUTION : "resolved by"
  BRANCH ||--o{ STOCK_MOVEMENT : "ledger"
  PRODUCT ||--o{ STOCK_MOVEMENT : moves
  BRANCH ||--o{ SUPPLIER_LEDGER_ENTRY : "balances"
  SUPPLIER ||--o{ SUPPLIER_LEDGER_ENTRY : "owed"
  BRANCH ||--o{ NOTE : "notes and logs"
  BRANCH ||--o{ ALERT : "supervisor alerts"
  COMPANY ||--o{ LABEL_TEMPLATE : saves
  BRANCH ||--o{ ORDER : places
  SUPPLIER ||--o{ ORDER : supplies
  ORDER ||--o{ ORDER_LINE : contains
  ORDER ||--o{ INVOICE : "linked receipt"
  INVOICE ||--o{ INVOICE_LOCATION_CORRECTION : corrects
  COMPANY ||--o{ BRANCH_REQUEST : coordinates
  BRANCH_REQUEST ||--o{ BRANCH_REQUEST_ITEM : contains
```

## Entities

### Tenancy, people, devices

| Entity      | Key fields and rules                                                                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `company`   | name, logo, default language, currency, timezone, settings                                                                                                                                                                                                                                                                     |
| `branch`    | company, name (en/fa), stable code/id, location_type (`store`/`warehouse`), address, phone, opening_hours, tax_region, active; warehouse cannot have Cashier access                                                                                                                                                            |
| `user`      | company, name, **username** (unique per company), email (optional; needed only for a future Google sign-in), **one** role (`cashier`/`floor_worker`/`supervisor`), branches, `password_hash`, `must_change_password`, `password_changed_at`, `failed_attempts`, `locked_until`, active, created_by, last_login. No PIN fields. |
| `device`    | branch, name, registered_by, token hash, active (the store computer; enables the "recent users on this computer" list)                                                                                                                                                                                                         |
| `setting`   | company or branch scope, key, value (JSON)                                                                                                                                                                                                                                                                                     |
| `audit_log` | the History: actor, action, entity type/id, branch, before/after (JSON), device, timestamp, `reversible`, `reverted_by_entry`, `reverts_entry`, `undone`                                                                                                                                                                       |

### Catalog and pricing

| Entity                | Key fields and rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pricing_category`    | key, label (en/fa), cost_divisor, rounding mode, apply_special_correction, taxable, date_tracking_prompt                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tax_profile`         | key, label, rate (company-configured), `taxable` flag                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ai_category`         | name (en/fa), created by AI or person                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `product`             | code (unique per company, never reused, allocated beyond every previously assigned company code), name_en/fa, description_en/fa, unit_size, pricing_category, tax_profile, ai_category, status (`pending_approval`/`active`/`archived`), archived_at. Supervisor direct creation is immediately active; worker invoice proposals remain pending. Retain manual four-decimal cost/calculated-price provenance separately from an invoice source.                                                              |
| `product_barcode`     | product, barcode (unique per company; conflict → Approval)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `supplier`            | company, name, status (`proposed`/`confirmed`/`archived`), phone, email, address, sales_rep_name, sales_rep_phone, default_payment_terms, notes, proposed_by, confirmed_by, archived_by/at. Supervisor additions are confirmed; worker invoice quick-additions proposed. Deactivate archives without deleting history and excludes new-invoice choices. **Last delivery** per branch = latest `received_at` of that supplier's posted invoices in the branch (computed, or cached and refreshed on posting). |
| `supplier_product`    | supplier, product (nullable until matched), supplier_sku, supplier_name, positive units_per_case, last_bought_unit_cost (4dp), last_bought_case_cost, last_bought_at, last_invoice_id/number, regular_cost_basis (excludes short-dated), supervisor_quote_unit_cost?/quoted_by/at (separate expected-cost provenance), archived; manual edits and posted invoice snapshots retained                                                                                                                          |
| `product_price`       | product, branch (null = company default), selling_price, effective_from, source_proposal, price_origin (`rule`/`manual`), rule_price_snapshot, manual_actor/time; branch-specific manual provenance                                                                                                                                                                                                                                                                                                          |
| `price_proposal`      | product, branch that triggered it, scope (`all`/`branch`), previous_price, proposed_price, unit_cost, cost_basis (invoice line), source_invoice_id (latest monetary basis), invoice_ids (retained merged evidence), reason (`calculated_change`/`new_product`/`manual_override`/`below_min_margin`/`tax_profile_change`), status (`pending`/`approved`/`rejected`/`superseded`), decided_by/at                                                                                                               |
| `approval`            | generic Supervisor decision: type, target entity, status, decided_by, note                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `offer_definition`    | label ("2 for $5"), quantity, total price, pool key, price it belongs to (1.99/2.99/3.99), editable in settings                                                                                                                                                                                                                                                                                                                                                                                              |
| `promotion`           | product, branch (null = same scope as the price), offer_definition, mix_and_match (bool), start (nullable), end (nullable), active, created_by                                                                                                                                                                                                                                                                                                                                                               |
| `label_template`      | company, name ("Template 1"), width_mm, height_mm, margin_top/bottom/left/right, gap_x/y, offset_x_mm, offset_y_mm (calibration), slot_order (`ltr`/`rtl`), created_by. built_in_kind (`regular`/`promo`/null), rendering_style, archived. Add built-ins idempotently: Regular 60 × 40 mm/margins 10/gaps 4, Promo 210 × 148.5 mm/margins0/gaps0; retain editable geometry, originals and archived rows.                                                                                                     |
| `label_waitlist_item` | branch, product, copies, added_by, added_at, status (`waiting`/`printed`/`removed`), printed_at, printed_by. Shared per branch.                                                                                                                                                                                                                                                                                                                                                                              |

### Receiving

| Entity                | Key fields and rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice`             | branch (original receiving location), reviewer_origin_branch_id/assignment, ship_to_hint?, suggested_location?, supplier, supplier_invoice_number (nullable) + `number_is_system_assigned`, invoice_date, received_at, receiving_user, subtotal, tax, final_total, due_date?, payment_terms?, status (see workflows), blocked_reason?, posted_at/by                                                                                                                                                                                                       |
| `invoice_file`        | invoice, storage key (S3), mime type, page count, uploaded_by. Originals are immutable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `invoice_line`        | invoice, line_no, supplier_product (nullable), product (nullable), description, qty, unit (each/case), units_per_case, unit_cost_before_tax (4 dp), line_total, taxable flag, review_status (`needs_review`/`confirmed`), `date_tracking_required` (bool, confirmed by a person), line_status (`received`/`short`/`short_resolved`/`short_closed`/`refused`), entered_quantity_unit (`cases`/`units`), retained_pack_snapshot, normalized_units, manual_price_decision?, order_line_id?, discrepancy_decisions, short_dated (bool), expiry_discount_date? |
| `date_tracking_entry` | invoice_line, type (`expiry`/`best_before`), date, lot_number?, status (`active`/`cleared`), cleared_by/at. One per invoice line.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `short_item`          | invoice_line, qty_short, deduction_before_tax, deduction_tax, status (`open`/`resolved_delivered`/`closed_not_delivered`), resolved_by/at, note                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ai_extraction_job`   | invoice_file, status (`queued`/`processing`/`needs_review`/`failed`), provider, prompt/schema version, raw_json, error, cost                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `alert`               | branch, type (`same_supplier_lower_price`/`other_supplier_price`/`cross_branch_price_conflict`/`tax_discrepancy`/`barcode_conflict`/`offer_suggestion`/`ai_failure`/`order_differences`), payload (JSON, e.g. worker answers), status (`open`/`taken_care_of`/`pending`/`dismissed`), assigned role                                                                                                                                                                                                                                                       |

### Returns

| Entity              | Key fields and rules                                                                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `return_record`     | branch, supplier, status (`open`/`picked_up`/`partially_resolved`/`resolved`/`cancelled`), created_by, picked_up_at, supplier_rep_name (required at pickup), submitted_by, photo (optional), note                                                                                                     |
| `return_line`       | return, product/supplier_product, qty, reason, location note (e.g., walk-in cooler)                                                                                                                                                                                                                   |
| `return_resolution` | return, type (`credit_current_invoice`/`credit_later_invoice`/`replacement_received`/`cash_or_other`/`no_compensation`), invoice (for credits; a return is credited on at most one invoice), replacement lines (product, qty, date, employee, rep name, photo/note), `resolves` (`fully`/`partially`) |

### Physical movements, payables, notes (no Phase 1 stock projection)

| Entity                  | Key fields and rules                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stock_movement`        | branch, product, qty (signed), type (below), reference (invoice line / return line / note / count / product creation), occurred_at, user. Historical opening/count movements remain preserved, but Phase 1 accepts no new opening/stock-count entries and does not show their sum. Correction and transfer events retain original references.                                              |
| `stock_count`           | Deferred to separately paid inventory phase after register integration; no Phase 1 screen or transaction                                                                                                                                                                                                                                                                                   |
| `supplier_ledger_entry` | branch, supplier, type (`invoice`/`credit`/`payment`/`adjustment`/`opening_balance`), amount (signed), date, reference (invoice/return/supplier creation), cheque_number?, payment_date?, note, `disputed` flag. Payments may be partial. Each optional supplier opening balance is a distinct branch-scoped opening_balance dated as of the entered date and stamped with its Supervisor. |
| `notebook`              | company, branch (null = all branches), name_en/fa, kind (`to_order`/`store_use`/`for_supervisor`/`custom`), read_roles, add_roles (custom defaults Supervisor/Floor Worker), enabled_fields (product, quantity, date, measurement + unit), has_status, notify_supervisor, archived                                                                                                         |
| `note`                  | notebook, branch, text, product (optional), qty (optional), date (optional), measurement + unit (optional), status, author, seen_by/at                                                                                                                                                                                                                                                     |

### Physical movement types (retained for future inventory)

`opening_count` (+, historical only; no new Phase 1 entry), `received` (+), `short_resolved_received` (+), `return_pending` (−, damaged set aside), `return_cancelled` (+), `replacement_received` (+), `store_use` (−), `adjustment` (±, historical count/correction events; new counts deferred), `sale` (− , Phase 2 only, posted by the register integration). C adds linked `transfer_sent`, `transfer_received` and `invoice_location_correction` events. **Do not compute or display stock on hand in Phase 1.** Preserve historical opening/count/sale-ready schema; later paid inventory can enable projections after register sales. Never overwrite a physical event; add a correction.

## Invoice extraction JSON (AI output contract)

The AI reading step must return JSON validated against this schema; anything unreadable is `null` and flagged, never invented.

```json
{
  "supplier_name": "string|null",
  "supplier_invoice_number": "string|null",
  "invoice_date": "YYYY-MM-DD|null",
  "due_date": "YYYY-MM-DD|null",
  "payment_terms": "string|null",
  "branch_hint": "string|null",
  "subtotal": "decimal-string|null",
  "tax": "decimal-string|null",
  "final_total": "decimal-string|null",
  "lines": [
    {
      "line_no": 1,
      "supplier_sku": "string|null",
      "barcode": "string|null",
      "description": "string",
      "quantity": "decimal-string",
      "unit": "each|case|other",
      "units_per_case": "integer|null",
      "unit_cost_before_tax": "decimal-string|null",
      "line_total": "decimal-string|null",
      "taxable": "boolean|null",
      "confidence": "0..1",
      "needs_attention": "boolean"
    }
  ],
  "warnings": ["string"]
}
```

Matching order for each line: supplier SKU → barcode → AI/fuzzy name match against that supplier's history → otherwise propose a **new product**.

## Seed loading

`seed/arzon-config.json` is loaded by an idempotent management command: it creates the company, branches, roles' labels, pricing categories, bands, offer definitions, settings, and terminology. It must be safe to run repeatedly, and C authorizes idempotent company-scoped built-in Regular/Promo templates in the prototype. Existing saved/archived template edits are preserved; inserting built-ins does not reset geometry or recreate an archived template. The separately maintained backend seed command is outside the C prototype change scope.

## C receiving, orders and requests additions

| Entity                        | Key fields and rules                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `received_entry`              | company, effective location projection, immutable source movement/invoice line, product, supplier, invoice number, actual cases/units with pack snapshot, occurred_at, received_by, receipt kind, correction references. A query view may derive it from retained physical receipt records; not a separate duplicate stock ledger. Exclude refused/voided delivery effects.                                                                                               |
| `supplier_item_price_history` | company, supplier_product, original invoice/line, original/effective location, bought_at/by, retained pack, case/unit cost before tax, actual received qty, short_dated/expiry flag; manual item additions without purchases have blank bought costs/date/invoice; explicit Supervisor quotes have separate quote provenance rather than fabricated purchase history. Regular basis excludes short-dated while actual last-bought/history includes it.                    |
| `invoice_location_correction` | company, invoice, prior correction/version, from_branch_id, to_branch_id, actor/time/device, required reason, affected receipt/approval references, outstanding amount and allocation snapshot, paired supplier-ledger/physical correction IDs. Posted invoice is immutable; current effective location resolves the latest valid correction chain. Append-only, non-reversible.                                                                                          |
| `order`                       | company, branch/location, supplier, reference, status (`draft`/`ordered`/`partially_received`/`received`/`cancelled`), created/ordered/cancelled actor/time, expected_total_before_tax (Decimal), source_note_ids, linked_invoice_ids, version. No supplier ledger entry; `orders.allow_floor_worker` defaults false.                                                                                                                                                     |
| `order_line`                  | company, order, supplier item/product, bilingual name and supplier-code snapshot, units_per_case snapshot, ordered_cases, ordered_units, expected_case/unit_cost (required before placement; actual purchase or explicit quote/user-entered Expected unit cost, never silent catalog fallback), actually_received_units, cancelled_units, outstanding decision (`short`/`back_ordered`/`cancelled`), source note. Posted receipts drive received quantities idempotently. |
| `order_invoice_decision`      | company, order, invoice/line or absent order line, difference kind (`short`/`not_delivered`/`extra`/`price_change`), previous/current quantities/costs and retained packs, explicit reviewer decision, actor/time. Refused extras excluded from payable/receipts; absent uninvoiced lines create no synthetic payable.                                                                                                                                                    |
| `branch_request`              | company, from/requesting_branch_id, to/sending_branch_id, reference, status (`draft`/`requested`/`sent`/`received`/`closed`/`cancelled`), source_request_id?, each transition actor/time/location/device, reason?, version. Queries require access to one endpoint; actions require responsible endpoint.                                                                                                                                                                 |
| `branch_request_item`         | company, request, product nullable or free_text, bilingual catalog snapshot/free-text as entered, quantity, quantity_unit (`units`/`cases`), pack snapshot when known, note, sent_qty, short_qty, received_qty, missing_qty, checkbox/decision states. Do not invent case-to-unit conversion for free text without a pack.                                                                                                                                                |

**Correction finance:** paired adjustments move only the invoice's current outstanding liability. Existing source payments/credits and allocations remain immutable; source outstanding closes and destination outstanding is projected from the correction. Preserve company/supplier/currency total and evidence. Future shorts/corrections resolve effective destination. Previously approved selling prices are not reapplied merely because an invoice location moved.

**Quantities and money:** all cost/expected/payable arithmetic uses Decimal; Units are positive whole; cases use exact Decimal positive quantity × positive integer pack and must normalize to positive whole units, with no float scaling/rounding. A fractional case is allowed only if this condition holds. Snapshot pack/cost on posted invoice/order so later supplier-item edits never alter history. Short-dated lots retain actual low-cost receipts/payable and Date tracking, but do not replace regular cost or create selling-price proposals.
