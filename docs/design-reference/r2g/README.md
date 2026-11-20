# R2g designs (Claude, October 28)

Every image here is a screenshot of the **real app** (branch `feat/prototype-r2-receiving`, commit `b55ec10`). Only the redesigned part of each page was replaced, using the app's own classes, tokens and components. All names and numbers are invented demo data.

## screens/
`<design>-<width>-<theme>-<language>.png`, at 2× pixel density. Phone designs are drawn at **390 and 509 px**. Every phone layout must also hold at 360 and 760 px.

| Design | Files |
| --- | --- |
| Sign-in, passkey step, lock screen | `signin-*`, `passkey-*`, `lock-*` |
| Change price (normal, and with the below-cost warning) | `change-price-*`, `change-price-warning-*` |
| Lookup filters and results | `lookup-filters-*` |
| Invoice review: lines, charges and credits, totals | `receiving-*` |
| Offer suggestions and offer tables | `offers-*` |
| Create offer | `create-offer-*` |
| One phone list pattern | `phone-invoices-*`, `phone-received-*`, `phone-expiry-*`, `phone-statement-*`, `phone-labels-*` |
| New order: supplier items | `new-order-*` |
| Timesheets toolbar on phones | `timesheets-390-*`, `timesheets-509-*` |

Bars that stick to the bottom of the screen in the app (invoice review on phones, New order) are drawn at the end of the page, because a full-page screenshot can't show a sticky bar. In the app they stay at the bottom of the screen.

## source/
How each design was built, so measurements can be read exactly:
- `<design>.mjs`: the markup (`html`, `dialog`, or a `patch` applied to the live page) and the extra CSS (`css`) added on top of the app's stylesheet.
- Class names starting `sx-`, `cpx-`, `lfx-`, `rx2-`, `osx-`, `cox-`, `plx-`, `orx-`, `brx-` and `tsx-` are design-only. Re-create them in the app's real shared components and stylesheets: the phone list (`plx-`) becomes the shared phone row of `ui-data-table`, and the chips (`lfx-`) become the shared toggle chip. Don't paste them as one-off overrides, and don't use `!important` in the app. The designs needed it only to beat the live stylesheet.
- `common.mjs`, `icons.mjs`: helpers that output the app's real button, select, badge and segment markup, and the same lucide icons.
- `align.js`: the alignment check the designs were verified with (R2f rule R0.7). Run it at 360, 509 and 760 too.
