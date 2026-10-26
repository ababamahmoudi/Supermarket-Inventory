# R2c receiving follow-ups

## 0.1 Blocked Post appearance

A blocked Post invoice is a neutral, muted `aria-disabled` action with a not-allowed cursor. Missing review requirements remain explainable by mouse, keyboard and click without posting; actual permission/reading denial remains natively disabled. Only a complete permitted invoice uses the primary blue action.

Test: import a fictional invoice, open it and hover/focus/click Post invoice. Review the exact missing requirements, then finish them and check that Post becomes blue. Automated: PostInvoiceControl.r2b.test.tsx.

## 0.2 Posted Done

Every posted invoice has a primary Done action beside secondary correction/move actions. Done returns an invoice opened from an operational page to that page, or to the Invoices Posted tab for list/direct entries. Entry routes are scoped to company/person/location and survive review-to-post transitions; browser scroll restoration remains in place.

Test: open a posted invoice from Invoices → Posted and choose Done; repeat from a supplier delivery link. Post a reviewed fictional invoice and check Done is immediately visible. Automated: navigation.test.ts.
