# Open questions (build with the default; make each one configurable)

When Ali answers one, update the requirement it affects, record the date here, and remove the question.

| # | Question | Default to build with |
|---|---|---|
| 1 | Rice with an exact whole-dollar raw price (e.g., 4.00): go up to 4.99 or down to 3.99? | Up: 4.99 ("always round upward") |
| 2 | While a new price is pending, what does the cashier charge? | Last approved price; new products show the proposed price tagged Pending |
| 3 | Minimum margin per category (for the "below minimum margin" approval) | `0.25` placeholder; rule inactive if empty |
| 4 | Tax: rate, jurisdiction, currency, timezone | Placeholders in config; rate is a company setting; prices displayed before tax |
| 5 | Is tax on a short deduction included in the deduction? | Yes, proportional tax is deducted with the line |
| 6 | Price → offer mapping | 1.99 → 3 for $5; 2.99 → 2 for $5; 3.99 → 2 for $7 (editable) |
| 7 | Branch names and whether all three go live together | Placeholders "Branch 1/2/3"; rename in Settings |
| 8 | Persian digits or Western digits in the Persian UI | Western digits for prices, codes, dates; translations for text |
| 9 | Can cashiers add notes? | Not to built-in notebooks; yes to a custom notebook if the Supervisor allows it |
| 10 | Do Floor Workers see unit cost and margin? | Cost on invoices they handle only; margins hidden |
| 11 | Units per case: who enters it for a new supplier product? | AI proposes from the invoice; worker confirms on first receipt; remembered afterwards |
| 12 | Expiring-soon entries with no sales data | Manual **Cleared** action |
| 13 | Raw price below $0.23 (no "previous .99" exists) | Result 0.49 |
| 14 | Do stock-count adjustments need Supervisor approval above a threshold? | No approval; logged; threshold setting off |
| 15 | Which AI provider reads invoices? | Decide at Phase 5 with cost per invoice; provider-agnostic interface |
| 16 | When exactly is an offer suggestion created? | When the price becomes effective at 1.99/2.99/3.99 with no offer |
| 17 | Automatic supplier invoice number scheme | Sequential per supplier, flagged system-assigned |
| 18 | Idle-lock time and password re-prompt window | 5 minutes and 15 minutes (settings) |
| 19 | Product code start | `0001`, zero-padded, five digits after 9999 |
| 20 | Persian terminology for the English terms list | AI drafts; Ali reviews before go-live |
| 21 | Official logo files and brand colors | Use the supplied PNG and sampled colors; replace when received |
| 22 | Username format | First name + last initial (e.g., `sara.k`), editable by the Supervisor |
| 23 | Google sign-in and a second sign-in step for Supervisors | Not in Phase 1; designed so they can be added |
| 24 | Lockout settings | 5 attempts, 15 minutes (settings) |
| 25 | Label waitlist auto-add on price approval | Off by default (setting) |
| 26 | "Price changed recently" window for labels | 3 days (setting) |
| 27 | Undo window | 10 seconds (setting) |
| 28 | Persian wording for offers ("2 for $5") | "۲ عدد $5" style; Ali reviews |
| 29 | AI provider for real invoice reading | Decide at step 0.3 with cost per invoice |
