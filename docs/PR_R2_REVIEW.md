# R2 receiving review

R1 #28 was merged after its seven successful CI checks at `537ab7a816724442bdd327f5452c1e8f15aefa2b`, with merge commit `3d0aaaa3b4bf3eb73da136f385a45d07cf1605c3`. R2 is `feat/prototype-r2-receiving`, one pull request for the compact receiving, supplier profile and price approval changes.

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

1. Sign in as Owner. Open Settings → Data → Remove fictional data…. Type DELETE (or حذف in Persian), then confirm. This keeps settings, people, locations, pricing rules and templates.
2. In Settings → Data choose `super-arzon-readings-2026-10-18.json` from your own computer. The private export and its invoice pictures stay outside the public repository.
3. Choose AI reading or My checked values. Check the full location names. If two copies of the same supplier/invoice number appear, check that both say Same invoice twice in this file and that only one can be selected. Switch the copy if desired, then Import.
4. Open Invoices → Needs review. Check the counts, invoice/supplier links and compact progress. Use Show all locations if some imported invoices went to a different location. Open an invoice.
5. Check its header, invoice details and original. On desktop hide/show the original; on a phone use View original and page arrows/zoom. Check the invoice details once with Looks right. Optional blank lot, expiry and barcode must not be highlighted.
6. Open one line. Check the English name/category, quantity, delivered quantity and four-decimal unit cost. Track date should already be No except on a product that tracks dates. If Yes, supply its date. More details contains printed evidence. Change the name, category and Yes/No: the controls should stay in place.
7. Report short or refused if applicable and compare the displayed delivered quantity and deduction with the paper. Confirm line: its editor closes, the row stays in place and the next line remains closed. Repeat for the other lines. Reopen and change one confirmed line; only that line should need reconfirmation.
8. Inspect Totals below the lines. A missing subtotal/total should be calculated and labeled for comparison. Check the paper and press the Totals Looks right. Use the Post invoice tooltip/What's missing links for unresolved checks, then Post invoice. Supplier contact details must not prevent posting.
9. Open Approvals. Find the group for this invoice; choose Approve all…, review categories/costs/prices/margins and untick one product before confirming. Check that only the selected requests are approved, counts update without flashing and scroll stays. Try Change category on a pending request. Reject one request, then Fix and resubmit with the correct category; check its linked pending request and History.
10. Open a product → Deliveries, then its date/invoice link. The invoice should open at that line with a brief soft highlight. Repeat from Received.
11. Open Suppliers. A new supplier should say Active or Profile incomplete. Open its page, Edit supplier, and complete the optional details; the profile notification should clear. A correct full supplier name must save unchanged even next to an unrelated name containing Foods Inc.
12. Switch to Persian and repeat the main receiving steps, then check a narrow phone layout and dark theme.

## Verification

The PR's current GitHub checks are the final CI result. Local verification and any execution limits are recorded in its description and the task response. Real-file testing is performed on your computer; only invented fixtures are committed.
