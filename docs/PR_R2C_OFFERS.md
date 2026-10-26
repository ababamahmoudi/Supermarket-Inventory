# R2c offers review

## 5.1 Offer suggestion hierarchy

Suggestions lead with the linked product name and large offer terms. Regular price, actual bundle saving and scope sit together below; Pending, dates and mix-and-match follow. Confirm offer is primary and Dismiss is plain, with separated right-aligned actions. Savings use Decimal arithmetic and the actual configured offer terms; no pricing rule changes.

Test: approve an invented product at a mapped price, open Offers, inspect its suggestion, change the dates/pool and confirm. Repeat with Dismiss. Check English/Persian, both themes and phone layouts.

## 5.2 Create offer

Open Offers → Create offer. The shared picker searches English/Persian names, Product Code and barcode. Select a product to see regular price, configured bundle quantity and offer total. Scope, date fields and these terms use level two-column rows on desktop and one column on phones. The dialog keeps a stable frame while searching/selecting, with a structured Cancel/primary footer.

The existing approved-price-to-offer configuration still supplies the bundle terms; these displayed amount/quantity fields are read-only. This change does not authorize an arbitrary new bundle price or change any monetary rule. Choose Sale price and Continue to use the existing full price editor.

## Executed verification

The new browser suite passed all 15 matrix/action/adversarial cases: 12 language/theme/width combinations, actual confirmation and dismissal with canonical audit evidence, and strict C5 negative controls. All 24 captures were visually reviewed. After the surface-field correction, desktop English light and phone Persian dark were checked again with explicit surface fill, 44px height and full column-width assertions. Six selected existing desktop/phone regressions passed: create/pricing/Warehouse, idempotent confirmation → Stop → Past → Undo, and Floor Worker branch isolation. The branch test follows the existing record disclosure when Scope is omitted at 1280px; its price, location and privacy facts remain asserted.

Fourteen focused existing/new unit cases passed. The typed build, targeted lint and formatting checks passed. No financial calculation, timeout, retry or skip budget was relaxed.
