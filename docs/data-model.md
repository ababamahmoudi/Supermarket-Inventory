# Data model

Database: PostgreSQL. This document defines entities and rules, not exact column types; the AI developer finalizes migrations and records changes here.

## Conventions
- Primary keys: UUID. Every table has `created_at`, `updated_at`, `created_by` where a person acts.
- Every business table has `company_id`; branch-level tables also have `branch_id`. Enforce scoping in a shared base query layer and test it.
- Money: `Decimal(12,2)` for selling prices, invoice totals, ledger amounts; `Decimal(12,4)` for unit costs.
- No hard deletes. Use status/archived flags or void with a reason.
- Free text and names in two languages: `*_en` and `*_fa` columns (or a translations table). Do not store one language only.
- Use an append-only `audit_log` for sensitive actions.
- Operational events and financial postings have idempotency keys unique within their company/branch. Reversals reference original entries and never mutate/delete posted amounts. Validate that every foreign-key target belongs to the same company and, where applicable, branch/supplier/currency.
- Store UTC timestamps; display and schedule business dates in the company's timezone. Super Arzon is CAD / `America/Toronto`; tax rates/profiles are company configuration, not application constants.

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
  SUPPLIER_PRODUCT ||--o{ SUPPLIER_PRODUCT_BRANCH_COST : "receipt cost history"
  BRANCH ||--o{ SUPPLIER_PRODUCT_BRANCH_COST : "cost basis"
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
  SHORT_ITEM ||--o{ SHORT_DELIVERY : "later receipts"
  BRANCH ||--o{ RETURN_RECORD : owns
  SUPPLIER ||--o{ RETURN_RECORD : "returned to"
  RETURN_RECORD ||--o{ RETURN_LINE : contains
  RETURN_RECORD ||--o{ RETURN_RESOLUTION : "resolved by"
  RETURN_RECORD ||--o{ RETURN_PICKUP : "collected with evidence"
  BRANCH ||--o{ STOCK_MOVEMENT : "ledger"
  PRODUCT ||--o{ STOCK_MOVEMENT : moves
  BRANCH ||--o{ SUPPLIER_LEDGER_ENTRY : "balances"
  SUPPLIER ||--o{ SUPPLIER_LEDGER_ENTRY : "owed"
  SUPPLIER_LEDGER_ENTRY ||--o{ INVOICE_ALLOCATION : "allocated by"
  INVOICE ||--o{ INVOICE_ALLOCATION : "paid or credited"
  BRANCH ||--o{ NOTE : "notes and logs"
  BRANCH ||--o{ ALERT : "supervisor alerts"
  COMPANY ||--o{ LABEL_TEMPLATE : saves
```

## Entities

### Tenancy, people, devices
| Entity | Key fields and rules |
|---|---|
| `company` | stable seed_key (unique), name_en/fa, logo, default language, currency, timezone, jurisdiction, settings |
| `branch` | company, name, code, address, active |
| `user` | company, name, email (optional for floor workers), role (`cashier`/`floor_worker`/`supervisor`), branches, `password_hash`, `pin_hash` (PIN only valid on registered devices), active, last_login |
| `device` | branch, name, registered_by, token hash, active (the store computer) |
| `setting` | company or branch scope, key, value (JSON) |
| `audit_log` | actor, action, entity type/id, before/after (JSON), device, timestamp |

### Catalog and pricing
| Entity | Key fields and rules |
|---|---|
| `pricing_category` | key, label (en/fa), cost_divisor, rounding mode, apply_special_correction, default tax profile, date_tracking_prompt, minimum_margin (nullable). Numeric rounding bands and correction mappings belong to company configuration. |
| `tax_profile` | key, label, rate (company-configured), `taxable` flag |
| `ai_category` | name (en/fa), created by AI or person |
| `product` | code (unique per company, never reused), name_en/fa, description_en/fa, unit_size, pricing_category, tax_profile, ai_category, status (`pending_approval`/`active`/`archived`), archived_at |
| `product_barcode` | product, barcode (unique per company; conflict → Approval) |
| `supplier` | company, name, contact, status (`proposed`/`confirmed`/`archived`), proposed_by, confirmed_by, written return terms/document and terms version |
| `supplier_product` | supplier, product (nullable until matched), supplier_sku, supplier_name, units_per_case. No company-wide last cost is used for branch comparisons. |
| `supplier_product_branch_cost` | supplier_product, branch, cost_before_tax (4 dp), received_at, source posted invoice_line/short_delivery, reversal/void reference. Derive latest valid received cost per supplier product and branch; do not compare drafts or another branch's cost. |
| `product_price` | product, branch (null = company default), selling_price, effective_from, source_proposal |
| `price_proposal` | product, branch that triggered it, scope (`all`/`branch`), previous_price, proposed_price, unit_cost, cost_basis (invoice line and related evidence), reason (`calculated_change`/`new_product`/`manual_override`/`below_min_margin`/`tax_profile_change`), status (`pending`/`approved`/`rejected`/`superseded`), decided_by/at. Margin-only review permits previous_price = proposed_price; context key (company/branch/product/approved price/unit cost/configuration version) deduplicates pending/acknowledged reviews. Keeping a margin-only price records a reason/context acknowledgement without creating a product_price or offer update. |
| `approval` | generic Supervisor decision: type, target entity, status, decided_by, note |
| `offer_definition` | label ("2 for $5"), quantity, total price, pool key, price it belongs to (1.99/2.99/3.99), editable in settings |
| `promotion` | product, branch (null = company scope), approved_price_basis, offer_definition, mix_and_match (bool), start/end (nullable), active, stopped_reason, created_by. At most one active row per scope; branch offer precedes an eligible company offer, yielding one effective offer per branch. Pools use company/branch/currency/offer_definition. |
| `label_template` | company, name ("Template 1"), width_mm, height_mm, margin_top/left, gap_x/y, created_by. **No seeded rows.** |

### Receiving
| Entity | Key fields and rules |
|---|---|
| `invoice` | branch, supplier, currency, supplier_invoice_number (nullable) + `number_is_system_assigned`, invoice_date, received_at, receiving_user, assigned_reviewers, subtotal, tax, final_total, due_date?, payment_terms?, status (see workflows), blocked_reason?, posted_at/by, corrected_invoice_id?, voided_by/at/reason?, posting_key. Original amounts/files remain immutable. |
| `invoice_file` | invoice, storage key (S3), mime type, page count, uploaded_by. Originals are immutable. |
| `invoice_line` | invoice, line_no, supplier_product (nullable), product (nullable), description, qty_invoiced, qty_received_at_posting, unit (each/case), units_per_case, normalized unit quantities, unit_cost_before_tax (4 dp), line_total, tax_profile/rate/line_tax snapshots, review_status (`needs_review`/`confirmed`), `date_tracking_required` (bool, confirmed by a person), lower_cost_answer (`same_date`/`different_dates`/`no_previous_stock`/`dates_not_tracked`/`unknown`) with optional known dates/count and unknown note, line_status (`received`/`short`/`short_partially_delivered`/`short_resolved`/`short_closed`) |
| `date_tracking_entry` | invoice_line, type (`expiry`/`best_before`), date, lot_number?, status (`active`/`cleared`), cleared_by/at. One per invoice line. |
| `short_item` | invoice_line, original_qty_short, original_deduction_before_tax/tax, resolved_qty, closed_qty, status (`open`/`partially_delivered`/`resolved_delivered`/`closed_not_delivered`), closed_by/at/reason. Cumulative resolutions plus closed remainder cannot exceed original missing quantity. |
| `short_delivery` | short_item, received_qty, received_at/by, actual_unit_cost, document, restored_before_tax/tax (delta of cumulative allocation), stock_movement, ledger_entry, receipt_key. A receipt may resolve part of a short; preserve the original invoice tax allocation and assign rounding remainder on final resolution. |
| `ai_extraction_job` | invoice_file, status (`queued`/`processing`/`needs_review`/`failed`), provider, prompt/schema version, raw_json, error, cost |
| `alert` | branch, type (`same_supplier_lower_price`/`other_supplier_price`/`cross_branch_price_conflict`/`tax_discrepancy`/`barcode_conflict`/`offer_suggestion`/`ai_failure`), payload (JSON, e.g. worker answers), status (`open`/`taken_care_of`/`pending`/`dismissed`), assigned role |

### Returns
| Entity | Key fields and rules |
|---|---|
| `return_record` | branch, supplier, status (`open`/`picked_up`/`partially_resolved`/`resolved`/`cancellation_requested`/`cancelled`), created_by, terms_version, note, cancellation_reason/requested_by/at, reviewed_by/at, prior_status (for declined cancellation). Keep history and evidence after closure. |
| `return_line` | return, product/supplier_product, qty_set_aside, reason, location, qty_picked_up, qty_original_recovered, qty_settled. Each quantity is independently capped; recovered original goods must not be confused with replacements or goods held by the supplier. |
| `return_pickup` | return, actual line quantities, picked_up_at, supplier_rep_name (required), submitted_by/device, signed_slip_file or retained_paper_reference (required), optional item photo, receipt_key |
| `return_resolution` | return, type (`credit_current_invoice`/`credit_later_invoice`/`replacement_received`/`cash_or_other`/`no_compensation`), claim status (`submitted`/`verified`/`posted`/`disputed`), evidence/credit_document_id, covered original lines/quantities, invoice (for credits; a return has at most one credit/invoice link), replacement lines (product, qty, date, employee, rep name, photo/note), ledger_entry (Supervisor-only), reversal_of?, resolves (`fully`/`partially`), reason |
| `return_original_recovery` | return line, actual recovered original quantity, condition/sellable confirmation, received_at/by, supporting evidence, stock_movement, receipt_key. Adds only safe/sellable originals once; cancellation itself adds no stock. |

### Stock, payables, notes
| Entity | Key fields and rules |
|---|---|
| `stock_movement` | branch, product, qty (signed), type (below), reference (invoice line / short delivery / return line / note / count), occurred_at, user, idempotency_key, reversal_of?, correction_reason? |
| `stock_count` | branch, product, counted_qty, expected_qty, variance, counted_by (creates an `adjustment` movement) |
| `supplier_ledger_entry` | branch, supplier, currency, type (`invoice`/`short_restoration`/`credit`/`payment`/`adjustment`/`opening_balance`/`reversal`), amount (signed), date, reference (invoice/return/short), cheque_number?, payment_date?, note, disputed, posted_by (Supervisor for financial credits/payments/adjustments), idempotency_key, reversal_of? |
| `invoice_allocation` | invoice, payment/credit ledger_entry, amount, allocated_by/at, reversal_of?. Same company/branch/supplier/currency; allocations capped at source available amount and invoice outstanding amount. Preserve unapplied credits and allocation reversals. |
| `note` | branch, type (`to_order`/`store_use`/`supervisor_note`), text, product (optional), qty (optional), status, author, seen_by/at |

### Stock movement types (the ledger)
`received` (+, delivered part only), `short_resolved_received` (+, actual later delivery), `return_pending` (−, damaged/set-aside), `return_original_recovered` (+, physically received safe/sellable originals only), `replacement_received` (+), `store_use` (−), `adjustment` (±, from stock counts), `reversal` (opposite of a referenced movement after disposition review), `sale` (−, Phase 2 register integration). Cancellation has **no automatic movement**. Stock on hand = sum of movements per branch and product. Never overwrite a quantity; always add a movement.

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
`seed/arzon-config.json` is loaded by an idempotent management command. Company `seed_key` and branch `code` are stable identities; names are editable labels. Step 0.1 creates bootstrap company/branch records and stores the configuration document. Dedicated pricing/settings/role/business tables and full seed loading arrive in Phase 1. Re-running setup preserves edited configuration, branches, and users; an explicit configuration refresh can update the stored seed document without deleting omitted branches or business data. Never create label templates from the seed.
