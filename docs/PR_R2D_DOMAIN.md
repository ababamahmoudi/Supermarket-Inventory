# R2d timesheet domain implementation

## A1 — Current authority controls access

Timesheet read/edit capabilities belong to Owner, Manager, Branch Supervisor and Cashier, within their current company and permitted locations. Floor Worker has neither capability. A disabled Timesheets module denies both capabilities even to Owner. Configured role capability descriptions are metadata; changing them cannot manufacture authority. Concrete mutations reject aggregate locations and stale/fabricated actor claims.

The prototype's secure boundary is its existing private canonical IndexedDB repository and fresh-authority transactions. It is a local prototype, not a deployed network API. Screens and exports must call the guarded command/query functions.

Validation: `npx vitest run src/timesheets.permissions.r2d.test.ts --maxWorkers=1`.

## A2 — Configured departments and module switch

The eight bilingual paper departments and their order live in seed configuration. Another company can rename, reorder, add or remove them. The module switch is independent of department settings: management can configure Timesheets while it is off. Settings writes validate unique stable keys, captions and order, preserve company scope and record before/after with the current actor. No screen or business operation owns a hardcoded department list.

Validation: `npx vitest run src/timesheets.config.r2d.test.ts --maxWorkers=1`.
