# Pull request C7 — Klead visual retouch

Combined review branch: **`feat/prototype-c7-klead-retouch`**. It includes C6's functional fixes from **`feat/prototype-c6-functional-fixes`**; C7 stacks on C6, whose latest base when this guide was prepared is `dfce23f`. Review the two pull requests together. Neither is merged automatically, and main is not the branch to use for this review.

**Final evidence is PENDING.** The final C7 source commit, complete unit and browser results, pricing results, token/contrast audits, all 85 screenshots, individual visual comparisons and latest-head GitHub checks must be inserted after their actual runs. Focused development checks and earlier C6 screenshots do not establish final C7 completion.

## 1. What changed

C7 applies the owner's [Klead design language](design-language.md) and [five unchanged retouch images](design-references/c6-c7-owner-reference-manifest.json) to the existing prototype. The standalone [light/dark tokens](../prototype/src/klead-tokens.css) define screen colours, type, radii and shadows; company branding remains separate. English and numbers use bundled Manrope, Persian uses Vazirmatn, and monetary values retain tabular figures.

- Filled fields, five semantic button treatments, rounded choices, quiet status dots in tables and tinted pills in cards/headers. Resting controls have no glow; keyboard focus remains visible.
- Grouped sidebar, responsive top bar, one phone account control and reachable search/language/theme/text-size/Demo actions. Detail rows gain labelled chevrons and keyboard navigation; lower-priority allowed facts remain available through Columns and expanded details.
- Calm lists with inset dividers, shared dialog footers, existing-record captions and clearer grouped pickup/resolution/date forms. The Supervisor dashboard retains its approved section layout and exactly four solid blue/ink summary cards.
- Lookup retains read-only local dates and actual clearance evidence, with the retouched search/category chips, large price and quiet date/last-received rows. Labels, Orders, Payables, Settings and the other existing screens use the same shared controls.

This PR changes presentation. The pricing engine, company/branch isolation, role permissions, confirmed financial amounts, allocations, signed pickup coverage, immutable history, storage originals and existing workflows remain the C6 behavior. Supplier return memos and supplier orders retain their configured English-default documents; internal picking lists remain bilingual. Physical A4/label dimensions, print components and print-specific styles are preserved. Actual automated preservation evidence belongs in the ledger below, rather than being inferred from a screenshot.

The references supply style, not copied names, chart values, people or branding. The app continues to use its configured company logo and fictional demo records. One documented contrast adjustment slightly darkens the reference green text to meet 4.5:1; the [design document](design-language.md) records the measured reason. Dark Primary still needs the owner's choice described in section 4.

## 2. How to run and test it

For a fresh Ubuntu Desktop VM or Mac, follow the [detailed installation instructions](../prototype/README.md). They install Git and supported Node **22.22.2**, then build and start the browser prototype. Docker is not required. Open the app in a browser on the same computer as the terminal.

If you already installed those tools and downloaded the repository, stop the old server with **Ctrl+C**, then run this in Terminal:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-c7-klead-retouch
git pull --ff-only origin feat/prototype-c7-klead-retouch
git branch --show-current
cd prototype
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.2
npm ci
npm run build
npm run preview
```

Expect `feat/prototype-c7-klead-retouch`, Node `v22.22.2`, a successful build and a preview URL on **5174**. Leave this terminal open; open **http://localhost:5174** in Firefox/Chrome inside Ubuntu Desktop, or Safari/Chrome on your Mac. If a command fails, stop at that command and preserve its first error. The README explains missing tools, existing folders, stale pages and occupied ports. Do not reset/delete an existing checkout or clear browser data to get past an error.

### Begin with a fresh fictional demonstration

1. Sign in with **Username `supervisor`**, **Password `demo1234`**. Use your changed demo password if you already changed it in this browser. The other accounts are `floorworker`/`demo1234`, `cashier`/`demo1234` and first-sign-in `newemployee`/`temp1234`.
2. If you want to replace earlier fictional edits, open **Demo → Reset demo**, read the confirmation, then confirm. It replaces demo business edits while retaining passwords/preferences. This is optional; use a separate browser profile if you want to keep your current demonstration.
3. Select **North York** from the location pill. Begin in **English light theme**. Use the target-language **فا** button for Persian and **EN** to return; the sun/moon control changes theme. On phones those presentation controls are in **More**.
4. Repeat the relevant views in English dark, Persian, about **900 px** wide and **390 px** phone width. Drag the window narrower for a quick check. For an exact width in Chrome, open developer tools (**Ctrl+Shift+I** on Ubuntu, **Option+Command+I** on Mac), click its phone/tablet toolbar icon, select **Responsive**, and enter the width. Close developer tools to return to an ordinary window. This is optional; the final automated evidence must separately check all eight required widths in both languages.

### The 17 required screenshot scenes

Each row states how to reach the real screen and what to inspect. Use the sidebar icon's hover/focus label at intermediate width; on a phone, open the sidebar with its top-bar button. These steps do not require a real supplier document or printer.

| Scene                            | Click path and expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Top bar                       | Open **Dashboard**. At 900 px the breadcrumb shows the current page and search is an icon that opens the search field. Location, language, theme, text size, bell and Demo stay reachable. The sidebar never scrolls independently; only one account control is shown.                                                                                                                                                                                                                                                                                                                                                           |
| 2. Lookup with dates/clearance   | Click **Lookup**, enter `0003`, then press **Enter**. Dates are read-only; Last received includes its actual source. To create the captured clearance state, use the fictional dated-receipt setup below, then **Products → Sour Cherry Juice → its dated lot → Create clearance**; enter `2.49` and confirm. Return to Lookup at North York: the local clearance price, expiry and ordinary price/offer are separate. Other locations do not inherit that clearance.                                                                                                                                                            |
| 3. Date tracking                 | Click **Date tracking**. In Product search enter `0006`, choose Lavash Bread, open Date and choose **Today**. Open **More** to enter optional quantity `20`, lot `REVIEW-SHELF-06` and note `Shelf check`; click **Add**. The entry appears under **Due soon**. Inspect whole dates/names, compact actions, custom fields and the optional suffix.                                                                                                                                                                                                                                                                               |
| 4. Edit product/date group       | Click **Products**, search `0006`, open Lavash Bread and click **Edit**. Choose Date tracking **Yes** if needed. The same dialog immediately reveals reminder days, North York's dates and the inline date-entry fields. The date added in step 3 is present. **Cancel** saves nothing; **Save product** saves product/date edits together.                                                                                                                                                                                                                                                                                      |
| 5. Invoices list                 | Click **Invoices → Posted**. Whole invoice references and suppliers fit without overlapping; status is dot plus words. Click a row/chevron to open its actual invoice, then use Back. **Columns** still controls permitted facts; hidden values are available in expanded details.                                                                                                                                                                                                                                                                                                                                               |
| 6. Manual invoice/What's missing | Click **Invoices → New invoice → Manual entry**, select **Fresh Valley Foods**, enter a fictional invoice reference and click **Add line**. Click **Post invoice** before attaching an original or confirming the line/date decision. The amber **What's missing** box lists all real blockers. Click each link: its exact field scrolls into view, receives focus/highlight and has its matching red message. Fixing one field clears that field's issue. No Undo appears merely for typing/autosave.                                                                                                                           |
| 7. Products                      | Click **Products**. Names, translated fallback, prices, codes and compact row actions stay readable. Search by name/code; try **Columns**, hide an allowed optional field and **Reset columns**. English/Persian names and unit fragments remain intact. Edit is neutral; additional row actions are in More.                                                                                                                                                                                                                                                                                                                    |
| 8. Received/date range           | Click **Received → Date range → This month**. There is one control with **From** and **To**, plus **Today/This week/This month** choices. Invoice references open their actual records. Product units such as **400 g**, quantities, dates and money stay together; narrow tables omit lower-priority columns instead of squeezing text.                                                                                                                                                                                                                                                                                         |
| 9. Returns list                  | Click **Returns → Open**. Waiting for pickup uses blue; Waiting for credit uses amber. The reference, supplier, progress and next action stay separate. Click a row or its chevron, or focus the row and press **Enter**; it opens that return. **History** preserves closed/cancelled records.                                                                                                                                                                                                                                                                                                                                  |
| 10. Pickup with shortfall        | Start from a fresh demo; open **Returns → Return #1 → Record pickup**. For its quantity `3`, enter actual pickup `2`. Enter shortfall reason `Rep refused: not covered by the return policy`; choose **Keep for next pickup**. Enter representative `Fictional Representative` and signed-paper reference `REVIEW-PICKUP-01`. Inspect **Item photo (optional)** and **Note (optional)**. Leaving reason/outcome/evidence missing explains what is required; a successful save locks this pickup. A later kept remainder uses a new signed event.                                                                                 |
| 11. Partial resolution           | Use a separate fresh demo or reset your fictional edits. Record all `3` units from Return #1 with representative and a new signed-paper reference. Click **Record resolution → Outcome Replaced**, enter Original quantity covered `1`, Actual replacement quantity `1`, representative and receipt reference `REVIEW-REPLACEMENT-01`. Pick a remaining expected date from the calendar and record the resolution. Reopen it: picked up `3`, resolved `1`, still outstanding `2`; pickup quantities stay locked. The return remains Waiting for credit and no replacement purchase/confirmed-credit amount is added to Payables. |
| 12. Return memo                  | After a real demo pickup, click its **RM-0001** button. The supplier document defaults to English, including when the surrounding interface is Persian. Store/address/date, supplier, item code/quantity/cost/expected credit, total and driver/store-staff signature lines are separated. Unknown address remains blank/missing rather than invented. **Print** opens the system print dialog; cancel it or choose Save as PDF.                                                                                                                                                                                                 |
| 13. Payables ledger              | As Supervisor, click **Payables → Fresh Valley Foods**. Inspect exactly four summary cards, whole amounts/dates and **Columns in the Supplier ledger title**. Supplier rows also open by chevron/Enter. Open **Record external payment**, leave required fields blank and preview allocations: linked missing-field messages appear; no payment posts. Cancel any later financial confirmation unless you intentionally want fictional money changes.                                                                                                                                                                            |
| 14. Supplier cards               | Click **Suppliers → Fresh Valley Foods**. **Last delivery** opens its invoice; **Deliveries this month** opens this supplier's filtered Invoices list; **Open returns** opens its scoped open Returns. **Balance** is static. Repeat as Floor Worker: supplier money/margins/Payables are absent, including Columns and expanded details.                                                                                                                                                                                                                                                                                        |
| 15. Dashboard                    | As Supervisor, click **Dashboard**. Exactly four blue/ink summary cards are followed by the existing approval queue/alerts, recent invoices/returns, supplier balances, purchase charts, arrivals/price changes, notes and activity in the approved layout. Values come from demo records; the references' chart values are not copied. Narrow layouts stack without losing facts/actions.                                                                                                                                                                                                                                       |
| 16. Approvals                    | Click **Approvals → Pending**. Existing cards retain old/new price, cost, margin, branch/source and Approve/Reject. Inspect rounded tabs, readable captions and consistent status tones. In this review you can inspect without approving anything; if you act, use only fictional records.                                                                                                                                                                                                                                                                                                                                      |
| 17. Settings                     | Click **Settings → Returns/date tracking/labels**. Inspect default reminder `30`, separate **Return memo language** and **Printed supplier order language**, and the existing Label waitlist/Templates controls. English-only supplier documents are separate from internal bilingual labels. Missing required Save data shows linked validation. Geometry dimensions remain the stored physical values.                                                                                                                                                                                                                         |

To make the Lookup clearance scene through real UI, use **New invoice** and the included fictional original `prototype/public/demo-originals/fictional-fv-20417.png`. Browse to that file in your downloaded repository; simulated reading opens its six lines. Set Invoice date to the document's `2026-10-09`. For Sour Cherry Juice choose **Short-dated (expiry discount)** and a date about five days from today; choose **No** for date tracking on the other lines and confirm each line. Click **Post invoice**, inspect the confirmation, then confirm this fictional posting. Its dated lot then appears on the product page. This setup deliberately adds a demo receipt; reset only if you want to discard your fictional edits afterward.

### Additional presentation checks

- **Labels:** Products tab → select a permitted product → tinted **Add to waitlist** → Waitlist → choose **Regular** or **Promo** → preview. Tinted Print opens the unchanged physical output; **No** in the print confirmation leaves the waitlist. Remove/Archive retain their existing guarded behavior. A browser preview cannot establish your printer's physical alignment.
- **Orders:** **New order** → choose North York and Fresh Valley Foods → enter Cases `1` for an item → **Save as draft**. Back to Orders → open its reference/chevron or focus its row and press Enter. Existing quantity/cost/totals are retained. **Print order** uses its document-language setting; no real order is sent to a supplier.
- **Undo/focus:** Remove an eligible draft line/date, then try Undo or ×. One capsule appears for about eight seconds above bottom actions. Use Tab to check visible focus and keyboard-reachable menus. Financial posting/corrections do not gain Undo.
- **Roles/sign-in:** Sign out through the account menu; sign in as `floorworker` and `cashier`. Presentation must not reveal private money or editing capabilities. In a separate fresh browser profile, `newemployee` must choose a new password; no PIN pad returns.

### Optional local automated checks

You are not required to run these. If you want to, stop preview with **Ctrl+C**, open Terminal in `prototype/`, and run:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.2
npm test
npm run lint
npm run build
```

For the pricing suite alone: `npm test -- src/pricing.test.ts`. The full test run must include every existing case and all **23 seed pricing cases**; the terminal must show actual passing counts. Install Chromium using the OS-specific README command, then run `npm run e2e`. Playwright starts its own built preview, so keep the ordinary preview stopped. It runs Chromium desktop/phone tests; explicit width-specific skips are reported separately from failures. These commands are not claims that the final C7 checks have passed.

## 3. What is not finished yet

### Final verification ledger

| Required evidence                                                                                    | Current status                                                                   |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Final C7 source commit and C6 base provenance                                                        | **PENDING** final recorded review head                                           |
| Complete unit suite and all 23 pricing seed cases                                                    | **PENDING** final-source result/count                                            |
| Lint, formatting, TypeScript and production build                                                    | **PENDING** final-source result                                                  |
| Complete existing/C6/C7 browser suite                                                                | **PENDING** final-source passes/failures/skips, without summing overlapping runs |
| Actual word/control/inner-bound checks at 390, 768, 900, 1024, 1180, 1280, 1440 and 1920 px in EN/FA | **PENDING** complete geometry evidence                                           |
| Token-only screen CSS and actual composited text contrast in light/dark                              | **PENDING** final audits and explicit unresolved dark-Primary choice             |
| Physical print source/declarations/geometry preserved                                                | **PENDING** final baseline comparison and print proof                            |
| All 85 C7 screenshots and individual comparison with all 19 original images                          | **PENDING** final captures, SHA256 manifest and per-image reviews                |
| Latest-head required GitHub checks                                                                   | **PENDING** actual check links/results                                           |

### Screenshot matrix

All 17 scenes above require **English light, English dark, Persian light, English at 900 px, and dark phone at 390 px**: **85 original screenshots** for C7. The broader layout checks also cover Persian phones and the other required widths. Screenshots must come from the recorded final production build with real fictional UI actions, image hashes and browser errors; each image is opened individually and compared with the owner's 14 red-note screenshots and five Klead retouches. Any remaining mismatch belongs beside its actual image. No placeholder or missing image link is presented as completed proof here.

**C7 gallery/manifest/review links: PENDING.** C6's separately recorded images verify C6, not the final C7 appearance. All original reference files remain untouched. Physical-printer alignment and actual Safari behavior are separate limitations unless explicitly verified; Chromium proof does not imply Safari was run. This remains a frontend demo, not production authentication, hosting, AI or a server database.

## 4. What is needed from you

No local installation, file upload or manual testing is required unless you choose to review it on your own computer. The automated checks and screenshot evidence still need to finish before a completion claim or merge request.

Two previously asked owner choices remain open in [open questions](open-questions.md):

1. **Correct pickup authority:** should the existing Supervisor account represent Owner/Manager for this one permission, or should pickup correction require a separate permission? Ordinary pickup stays immutable; this pending choice does not grant Floor Workers/Cashiers correction authority.
2. **Dark Primary:** choose **darker blue `#2B59C3` with white text**, or **lighter blue `#7397F0` with ink text**. The requested lighter blue with white fails the mandatory 4.5:1 contrast. Keeping an accessible interim treatment does not count as your approval of a final palette.

After the final evidence is added, review the two stacked pull requests and their images together. Approval to merge is a separate step; this guide does not authorize an automatic merge.
