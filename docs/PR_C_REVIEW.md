# Pull requests C1 and C2 — store workflow review

C1 branch: **`feat/prototype-c1-receiving-locations`**. Combined C1 + C2 working branch: **`feat/prototype-c2-orders-requests`**. C1 is [pull request #14](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/14), final C1 tip `95f4fe4`. C2 is stacked on C1 and includes approved B plus C1; its new implementation and evidence are still being verified. Ali approved building both without a review pause; neither pull request authorizes a merge to main.

C1 unit, lint and build checks have run; its final four-variant screenshot capture passed. Focused browser checks passed. The earlier frozen complete browser run recorded 246 passed, four skipped and two deactivation failures; the corrected desktop/phone deactivation checks both passed. The full corrected C1 [CI run 37958175378](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/37958175378) passed both jobs. C2 implementation is in progress; its final results and gallery will be recorded after verification. Screenshots are captured through real interface actions; no business state or images are fabricated to make a screen pass.

The app remains a browser prototype with fictional data. Saved records stay in this browser on this computer. Docker, a backend, real AI and a physical printer are unnecessary for the browser review. Inventory is now a separate later paid phase: these changes record receiving and transfers, but show no stock levels or opening counts.

## Start the combined C2 review on Ubuntu

1. Open **Files → Supermarket-Inventory**, right-click empty space and choose **Open in Terminal**.
2. If your old prototype is running in another terminal, press **Ctrl+C** there first.
3. Paste these commands in the terminal opened at the project folder:

```bash
git fetch origin feat/prototype-c2-orders-requests:refs/remotes/origin/feat/prototype-c2-orders-requests
git switch feat/prototype-c2-orders-requests
git pull --ff-only origin feat/prototype-c2-orders-requests
git branch --show-current
node --version
```

The branch command must print `feat/prototype-c2-orders-requests`. `Already up to date` is normal. Node must be **22.22.2 or newer in the 22.x series, below 23**. If Git says local changes would be overwritten or branches have diverged, stop and share the exact message; keep your files. Do not use `git reset --hard`.

These C2 commands are for its published review branch once its validation is complete. You do not need to merge pending pull requests: C2 includes C1 and approved B. To inspect only C1, substitute `feat/prototype-c1-receiving-locations` in the three Git commands.

If you already used a supported Node 22 for B, keep using it. Otherwise, the following installs **Node 22.23.3 in your own home folder**, without replacing Ubuntu's system Node. Run it from the project folder:

```bash
supermarket_project_dir="$PWD"
supermarket_node_arch="$(uname -m)"
case "$supermarket_node_arch" in
  x86_64) supermarket_node_arch=x64 ;;
  aarch64|arm64) supermarket_node_arch=arm64 ;;
  *) echo "Unsupported computer architecture: $supermarket_node_arch"; exit 1 ;;
esac
mkdir -p "$HOME/.local/share/supermarket-node/22.23.3"
cd "$HOME/.local/share/supermarket-node/22.23.3"
curl -fLO "https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-${supermarket_node_arch}.tar.xz"
curl -fLO "https://nodejs.org/dist/v22.23.3/SHASUMS256.txt"
sha256sum --check --ignore-missing SHASUMS256.txt
tar -xJf "node-v22.23.3-linux-${supermarket_node_arch}.tar.xz"
export PATH="$HOME/.local/share/supermarket-node/22.23.3/node-v22.23.3-linux-${supermarket_node_arch}/bin:$PATH"
node --version
npm --version
cd "$supermarket_project_dir"
```

The checksum command must report **OK** for the downloaded archive; Node must print **`v22.23.3`**. If either check fails, stop and share the message. The PATH setting lasts in this terminal. In a new terminal, repeat the `supermarket_node_arch`/`case` and `export PATH` lines to select this installation again. If `curl` or `tar` is missing, install the Ubuntu tools first with `sudo apt-get update` and `sudo apt-get install -y curl ca-certificates xz-utils`; Ubuntu may ask for your computer password, whose characters do not appear while typing.

```bash
cd prototype
npm ci
npm run build
npm run preview
```

Expect installation and TypeScript/Vite build to finish successfully, then an address on port **5174**. Open **http://localhost:5174** in Firefox or Chrome. Keep the terminal open; **Ctrl+C** stops the app. If 5174 is occupied, stop the previous prototype in its terminal and retry. If an older page appears, press **Ctrl+Shift+R**. If a command fails, share the command and complete error; `make setup` is not needed for this prototype.

Sign in with **`supervisor` / `demo1234`**. Use the top-bar location pill, **EN | فا**, and sun/moon button. On a phone, open navigation with the menu button. Swipe sideways **inside a table** to see quantities, location and remaining columns; the page itself stays within the phone width. **Demo → Reset demo** restores fictional business records and discards review edits; it preserves account passwords and appearance choices.

## C1: notebook bug and All branches

1. As Supervisor, select **All branches** in the top bar.
2. Open **Notes → New notebook**.
3. Enter English name **Receiving handover** and Persian name **تحویل شیفت دریافت کالا**. Keep its Branch scope **All branches**.
4. Leave the default read/add roles selected: **Supervisor** and **Floor Worker**. Click **Save notebook** and open the new notebook tab.
5. The **Add note** form must be visible. Its **Location** field asks where this note belongs; select **Warehouse**.
6. Enter **Delivery paperwork checked at the warehouse.** and click **Save note**.
7. The saved card must show the note, Warehouse, author and date. Refresh, reopen this notebook tab and check that the entry remains.
8. Switch **Demo → Switch to Demo Floor Worker**. The worker can add notes to this new notebook in their own location; a worker cannot create or edit its definition.
9. Return to Supervisor and edit notebook permissions to make the worker read-only. As the worker, the app must explain why adding is unavailable rather than silently hiding the form. Restore the original permissions when finished.

## C1: locations, Received and no inventory

1. As Supervisor, open the top-bar location picker. It must list **North York**, **Richmond Hill**, **Newmarket**, **Warehouse** and **All branches**.
2. Open **Settings → Branches**. The three stores have type **Store**; Warehouse has type **Warehouse**. Use a row's **Edit** to see its bilingual names/type. Cancel if you are only inspecting it.
3. Select **North York**, then open **Received**. Each delivery row shows product, cases/units, location, supplier, invoice number, date and receiving employee.
4. Type **juice** in its search pill, then clear it. Try supplier/product filters and date range; **Clear filters** restores the log. **All branches** broadens the Supervisor's view to allowed locations.
5. Click an invoice number to open its source record. The log represents actual received goods, not orders or estimated stock.
6. Open **Products**, view a product, and find **Last received** per location. Open its supplier page and the **Received** tab to see the same delivery evidence scoped to that supplier.
7. Open **Dashboard**: **Arrived this week** replaces Low stock, while the existing four KPI cards and purchase charts remain.
8. Open **Products → Add product**: there are no **Opening count** fields. Product pages show no on-hand stock estimate. Cancel the form unless you want to create a fictional review product.
9. Warehouse can receive invoices, returns and notes; Cashiers cannot use Warehouse or receiving screens. Floor Worker Received remains limited to their assigned location.

## C1: manual prices and cost visibility

1. As Supervisor, select **North York**, open **Lookup**, and search **`0009`** (Potato Chips).
2. Click **Edit**, change **Selling price** to **`3.29`**, retain **All branches** approval scope and click **Save product**.
3. Lookup must show **Manual price**, the approved `$3.29`, the current rule/manual pair and Supervisor margin. This remains a Supervisor price decision, with History.
4. Open **Products** and enable **Manual prices**. The changed product appears; Supervisor also sees **Store cost** and **Margin %**. Its own page has cost history.
5. Switch to Floor Worker or Cashier and look up `0009`. They see the approved price/manual flag, but no catalog costs or margin. Return to Supervisor afterwards.
6. During the next invoice review for this product, its approved manual price stays unchanged. The row asks **Keep manual price** or **Use rule price** and shows the new rule price.
7. **Keep manual price** preserves the flag/approved price. **Use rule price** goes through the normal posting-time approval; the price charged remains approved/manual until the Supervisor approves it. A below-margin review still follows the existing configured rule.

## C1: ready-to-use labels and grayscale printing

1. As Supervisor or Floor Worker in **North York**, open **Labels → Products**.
2. Search **`0003`** (Sour Cherry Juice), set **Copies for 0003** to **`2`** and click **Add to waitlist**.
3. Open **Waitlist** and select saved template **Regular**. It is ready without creating a template: **60 × 40 mm**, with the tested A4 margins/gaps. The active offer automatically adds the small black **SPECIAL** band.
4. Select **Promo**. Its exact label size is **210 × 148.5 mm**, two per A4 sheet; the black border/content are safely inset. The grayscale preview shows black **SPECIAL** with white text, a large **2 for $5**, smaller **Regular $2.99**, and both product names.
5. Switch to Persian and dark theme. App controls follow that appearance, but the print preview remains black-and-white paper; label text uses the selected language ordering.
6. Open **Templates**. Regular and Promo can be edited or duplicated, archived and restored. Existing saved templates are retained; there is no Delete action. Cancel edits if only checking their settings.
7. Return to Waitlist and click **Print labels**. Choose **Save as PDF** or your printer; select **A4**, **Actual size / 100%**, no browser margins and no headers/footers. Do not select Fit to page.
8. After the print window closes, answer **Did the labels print correctly?** **No** if you cancelled or output is wrong; the waitlist stays. **Yes** removes only confirmed printed copies.
9. Use **Print test alignment page** and measure the rectangles on your actual printer before using label paper. Automated browser/PDF dimensions cannot establish physical printer calibration.

Promo selected for an item with no active offer shows its regular approved price; it does not falsely print SPECIAL. The actual offer band and mandatory Regular marker are tested separately from optional field preferences.

## C1: invoice location and posted corrections

1. Select your concrete location, open **Invoices → Manual entry**, and inspect **Location**. It defaults to the user's own location (or Supervisor's concrete current location).
2. Enter **Ship to (optional)** as **Ship to: North York** while a different destination is selected. The app suggests North York; it changes only after **Use suggested location**.
3. Before posting, the authorized invoice reviewer can select another active receiving location, including Warehouse. This does not grant them access to unrelated records at that location.
4. For a full posting example, use the existing [fictional invoice image](redesign-screenshots/pr1/fictional-fv-20417.png): open the link, save the image, and browse to it from the invoice dropzone. Complete the existing product matching, lower-price answers, explicit date Yes/No choices and line confirmations before posting.
5. As Supervisor, open a posted invoice and click **Move invoice**. Select a different location and enter a reason such as **Delivery was received at the warehouse**.
6. Inspect the correction preview before confirming: old/new location, affected deliveries/approvals and outstanding supplier liability, with existing payment allocation evidence.
7. Click **Move invoice**. The original stays read-only; the effective Received/location view changes and History records a correction. Company-wide supplier balance is conserved; only this invoice's remaining liability moves, while historical payments remain traceable.
8. A worker cannot move a posted invoice. Moving an older invoice linked to a merged price approval cannot redirect an approval whose current monetary basis is a newer invoice.

## C2 review steps

These match the implemented C2 interface; the final screenshots and results will be added after running its frozen production build. To reproduce the gallery examples, start a fresh private browser window so earlier review edits do not change these examples. C2 includes C1, so testing the final C2 branch reviews everything without manually combining pending pull requests. There is no approval pause between building C1 and C2.

### Supplier items and remembered packs

1. As Supervisor in North York, open **Suppliers → Fresh Valley Foods → Supplier items**.
2. Check product, supplier item code, **Case of N**, last bought before-tax unit/case price, date and invoice number. Select a row to open its price history.
3. For the complete example below, use **Edit** on Fava Beans (`0002`), Ground Sumac (`0005`), Sour Cherry Juice (`0003`) and Potato Chips (`0009`). Set **Units per case** to **12**, then **Save item** each time. Earlier invoices keep their original pack; future orders/receiving use the remembered pack.
4. Click **Add item**. Choose product **Black Tea (`0004`)**, enter **Supplier code** `C2-TEA`, **Units per case** `12` and **Expected unit cost** `3.55`, then **Add item**. This is an explicit expected quote for the review example. Bought price/date/invoice stay blank until an actual purchase; **History** identifies the quote separately.
5. Use **Demo → Switch to Demo Floor Worker**, then reopen **Suppliers → Fresh Valley Foods → Supplier items**. Product/code/pack/date/invoice remain available, while monetary columns/history and item maintenance are absent. Return with **Demo → Switch to Demo Supervisor** before the Orders example.
6. In invoice review select **Cases**, quantity **`3`** and a pack of **`12`**. Check **3 cases × 12 = 36 units**. Switching to **Units** uses the entered unit quantity directly; selling price remains per unit.

### Orders, printing and To order notes

1. As Supervisor, open **Orders → New order**. Select North York and Fresh Valley Foods.
2. In the item table, enter these **Cases** and **Expected unit cost** values. Their remembered pack is 12. An order does not create a supplier balance entry.

   | Product                      | Cases | Expected unit cost | Units |
   | ---------------------------- | ----- | ------------------ | ----- |
   | Fava Beans (`0002`)          | 2     | 0.98               | 24    |
   | Ground Sumac (`0005`)        | 1     | 1.20               | 12    |
   | Sour Cherry Juice (`0003`)   | 3     | 1.95               | 36    |
   | Potato Chips (`0009`)        | 1     | 1.60               | 12    |
   | Black Tea (`0004`, `C2-TEA`) | 1     | 3.55               | 12    |

   With exactly those values, the expected total is **$169.92 before tax**. Leave other item quantities blank.

3. Click **Save as draft**. Open it, check persistence after refresh, then **Place order**.
4. Open the order and click **Print order**. The preview dialog shows the actual bilingual order sheet. Click **Print** to save as PDF or print; use A4, 100% and no browser headers/footers. Inspect location, supplier, reference/date, both names, supplier code, cases, pack, units and expected prices. Save as PDF if desired.
5. Use Orders' status/supplier/location/date filters to find it. An actually posted partial delivery changes Ordered to Partially received; completing deliveries or explicitly cancelling remaining items finishes it. Cancellation preserves History.
6. Add an open **To order** note from Notes to an order. For a free-text reminder, explicitly choose its supplier item; enter the intended Cases quantity. The app must not invent a product or quantity. Placing the order marks only selected linked notes ordered; saving a draft does not silently close them.
7. Floor Worker has no Orders access by default. To enable it, use **Settings → Modules → Allow Floor Workers to use Orders → Save changes** as Supervisor. This grants order cost snapshots/expected amounts inside Orders only; supplier cost history and catalog margin remain hidden. Cashier remains excluded. Disable the option again if only checking its permission behavior.

### Invoice against order: every difference

Use the [unchanged fictional FV-20417 invoice image](redesign-screenshots/pr1/fictional-fv-20417.png): open the link and save the image on your Ubuntu computer. After placing the order above, open **Invoices**, browse to that image from the dropzone and wait for simulated reading. Click a product name if its review fields are collapsed. In each Fava/Sumac/Juice/Chips line, check **Units per case 12** and choose **Quantity unit → Cases**. The respective invoiced Cases are **2 / 1 / 3 / 1**; **Delivered quantity** always remains units, so enter **8** for Chips. In **Compare with order → Order (optional)**, select the reference of the order you just placed. Then review these differences:

- **As ordered:** quantity/product match is OK.
- **Fewer delivered:** use the existing **Short** flow for invoiced goods that did not arrive; only delivered units enter Received and only missing invoiced amounts/tax are withheld.
- **Ordered but absent from invoice:** Black Tea was ordered but is absent; choose **Back-ordered** (the other allowed decisions are **Short** or **Cancelled**). This does not deduct an amount that was never invoiced.
- **Extra kept:** Lavash Bread was not in this order; choose **Keep it (we pay for it)**; the actual delivery/payable is included.
- **Extra refused:** Dried Barberries were not in this order; choose **Refused / sent back with the driver**; it is excluded from payable and Received, with original evidence retained.
- **Changed cost:** Sumac is $1.20 expected and $1.30 invoiced per unit; inspect old/new case amounts and click **Accept new cost**. Normal approved/manual pricing remains protected.
- **Lower price from short expiry:** Juice is $1.80 invoiced versus $1.95 expected. Choose **Short-dated (expiry discount)** and choose an expiry date four days from today in the calendar. It appears in Date tracking after posting, but regular cost/approved selling price remain and no price-change approval is created. Supervisor may create a clearance offer and use Promo labels separately.

On each remaining invoice line, choose **No** for Track date; the short-dated Juice uses its explicit expiry date. Click **Confirm this invoice line** on all six lines. If the regular lower-price questions remain, use **Demo → Use fictional demo answer**, or explicitly choose Unknown and enter a note. An unresolved difference remains in the posting blockers. Click **Post invoice** once when enabled. After posting once, the order's received/remaining quantities update and one Supervisor alert lists all differences. Linked invoices include their regular lower-cost answers in that same alert; unlinked invoices retain the existing lower-price alert. Refresh/reopening must not post duplicate receipts, money or alerts.

### Branch requests: outgoing, sending and receiving

1. As Supervisor or Floor Worker at a concrete location, open **Branch requests → Outgoing → New request**.
2. Set **Sending location → Warehouse**. Search **`0002`**, click **Add**, choose **Units / Cases → Cases**, **Units per case 12**, and **Quantity 2**. In **Free-text item**, enter **bread**, click **Add item** and set its **Quantity 3** in Units. Click **Send**. Its status becomes Requested.
3. As Supervisor, select **Warehouse** in the top bar, open **Branch requests → Incoming**, then the row's **Open**. Tick Fava's **Being sent** checkbox. For bread, click **Short** and enter **Quantity being sent 2**; one unit remains short. Use **Print picking list** to save its bilingual A4 document, then **Mark as sent**.
4. Select **North York**, open **Branch requests → Outgoing → Open**. For Fava, choose **Missing** and set **Quantity arrived 1** case (of the two sent). Tick bread's **Arrived** checkbox (two units sent). Click **Mark as received**. Missing items remain visible. Click **Close request** when reviewed.
5. Use **Copy short or missing items**, then **Edit draft**, to inspect one outstanding Fava case and one bread unit in a new linked draft. It does not resend or alter the old request.
6. Check the sidebar count, Incoming/Outgoing tabs and History. Requests record actual transfers for later inventory but never change visible stock or supplier Payables. Cashiers cannot access them.

## Executed verification and screenshots

C1: **412 unit tests passed across 30 files**, including all seed pricing cases and retained boundary checks. Lint and TypeScript/Vite build passed. Focused browser runs passed: receiving/corrections (6 scenarios), compact sidebar/navigation (12), notebooks (16), labels (28), and catalog/manual prices (36). The earlier complete browser run stopped after exposing the short-window sidebar issue. A later frozen C1 run recorded **246 passed, four skipped and two deactivation failures**. After correcting those failures, both focused desktop/phone deactivation checks passed. C1 final tip is `95f4fe4`; the corrected full [CI run 37958175378](https://github.com/ababamahmoudi/Supermarket-Inventory/actions/runs/37958175378) passed both jobs. Its browser-count log was not separately imported, so no unverified total is claimed. A browser regression found short-window sidebar destinations inaccessible; the corrected sidebar uses collapsible groups below 920px height, with the current group open and every destination/user menu reachable. The gallery below was recaptured from that corrected immutable build.

The C1 gallery contains **six states × four variants = 24 screenshots**. Variants are English light, English dark, Persian light and a 390-pixel phone view. All business changes use real interface actions in fresh profiles. The manual price was created by editing fictional product 0009 to $3.29; the custom notebook/warehouse note was created and reopened after refresh. Existing product 0003 and its active 2 for $5 offer supply both labels.

| State                             | English light                                                                | English dark                                                                | Persian                                                                      | Phone                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Received log                      | [View](redesign-screenshots/pr-c1/received-en-light.png)                     | [View](redesign-screenshots/pr-c1/received-en-dark.png)                     | [View](redesign-screenshots/pr-c1/received-fa-light.png)                     | [View](redesign-screenshots/pr-c1/received-phone.png)                     |
| Warehouse location picker         | [View](redesign-screenshots/pr-c1/warehouse-picker-en-light.png)             | [View](redesign-screenshots/pr-c1/warehouse-picker-en-dark.png)             | [View](redesign-screenshots/pr-c1/warehouse-picker-fa-light.png)             | [View](redesign-screenshots/pr-c1/warehouse-picker-phone.png)             |
| Regular labels: grayscale preview | [View](redesign-screenshots/pr-c1/regular-labels-grayscale-en-light.png)     | [View](redesign-screenshots/pr-c1/regular-labels-grayscale-en-dark.png)     | [View](redesign-screenshots/pr-c1/regular-labels-grayscale-fa-light.png)     | [View](redesign-screenshots/pr-c1/regular-labels-grayscale-phone.png)     |
| Promo labels: grayscale preview   | [View](redesign-screenshots/pr-c1/promo-labels-grayscale-en-light.png)       | [View](redesign-screenshots/pr-c1/promo-labels-grayscale-en-dark.png)       | [View](redesign-screenshots/pr-c1/promo-labels-grayscale-fa-light.png)       | [View](redesign-screenshots/pr-c1/promo-labels-grayscale-phone.png)       |
| Manual price in Lookup            | [View](redesign-screenshots/pr-c1/manual-price-en-light.png)                 | [View](redesign-screenshots/pr-c1/manual-price-en-dark.png)                 | [View](redesign-screenshots/pr-c1/manual-price-fa-light.png)                 | [View](redesign-screenshots/pr-c1/manual-price-phone.png)                 |
| Saved custom note at All branches | [View](redesign-screenshots/pr-c1/custom-notebook-all-branches-en-light.png) | [View](redesign-screenshots/pr-c1/custom-notebook-all-branches-en-dark.png) | [View](redesign-screenshots/pr-c1/custom-notebook-all-branches-fa-light.png) | [View](redesign-screenshots/pr-c1/custom-notebook-all-branches-phone.png) |

The real Regular/Promo print portals are also exported as A4 PDFs in each variant (eight PDFs); phone print output remains A4 rather than shrinking to the phone width. Their CSS physical-label geometry is checked at **Regular 60 × 40 mm / Promo 210 × 148.5 mm**, A4 sheets 210 × 297 mm, Promo 1.5 mm border and at least 5 mm frame inset. These are browser output checks, not a physical printer calibration claim.

| Print template | English light                                                 | English dark                                                 | Persian                                                       | Phone context                                              |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------- |
| Regular        | [PDF](redesign-screenshots/pr-c1/regular-labels-en-light.pdf) | [PDF](redesign-screenshots/pr-c1/regular-labels-en-dark.pdf) | [PDF](redesign-screenshots/pr-c1/regular-labels-fa-light.pdf) | [PDF](redesign-screenshots/pr-c1/regular-labels-phone.pdf) |
| Promo          | [PDF](redesign-screenshots/pr-c1/promo-labels-en-light.pdf)   | [PDF](redesign-screenshots/pr-c1/promo-labels-en-dark.pdf)   | [PDF](redesign-screenshots/pr-c1/promo-labels-fa-light.pdf)   | [PDF](redesign-screenshots/pr-c1/promo-labels-phone.pdf)   |

[Capture metadata](redesign-screenshots/pr-c1/capture-results.json) records production HTML/compiled-entry hashes, browser errors, widths, native-control visibility, KPI count, sidebar scrolling, table column geometry and print-portal millimetres. The final capture from the corrected immutable production build passed **24 states/eight PDFs with zero runtime/layout/geometry failures**. All four variants used the same compiled entry and HTML, with hashes in the report. Representative light/dark/Persian/phone images and the actual exported Promo PDF were visually inspected. Wide phone tables remain inside their scroll container; swipe sideways inside them to see the remaining columns.

## Remaining scope and input from Ali

Real accounts/server storage, production deployment, real AI and later paid register-based inventory remain outside C. Physical printer alignment requires checking its actual test page. No additional action from Ali is needed for development/browser verification; both completed pull requests will be ready for his review together.
