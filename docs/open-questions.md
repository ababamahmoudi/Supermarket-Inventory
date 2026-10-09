# Open questions (build with the default; make each one configurable)

When Ali answers one, update the requirement it affects, record the date here, and remove the question.

| #   | Question                                                                               | Default to build with                                                                 |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Rice with an exact whole-dollar raw price (e.g., 4.00): go up to 4.99 or down to 3.99? | Up: 4.99 ("always round upward")                                                      |
| 2   | While a new price is pending, what does the cashier charge?                            | Last approved price; new products show the proposed price tagged Pending              |
| 3   | Minimum margin per category (for the "below minimum margin" approval)                  | `0.25` placeholder; rule inactive if empty                                            |
| 4   | Tax: rate, jurisdiction, currency, timezone                                            | Placeholders in config; rate is a company setting; prices displayed before tax        |
| 5   | Is tax on a short deduction included in the deduction?                                 | Yes, proportional tax is deducted with the line                                       |
| 6   | Price → offer mapping                                                                  | 1.99 → 3 for $5; 2.99 → 2 for $5; 3.99 → 2 for $7 (editable)                          |
| 8   | Persian digits or Western digits in the Persian UI                                     | Western digits for prices, codes, dates; translations for text                        |
| 9   | Can cashiers add notes?                                                                | Not to built-in notebooks; yes to a custom notebook if the Supervisor allows it       |
| 10  | Do Floor Workers see unit cost and margin?                                             | Cost on invoices they handle only; margins hidden                                     |
| 11  | Units per case: who enters it for a new supplier product?                              | AI proposes from the invoice; worker confirms on first receipt; remembered afterwards |
| 12  | Expiring-soon entries with no sales data                                               | Manual **Cleared** action                                                             |
| 13  | Raw price below $0.23 (no "previous .99" exists)                                       | Result 0.49                                                                           |
| 15  | Which AI provider reads invoices?                                                      | Decide at Phase 5 with cost per invoice; provider-agnostic interface                  |
| 16  | When exactly is an offer suggestion created?                                           | When the price becomes effective at 1.99/2.99/3.99 with no offer                      |
| 17  | Automatic supplier invoice number scheme                                               | Sequential per supplier, flagged system-assigned                                      |
| 18  | Idle-lock time and password re-prompt window                                           | 5 minutes and 15 minutes (settings)                                                   |
| 19  | Product code start                                                                     | `0001`, zero-padded, five digits after 9999                                           |
| 20  | Persian terminology for the English terms list                                         | AI drafts; Ali reviews before go-live                                                 |
| 21  | Official logo files and brand colors                                                   | Use the supplied PNG and sampled colors; replace when received                        |
| 22  | Username format                                                                        | First name + last initial (e.g., `sara.k`), editable by the Supervisor                |
| 23  | Google sign-in and a second sign-in step for Supervisors                               | Not in Phase 1; designed so they can be added                                         |
| 24  | Lockout settings                                                                       | 5 attempts, 15 minutes (settings)                                                     |
| 25  | Label waitlist auto-add on price approval                                              | Off by default (setting)                                                              |
| 26  | "Price changed recently" window for labels                                             | 3 days (setting)                                                                      |
| 28  | Persian wording for offers ("2 for $5")                                                | "۲ عدد $5" style; Ali reviews                                                         |
| 29  | AI provider for real invoice reading                                                   | Decide at step 0.3 with cost per invoice                                              |

## Resolved by the A2 request (2026-10-07)

- **27 — Undo window:** Ali specified **5 seconds per toast**, paused while that toast is hovered, independent timers, newest-first stacking, bottom-left in English/bottom-right in Persian, at most **3** visible plus **+N more**. This is an owner decision, no longer an unresolved default. Implementation is deferred to B; see `requirements.md` §23, `design-language.md` Toast/Undo toast and Decision 014.

## Resolved / scope changed by C (2026-10-09)

- **7 — Location names/types:** owner specified North York, Richmond Hill, Newmarket and Warehouse; Warehouse has no Cashiers. Stable original store IDs remain, EN/FA display names are configuration and saved custom renames persist. Settings → Branches changes name/type.
- **14 — Stock counts:** removed from Phase 1 scope together with stock estimates/opening counts. Inventory depends on register sales and is a separate paid later phase; preserve physical events without enabling projection/count transactions.
- **Labels:** owner reversed no-default-template: Regular and Promo are built in. Technical exact geometry recorded in requirements/design/data-model: Regular 60 × 40 mm/margins 10/gaps 4; Promo 210 × 148.5 mm/zero margin-gap/two per A4, safe content/border inset 5 mm. Geometry editable; physical printer alignment cannot be promised without its actual printer.
- **Invoice location corrections:** current outstanding liability moves via paired adjustments, preserving original invoice/payment/credit/allocation evidence and company total; use existing Decision 005 impact preview and append-only corrections.

## C2 implementation defaults confirmed before code (2026-10-09)

- **Order access:** `orders.allow_floor_worker` defaults false. Explicit opt-in allows order cost snapshots/expected amounts inside Orders only; no Supplier cost-history/catalog privilege or Cashier access.
- **Unbought supplier items:** bought cost/date/invoice stay blank. Use actual supplier purchase cost, separately attributed Supervisor quote, or required explicit **Expected unit cost** before placement. Never infer a supplier purchase or hide a fallback to catalog cost.
- **Quantity precision:** Units are positive whole units; fractional Cases require a retained positive integer pack and exact Decimal conversion to positive whole units (0.5 cases × 12 = 6). Reject fractional converted units, never round using float math.
- **Partial billed order:** order 4 cases versus invoice 3 cases leaves 1 case for Short/Back-ordered/Cancelled; the unbilled remainder creates no invoice deduction. Preserve comparison snapshots.
- **Request cancellation:** Draft/Requested can cancel with reason/evidence. Once Sent/Received, record actual receiving/missing and close; never erase physical transfer events. Copy residual quantities starts a new draft, not a replay of the old send.
