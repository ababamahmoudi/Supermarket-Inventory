# Open questions (build with the default; make each one configurable)

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
| 9   | Can cashiers add notes?                                                                | Not to built-in notebooks; yes to a custom notebook if the Supervisor allows it                                 |
| 10  | Do Floor Workers see unit cost and margin?                                             | Cost on invoices they handle only; margins hidden                                                               |
| 11  | Units per case: who enters it for a new supplier product?                              | AI proposes from the invoice; worker confirms on first receipt; remembered afterwards                           |
| 12  | Expiring-soon entries with no sales data                                               | Manual **Remove** with reason and Undo; removed history retained                                                |
| 13  | Raw price below $0.23 (no "previous .99" exists)                                       | Result 0.49                                                                                                     |
| 15  | Which AI provider reads invoices?                                                      | Decide at Phase 5 with cost per invoice; provider-agnostic interface                                            |
| 16  | When exactly is an offer suggestion created?                                           | When the price becomes effective at 1.99/2.99/3.99 with no offer                                                |
| 17  | Automatic supplier invoice number scheme                                               | Sequential per supplier, flagged system-assigned                                                                |
| 18  | Idle-lock time and password re-prompt window                                           | 5 minutes and 15 minutes (settings)                                                                             |
| 19  | Product code start                                                                     | `0001`, zero-padded, five digits after 9999                                                                     |
| 20  | Persian terminology for the English terms list                                         | AI drafts; Ali reviews before go-live                                                                           |
| 21  | Official logo files and brand colors                                                   | Use the supplied PNG and sampled colors; replace when received                                                  |
| 22  | Username format                                                                        | First name + last initial (e.g., `sara.k`), editable by the Supervisor                                          |
| 23  | Real Google sign-in and real second-step verification                                  | Google remains later; E1 privileged passkey/authenticator flow is simulated; real verification needs the server |
| 24  | Lockout settings                                                                       | 5 attempts, 15 minutes (settings)                                                                               |
| 25  | Label waitlist auto-add on price approval                                              | Off by default (setting)                                                                                        |
| 26  | "Price changed recently" window for labels                                             | 3 days (setting)                                                                                                |
| 28  | Persian wording for offers ("2 for $5")                                                | "۲ عدد $5" style; Ali reviews                                                                                   |
| 29  | AI provider for real invoice reading                                                   | Decide at step 0.3 with cost per invoice                                                                        |

## Resolved by the A2 request (2026-10-07)

- **27 — Undo window (historical):** A2/B used 5 seconds, bottom-left EN/bottom-right FA. C3 supersedes it: **10 seconds**, bottom-right EN/bottom-left FA, above all layers, independent hover/focus-paused timers/newest-first stacking, at most 3 plus +N more. See requirements §23 and Decision 017; do not rebuild the historical default.

## Resolved / scope changed by C (2026-10-09)

- **7 — Location names/types:** owner specified North York, Richmond Hill, Newmarket and Warehouse; Warehouse has no Cashiers. Stable original store IDs remain, EN/FA display names are configuration and saved custom renames persist. Settings → Branches changes name/type.
- **14 — Stock counts:** removed from Phase 1 scope together with stock estimates/opening counts. Inventory depends on register sales and is a separate paid later phase; preserve physical events without enabling projection/count transactions.
- **Labels:** owner reversed no-default-template: Regular and Promo are built in. Technical exact geometry recorded in requirements/design/data-model: Regular 60 × 40 mm/margins 10/gaps 4; Promo 210 × 148.5 mm/zero margin-gap/two per A4, safe content/border inset 5 mm. Geometry editable; physical printer alignment cannot be promised without its actual printer.
- **Invoice location corrections:** current outstanding liability moves via paired adjustments, preserving original invoice/payment/credit/allocation evidence and company total; use existing Decision 005 impact preview and append-only corrections.

## C2 implementation defaults confirmed before code (2026-10-09)

- **Order access:** `orders.allow_floor_worker` defaults false. Explicit opt-in allows order cost snapshots/expected amounts inside Orders only; no Supplier cost-history/catalog privilege or Cashier access.
- **Unbought supplier items:** bought cost/date/invoice stay blank. Use actual supplier purchase cost, separately attributed Supervisor quote, or required explicit **Expected unit cost** before placement. Never infer a supplier purchase or hide a fallback to catalog cost.
- **To order notes:** free-text reminders require explicit supplier-item selection and every selected reminder needs an explicit Cases quantity before placement; no inferred product, pack or quantity. Draft saving retains the open note; placing marks only linked selected notes ordered.
- **Free-text request Cases:** without a pack, require positive whole Cases and keep normalized units blank; a fractional Case requires an explicit retained integer pack and exact positive whole converted units. Never invent a case conversion.
- **Quantity precision:** Units are positive whole units; fractional Cases require a retained positive integer pack and exact Decimal conversion to positive whole units (0.5 cases × 12 = 6). Reject fractional converted units, never round using float math.
- **Partial billed order:** order 4 cases versus invoice 3 cases leaves 1 case for Short/Back-ordered/Cancelled; the unbilled remainder creates no invoice deduction. Preserve comparison snapshots.
- **Request cancellation:** Draft/Requested can cancel with reason/evidence. Once Sent/Received, record actual receiving/missing and close; never erase physical transfer events. Copy residual quantities starts a new draft, not a replay of the old send.

## C3/C4 recorded defaults and owner resolutions (2026-10-09)

| Topic                                       | Build default / decision                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selling locations                           | Store: Sells to customers On; Warehouse: Off. Supervisor can configure it. Non-selling locations absent from price/offer/approval effects; warehouse receiving may still trigger a company proposal for selling stores, but warehouse-only selling target is unavailable. Preserve hidden historical warehouse overrides until explicit selling opt-in, never clear them as a side effect.      |
| Table columns                               | Defaults form compact useful tables (Suppliers nine practical columns); optional extra columns use desktop wrapping/grouped detail within available width, never hidden overflow. Preferences per company/user/table; name/reference mandatory, unauthorized money fields excluded; Reset columns restores defaults.                                                                            |
| Undo                                        | Owner 10-second/right-EN/left-FA rule; scoped conflict-aware inverses, not whole-store replacement. Place order/mark source notes ordered may Undo only before receipts or later edits; keep reference/history. Request Undo retains original transfers and appends transfer_correction evidence, never claims the goods moved back.                                                            |
| Product date preference                     | Explicit Yes/No initializes invoice choice; unset asks. Yes needs actual date; short-dated expiry mandatory. Manual dates allow optional quantity/lot/note, no stock inference. Stop tracking is Supervisor catalog edit, scoped date addition/removal follows existing operational permissions.                                                                                                |
| Weighed display                             | Canonical approved price per lb; main display lb by default (kg allowed), secondary unit On, rounding bands On; factor 2.20462, converted cost half-up to 4 decimals, secondary selling display half-up cents. Bands Off bypasses band/special corrections for bands categories, not Rice's separate upward-ending rule or Each pricing.                                                        |
| New item estimate                           | Temporary typed line accepts optional pack/cost without fabricating purchased history. An incomplete expected-cost estimate remains identified as incomplete; explicit quantity and invoice-line/product matching required. Only posted association creates supplier item purchase evidence.                                                                                                    |
| Expected return credit                      | Deduct expected credit at pickup On; provisional Supervisor-only balance projection distinct from confirmed credit ledger. Waiting-for-credit alert defaults14 days. Actual credit note/evidence requires Supervisor posting and replaces expectation once.                                                                                                                                     |
| Replacement pending credit (owner answered) | **Return to $600**: replacing the $30 claim releases its provisional expected credit, restores projected owed from570 to600, and creates no new purchase invoice or financial credit. Preserve actual replacement/return evidence. This owner answer resolves the apparent conflict between pickup deduction and “no money changes” for replacement: no new settlement/purchase ledger posting. |
| Notebook language                           | English name required; Persian optional; display English when Persian missing.                                                                                                                                                                                                                                                                                                                  |

The above are documented company defaults or explicit owner decisions, not new paid resources, production integration or inventory authorization. C3/C4 file scope permits prototype/, docs/ and seed/ demo/config/pricing cases, superseding C1/C2's seed-only-location restriction.

## Historical C5 interaction defaults (superseded by C6 for Lookup, tracking-off and Undo) (2026-10-10)

- Quick-add retains chosen date and concrete location between shelf entries; clears product and optional quantity/lot/note and refocuses product. Expiry is the default type; More exposes Best before and optional evidence. These interaction defaults do not invent stock/financial evidence.
- The owner explicitly allows Supervisor and Floor Worker Lookup On/Off. Off preserves open dates, matching the existing keep-dates default; Supervisor Stop tracking retains its explicit remove-existing choice. Worker switch audits the concrete assigned location. All branches Lookup uses the existing permitted concrete price-preview location and labels it; no entry/audit uses `all` as a physical location.
- Adding while Off/unset enables the existing company catalog preference together with the new scoped date; one Add date Undo restores both prior preference and entry evidence, with conflict checks. Other catalog fields remain Supervisor-only.
- One Current row means one product row; permitted distinct default/branch offer scopes are grouped, not erased. An identical active/scheduled submission in its scope reuses the existing record; changed terms create/stop audited versions. Past sorts retained stop/end/creation evidence newest first, falling back to original retained order for legacy records without timestamps.
- C5 supersedes the full-card Sign in button with the universal intrinsic-width text-action rule. Sorting headers, calendar choices, menus, navigation and clickable result/KPI surfaces remain semantic widgets and are listed separately in the audit; ordinary action buttons are never exempted by relabeling them.

## C6/C7 owner questions resolved by C8 (2026-10-12)

Correct pickup: Owner/Manager only; Supervisor proxy until E1. Dark filled Primary/KPI: #2B59C3 white; #7397F0 only dark links/icons/selected tabs/focus. The detailed answer and later options are in the C8 section below.

## C6 implementation contracts recorded before code

- Per-product reminder days defaults existing configured expiry window30, no second global default. Reminders one per date; stopped products absent from active lists/reminders whether dates kept or cleared. Keep leaves Lookup read-only dates, Clear keeps removed History. Products preference remains Supervisor-only; workers keep authorized quick entry/removal.
- Receiving may show only same-company/product/supplier dates entered within7days at another location, with location/type/date/optional lot; no other-location costs/quantities/invoice or general read access. This narrow sharing exception is explicit.
- Lot identity company/product/supplier/location/expiry, one catalog barcode/product, immutable source receipts/costs; optional clearance location/lot-specific, separate from ordinary offers. No on-hand or inferred depletion.
- Keep for next pickup permits a **new** signed immutable pickup event. Multiple distinct partial credit notes may cover disjoint remaining actual picked-up item quantities, retaining one linked invoice and financial authorization. Existing whole-return one-credit limit is superseded only for these verified non-overlapping item settlements; no duplicate documents or double deduction.
- Supplier memo/order each en(default)/bilingual setting; internal picking remains bilingual. Local timestamps use config IANA zone, persisted UTC. Final total auto until explicit edit; mismatch warning; term dates editable.
- IndexedDB company/hash file refs replace inline bytes only after durable read-back/hash verification and backup. Exact invoice originals retained; photos ≤2000 px longest side. Migration failure leaves source evidence recoverable. Twenty3MBphotos is required proof, not production unlimited-storage guarantee.
- C6 replaces stacked10second Undo with one about 8-second message, ×/replacement/reserved action-bar space, no field edits/autosave. C7 styles all existing screens using the already-replaced Klead source.

**C6 new-write guard:** New resolutions, credits and replacements require actual retained signed pickup evidence and remaining actual picked-up quantity coverage. Legacy imported settlements stay readable and unchanged; they do not authorize a new no-pickup settlement.

## C8/E: owner answers and later options (2026-10-12)

The two C7 questions are resolved. Correct pickup is Owner/Manager only, with today's Supervisor representing them until E1. Dark filled Primary/KPI uses #2B59C3 with white; #7397F0 is reserved for dark links/icons/selected tabs/focus. Keep immutable correction and actual contrast guards.

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
