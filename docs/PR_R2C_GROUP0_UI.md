# R2c receiving follow-ups

## 0.1 Blocked Post appearance

A blocked Post invoice is a neutral, muted `aria-disabled` action with a not-allowed cursor. Missing review requirements remain explainable by mouse, keyboard and click without posting; actual permission/reading denial remains natively disabled. Only a complete permitted invoice uses the primary blue action.

Test: import a fictional invoice, open it and hover/focus/click Post invoice. Review the exact missing requirements, then finish them and check that Post becomes blue. Automated: PostInvoiceControl.r2b.test.tsx.
