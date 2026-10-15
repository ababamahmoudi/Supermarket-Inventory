# Proposed CI time budget — approval required before changing the workflow

The exact E1, E2 and E3 runs below passed their unit/pricing and build steps. Each prototype browser job then ended with the explicit annotation **“The job has exceeded the maximum execution time of 30m0s”**. They also recorded genuine browser assertion failures, which are retained separately and are being corrected and verified. A time-budget change alone does not resolve those failures.

| Stage | Exact source | Recorded CI run |
| --- | --- | --- |
| E1 | `38b8c0ccd6faef296179c42d75274322f7de5b15` | [38788357861](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38788357861) |
| E2 | `0fa79525305cc927d8deef322986ca88f75d372f` | [38788353120](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38788353120) |
| E3 | `e47e0c665bc85cbb619f9ab4c946a7dfe6d27e8a` | [38788356829](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38788356829) |

The later exact repaired-code runs also ended with the same explicit **30m0s** maximum-job-time failure:

| Stage | Exact source | Recorded CI run |
| --- | --- | --- |
| E1 | `f9cdd1d0840c6e3ff3079a38691b398c5915cabd` | [38797564811](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38797564811) |
| E2 | `b59de2266b55d1939b5e533d925f1a9ecd7738b4` | [38797563056](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38797563056) |
| E3 | `f1545dfb4da4e0ea1a4059dcdd3aa1d59e231f76` | [38797561832](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/38797561832) |

Their foundation, prototype lint, unit/pricing and build steps passed. Their terminal check annotations report no browser assertion titles, but the cancelled browser steps are incomplete, not passes. [Exact terminal records and main/PR status](evidence/e3/exact-ci-f154/README.md) retain those boundaries. The independent local full f154 replay has found a real inline-unit wrapping issue; correcting it is separate from increasing the CI time budget.

The complete original local browser replay took about 53 minutes by itself. The same job must also install dependencies, run unit/pricing tests and build the app. Its current 30-minute limit cannot accommodate that recorded run. Final corrected-source results remain separate from this historical timing evidence.

The concrete proposed edit changes only the prototype job in `.github/workflows/ci.yml`:

```diff
   prototype:
     name: Prototype lint, pricing and unit tests, build, and browsers
     runs-on: ubuntu-latest
-    timeout-minutes: 30
+    timeout-minutes: 90
```

Every check, test assertion, worker setting, retry setting and skip rule stays as configured. The foundation job keeps its existing 30-minute limit. No workflow edit has been applied. The exact [compressed patch](evidence/ci-prototype-budget/proposed-timeout-only.diff.gz) and [recorded terminal summary](evidence/ci-prototype-budget/terminal-separated-summary.json.gz) have [original-byte integrity pins](evidence/ci-prototype-budget/integrity.json).

The [latest owner request](owner-requests/C8-E1-E2-E3-2026-10-12.md) says: **“Rules: change only prototype/, docs/ and seed/.”** The workflow is outside those three directories, so this single-file exception needs Ali’s approval. All authorized application repairs and their reviewable verification should be completed before asking to apply this proposal.
