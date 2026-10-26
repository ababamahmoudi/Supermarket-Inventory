# R2d timesheet review

Use `feat/prototype-r2-receiving` and PR #29. Changes stay unmerged. From `prototype/`, use the supported Node 22 release, then `npm ci`, `npm run build`, `npm run preview`; open `http://localhost:5174`. Restart preview after rebuilding. Demo accounts use `demo1234`; privileged accounts also choose the simulated passkey.

## B1: daily sheets, staff and settings

1. Sign in as **cashier**. Open **Daily → Timesheets**. The sheet uses the allowed branch and today's local date. Date arrows and Today change the sheet.
2. In Bakery, choose **Add person**. Type an invented name and choose **Add “Name” to staff**. A staff record and its first shift are saved together. Existing staff suggestions put that department's people first.
3. Type `730` in In and `1915` in Out, then leave the fields. Expect `07:30`, `19:15` and **11 h 45 m**. Type quickly in two people's rows and Notes; saved values survive reload. Now uses the branch's current 24-hour clock.
4. An Out earlier than In shows **+1 day**. An open shift today shows **On shift**. A past day's missing Out or a shift over 16 hours has an amber warning; hours are always calculated.
5. Open **Manage staff** to add or edit English/Persian names, the usual department and an optional app login. Archive retains past shifts; Show archived → Restore makes the person available again. Remove a daily shift asks for confirmation and retains its History.
6. Open the day's **History** to see the actual person, local time and changed values. Notes save as you type. Staff entries need no app login.
7. Sign in as **manager**, choose All locations, and open Timesheets. Choose a branch before viewing or editing a daily sheet; the app never silently chooses the first branch.
8. Under **Settings → Timesheets**, add, rename, reorder or remove departments. English and Persian labels and order come from settings. Removed departments retain their historical shifts. Settings → Modules includes the Timesheets switch.
9. Sign in as **ny-floor**. There is no Timesheets menu item. Opening `#timesheets` directly reveals no staff or shifts. Module Off also removes the route and denies protected operations for every role.

The default is a branch staff list with an optional app-login link. Past days remain editable by the four permitted roles, and every meaningful change is audited. Actual browser storage and domain commands enforce company/location access; this prototype does not add a production backend or cross-device shared storage.

Validation is recorded only after execution. B1's initial browser proof covers actual Cashier sign-in, two new staff entries, fast time/Notes typing, canonical persistence/reload and Floor Worker denial on desktop and phone. Later sections record week/export/print/dashboard verification when implemented.
