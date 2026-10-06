# Prototype validation — 2026-10-06

Codex ran these checks on Linux with Node.js 22.23.3 and Chromium. GitHub Actions runs the same prototype commands on Ubuntu. Ali does not need to install tools or repeat these technical checks.

| Review part                     | Unit tests passed | Desktop/phone browser checks passed |
| ------------------------------- | ----------------: | ----------------------------------: |
| 1. Shell                        |                 8 |                                   2 |
| 2. Pricing and Settings         |                74 |                                   8 |
| 3. Lookup and Products          |                83 |                                  16 |
| 4. Invoice flow                 |               101 |                                  22 |
| 5. Approvals, alerts and offers |               124 |                                  28 |
| 6. Labels                       |               128 |                                  34 |
| 7. Full prototype               |               153 |                                  46 |

Counts are cumulative. Each part was checked from its staged review snapshot, with future screens excluded. Lint, TypeScript and the production build passed for every part. The pricing suite includes all 24 cases from `seed/pricing-test-cases.json`.

Final commands:

```bash
cd prototype
npm run lint
npm test
npm run build
npm run e2e -- --workers=2 --retries=0 --reporter=list
```

The browser checks cover fictional PINs and role guards; English/Persian lookup; approved versus proposed prices; editable divisors; invoice drafts/originals; the 7.23 chips deduction and 3.62/3.61 restorations; approval scopes; intentional conflicts; confirmed offer pools; A4 templates; signed pickup and replacement evidence; supplier-held cancellation restoring zero; expiry history; stock-use notes; unread reviews; partial cheque allocations; month-end CSV/printing; dashboard order; and invalid actions leaving records unchanged.

All screens were also visited while offline in both languages at desktop and phone sizes: 52 screen visits, no horizontal page overflow, no console errors, and no external requests. The app and tab icons are embedded; fonts are locally bundled and loaded before offline testing. Refreshing offline is outside this test; a new page load requires the static host or local server.

An additional print check generated 24 bilingual labels on two A4 pages. No label content clipped, sheets did not overlap, and used slots were skipped. A Payables report produced a visible A4 PDF. These checks demonstrate browser layout; physical printer calibration is future work.

The latest GitHub result on each pull request is authoritative for remote CI. Prototype checks and the separate foundation service job are reported independently. No pull request has been merged and `main` remains unchanged.
