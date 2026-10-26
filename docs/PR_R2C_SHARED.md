# R2c shared controls review

## 2.1 — Search product and supplier choices

Open Create offer → Product. The shared picker searches even a short product list; lists with more than eight choices always show search. Search an English or Persian name, product code or barcode, then use Up/Down and Enter to select. Matches are highlighted, and a match in an alternative name or barcode appears beneath the main name. Escape closes the list and retains the selected value. A search with no result says No matches.

The same public-field search metadata is supplied by invoice matching/add-line, supplier items, order item mapping, date dialogs, replacement returns, Received and Notes. Supplier choices search their name and available historical name aliases. The shelf date scanner keeps its existing exact-barcode, Enter-to-add and refocus behavior and shares matching highlights. Product and supplier options retain their existing permission/company/location filters; no costs, margins or invoice identities are added to search metadata.

Verification: 75 shared-control/helper/UI tests passed, including the existing Select, dialog and keyboard cases; TypeScript passed. No price, quantity, financial or authority behavior changes.

## 2.2 — Placeholders are instructions

Open any product picker without a selection. Choose a product appears in the closed field only and is absent from the list and keyboard options. The same applies to the explicit Choose supplier/location/reason/answer placeholders. Actual choices such as All suppliers, No category and No linked order remain selectable, including when their stored value is empty. An optional Note product association has an explicit No product choice so it can still be cleared.

## 2.3 — Lists fit the visible window

Open a picker near the bottom of a dialog. Its list opens above when that side has more room; otherwise it is bounded and scrolls internally. The search stays visible, including while the matching list becomes shorter. Shared Select, menus, date pickers and Received editing use visible-viewport bounds, including the on-screen keyboard viewport, and avoid an overlapping Undo message. The editable shelf barcode picker now uses that same placement and portal boundary while retaining its Enter-to-add behavior.

Verification for 2.3: 98 affected shared-control, date-dialog and Received-field tests passed; TypeScript passed. Placement cases include short/offset viewports, RTL and Undo overlap. Browser geometry is verified separately on the built application.

## 2.4 — One record details control per row

Suppliers, Payables, Offers and Returns now use the record's full details view for omitted facts and keep one end chevron. The extra responsive Show details control is absent on these overview rows; other tables retain it. In Offers, both clicking the row and its chevron open Offer details, while the blue product name still opens the product. A single Stop offer is a visible plain action; More is used only when there are several secondary actions. Returns keeps its next-action wording without a second button to the same page. Existing commands, confirmation and Undo remain unchanged.

Old tests that intentionally used a single-action More menu or a second phone product chevron now follow the requested direct Stop action, one Offer details control and separate blue product-name link. Their canonical no-write, financial, permission, confirmation and Undo assertions remain.

## Verification

The new unit files add 40 cases for public-field search/highlighting, explicit placeholders, viewport bounds and record controls. Relevant executed batches passed: 98 shared/date tests; 90 table/offer/return tests; and a final 67-case layout/shared-control recheck after the action-text width fix. These batches overlap and are not a combined test total. TypeScript, build, ESLint and formatting passed.

The affected desktop/phone browser batch passed 18 scenarios, retaining shelf entry/refocus, no-write Cancel, exact offer idempotency, Stop/confirmation/Undo, filters and timer/focus behavior. The final new control scenarios were also rerun after visual polish. A 1440/1000/390 × English/Persian × light/dark audit captures Suppliers, Payables, Returns, Offers and the searchable picker: 60 genuine fictional-data captures, with no page overflow or page errors and zero search-field movement during filtering. Record names remain links in both themes and layouts. This is Chromium browser emulation; physical-phone/Safari execution is not claimed.

The shared record table reserves the width of quiet next-action facts as well as actual controls; this prevents the English Returns row from overflowing while retaining one record control. Filtered options stay at the top of the bounded 320px list instead of stretching one highlighted result over an empty panel.
