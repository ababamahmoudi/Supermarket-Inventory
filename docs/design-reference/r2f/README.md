# R2f designs (approved by Ali, October 27)

Every image here is a screenshot of the **real app** (branch `feat/prototype-r2-receiving`, commit `19ddfc8`). Only the redesigned part of each page was replaced, using the app's own classes, tokens and components. All names and numbers are invented demo data.

## screens/
`<design>-<width>-<theme>-<language>.png`, at 2× pixel density (so a 1440 px screen is 2880 px wide).

| Design | Files |
| --- | --- |
| Timesheets day sheet | `timesheets-*` (1440 light EN, 1440 dark FA, 1000 light EN, 390 light EN) |
| Manage staff window | `timesheets-staff-*` (list) and `timesheets-staff-add-*` (after pressing Add person) |
| Weight product with package sizes | `weight-product-*` |
| Lookup: a weight item and its packages, new quick filters | `lookup-weight-*` |
| Lookup at All locations: by location | `lookup-locations-*` |
| Approvals cards | `approvals-*` |
| Dashboard corrections | `dashboard-*` |
| Returns list | `returns-*` |
| Original invoice toolbar | `original-viewer-*` |
| New branch request | `branch-request-*` |

## source/
How each design was built, so measurements can be read exactly:
- `<design>.mjs`: the markup (`html`, `dialog` or `patch` of the live page) and the extra CSS (`css`) added on top of the app's own stylesheet. Class names starting `tsx-`, `stx-`, `wpx-`, `lkx-`, `lcx-`, `apx-`, `dbx-`, `rtx-`, `ovx-` and `brx-` are design-only. Re-create them inside the app's real components and stylesheets. Don't paste them as one-off overrides; don't use `!important` in the app.
- `common.mjs`, `icons.mjs`: helpers that output the app's real button, select, badge and segment markup, and the same lucide icons the app uses.
- `align.js`: the alignment check the designs were verified with (see R2f, rule R0.7).
