# C9 review

C9 corrects the loading flash, decided sale requests, sale/regular-price interaction, Notes engagement, selling-price display, filter bars and Branch request presentation. It keeps the existing fictional data, pricing rules, permissions, documents and financial/physical evidence. C9 stays unmerged for owner review; use its live GitHub Checks for the final exact-head CI status. [Current expectation-alignment results and the separately approved phone invoice-code wrapping fix](evidence/c9/test-alignment/README.md) supersede the earlier pending-CI status; no green result is claimed for the new edits until every exact-head check passes.

Branch: `feat/prototype-c9`, created from main `d1fcb4ffdf55e4bb33792aa2564790dbac473e0b` after the approved feature merges. Settings is deferred except removing Notes; notebook management lives on Notes. No later feature PR or hosting deployment is part of C9.

## Latest completed CI and diagnostic handoff

All four browser shards finished at `ac10919fde0e63325fbd3e68d4b2570a51120fb7`: shards 1, 2 and 3 passed; shard 4 failed only the new WebKit case before the no-reload actions, while initial sign-in reported “Browser storage could not be read or updated.” Across the four shards: **789 passed, one flaky, 50 existing skips and one failed**. Foundation and prototype lint/unit/pricing/build passed; **Prototype browsers failed**. [Complete run](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/39275383400), [original assessment and diagnostic packet](evidence/c9/webkit-startup/README.md).

Ali approved fixing WebKit startup while keeping existing data and authentication rules. That diagnostic iteration only improves the new WebKit test's bounded exception diagnostics and waits for the genuine Sign-in view before the existing 1080p measurement. Synthetic native Promise/IndexedDB controls and local 1080p before/after checks do not prove a WebKit fix or LAN success. New exact-head CI is pending. C9 remains unmerged for Ali to test.

A subsequent portable startup-date repair is prepared: reuse the existing ISO company-date assembler while retaining the original Date/day-offset behavior and stored-data/authentication rules. Controlled localized slash dates make the original source fail seven of eight new regressions; the repair passes8/8. This does not confirm native WebKit's root cause. Both full local application runs remain mixed (first1,513pass/3fail, actual exit1; second reported1,512pass/4fail and one unhandled rejection, process status unavailable after transport loss). Unchanged focused reruns11/11 and27/27, separate SDK75/75, pricing68/68 including all23 seed cases, build and lint passed. [Original results, exact source and limits](evidence/c9/webkit-startup/date-format/README.md). Lagged GitHub statuses had misleadingly reported f371 queued; detailed test-step timestamps later showed shards1/2/3 succeeded and4failed. New exact-head checks must still pass; C9 stays unmerged.

## Completed merge prerequisite

[CI PR25](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/25) changed only the workflow. It keeps foundation unchanged and all job limits at 30 minutes. Prototype lint/unit/pricing/build is separate; four independent Playwright shards install/build/start and upload uniquely named failure reports; final **Prototype browsers** requires all four. Existing tests, assertions, workers, retries and skips were unchanged by that PR.

Main was merged into the four feature branches without rebasing. All seven checks and the newest CI run passed on each integrated head before C8 [PR21](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/21), E1 [PR22](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/22), E2 [PR23](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/23) and E3 [PR24](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/24) merged, in that order, preserving their histories. [Exact check URLs, source heads and merge parents](evidence/ci-shards-2026-10-19/merge-and-check-results.json).

## Run it on Ubuntu

For a fresh computer, follow [the detailed Git/Node installation steps](../prototype/README.md#fresh-ubuntu-desktop) first. You need Git and Node 22.23.3, not Docker or `make setup`.

1. Stop the old demo server with **Ctrl+C** in its terminal.
2. Open Terminal with **Ctrl+Alt+T** and run:

```bash
cd ~/Supermarket-Inventory
git status --short
```

No output means no changed files. If files are listed, keep them and stop before switching; do not reset or delete them. With a clean copy:

```bash
git fetch origin
git switch feat/prototype-c9
git pull --ff-only origin feat/prototype-c9
git branch --show-current
cd prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.23.3
npm ci
npm run build
npm run preview
```

Expect `feat/prototype-c9`, a completed install/build and **Local** and **Network** addresses on port **5174**. Leave the terminal open. Inside Ubuntu open **http://localhost:5174**. On your Mac/phone open Ubuntu’s actual **Network** address, for example your existing **http://172.16.66.128:5174** if that VM address is still current. If a command fails, keep its complete error and stop there. Port busy means stop the old server you started; do not kill unrelated processes.

3. Fresh/reset fictional accounts use **manager / demo1234**, then **Use simulated passkey**. A changed saved password remains changed. To test without disturbing saved records, use a separate browser profile. **Demo → Reset demo** explicitly clears that browser’s fictional business/People changes, as its confirmation explains.

## Click-by-click C9 checks

1. **Loading/theme:** choose dark theme. Use the sidebar, change a list filter and a tab, then Demo-switch Cashier → Manager. The app must not flash white or briefly display sign-in. Slow work may show only a thin bar under the top bar after 300 ms. Reload while dark; sign-in/lock/loading should also follow the saved theme.
2. **Sale decisions:** switch to the North York Floor Worker in Demo, choose North York, open Sunflower Oil and request a lower sale. Switch back to Manager, open Approvals, reject that request with a reason, then open Rejected. It must remain there with who/when/reason and no decision buttons. Repeat with another request and approve it; Approved must retain the approved amount/dates. Superseded contains actual expired/withdrawn requests; each tab has a count and relevant empty message.
3. **Regular price during a sale:** as Manager, open a product with a running sale → Change sale → New regular price. A price above the sale becomes the after-sale amount. At/below the sale, the explanation must offer **End the sale now** by default or **Change the sale price**. Confirm the chosen action and any genuine margin/reason validation. Lookup must never show a Sale comparison with equal current/regular prices.
4. **Prices:** open Products, that product, Lookup, Labels, Offers and Price updates. A genuine lower sale shows struck regular before bold current on one line. Weight units use separate aligned lines. Offers occupy their own column; approval status stays separate. Lookup uses the large price; Labels columns remain spaced. Read-only product unit costs show cents without changing stored inputs.
5. **Notes:** open For managers → a note → Mark as seen. It becomes Seen by you, with who/when below. Demo-switch to another reader and mark the same note; both receipts remain. Try Undo, Mark done/Mark ordered, Reopen and Undo. Reopening an order-linked note makes its note task open again while retaining the Order and its physical evidence. Use Open/Done/All and Not seen by me. Add/edit/archive a notebook, enable Show archived notebooks and restore it; Settings has no Notes destination.
6. **Filters:** visit Price updates, Date tracking, Products, Labels, Received, Returns, Suppliers, Orders, Payables, Offers, Branch requests and History. Filters sit inside the list card, align consistently and wrap without overlap. Clear filters appears only after a change. Product/Label boolean filters are clickable chips. Check Persian and a narrow browser window; count and Columns remain at the end.
7. **Branch requests:** open its list; each request has reference/items, route, status, date and one end arrow. New request has Ask this location and Deliver to beside each other, one Items section and one catalog/free-text input. Add a product and a non-catalog item; retained quantity/unit/pack requirements still apply. Cancel, Save as draft and Send request sit in the footer. Sending retains the original source/destination meaning.

## Device-access documentation corrections included

- Removed instructions overriding preview with `--host 127.0.0.1`; the existing preview already listens on `0.0.0.0:5174`.
- Explained Local versus Network addresses, same-Wi-Fi access, Ubuntu/host firewalls and bridged VM or NAT forwarding.
- Distinguished a local preview from an Internet HTTPS deployment and explained each browser/address has separate demo records.
- Updated the prototype README, prior combined review and [device-access guide](phone-demo-hosting.md). The optional private Cloudflare procedure remains owner-run; no account/resource/deployment was created.

## Tests, screenshots and comparison

[Open all40 screenshots next to their matching references, with every recorded difference](evidence/c9/COMPARISON.md). The set covers10scenes × English light, English dark, Persian light and390px phone. The capture exited0 with unchanged clean source882a381, zero browser/console/request errors, overflow and layout failures; all40 originals were manually reviewed. [Source-specific executed tests and earlier failures](evidence/c9/README.md).

Local results: full application1,504 +SDK75 at10d2667, later affected checks27/27 and15/15, final lint/build0, all61served production files matched. Original C8/C5 native58/58; separate price/Notes22passed2new duplicate-phone skips; final E2/Branch/C9 replay22passed2new duplicate-phone skips, no failures. Scopes overlap and are not summed. All23 seed pricing cases remain included. The new WebKit project runs only its one no-reload test; original Chromium desktop/phone projects and existing budgets remain. Local LAN access403prevents a local LAN/WebKit claim; require all four GitHub shards and **Prototype browsers** before treating CI as green.

The reference comparison uses genuine data and retained controls. In particular, historical requests have no frozen original regular price, so their cards omit “instead of” rather than inventing a comparison. Phone forms retain quantity/unit/pack/note controls, task-detail print confirmation and existing private cost rules. Settings remains deferred except removing Notes. No next feature PR has started.

Real Mac Safari, physical phone installation, printers/registers and hosted Internet access are unverified unless actual evidence is later added. C9 does not add a backend, real AI, cross-device data synchronization or camera barcode decoding.
