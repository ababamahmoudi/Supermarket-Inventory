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

## 0.4 Vertically centered line values

Review, posted and shared correction-table cells vertically center the status/line number and numerical values. A two-line quantity remains one centered block, with the unit conversion beneath its primary quantity.

Test: inspect a fictional case line beside a single-line unit quantity in review, posted and correction, in both themes. The icon, number, costs and totals center on the row; the two quantity lines center together.

## 0.5 Rounded review rows and plain posted lines

Desktop review/correction fills have rounded first and last cells over a transparent row, avoiding the darker square beneath rounded cells. Responsive phone rows put the continuous fill on the rounded row and keep every cell transparent. Posted lines omit the settled status/number column and green fill; plain rows use hairline dividers. Posted case quantities now use the same centered primary/conversion block and start alignment as review. Posted Totals uses the review card body font sizes, spacing and payable emphasis.

Test: review a fictional invoice in dark mode, post it and compare the line rows and Totals. Open Correct invoice to inspect the shared closed-row treatment.

## 0.6 Safe labels and invoice detail alignment

Unknown internal reading keys are omitted rather than displayed as a generic Other reading field or raw identifier. Retained extra evidence has bilingual human labels; branch hints remain import-location inputs only. Not on the invoice stays inline beside its check marker on a shared label track. More details uses two columns (one on phones); addresses retain the receiving typing buffer and fit two to four lines with ordinary field padding, reserving the address track to avoid shifting the following rows while typing.

Test: open More details on a fictional import with an empty optional check and long bill/ship addresses. Check aligned field tops, the inline paper-absence action, complete lines and no internal key labels. Automated: ReadingUnknownChecks.r2b and InvoiceReadingReview.r1 regressions, plus existing details-layout browser proof.

## 0.12 Four invoice source tiles

New invoice uses the standard icon/title/description/dialog footer with four equal outlined icon tiles in a two-by-two grid, or a single column on phones. Each tile states what it does; the muted simulation note is explicit. Current location/role guards and additive JSON import are unchanged. These descriptive choice tiles are deliberately taller than a normal 44px action.

Test: Invoices → New invoice. Check all four icons/titles/descriptions, the simulation note and Cancel; test Photo/PDF/Manual/JSON under the same permissions as before. Automated: Invoices.navigation.e1.test.tsx and existing r2b-invoice-entry browser routes.

## 0.14 Quiet dark attention rows

Dark receiving/correction attention rows use an 8% mix of the existing amber dot token over the surface token. Text keeps its normal contrast, and the amber check icon identifies outstanding evidence; confirmed green rows remain distinct. No new color is introduced.

Test: switch a fictional receiving invoice with checks to dark theme and compare to a confirmed row on desktop and phone.

## Executed UI verification

Targeted unit tests cover actual canonical line validation, delayed confirmation presentation/rollback and scoped Done destinations. Existing details-layout and four-source browser flows pass in EN/FA on desktop/phone. Additional browser geometry checks measure rounded review corners, centered line values, disabled Post semantics, 8% amber fill, and all four source tiles at 1440/1000/390 in both languages/themes. The source tiles use a scoped selector to preserve their equal grid geometry against ordinary action-button defaults; description text wraps within its tile. A later deliberate line navigation cancels the earlier confirmation's scheduled focus handoff.
