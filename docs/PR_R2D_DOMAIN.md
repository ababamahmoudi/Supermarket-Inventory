# R2d timesheet domain implementation

## A1 — Current authority controls access

Timesheet read/edit capabilities belong to Owner, Manager, Branch Supervisor and Cashier, within their current company and permitted locations. Floor Worker has neither capability. A disabled Timesheets module denies both capabilities even to Owner. Configured role capability descriptions are metadata; changing them cannot manufacture authority. Concrete mutations reject aggregate locations and stale/fabricated actor claims.

The prototype's secure boundary is its existing private canonical IndexedDB repository and fresh-authority transactions. It is a local prototype, not a deployed network API. Screens and exports must call the guarded command/query functions.

Validation: `npx vitest run src/timesheets.permissions.r2d.test.ts --maxWorkers=1`.
