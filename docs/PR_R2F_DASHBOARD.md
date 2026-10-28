# R2f D7 — Dashboard review

Sign in as Manager, choose North York and open Dashboard.

1. Read the six tiles. Captions wrap to at most two lines and never show an ellipsis. Expiring soon says Reminder window because each product's actual reminder horizon is configurable.
2. At 1440 px, Approvals has Type 120, Price 128, Margin 80 and Actions 168 px; Product takes the remaining width. The last heading is visually blank with an accessible Actions label. Open a row's More → View approval to reach that actual approval, including facts omitted at smaller widths.
3. Check the card titles and the two purchase charts. Headers are at least 44 px; neighbouring purchase cards have equal height. Stacked phone cards retain their natural height.
4. Find This week. Its three real counts link to Returns, Received and Price updates. One actual delivery containing several product lines counts once. Later short/replacement deliveries remain distinct. No screenshot figures are hardcoded.
5. Read Activity. It is one list. Today's time or the earlier month/day sits at the end; hover/read the timestamp for its full company-local date/time. Actor/location lines have no dangling dot.
6. Repeat in Persian/dark at 390 px and at 1000 px. The phone This week card comes immediately after the tiles and before Approvals, matching the approved PNG rather than the prompt's after-charts sentence.

The dashboard retains all existing private selectors, original evidence, role/branch/currency rules and Decimal calculations. Only the grouped delivery count is added to the authorized summary, without exposing private source IDs. Prior date values use English month/day in both interfaces, matching the approved value presentation. Existing one-line SummaryTile callers retain their previous fitting behavior.

Validation: all six new actual browser cases passed at 1440/1000/390 px in EN light/FA dark (1.6 minutes), using the strict shared audit and exact canonical hash destinations. All 18 existing R2c dashboard cases passed unchanged, including negative control/style checks and All locations queue count. Four affected unit files passed 17 tests; two existing dashboard authority/currency files passed six more. Changed-source ESLint and the production build passed. Final integrated CI is recorded in the combined R2e/R2f review guide. No screenshot is treated as proof that a business command succeeded.

The shared table keeps its default 240 px desktop name minimum. Dashboard explicitly requests a 160 px minimum through the generic `desktopMinWidth` column option so all four approved fixed columns fit without suppressing Type. Other tables retain their current default.

D7 replacement delivery counting uses each actual replacement stock-movement identity. The existing canonical workflow emits one movement per replacement event, so distinct receipts for one return on the same day remain distinct even when the Received projection has no timestamp. It never groups those events by return/date. Invoice multi-product lines still share their actual source/timestamp group.

The replacement follow-up passed four affected dashboard/Received/operations unit files (53 tests), including real signed pickup and two distinct same-day replacement commands; changed-file lint also passed.
