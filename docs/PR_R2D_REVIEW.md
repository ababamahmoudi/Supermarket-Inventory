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

Invalid partial times stay in their original field with an accessible explanation and Retry. Date, view, print and export actions wait for valid edits. Leaving the page during a delayed save cannot reopen the old sheet. Returning a time to its original value while an earlier save is running preserves that latest edit.

## B2: week view and payroll CSV

1. At one branch, open Timesheets → **Week view**. Expect Monday through Sunday, staff sorted by department/name, staff totals, department totals and the week total. Phone cards keep every day reachable without sideways page scrolling.
2. Click a person's day cell. That exact daily sheet opens; reload keeps the chosen day view. Date arrows move one week while in Week view.
3. Choose **Export CSV** in either view. The file contains staff, department, date, In, Out and decimal hours for that branch/day or branch/week. Export rechecks current authority and waits for valid pending edits; changing person or location while it loads cancels the old export.

Executed B2 browser proof: actual daily canonical shifts reconcile with the displayed weekly total; a real downloaded CSV has the exact payroll header and selected dates; a week cell opens the same day and survives reload. Desktop and phone passed.

## B3: print the paper sheet

1. Open a daily sheet and choose **Print**. The app saves valid pending entries, reads the current authorized branch sheet again and opens the browser's print dialog.
2. Expect bilingual Date / Branch / Day, all eight configured departments and Name / In / Out columns, the Notes box and **Made with Klead** at the bottom. The default layout follows the supplied three-column paper. Empty sections retain writing lines. Choose A4 or Letter in the browser.
3. Week view → Print produces the staff/day/department totals for the selected week. The print output contains no app navigation or editing controls.

Executed B3 proof: desktop and phone print-media rendering contains all eight bilingual sections, Notes, three paper columns and the footer; the app shell is hidden. Chromium generated an A4 PDF. Floor Worker navigation contains no hidden print sheet. Physical printer alignment and paper output remain untested.

## B4: On shift now

1. As Owner or Manager, choose North York and open Dashboard. The additional **On shift now** tile counts unique staff with an In and no Out, including unclosed prior days. Future clock-ins are excluded. Click it to open Timesheets.
2. With All locations, the tile asks for a branch and never silently uses the first one. Branch Supervisors see the same tile for their permitted locations.
3. Settings → Modules → Timesheets Off removes the tile. The Manager dashboard retains its five operational tiles; enabling Timesheets adds the sixth tile in the same surface style.

Executed B4 browser proof: Manager count reconciles to canonical unclosed staff, click opens the correct branch, module Off restores five tiles, and Branch Supervisor aggregate selection asks for a branch. Desktop and phone passed. Strict dashboard control proof also rejects a sixth tile when access is denied or its label is unrelated; restored genuine composition passes.

## Visual and regression review

The Timesheets visual proof passed all 12 combinations of 1440 / 1000 / 390 pixels, English / Persian and light / dark. Each combination captured the daily sheet, week view, staff manager, settings and print output. Geometry checks verified the 3 / 2 / 1 department grid, 44-pixel ordinary controls, surface-colored form fields and no page or daily-row overflow. Contact boards and representative full-size captures were reviewed manually; phone snapshots are browser emulation, not physical-device testing.

The final production-preview Timesheets suite passed all 14 cases across desktop and phone: typing/reload, role denial, week/CSV, print, invalid-time stability, staff management and settings/module changes. Seven focused unit tests passed, including three that use real IndexedDB commands with delayed save scheduling to verify navigation cancellation and the original-value save race. The production build and targeted lint passed.

Print proof covers browser media rendering and an actual Chromium A4 PDF, while a physical printer remains untested. Evidence contains fictional demo staff only.

Integrated token verification also keeps the phone's full-screen staff sheet square through the shared `--radius-none` token. The existing token audit remains unchanged.
