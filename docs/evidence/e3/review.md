# E3 phone and installable demo review

These screenshots capture commit `90ad0f5a1bb67fbc4b56653dbdc911707c57c98d`. All 13 E3 Chromium cases ran with zero failures, skips, retries or flaky cases. The runner used an exact Git archive and the actual built assets. Frozen source and all 61 served output files stayed unchanged before and after the run.

Every exact PNG byte stream was individually opened: 18 changed captures from this commit were freshly reviewed; 61 passing images reused the earlier 715b8dc review after exact scene-name and SHA256 checks of both original and new files. Both previously failed Persian Received images were freshly opened and passed. This reuse concerns image bytes; it does not claim identical source across the two commits.

Phone lists retain row navigation, Labels checkboxes, permitted columns and role-specific privacy. Returns status sits in its end/value column; “24 cm” stays whole. Genuine active Undo messages have reserved space above checklist and dialog actions. Popup captures wait for the actual entrance animation to finish. Persian case and loose-unit groups pair every number with its translated label in the correct RTL order; final browser checks measure the real 7 cases + 2 units and 3 cases + 4 units examples. The Labels column holds its 44 px checkbox touch target.


For exact Ubuntu installation/start/stop commands, errors and private HTTPS/Home Screen instructions, read [phone-demo-hosting.md](../../phone-demo-hosting.md). Docker and make setup are not needed for this browser prototype.

1. Open the running demo and sign in as the fresh fictional manager using manager / demo1234, then follow the explicitly simulated second step. Existing edited passwords are retained; do not reset a used demo merely to replace them.
2. Narrow the browser, or open browser developer tools responsive mode at 390 px and 430 px. Open Products, Labels, Received, Suppliers, Payables and Dashboard. Names/translations begin each compact row, the key amount/status sits at its end, and a single chevron opens the genuine record. In Labels, ticking the checkbox selects the product and keeps the list open.
3. Switch EN/فا and light/dark from the normal shell controls (remaining phone controls are in More). Inspect whole prices, “24 cm” product names, dates and RTL order. Open the location pill and notification bell; the settled popovers remain opaque and bounded.
4. In Demo switch to ny-floor, then Suppliers. Supplier money columns must be absent. Switch back to manager for Payables and task/price workflows. Each switch uses the app's ordinary authorized demo control.
5. Open Settings → People. Open Add person, cancel it, then Edit a person to inspect custom role/location controls and the reason field. No real invitation message is sent by this prototype.
6. Open a genuine pending price update after the normal price workflow. While its actual Undo message is active, the register/label/waiver/Done controls must remain uncovered. Change sale should keep the actual Undo message above Cancel/Start sale. Do not mark real physical work complete just for a screenshot.
7. For actual installation/offline/update checks, use the protected HTTPS steps in the hosting guide. Update app stays inside Demo and waits for genuine dirty editors, pending commands/files/system work/printing and every open tab. Close or finish real work before explicitly updating. HTTP Wi-Fi is insufficient for service-worker/home-screen verification.

The additional dark phone PNG is an ordinary actual Chromium browser view, standaloneDisplayMode:false. A physical phone/home-screen installation, Safari/hardware, accounts, deployment/provider resources and shared-server synchronization were NOT PERFORMED. Each browser still keeps separate fictional demo data. The offline screen is an honest No connection availability page and never a fabricated signed-in business page.

[All 79 screenshots](../../redesign-screenshots/pr-e3/README.md) · [Source/build/native guards](committed-native-verification.json) · [Per-image manual review](committed-manual-review-all79.json) · [Earlier failed visual findings](diagnostic-review.md).
