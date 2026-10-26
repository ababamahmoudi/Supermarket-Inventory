# R2c receiving follow-ups

## 0.1 Blocked Post appearance

A blocked Post invoice is a neutral, muted `aria-disabled` action with a not-allowed cursor. Missing review requirements remain explainable by mouse, keyboard and click without posting; actual permission/reading denial remains natively disabled. Only a complete permitted invoice uses the primary blue action.

Test: import a fictional invoice, open it and hover/focus/click Post invoice. Review the exact missing requirements, then finish them and check that Post becomes blue. Automated: PostInvoiceControl.r2b.test.tsx.

## 0.2 Posted Done

Every posted invoice has a primary Done action beside secondary correction/move actions. Done returns an invoice opened from an operational page to that page, or to the Invoices Posted tab for list/direct entries. Entry routes are scoped to company/person/location and survive review-to-post transitions; browser scroll restoration remains in place.

Test: open a posted invoice from Invoices → Posted and choose Done; repeat from a supplier delivery link. Post a reviewed fictional invoice and check Done is immediately visible. Automated: navigation.test.ts.

## 0.3 Immediate line confirmation

Confirm line immediately updates the filter counts and progress presentation while the normal protected save runs. In Needs attention the row fades out in 120 ms (immediate with reduced motion) and keyboard focus moves to the next attention row. A failed canonical validation or save restores the row, count, editor and retry error; no optimistic state writes business records or bypasses the posting guard. An ordinary Close still retains its previous scroll position.

Test: select Needs attention, open a valid fictional line and Confirm line. Check the counts update at once and the next row receives focus. Automated delayed-save and failure regressions: LinesTable.r2c.test.tsx, with existing LineEditor canonical validation/fast-typing regressions retained.
