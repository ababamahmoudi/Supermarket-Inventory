# R2 receiving review

[PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29), branch `feat/prototype-r2-receiving`, contains receiving, supplier profile and price approval changes. The receiving screens follow the [approved 2026-10-22 reference](design-reference/r2-receiving/README.md) and [thirteen design rules](design-language.md#r2-receiving-reference-and-stability-2026-10-22).

## Run locally

Use Node 22 (the prototype requires >=22.22.2 and <23). From your existing checkout:

```sh
git fetch origin
git switch feat/prototype-r2-receiving
git pull --ff-only origin feat/prototype-r2-receiving
cd prototype
npm ci
npm run build
npm run preview
```

Open the displayed Network address on port 5174 from a phone on the same Wi-Fi, or http://localhost:5174 on the computer. Restart preview after every rebuild so it serves the current file list. No production deployment is included.

## Test your private export

1. Sign in as Owner. Open Settings → Data → Remove fictional data…. Check the Keeps/Removes lists and the footer's 44px actions: bordered secondary first, filled red destructive last. The red action starts disabled; typing an incomplete word must not enable it. Type DELETE (or حذف in Persian), then confirm. Settings, people, locations, pricing rules and templates remain.
2. In Settings → Data choose your local invoice-reading export JSON. Keep that file, its invoice pictures and any screenshots on your own computer; do not add them to GitHub.
3. Inspect the AI reading/My checked values choice. If the checked file omitted or reordered line rows, choose AI reading and compare every line with the paper; leave it in Needs review until that comparison is complete rather than posting. Check the full location names and fully visible Status column. If two copies of the same supplier/invoice number appear, check that both say Same invoice twice in this file and only one can be selected. Switch the copy if desired, then Import.
4. Check the completion dialog: four stat tiles, any skipped invoice's plain reason, and Close/Open Needs review. Use Show all locations when some imports went to another location, then open an invoice from Needs review. Check the queue counts and invoice/supplier links.
5. At **1440px wide**, show the original on the right. The line table fits without sideways scrolling; the first status icon is visible. Its five columns are status/number, Product, Quantity, Unit cost and Line total. Check category/new-product/check details under the product name, two-line quantity and any red short-delivery line. Try All, Needs attention and Confirmed.
6. Open a line. Its header becomes accent-tinted and the attached editor stays white after clicking an empty area inside it. Product and Quantity and cost headings are distinct from labels. Check level input boxes, including amber fields. Hover or focus an amber !: the tooltip sits above it without covering the value; moving the pointer toward the tooltip must not flicker it.
7. Check the name/category, quantity, delivered quantity and four-decimal source cost, including kg/lb where relevant. Track dates defaults to No unless the product tracks dates; Yes reveals the date. Taxable, Track dates and Selling price share the bottom row. A visible English-name/description question leaves More details closed; only highlighted hidden barcode, lot, printed expiry or note evidence opens it automatically. Open it yourself to inspect the retained printed description and other evidence. Change the name, category and Yes/No: the controls stay in place.
8. Report short or refused if applicable and compare delivered quantity/deduction with the paper. Press the primary Confirm line button: the editor closes, its row stays in place and the next line remains closed. The confirmed row becomes green with a filled check. Reopen and change it; only that line needs reconfirmation.
9. Resize to about **1000px wide**. The original moves above the work at 320px with Expand. Its toolbar remains one row; when the toolbar itself is narrower than 340px, use More → Rotate rather than a separate Rotate control. The five-column table still fits without sideways scrolling. Details boxes do not touch or overlap. Received is one read-only summary: click Change to inspect or correct date/time/receiver in its popover, then close the popover. Use the details Looks right once after checking the card.
10. Inspect Totals below the lines: read-only aligned label/amount rows and an amber Calculated · not on the paper tag where an amount was derived. Click Edit to expose the real 44px inputs when a correction is needed; actual non-calculated questions or invalid amounts after a posting attempt expose them automatically. Compare with the paper, correct only what is needed and press the whole-card Looks right. Use Post invoice/What's missing links for unresolved checks, then post. Supplier contact details must not prevent posting.
11. At **390px wide**, check no sideways page scroll. View original opens a full-screen viewer with page arrows/zoom; Rotate remains available through More when the toolbar is compact. Invoice details starts compact; its Expand invoice details chevron opens it. A missing-field Show action or Next to check also opens it automatically when a header field needs review. Lines are cards with case conversion or source weight and four-decimal unit cost. Opening a line shows a full-screen sheet with a full-width Confirm line above two equal secondary actions, visible without scrolling; the receiving page's sticky bottom bar has equal Next to check/Post invoice columns. In the sheet, select Track dates Yes, scroll to its control and select No: it stays in place as the date fields close. Further wheel/touch scrolling remains available, and close/navigation releases the reserved space.
12. Switch to **Persian and dark theme** and repeat the open-editor check. Visible labels are translated; amounts and codes read left-to-right and amount columns align. Confirm line remains visible on the phone. Collapse the desktop sidebar, hover/focus an item and wait briefly: its label appears above the page. Expand the sidebar and check that tooltip is absent.
13. Open Approvals. Find this invoice's group; choose Approve all…, review categories/costs/prices/margins and untick one product before confirming. Only selected requests are approved, counts update without flashing and the page stays in place. Try Change category, then Reject → Fix and resubmit; check its linked pending request and History.
14. Open a product → Deliveries, then its date/invoice link. The invoice opens at that line with a brief soft highlight. Repeat from Received.
15. Open Suppliers. A new supplier says Active or Profile incomplete. Complete its optional details in Edit supplier; the profile notification clears. A correct full supplier name saves unchanged even beside an unrelated name containing Foods Inc.

## Verification

The PR's current GitHub checks are the final CI result. Local verification and any execution limits are recorded in its description and the task response. Real-file testing is performed on your computer; only invented fixtures are committed.
