# R2c shared controls review

## 2.1 — Search product and supplier choices

Open Create offer → Product. The shared picker searches even a short product list; lists with more than eight choices always show search. Search an English or Persian name, product code or barcode, then use Up/Down and Enter to select. Matches are highlighted, and a match in an alternative name or barcode appears beneath the main name. Escape closes the list and retains the selected value. A search with no result says No matches.

The same public-field search metadata is supplied by invoice matching/add-line, supplier items, order item mapping, date dialogs, replacement returns, Received and Notes. Supplier choices search their name and available historical name aliases. The shelf date scanner keeps its existing exact-barcode, Enter-to-add and refocus behavior and shares matching highlights. Product and supplier options retain their existing permission/company/location filters; no costs, margins or invoice identities are added to search metadata.

Verification: 75 shared-control/helper/UI tests passed, including the existing Select, dialog and keyboard cases; TypeScript passed. No price, quantity, financial or authority behavior changes.
