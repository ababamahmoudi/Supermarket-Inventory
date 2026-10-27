# R2e Group D: fixed-size packages

D1 adds ordinary child Products with stable parent Product Code, exact Decimal size, their own never-reused sequence code, barcode, editable generated EN/FA names and archive/version fields. Defaults are added only after an exact verified restorable private backup; existing browser records receive no fictional products.

D2 generates fixed-size EAN-13 identifiers from configured restricted-circulation prefix and Product Code, with no price encoded. Manufacturer GTIN-8/12/13/14 check digits are validated, original form retained and zero-padded identity aliases rejected company-wide, including archived records.

D3 applies `size_lb × parent approved price/lb + configured container fee`, then the parent's normal category rounding. Grocery corrections and Rice's upward ending use the same pure rounding implementation as regular pricing. Cost adds the separately configured container cost. Defaults: fee 0.49, cost 0.00, prefix 20, ounces/lb 16; size up to six fractional places.

D4 runs derivation before existing Price update snapshots in the same protected command and genuine clock reconciliation. Every changed active child/location receives one coalesced Price update task, label-waitlist entry and formula History. Pending prices follow the parent with no independent approval. An actual approved price at that location is required; a bare company default is insufficient. Repeat writes do not duplicate child effects. Parent sale start/end applies the effective approved price/restored regular basis. Archived children retain their history.

D5 exposes `createPackageService(repository)` with list, parent snapshot, preview, add, edit and archive. It uses the actual IndexedDB authority lock and fresh actor checks. Owner/Manager/Branch Supervisor can manage packages via narrow `catalog.package_edit`; this grants no general catalog edits, supplier liabilities or costs. Public reads contain ordinary scoped catalog fields only. Regular child price overrides/approval and inherited metadata mutations are blocked; actual package receipt evidence remains valid without overwriting derived cost/price. Archive packages before archiving/changing the parent to Each. This is a private browser prototype API, not a production HTTP server.

D6 adds invented Grocery/Rice examples to `seed/pricing-test-cases.json` under `package_cases`, keeping all existing cases and expectations unchanged. Tests cover exact quantities, costs, rounding, configuration, GTIN identities, real canonical transaction commit/rollback, retry idempotency, parent approval/manual/sale changes, scoped pending display, roles/foreign-company denial, version conflicts, archive/code retention and verified backup/restore/concurrent migration.

For code-level review from `prototype/`:

```bash
npx vitest run --maxWorkers=1 src/package-pricing.r2e.test.ts src/weight-packages.r2e.test.ts src/package-state.r2e.test.ts src/pricing.test.ts
```

Group D deliberately adds no package screens. R2f D3/D4 provides the actual product-editor, live preview and Lookup click paths. Package labels/offers/returns use normal product identifiers and existing protected capabilities.

Validation on the Group D worktree: all 40 new package tests and all 68 existing pricing tests passed (108 total); a broader 17-file affected regression run passed 259 tests. Separate tests also prove derived-cost History is emitted even when selling price is unchanged, and Supervisor's public/history projections do not expose its private cost basis. TypeScript and targeted source lint passed. The root integration and final CI checks are recorded in the combined R2e/R2f report.
