# R2f D1/D2 Timesheets review

## D1 — Daily sheet

1. Sign in as Manager, Branch Supervisor or Cashier. Choose an allowed branch and open Timesheets. See the actual branch/day, distinct people, compact hours and current on-shift count. Owner access remains available; Floor Worker and module-Off access remain denied.
2. At 1440px see three independently sized department columns; at1000px see two, at390px one. Department titles use the current language only. Each person stays on one row with Name / In / Out / Hours / shift menu.
3. Focus a blank time: a small Now choice shows that branch's actual24-hour clock. Tap it to save that explicit time, or type730 then leave the field to get07:30. A populated field has no Now suggestion. Typing, save echoes and validation keep neighbouring controls in place.
4. A valid current open shift shows elapsed blue hours with “so far”; overnight completion shows +1 day. A past missing Out remains amber and does not invent a clock-out. Future In times have no elapsed claim.
5. Open Week and Export CSV. A missing-Out shift still contributes0 completed hours even when its daily display shows elapsed time. Saving a real Out makes its completed duration available normally.
6. Use the row's shift menu → Remove → confirm; History still retains the change. Use Header History to see only the authorized selected day's records. Notes remains the last daily card, grows without a resize grip and preserves Saved/Saving/Retry feedback.
7. Print remains the bilingual R2d paper (day/week) with the configured maker footer. Back/hash navigation, queued edits, original editing identity, branch-local date choice and native reload protection retain their existing guards.

The reference's people and numbers are illustrative. The app always displays its actual authorized records. Daily captions may include clearly marked current elapsed hours; canonical completed payroll, week, CSV and paper are unchanged until an Out is recorded. Physical printing remains a hardware check. Validation results and D2 instructions are recorded below when integrated.

D1 validation: production TypeScript/Vite build, changed-file ESLint, 27 focused display/autosave/clock/navigation unit checks, and the 13-case desktop-driven browser matrix passed. The matrix covers EN/FA, light/dark and1440/1000/390 widths with real saved-state assertions; widths, control heights, column edges and input centres are checked. Actual screenshots were captured for every matrix variant and compared with the approved references. Existing Manager/Cashier focused hash navigation, failing Browser Back/Retry and native reload checks passed. The existing print check now asserts both configured English and Persian maker footer spans, matching Group E.
