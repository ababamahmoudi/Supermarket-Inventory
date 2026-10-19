# E2 retained browser fixture review

Baseline: E2 `73891b6c19852e1da6a99316b2fef7873039ea9c`. Original CI run `38788353120` tested `0fa79525305cc927d8deef322986ca88f75d372f` and was cancelled after the explicit 30-minute workflow cap. It also reported two genuinely failed test titles before cancellation; cancellation is not an explanation for those assertions. Raw annotations are retained alongside this note.

## Candidate changes (not yet browser-verified)

- `labels-c1.spec.ts`: original persisted Weekend Promo option was missing after reload. The test clicked Save then Archive, and clicked Restore then immediately reloaded. Those screen handlers await real protected asynchronous commands. The candidate observes the existing saved status and exact canonical name/style, then the actual archive/restore UI transitions and canonical archived flag. All existing archived-write denial, exact archived-state equality, restored style, no-delete and template-count assertions remain. No production behavior is changed.
- `c8-layout-proof.spec.ts`: the exact Persian 900px phone-project failure occurred in fixture setup, before any layout assertions: after 6 invoiced / 2 delivered, computed Mark as short remained false. The candidate first observes this exact manual original's committed retention/status and the enabled New invoice action, then waits for each genuine 6-invoiced and 2-delivered write plus its visible value. It retains the original checked-short, exact 6/2 invoice facts, unchanged ledger/stock before posting, +2 units after posting, and invoice cost ×6 / short deduction cost ×−4 facts. All original row/glyph/control/2px guards, test timeouts and existing skips remain.

The annotations alone cannot prove that these missing barriers are the only cause. Bounded runs must determine whether either screen has a production defect after the original action is accepted. No test failure is labelled resolved yet.

## Required bounded validation

Use a private exact E2 Git archive plus the two staged files, the normal TypeScript/Vite build and native Chromium/IndexedDB/crypto. Run original tests without changing budgets, assertions, retries or skip annotations:

1. `labels-c1.spec.ts` lifecycle title, desktop.
2. Same original title, phone.
3. `c8-layout-proof.spec.ts` exact `C8 every page keeps rows inside their cards and retains glyph/control guards fa 900px`, phone project. This is the full original all-page case, including every 2px/glyph/control assertion.

Record actual CLI exit codes, raw reports/logs, frozen-source pins and served-dist hashes. Do not substitute bounded validation for the remaining full retained browser suite.
