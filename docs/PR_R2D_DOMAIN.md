# R2d timesheet domain implementation

## A1 — Current authority controls access

Timesheet read/edit capabilities belong to Owner, Manager, Branch Supervisor and Cashier, within their current company and permitted locations. Floor Worker has neither capability. A disabled Timesheets module denies both capabilities even to Owner. Configured role capability descriptions are metadata; changing them cannot manufacture authority. Concrete mutations reject aggregate locations and stale/fabricated actor claims.

The prototype's secure boundary is its existing private canonical IndexedDB repository and fresh-authority transactions. It is a local prototype, not a deployed network API. Screens and exports must call the guarded command/query functions.

Validation: `npx vitest run src/timesheets.permissions.r2d.test.ts --maxWorkers=1`.

## A2 — Configured departments and module switch

The eight bilingual paper departments and their order live in seed configuration. Another company can rename, reorder, add or remove them. The module switch is independent of department settings: management can configure Timesheets while it is off. Settings writes validate unique stable keys, captions and order, preserve company scope and record before/after with the current actor. No screen or business operation owns a hardcoded department list.

Validation: `npx vitest run src/timesheets.config.r2d.test.ts --maxWorkers=1`.

## A3 — Branch staff, daily shifts, payroll views and retained audit

Staff are a per-branch list, with an optional link to an active same-company app person. Staff and removed rows are archived/retained, never deleted. Every meaningful add/change/removal records who, when, device and before → after in History. Timesheet audit is independently protected: Floor Worker cannot recover names or notes through their general History access. Cashier receives only the permitted timesheet audit family, without a general money/history grant.

Times normalize to 24-hour HH:mm, including Persian/Arabic digits. Hours are derived from integer minutes: 22:00 → 06:00 is eight hours and +1 day; equal endpoints mean zero. Missing Out remains accepted; past missing Out and shifts over 16 hours warn. Week starts Monday; split-shift rows sum normally and people counts deduplicate staff. Payroll CSV uses four decimal places for hours, quoted/formula-safe cells, and a fresh independently authorized read.

The On shift now count includes each person with a nonremoved, nonfuture clock-in and no Out at the selected branch, including an unclosed past shift. Old missing Out stays an amber check; the app never invents a clock-out.

Before upgrading an existing IndexedDB store, the migration verifies an exact private backup and compares the canonical revision inside the write transaction. A concurrent tab forces another backup/retry. Existing stores gain empty timesheet arrays, preserving false module switches, custom departments, records and other business data. Fresh demo/reset data is separate. Empty-store clears current-company timesheet records and retains the migration marker, so reload cannot repopulate them.

Defaults: staff need no app login; the four permitted roles can edit past dates with audit; weekly view and CSV are included. This is local prototype payroll preparation, without payment execution or cross-device synchronization.

## C — Independent fictional demo papers and security coverage

`seed/timesheets-demo.json` supplies eight invented staff across the configured departments and three relative days at the configured B1 branch. It includes one eight-hour overnight shift, one missing Out on yesterday's sheet, and a current open shift. This source is independent fictional data. Only a fresh demo or explicit Reset loads it; an existing-store upgrade adds no staff or shifts, and Empty store remains empty after reload.

For a predictable fixture audit, use October 28, 2026 at 14:30 Toronto time: Monday/Tuesday/Wednesday totals are 62 h 30 m / 55 h / 55 h, weekly 172 h 30 m. On shift now is two, including yesterday's unclosed shift. CSV contains 24 shifts plus its header and normalized 24-hour times.

New domain tests cover parsing, overnight and warnings, split shifts and totals, safe payroll CSV, audit before/after, archive/remove retention, configured departments, safe optional app-person links, all role/branch/company/module denials, forged/revoked actors, shell and History privacy, actual repository callbacks, exact verified backup/restore/concurrent migration, and fresh/reset/empty-store fixture boundaries. Browser screen/print/typing checks are owned by R2d B/C integration.
