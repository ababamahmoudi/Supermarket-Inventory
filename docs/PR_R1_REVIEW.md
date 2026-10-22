# R1: invoice-reader imports and an empty store

Branch: `feat/prototype-r1-real-import`. This pull request stays open for Ali to test. C9 (#26) and S1 (#27) were merged first, in order, after all seven checks passed.

R1 imports existing readings into the normal invoice review, supplier/product approval and pricing workflows. It makes no AI calls. The source label identifies the kit and models; every original page remains available. Other charges affect the payable but never create products or receipts. Please check fields require a person to review them before posting. Settings → Data also provides the explicitly confirmed empty-store action, preserving settings and people.

## Run locally

Use Node.js 22.23.3 (the supported range is `>=22.22.2 <23`). Stop the existing preview with Ctrl+C before rebuilding. From a clean existing checkout:

```bash
cd ~/Supermarket-Inventory
git status --short
git fetch origin
git switch feat/prototype-r1-real-import
git pull --ff-only origin feat/prototype-r1-real-import
cd prototype
npm ci
npm run build
npm run preview
```

If `git status --short` lists files, preserve your local work before switching. Open `http://localhost:5174`, or the displayed Network address from another device on the same network. Each browser/address has separate local data. Keep the terminal open; restart preview after every rebuild.

## Test with your private export

1. Use the browser/profile where you want to test. Sign in as Owner or Manager. A fresh fictional demo accepts `manager` / `demo1234`, followed by **Use simulated passkey**; existing changed passwords stay changed.
2. Open **Settings → Data → Remove fictional data…**. Read the keep/remove confirmation, then press **Remove fictional data**. Settings, locations, people, pricing categories/rules and label templates remain. Visit Dashboard and the empty lists; repeat at phone width and in Persian.
3. Back in **Settings → Data → Choose file…**, choose your private `super-arzon-readings-<date>.json` from the invoice-reader kit's `exports` folder on your computer. Do not copy it into the repository or send it to chat. Wait for **Reading file…** and the preview.
4. Keep **AI reading, with what to check highlighted**, or choose **My checked values**. Check the suppliers, invoice numbers, dates, totals, Checked by you badges and check counts. Rows without checked values explain that they still use AI. Already in the app rows are disabled. Check each suggested location; explicitly choose one where needed, especially with **All my locations** selected.
5. Press **Import N invoices**. Read the imported/skipped/new-supplier summary, then **Open Needs review** and open an imported draft.
6. Inspect the source label, header and boxed warnings/handwriting. Open the original and use **Previous/Next** on multi-page invoices. Compare the Please check fields with the photos; edit a value or press **Looks right**. Confirming a line with remaining highlights asks before clearing them all.
7. Complete the normal supplier-review fields and confirmation. Match products or enter each new product's pricing category. Confirm received quantities and any offered expiry dates. Persian names that were not entered say **Not added**. Review **Other charges and credits** separately and resolve any printed-total differences.
8. Use **What's missing** to open remaining checks. When review is complete, post the invoice through the normal confirmation. Verify its payable includes charges/credits and that products, received records and normal pending price/product approvals contain item lines only. Review and decide those approvals as usual.
9. Import the same export again: the preview should disable duplicates and the summary explain the skips. Try **My checked values** with another fictional/private export to compare the review flags.
10. **Demo → Reset demo** warns **This also removes invoices you imported.** Confirm only when you want the full fictional demo and demo people restored.

## Automated checks

From `prototype/`:

```bash
npm run lint
npm test
npm run build
npm run e2e -- tests/invoice-readings-r1.spec.ts --project=desktop --project=phone
```

The supplied fictional export and `tests/fixtures/r1-fictional-readings-export.json` are safe test inputs. The second contains a two-page fictional invoice with weighed goods, a deposit, discount and Persian expiry, plus a duplicate of the supplied fictional sample. The pull request's live Checks provide the final complete CI result. Focused validation covers parsing/mappings/checked arithmetic, permissions, supplier/product matches, duplicates/locations/dates, page storage, stable check fields, posting/charges/payables, empty-store preservation and bilingual empty screens. Existing invoice/receiving browser cases retain their assertions and add the now-required confirm-all step. This guide does not claim physical Safari, phone or printer testing.
