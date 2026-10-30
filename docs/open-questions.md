# Open questions (build with the default; make each one configurable)

## After the prototype demo

- **R3c supplier PDF order reading:** upload an order confirmation or pre-invoice PDF in Orders, read an expected order with prices, compare the delivery, then create the invoice with Use the order's reading. Record only; design and implementation wait until after the demo.
- **R3c branch-request additions:** allow the sender to add also-sending items that the receiver sees as expected in the delivery. This is additional to the Loaded ticks and Mark all as being sent below; record only.
- **R3c offers:** edit terms, dates and joining/leaving a mix-and-match pool in place, instead of stopping and recreating an offer. Record only.
- **R3c schema v3:** add AI brand/name suggestions for a person to confirm. The current clean-name and printed-key fixes use the existing reading schema and do not introduce v3.
- **R2g branch-request picking (Ali, October 28):** retain a per-item Loaded checkbox per request and person, including who/when, across leaving and returning. Add Mark all as being sent, with individual items subsequently changeable to Short. Record only; do not build before the demo.
- **R2g remaining post-demo polish:** A6 table/checkbox/row actions, A8 all-screen alignment expansion, C2 explicit audited Manager repair review for earlier bad posted weight costs, C4 invoice-approval checkbox alignment, remaining C5 Labels alignment, C6 notebook role/section presentation, C7 selected-only audited name-cleaning review with old-name aliases, and C8 branch-request detail composition. Shared A5 may resolve C3's empty password band and C6's scrollbar without implementing their other deferred work. Never silently repair posted money.
- **R2g Tier 2, deferred by R3c:** B5/B6 Offers, B8 New order, B9 phone Timesheets, A1 universal fields, A3 remaining filter bars and A4/B7 shared phone lists remain outside the active work. Ali stopped R2g for R3c and explicitly lifted its earlier freeze; this does not resume Tier 2.
- Reading schema v3: separate item name from pack text; add supplier phone/email/representative fields, sold-by-weight mathematics and an AI pricing-category suggestion that a person confirms. These are deferred and are not part of R3.
- Questions 15 and 29 are resolved for this prototype: R3 uses Ali's existing local kit. Provider selection, credentials, account spending controls and any CORS configuration stay in that external kit; this app adds no provider integration or key field. Broader production AI/server architecture remains a later phase.

## R2d timesheet defaults recorded (2026-10-26)

These are the requested build defaults, with no new blocking question:

- Staff are a branch staff list with an optional app-login link. A staff member need not sign in; linking does not grant access.
- Owner, Manager, Branch Supervisor and Cashier may edit past days within current permitted branches; every meaningful change is retained in History. Floor Worker has no timesheet read/edit/export/audit access.
- Weekly Monday–Sunday view and payroll CSV are included. CSV decimal hours have four places. Wages, deductions and payment execution are outside this work.
- On shift now follows the literal In-without-Out rule, including unclosed prior days and excluding future clock-ins. Prior missing Out remains amber; do not invent a clock-out or choose a first branch for aggregate selection.
- Equal In/Out means zero, earlier Out means the next day, and a shift over 16 hours is an amber check. These rules use local wall-clock endpoints rather than payroll/DST elapsed-time adjustments.
- Existing stores gain empty timesheet arrays after exact verified backup. Fresh/Reset alone loads fictional practice sheets; Empty store stays empty after reload. Departments and the module switch are configurable, preserving explicit Off/custom settings.
- CSV and browser print are real local outputs. Physical A4/Letter printing, cross-device synchronization, a deployed server and payroll-provider integration remain outside the executed prototype proof.

When Ali answers one, update the requirement it affects, record the date here, and remove the question.

| #   | Question                                                                               | Default to build with                                                                                           |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Rice with an exact whole-dollar raw price (e.g., 4.00): go up to 4.99 or down to 3.99? | Up: 4.99 ("always round upward")                                                                                |
| 2   | While a new price is pending, what does the cashier charge?                            | Last approved price; new products show the proposed price tagged Pending                                        |
| 3   | Minimum margin per category (for the "below minimum margin" approval)                  | `0.25` placeholder; rule inactive if empty                                                                      |
| 4   | Tax: rate, jurisdiction, currency, timezone                                            | Placeholders in config; rate is a company setting; prices displayed before tax                                  |
| 5   | Is tax on a short deduction included in the deduction?                                 | Yes, proportional tax is deducted with the line                                                                 |
| 6   | Price → offer mapping                                                                  | 1.99 → 3 for $5; 2.99 → 2 for $5; 3.99 → 2 for $7 (editable)                                                    |
| 8   | Persian digits or Western digits in the Persian UI                                     | Western digits for prices, codes, dates; translations for text                                                  |
| 9   | Can cashiers add notes?                                                                | Not to built-in notebooks; yes to a custom notebook if the Owner/Manager allows it                              |
| 10  | Do Floor Workers see unit cost and margin?                                             | Cost on invoices they handle only; margins hidden                                                               |
| 11  | Units per case: who enters it for a new supplier product?                              | AI proposes from the invoice; worker confirms on first receipt; remembered afterwards                           |
| 12  | Expiring-soon entries with no sales data                                               | Manual **Remove** with reason and Undo; removed history retained                                                |
| 13  | Raw price below $0.23 (no "previous .99" exists)                                       | Result 0.49                                                                                                     |
| 16  | When exactly is an offer suggestion created?                                           | When the price becomes effective at 1.99/2.99/3.99 with no offer                                                |
| 17  | Automatic supplier invoice number scheme                                               | Sequential per supplier, flagged system-assigned                                                                |
| 18  | Idle-lock time and password re-prompt window                                           | 5 minutes and 15 minutes (settings)                                                                             |
| 19  | Product code start                                                                     | `0001`, zero-padded, five digits after 9999                                                                     |
| 20  | Persian terminology for the English terms list                                         | AI drafts; Ali reviews before go-live                                                                           |
| 21  | Official logo files and brand colors                                                   | Use the supplied PNG and sampled colors; replace when received                                                  |
| 22  | Username format                                                                        | First name + last initial (e.g., `sara.k`), editable by the Owner/Manager                                       |
| 23  | Real Google sign-in and real second-step verification                                  | Google remains later; E1 privileged passkey/authenticator flow is simulated; real verification needs the server |
| 24  | Lockout settings                                                                       | 5 attempts, 15 minutes (settings)                                                                               |
| 25  | Label waitlist auto-add on price approval                                              | Off by default (setting)                                                                                        |
| 26  | "Price changed recently" window for labels                                             | 3 days (setting)                                                                                                |
| 28  | Persian wording for offers ("2 for $5")                                                | "۲ عدد $5" style; Ali reviews                                                                                   |

## Resolved by the A2 request (2026-10-07)

- **27 — Undo window (historical):** A2/B used 5 seconds, bottom-left EN/bottom-right FA. C3 supersedes it: **10 seconds**, bottom-right EN/bottom-left FA, above all layers, independent hover/focus-paused timers/newest-first stacking, at most 3 plus +N more. See requirements §23 and Decision 017; do not rebuild the historical default.

## Resolved / scope changed by C (2026-10-09)

- **7 — Location names/types:** owner specified North York, Richmond Hill, Newmarket and Warehouse; Warehouse has no Cashiers. Stable original store IDs remain, EN/FA display names are configuration and saved custom renames persist. Settings → Branches changes name/type.
- **14 — Stock counts:** removed from Phase 1 scope together with stock estimates/opening counts. Inventory depends on register sales and is a separate paid later phase; preserve physical events without enabling projection/count transactions.
- **Labels:** owner reversed no-default-template: Regular and Promo are built in. Technical exact geometry recorded in requirements/design/data-model: Regular 60 × 40 mm/margins 10/gaps 4; Promo 210 × 148.5 mm/zero margin-gap/two per A4, safe content/border inset 5 mm. Geometry editable; physical printer alignment cannot be promised without its actual printer.
- **Invoice location corrections:** current outstanding liability moves via paired adjustments, preserving original invoice/payment/credit/allocation evidence and company total; use existing Decision 005 impact preview and append-only corrections.

## C2 implementation defaults confirmed before code (2026-10-09)

- **Order access:** `orders.allow_floor_worker` defaults false. Explicit opt-in allows order cost snapshots/expected amounts inside Orders only; no Supplier cost-history/catalog privilege or Cashier access.
- **Unbought supplier items:** bought cost/date/invoice stay blank. Use actual supplier purchase cost, separately attributed Owner/Manager quote, or required explicit **Expected unit cost** before placement. Never infer a supplier purchase or hide a fallback to catalog cost.
- **To order notes:** free-text reminders require explicit supplier-item selection and every selected reminder needs an explicit Cases quantity before placement; no inferred product, pack or quantity. Draft saving retains the open note; placing marks only linked selected notes ordered.
- **Free-text request Cases:** without a pack, require positive whole Cases and keep normalized units blank; a fractional Case requires an explicit retained integer pack and exact positive whole converted units. Never invent a case conversion.
- **Quantity precision:** Units are positive whole units; fractional Cases require a retained positive integer pack and exact Decimal conversion to positive whole units (0.5 cases × 12 = 6). Reject fractional converted units, never round using float math.
- **Partial billed order:** order 4 cases versus invoice 3 cases leaves 1 case for Short/Back-ordered/Cancelled; the unbilled remainder creates no invoice deduction. Preserve comparison snapshots.
- **Request cancellation:** Draft/Requested can cancel with reason/evidence. Once Sent/Received, record actual receiving/missing and close; never erase physical transfer events. Copy residual quantities starts a new draft, not a replay of the old send.

## C3/C4 recorded defaults and owner resolutions (2026-10-09)

| Topic                                       | Build default / decision                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selling locations                           | Store: Sells to customers On; Warehouse: Off. Owner/Manager can configure it. Non-selling locations absent from price/offer/approval effects; warehouse receiving may still trigger a company proposal for selling stores, but warehouse-only selling target is unavailable. Preserve hidden historical warehouse overrides until explicit selling opt-in, never clear them as a side effect.   |
| Table columns                               | Defaults form compact useful tables (Suppliers nine practical columns); optional extra columns use desktop wrapping/grouped detail within available width, never hidden overflow. Preferences per company/user/table; name/reference mandatory, unauthorized money fields excluded; Reset columns restores defaults.                                                                            |
| Undo                                        | Owner 10-second/right-EN/left-FA rule; scoped conflict-aware inverses, not whole-store replacement. Place order/mark source notes ordered may Undo only before receipts or later edits; keep reference/history. Request Undo retains original transfers and appends transfer_correction evidence, never claims the goods moved back.                                                            |
| Product date preference                     | Saved Yes initializes invoice choice to Yes; otherwise default No. Yes needs an actual date; short-dated expiry remains mandatory. Manual dates allow optional quantity/lot/note, no stock inference. Stop tracking is Owner/Manager catalog edit, scoped date addition/removal follows existing operational permissions.                                                                       |
| Weighed display                             | Canonical approved price per lb; main display lb by default (kg allowed), secondary unit On, rounding bands On; factor 2.20462, converted cost half-up to 4 decimals, secondary selling display half-up cents. Bands Off bypasses band/special corrections for bands categories, not Rice's separate upward-ending rule or Each pricing.                                                        |
| New item estimate                           | Temporary typed line accepts optional pack/cost without fabricating purchased history. An incomplete expected-cost estimate remains identified as incomplete; explicit quantity and invoice-line/product matching required. Only posted association creates supplier item purchase evidence.                                                                                                    |
| Expected return credit                      | Deduct expected credit at pickup On; provisional Owner/Manager-only balance projection distinct from confirmed credit ledger. Waiting-for-credit alert defaults14 days. Actual credit note/evidence requires Owner/Manager posting and replaces expectation once.                                                                                                                               |
| Replacement pending credit (owner answered) | **Return to $600**: replacing the $30 claim releases its provisional expected credit, restores projected owed from570 to600, and creates no new purchase invoice or financial credit. Preserve actual replacement/return evidence. This owner answer resolves the apparent conflict between pickup deduction and “no money changes” for replacement: no new settlement/purchase ledger posting. |
| Notebook language                           | English name required; Persian optional; display English when Persian missing.                                                                                                                                                                                                                                                                                                                  |

The above are documented company defaults or explicit owner decisions, not new paid resources, production integration or inventory authorization. C3/C4 file scope permits prototype/, docs/ and seed/ demo/config/pricing cases, superseding C1/C2's seed-only-location restriction.

## Historical C5 interaction defaults (superseded by C6 for Lookup, tracking-off and Undo) (2026-10-10)

- Quick-add retains chosen date and concrete location between shelf entries; clears product and optional quantity/lot/note and refocuses product. Expiry is the default type; More exposes Best before and optional evidence. These interaction defaults do not invent stock/financial evidence.
- The owner explicitly allows Owner/Manager and Floor Worker Lookup On/Off. Off preserves open dates, matching the existing keep-dates default; Owner/Manager Stop tracking retains its explicit remove-existing choice. Worker switch audits the concrete assigned location. All branches Lookup uses the existing permitted concrete price-preview location and labels it; no entry/audit uses `all` as a physical location.
- Adding while Off/unset enables the existing company catalog preference together with the new scoped date; one Add date Undo restores both prior preference and entry evidence, with conflict checks. Other catalog fields remain Owner/Manager-only.
- One Current row means one product row; permitted distinct default/branch offer scopes are grouped, not erased. An identical active/scheduled submission in its scope reuses the existing record; changed terms create/stop audited versions. Past sorts retained stop/end/creation evidence newest first, falling back to original retained order for legacy records without timestamps.
- C5 supersedes the full-card Sign in button with the universal intrinsic-width text-action rule. Sorting headers, calendar choices, menus, navigation and clickable result/KPI surfaces remain semantic widgets and are listed separately in the audit; ordinary action buttons are never exempted by relabeling them.

## C6/C7 owner questions resolved by C8 (2026-10-12)

Correct pickup: Owner/Manager only; Owner/Manager proxy until E1. Dark filled Primary/KPI: #2B59C3 white; #7397F0 only dark links/icons/selected tabs/focus. The detailed answer and later options are in the C8 section below.

## C6 implementation contracts recorded before code

- Per-product reminder days defaults existing configured expiry window30, no second global default. Reminders one per date; stopped products absent from active lists/reminders whether dates kept or cleared. Keep leaves Lookup read-only dates, Clear keeps removed History. Products preference remains Owner/Manager-only; workers keep authorized quick entry/removal.
- Receiving may show only same-company/product/supplier dates entered within7days at another location, with location/type/date/optional lot; no other-location costs/quantities/invoice or general read access. This narrow sharing exception is explicit.
- Lot identity company/product/supplier/location/expiry, one catalog barcode/product, immutable source receipts/costs; optional clearance location/lot-specific, separate from ordinary offers. No on-hand or inferred depletion.
- Keep for next pickup permits a **new** signed immutable pickup event. Multiple distinct partial credit notes may cover disjoint remaining actual picked-up item quantities, retaining one linked invoice and financial authorization. Existing whole-return one-credit limit is superseded only for these verified non-overlapping item settlements; no duplicate documents or double deduction.
- Supplier memo/order each en(default)/bilingual setting; internal picking remains bilingual. Local timestamps use config IANA zone, persisted UTC. Final total auto until explicit edit; mismatch warning; term dates editable.
- IndexedDB company/hash file refs replace inline bytes only after durable read-back/hash verification and backup. Exact invoice originals retained; photos ≤2000 px longest side. Migration failure leaves source evidence recoverable. Twenty3MBphotos is required proof, not production unlimited-storage guarantee.
- C6 replaces stacked10second Undo with one about 8-second message, ×/replacement/reserved action-bar space, no field edits/autosave. C7 styles all existing screens using the already-replaced Klead source.

**C6 new-write guard:** New resolutions, credits and replacements require actual retained signed pickup evidence and remaining actual picked-up quantity coverage. Legacy imported settlements stay readable and unchanged; they do not authorize a new no-pickup settlement.

## C8/E: owner answers and later options (2026-10-12)

The two C7 questions are resolved. Correct pickup is Owner/Manager only, with today's Owner/Manager representing them until E1. Dark filled Primary/KPI uses #2B59C3 with white; #7397F0 is reserved for dark links/icons/selected tabs/focus. Keep immutable correction and actual contrast guards.

Transparent implementation contracts: Add product retains initial pricing; existing Edit uses Change price. Open date is active/unremoved, even if past, anywhere in the company. Weighed sale retains entered main-unit cents; normalize comparisons without changing that price. Reviewed retail targets and each store's regular/cost/margin matter. Revert checks versions/current clock, never revives elapsed prices. Queue metadata actually selects Regular/Promo and separates future regular intent from active Promo. These contracts implement the authorized flows; they are not invented monetary exceptions.

| Later option                           | Boundary/default now                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Several products on sale together      | Later option; C8 handles one product per dialog.                                                                             |
| Until sold out                         | Phase 2, after stock counts/register integration; never infer depletion.                                                     |
| Different roles at different locations | Later option; E1 one role/person and assigned locations.                                                                     |
| Real phone push/email                  | Planned real server/HTTPS-installed app; E2 in-browser notifications only.                                                   |
| Google sign-in                         | Existing later option; E1 authorizes simulated passkey/authenticator for privileged roles, not real external authentication. |

No blocking new business question is assumed. Record or ask about a genuinely missing rule rather than silently changing permissions, quantities or money. E1/E2/E3 are authorized plans, not C8 completion claims.

## E1 source choices recorded before implementation (2026-10-12)

- Five configured roles replace the old three-role authority model. Owner and Manager share company/current/future-location access; non-company roles have explicit nonempty assignments; Cashier never Warehouse. Different roles at different locations remains a later option.
- Branch Supervisor purchase costs on own invoices/Supplier items/Orders are separate from catalog costs, margins/minimum margins, supplier balances, Payables and approval decisions. Their return grant explicitly stops at recording signed pickup; no Floor Worker replacement hierarchy. Ordinary multi-buy management is not a newly granted Branch Supervisor operation. Labels includes the existing narrow template creation/duplication/edit/archive/restore/calibration operations and does not grant Company Settings. General catalog tracking-preference edits remain managerial; operational quick-add's existing atomic enable exception stays.
- People is Owner/Manager-only; new person requires phone or email; setup code shown once; password and required simulated second step precede business access. Real invitation delivery/authentication/push/email/remote collaboration remains future server work. Six fixtures may start with completed simulated setup so Demo switching works; invited/custom people cannot use that shortcut.
- Resolve current actors/epochs at each protected command/query; usable Active Owner safety and session revocation are one IndexedDB transaction. Count only Active Owners with complete password and required second-step setup; promoted Floor Worker stays Invited until required setup finishes. Latest persisted business and authority share the lock and commit before React. Protected authorityHistory returns committed safe audit summaries only, with no generic directory/epoch Undo. Device defaults grant no assignment; rh-supervisor on North York starts at All my locations for Richmond Hill/Newmarket, never a silent first store. Retain existing guarded inactive-origin corrections/settlement and active move destinations.
- Preserve legacy users/passwords/forced newemployee setup/preferences and original business/file/History evidence during verified normal migration. Old supervisor aliases the same Manager; unknown historical names are not active accounts. Explicit Reset alone restores six demo people and revokes replaced sessions. Separate phones/browser stores remain independent.
- Registered computers were previously represented by demo recent-user configuration and a People placeholder. E1 specifies actual local device/location entries and a seed-backed fictional North York computer for fresh/reset. Preserve valid migrated registration/current-device mapping. Only Owner/Manager manages these entries; device defaults never broaden person access and cannot select North York for rh-supervisor. This is local browser registration, not discovered real hardware.

These are source contracts and documented implementation boundaries, not test counts or completion claims. All new E1 evidence remains Planned until verified. E2 tasks/notification routing and E3 installation/private-hosting instructions remain Planned separate stages; no further owner approval is required between the already-authorised stacked builds.

## E2 implementation defaults recorded before code

No new monetary or authority rule is invented. Price updates describe outstanding physical register/label work after an actual approved public selling transition. Requirements §36 records source comparison, commercial-offer terms, current-target confirmations, last-day Sale preparation, no initial backlog, verified additive migration and all role grants.

- Branch Supervisor owns their Store tasks; Owner/Manager can perform all task work. Floor Worker may acknowledge labels; completion defaults Off, and optional On never grants register acknowledgement. A label waiver needs a reason and is recorded by Owner/Manager/assigned Branch Supervisor; Floor Worker may consume an already recorded waiver when optional completion is enabled, without creating a waiver or register confirmation.
- Effective terms include public ordinary-offer/Sale changes, not private cost-only changes. Coalescing retains real work but confirmations of a replaced target do not certify the new one. Undo cancels only before staff action; actual prints remain immutable evidence.
- Task start/end calendars use configured IANA store time. Reminders default 24/48 elapsed hours, with mandatory actual Branch Supervisor/Owner/Manager recipients and event deduplication. New custom settings are retained on normal upgrade.
- A Sale's last-day task is preparation for tomorrow; it does not end the current app price early. If the future regular target changes, revise that task and require fresh confirmation.
- Real push/email delivery and shared phone data remain later server work. Route settings cannot remove the owner's mandatory minimum task/escalation recipients or the requester's own Sale decision.

Later options remain different roles by location, multi-product Sale editing, until sold out after inventory, and real push/email. There is no new owner-action gate between the authorized E stages. Actual tests/screenshots remain pending until executed proof is recorded.

## E3 recorded boundaries and later work

- Use the seven requested compact phone-row families; keep wider tables/Columns and inherited protected data. Verify EN/FA at 390 and 430 rather than treating desktop width alone as proof.
- Configure PWA name/logo/themes/scope/standalone and a dedicated bilingual No connection page. Use exact generated public asset caching only; no private/offline financial workspace or stale signed-in HTML. Explicit safe updates wait actual commands/files/migration/printing and dirty UI, preserve data and never auto-reload an editor.
- No cloud account/resource is created here, including a free one. Optional Cloudflare Pages/Access instructions are for the owner later. Pages built-in preview protection does not secure its production parent hostname; both must be verified privately before real build upload. Plan/seat limits and dashboard labels can change and must be checked before owner setup.
- Current Scan barcode focuses search; a live camera decoder remains unbuilt. HTTPS permits secure browser features but does not implement a scanner. Existing photo capture depends on the actual device browser.
- Hardware Android/iPhone Home Screen launch, real Safari, physical printing and real private hosting are not presumed tested. Genuine emulator evidence must say emulator. Each phone/origin stores independent demo records; real push/email, remote revocation/sync and authenticated server data remain future work.

These are transparent implementation boundaries, not a new request for owner action during the already authorized build. Existing unresolved defaults continue unchanged.

### R2b 1.1 — Confirm imported delivery-date inference

**Question:** confirm handwriting first, otherwise invoice-date local noon for historical imports? **Build default requested by Ali:** use that order, store UTC in the configured company timezone, and mark Received for review with provenance. Date-only notes use noon, omitted handwritten years use the invoice year, and competing dates, expiry/phone-note dates, ambiguous numeric dates/invalid local times are never guessed. Missing valid source dates remain unresolved. Manual/live readings keep now. Import and posting audit time stays the actual command time; initial stock receipt time follows Received.

### R2b defaults already specified

No additional question blocks the numbered work. Missing currency follows company configuration. Missing compatible totals use the documented arithmetic, including total-only → subtotal equal to total and tax zero; unresolved amounts remain questions. Missing terms use the latest strictly earlier same-supplier recognized invoice, with lexical invoice-number/ID tie-break; no history stays blank and flagged. Monthly means first of the next calendar month. Fractional cases convert only to exact positive whole units; nested/conflicting packs remain unresolved. Contacts use the first unambiguous singular value and preserve curated details. Ordinary optional blanks are quiet; explicitly flagged empties require a genuine acknowledgment. The imported Received policy above remains the one requested default for Ali to confirm.

## R2c 7.3 — Branch Lookup scope (2026-10-26; Ali to confirm)

**Question:** should a concrete branch’s initial Lookup list contain only products delivered, stocked or priced there, adding other permitted branches’ products only after a typed search?

**Default implemented from the R2c prompt:** yes. Show this branch’s own approved effective price. With none, show **Not approved here yet** and other permitted branches’ approved prices. Once this branch approves a price, show only its price. A company default without an accepted branch/all-store decision is not proof of this branch’s approval. All locations continues to list the whole company catalog with explicit public per-location facts (0.13). Existing stock data establishes presence only; no inventory count or depletion estimate is displayed. No new permission grant or other-store cost/invoice/lot disclosure is introduced. Await Ali’s product confirmation; implementation and tests use this stated default.

## R2c 7.1 — Explicit return defaults; no blocking question (2026-10-26)

- Everyone can read/create returns within permitted active locations; Cashier means assigned Stores and read/create only. Existing pickup/cancellation/replacement/financial grants remain independent.
- New creation uses one received product/line per form; existing multi-line return records remain readable. Units are whole; lb permits at most three decimal places, matching the existing pickup/settlement precision. No on-hand cap is inferred because Phase 1 has no on-hand model.
- Damaged/Expired requires a saved photo; Other requires a note. Exact request retry is one return; a separate intentional request may contain the same goods. Cancelling/failed upload can leave unlinked content-addressed files, with no business association or blind deletion of shared evidence.
- Missing/conflicting historical currency, missing cost or ambiguous latest receipts requires manager review. Resolve manual posting currency from retained ledger evidence, never current configuration. No FX or alternate-currency settlement is invented. A changed company currency keeps an existing new return's original denomination and blocks pickup/correction/monetary credit writes until it matches; restoring that currency allows the original snapshot.
- Before actual signed pickup, expected credit is informational and not deducted. Later unrelated receipts cannot replace frozen source cost/currency. These are conservative implementation defaults within the authorized task, not requests for another approval.
- Browser-local authority/file storage remains the prototype boundary. No new HTTP service, cross-device sync, physical-camera/printer proof or real-photo fixture is claimed. Review the fictional [return click guide](PR_R2C_RETURNS.md); broader deployment/device work stays separate.

## R2e A defaults recorded 2026-10-27

- Weight display conversions retain the original kg/lb source arithmetic; displayed invoiced quantity uses three decimals and cost four. Delivered remains explicitly labelled in its retained source unit, avoiding invented precision or rounding a partial physical receipt. Cases show Delivered in cases.
- A paper-line mismatch acknowledgment belongs to one exact paper/calculated pair and a real actor/time; an amount change requires acknowledgment again. A one-cent difference is tolerated; greater differences block both confirmation and posting.

## R2e shared-control defaults (2026-10-27)

These are implementation choices within the requested design fixes, with no new business or permission rule. Shared page filters are 44 px throughout, replacing C9's mixed sizes. Desktop list count/Columns reserves the first row's end; phone layouts may wrap that group. Received's selected Today/This week/This month chip clears that range when chosen again. Modal feedback reserves a 44 px footer track on opening, with the page toast deferred and its remaining eight-second Undo display budget paused until closing; the underlying guarded Undo eligibility is unchanged. Shared Product Code columns reserve 128 px for full sortable captions including comfortable text. Notes/descriptions start at two lines and grow through six; receiving addresses keep their existing four-line reservation.

### R2e C8/C11/C14 — Recorded implementation defaults

- Returns keep existing canonical whole units / lb up to three decimal places. Cases require a retained positive pack or case weight; cases and individual units are whole quantities. kg and weight-case conversions use the configured factor and round canonical lb half-up to the existing three-place pickup precision. The form previews that canonical quantity and History retains the entered quantity/unit. Source cost/currency remain frozen; no inferred stock cap or availability claim is added.
- Lookup Price changed recently uses the existing label-settings recent-price window (default three days), including currently effective noncancelled price tasks and retained actual approved-price change timestamps. Future and cancelled decisions do not count. Arrived today uses the existing authorized last-receipt date. Kept dates on a product with tracking stopped remain read-only; they do not create reminder badges.
- Fresh/reset practice data gives every active fictional product a concrete approved price at every selling location, preserving configured branch differences. The existing pending new-product example remains the sole North York unapproved product. Existing saved records and pending decisions are preserved.

### R2e fixed-size package defaults

Authorized default: packages use their parent's pricing category rounding (including Grocery corrections and Rice's own upward rule), after adding the same configured 0.49 container fee for every size. Container cost defaults to 0.00; restricted-circulation EAN-13 prefix defaults to 20; ounces per pound defaults to 16. Package size accepts positive Decimal values up to six fractional places. Parent Product Code is the stable company-scoped parent identity. Existing records and custom settings are retained; migrations never add fictional packages to saved stores.

Package lifecycle defaults: archive active packages before archiving their parent or changing it to Each; the protected commit rejects orphaning rather than leaving stale chargeable packages. Equivalent active sizes (for example 1000 g and 1 kg) are one size and cannot be duplicated; archived sizes remain as records and may be replaced using a new code. Manufacturer barcode entry supports validated GS1 GTIN-8, UPC-A/GTIN-12, GTIN-13 and GTIN-14, retaining the printed form; zero-padded GTIN identity comparison rejects UPC/EAN aliases within the same company. Generated in-store barcodes remain EAN-13. Active approved parent sales feed the derived package base price, and sale ending restores the regular derived price; packages may retain their own independent ordinary offers.

A package's independent approved sale follows the ordinary C8 conflict workflow when a new derived regular price is lower: retain the sale until Owner/Manager Keeps, Changes or Ends it, with an actual package-linked alert. Matching pending review or an authorized Keep survives startup repair. No parent price block or silent sale ending is introduced. Normal configured offer suggestions are reconciled from derived prices, with stale mappings stopped and fresh suggestions requiring their usual confirmation.

## R2e E defaults recorded — 2026-10-27

- Maker metadata lives in top-level company configuration `branding.maker`, separate from the existing `company.branding` store palette. Default Klead and exact asset paths come from the seed; support is empty/hidden.
- Missing maker configuration on an existing store uses presentation defaults without writing a migration. An explicit null maker, `enabled: false` or blank name hides attribution; company icons are the fallback.
- The app name in About is the configured store name and the version comes from the prototype package. Maker configuration has no new settings editor: changing the configuration controls the identity without application-code edits. Installable manifest/icons are generated from the build's configuration; runtime tab title/favicon follow the current saved company config. Already installed operating-system icon refresh remains browser-controlled.
- Staff print language is unchanged: English-only supplier documents stay English, bilingual internal/timesheet documents retain both languages. Physical printer and native app installation checks remain hardware review.

Maker file ownership is explicit in `maker.asset_identity` (default Klead). Replacing only `maker.name` suppresses inherited logos/icons rather than displaying another maker's lettering; supply replacement files with the matching asset identity, or a complete new maker block.

## R2f D1 display defaults — 2026-10-27

- “So far” is presentation-only elapsed time for the currently selected branch's today, from a valid In no later than its actual clock and no Out. Department/day captions include that elapsed display; stored duration, weekly totals and payroll CSV continue to count only completed shifts. No Out is inferred. Past missing-Out shifts stay amber/zero, and future clock-ins have no elapsed claim. The dashboard's existing prior-unclosed count is unchanged.
- The header on-shift count deduplicates current-day people. The display refreshes at minute boundaries and when a tab becomes visible; it never changes the chosen day, saved records or actor evidence.
- Screenshot-specific masonry cards keep compact baseline headings and independent heights. Narrow day-row menus are28px wide but44px high, as the source; ordinary operational cards retain the shared R0 header contract.

## R2f D2 recorded defaults — 2026-10-28

- New person initially selects the first configured department, as the existing guarded staff editor did; the operator can change it. English name is required; Persian name and app login are optional. The list remains mounted while the inline form is open. After a successful Add, clear search and select Active so the new actual person is visible. Cancel discards only the unsaved form.
- Login display comes from the permitted current branch account query. Loading, unavailable and failed-account-query states are explicit; a missing query result is never shown as No app login when a stored link exists. Name-only edits retain an unchanged unavailable link, while changing/clearing a link still uses normal protected validation.
- Stale staff versions keep the staged form and report that the person changed. Close/reopen loads the current evidence. Archive remains a confirmed soft status change; Restore does not remove historical rows.

## R2f D3 recorded implementation defaults — 2026-10-28

- Existing cost changes use current selected-location cost authority; All locations records one explicit company-wide manual cost decision with per-location receipt fingerprints. A branch with a later genuine accepted receipt uses that receipt again. A manual marker never appears in purchase history.
- An existing unrelated pending invoice-price review blocks a new manual cost edit with an actionable Approvals message. The editor may replace its own earlier manual-cost proposal; it never silently supersedes invoice evidence.
- Explicit Owner/Manager Change price in the draft is the actual authorized price decision and preserves normal reasons, margin acknowledgments and Sale conflict choices. A cost-only edit uses normal pending approval.
- New package date tracking defaults Off because inheritance covers category/tax/supplier, not dates. Existing parent date requirements and ordinary package date actions remain.
- Pending archives remain visible as struck-through rows with Undo until outer Save, keeping the acted-on area stable. New rows say Assigned on save until the actual protected allocation.

A location without accepted local regular receipt/manual evidence retains the existing company-level latest-known-cost fallback. A local manual edit updates that fallback as existing regular receipt posting does; actual evidence at another location wins. Manual-cost proposal replacement is restricted to overlapping location scope; a concrete branch cannot partially replace an All locations review.

## R2f D7 — Implemented defaults

No new product decision is required. Approved screenshots win the phone This week order. Reminder window is a truthful configurable-horizon caption; no seven-day predicate is invented. Prior activity dates use English month/day value captions in both languages, with the complete company-local timestamp available. One actual multi-line received transaction counts once; later short/replacement receipts count separately. See [review guide](PR_R2F_DASHBOARD.md).

D7 replacement delivery counting uses each actual replacement stock-movement identity. The existing canonical workflow emits one movement per replacement event, so distinct receipts for one return on the same day remain distinct even when the Received projection has no timestamp. It never groups those events by return/date. Invoice multi-product lines still share their actual source/timestamp group.

### R2f D3 — Manual-cost and package-menu defaults

Manual weight-cost decisions are not receipts. Existing Sale-cost alerts remain actual-receipt-bound; do not invent invoice evidence for them. Preserve the Sale and ordinary pending regular-price review, while explicit staged price changes retain normal Sale/margin validation. Standalone package row menus follow the approved 36px footprint; their New size peer controls remain 44px.

An All locations manual weight-cost decision retains one all-scope cost marker and separate ordinary pending reviews per fresh permitted selling branch. Each review retains its own approved/manual price and actual prior cost (null if unknown). Exclude Warehouse/inactive/non-selling targets. Only explicitly staged regular-price-covered branches skip pending review. A retained overlapping all-scope review remains blocking if a partial replacement would lose another branch's work. Bind the genuine session/location to editor snapshots so a later location switch cannot expand an old draft's scope.
