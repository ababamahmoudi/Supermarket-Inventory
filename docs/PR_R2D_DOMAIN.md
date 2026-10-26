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
