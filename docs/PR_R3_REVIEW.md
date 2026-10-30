# R3 — Live invoice reader review

Work stays on `feat/prototype-r2-receiving`, [PR #29](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/29), after the verified R2e/R2f head `b55ec10`. No merge, force-push, deployment, new provider integration or key field is part of R3. The app calls Ali's existing local reader kit; automated verification uses intercepted endpoints and fictional media only.

## What changed

| Item | Result                                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1   | Settings → Receiving → AI reading has Simulated/Live, editable Reader address, Reset, Test connection and Save changes. Simulated is the default. Only Owner/Manager can change the shared setting.                                                                                |
| L2   | Multiple ordered photos or one PDF become a saved Processing draft with unchanged raw originals before preparation/network. Live results fill that same draft through the existing AI-mode importer. Cancel, failure and reload preserve the original and offer explicit recovery. |
| L3   | The Demo menu's checked Simulated reading item changes the same protected setting. One press sends one images-only request. No provider key, cookie, app record or automatic retry/fallback is added.                                                                              |
| L4   | Fictional unit/browser coverage checks preparation, deadlines, genuine authority, shared-importer identity/money, raw bytes, failure choices, recovery, duplicates and privacy. Existing simulated/JSON tests remain in the required suite.                                        |
| L5   | Requirements, workflows, data model, prototype Step 0.3, decisions and deferred schema questions reflect R3. The request limit is four minutes. Schema v3 waits until after the demo.                                                                                              |

## Start on Mac or Ubuntu

Use Node 22.22.2 or a later Node 22 release for the app.

1. Open a terminal in the existing **invoice-reader kit's folder** and run its documented command:

   ```bash
   npm run serve
   ```

   Leave that terminal running. Its keys stay in the kit's `keys.env`; do not copy them into this app.

2. Open another terminal in the supermarket app's repository, on the Mac or the Ubuntu computer where that checkout lives:

   ```bash
   git switch feat/prototype-r2-receiving
   git pull --ff-only
   cd prototype
   npm ci
   npm run build
   npm run preview
   ```

   On the computer running the app, open `http://localhost:5174`. From the Mac when the app runs on Ubuntu, open `http://<App-computer-LAN-IP>:5174` instead. Stop preview with Ctrl+C before rebuilding, then restart it after each build.

3. Sign in with `manager` / `demo1234`, complete the simulated passkey step and choose North York. Existing saved data is retained. Use a separate browser profile if you want a clean practice store.
4. Open **Settings → Receiving → AI reading**. Choose **Live** under Reading mode. Without a saved custom address, Reader address is exactly `http://localhost:5191`. Localhost means the device displaying the app. If the reader runs on another computer, enter that reader computer's reachable LAN address, for example `http://<Reader-computer-LAN-IP>:5191`.
5. Press **Test connection**. A successful health response says **Connected · reader ready**. Press **Save changes** to apply the mode/address; that action appears when you change a setting. Reset restores `http://localhost:5191`; save that choice as well.

## Read a photo invoice

1. Open **Invoices → New invoice → Photo (AI reading)** at the desired concrete location.
2. Choose the photos for one invoice. On a phone, **Take photo** uses its camera picker. The raw files are saved before a reading can start.
3. Inspect the saved page list. Use its Up/Down actions to put pages in order, then press **Read invoice**. Reordering changes the retained viewer order and the sent image order together.
4. Watch Preparing pages, then Reading the invoice and the elapsed timer. The kit usually takes 1–2 minutes and can take longer. Product matching and price calculation run locally after the response. Cancel remains available.
5. Success opens the ordinary review with the actual reading and confidence checks. Inspect supplier/number, lines, quantities, packs, four-place costs, weights, totals and dates. Nothing posts automatically.
6. Under Invoice details, Owner/Manager sees the actual reader seconds, fee explicitly in USD and returned model names. Other roles' protected read models omit that expenditure/model provenance.
7. Open the original and download it. The file remains the exact original, rather than the downscaled JPEG sent to the reader.

## Read a PDF invoice

Choose **Invoices → New invoice → PDF (AI reading)** and select one PDF. Save/read/review follows the same path. Each page is rendered with the existing PDF library at about 200 dpi, JPEG quality 0.85 and at most 2400 px on its long side. More than ten pages gives a clear message and keeps the raw PDF. The original viewer/download continues to use the unchanged PDF and can show its actual pages.

## Rehearse recovery

- **Reader off:** stop the kit terminal, start a reading and inspect “The AI reading didn't finish. Your original is saved.” Try again makes one new request only after you press it. Restart the kit before retrying.
- **Enter by hand:** opens manual review on this saved invoice, keeping its identity and original. A permitted uploader can use this narrow recovery path; ordinary New manual invoice permissions are unchanged.
- **Use simulated reading:** available in demo builds only. It is an explicit per-invoice fallback, does not secretly change the shared Live setting and keeps a local **Simulated reading** label after reload. Its fictional lines must not be mistaken for a successful live extraction.
- **Cancel:** cancel an active read, reopen the draft and verify that the original is still there.
- **Reload:** reload while the request is pending. The interrupted request cannot resume; use **Read again** or **Enter by hand**. Page ordering is unavailable during interrupted Processing; ready/failed/cancelled drafts allow it. There is no automatic simulated completion or endless spinner. A fresh sign-in can recover the same saved draft without accepting a late result from the old session.
- **Duplicate:** read a second source with a supplier/invoice number already retained in the app. The existing duplicate message blocks the reading import and keeps the Processing draft. Only the verified target excludes itself from duplicate matching.
- **Quick demo switch:** open Demo (on a phone, inside More) and use the checked **Simulated reading** item. It changes the same company mode as Settings and preserves the reader address. An already accepted reading continues for its original saved invoice and captured reader settings; changing the current location, address or mode affects later readings. Current actor/session/authority and saved-source guards still reject stale or unauthorized results.

The four-minute limit includes preparation and the live request. A failed or cancelled request never posts, retries itself or silently substitutes fictional values. A usable `checksPassed: false` response still enters normal human review; an unusable/incomplete result offers recovery.

## Try from a phone on the same Wi-Fi

1. Keep the kit running on the Mac and the app preview running on its computer.
2. Find the current local-network address of the computer running the app and open `http://<App-computer-LAN-IP>:5174` on the phone. This is the Mac's address when the app runs there, or the Ubuntu computer's address when it runs there.
3. Sign in and choose the location. Reader address must point to `http://<Mac-LAN-IP>:5191`. The default is already correct when the app also runs on that Mac; otherwise change it. This prototype stores data/settings per browser, so repeat the Live setting on the phone.
4. Test connection, save Live mode and repeat one camera/photo read, one PDF read and a failure/cancel/reload case.

If the app is served from another computer, set Reader address to the **Mac's** reachable address, since that is where the kit runs. `localhost` on the phone refers to the phone itself.

## What the kit may need

This PR does not change or assume the kit's code. Its existing server must:

- Answer GET `/health` and POST `/api/v1/invoice-readings` at the configured address, with the documented `reading`, `statuses`, `checksPassed`, `models`, `costUSD` and `seconds` response.
- Be reachable at the Mac's network address for phone use. If it currently listens only on localhost, use the kit's own documented configuration to permit the needed network interface and check the Mac firewall.
- Allow each actual **app origin**, including protocol and port, through CORS. `http://localhost:5174` and `http://<App-computer-LAN-IP>:5174` are different origins. When the app runs on Ubuntu, allow that Ubuntu page origin. Permit the content-type preflight and GET/POST methods. The app sends no credentials or key header.

The browser may not reveal whether a failed fetch was an unreachable server or CORS. The app therefore gives honest combined guidance instead of claiming a diagnosis it cannot prove. Keep API keys in the kit only. Real-invoice rehearsal remains on Ali's devices; no real invoice or kit working folder is included in this repository.

## Executed verification

The final task report and PR description identify the exact checked commit and its complete seven-check CI result. Executed verification includes:

- 262 unit-test files / 2,566 current tests in CI. Local final manual-recovery verification also passed 68 targeted tests, including the added receiving-location regression and all 11 existing origin cases.
- All 75 SDK tests across six files.
- Foundation/service checks: 57 Python tests, five frontend tests, three browser smoke cases, authenticated local file-store checks and zero runtime dependency vulnerabilities.
- All 38 new live-reader browser cases: 19 desktop and 19 phone, with no skips, failures, flakes or retries. After the final receiving-location change, both desktop/phone instances of the extended manual-recovery case passed again.
- Four actual Settings visual variants: English/light and Persian/dark, each at 1440 and 390 px. Their 16 retained screenshots and geometry checks cover connection feedback, address wrapping, checked-menu focus and card alignment.
- Production build, TypeScript, ESLint and formatting. All media in these proofs are fictional; HTTP responses are intercepted.

The component proofs also include:

- Image preparation: 19 unit cases and actual Chromium/PDF-worker rendering of ordered photos/two PDF pages, decoded JPEG dimensions/colors, white transparency, ten-page guard, abort and unchanged original hashes.
- HTTP/envelope: the four-minute deadline, cancellation/body hangs/late response, images-only request, no credentials, Decimal response metadata and normalization through the existing parser; unchanged JSON-import regressions remain included.
- Settings: dynamic localhost/network/IPv6 addresses, reset/custom/malformed saved values, five-second health outcomes, genuine Owner/Manager authority, Provider/UI persistence and checked-menu keyboard handling.
- Core/flow: verified same-target identity/originals, self-only duplicate exclusion, stale attempt/actor/source guards, ordinary manual authority plus narrow recovery, public simulated provenance, actual DTO/History privacy and whole-flow deadline/cancellation.

The complete current suite runs again in CI on the final pushed commit. The real kit and a physical phone still need Ali's rehearsal; intercepted responses and a phone-sized browser do not verify those devices.
