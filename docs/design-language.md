# Design language (v2, C3/C4 revision — 2026-10-09)

**Direction (chosen by Ali):** the style of the reference dashboards in `docs/design-references/` (a SnowUI-style web dashboard): white grouped sidebar, soft light-gray page, white borderless cards with large rounded corners, generous spacing, bold KPI cards, pastel status pills, rounded table rows, thin line icons, a breadcrumb top bar, an optional right-hand activity panel, and light + dark themes. Calm, sleek, modern.

We take the **visual style only**. Do not copy the references' logo, illustrations, photos/avatars, sample names, or chart data. The iOS mockups in the reference set are not relevant (this is a web app).

Version 1 of this document (navy sidebar, bordered cards) is replaced in full.

## Hard rules (mandatory, check every screen)

1. **No native browser controls on screen.** Replace every `<select>` with a styled Select/Combobox, every file input with a **dropzone**, and every checkbox/radio/switch/date input/number stepper with the styled component. "Choose File · No file chosen" must never appear.
2. **Use the available page width with deliberate padding.** At 1440–1920 px, tables, invoice documents and New order use the available content area; no blanket 1440 px page cap or narrow form card leaving unused space. Keep individual fields readable: short values (quantity, copies, price) use narrow 120–160 px inputs, related fields stay together, and ordinary single-column dialogs may remain bounded. Notes and Offers creation use dialogs rather than permanent narrow cards. Keep 28 px page padding (16 px on phones).
3. **Borderless cards.** Separate surfaces by fill color, not borders or shadows.
4. **Clear hierarchy.** One page title, one short subtitle, one primary action (top right). Numbers big; labels small and muted. Empty or missing values are muted text ("No approved price yet"), never large headings.
5. **The sidebar never scrolls** on a 1080p screen: grouped sections, 40 px items, role-filtered.
6. **Demo-only controls** (role switcher, reset) live in one small **Demo** menu in the top bar, never as labeled form fields.
7. **No invented wording.** Use the terms in `requirements.md` §18 and the copy rules below.
8. **Max four KPI cards per page.** Everything else is a list or table you can act on, not a wall of counters.
9. **Row actions and inputs must be visible on every row color.** Buttons and fields inside striped tables use a style that contrasts with both the stripe and the plain row (e.g., an outline or a fill one step darker than the stripe). Same padding on every row.
10. **Tabs:** one segmented control style everywhere, fit-content width, one active style, and 24 px space before the content below.
11. **Spacing scale:** 8 px label→control, 20 px between fields, 24 px before action buttons, 24 px between cards. Nothing touches the element above it.
12. **One date format:** YYYY-MM-DD in tables, forms, and date pickers. One price format: `$2.99` (symbol first) in every language.
13. **The top bar is sticky** and every dialog, confirmation and prompt opens **centered** with a dimmed backdrop. Esc and backdrop click close it; focus enters the dialog and returns to its trigger on close.
14. **Persian and English mixed text follows the rules in "Mixed-direction text" below.**
15. **Filter toolbar controls are all 44 px tall.** Size custom selects to their complete option text instead of ellipsizing short filter labels; wrap the toolbar on narrow screens rather than growing controls taller. Every search field has the search icon and a meaningful translated placeholder. Tables follow their toolbars without an empty spacer.
16. **Nothing is clipped on desktop.** At 1280, 1440 and 1920 px, no table or panel may scroll sideways, conceal text or crop an action. Size columns for the available area, wrap readable long descriptions, and reflow rows/panels when needed. Keep short status/offer pills, prices and unit fragments intact. Sideways table scrolling is permitted on phones only; Orders items instead become phone cards. Never claim a passing layout capture from document-level overflow alone: check each table, panel and visible text element.

## Tokens

Light values are sampled from the references; dark values likewise. Brand tokens are per company (Settings) so other supermarkets can rebrand.

| Token                    | Light                                     | Dark                                      | Use                                                            |
| ------------------------ | ----------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `--page`                 | `#F5F5F7`                                 | `#333333`                                 | Page background                                                |
| `--sidebar`              | `#FFFFFF`                                 | `#333333`                                 | Sidebar and top bar                                            |
| `--surface`              | `#FFFFFF`                                 | `#3B3B3B`                                 | Cards                                                          |
| `--surface-soft`         | `#FAFAFA`                                 | `#434343`                                 | Table row stripes, inner panels, input fill                    |
| `--nav-active`           | `#EBEBED`                                 | `#474747`                                 | Active sidebar item, hovered rows                              |
| `--search-fill`          | `#F0F0F2`                                 | `#474747`                                 | Search pill, icon buttons                                      |
| `--divider`              | `#EDEDED`                                 | `#4A4A4A`                                 | Rare dividers (top bar bottom edge)                            |
| `--text`                 | `#1C1C1C`                                 | `#FFFFFF`                                 | Primary text                                                   |
| `--text-muted`           | `#666666`                                 | `#ADADAD`                                 | Labels, secondary text, table headers                          |
| `--accent`               | `#2B59C3`                                 | `#5B86E5`                                 | Primary buttons, focus ring, links, active indicators          |
| `--accent-hover`         | `#234AA8`                                 | `#7398EA`                                 | Hover                                                          |
| `--accent-soft`          | `#E6EDFA`                                 | `rgba(91,134,229,.18)`                    | Offer pills, selected rows                                     |
| `--accent-fill`          | `#2B59C3`                                 | `#3D68D4`                                 | Primary button fill (white text meets contrast in both themes) |
| `--kpi-accent`           | `linear-gradient(135deg,#234AA8,#3D68D4)` | same                                      | KPI card variant A                                             |
| `--kpi-charcoal`         | `linear-gradient(135deg,#0F0F0F,#4A4A4A)` | `linear-gradient(135deg,#4A4A4A,#5E5E5E)` | KPI card variant B                                             |
| `--tile-lavender`        | `#ECEEFB`                                 | `rgba(149,164,252,.14)`                   | Summary tile A                                                 |
| `--tile-sky`             | `#E7F1FD`                                 | `rgba(0,122,255,.14)`                     | Summary tile B                                                 |
| `--secondary-fill`       | `#FFFFFF`                                 | `#292B30`                                 | Secondary pill surface                                         |
| `--secondary-text`       | `#1C1C1C`                                 | `#FFFFFF`                                 | Secondary text (at least 4.5:1)                                |
| `--secondary-border`     | `#2B59C3`                                 | `#7398EA`                                 | Thin secondary border (at least 3:1 against adjacent surfaces) |
| `--secondary-glow`       | `rgba(43,89,195,.14)`                     | `rgba(115,152,234,.18)`                   | Soft resting button glow                                       |
| `--secondary-glow-hover` | `rgba(43,89,195,.22)`                     | `rgba(115,152,234,.28)`                   | Slightly stronger hover glow                                   |
| `--brand-red`            | `#E00A12`                                 | same                                      | **Logo only.** Never for status or buttons.                    |

Super Arzon's accent `#2B59C3` is a brighter tone of the logo blue (`#284898`) so the vivid style of the references keeps the store's brand. Replace with official brand colors when received.

### Status pills (fixed vocabulary; text colors meet WCAG AA on their backgrounds)

| Meaning     | Statuses                                                                                      | Light text / bg       | Dark text / bg                      |
| ----------- | --------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------- |
| Waiting     | Pending, Waiting for supplier, Expiring soon, Still pending, Back-ordered                     | `#9A5B00` / `#FEF5E6` | `#FFB547` / `rgba(255,150,0,.16)`   |
| Done        | Approved, Posted, Active, Resolved, Taken care of, Picked up, Received, Closed                | `#1A7F37` / `#EAFAEF` | `#5BD67C` / `rgba(51,199,89,.16)`   |
| In progress | Needs review, Processing, Ready to post, Partially resolved, Partially received               | `#7E2FA8` / `#F1E9F6` | `#D18BF0` / `rgba(176,81,223,.18)`  |
| Info        | Open, New product, Price change, Taxable, Intentional, Manual price, Ordered, Requested, Sent | `#0058B8` / `#E1EDFB` | `#5AA9FF` / `rgba(0,122,255,.18)`   |
| Neutral     | Draft, Cancelled, Rejected, Archived, Cleared, Stopped                                        | `#5C5C5C` / `#F0F0F0` | `#BDBDBD` / `rgba(255,255,255,.10)` |
| Problem     | Short, Conflict, Expired, Overdue, Failed, Tax discrepancy, Missing                           | `#C4281C` / `#FFEBEA` | `#FF7A70` / `rgba(255,59,47,.18)`   |

Pill: fully rounded, 12 px/500 text, padding 4 px 10 px, optional 6 px leading dot. Always a word, never color alone. Offer pills ("2 for $5") use `--accent-soft` with `--accent` text.

## Typography

- **Inter** for Latin, **Vazirmatn** for Persian (`Inter, Vazirmatn, system-ui, sans-serif`; reversed when `dir="rtl"`). Tabular numerals for prices, quantities, codes.
- Sizes in `rem` so one **"Comfortable text size"** setting (+2 px) can scale everything on the shared store computer.

| Role                               | Size / weight                                               |
| ---------------------------------- | ----------------------------------------------------------- |
| Page title                         | 24 / 600                                                    |
| Card title                         | 16 / 600 (neutral text color; color is reserved for status) |
| Body, table cells                  | 14 / 400                                                    |
| Labels, table headers, helper text | 13 / 500, `--text-muted`                                    |
| KPI number                         | 28 / 600                                                    |
| Cashier hero price                 | 40 / 700                                                    |
| Buttons                            | 14 / 500                                                    |

## Spacing, shape, icons, motion

- 4 px base. Page padding 28 px (16 px on phones). Card padding 24 px. Gap between cards 28 px (16 px on phones).
- Radius: cards and dropzones 16 px; inputs, buttons, table rows, inner panels 12 px; dialogs 20 px; pills, search, segmented controls fully rounded.
- Icons: lucide at 20 px, stroke width 1.5 (thin line style of the references).
- Motion: 150 to 200ms for hover, open/close, toasts only. Respect reduced motion.

## App shell

**Sidebar (240 px, white, collapsible to 72 px icons-only):**

- Top: Super Arzon logo (horizontal, 32 px tall) and the company name. Light theme: directly on white. **Dark theme: on a small white rounded tile** so the red and blue stay legible.
- Sections with muted 13 px labels, items shown by role:
  - **Daily:** Lookup · Invoices · Received · Returns · Labels · Date tracking · Notes · Branch requests
  - **Catalog:** Products · Offers · Suppliers
  - **Supervisor:** Dashboard · Approvals · Alerts · Payables · Orders
  - **Admin:** Users and devices · Settings · History
- Item: 40 px, icon + label, active = `--nav-active` fill + 3 px accent bar at the inline-start edge. Counts as small pills at the inline-end.
- Bottom: user chip (initials avatar, name, role) opening a menu with **Lock** and **Sign out**.

**Top bar (64 px, sticky, `--sidebar` background, 1 px `--divider` bottom):** sidebar toggle · breadcrumbs ("North York / Invoices / FV-20417") · spacer · search pill (280 px, `/` shortcut; products by name, code, barcode) · branch pill (Supervisor: switcher incl. "All branches"; others: static) · language segmented **EN | فا** · theme toggle (sun/moon) · notifications bell with count · **Demo** menu (prototype only).

**Right panel (280 px, only on dashboards and only at ≥1440 px width; otherwise it moves below the main content):** "Notes for Supervisor" (like the references' Notifications list) and "Activity" (timeline: initials avatar, action, relative time).

## Components

| Component                     | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KPI card**                  | Bold. Alternate `--kpi-accent` and `--kpi-charcoal` across the row (as in the reference). White text: label 14/500, number 28/600, a one-line breakdown ("2 price changes · 1 new product"), small round icon button top-right. Clickable to the filtered list. Max 4 per page.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Summary tile**              | Soft. `--tile-lavender` / `--tile-sky` alternating, dark text. For totals inside pages (invoice subtotal, tax, shorts deduction, payable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Card**                      | `--surface`, radius 16, padding 24. Header: title left; text tabs (active in `--text`, inactive in `--text-muted`), filters, or a round "…" icon button right.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Data table**                | One shared component defines column widths once. Header/body use equal inline padding and identical logical alignment: text `start`, numbers `end` under end-aligned headers; actions have a fixed end column. Header row: no fill, 13 px muted. Rows: 48 px minimum, radius 12, alternating `--surface-soft`, hover `--nav-active`. Numbers tabular. Actions in a "…" menu or 32 px buttons. One-line toolbar: search pill, compact selects/chips, **Clear filters**, result count at the end; wrap on phones without oversized filter cards. Sticky header on long tables. Playwright verifies each header/column cell's aligned edges within 2 px in English and Persian. |
| **Buttons**                   | Four variants only: **Primary**, **Secondary**, **Quiet**, **Danger**, as specified below. At least 40 px target; compact row visual buttons may use 32 px inside a 40 px hit area. One Primary per action area. Icon buttons use the same variants and accessible labels.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Inputs**                    | 44 px, `--surface-soft` fill, no border, radius 12, 2 px `--accent` focus ring, label above (13/500), helper/error text below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Select / Combobox**         | Looks like Inputs with a chevron; searchable when more than 8 options; options in a radius-12 popover. Size the trigger to the longest option up to its field maximum; the popover always displays complete option text and can wrap it.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **File dropzone**             | Radius 16, 1.5 px dashed `--divider` border, upload icon, "Drop a PDF or photo here, or browse". After upload: file chip with name, size, remove. Camera capture on phones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Checkbox / switch / radio** | Custom, 18 px, radius 5, `--accent` when on, visible focus ring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Segmented control / tabs**  | Pill container in `--search-fill`; active segment `--surface` with clear contrast. Inactive options retain readable full-contrast text in both themes, including Yes/No, kept/refused and Short/Back-ordered/Cancelled. Keep 24 px space before content.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Dialog**                    | Radius 20, normally max width 520; supplier/manual-entry forms and Review approval may use up to 720 px. Wrap a table header instead of clipping its last column. Confirm button repeats the action ("Approve price").                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Toast**                     | Charcoal pill, white text, action name and **Undo** when reversible. Bottom-right in English, bottom-left in Persian, above all interface layers; 10 seconds of unpaused display time. Pause while hovered or focused; newest first, independent timers, at most three visible plus **+N more**. See requirements §23 for safe action coverage.                                                                                                                                                                                                                                                                                                                              |
| **Empty state**               | Icon in a soft circle, one sentence, one primary button. Never a big "0".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Avatar**                    | Initials in a soft tinted circle. No photos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Price block**               | Approved price large; pending price beside it with a Waiting pill; Taxable (Info pill) and offer pill below. A product without an approved price shows muted "No approved price yet".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Charts**                    | Dashboard uses only recorded purchases: **Purchases by supplier, this month** as rounded bars and **Purchases, last 8 weeks** as a thin line with soft fill. Source: posted, non-voided purchase invoices after open shorts and linked purchase credits/corrections, scoped by company/branch/time zone; exclude payments/opening balances. Use Decimal totals before plotting, week dates on the axis, amount tooltips on hover/focus and honest empty states. Do not place a list of week totals beneath the line chart. No sales/revenue chart until cash-register data exists.                                                                                           |

## Key layouts

**Supervisor dashboard**

1. KPI row (4): **Approvals waiting · Open alerts · Open shorts · Expiring soon**.
2. 12-column grid row: **Approvals queue** (8 columns) and **Alerts** (4). Equal-height cards. Each approval row uses the same columns: product block (current-language name, other-language name and Product Code), change-type pill, Old → New, location, fixed end action column with Primary **Approve** and Danger **Reject**. Use a non-overlapping grid; on narrow screens buttons move below the content rather than covering location text. Alerts use the shared list row: title, muted second line, pill, one action at the end.
3. Equal-height grid row: **Recent invoices** table (8 columns), status pills; **Returns** (4), shared list rows for open/waiting-for-credit returns, with **View all returns →** as a header link.
4. Row: **Supplier balances** table, top five by balance (Supervisor only).
5. Equal-height grid row: **Purchases by supplier, this month** and **Purchases, last 8 weeks** (6 columns each).
6. Equal-height grid row: **Arrived this week** (actual Received entries in the company-timezone week; cases/units, location/date and invoice link; no stock estimate) and **Price changes this week** (from effective approved/manual changes), 6 columns each. Use the same title/secondary-line/pill/end-action list row as other dashboard lists. No extra KPI cards.
7. Right panel: Notes for Supervisor and Activity. All charts and lists use the active company/branch scope; stack cards at narrow widths.

**Floor Worker home:** KPI row (4): **My drafts · Needs review · Offers to confirm · Expiring soon**; then "Today's suppliers and open returns" and "My notes".

**Cashier lookup:** centered column (max 880 px). Hero search pill (56 px tall, large icon, autofocus, accepts barcode scanner input). Results as rows: name (EN), Persian name below in muted text, product code, price right-aligned, pills. Arrow keys + Enter select. Selected row uses `--nav-active` plus the 3 px accent bar, preserving offer-pill contrast; results mirror exactly in Persian with name at inline start and a fixed price/pill column at inline end. Selected product shows the price block with the 40 px price, Supervisor-only Edit, and recorded invoice/manual-change provenance.

**Invoice review:** on wide screens two panes: document preview left (40%, sticky beneath the top bar), lines table right. Summary tiles above lines (subtotal, tax, shorts deduction, payable); invoice-amount note directly beneath the tiles. Compact line rows: matched/confirmed lines collapsed, decision lines open automatically, any row opens on click; shared column headers replace repeated labels. Pending price uses **Pending** pill plus **Goes to approval when posted** muted text. Each line has **Track date: Yes / No**: initialize from the product’s explicit Yes/No setting; an unknown setting requires a choice. Yes always requires a valid type/date. Existing line confirmation remains mandatory. Bottom action bar spans the review width with `--surface` fill and reserved page space: **Save as draft** and **Post invoice**; blockers in a banner above it. Demo answers live only in the Demo menu.

**Sign-in:** soft gray page, one centered card (max 420 px, radius 20): logo, title "Sign in", Username, Password (with show/hide), primary **Sign in** button full card width, muted help line. On registered store computers, a row of "recent users" name chips (initials avatar + first name) above the fields. Language toggle in the top corner. No PIN pad.

**Suppliers overview:** toolbar (search pill, branch pill, filter chips), then the data table; money columns appear only for Supervisors. Supplier page: header card, KPI row (max 4), tabs as a segmented control, tab content in cards.

**Forms:** fields in a logical order, related short values adjacent, actions at the bottom inline end. New order and invoice documents use available page width; phone order items use cards. Add note and Create offer open centered dialogs. Ordinary single-column dialogs may use max 720 px; never apply that cap to a desktop table or invoice comparison.

## Copy rules

- Sentence case. Plain verbs that say what happens: "Save as draft", "Post invoice", "Approve price", "Mark as short", "Record pickup".
- One name per action everywhere (button, toast, history).
- Errors say what went wrong and how to fix it: "Add the original invoice (PDF or photo) before posting."
- Empty states invite the next action: "No drafts. Start a new invoice."
- Use the terminology in `requirements.md` §18. Do not invent new section names or labels.
- Use i18n plural forms for every counted noun: **1 note**, **2 notes**, not **1 notes**. Keep grammar correct for zero/one/many in both languages.
- Remove page-level fictional/demo disclaimers from Payables, Offers and other operational pages. Keep only **AI invoice reading is simulated** on Invoices and **Demo with fictional data** inside the small Demo menu. This changes presentation, not the fictional nature of the prototype or its documentation.

## Accessibility, RTL, theming

- WCAG AA contrast (the pill colors above are chosen for it), visible focus rings, targets at least 40 px, keyboard-operable tables and menus.
- RTL: `dir` on the root, CSS logical properties, sidebar and right panel mirror, directional icons mirror. Prices, codes, and dates use Western digits.
- Light theme is the default. Dark theme uses the dark token column; the toggle is in the top bar. Theme and text size are remembered per user/device.

## Mixed-direction text (Persian with English, numbers, prices)

- Wrap every left-to-right fragment inside Persian text in an isolated span (`<bdi>` or `unicode-bidi: isolate`): unit sizes ("1 L", "400 g"), prices, Product Codes, barcodes, English names, supplier names. "1 L" must never render as "L 1".
- Use **one formatter** for prices (`$2.99`), unit sizes, dates (YYYY-MM-DD), and offers. English offer label: "2 for $5". Persian offer label: "۲ عدد $5" style from the translation file (Ali reviews the wording); the price part stays isolated.
- Signed prices include the minus sign within the isolated fragment (`−$7.23`); invoice line-number punctuation and shorts parentheses are isolated with their numeric content. Supplier proper names are always isolated.
- Price changes: show "Old $1.99" and "New $2.99" as two labeled values, or use an arrow that follows the reading direction (→ in English, ← in Persian).
- **Tables in Persian:** header and cells use the same logical alignment (`text-align: start`; numbers `end`), so every header sits exactly above its values.
- **Names:** the current language's name is primary (bold), the other language's name secondary (muted, below it), in lists, cards, tables, and labels alike.
- Every user-facing string comes from the translation files, including branch names, demo user names, and status words; no English left in the Persian UI except proper names (suppliers, brands).
- Unit-cost display is two decimals (`$1.40`), while stored/calculated/editable costs retain four decimals. Dates use Inter with tabular numerals, not monospace. Use sentence-case **Selling price** everywhere. Match EN and فا visually in the language toggle; equal pixel font sizes alone are not sufficient.
- Buttons are actions, never past-tense states. Date tracking uses **Add date**, **Remove**, and **Stop tracking this product**; keep the same translated action names in dialogs, toasts and History.

## Small components (added)

- **User chip** (sidebar bottom): one line, name truncated with an ellipsis, role below in muted text, radius 12, same width as nav items.
- **Collapsed sidebar:** same toggle icon in both states, tooltips on hover, a small dot on icons that have counts, round avatar.
- **Top bar icons:** text size as "Aa" with a tooltip; notification count as a small pill at the bell's top corner (no extra chevron); the language toggle's inactive option at full text contrast.
- **Undo toast (C3):** charcoal pill with action name and **Undo**, bottom-right in English/bottom-left in Persian, **10 seconds**, above dialogs, bars and menus. Pause only that toast while hovered or keyboard-focused; retain independent timers/newest-first stacking, at most **3** plus **+N more**. An action never resets another timer. Preserve focus and make the stack reachable on phones. This supersedes the B five-second opposite-corner rule.
- **Pills hug their text**; never stretch a pill to full width.
- **Sortable headers** use the shared 13 px muted table-header style and a small arrow. **Back to Products** and **Back to Returns** share the directional arrow icon.
- Invoice selling-price provenance such as **Approved: $1.49** is a single muted line below the price.

## C label and receiving presentation (2026-10-09)

- Built-in **Regular** uses the previously tested shelf geometry:60 × 40 mm,10 mm A4 margins,4 mm gaps,zero calibration offsets. **Promo** is exact half-A4:210 × 148.5 mm,zero page margins/gaps,two slots per210 × 297 mm sheet. Inset thick1.5 mm black border and content at least5 mm from physical edges; scale screen preview only, retain exact physical dimensions for print. Both are editable/duplicable/archivable company presets, never deleted or silently recreated after archive.
- Promo with an active offer must work on a black-and-white printer: **solid black band with white SPECIAL / ویژه**, very large bold offer, smaller **Regular $2.99** and current-language name primary/other name below. Regular active-offer labels always get a small black SPECIAL band, even when optional offer text is hidden. Promo without an active offer shows approved regular price large and omits promotional wording; never invent an offer.
- **Grayscale preview** renders the real print layout in monochrome, with black text/white paper regardless of theme. Preserve bilingual shaping, isolated codes/prices/units, tax indicator, existing logo width/height rule and no barcode/promotion-expiry fields. Physical print/PDF output must preserve the requested millimetres; preview scaling cannot alter them.
- Staff price blocks carry an Info **Manual price** pill and **Rule price $X.XX · Manual price $Y.YY** when price provenance is manual; margins/costs remain Supervisor-only. The pill is a translated word, never color alone. New invoice decisions **Keep manual price / Use rule price** use the shared segmented-choice style.
- Received, Orders and Branch requests follow shared Data table/toolbar/empty-state/dialog styles. Incoming/receiving checklists use custom styled checkboxes; decisions use existing blockers style. Additional sidebar items retain40 px role-filtered grouping and a non-scrolling1080p layout; do not add Stock. Warehouse remains a styled location-picker option, never a native dropdown.

## C3 shared presentation and navigation contract

### Four button variants

| Variant   | Light                                                      | Dark                                                         | Use                                                                                |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Primary   | Solid `--accent-fill`, white text                          | Solid `--accent-fill`, white text                            | Main action; one per area                                                          |
| Secondary | White rounded pill, thin blue border, soft light-blue glow | Dark charcoal rounded pill, thin blue border, soft blue glow | View, Edit, Add to waitlist, invoice-number links and other ordinary actions       |
| Quiet     | Readable text with optional icon                           | Readable text with optional icon                             | Clear filters, breadcrumbs and small secondary navigation                          |
| Danger    | Red text and red border                                    | Legible red text and red border                              | Reject, Cancel return, Cancel order, Stop offer and other stop/cancel actions only |

Secondary takes the visual treatment from the owner's glowing-button reference, not its “Generate” copy. Text contrast is at least **4.5:1**, border contrast at least **3:1** against the adjacent background in both themes and row colors. Use the configured accent; hover strengthens the soft glow slightly, keyboard focus has a clear ring, and reduced motion is respected. Cards stay borderless: the button treatment does not authorize card borders/shadows. No faint legacy outline variants remain.

- **Search pill:** one rounded field, icon inside the same surface, no nested pill. Labels/Notes/Suppliers/Returns use at least 320 px on desktop, full width on phones, and 44 px height matching filters. Placeholder is fully visible.
- **Suppliers default columns:** Supplier, Status, Last delivery, Deliveries, Open returns, Open shorts, Balance, Overdue, Actions (nine for Supervisor; omit money for workers). Payment terms, Sales rep/phone and Next due date start hidden, available through authorized Columns/detail. Extra selected columns must wrap/group within desktop width.
- **Tables:** text/start and numbers/money/end headers align with body cells in both languages. Compact purposeful gaps; fixed end actions with equal-width buttons. Fix covering pseudo-elements/sticky layers rather than hiding the covered action. Suppliers uses **Deliveries** as the short column heading with “this month” context. Tables and panels reflow without desktop horizontal overflow at all three required widths.
- **Columns chooser:** Products, Suppliers, Received, Invoices, Orders, Payables, Returns and Date tracking expose **Columns** and **Reset columns**. The identifying name/reference column remains visible. Hidden columns persist by company/user/table in browser storage; never expose unauthorized monetary columns through the chooser.
- **Navigation:** every invoice, return, order, supplier and request detail has a leading **Back to [list]** link. Every breadcrumb segment is actionable. Browser Back restores the preceding list's tab, filters and scroll position within the same user/company context.
- **Sidebar icons:** every item has a unique icon. Invoices = receipt/paper invoice; Received = delivery truck/downward-box; Orders = shopping cart; Approvals = check badge. Automated uniqueness proof includes all configured visible items.
- **Errors:** validation lives beside the relevant field and clears as soon as that field changes. Keep unrelated errors; server/transaction errors use a concise banner. Check every form, including the confirmed-supplier gate on New order.
- **Review approval:** top summary product, Old → New, unit cost and margin; then **Apply price to**. Short effect rows group only locations with identical outcomes. Show **Override removed** only for a real removed override, warning in a callout, action buttons bottom inline end. Non-selling locations are excluded.
- **Labels Products:** row checkboxes and **Select all filtered** replace per-row Copies/Add to waitlist. Selected products show a sticky bottom bar **Copies [1] · Add 5 products to waitlist** (correct pluralization). Copies per product are edited only in Waitlist. Keep name/code/selling-price/offer alignment and all current filters.
- **Offers/Notes:** top-right Primary **Create offer** and top **Add note** beside **New notebook** open dialogs; remove permanent creation cards. Lists are the main content.
- **Non-selling locations:** Warehouse is excluded from approval effects, offer scope and per-location selling-price lists unless its configured **Sells to customers** setting is enabled. Receiving/order/request visibility still follows permissions. Preserve historical non-selling overrides as hidden evidence until explicit selling opt-in; all-selling approval must not clear them.

## C4 document and operational layouts

Posted invoices are readable documents, not disabled forms: header, product/quantity cases and units/unit cost/line total/tracked date, retained short/extra/short-dated decisions, totals, and Original invoice. No draft auto-save message. Supervisor **Correct invoice** opens a populated correction and an impact preview; **Corrected** links the retained versions in History.

Original images fit the panel with zoom. PDFs have a viewer, page navigation and **Download**. Missing manual originals show **No original attached** and **Attach original**; posting still requires a valid original. Every fictional demo original must match its own recorded header, packs, lines, subtotal, tax and total. Operational print previews scale the whole physical page to fit, preserving exact A4/label print dimensions and correctly paired EN/FA headings.

Weighed prices label their unit, with the approved price primary and optional converted price smaller; isolated fragments such as **$7.49/lb · $16.51/kg** follow mixed-direction rules. Date tracking adds an **Add date** dialog and **Remove** reason dialog, keeps removed records filterable, and shows the next scoped date on Lookup/Products. Returns use **Open / History** and **Waiting for pickup / Waiting for credit / Closed / Cancelled**, with closure subtype. Return memo and Payables pending credit use the domain rules below; no Returned to stock column.
