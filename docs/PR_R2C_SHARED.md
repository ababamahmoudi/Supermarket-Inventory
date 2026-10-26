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
