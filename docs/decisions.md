# Decisions

## R2g — Screenshot-led polish on top of live reading (2026-10-29)

**Context:** Ali approved exact auth, Change price, Lookup and receiving compositions and identified shared inconsistencies, particularly at 509 px. R3 is already complete and remains the integration base.

**Decision:** integrate B1, B4, B2, B3, C1, A2, A5 and A7 in that order on PR #29, with one item per commit and a coherent Tier 1 push. Approved screenshots take precedence over conflicting older prose. Use shared controls for chip/dialog/page-action rules and real components for the screen compositions, preserving original files, current permissions, audit and Decimal calculations. Check 360/390/509/760 as well as desktop, EN/FA and both themes. All seven CI checks must pass before the Tier 1 report.

**Schedule/scope:** Tier 1 is due October 29 at 18:00 Toronto. Tier 2 may proceed only after green Tier 1 and before the 22:00 code freeze; nothing may be pushed after freeze without Ali's later instruction. Record post-demo requests rather than building them now. Private review images are never copied into the repository; approved fictional reference PNGs and their README are retained byte-identically.

## R2c/R2d — Final route and loaded-font integration (2026-10-26)

**Context:** combined browser checks exposed actual label/reference clipping, a supplier-filtered Returns render loop and Timesheet edits that could be canceled before the autosave delay by navigation.

**Decision:** reserve complete Supplier status text, fit long invoice references with complete accessible names/tooltips and use one actual record action. Keep list preference setters stable and unchanged updates idempotent, rejecting delayed setters from a retired person/location. Statement presence stays inside the existing authorized financial projection; history-free zero balances are static and fully paid history remains actionable.

For Timesheets, wait for actual pending saves before accepting Back/hash navigation. Keep failed entries mounted with Retry, release only the latest destination, retain original edit callbacks and recheck their actor/session/location in the canonical transaction. Native unload protection applies while dirty or saving. Synchronize implicit Today when the actual branch changes, while preserving explicit dates and an open sheet during ordinary refresh across midnight. This preserves data and current intent without relaxing table, timing, permission or financial guards.

## R2c Groups 2–6 — Public choices, atomic review and personal event grouping (2026-10-26)

**Shared choices:** derive explicit public search metadata and semantic placeholders; keep genuine empty-valued All/None choices. Bounded popovers and one full-record control fix presentation without expanding domain data or changing quantity/price/authority. Record-details opt-in applies only to the requested overview families.

**Supplier/Payables:** retain the authoritative company directory and distinguish read failure from empty business data. Incomplete profiles derive from fields, and a dedicated stable supplier-ID statement route preserves list position and existing financial permissions. Contacts/actions/KPIs use the same foundation surfaces, with no false click target on a static balance.

**Approvals:** reuse the full ProductEditor with a staged protected snapshot. Validate and perform genuine product/date/supplier/decision operations on one candidate; commit all fields and one attributed audit together. Cancel/failure saves none. Retain source cost/money/original/physical evidence, barcode/manual/margin rules and old supplier-code associations. This compound edit is nonreversible in generic History; standard decisions keep their existing Undo. Batch presentation gains select-all and complete money/margin columns while selected-only atomic guards remain.

**Offers:** improve hierarchy/search/form alignment while keeping bundle quantity/price from the current approved-price mapping. Display those terms read-only; arbitrary pricing is not inferred from a design request. Savings use Decimal and existing offer evidence.

**Notifications:** group only a genuine same-source decision/product/effective event across currently permitted branches; never infer identity from product/time alone. Use internal equality tokens and exact legacy record identity. Read/clear is personal; soft dismissal retains event keys and source records, and handled sources are removed by current source checks. Reconstruct related routes canonically under fresh authority and invalidate stale UI navigation intent. These remain local repository operations; production HTTP/push/email and recipient-routing behavior do not change.

## R2d — Separate branch staff and audited local hours (2026-10-26)

**Context:** the paper sheet records employees who often have no app login, and Cashier must enter branch hours while Floor Worker must see none.

**Decision:** keep a separate branch staff list with optional safe app-person link; grant current scoped timesheet read/edit only to Owner, Manager, Branch Supervisor and Cashier. Module Off denies operational access to every role. Protect raw projections, History, print and CSV independently, without broadening Cashier financial authority. Aggregate selection always asks for a branch. Staff/row removal retains evidence, and the same four roles may edit past days with attributed before/after audit.

Compute hours from normalized 24-hour wall-clock endpoints and integer minutes: earlier Out is overnight, equal endpoints zero, missing Out allowed/flagged after its day, >16 hours amber. These warnings do not fabricate an Out or prevent genuine entry. On shift now includes unique prior unclosed staff whose clock-in is not future. Departments/captions/order are configuration; historical captions survive removal. Include Monday–Sunday payroll views and four-decimal safe CSV, plus the bilingual paper print with Made with Klead.

**Migration/defaults:** verify an exact private backup before additive existing-store initialization and reject/retry a concurrent revision. Existing stores receive empty arrays; preserve explicit Off/custom configuration. Only fresh demo/explicit Reset loads independent fictional sheets. Empty store keeps markers so reload stays empty. The existing browser repository is the actual enforcement boundary; a deployed server, shared-device data, wages and payment execution remain future work. These authorized defaults require no new approval gate.

## R2c receiving defaults — 2026-10-26

Ali requires 24-hour times throughout the app. Ambiguous handwritten delivery hours 1–6 prefer afternoon within configurable 06:00–20:00 delivery hours and always offer the retained alternate; store opening hours never infer delivery time. North York is configured Open 24 hours. Explicit am/pm and 13–23 remain literal.

Imported unknown packs use one plus a question, approximate case conversion accepts a 0.01-unit distance from a whole unit, and unit cost derives from printed line total divided by actual units with exact retained money evidence. All-missing totals derive subtotal only from complete item/charge amounts. A subtotal alone does not establish tax: Tax and Total remain unresolved under R2b 1.3 until a second source amount or human entry permits the documented arithmetic; the existing printed-total-only zero-tax rule remains unchanged. Calculated/defaulted metadata stays quiet; actual reading checks, handwriting and unresolved facts stay amber. These owner-requested defaults supersede the earlier exact-only conversion and all-imported-Received-amber rules. All-locations Lookup reads separate authorized branch facts; branch writes choose their destination at action time.

## R1 — Local invoice readings before live AI (2026-10-21)

Context: Ali needs real-data testing before the October 30 pitch using readings already produced by his invoice-reader kit, without paying for another AI run.

Decision: accept the versioned local export into existing invoice/supplier/product/approval flows, preserving all original pages, source metadata, uncertainty and non-item charges. AI is the default; checked mode overlays only fields actually checked. Human review and posting/price authority remain. An explicitly confirmed Owner/Manager empty-store operation keeps settings and people. Startup/service-worker work remains outside R1.

Why: exercise existing money and receiving rules without a parallel invoice model or live AI integration. Ali's real file stays on his computer, never in GitHub, seed data, fixtures, chat or screenshots. Tests use the supplied fictional export and a second fictional two-page edge-case export.

The repository is the source of truth. Entries below were recorded on **2026-10-06**. Ali confirmed the location/tax details, accepted safe return cancellation, and authorized the lead developer to choose and document resolutions for the remaining contradictions. Defaults remain editable company configuration; they are not hardcoded business rules.

## 001 — Business location, time, and tax

**Context:** Currency, jurisdiction, and timezone were placeholders. **Decision:** Super Arzon uses Toronto, Ontario, Canada; CAD; `America/Toronto`; 13% HST for products assigned the approved `hst_13` profile. Seed a separate 0% `non_taxable` profile. Store UTC timestamps and snapshots of posted invoice tax profiles/rates. **Why:** Reflects Ali's answer, handles daylight saving, and prevents future configuration edits from rewriting financial history. Category defaults propose a profile; Supervisor review establishes each product's tax treatment before real use.

## 002 — Return evidence and physically accurate cancellation

**Context:** Cancellation restored original stock even when the supplier still held it or replacements had arrived. **Decision:** Cancellation creates no automatic stock movement. Record actual original units physically present/recovered and safe/sellable; restore only those, once, within the removed quantity. Keep replacements and compensation separate. Require signed pickup slips, paper-original references/scans, supplier credit documents, supplier-specific terms, and a staff policy (`return-policy.md`). **Why:** Prevents imaginary/double-counted stock and preserves evidence in supplier disputes. Item photos remain optional; physical condition confirmation is mandatory.

## 003 — Operational claims versus financial postings

**Context:** Workers could record resolutions while Payables was Supervisor-only. **Decision:** Workers record pickups, replacements, and claims/evidence; only Supervisors verify/post financial credits, cash settlements, adjustments, and reversals. Workers can cancel an unsettled return with a reason/disposition; any settlement requires Supervisor cancellation review. Covered original quantities are tracked and capped separately from replacement product quantities. **Why:** Protects financial permissions and prevents duplicate settlement. Retain original records and append corrections.

## 004 — Partial shorts and conserved amounts

**Context:** A partially short line could be entirely excluded from stock, and later partial deliveries were undefined. **Decision:** Add only the units delivered at posting. Withhold only missing quantity's original cost/tax; later actual deliveries restore cumulative proportional allocations, using half-up cents and a final remainder. Cap quantities, make receipts idempotent, and preserve posted rates. Closing undelivered units retains the existing deduction, without a second credit. **Why:** Stock reflects reality and repeated deliveries do not lose/create pennies.

## 005 — Invoice corrections, allocations, and financial history

**Context:** Voids and payments lacked stock reversal/allocation rules. **Decision:** Supervisor previews downstream stock/returns/shorts and financial allocations; resolve consumed-stock disposition before a void. Append linked compensating entries and preserve originals. Allocate payments/credits to same-company/branch/supplier/currency invoices with an editable oldest-due preview; excess remains unapplied supplier credit. Cap allocations and reconcile outstanding invoices to the ledger. **Why:** Makes overdue balances useful and corrections reviewable without deleting evidence. Verified backups remain required before database migrations.

## 006 — Floor Worker visibility

**Context:** Documents disagreed about margins and catalog supplier costs. **Decision:** Costs only on invoices created by/assigned to that worker within their branch; margins, catalog costs, balances, allocations, and financial postings are Supervisor-only. Enforce field restrictions on the server. **Why:** Keeps receiving practical while following the documented financial privacy default.

## 007 — Receipt comparisons and missing date information

**Context:** A company-wide last cost could compare the wrong branch; required expiry answers were impossible for untracked dates/no old stock. **Decision:** Compare the last posted, non-voided supplier-product receipt in the same branch. Permit explicit No previous stock, Dates not tracked, or Unknown with a note; known dates/counts are captured, unknown information is never invented. Alert the Supervisor without blocking posting once an answer is recorded. **Why:** Compares relevant receipts and keeps receiving usable for every category.

## 008 — All-branch price approval and offers

**Context:** Which price overrides disappear, and which offers take precedence, was ambiguous. **Decision:** All branches previews affected branches/prices/offers and archives every active override for that product in the company; stale previews require refresh. This branch only preserves others. One effective offer per branch: eligible branch offer precedes eligible company offer, with matching effective approved price. Stop incompatible offers even on an unmapped price; suggest mapped replacements for confirmation. Mix-and-match pools are company/branch/currency/offer-specific. **Why:** Makes approval consequences explicit and prevents conflicting offers or cross-store mixing.

## 009 — Configuration-driven pricing and category margin flags

**Context:** Threshold numbers were encoded in key names; 25% global margin conflicted with Rice's divisor; exact `.73` testing wrongly assumed whole-cent costs; unchanged-price wording could suppress required margin review. **Decision:** Store numeric ordered band bounds/endings/offsets, generic correction mappings/enabled flags, and Rice's ending in configuration. Category minimum margins: Grocery/Grocery (Taxable) 25%, Rice 20%, Kitchenware 25%; null disables the check. Add exact `.73` and Rice exact/just-above `.99` four-decimal fixtures. A below-margin result creates a deduplicated Supervisor review even if price is unchanged; receiving and the approved cashier price continue. Supervisor acknowledges keeping the price with a reason or proposes a manual override. Reviews identify company/branch/product/approved price/received cost/configuration version; identical contexts reuse the review, changed contexts re-evaluate it. **Why:** Supports configurable pricing, tests valid boundaries, and avoids missing low-margin costs that happen to round to the existing price without blocking receiving or silently repricing goods.

## 010 — Phase 0.1 scope and stack

**Context:** The prototype and full business foundation could be mistaken for the setup slice. **Decision:** Keep the documented Django/DRF/PostgreSQL/Celery/Redis with S3-compatible storage and React/TypeScript/Vite stack. Step 0.1 supplies containers, commands, health checks, a bilingual placeholder shell, bootstrap company/branch/configuration/development supervisor, lint/test/hooks and pull-request CI. Dedicated business models and full tenant/role security are Phase 1; the browser demo is Step 0.2. Use stable company `seed_key` and branch `code`; the seed command preserves edited configuration by default; `make setup` explicitly refreshes reviewed seed settings while preserving existing users/passwords and omitted branches. No paid cloud resource/deployment. **Why:** Provides a testable local foundation without implying operational workflows or production readiness.

## 011 — Maintained local S3 storage and verified migrations

**Context:** The [official MinIO README](https://github.com/minio/minio#readme) now states that community distribution is source-only and unmaintained; both historical Docker Hub and Quay images failed to pull. **Decision:** Use the maintained [SeaweedFS 4.48 release](https://github.com/seaweedfs/seaweedfs/releases/tag/4.48), official multi-architecture image pinned by digest, only as the local S3-compatible service. Keep private signed access and a persistent volume, disable extra interfaces/telemetry, and test upload/download, anonymous rejection, and deletion. Production remains AWS S3. No paid resource is created. **Why:** Provides reproducible authenticated local storage without depending on archived binary distribution.

**Context:** Setup can apply migrations to an existing local database. **Decision:** Before pending migrations, dump the database and verify a full restore in a uniquely named temporary database; preserve the ignored backup and stop on any failure. Skip the migration backup when no migrations are pending. Build dependencies with frozen lockfiles/checksums and the platform-supplied public TLS trust bundle, never disabled verification. **Why:** Meets the repository backup rule and preserves trust through the cloud proxy.

## 012 — Design language v2 and the PR1 approval boundary (2026-10-07)

**Context:** Ali replaced the design language, updated accounts to username/password, and requested two separately reviewed redesign PRs. **Decision:** PR1 changes the shared shell/components plus sign-in, Supervisor dashboard, Cashier lookup, and invoice review. Suppliers and the remaining screen redesigns wait for explicit approval. Authentication has separate demo storage so existing invoice, stock, approval, and ledger records survive the sign-in change. Business reset preserves changed passwords and user preferences. **Why:** Makes the requested four screens reviewable without discarding the working prototype or starting PR2 prematurely.

**Context:** The latest uploaded seed files omit metadata previously required by the working prototype. **Decision:** Keep the uploaded files unchanged; `prototype/src/config.ts` fills omitted settings from the retained configuration and operational snapshots inside `prototype/src/compat/`. Explicit current data wins. The Golden Grain example's picked-up/partial-replacement description maps to the existing `partially_resolved` state while preserving Product Code 0001, two originals, and the one previously received replacement. Retain the three earlier pricing boundary fixtures alongside all 21 current cases. **Why:** Preserves verified money and physical-quantity behavior during a presentation change; records the compatibility choice rather than silently inventing new rules.

**Context:** The new accent and KPI colors must remain company-configurable. **Decision:** Bind light/dark accent, hover, soft fill, and KPI endpoint tokens to `company.branding`; use the exact v2 palette as retained default metadata. **Why:** Another supermarket can change its configured palette without editing CSS, while Super Arzon keeps the specified appearance.

## 013 — Pull request A boundary and current seed corrections (2026-10-07)

**Context:** Ali approved the earlier visual direction, uploaded new requirements/seed, and requested design fixes A before new features B. **Decision:** Integrate the latest owner `main` into the earlier unmerged redesign branch, then stack A on that branch with changes restricted to `prototype/` and `docs/`. Apply items 1–25 to all existing screens, capture each in light/dark/Persian/phone, and pause B until explicit review approval. Suppliers and History navigation positions do not imply implemented pages. **Why:** Makes the new fixes reviewable without duplicating the earlier prototype or merging unapproved work into main.

**Context:** Decision 009's Rice 20% minimum margin was not present in the current owner configuration; Ali requested its removal. **Decision:** Supersede that category-default portion of Decision 009: use the current configured minimum margin, 0.25, for each category unless an explicit category/custom setting overrides it. Migrate unchanged earlier demo defaults without resetting other business data or settings, preserve saved custom margins, and keep the decimal pricing algorithm and boundary fixtures unchanged. **Why:** Uses the owner's rule instead of an invented per-category exception.

**Context:** `supplier_balances_demo` supplies aggregate figures but no supporting historical ledger entries. Fresh Valley's $169.79 already represents the original demo invoice after open shorts. **Decision:** Show the scoped, dated snapshot separately from operational entries; reconcile that original invoice's contribution when it is actually posted, preserving later receipts, payments, and corrections. Exports disclose the demo snapshot separately. Never create fictional invoices, stock, or payment allocations to explain these aggregates. **Why:** Displays the requested nonzero figures without double counting the known invoice or changing existing physical/money rules.

**Context:** Uploaded returns omit their creation date and author; some approvals omit a triggering actor. **Decision:** Display a readable return number with missing metadata as `—`, and unavailable approval actors as translated `Not recorded`. Use recorded metadata only when it exists. **Why:** Meets the presentation request while avoiding made-up dates or people.

## 014 — Pull request A2 specifications and B planning boundary (2026-10-07)

**Context:** Ali reviewed A and requested A2 corrections plus new product editing, Returns overview, purchase charts, filters and Suppliers. **Decision:** Update requirements/screens/design/workflows/brief before implementing A2. The shared catalog editor is Supervisor-only, with immutable Product Code, explicit All branches / This branch only price scope, retained invoice calculation, actor/date provenance and reversible before/after audit entries. A Supervisor's price-save is the explicit manual-override approval decision; existing receiving proposals remain unchanged. History UI and conflict-aware Revert wait for B. Every invoice line requires the human Track date: Yes / No answer. Unit costs display to two decimals while storage, editing and computation retain four. **Why:** Makes newly authorized behavior reviewable and preserves the pricing, tenancy and approval rules.

**Context:** A's aggregate-only balances and unknown return metadata no longer satisfy Ali's requested proof. **Decision:** Supersede those fixture/display choices in Decision 013 using explicitly fictional prototype-only `prototype/src/fixtures/a2-demo-data.json` and `prototype/src/demo-fixtures.ts`. Posted historical invoices, corresponding stock movements and recorded payments support $2,368.29 balances, $306.40 overdue and five open invoices. An earlier FV-20390 supports the starting Lavash approval (cost 1.5500, proposed $2.99, margin 48.16%) with a real demo posting actor; FV-20417 remains unposted until the user posts it. Fresh Valley's historical $169.79 plus the distinct current invoice $169.79 is $339.58, without snapshot-replacement or duplicate seeding. Returns have explicitly recorded fictional creation dates/actors. Preserve saved business data during idempotent fixture migration; do not change the owner's seed files. **Why:** Recent invoices, stock, approval context, open invoices, overdue, Suppliers and Payables now share traceable demo records. These are authorized fictional fixtures, never claims about real deliveries.

**Context:** New dashboard content must not imply sales knowledge. **Decision:** Purchase charts use posted non-voided invoice amounts, net of open shorts and linked purchase credits/corrections, scoped by company/branch/timezone. Payments/opening balances are excluded. Low stock uses ledger estimates and open To order notes; recent price changes use approved/manual history. Keep four KPIs and the documented 12-column layout. **Why:** Shows available receiving data without fabricated revenue, sales or demand.

**Context:** Ali changed only the plan for B items 40–43. **Decision:** Record those changes in `docs/REVIEW_B_PLAN.md`: live A4 template preview/product search; Supervisor-only create/edit/archive of custom notebooks; the exact 13 Settings groups and working-demo subset; Undo toasts bottom-left/mirrored Persian, five seconds, hover pause, newest-first independent timers, maximum three plus +N more. These supersede earlier Settings order and 10-second/bottom-center toast defaults. Do not implement B during A2. Standalone Stock and Users and devices remain explicitly omitted from A2; Suppliers is active now and History's UI is deferred. **Why:** Preserves the requested review boundary and leaves the next session an exact plan.

## 015 — A2 approval, combined B scope and manual entry (2026-10-08)

**Context:** Ali approved A2 and requested Parts 1–3 in one B pull request, with the CI fix as Part 4 in a separate small pull request. **Decision:** Apply the ten presentation/copy leftovers first; implement Prompt 3C items 26–29 with revised 40–43 and Supervisor manual-entry items 44–47 together, restricted to `prototype/` and `docs/`. Keep item 30's AI presentation for Prompt 3D with real AI rather than implementing it twice. Keep the separate CI changes limited to `.github/workflows/`, `Makefile` and `scripts/`. **Why:** Supersedes the previous B pause while preserving explicit file/scope boundaries and one review round for B.

**Context:** Existing new products/suppliers are pending receiving proposals; the new request authorizes Supervisor direct creation. **Decision:** Update requirements §3/4/6/11/21, screens Suppliers/Products/Invoices and workflows before code. Supervisor Add supplier is immediately Confirmed; worker invoice quick-add remains Proposed and blocks posting until confirmation. Supervisor Add product is immediately Active, with the unchanged engine's calculated price, recorded manual override and explicit below-margin confirmation. Worker invoice product proposals remain pending. Shared forms enforce their caller's role/scope; workers/cashiers cannot invoke standalone catalog creation or opening financial/count transactions. Deactivate suppliers instead of delete, preserving histories and excluding future invoice choices; link similar-name warnings and block barcode conflicts. **Why:** Records the role-specific creation exception without weakening worker approval, financial privacy or immutable history.

**Context:** Manual entry needs trustworthy starting balances/counts and source evidence. **Decision:** Optional supplier balances create distinct branch/as-of **Opening balance** ledger entries; optional product counts create distinct branch **Opening count** stock movements. They are not fabricated invoices/receipts, never enter purchase charts and use correction entries rather than destructive Undo. Allocate Product Codes beyond all assigned codes and never release them for reuse. Upload and Manual entry share review/posting logic: drafts may save without an original, but posting requires the photo/PDF and supplier/line confirmations. **Why:** Keeps stock, Payables, provenance and future audit corrections traceable while making busy receiving practical.

## 016 — C1/C2 receiving operations and no-inventory scope (2026-10-09)

**Context:** Ali approved B and requested new real store workflows in C1 then C2, with no intervening review pause. **Decision:** Update source requirements/workflows/model/screens/design/brief first, then build two stacked PRs, scoped only to prototype/docs and arzon-config location metadata. Supersede prior stock estimates, Low stock, opening-count controls and no-default-label-template requirements; preserve their historical records/review evidence rather than rewrite history. Phase 1 has no inventory; register-based inventory is a separate paid phase. **Why:** Carries the owner's exact scope reversal into every current build promise without deleting physical events or financial provenance.

**Context:** Locations now include a warehouse and invoices can be corrected across locations. **Decision:** Preserve Branch1/2/3 stable IDs, load North York/Richmond Hill/Newmarket display names plus distinct Warehouse/type from config, and migrate only unedited defaults. Warehouse never permits Cashier. Retain invoice reviewer-origin assignment independently of receiving location; own reviewer may retarget an unposted invoice to an active same-company location without broader data access. Posted Move invoice is append-only effective-location correction; transfer current outstanding liability with paired adjustments and allocation-impact preview, preserve original payments/credits and all source records, company total conserved. Pending merged approval location follows latest cost-basis source invoice, older linked evidence does not redirect it. **Why:** Enables warehouse receiving and accountable corrections without bypassing tenancy, mutating posted evidence or moving historical payments twice.

**Context:** Manual-priced products and short-dated lots must not be automatically repriced. **Decision:** Persist effective price-origin provenance/pill/filter and rule/manual pair; invoice keep/rule choice respects approval. Keep uses actual manual price for any configured minimum-margin review; Use proposes even equal rule/manual amounts so explicit approval clears manual origin. Short-dated receipts require expiry and retain actual payable/history, but do not replace regular cost or create price-change approval. **Why:** Separates receipt cost from staff selling-price decisions and exceptional clearance stock.

**Context:** Orders and branch WhatsApp lists are authorized, but inventory is not. **Decision:** Supplier item packs/costs are posted/manual histories with immutable line snapshots; case/unit arithmetic and expected totals use Decimal. Order-only missing goods cannot create an invoice deduction; refused extras add neither payable nor receipt. Each discrepancy is a blocker, posted receipt updates are idempotent, one Supervisor alert summarizes differences. Branch requests have endpoint-authorized checklist lifecycle and residual copy, recorded actual transfers but no stock/Payables effect. **Why:** Gives staff operational coordination without pretending order quantities are inventory or financial liabilities.

**Context:** Label defaults are reversed and half-A4 must print exactly. **Decision:** Idempotently add company Regular 60 × 40 mm/margins 10/gaps 4 and Promo 210 × 148.5 mm/zero margins-gaps/two-per A4, with 1.5 mm black border/content inset 5 mm. Duplicate/edit/archive/restore; preserve existing user definitions. Promo active offer uses black SPECIAL/ویژه band, giant offer and small regular price; Regular offer marker automatic. Non-offer Promo prints regular price with no false promotion. Screen grayscale previews real monochrome output. **Why:** Matches exact owner dimensions and black-and-white printing while keeping physical alignment/calibration honest.

**C2 implementation clarification before code:** Orders worker opt-in is `orders.allow_floor_worker=false` by default and grants costs only in Orders. Manual supplier items with no purchase retain blank bought metadata; require explicit Expected unit cost unless an actual purchase or separately attributed Supervisor quote exists. Units are positive whole and fractional Cases must convert exactly to whole units with Decimal. An unbilled order remainder creates no payable deduction; retain comparison snapshots. Branch requests cancel only while Draft/Requested; Sent/Received physical evidence is reviewed/closed and residual copy creates a new draft. These are recorded implementation defaults, not new paid scope.

## 017 — C3 shared presentation, navigation and safe Undo (2026-10-09)

**Context:** Owner approved C1/C2, supplied14 annotated screenshots and a glowing-button reference, and requested ordered green merges followed by stacked C3/C4 without a review pause. **Decision:** Update specifications before code, preserve approved history, and limit new changes to prototype/docs/seed. Four shared button variants: Primary blue/white, Secondary light-white/dark-charcoal blue-border soft-glow pill (text 4.5:1/border 3:1), Quiet, Danger only stop/cancel. Use page width with padding; supersede max1440 blanket/narrow compound-form caps and desktop table scrolling. Prove no panel/table sideways scroll/text clipping at 1280/1440/1920, including invoice comparison and pending pills. Phone Orders cards, other phone tables may scroll. **Why:** Fixes the visible problems rather than accepting page-only overflow checks; retains borderless surfaces, no native controls and exact printing.

**Context:** Details, table choices and accidental actions were hard to recover. **Decision:** Per-user/company/table Columns with mandatory name/reference and reset, restored list tab/filter/scroll on Back, clickable breadcrumbs and unique sidebar icons. Field-local errors clear on affected input changes. Labels checkbox/bulk-copies selection; Offers/Notes creation dialogs. Dashboard approvals non-overlapping grid and grouped readable approval effects. Undo 10 seconds bottom-right EN/bottom-left FA above all layers, independent focus/hover pause. Scoped conflict-aware inverse preserves unrelated later actions; no legal/money Undo. Place order/source-note mark ordered only reversible before receipts/later edits. Request transfer Undo appends transfer_correction evidence referencing original event, never deletes it or asserts physical recovery. **Why:** Makes navigation and corrections predictable without corrupting audit or physical evidence. Supersedes five-second opposite-corner B rules in Decision 014; preserves historical evidence as historical.

**Context:** Warehouse was shown as a sales location. **Decision:** Configure Sells to customers, Store defaultOn/WarehouseOff. Exclude non-selling locations from price effects/offers/per-location selling lists; warehouse receipt may propose retail company price, branch-only non-selling target unavailable. Preserve historical warehouse overrides hidden until explicit opt-in. **Why:** Receiving belongs to Warehouse, customer selling does not by default.

## 018 — C4 source documents, quantities and corrections (2026-10-09)

**Context:** Posted invoices looked like disabled drafts and demo packs/originals were unrealistic. **Decision:** Readable immutable posted document, actual retained image/PDF preview/zoom/pages/Download, matching fictional image originals and realistic case packs preserving every existing total/saved record. Supervisor Correct invoice uses populated effective lines, required reason, downstream preview, stale-context validation and confirmation; append linked versions/compensating effects, preserve original files, payments/allocations/physical receipts. No Undo; excess allocated money remains explicit. **Why:** Improves review without mutating legal evidence or replaying liabilities/receipts. Extends Decisions 005/016, no backend change.

**Context:** Weighted cost units and temporary order items were missing. **Decision:** Sold by Each/Weight, kg/lb source quantities up to 3 decimals, optional case weight. Normalize source kg cost/factor 2.20462 to 4 decimals before existing divisor/bands/correction; canonical approvedlb price, optional convertedkg display. Defaultlb/second unit On/bands On; Each unchanged. Intentional New item temporary order line retains optional pack/cost and explicit quantity/incomplete estimate, then explicit actual invoice/product match; supplier-item association only at posting. Fullpage print preview and correctly paired EN/FA headings. **Why:** Handles supplier evidence and weights while preserving normal pricing/receipt/financial invariants.

**Context:** Product date preferences did not affect receiving and dates were invoice-only. **Decision:** ProductYes/No preselects invoice Track date, unset asks, Yes requires realdate; manual Add date and reasoned Remove/Removedhistory/Undo; SupervisorStoptracking optionally removes open dates; nextdate scoped Lookup/Products. Optional quantity is evidence, not stock. NotebookEN required/FAoptional fallback; Addlocationcopy. **Why:** Supersedes A2's all-lines-unset and no-date-quantity restrictions without bypassing line confirmation or inventory scope.

## 019 — C4 return claims versus confirmed settlement (2026-10-09)

**Context:** Owner wants simple return stages, retained RM memo and owed balance reflecting a picked-up expected credit while keeping money permissions. **Decision:** Open/History, Waiting for pickup / Waiting for credit/Closed(Credited/Replaced/Written off)/Cancelled map old evidence. Retain bilingual RM pickup snapshot/signature evidence. Deduct expected credit atpickup On creates provisional Supervisor-only projection, not supplier-confirmed ledger credit. Credited replaces expectation with verified actual once; smallercredit restoresdifference. Written off requiresreason/releasesexpectation. Config waiting credit reminder14 days, deduplicated. Preserve signed evidence, safe-original cancellation, partial replacement coverage and Supervisor-only financial posting. **Why:** Shows anticipated claim without treating worker collection evidence as a legal financial credit.

**Owner clarification:** Asked whether a replacement releases an already deducted expected credit. Owner chose **Return to $600**: replacement releases provisional30 so projectedowed $570 → $600; no new invoicepayable or confirmed credit is posted. Actual replacement goods/evidence remain. This resolves “no money changes” as no new purchase/settlement ledger posting while reversing the provisional projection. No unresolved replacement default remains.

## 020 — C5 controls and fast operational entry (2026-10-10)

**Context:** Ali approved C3/C4 and supplied nine annotated references, asking for restored C2 action shapes with glow, faster dates and cleaner offers. **Decision:** merge C3 then C4 only after green checks, preserving commits; create C5 from resulting main. Update design rules before code. Scope prototype/docs only; preserve seed/pricing/original financial and physical evidence. Universal action geometry12 px/40 px/intrinsic replaces C3 capsules/full-column stacking; semantic tabs/widgets retain their approved style. Shared label-based return tones replace legacy internal-state colors. Inline dates reuse audited record-scoped Undo, including atomic auto-enable; Worker permission is limited to the requested preference switch. Current groups valid scopes one product row; identical submissions are idempotent and Past keeps all versions. **Why:** fixes each owner annotation without discarding approved functionality/history; actual browser audits and unchanged pricing fixtures make the result reviewable.

## 021 — C6/C7 specifications, Klead tokens and review boundary (2026-10-11)

**Context:** Ali approved C5 after Safari/Chrome900px testing, supplied14 bug notes and5 retouches, and requested two stacked PRs reviewed together. **Decision:** merge C5 with original history only after all CI passed (main2dbb64aab13cdbb6ecfe5a540c590ebb32c503ce); create C6 from main, C7 on C6 without intermediate approval stop. Replace design-language completely with Kleadv1 before implementation, update all source docs first. C6 new/changed components use new tokens; C7 applies them everywhere while preserving Dashboard grid, pricing/business/evidence and exact print geometry. Scope only prototype/docs/seed, no automatic C6/C7 merge. **Why:** avoids building new forms in the superseded visual language and makes both authorized changes reviewable together.

**Context:** app layouts failed at intermediate widths and noisy Undo blocked actions. **Decision:** icon sidebar below 1280, current-page breadcrumb/search icon760–1279, prioritized columns with retained chooser/row details and cards below 760. Actual word/overlap/panel/page checks390/768/900/1024/1180/1280/1440/1920 EN/FA. One about 8-second closable Undo only eligible action transitions, never fields/autosave, above reserved footer space; linked What's missing/inline validation on incomplete Save/Post/Send. **Why:** addresses owner-visible failures rather than relying on desktop-only or page-only measurements.

## 022 — One company product, local dates, lots and clearance (2026-10-11)

**Context:** duplicate products/barcodes for short-dated store prices would break labels/orders/register integration. **Decision:** one company product/barcode across stores with first-added-location provenance; regular prices may override per selling location. Lots keyed company/product/supplier/location/expiry retain immutable received quantity/cost/invoice source evidence. Short-dated lot clearance is a separate location/lot offer, at most one current per product/location, visible in that location's Lookup with expiry and Promo label, never another location's prices/lots. No stock/depletion projection. **Why:** records dated cost/offer evidence without a second cash-register identity or changing regular pricing.

**Context:** date editing/stop/reminders were inconsistent. **Decision:** Add/Edit product same-form dates/reminder atomic save, EN/pricing required FA optional; Lookup read-only. Stop requires Keep/Clear, both exclude operational lists/reminders; kept dates remain Lookup. Per-product reminder defaults existing expiry 30; once-per-date alert. Allow only narrow same-company/product/supplier recent 7-day other-location date hints during receiving, no money/quantity/invoice exposure. **Why:** follows owner workflow while keeping general catalog/location permissions intact.

## 023 — Immutable pickups and partial item settlement (2026-10-11)

**Context:** resolution could mutate pickup, shortfalls had no disposition and one-credit rule prevented partial settlement. **Decision:** per-item actual pickup plus required shortfall reason/outcome, locked signed pickup events; kept leftovers may use a new later event. Correct pickup appends reasoned evidence, Owner/Manager mapping pending explicit owner answer. Credits/replacements/write-offs track disjoint actual picked-up coverage per item; multiple distinct credit notes allowed while one linked invoice and Supervisor-only financial posting remain. Preserve actual tax/credit amounts, allocations/unapplied money, original events, safe recovery and release provisional claim only for resolved coverage. **Why:** operational progress no longer rewrites physical proof or double-settles quantities/money.

## 024 — Local invoice entry, supplier documents and durable browser files (2026-10-11)

**Context:** manual entry required supplier contacts too early, totals/due dates/time were misleading and base64 photos exhausted Safari main storage. **Decision:** optional supplier contacts/terms with explicit Supervisor Needs review gate for new/incomplete invoice supplier; styled terms derive editable due date, subtotal+tax derive editable total with mismatch warning, company-zone received fields persist UTC, draft line removal Undo. Supplier-facing Return memo/order independently default English; internal picking bilingual. Store company/hash-addressed Blobs in IndexedDB and only refs in main JSON; exact invoice originals, ≤2000 px photo derivatives, verified backup/write/read/hash migration before deleting inline bytes, retry without evidence loss. Test 20 × 3 MB photos/reload. **Why:** keeps receiving easy while preserving confirmation, correct local dates, supplier documents and durable evidence.

**Pending accessibility decision:** requested light dark-accent/white Primary pairing fails4.5:1; darkerblue/white or lightblue/ink owner choice is asked, not silently resolved. All components use standalone tokens and actual composited contrast checks, with printed documents the literal-token exception.

**C6 new-write guard:** New resolutions, credits and replacements require actual retained signed pickup evidence and remaining actual picked-up quantity coverage. Legacy imported settlements stay readable and unchanged; they do not authorize a new no-pickup settlement.

**Klead contrast adjustment (2026-10-11):** The supplied green text `#1A7F45` on `#E6F4EC` measures 4.4451:1, below the owner's mandatory 4.5:1. Use the smallest measured darkening, `#197D44`, giving 4.56258:1 with the same tint. Keep the original reference files unchanged and list this deliberate accessibility difference; all rendered pairs still require actual contrast proof. This does not resolve the separately pending dark Primary choice.

**C6 browser review corrections (2026-10-12):** Measure non-table Lookup/cards and visible forms as well as table cells; empty text samples cannot establish a layout pass. Keep invoice Save/Post in a reserved normal-flow footer after the review so it cannot paint over Drafts or fields. Preserve the existing desktop layout while adding the existing Line total caption to phone invoice cards. Keep dialog Tab/Shift+Tab inside enabled visible controls and restore the trigger on close. Give large price text its own block/line height, reserve space for KPI graphics, and allow whole header words to wrap. Success feedback uses the current language when it changes, without replaying any business action. These are demonstrated presentation/accessibility corrections; pricing, signed evidence, and financial behavior remain unchanged.

## 025 — Verified browser evidence migration and lossless History storage (C6, 2026-10-11)

**Context:** Safari's small text-storage allowance was exhausted by inline uploads and retained migration backups. Repeated large immutable History before/after and reversal snapshots also grew the main JSON, even after files were separated. The owner's C6 request requires no lost files or business evidence, actual twenty-photo proof and no new server/database service.

**Decision:** `prototype/src/file-database.ts` stores immutable company-scoped source Blobs and separate image preview derivatives in IndexedDB `supermarket-prototype-files-v1` (`files`, `backups`). Main business JSON holds `idb-file:v1:<encoded-company>:<SHA256>` references. PDFs and original invoice-photo bytes remain exact for Download; raster previews resize to longest side at most 2000 px, retaining transparency where applicable. A saved file reference is published only after transaction completion, read-back, company/size and SHA256 verification. Existing same-company/content references are idempotent; reads recheck scope and source integrity. Unknown/corrupt legacy image evidence remains retained even if it cannot produce a resized preview.

**Decision:** Before replacing inline files or introducing the C6/History storage representation, archive and read/hash-verify the **exact original JSON string** as an immutable Blob in `backups`, addressed by company/storage key/SHA256. Migrate old `supermarket-prototype-before-*` backup records only after their exact raw snapshot is verified in IndexedDB. Replace files in active records and matching History inverse/guard values together, including historical-only removed files. Serialize writes; abandon stale snapshots if an edit/reset occurs during migration. Read back rewritten localStorage; failures keep evidence recoverable and report a storage error. Business Reset does not automatically delete files/backups; no unrequested evidence garbage collection.

**Decision:** `prototype/src/history-storage.ts` is a **lossless structural dictionary codec for persistence only**. It deduplicates sufficiently large, repeated values at explicitly permitted activity before/after and reversal/transfer/guard paths. Retain every activity entry, ID, actor, timestamp, original/reversal value and order; never prune History or replace snapshots with summaries. Ordinary active business state remains JSON. Expand the version 1 dictionary fully before any permission, conflict, Undo/Revert, projection or migration logic runs. Use the encoded form only when its whole serialized representation is smaller. Round-trip equality is with ordinary JSON persistence, including its existing omission of undefined object properties, not a new business transformation.

**Decision:** Decoder validates schema/version, permitted paths, unique bindings/object keys, typed finite values and bounded non-cyclic references before expansion. Its representation checksum detects accidental corruption and is **not authentication or a signature**. An invalid saved dictionary blocks automatic write-back; retain/archive the raw string rather than overwriting it with fictional fallback. An explicit user Reset is separate from successful recovery; normal migration does not erase legal/financial/physical evidence.

**Why:** Separates large bytes and repeated retained representations from Safari text quota while keeping exact originals, restore evidence and all approved business semantics. No money/stock transaction, server storage, lossy compression, History deletion or data-retention rule is introduced. Final acceptance requires real browser uploads/download hashes/reload/legacy migration and codec round-trip/corruption/conflict behavior; focused checks are not substituted for final proof.

## 026 — Painted-text collision proof and responsive boundary fixes (C6, 2026-10-12)

**Context:** browser DOM Range rectangles include unused font ascent/descent. Vazirmatn primary and Latin secondary names on separate lines can have overlapping reserved rectangles even when their drawn glyphs are separated. Horizontal bounds and word wrapping must remain strict.

**Decision:** after fonts finish loading, derive each word's actual vertical ink bounds from its loaded Canvas TextMetrics and DOM baseline. Keep the full DOM Range for horizontal containment and split-word checks; keep control-box collision and overflow checks. Unsupported metrics fall back to conservative full ranges. Prove the detector in English and Persian by temporarily moving two existing product-name lines onto each other, requiring a collision, restoring original styles, and requiring a clean result. Never change a captured image or business record. Preserve failed earlier diagnostics and all source/image hashes.

**Decision:** let bilingual Cost history headings wrap at spaces and constrain New order number inputs to their real card cells. Retain visible-control/word geometry checks without concealing overflow. Request-detail dates pass full UTC timestamps to the configured-zone formatter, matching the list. The author-edit guard remains ten seconds; its expired-message copy now describes that existing interval.

**Why:** eliminates demonstrably false font-box collisions while retaining a tested genuine-collision failure, and fixes observed narrow-layout defects without changing money, quantities, permissions or stored timestamps.

**HTTP file verification (C6, 2026-10-12):** browsers on ordinary HTTP network addresses omit SubtleCrypto even when IndexedDB is available. Keep native SHA-256 when available and use the same FIPS 180-4 byte algorithm when it is absent. Content references and read-back/hash checks remain identical; native provider failures still propagate. Independent Node comparisons cover standard vectors, block boundaries, offset views and large inputs. Browser evidence distinguishes genuine LAN transport from the managed cloud's explicitly intercepted reserved-origin simulation; never report the latter as a direct LAN connection or bypass an outbound denial.

**Product-name units (C6 visual review, 2026-10-12):** an individually opened Received screenshot showed “400 g” broken between number and unit despite zero per-word findings. Group recognized size/unit fragments in the shared name renderer as screen-only nonwrapping spans; retain the exact original text, stored names, prices and print styles. Extend geometry proof to measure whole fragments and require an English/Persian deliberately split fragment to fail, then pass after restoring styles. Preserve the superseded 98cd725 screenshots/reviews rather than relabelling them as corrected final evidence.

### 2026-10-12 — Persian decimal product-size presentation

Individual review of the corrected C6 Persian Received screenshot found that isolating only the final digit of `۴٫۵ کیلوگرمی` changed its visual reading order. Atomic size/unit matching now recognizes Arabic decimal and grouping separators (U+066B/U+066C), and isolates the entire numeric run left-to-right inside the whole size/unit fragment. Entered names and stored values remain byte-for-byte unchanged. Tests check both retained text and actual left-to-right character positions in English and Persian at all eight widths. The earlier 4bb6ac8 screenshot set remains diagnostic evidence; it is not the final accepted set.

**Plain product-size text (C6 review, 2026-10-12):** the individually viewed Dashboard Activity list retained a raw name string and split `900 g` even after the product-row fix. Apply the same atomic display renderer to Activity, preserving exact entered text. The geometry inspector also scans ordinary visible text nodes for complete size/unit runs, so unmarked prose cannot silently pass. Retain a deliberately split raw text negative control and restoration check. Invoice comparison headings may wrap at spaces; the unit-cost heading must not be forced onto one line in Persian. No field, record, pricing or printing behavior changes.

- **C6 complete size grouping and posted headings (2026-10-12):** The broader plain-text geometry check found raw Products names and standalone size values that could still split `400 g` or `۱۵۰ گرمی`. Route their unchanged display strings through the existing unit grouping helper, and give posted invoice headings the same screen-only wrapping at spaces as draft headings. Preserve numeric isolation, role filtering, business values and printed-document styles; keep the failing width and posted-invoice checks intact.

## 027 — Shared submenu focus and page-control scope (C7, 2026-10-12)

**Decision:** Escape or the RTL-aware back arrow closes only the active submenu, restores its trigger focus and cancels deferred child focus; a retained late frame cannot focus a closed submenu. The exact reviewed function and controlled-frame regression distinguish this intended keyboard-handler change from unchanged business callbacks, controlled values and outside-submenu guards. Do not describe every UI handler as identical.

**Decision:** Scope the page-background white/hairline exception to actual header controls and exclude nested cards/dialogs. Test product editor entry through Lookup and the actual Products header in both light/dark: dialog Cancel stays neutral grey/borderless while the header remains white/hairline. Strict screenshot publication also rejects failed/diagnostic verdicts and visual-failure payloads independently of zero geometry findings; fresh individual review is mandatory. No permission, amount, stored record, print geometry or owner approval changes.

## 028 — Owner approval, resolved choices and C8/E order (2026-10-12)

**Context:** The owner approved C6/C7, required green history-preserving merges before C8 and authorized four stacked PRs without an intermediate review.

**Decision:** Start C8 from gated main `3b6da31`, then E1/E2/E3. Update source docs first at each stage; change prototype/docs/seed only. Deadline October 30, joint owner review. Correct pickup is Owner/Manager only; Supervisor proxy until E1. Dark filled Primary/KPI is #2B59C3 / white; #7397F0 only dark links/icons/tabs/focus. These answers supersede pending statements in Decisions 023/024.

**Why:** No unanswered authority/palette question or silent privilege grant remains.

## 029 — Independent store sale overlay and deterministic lifecycle (C8, 2026-10-12)

**Context:** Mapped multi-buy offers cannot reduce any arbitrary price. A sale must not corrupt regular invoice approval or retained evidence.

**Decision:** Separate each store's SaleSchedule from current regular price and pending SaleRequest. Use reviewed retail targets, Decimal amount/unit, inclusive local calendar dates, versioned History and idempotent clock effects. Sale pauses the ordinary multi-buy effect without mutating its record, excludes mix-and-match and keeps clearance independent. Weighed entry preserves main-unit cents; secondary conversion does not round-trip through lb cents. A changed regular receipt cost defaults Use calculated; same-cost and short-dated receipts preserve manual price.

**Why:** Temporary price restores the current regular price without Warehouse, stock or financial-ledger writes.

## 030 — Linked sale evidence, label intent and source-first proof (C8, 2026-10-12)

**Context:** Requests, receipt alerts, held deliveries, reminders and label checkboxes must correspond to real scoped evidence.

**Decision:** Pending requests cannot charge until guarded approval. Cost alerts preserve invoice/sale/cost/margin before/after and event identity. Hold is an instruction Note, never a StockMovement. Automatic queue stores Regular/Promo preference and source identity; future regular intent cannot overwrite active Promo. Revert checks versions/current clock, never revives an elapsed sale or stale regular price. Currency minimum 2 / maximum 4 formatting preserves stored costs and geometry. Every new acceptance entry starts Planned until executed evidence exists.

**Why:** Real review/labels remain coherent without fabricated movements, settlement or test results.

## 031 — Changed-cost manual prices require the final approval (C8, 2026-10-12)

**Context:** The owner's C8 rule places Use calculated versus Keep in the approval. The older receiving-only Keep path could suppress that approval, and a retained sale alert could claim a decision was still waiting after it had been decided.

**Decision:** Every accepted normal changed-cost receipt with retained manual price creates a versioned approval. Store both price/cost snapshots and the receiver's recommendation in `manual_price_review`; the authorised approver defaults to Use calculated or explicitly Keeps at the original store, retaining manual provenance. Either selected choice requires a reason when below the configured minimum margin or below cost, with the shared **Add a reason. / یک دلیل اضافه کنید.** error. Use a pure `manualRegularApprovalPreview` and the optional final `resolveApproval` decision argument. Same-cost and short-dated evidence stays unchanged. Resolve actual linked approval status in sale-alert presentation, using the current regular amount and **Current regular price / قیمت عادی فعلی** when it is no longer pending. Preserve receipt and alert source evidence.

**Why:** Receiving remains practical without making a recommendation the price approval, and alerts describe their actual state. This specification records no test counts, screenshots or completion claim.

## 032 — Five roles, current actor resolution and atomic People safety (E1, 2026-10-12)

**Context:** The owner replaces Supervisor with five configured roles and grants Branch Supervisor a narrow own-location purchase-cost exception. Static demo accounts, role proxies and scattered Supervisor predicates cannot enforce current assignments or immediate revocation. Existing Floor Worker operations, retained signed evidence and financial privacy must survive.

**Decision:** Use stable Owner/Manager/Branch Supervisor/Floor Worker/Cashier IDs and one explicit capability/field-projection layer without role inheritance. Owner/Manager share current/future company location scope; other people have validated assignment sets. Resolve privately branded AuthenticatedActor from the current company Person/session/setup/epoch for every protected query and command. Await serialized Store.command/query through an IndexedDB readwrite authority transaction, derive canonical resource scope in each domain, and reject stale/forged/missing actors. UI can() is an affordance. actorAtLocation permits only concrete allowed rescope, never a new role/assignment. Preserve narrow retained-inactive correction/settlement policies and active relocation destinations.

**Decision:** People changes, target-version checks, at least one usable Active Owner and session/challenge revocation commit atomically. Count only Active Owners with complete password and required second-step setup; Invited/Deactivated/setup-incomplete placeholders do not count. Floor Worker promotion to Owner/Manager/Branch Supervisor stays Invited until setup completes and revokes former sessions. Nonsecret People/device audit is written in the successful transaction, then exposed by fresh protected authorityHistory summaries without credentials/challenges/sessions/setup internals/private aliases or a generic directory inverse. Latest business and authority share the lock and commit before React; publish cross-tab invalidation after commit and re-read authority on later operations. Raw setup code returns once and is not audited/exported; password and simulated privileged second-step setup precede business access. Separate credentials from ordinary business state. Branch Supervisor invoice/Supplier items/Orders costs are independent of balances/margins/catalog costs/approvals. Their sale hold is a separate instruction command; their return authority stops at signed pickup. Floor Worker replacement/ordinary-offer/template/calibration grants remain independent. General Settings/financial/price decisions remain Owner/Manager.

**Decision:** Normal verified migration retains legacy people/passwords/forced newemployee setup/preferences and immutable business/file/History evidence; supervisor aliases the same Manager. New audit carries stable actor IDs plus immutable display/role snapshots. Only explicit Reset restores six configured fictional users and revokes replaced sessions; demo.reset requires the fresh canonical Active/setup-complete demo_fixture person, not a role literal or familiar username. Registered computer defaults only if allowed; otherwise sole assignment or All my locations/company All locations. rh-supervisor on North York starts at All my locations for Richmond Hill/Newmarket, never a silent first store. Isolated phones cannot share records or demonstrate remote logout; production authenticated server, real passkeys/invites/push remain later.

**Why:** Reuses the exact capability/domain rules in a future authenticated server without trusting browser role claims, accidentally granting Branch Supervisor another role's powers, racing the last Owner or rewriting historical authors. This entry records the E1 source specification before code; actual implementation and evidence are added separately after verification.

### E1 scoped ordinary-offer Stop and internal jobs

Retain Floor Worker own-store Stop with exact company/store/Offer ID+version suppression, preserving the global Offer and other stores. Clear rather than delete suppression during valid Undo; Sale pausing does not advance Offer version. Internal clock jobs require a repository-minted current-draft witness, never a Manager role proxy. These choices retain operational behavior while enforcing scope and original history.

## 033 — Explicit damaged-History quarantine and ordered Reset retirement (E1, 2026-10-13)

A healthy existing canonical IndexedDB business record takes precedence over any retired legacy text. Do not read a stale legacy dictionary, falsely quarantine healthy data, recreate people, reset a password, or replace existing company business records during normal startup.

When the company has no canonical business record and its retained legacy History dictionary is invalid, retain that exact legacy string. Before creating a separate fictional quarantine demo, save its exact UTF-8 bytes as a company/storage-key/SHA256 addressed FileDB backup; wait for the write transaction, read it back and verify both exact text and hash. If this verification fails, startup remains blocked, the original text/file bytes stay retained, and no usable business view or fabricated authentication is published. This is not a completed migration or recovery of the damaged business data.

After successful verification, persist a private canonical recovery marker containing only its schema, legacy source key, original digest, verified backup reference and phase. The quarantined business is explicitly a separate fictional demo. Normal sign-in/setup and protected queries/commands use the genuine current company directory, credentials, sessions and capabilities. Existing people, passwords and sessions are preserved. Valid demo edits may persist in the separate canonical quarantine demo; they never overwrite the unreadable legacy string. Reload retains both the private marker and the visible recovery notice. Public business projections contain neither that marker, the raw damaged history nor credential data.

Only an explicitly confirmed, fresh authorized `demo.reset` command can replace the canonical demo and six configured people. Reverify the exact original backup and any remaining legacy source before that transaction. A backup/check/authority/canonical-transaction rejection leaves the current canonical data, directory, original text and recovery notice unchanged. Keep all immutable files and backups.

Canonical Reset and legacy localStorage retirement are different storage transactions. After a successful canonical Reset, persist the `reset_committed` recovery phase until a current authorized command verifies the backup again, retires only the matching old legacy source and clears the marker. Failure in retirement is a **committed Reset with retirement pending**, not a rejected Reset or a silent completed recovery. Retain the original backup and explicit notice; the old text also remains whenever removal did not succeed. A partial retirement can have removed the old text before the marker write failed; its exact verified backup remains and the notice persists. Retry only this already-authorized retirement after a genuine allowed session resumes or signs in, without resetting business or people again. Never remove changed/unverified legacy text.

Recovery notice (English): **Saved history could not be read. Your original data is retained. You are using a separate fictional demo. Allow browser storage, then reload, or choose Reset demo.**

Recovery notice (Persian): **سابقهٔ ذخیره‌شده خوانده نشد. اطلاعات اصلی شما نگه داشته شده است. اکنون از یک دموی ساختگی جداگانه استفاده می‌کنید. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید، یا بازنشانی دمو را انتخاب کنید.**

Committed Reset with retirement pending (English): **Demo reset is complete. Your original history is backed up, but its old browser copy could not be retired. Allow browser storage, then reload.**

Committed Reset with retirement pending (Persian): **بازنشانی دمو کامل شده است. از سابقهٔ اصلی شما نسخهٔ پشتیبان گرفته شده، اما نسخهٔ قدیمی آن در مرورگر پاک‌سازی نشد. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید.**

Specification first; implementation and tests require separate actual-source evidence. No service, account, deployment, or recovery of unreadable financial/physical evidence is implied.

## 036 — Retain public Cashier product links without private Product access (E1)

**Context:** the blanket E1 route denial removed the existing C8 public Product Code shortcut. **Decision:** accept only the exact one-code product route for an existing non-archived protected same-company public product and genuine Lookup grant, then replace it with the existing Lookup search route. All additional/duplicate/private/location parameters and unknown/foreign products remain denied. Aggregate Lookup still needs explicit Store selection. **Why:** retain working public navigation while never mounting private Product details or leaking cost/history/editing.

## 037 — Preserve the retained handling-origin receiving exception (E1)

**Context:** C8 expressly permits a handling worker to retarget and post their own unposted invoice at any active same-company receiving location without destination browsing. E1 must keep existing Floor Worker operations; review-only narrowing was a regression. **Decision:** restore destination selection and posting only for the canonical creator/handler/reviewer with an active assigned retained origin. Verify active same-company destination and current genuine actor at each boundary. Branch Supervisor assignment rules, unrelated Orders/destination records, posted visibility, Short receiving and reviewer reassignment remain unchanged. **Why:** retain the approved Warehouse receiving workflow without adding general location access.

**Note status audit correction:** successful status actions retain the exact note entity ID/type and actual note location on their newly appended immutable audit entry. Undo resolves that exact source through current capability, actor and conflict checks; it does not require the acting Manager to be the note author. Existing audit events and money/physical records are unchanged.

## 034 — Canonical store price work, physical confirmation and personal events (E2, 2026-10-15)

**Context:** Approved prices change in the app before a Store changes its own register and shelf labels. Every real price/offer source must feed one coherent task, while browser role claims, copied snapshots and preview-only printing must not create false completion.

**Decision:** Compare exact public effective terms for every active selling Store inside the current-authority/latest-business transaction for decisions and private-witness clock reconciliations. Create/coalesce one Pending task per product/Store with immutable source steps and real actor attribution; no Warehouse/no-op/initial-upgrade backlog. Prepare Sale end work on its last local day for the next local midnight, matching the same end effect at actual expiry. Preserve actual staff actions across coalescing and require current-target confirmations. Undo cancels only unacted work, never a physical print.

**Decision:** Register plus actual label confirmation or reasoned waiver gates Done. Current Owner/Manager/assigned Branch Supervisor may register/complete; Floor Worker label-only, optional completion still requires permitted register evidence. Printing retains exact Regular/Promo preference, frozen current task/source checks and physical geometry; queue/preview never claims output. Personal event records use genuine current directory recipients, scoped links/read state and safe copy parameters, with mandatory deduplicated 24-hour supervisor/48-hour company escalation. Settings configure routing but not away the owner's minimum recipients. Normal additive migration first verifies an exact prior-state backup and initializes a non-backlogged baseline.

**Why:** Store work and customer charge remain distinct without losing source changes, leaking costs or inventing completed physical actions. The server can reuse capabilities/transactions later. This entry is specification-first; test counts, screenshots and hosted/phone results require separate executed evidence.

## 035 — Compact phone rows and public-only installable shell (E3, 2026-10-15)

**Context:** The owner needs usable phone lists and an installable demo while this prototype still stores authority and business data independently in each browser. Caching signed-in HTML or auto-reloading pending work would create misleading availability/security and risk losing edits.

**Decision:** Use the specified seven compact phone-row families over the same protected DTOs, with existing wider tables/role masking and EN/FA390/430 checks. Generate configured company manifest/icons/standalone/theme and a dedicated bilingual No connection page. Cache only exact generated same-origin public hashed code/style/font/logo/icon/offline assets, including actual allowlisted `.mjs` workers. Never cache navigation/auth/Access/API/authority/business/upload/original responses or accept redirected/MIME-mismatched login pages as assets.

**Decision:** Waiting update uses explicit Demo action, real pending-work leases and dirty UI/print/recovery state. Keep current work/release until safe activation, preserving browser business/file data. Document no-Docker Ubuntu/Wi-Fi and optional private Cloudflare Pages/Access production plus wildcard-preview gates with placeholder-first verification. Create no resource/account/deployment and claim no real hardware installation. Barcode search focus is not a live camera scanner.

**Why:** Phone presentation and installability improve without pretending to add shared server data, remote delivery or recoverable cached business pages. Hardware, hosting, Safari and physical printer evidence remain separate from Chromium/emulated tests. This entry is source-first, not a test or deployment result.

## 038 — Retain explicitly shared Cashier notebooks and public manual-price comparisons (E1)

**Context:** the full retained browser checks found that the new shell denied Cashier Notes even when the current protected notebook projection contained an explicit custom read grant. The new catalog DTO also retained the manual badge while suppressing the public Rule price / Manual price pair required by the existing requirements.

**Decision:** allow the Cashier Notes route only when its fresh protected view contains an actual permitted custom notebook. The existing company/location/ACL projection and command checks continue to exclude built-in Notes, private routes and unauthorized contributions. Revoking the grant removes the route without deleting the entry. Project only the two retained selling amounts for each currently visible active selling Store; canonical manual markers, actor/decision metadata, costs and margins remain private. Render the permitted public comparison without calling the financial query; keep the existing private Manager comparison/margin path.

**Why:** restore approved staff workflows without broadening financial authority or recreating prices from hidden costs. Regression checks cover real Provider routes, current ACL and company/location denials, public-pair isolation and retained native workflows. Executed results are recorded separately.

## 039 — Print the complete permitted table independently of phone layout

**Context:** the retained phone Payables print check found that responsive JavaScript removed the cheque column before the print stylesheet ran. The amount and payment record were intact, but the original cheque reference was absent from the printed DOM.

**Decision:** the shared table observes native beforeprint/afterprint and print-media changes. Commit all currently permitted, explicitly enabled columns synchronously before print capture, suspend screen-only collapsing/compact rows, and release fixed screen column widths for the paper layout. Keep explicit hidden columns excluded and restore screen layout plus expanded rows afterward. This changes presentation only; protected queries, payment data, scope and money remain unchanged.

**Why:** a phone viewport must not remove payment evidence from an authorized printed report. Regression checks retain DEMO-1001, the exact -$50.00 amount, worker Payables denial and ordinary desktop/phone controls. Physical printer alignment remains an unperformed hardware check.

## 040 — One route change when opening a posted invoice

**Context:** the posted invoice name link both navigated immediately and started an asynchronous workspace selection that navigated again when it finished. A quick browser Back could return to the list and then be undone by that late completion.

**Decision:** the name link and end chevron navigate once. The existing route effect selects the invoice through the current protected workspace command. Its eventual completion does not push another route. Keep the Posted tab, per-user column preferences, current authority and original invoice evidence intact.

**Why:** browser Back follows the user's latest action. A regression delays delivery of a genuine authenticated repository command after its real permission check and durable work, then exercises browser Back before releasing it. The original implementation fails with the exact unwanted detail route; the correction retains the list.

## 041 — Retain Payables input when the location does not change

**Context:** selecting the already selected Payables location unnecessarily adopted another authority projection. That refresh could replace the enabled search input during typing and lose its text and focus.

**Decision:** ignore the unchanged location when the action is an ordinary location selection. Explicit Clear filters and actual location changes keep their existing behavior. Every query, financial action and current-authority check remains on its original protected path.

**Why:** a no-op location choice must preserve live filter input. A genuine Provider regression delays delivery of the real refreshed projection and reproduces the old empty input; the repair retains typed text, focus, matching supplier and financial records. Companion cases retain Clear filters and the actual Floor Worker Payables denial.

## 042 — C9 session presentation and shared display contracts (2026-10-19)

**Context:** the owner found transient light/sign-in frames, missing decided sale requests, conflicting regular/sale prices, ambiguous note status and inconsistent lists. The four approved feature PRs were merged in order only after all seven checks passed, following the separate CI sharding PR.

**Decision:** preserve authority invalidation while retaining sanitized shell chrome; delay progress/first-start loading 300 ms and initialize saved theme before app code. Separate per-person note receipts from completion, use protected action-specific Undo, and retain immutable sale decisions and price-update snapshots. Reuse one selling-price component and one 40 px filter toolbar. Existing pricing/financial/physical/permission contracts stay in force. Notebook definitions live on Notes.

**Decision:** WebKit runs only the new non-localhost dark-theme no-reload test; existing Chromium projects retain their suite, workers, retries and skip rules. C9 includes the restored device-access instructions, with no hosting resource/deployment or claimed real Safari/phone evidence.

**Why:** correct the observed interactions without presenting stale private information, recalculating retained targets or implying remote synchronization. Source contracts precede code; executed evidence is recorded separately in PR_C9_REVIEW.md.

C9 weighed-price boundary: a retained $22.02/kg sale can convert below $9.99/lb exactly while both display the same cents. Promotion markers/comparisons require a reduction in the displayed main-unit cents as well as the exact canonical amount. Keep the actual entered-unit display, effective price and history unchanged; never reconstruct a retained kg amount from rounded lb cents.

## 043 — Retained expectations and whole invoice references (2026-10-19)

**Context:** C9 explicitly replaced several old presentation expectations. The original layout guards also exposed real invoice-reference wrapping and overlap defects, which Ali separately approved fixing.

**Decision:** update only obsolete expectations, preserve business/layout assertions and runner budgets, and list every changed test. Verify one shared-price announcement through the native accessibility tree and genuine Persian search across notebooks. Keep the Product provenance invoice code together. Give Supplier items' invoice column a 220px minimum and priority so lower-priority values move into the existing row details when necessary; retain its previous phone visibility and all permitted values/actions.

**Why:** meet the requested presentation without restoring old behavior, clipping invoice references, shrinking typography, losing data or weakening tests. Wait for all four browser shards and all exact-head checks; leave C9 unmerged for Ali's review. Equivalent invoice-reference layout fixes are authorized; other real bugs or ambiguous requirements still require a question.

## 044 — Observe ready views and actual rendering opportunities (2026-10-19)

**Context:** the complete 27361bb browser run exposed more old markup assumptions, a pre-mount inspection and a frame watcher that also classified unpainted parser mutations as frames. The app's intended delayed startup and approved responsive data allocation remain.

**Decision:** await the real Sign-in heading or populated supplier row before inspecting their unchanged layout/data contracts. Test the new shared-price/offer/tax markup and counted tabs. Check dark backgrounds on every animation frame; keep sign-in/workspace guards on both mutation and frame observations. Record only public auth labels, errors and capability flags when diagnosing the unresolved WebKit initial sign-in, with no input values or authority/session records.

**Why:** verify the requested visible behavior without restoring obsolete presentation, weakening financial/permission assertions, counting pre-paint CSS loading as a displayed flash or changing workers, retries, skips and budgets. All four next-head shards and the final browser gate still must pass; C9 remains unmerged.

**WebKit startup diagnostic amendment:** after all four `ac10919` shards completed, the only unexpected failure remained WebKit's initial sign-in/storage error. Ali explicitly authorized fixing startup while preserving data and authentication rules. First collect bounded native exception metadata from the WebKit test only: exception name/code, limited message and app-frame locations, with no input values, records or credentials. Synthetic native Promise/IndexedDB controls check that observation preserves rejection/handler identity and default abort behavior. This diagnostic iteration changes no application authentication, storage, configuration, business data or runner budgets and is not an app fix. Await a real Sign-in heading before the original 1080p card geometry check; retain its assertions and phone skip. Exact-head WebKit/LAN proof still requires all four CI shards and the final browser gate.

## 045 — Assemble machine dates independently of localized display order (2026-10-19)

**Context:** controlled valid localized slash ordering caused the real initial fixture/runtime path to throw an invalid-time RangeError. A localized formatter's display string is not an ISO date contract. The owner has authorized startup repairs that preserve data and authentication; native WebKit's actual cause remains unconfirmed.

**Decision:** have initial relative dates reuse the existing `companyDate(configSeed, now)` parts-based ISO assembler. Keep the original Date construction, `setDate` offsets, configured timezone, retained records and authentication flow. Add regressions for offsets/company-local midnight, fixture dates, genuine runtime credentials/second step and reopening unchanged business. The original source fails seven of the same eight cases; the repair passes all eight. Do not reset data, bypass authentication or remove the native diagnostic test.

**Why:** prevent a proven portability failure using the established company-date contract. Mixed complete local runs and passing focused checks remain separate evidence; none establishes a green full suite or the native WebKit cause. Require new exact-head CI, and leave C9 unmerged for Ali's review.

## 046 — Persist attachment bytes without WebKit Blob preparation (2026-10-19)

**Context:** the completed f371881 run retained 790 browser passes, 50 existing skips and one WebKit startup failure. Its native diagnostics identify IndexedDB `UnknownError: Error preparing Blob/File data to be stored in object store`, followed by `FileStorageError: unavailable`. The diagnostic dates were valid ISO dates; Decision 045 is separate date hardening, not this failure's cause. High-level GitHub statuses lagged the actual completed job steps and did not prove a runner queue.

**Decision:** keep the public Blob file/backup interfaces and their existing references, hashes, company scope, metadata, exact downloads and recovery gates. Encode only new browser-repository writes as `array-buffer-v1` byte records with explicit source/preview/raw MIME types. Finish conversion before opening the existing write transaction, then retain commit/read-back/hash verification. Read legacy Blob rows without rewriting or deleting them. Keep database version 1 and both stores; unknown or malformed encoded rows fail integrity checks. No authentication bypass, demo reset, evidence deletion or authority change is permitted.

**Why:** avoid the exact native operation that fails while preserving retained evidence. Adapter regressions must exercise the observed Blob rejection, original and preview bytes/MIME, old Blob rows, backups, corruption and scope. Raw-IDB browser inspectors must understand both formats without weakening byte/hash, migration-failure, quota, permission or recovery assertions. The original WebKit project remains scoped to its one no-reload case. Require all four browser shards and every exact-head check before C9 is called green; leave it unmerged for Ali to test.

## 2026-10-19 — S1 foundation pass (Claude)

- **Shared look lives in one file.** `prototype/src/foundation.css` loads last (from `main.tsx`) and owns tables, fields, tabs, KPI cards, detail lists, boxed list items, back links and blue clickable names. Page stylesheets may arrange a page but must not restyle these shared parts. Why: 59 per-PR stylesheets kept overriding each other, which caused most of the layout bugs Ali found in C9.
- **Price updates track only Seen and Done** (Ali). Each records who and when; Done no longer depends on register/label checkboxes. Older checklist fields stay in stored records as history.
- **Note authors cannot mark their own note seen; a notebook setting chooses who may mark notes done** (Ali). Default stays "anyone who can add notes".
- **Everyone adds dates** (Ali). Cashiers receive `dates.add` only: they can add a date at an assigned Store (recorded with who added it) but still get only the public date hint, never the full list or removal.
- **A returning signed-in tab shows the app frame while it starts** instead of a blank page, so a browser reload (seen in Safari) no longer flashes white.

## R2 receiving decisions — 2026-10-21

### 2026-10-21 — Suppliers are active on creation

Supplier approval and required contact fields slowed receiving. Require only the name; contacts, representative, terms and address are optional. Notify Owners/Managers once to complete a missing profile and resolve the notification when complete. Never block posting for supplier profile details.

### 2026-10-21 — Track dates defaults to No

Repeated Yes/No questions add no useful review. Default each line to No unless its matched product already tracks dates; Yes exposes the date and may suggest printed expiry.

### 2026-10-21 — One confirmation per line

Per-field buttons caused excessive controls. Confirm line acknowledges the entire validated line, highlights included; invoice details and totals each retain one Looks right.

### 2026-10-21 — Highlight only actual questions

Ordinary blank optional barcode, lot, printed expiry, handwritten note, order reference, bill-to and ship-to fields are quiet. R2b retains an explicit AI question even when the optional value is empty; Not on the invoice acknowledges its absence with who/when. Missing required supplier, invoice number/date/total, line description/quantity/cost remains highlighted.

### 2026-10-21 — Calculate missing paper totals

When total and tax exist derive subtotal as total minus tax; when subtotal and tax exist derive total as their sum. Fill it and label Calculated: compare with the paper until the totals acknowledgment.

### 2026-10-21 — Rare printed evidence stays under More details

Keep lot number, printed expiry, barcode and printed description out of the compact line editor by default. Only nonempty highlighted hidden barcode, lot, printed expiry or note evidence opens More details automatically; explicit Next/Show may reveal an empty flagged field; a question already visible in English name/description leaves it closed. Opening the section retains printed description and all evidence fields after acknowledgment.

### 2026-10-21 — Correct and resubmit approvals

A rejected product/price request can be corrected within pricing rules and permissions and resubmitted as a new pending request linked to the rejected record. A pending category can also be corrected before approval, with recalculation and History.

### 2026-10-22 — Compact reference within the retained receiving layout budget

**Context:** the approved receiving reference requires a compact five-column table and quiet totals while the existing 2px stability and 25-line/2700px desktop budgets remain mandatory.

**Decision:** use a dedicated receiving table, compact closed rows with at least 44px targets and small work gaps, retaining normal typography, card tokens and 44px fields. Totals defaults to label/amount rows with calculated tags; Edit exposes the real fields, automatically shown for actual non-calculated questions or invalid attempted totals. Keep one whole-card Looks right and stable line identities. Phone details starts as a compact disclosure and expands through its chevron or needed-header navigation.

**Scoped reference variants:** `.ui-dialog-structured` footers use 44px intrinsic actions, surface-fill/1px-field-border secondary and filled danger, preserving general 40px/borderless rules elsewhere. Phone receiving Confirm spans its footer above two equal secondary actions; phone progress Next/Post use equal columns. Those two phone layouts allow stretched 44px actions; other buttons remain intrinsic. Below a 340px toolbar-container width, Rotate moves into More rather than wrapping, fitting the retained sidebar/top-bar layout.

**Phone stability:** temporarily reserve the fixed editor body's height while fields collapse so Track dates Yes → No does not clamp its internal scroll position. Release on user wheel/touch scrolling, close or navigation; retain the existing 2px guard and all business values.

**Why:** match the approved composition without losing evidence, shrinking controls, moving the user's row or weakening existing guards. This changes presentation only; canonical validation, Decimal calculations, pricing decisions and authority remain unchanged.

### 2026-10-22 — Boxes keep what the person types while focused

**Context:** saves go through the asynchronous browser database. Inputs bound directly to the saved value were re-rendered with the older saved value between keystrokes, which dropped or repeated characters ("20" became "240").

**Decision:** `BufferedInput` (and `NumberField` with `keepTyping`, used on the receiving screen) shows the person's own text while the box has focus and the saved value again on blur. A saved value that matches something they typed (including numeric forms like "7" for "007", or 0 for a blank box) is treated as an echo and ignored; any other new saved value, such as a price chip or recalculation, replaces the text at once. Changes made without focus are never buffered.

**Why:** correct quantities and costs are the core of receiving; this removes a race without changing validation, Decimal maths or what is saved.

**Scope:** opt-in. Screens that correct a value at once while typing (Labels copies snap back to 1 with an error) keep the plain `NumberField`.

### 2026-10-25 — R2b 1.1 imported delivery dates (default pending owner confirmation)

Imported historical readings use a recognizable handwritten delivery date/time in the configured company timezone, stored as UTC. Otherwise use the invoice date at local noon; live/simulated upload and manual entry keep now. Mark either imported choice as a Received question with its source explanation. Initial received stock events use that delivery instant; import/posting/audit timestamps remain the actual command time. Date-only handwriting uses noon and a missing handwritten year uses the invoice year. Multiple competing handwritten dates, expiry/phone-note dates, ambiguous numeric dates, invalid dates and nonexistent local DST times are not guessed: fall back to invoice-date noon, or leave Received unresolved when no valid invoice date exists. The reviewer can change or acknowledge the result. This is the requested migration default for Ali to confirm.

### 2026-10-25 — Conservative import defaults retain evidence

**Context:** historical papers omit fields and use inconsistent names, packs and terms. **Decision:** use configured currency; derive only compatible totals; infer terms from the latest strictly earlier same-supplier recognized paper; interpret Monthly as next-month first. Retain printed evidence, generated-code provenance and exact fractional-case cost basis. Extract only unambiguous contacts and never overwrite curated values. **Why:** reduce typing without manufacturing unresolved quantities, money or source evidence.

### 2026-10-25 — Explicit absence and targeted review

**Context:** an AI can explicitly question an empty optional field. **Decision:** keep that question until an edit, line confirmation or Not on the invoice receipt. Ordinary blanks stay quiet. Auto-open More details only for nonempty hidden questions; explicit Next/Show may reveal empty ones. Incomplete Post explains and focuses the actual fix without writing; authority/pending restrictions remain. **Why:** make review complete without unnecessary open sections or fabricated values.

### 2026-10-25 — Reuse protected invoice state and correction flows

**Context:** posted visibility, JSON entry and corrections must agree with receiving. **Decision:** share authorized workspace/saved selectors, retained Original viewing and receiving layout; add JSON entry without a reset. Received-date correction appends metadata; financial correction stays local until a reasoned canonical preview and confirmed append-only delta. Use shared 32px label actions and scoped surface-fill forms, keeping ordinary controls and the existing 2px/25-line stability budgets. **Why:** improve the workflow while retaining authority, source, money and physical evidence.

## R2c Group 1 — Manager dashboard composition (2026-10-26)

Context: the owner approved three replacement dashboard PNGs. Decision: retain the existing shell and canonical protected queries while replacing the old four colored/equal-height composition with five surface tiles and content-height 2:1 cards. Use Monday–Sunday calendar purchase weeks, exact retained invoice totals and current protected approval/sale margins. Phone keeps all five tile values in two columns; the fifth starts the next row. Notes/Activity remain below the primary phone sequence, and prior receiving/return/price-change lists remain under More operations. Why: match the approved hierarchy while keeping every existing operational destination and financial/permission rule.

## R2c 7.2 — Configured Lookup categories (2026-10-26)

Context: imported products may have no AI category. Decision: configured active pricing categories and counts are the stable category filter; optional AI categories remain an independent refinement. Combined filters use the existing per-person/company/location session preferences. Not approved here uses a protected public selling-price query rather than interpreting a company default as a branch decision. Why: imports stay discoverable and pricing evidence stays behind the query boundary.

## R2c 7.3 — Explicit branch approval evidence (2026-10-26)

Context: the general catalog helper falls back to the company default, which cannot establish a concrete store’s approval. Decision: add a protected branch Lookup projection that derives membership from retained deliveries/stock/approved prices and approval from explicit existing decision evidence; return public prices and presence only. Show assigned-store comparisons only when this store has no approved price. Keep the aggregate 0.13 query unchanged. Why: staff can discover a shared product without mistaking another store’s/default price for permission to charge it here. The requested product default remains explicit in open questions.

## R2c 7.1 — Everyone creates returns; evidence precedes money (2026-10-26)

**Context:** Ali explicitly permits all five roles, including Floor Worker and Cashier, to create photographed returns. **Decision:** add precise scoped read/create grants and one existing-record workflow, with genuine creator/audit, durable request/source/session-bound photos, canonical posted-receipt cost/currency snapshots and idempotent final creation. Damaged/Expired creation requires photos, superseding the older blanket optional-creation-photo statement; optional pickup photos remain separate. Cashier gains no cost, Suppliers, pickup, cancellation, replacement, settlement or Payables authority. **Why:** operational reporting must preserve evidence without granting financial powers.

**Context:** setting goods aside is not supplier pickup or credit. **Decision:** create `open` → Waiting for pickup and a separate Owner/Manager informational expected-credit preview with `deducted:false`; only existing signed pickup starts the configured provisional deduction. No creation-time stock, price, approval or ledger effects. **Why:** prevent premature/double deductions while making the return immediately discoverable.

**Context:** manual invoices can lack import currency and company currency can change after receipt or return creation. **Decision:** use only consistent retained original/effective invoice and canonical invoice-ledger currency evidence; block missing/conflicting/foreign currency for manager review instead of using today's setting, FX or catalog cost. Freeze source cost/currency at creation; later ambiguous receipts cannot invalidate it. Currency mismatch after creation keeps the original preview denomination and blocks new-return pickup/correction/monetary credit writes until the original currency matches. Legacy ambiguity/settlement rules remain. **Why:** never relabel historical money or manufacture a conversion. These conservative defaults require no additional owner decision to complete the authorized work.

## R2c 7.3 follow-up — Preserve a reviewed sale basis after End (2026-10-26)

Context: the active Sale established a local charge, but ending it could hide its unchanged regular basis when only the company default held that basis. Decision: the protected Lookup query may use the actual approved Sale’s retained canonical regular-price snapshot for that same product/company/store after End or clock expiry. Require retained Owner/Manager creation evidence, exact current basis equality and matching currency reconstructed from the genuine price-term review time and audited company-currency changes. Stopped/reverted, foreign/unassigned, unreviewed or changed-basis records do not establish approval. Read the snapshot without writing a new regular price or financial decision. Why: preserve C8’s automatic return to the regular price without treating arbitrary company defaults as local approval.

If a genuine company-currency change has the exact same recorded timestamp as the price-term review, command order is not proven. Lookup withholds this Sale-basis evidence instead of guessing or relabeling the amount; the read still writes no business record.

## R2e A: preserve measured-case and paper arithmetic

A case cost must never become a cost per lb merely because the quantity unit changes. Preserve explicit measured case evidence and source kg/lb arithmetic; derive canonical pricing independently and round the invoice amount once. Keep paper line totals separate from recalculated amounts, with a protected, audited mismatch decision rather than implicit acceptance during Confirm. This prevents money changes from representation changes and preserves partial receipt evidence.

## R2e C8/C11/C14 — Operational input and fictional seed defaults (2026-10-27)

Return unit conversion keeps actual retained source cost/currency and normalizes kg/known cases to existing whole-unit/three-place-lb pickup quantities, with half-up lb rounding, a visible canonical preview and retained entered quantity/unit. Unknown packs are not choices; conversion evidence participates in stale-source checks. Lookup filters use protected public booleans scoped to current permitted locations and the existing recent-price window. Fresh/reset construction alone adds explicit fictional approved branch prices, retaining the one existing pending new-product example in North York and never populating saved-store gaps. These choices satisfy the authorized review fixes without inventing inventory availability, money authority or a migration rewrite.

## R2e fixed-size package derivation

Use the stable company Product Code as the parent reference; add package records to the existing Product collection so labels, offers and lookup retain normal product identities. Extract category rounding from the existing Decimal engine rather than emulate it by multiplying/dividing a cost divisor. The existing protected commit/clock adapter derives active child prices before Price update capture, preserving same-write task/label/audit effects. A narrow `catalog.package_edit` grant gives Branch Supervisor the explicitly authorized package operation without general catalog edits or price approval. Public configuration omits container cost. Archive active packages before orphaning their parent. Manufacturer GTIN formats retain their original digits while uniqueness compares zero-padded identity aliases. Additive defaults are protected by an exact verified backup and revision check.

## R2e E — Separate store and maker presentation (2026-10-27)

Context: the store app needs secondary maker attribution while remaining reusable for other stores/makers. Decision: public optional top-level maker config, shared theme-aware original-asset component and one staff-print attribution component; retained stores read defaults without a write. Why: preserve store palette/business evidence and existing print language while making replacement/omission a configuration choice. Native install metadata is built from configuration; live title/favicon follows the authorized public config.

## R2f D1 — Separate elapsed display from completed payroll

Context: the approved day sheet shows current elapsed hours, while R2d correctly keeps a missing-Out shift at zero completed hours. Decision: a pure daily display helper adds current-day elapsed minutes to presentation only; canonical week/CSV/print durations and blank Out evidence remain unchanged. Why: match the live staff view without inventing a payroll clock-out. Reuse the established save registry and original-actor/navigation bridge rather than replacing their workflow during the redesign.

## R2f D2 — Preserve staff history and staged evidence

Context: the approved directory moves Add into an inline form and replaces row actions with a menu. Decision: retain protected staff commands, the original signed-in actor, soft archival and existing shift identities; check the captured staff version before saving a staged edit/status change. Keep failed asynchronous archival in its confirmation dialog and retain typed edits on failure. Why: presentation changes must not erase history, overwrite newer staff details or close before the real write succeeds. An unchanged retained login link is omitted from an edit patch so a name-only correction does not clear or recreate an account that is no longer an eligible new selection.

### 2026-10-28 — R2f D3 atomic weight-editor authority and cost evidence

**Context:** the approved weight editor combines parent metadata, new cost, optional Change price and package rows, while receipt evidence and current branch prices must remain trustworthy.

**Decision:** stage every field and package operation until a single actual protected Save. Existing cost changes create ordinary pending rule-price review; explicit Owner/Manager staged regular-price decisions reuse their existing authority and acknowledgments. A private attributed cost marker fingerprints the complete effective accepted receipt basis; a new receipt, same-line correction or later delivery supersedes it. Derive package costs independently per branch. Give Supervisors the narrow package-only dialog, without full Product editor or cost access.

**Why:** Cancel/failure writes nothing, current charges remain approved, and no invoice, stock or payable is invented or rewritten. New package identities are truthfully Assigned on save and date tracking defaults Off until actual date evidence is entered. A pending unrelated invoice-price review is resolved before a new manual cost edit, avoiding silent review replacement.

## 2026-10-27 — R2f D7 screenshot precedence and truthful dashboard captions

The approved phone PNG places This week before Approvals; implement that order although the prose says after purchase charts. Use Reminder window rather than claiming every product expires within seven days: existing reminders are configurable. Count actual grouped deliveries rather than receipt product lines, without publishing private source identities. Prior activity dates use compact English month/day values in both interfaces to match the approved value presentation; today/full timestamps still use company-local boundaries. Neighbouring purchase cards alone stretch to equal height.

D7 replacement delivery counting uses each actual replacement stock-movement identity. The existing canonical workflow emits one movement per replacement event, so distinct receipts for one return on the same day remain distinct even when the Received projection has no timestamp. It never groups those events by return/date. Invoice multi-product lines still share their actual source/timestamp group.
**R2f D8 retained-credit read (2026-10-28):** Use a separate fresh-actor/returns.amount_read query rather than adding private money to public return DTOs. Reuse existing signed memo line cents and proportional partial-settlement rounding; value unpicked coverage only from original frozen cost/currency, rounding each line half-up. Require signed quantities and projections to agree. Missing/conflicting legacy facts remain unknown, preserving original currency without a catalog fallback or FX. This is a readonly display and creates no financial/stock evidence.

### R2f D10 — Retain case evidence inside the approved item row (2026-10-27)

The reference hides pack editing while the existing request command requires genuine units-per-case for catalog cases. Keep the approved Quantity/Unit/bin composition and expose the existing editor through a compact metadata disclosure; auto-open it when required evidence is missing. Retain optional unknown packs for free-text items. This preserves canonical normalization without guessing a pack or adding a permanent extra control column.

**R2f mass labels (2026-10-28):** The owner's explicit screenshot precedence overrides the older Latin-unit wording for approved R2f weight presentations. Add one reusable massUnitLabel map plus opt-in shared price/size presentation instead of rewriting stored units or arbitrary product-name text. D3 and D4 use the same FA labels; ordinary UnitSize and non-opted-in price displays retain their prior behavior.

**R2f numeric captions (2026-10-28):** Numeric headings describe values and therefore inherit the interface's bundled language font. Nonnumeric states inside a numeric cell opt into the shared caption class. Actual numeric data keeps Manrope. Chromium's actual platform-font evidence showed Persian heading glyphs falling back to a host Arabic face, whose width differs across Linux images; using bundled Vazirmatn removes that dependency without changing widths, padding or alignment tolerances.

### 2026-10-28 — All-location cost review preserves each branch's decision

**Context:** one all-scope price proposal cannot represent distinct branch manual prices and prior receipt costs.

**Decision:** keep the one actual all-scope manual cost marker, but create ordinary proposals at each freshly permitted selling branch, preserving its actual prior cost, approved price and manual Keep/Rule provenance. An explicit staged regular-price decision suppresses only the branches it covers. Unknown cost remains null; unapproved branches do not borrow a company selling amount as approval evidence. Bind actor/session/location and target eligibility into the draft fingerprint.

**Why:** this preserves independently approved prices and allows a genuine Keep in one branch and Use rule in another, in the same atomic workflow without new authority or invented receipt/price evidence.

## 2026-10-28 — Stable retained invoice-name glyphs across interface languages

The receiving summary displays the retained English product name. At 1280px, the Persian interface inherited a Vazirmatn-first order, mixing its spaces/punctuation with Manrope letters and making “Canned Fava Beans 400 g” overflow the product cell. CDP confirmed both were bundled faces; this was not a host-font substitution.

Use the reusable `--font-en-bilingual` order (Manrope, Vazirmatn, system fallbacks) only for that retained-name display. Latin characters now use the same face in both interfaces; actual Persian characters still have the bundled fallback. Keep all column widths, single-line ellipsis, full title, check counts and clipping tolerances unchanged. Generic LtrValue and other screens retain their own font contracts.

### 2026-10-28 — D7 intermediate tile width and genuine chart pairing

Keep the approved six-column KPI row from 1000 px and two-column phone layout. Use three columns at 760–999 px so raw English/Persian captions keep complete words within two text lines. Scope purchase-card stretching to the existing actual two-column grid (1101 px and wider); stacked charts retain natural height. Browser proofs qualify the genuine grid through its exact children and actual non-overlapping same-row boxes, with negative controls for copied classes, unrelated cards and changed geometry. The old More operations disclosure is replaced by the approved visible This week card and genuine destination links.

### 2026-10-28 — Retained C5 proofs follow approved R2f compositions

The approved phone Returns PNG deliberately places Count and Columns at opposite ends of one row, and rich cards place the genuine record chevron beside Next action. Qualify those exact real source compositions with canonical record provenance, authorized financial declarations and unchanged edge/centre budgets; retain adjacency for every other toolbar and reject copied classes. Lookup's actual source rows use 44 px controls, while closed native details must be audited only after the actual disclosure opens. This changes proof recognition, without changing application behavior or relaxing shared limits.

The final intrinsic Returns name retains its full canonical tooltip while showing a bounded visible prefix. Qualify that source composition alongside the exact separate quantity/+N. Measure the approved approximately 4 px glyph space, actual adjacent element edges and inline baselines; a truncated prefix may leave its next character's fitting remainder. Native Range font ascent/descent can exceed a CSS line box, so vertical containment uses real line boxes while horizontal containment uses actual glyphs. Existing 1/1.5/2 px budgets remain, and X/Y quantity corruption is rejected.

### 2026-10-28 — Allow the expanded browser suite to complete

CI204's clean second browser shard passed all 399 cases in 28.3 minutes of test execution, leaving almost no room for setup within the old 30-minute job cap. Allow 40 minutes for each existing browser job so the full suite can finish and report failures. Keep four shards, two workers, all tests, the combined gate, individual test timeouts, retries, skips and assertion limits unchanged. The separate invoice clipping and font-oracle failures still require their own fixes; a larger outer job cap does not turn failed assertions into success.

## 2026-10-28 — Measure the visible receiving-name prefix

The bilingual font-order correction made glyph selection stable, but the 1280px receiving cell still had less than one pixel of spare space for a full ordinary name. CSS ellipsis hid the visible overflow while the complete live text range could leave the cell on a different browser renderer. CI204 exposed that remaining failure after integration.

Reuse bounded FitText in the receiving name's actual flex box. Preserve the existing English-value/bundled-Persian font contract, full native title and a complete accessible disclosure name including its check count. The fitted prefix updates on actual font readiness and ResizeObserver changes. Keep every table width, numeric gap and clipping tolerance unchanged. C5/C8 additionally require the full title, matching visible prefix and complete accessible disclosure; missing-title-only negative probes remain failures.

## 2026-10-28 — Separate the retained original filename from page count

The actual two-page imported/posted fixture exposed an original-viewer subtitle whose CSS ellipsis hid the page count with the long filename. Its live count glyphs also left the subtitle box and could approach the header actions.

Give the title the remaining header space and fit only the filename, retaining its exact native title and complete screen-reader text. Keep the separator/count as nonshrinking groups on the same line. Reuse the caption in the fullscreen description so it still conveys the full filename and count. Preserve existing32px header actions,44px toolbar and all OriginalInvoice source/page/download logic.

### 2026-10-28 — Retain only Lookup input through a protected remount

An accepted location refresh can briefly remove the protected workspace while fresh authority/data is read. Keep only its typed search in an in-memory draft scoped to genuine company/person/session/role/authority version and exact route. Drop it on Lookup exit or authority change; a temporary observer handles exits while the widget is absent, retains at most one input and unsubscribes after discard. Do not cache selected packages, product/branch projections or money. The fresh protected queries remain authoritative. This preserves user input while withholding old location facts and introduces no business write or broader retained application subtree.

## R3: live reading through Ali's local reader kit, same importer as JSON

Ali's R3 request selects the existing local kit and its documented health/reading endpoints for the October 30 demo. Send only invoice images, save exact originals before the request, and use the current AI-mode importer to fill only the verified Processing draft. Preserve its identity/handling origin and exclude only that target from duplicate matching. Keep JSON settings import protected and unchanged. The request limit is four minutes; recovery is explicit, with no automatic retries, simulation or posting. Only Owner/Manager receives live duration/USD/model provenance. A verified live-original draft may enter manual fallback under its existing handler authority without granting New manual invoice access. Schema v3 waits until after the demo. No new provider code, credentials, paid resource or production deployment is introduced.

## 2026-10-29 — Measure R2g receiving density by its approved parts

The previous 25-line/2700 px test was calibrated to 3 px cell padding. R2g explicitly requires 12 px padding, 4 px gaps, full names, inline charges and grouped totals; the padding difference alone adds 450 px across 25 lines. Its reference screenshot has six rows. Keep the newer approved composition and replace the obsolete aggregate-only assumption with exact row/typography/content checks and tight per-card density limits, deriving the page bound from those parts. Negative controls must reject extra padding, metadata wrapping and empty fixed sections. Keep Category/check count together; retain source SKU/printed pack in the expanded line. No canonical data, money, permissions or 2 px interaction budget changes.

## 2026-10-29 — Release completed approval-board space

The retained board height and restored scroll correctly stabilize partial decisions, but keep a finished board scrolled below its empty message. Genuine posted-invoice reproductions confirm both an offscreen empty message and a completed bottom group leaving older requests entirely outside the usable viewport. After departures finish, release obsolete space when the board is authoritatively empty or no real surviving card is visible, then expose the empty state or nearest remaining card. Keep the protected retained-read and strict 2 px behavior when a real surviving card is already visible. A separate page-content error boundary catches actual render failures without removing navigation or remounting healthy pages to reset it.

## 2026-10-30 — Trust actual repeat-delivery facts, preserve unknowns

Compare an identified same-supplier item with its authorized effective posted purchase, rather than borrowing a current catalog cost or an unposted draft. Keep automatic evidence distinct from human check receipts and invalidate it after edits. Treat a known identity's changed pack/code/cost as precise field questions instead of repeating an uncertain Product question, while retaining genuine paper, quantity and date conflicts. Project only authorized facts, never internal evidence IDs or fingerprints. A fully ready import opens its true tab explicitly so the new automatic state remains reachable.

## 2026-10-30 — Complete CI for each separately pushed item

Ali requested an individually verified push for every R3c item. Include the commit SHA in the CI concurrency group so a later item does not cancel an earlier item's full run; duplicate runs of the same commit still share a group. CI213's 485-case browser shard advanced without a failed assertion until the 40-minute job cap canceled it. Allow 50 minutes for these expanded jobs, preserving all cases, individual test timeouts, worker/retry settings, conditional skips and numerical assertions. Continue local verification before each push and inspect complete full-CI results as the independently running jobs finish.

## 2026-10-30 — Learn supplier print without overwriting curated names

Checked answers and later human name edits are authoritative product-name proposals, while the original AI description is separate matching evidence. Carry both by original source index in preview and import; never reconstruct a missing raw key from a checked-only extra row. Learn normalized keys only at genuine scoped posting and require their actual readable posted source before using them. Keep individual size in the name/unit size and carton count in pack data. Preserve optional extra description through existing Product fields without granting receiving users direct catalog-edit authority. Treat matching-key/source-ID audit data as private evidence, including flattened patch paths, while keeping canonical History reversal data intact.

## 2026-10-30 — R3c K6 — missing-paper payment default

**R3c K6 — configured defaults with source precedence:** use the receiving configuration for missing-paper terms instead of guessing from a supplier's earlier invoices. Seed Monthly; keep it configurable and preserve an explicit disabled value. Share preview/import resolution so the visible count agrees with the imported draft. Preserve printed/checked source precedence, genuine due-date questions, ordinary manual creation, existing records and source bytes. A default is provenance, not a human check.

## 2026-10-30 — R3c F4 — retained Discard, Cancelled and Undo

**R3c F4 — retained cancellation:** Discard is an audited lifecycle change, not deletion. Retain the original and history, offer a counted read-only Cancelled stage and use the existing conflict/authority-checked Undo. Record an explicit reason for entered content while making genuinely empty-draft disposal immediate. Bind reversal to the exact retained target rather than the global workspace slot; retire old attempts on both transitions and preserve genuine manual recovery. Never reverse posted purchases or create compensating financial/stock facts for a draft discard.

## 2026-10-30 — R3c F7 — truthful reading header

**R3c F7 — activity must be real:** render a concise New invoice header while the reading has not established invoice identity. Derive active/recovery copy from actual request ownership and retained phase, suppress missing-value fragments and hide the processing Post control. Keep cancellation/failure/interruption distinct, original retention visible and normal review/post behavior unchanged.

## 2026-10-30 — R3c F3 — native picker before draft creation

Photo/PDF source selection now precedes draft creation. The native picker is opened synchronously by the actual source-tile gesture; no asynchronous business command comes before that gesture. A shared intake function validates the selection, checks the initiating actor/location/navigation witness again inside the initial protected creation transaction, then retains and attaches originals through existing private target-bound upload handles. A separate root navigation witness guards the final route change without mistaking the intake's own child remount for user navigation. This prevents empty drafts on cancellation and prevents stale asynchronous validation from creating or reopening an invoice after the person has moved elsewhere. Existing upload-draft recovery remains available when storage fails.

## 2026-10-30 — R3c K3 — configured .49 to .99 and Use Lower

Apply a configurable final Decimal ending adjustment only to new calculations. Resolve absent legacy configuration read-only so the requested default does not rewrite approved prices or silently discard explicit custom/disabled rules. Keep TypeScript and both Python references aligned through shared cases.

Use the real receiving proposal/approval pipeline for Use Lower. Separate stable calculation evidence from mandatory fresh action evidence; immutable price Activity prevents Set → Reset ABA while exact Undo can retain a still-valid proposal and its actual editor. Preserve source/paper/stock/ledger evidence and current approved/Sale charges.

## 2026-10-30 — R3c K4 — editable receiving selling price

Use the existing protected receiving/approval pipeline for arbitrary typed prices, like K3's Use Lower. Retain exact entered weight amount/unit separately from canonical per-lb cents. Preserve the original receiving editor through a later poster/approver and keep actual approved charges untouched pending approval.

Submit every keystroke through the existing serialized business queue, chain only the field's own successful action tokens and wait for canonical confirmation before closing an edited field. Roll back rejected tentative state to the actual committed value; require fresh current-value review before retry. Preserve stale/ABA/Discard/source guards and private numeric margin/minimum permissions. Show unit-aware approved and proposed prices so configured kg display does not imply a canonical per-lb amount is per kg.
