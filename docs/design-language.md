# Klead design language v1

Owner specification: C6/C7, 2026-10-11. This document replaces the previous design language completely, including C2/C3/C5 borders, resting glows, typography, striped rows and control sizes. C6 uses it for new and changed components; C7 applies it to every existing screen. Match the five owner retouches (components/tokens, Lookup, Date tracking, Edit product, dark phone Lookup). Take visual style only; retain company logo, people, products and actual demo data.

## Hard rules

1. No visible native browser controls. Use shared styled Select/Combobox, file dropzone, checkbox, radio, switch, date picker and number controls; hidden native inputs can support accessible interaction, but browser file-input copy never appears.
2. All screen colours, radii and shadows come from **one standalone Klead tokens CSS file**, with light/dark custom properties. No literals in component/feature CSS or inline styles. Printed documents are the exception. Keep reusable tokens separate from company settings; company branding can override the accent.
3. Cards are borderless with the soft shadow below. Remove C5 resting borders/glows from buttons and fields. Only specified hairlines remain. Focus gets the ring.
4. One page title/secondary line and one Primary per area. At most four KPI cards. Preserve approved Dashboard/Approvals behavior and the exact Dashboard layout below.
5. Use available width with 28 px desktop/16 px phone padding. Short numeric fields and intrinsic text actions do not stretch edge to edge. Dialogs are bounded; tables, invoice comparison and New order use content width.
6. Sidebar never scrolls at 1080p; short windows may collapse groups while keeping every destination/account reachable. Below 1280 px collapse to icons with hover/focus labels. Below 760 px use mobile navigation and table cards.
7. Never break inside a word or overlap text/controls. Prices, dates, codes, unit fragments, short statuses and action labels stay whole. Long prose wraps at spaces. No sideways page/table scroll: hide lower-priority columns, expose permitted values in Columns/expanded details, then cards below 760 px.
8. Each table declares its identifying/essential columns and responsive priorities. Identifying name/reference mandatory. Width-hidden columns do not overwrite saved Columns preferences. Role-private fields never appear in choosers, details, cards or hidden accessible text.
9. Demo role/reset/simulated-reading controls only in the small Demo menu. Keep “AI invoice reading is simulated” on Invoices and “Demo with fictional data” in Demo only. Use exact business vocabulary, no invented copy.
10. Dates YYYY-MM-DD and prices `$2.99` in both languages. Operational timestamps use configured store time; UTC internally. Use singular/plural translations and `(optional)` after labels.
11. Root dir, logical CSS, bilingual translations and isolated numeric/proper-name fragments are mandatory. Missing Persian product names fall back to English.
12. Dialogs centered with dimmed backdrop, focus trap/return, Esc/backdrop close where safe. Keyboard access, reduced motion and **4.5:1 text contrast** on actual composited surfaces apply in both themes.
13. Top bar sticky. Undo reserves space above sticky action bars, never covers controls, never appears for typing/autosave. Incomplete Save/Post/Send actions explain missing fields when clicked rather than silently disabling.
14. Exact printing geometry below, Decimal rules, permissions, business records, original evidence and audit history survive retouch unchanged.

## Tokens

| Role                                | Light                 | Dark                                     |
| ----------------------------------- | --------------------- | ---------------------------------------- |
| Page                                | `#F4F5F7`             | `#0E1117`                                |
| Surface: cards/sidebar/dialogs      | `#FFFFFF`             | `#181C25`                                |
| Field fill                          | `#F0F1F4`             | `#222734`                                |
| Neutral button fill                 | `#EEF0F3`             | `#222734`                                |
| Hairline                            | `#E6E7EB`             | `rgba(255,255,255,0.08)`                 |
| Row divider                         | `#EEF0F3`             | `rgba(255,255,255,0.08)`                 |
| Ink                                 | `#141A2B`             | `#F3F4F7`                                |
| Secondary text                      | `#5A6070`             | `#A4AAB8`                                |
| Sidebar group text                  | `#6B7180`             | secondary text, verified on dark surface |
| Accent                              | `#2B59C3`             | `#7397F0`                                |
| Accent tint                         | `#E9EEF9`             | `rgba(115,151,240,0.18)`                 |
| Text on tint                        | `#2B59C3`             | `#9DB7F5`                                |
| Hover/selected list fill            | `#F4F6FA`             | derived neutral surface token            |
| Segmented track                     | `#EBEDF0`             | neutral fill token                       |
| Page-background control fill/border | `#FFFFFF` / `#E1E3E8` | dark surface / hairline                  |
| Keyboard focus ring                 | `rgba(43,89,195,0.2)` | verified dark accent-ring token          |

**Owner dark Primary decision resolved (2026-10-12):** use `#2B59C3` with white for filled primary buttons and solid blue summary cards. Retain `#7397F0` for dark links/icons/selected tabs/focus rings only. All actual composited text pairs still require 4.5:1; do not restore lighter-blue/white filled primaries.

## Typography

English/numbers: **Manrope**, weights 400–800. Persian: **Vazirmatn**. Bundle fonts for offline-after-load use. Prices/table numbers use tabular figures. Rem sizes support the existing comfortable-text preference.

| Role         | Size/line-height        | Weight        | Tracking |
| ------------ | ----------------------- | ------------- | -------- |
| Large title  | 30/36                   | ExtraBold 800 | -0.02em  |
| Title        | 20/26                   | ExtraBold 800 | normal   |
| Headline     | 15/20                   | Bold 700      | normal   |
| Body         | 14/20                   | Medium 500    | normal   |
| Caption      | 12/16                   | SemiBold 600  | normal   |
| Lookup price | 60/60                   | ExtraBold 800 | normal   |
| Field label  | 13/readable line-height | SemiBold 600  | normal   |

## Shape, depth and spacing

- Cards radius 20, no border, shadow `0 1px 2px rgba(20,26,43,0.04), 0 4px 16px rgba(20,26,43,0.04)`.
- Dialogs radius 24, shadow `0 24px 64px rgba(20,26,43,0.24)`.
- Menus radius 14, hairline, shadow `0 16px 40px rgba(20,26,43,0.16)`.
- Fields/buttons radius 12; small buttons/sidebar items radius 10; tabs/chips/pills/icon buttons fully round. Lookup search radius 16; Undo radius 14. Values live only in tokens.
- 4 px spacing base; label-to-control 8; fields 20; before actions/after tabs/between cards 24; card padding 24; phone gap 16.
- Lucide outline icons: sidebar 18, ordinary 20. Hover/open transitions 150–200 ms; reduced-motion supported.

## Buttons and fields

| Variant          | Treatment                                                     | Examples                            |
| ---------------- | ------------------------------------------------------------- | ----------------------------------- |
| Primary          | Solid Klead blue with approved contrasting text; one per area | Post invoice, Add, Save changes     |
| Secondary/tinted | Blue tint/blue tint text                                      | Print label, Add to waitlist        |
| Neutral          | Grey fill/ink                                                 | Cancel, Edit, Columns, Move invoice |
| Plain            | Blue text only                                                | Clear filters, + Add date, links    |
| Destructive      | Red tint/red text; in rows neutral fill/red text              | Remove, Stop, Reject                |

Buttons have **no resting border/glow**. On page background outside cards, neutral buttons/menus/filter search use white fill and 1px page-control border. Hover 4% darker; pressed 8%; keyboard focus 4 px ring. Ordinary: **40 px high, 16 px inline padding, 14 px SemiBold**. Small: **32 px, 12 px padding, 13 px**. Icons: **36 px circles**, transparent, grey hover, accessible name. Top-bar controls 36 px. **Phone text buttons 44 px**. Text never wraps; width intrinsic.

Fields **44 px**, field fill, no resting border. Focus: white/light or dark surface, 1 px accent border/ring. Error: surface, 1 px red border and red message underneath. Label 13 px SemiBold above; secondary `(optional)` after label. Dropdown matches field/chevron, searchable when needed. The old resting 3:1 border rule is superseded, visible focus remains required. Styled dropzones retain real picker/camera behavior without native copy.

## Choices and statuses

Segmented controls have a grey track and a white raised selected thumb, fully round: Pending/Approved/Rejected, Open/History, Due soon/All dates/Removed. Filter chips are white with a hairline; the selected chip uses the blue tint and blue text. Toggles are 44 × 26 px, blue when on. Custom checkboxes use the accent.

| Tone        | Light text / dot / tint                 | Dark text        |
| ----------- | --------------------------------------- | ---------------- |
| Green       | `#1A7F45` / `#1F9D55` / `#E6F4EC`       | `#4CC17E`        |
| Amber       | `#9A5B00` / `#E08A00` / `#FDF3E2`       | `#E9A23B`        |
| Red         | `#B42318` / `#D92D20` / `#FCE9E7`       | `#F2766A`        |
| Grey        | `#5A6070` / `#8A90A0` / `#EEF0F3`       | secondary text   |
| Blue / info | accent-tint text / accent / accent tint | accent-tint text |

Dark tints use 12–18%, measured on the actual surface. **Tables use a coloured dot and words; cards and headers use a soft tinted pill.** Never colour alone. Visible label determines tone: Waiting for pickup blue; Waiting for credit, Pending credit and Expiring soon amber; Credited, Replaced, Posted, Approved, Active and Received green; Written off, Cancelled, Rejected, Archived and Stopped grey; Short, Conflict, Expired, Overdue, Failed and Missing red. Other in-progress statuses use blue info. Translation never changes tone and an internal legacy state never overrides the visible lifecycle.

## Calm tables and adaptive width

- No stripes or cell borders; a 1 px row divider is inset 16 px at each end. Rows are 56–64 px; headings are 12 px SemiBold secondary text. Use soft hover/selection fill.
- Shared header/cell padding and logical alignment: text at start, numbers at end. Match headers to values within 2 px in English and Persian. Prices, dates, codes, statuses, unit fragments and actions never split.
- Detail-opening rows show a chevron and support keyboard/click actions; remove redundant View. End actions: **at most one small button plus ⋯**.
- Omit lower-priority columns progressively until the table fits. Omitted authorized values remain in Columns and expanded details. Below 760 px use cards. Keep user-hidden and width-hidden columns separate.
- Products, Suppliers, Received, Invoices, Orders, Payables, Returns and Date tracking retain Columns/Reset columns. Put Columns beside the count or in the title row when there is no filter row; **Payables ledger Columns belongs in its card title**. Identifying column mandatory; role-private money never selectable.
- Check actual words, text/control collisions, clipping and table/panel/page overflow at **390, 768, 900, 1024, 1180, 1280, 1440 and 1920 px in EN and FA**. A passing page width cannot excuse inner overflow or split prices.

## App shell

**Sidebar:** 248 px, white in light theme or dark surface, hairline at inline end. Own logo directly on white; dark uses a small white tile. Group labels Daily, Catalog, configured Manager and Admin: 12 px SemiBold grey. Items: 34 px high, radius 10, outline 18 px grey icon; active blue tint, blue icon and Bold label. Counts are small grey capsules; Approvals/Alerts use blue tint. The signed-in person sits at the bottom in a soft grey block with Lock/Sign out menu. Below 1280 px use icons only, retaining hover/focus labels and count dots. Desktop account remains at sidebar bottom. On phones the same initials/account menu may move to the priority top bar, matching the phone reference; hide its sidebar copy while the top-bar version is shown so only one account control is visible. Never make the sidebar scroll.

Groups remain Daily (Lookup, Invoices, Received, Returns, Labels, Date tracking, Notes, Branch requests); Catalog (Products, Offers, Suppliers); configured Manager (Dashboard, Approvals, Alerts, Payables, Orders); Admin (Users and devices, Settings, History). Filter by role and actual implemented destinations; icons remain unique.

**Top bar:** 60 px, page colour at 85% with background blur and bottom hairline. Left: sidebar button then breadcrumb (location grey, page ink). Right in order: filled search pill with `/` hint; soft location pill with blue pin; plain round target-language **فا in EN / EN in FA**, theme, text size, notifications with blue count; soft Demo pill. All 36 px high, no outlines. At 760–1279 px the breadcrumb shows current page only and search becomes an icon opening the field. `/` stays a key hint. Nothing overlaps or hides a permitted action; responsive mobile placement retains all actions.

**Page header:** Large title, secondary line, Primary action at inline end. Dashboard right panel is 280 px at ≥1440 px; below the main content at narrower widths. Notes for managers/Activity use actual records and initials rather than copied avatars.

## Key layouts

**Owner/Manager dashboard: preserve exact order and grid.**

1. Four KPIs: **Approvals waiting · Open alerts · Open shorts · Expiring soon**. The two coloured variants are now **solid blue and solid ink**, replacing gradients.
2. A 12-column row: **Approvals queue** (8 columns) / **Alerts** (4), equal-height cards. Approval rows preserve product/names/code, change type, Old → New, location and Approve/Reject; narrow actions move below and never overlap. Alerts use title, secondary line, status and end action.
3. Equal-height **Recent invoices** (8) / **Returns** (4), retaining the View all returns header link.
4. **Supplier balances**, top five by balance, Owner/Manager-only.
5. Equal-height **Purchases by supplier, this month** / **Purchases, last 8 weeks**, 6 columns each.
6. Equal-height **Arrived this week** / **Price changes this week**, 6 each. Actual Received and approved/manual changes; no stock or sales estimate, no additional KPI.
7. Notes for managers and Activity in the right panel. Scope all content to company/allowed location and stack responsively.

Worker home retains My drafts, Needs review, Offers to confirm and Expiring soon, then Today's suppliers and open returns and My notes. Purchase charts derive posted non-voided purchases net of shorts, linked credits and corrections, Decimal until rendering, configured-zone periods and honest empty states. Never invent sales.

**Lookup:** centered column, max 880 px. White/surface search 56 px, radius 16, scan inside. AI-category chips: All, most-used categories, More. Calm result list with names/code at start, prices at end, offers as pills, selected blue tint. Product price **60 px**, offer pill beside. Read-only Dates and Last received are two quiet rows with small icon tiles: `Expires YYYY-MM-DD · Location`, close-date pill. **No tracking switch, date entry or Add in Lookup.** Current-location price/clearance/expiry only; no other store's prices/lots. Owner/Manager Edit opens the shared editor.

**Add/Edit product:** English name and pricing category required; Persian name, descriptions and category optional. Date tracking Yes immediately reveals a soft grey group in the same form: toggle, **Remind me [30] days before expiry**, current-location dates as white rows, inline Type/Date/Quantity/Add and optional lot. Edit/remove within this form. Save product and dates together. Dialog title/caption, round ×, small grey section headings and hairline footer with Neutral Cancel then main action.

**Date tracking:** retain quick-add product scan/name/code/barcode, date, current allowed location, Enter/Add, refocus, new-row pin/highlight and More for Type/Quantity/Lot/Note. Due soon/All dates/Removed segments. Product/reminder/stop semantics come from requirements §10.

**Invoice review:** wide layout retains 40% sticky original pane plus lines, summary/totals and reserved Save as draft/Post invoice bar. What's missing is an amber linked list at form top, plus local field errors. No autosave/edit Undo. Posted number/status share header with end actions; five adjacent end-aligned totals: Subtotal, Tax, Invoice total, Deductions, bold Payable. Original whole-page default, 25–400% toolbar − / % / + / Fit width / Fit page / Download; actual bytes unchanged.

**Returns:** title/status together, creation/supplier/location subtitle and policy/next action at end. Pickup actual quantity per item, shortfall reason/disposition, locked saved pickup and separate authorized Correct pickup. Resolution groups clear item progress, credited/replaced/outstanding quantities. Policy about 640 px, summary and five numbered bold-title/one-sentence steps, no inner card, Download full policy and Close. Supplier memo defaults English and uses RM reference.

**Sign-in:** centered max 420 px surface card, own logo, Username, Password with show/hide, intrinsic Primary Sign in, help and Recent users row. Forced Choose a new password; no PIN. **Suppliers:** four useful summary cards; Last delivery/month deliveries/open returns navigate to exact scoped records; Balance is static without hover/pointer/glow. **Received:** one From/To range with Today/This week/This month. **Payables:** ledger Columns in title; atomic money/date/code and private monetary fields.

## Undo, validation and copy

**One dark ink capsule**, radius 14, white text, light-blue Undo and ×, at bottom inline end (right EN / left FA) for about **8 seconds**. A new eligible action replaces it; no stacks or +N. Reserve space above sticky actions and preserve keyboard reachability. Undo after eligible remove/stop/approve/reject/send/complete transitions, never field edit/autosave. Preserve scoped conflict-aware inversion and no legal/financial Undo.

Incomplete Save/Post/Send click opens **What's missing**: an amber box at top with a short list, each item linked to scroll/focus/highlight its field, and a red field message underneath. An edit clears only that field's error. Save as draft checks genuine draft requirements, not posting-only originals/review gates.

Sentence case, plain verbs, the same name in button/History and exact requirements §18 vocabulary. Optional labels use **Note (optional)**, never Optional note. Singular **1 unit** everywhere. Isolate Latin text, proper names, numbers, prices, codes, dates and units inside FA. Current-language name primary, other secondary, English fallback if Persian empty. Weighed approved/converted prices occupy separate /lb and /kg lines, without a leading dot. Read-only cost displays cents; stored/editable/computed cost retains four decimals.

## Documents and exact printing

Supplier-facing Return memo/Print order default **English only**, with separate per-document company settings. Internal picking lists and labels retain bilingual settings. Display language never rewrites signed original or financial snapshot.

- A4 is **210 × 297 mm**. Regular labels: **60 × 40 mm**, margins **10 mm**, gaps **4 mm**. Promo: **210 × 148.5 mm**, zero margins/gaps, exactly two per A4; black border **1.5 mm**, content/border inset **at least 5 mm**.
- Active Promo: black SPECIAL / ویژه band, huge offer, small regular price, both label names. Regular active-offer SPECIAL remains mandatory even when optional offer text is off. Unpromoted Promo prints approved regular price without an invented offer.
- Omit logo when label width is below **50 mm**; otherwise height at least **8 mm**, contained. Preserve codes/units/tax; no barcode or promotion-expiry additions. Grayscale preview is actual monochrome output.
- Return memo: store/address/**RM-0001**/date, supplier contacts, product/code/quantity/unit cost/expected credit, total and driver/store-staff signature/name/date. Never internal `demo-return-1` as supplier reference.
- Screen preview scales the whole page; physical geometry, calibration, page breaks and source evidence stay unchanged. Physical printer alignment remains a separate operator check.

## C6/C7 proof

Retain existing pricing/unit/domain checks. Add all Part 2 tests, twenty 3 MB photo migration/persistence, token-only components and ≥4.5:1 text contrast in both themes. Capture the 17 requested scenes in EN light, EN dark, FA, 900 px and phone, including real clearance/date/pickup/partial-resolution/What's missing states. Individually open each final capture beside all 14 bug notes and five retouches, recording mismatches honestly. C6/C7 are stacked without an intermediate approval stop; neither merges without later approval.

**Klead contrast adjustment (2026-10-11):** The supplied green text `#1A7F45` on `#E6F4EC` measures 4.4451:1, below the owner's mandatory 4.5:1. Use the smallest measured darkening, `#197D44`, giving 4.56258:1 with the same tint. Keep the original reference files unchanged and list this deliberate accessibility difference; all rendered pairs still require actual contrast proof. The separate dark Primary choice was subsequently resolved by the owner on 2026-10-12; use darker blue with white as specified above.

## C8 visual refinements (2026-10-12)

These targeted owner fixes supersede conflicting C6/C7 layouts. Klead fonts, tokens, semantic controls, accessibility and exact print geometry remain. Dark Primary is now resolved: **#2B59C3 with white** for filled buttons/blue KPI cards; **#7397F0** only for dark links/icons/selected tabs/focus rings.

- Put every list filter bar inside its list card, with filled controls. The white/hairline page exception still applies to genuine outside-card controls, never nested dialog Cancel. One end record chevron; an end expander only for actually omitted permitted columns. At 1440 give identifying names at least 240 px. Empty More slots keep Edit aligned; Products has 25 rows per page.
- Editor selects fill columns. Hairline above each Names/Pricing/Details/Date title. Add is 44 px aligned with fields; Type/Date/Quantity/Lot labels share a line. Date rows are centered dot/date/days-left/× with single spaces and past/reminder/later tones. Soft groups and white rows remain.
- Quick-add Product/Date/Location/Add wraps as a group; 44 px action, note gap below list. App minimum 100dvh, full-height sticky sidebar background; icon mode hides bare group arrows and uses short dividers.
- Labels grows with the page: no 560/480 px internal cap, header sticky below top bar, selection bar sticky bottom. Checkbox 48 px then flexible Product/Code/Offer/end Price, no empty gaps. Every row stays in its card at 390/900/1440.
- Orders header/value columns align; numbers at end, total below Before-tax column above actions. Filled fields. Currency minimum 2 / maximum 4, trim zeros only after second; 1.5525 is not rounded away in read-only/printed costs. Unit prices are $4.99/lb. Whole-case display does not rewrite quantity evidence.
- Product page uses header chips/actions, three responsive cards, then titled full-width sections. Money card/fields stay private; empty section is one muted line. Last received has a separator/date/source. No floating cost/status/unit fragments.
- Alerts full width, compact date reminders. Returns title/link matches other card headers. Date tones amber before expiry/red after. Purchase bars accent or measured 3:1 track contrast. Stop offer in More; no cell gap; quiet empty suggestion. Lookup selection tint only/same inset, Taxable neutral. Company swatches and current logo/Replace.
- Change price uses existing dialog/choices/fields; sale/new-regular exact copy from requirements. Scoped retail choices, dates, label checkbox, live plain summary, neutral Cancel and one primary action. Margin amber/acknowledgement, below cost red/reason. Sale large plus regular comparison; request amber beside current charge. No new font/colour scheme or copied reference data.

**E3, planned:** specified phone tables become compact name/translation at start, key value at end, end chevron and one muted secondary line; Labels keeps its checkbox. New screens at 390/430 EN/FA, 44 px actions. Manifest branding is configured company logo/name. This does not claim C8 already implements the E3 conversion. All stages keep visible focus, role-private fields and actual 4.5:1 text contrast.

## E1 People, setup and location authority (2026-10-12)

Keep Klead tokens, Manrope/Vazirmatn, borderless cards, shared controls, actual 4.5:1 contrast and exact printing geometry unchanged. E1 replaces role authority, not the visual system. People and the location dashboard reuse the existing Card, FilterToolbar, styled Select/multi-selection/Checkbox, Field, DialogActions and linked validation. No native controls, new palette or stretched numeric fields.

People list/Add/Edit follow requirements §16 and screens. Setup code is a protected successful result shown once, with a labelled copy action; never expose codes in list rows, recent users or History. Password then privileged passkey/authenticator setup uses the existing bounded sign-in card and plainly marks simulation. Configured role labels and names remain bilingual; no borrowed avatars or sample names.

The location picker distinguishes All my locations from All locations, and any write requires a permitted concrete location. Keep existing account placement/Demo menu; switching users changes real scoped capability views. Branch Supervisor dashboard contains operational cards only, with no invented financial substitute KPI and no unimplemented E2 task card. Owner/Manager retain the exact existing company-dashboard grid.

Role-private columns never enter Columns/details/accessibility text/print/export. Own pending approval cards are read-only for Branch Supervisor. The sale-cost delivery-hold checkbox is independent of the Owner/Manager price decision. Retain Floor Worker label template creation and calibration as Labels operations rather than Company Settings.

Exact sign-in hint label: **Fresh demo password** / **گذرواژهٔ دموی تازه**. It describes the configured fresh/reset fixture default, not a migrated person's current password. Preserve custom/migrated passwords and never show their value. Exact personal-notification stale/permission error: **This notification is no longer available. Open its list again.** / **این اعلان دیگر در دسترس نیست. فهرست آن را دوباره باز کنید.** Exact return-setting explanation: **Pickup records a pending claim. Only an Owner or Manager posts confirmed credit.** / **جمع‌آوری یک ادعای در انتظار ثبت می‌کند. فقط مالک یا مدیر اعتبار تأییدشده را ثبت می‌کند.** Exact Settings denial: **Only an Owner or Manager can change Settings.** / **فقط مالک یا مدیر می‌تواند تنظیمات را تغییر دهد.**

Keep the generic Undo capsule at about 8 seconds with hover/focus pause, separately from the existing 10-second note-author Edit window. Public read models cannot carry or expose a full authority snapshot; shared controls use current provider capability affordances and fresh private-source queries for protected values.

New People/picker/dashboard/setup states retain existing English/Persian phone rules at 390 px; E3 adds the specified 430 px checks/list-row installation work separately. E1 test/screenshot statuses remain Planned until actual proof; do not represent emulated width as a physical installed phone.

### E1 storage failure copy

Use exactly: “Browser storage could not be read or updated. Your original data is retained. Allow browser storage, then reload.” Persian: “فضای ذخیره‌سازی مرورگر قابل خواندن یا به‌روزرسانی نیست. داده‌های اصلی شما حفظ شده‌اند. ذخیره‌سازی مرورگر را مجاز کنید، سپس صفحه را دوباره بارگذاری کنید.” Preserve unreadable original data; do not promise a seed fallback, in-memory edit or Reset fixes an uncommitted write.

### E1 protected note editing messages

Use the configured built-in notebook title **For managers** and the action **Notify managers** (C9 supersedes the former Supervisor-role wording). Branch Supervisor unread counts use `notes.status_manage`. Reuse the existing translated error meanings: **Only the author, Owner or Manager can edit this note.**; **The ten-second edit window has ended. Ask an Owner or Manager to edit this note.**; **This note can no longer be edited. Ask an Owner or Manager to review it.** Author-window and retained-correction rules remain independently enforced.

### E1 Reset demo confirmation

Use exactly: “Restore the fictional business data and the six demo people. People changes and business changes made in this browser are cleared. Your preferences and language stay the same.” Persian: “داده‌های کسب‌وکار خیالی و شش کاربر دمو بازیابی می‌شوند. تغییرات کاربران و کسب‌وکار این مرورگر پاک می‌شوند. تنظیمات شخصی و زبان شما حفظ می‌شوند.” Only explicit Reset changes the People directory; normal migration preserves it.

## E2 task and notification presentation

Keep every Klead Hard rule and token unchanged. Price updates is an operational list/detail using the shared FilterToolbar, DataTable, Date range, Checkbox, Dialog, What's missing and sticky action bar. No visible native checkbox/select/date/file controls. Keep register and print confirmations separate, bounded reason fields and intrinsic actions; do not stretch short numeric reminder settings. Price/offer/time/code fragments remain atomic and isolated in Persian; current-language product name is primary and the other language secondary.

Pending uses amber where it means outstanding staff work; Done uses green; Cancelled grey. A Sale remains C8's Sale treatment. Last-day preparation clearly says tomorrow, not a false current price. At most four KPI cards, with Price updates to apply a normal operational card. Role-private data stays absent from DTOs, tooltip/a11y text, Columns, expanded details and exports. No copied avatars or invented business names/statistics.

Canonical additional copy (interpolate real product/store/price/time values, including localized plural rules):

| English | Persian |
| --- | --- |
| Price updates | به‌روزرسانی قیمت‌ها |
| Price updates to apply | به‌روزرسانی قیمت‌های قابل اجرا |
| Changed on the cash register | در صندوق فروش تغییر داده شد |
| New label printed | برچسب جدید چاپ شد |
| Print label now | چاپ برچسب اکنون |
| Add to label waitlist | افزودن به فهرست انتظار برچسب‌ها |
| No label needed | نیازی به برچسب نیست |
| Reason | دلیل |
| Mark as done | علامت‌گذاری انجام‌شده |
| Print labels | چاپ برچسب‌ها |
| Pending | در انتظار |
| Done | انجام‌شده |
| Price changed | قیمت تغییر کرد |
| Mark all as read | علامت‌گذاری همه به‌عنوان خوانده‌شده |
| Sale ends after today: back to ${{price}} tomorrow | حراج پس از امروز تمام می‌شود: فردا بازگشت به ${{price}} |
| {{location}} has {{count}} price updates waiting | {{location}} تعداد {{count}} به‌روزرسانی قیمت در انتظار دارد |
| Earlier changes | تغییرات قبلی |
| No price updates | به‌روزرسانی قیمتی وجود ندارد |
| No notifications | اعلانی وجود ندارد |
| Store progress | پیشرفت فروشگاه‌ها |
| Why it changed | دلیل تغییر |
| Decided by | تصمیم‌گیرنده |
| Effective from | اجرا از |
| Did the labels print correctly? | آیا برچسب‌ها درست چاپ شدند؟ |
| Price update reminders | یادآوری به‌روزرسانی قیمت‌ها |
| Notifications | اعلان‌ها |
| Remind after (hours) | یادآوری پس از (ساعت) |
| Alert Owner and Manager after (hours) | هشدار به مالک و مدیر پس از (ساعت) |
| Allow Floor Workers to mark tasks done | اجازهٔ انجام‌شده کردن کارها برای کارکنان کف فروشگاه |
| A register confirmation is still required. | تأیید تغییر در صندوق فروش همچنان لازم است. |
| Confirm that the label was printed. | تأیید کنید که برچسب چاپ شده است. |
| Add a reason. | یک دلیل اضافه کنید. |
| This price update has changed. Open it again. | این به‌روزرسانی قیمت تغییر کرده است. آن را دوباره باز کنید. |
| The price in the app changes right away. Confirm the cash register and shelf label here. | قیمت در برنامه بلافاصله تغییر می‌کند. صندوق فروش و برچسب قفسه را اینجا تأیید کنید. |
| No price updates match these filters. | به‌روزرسانی قیمتی با این فیلترها پیدا نشد. |
| No pending price updates. | به‌روزرسانی قیمت در انتظار وجود ندارد. |
| Back to Price updates | بازگشت به به‌روزرسانی قیمت‌ها |
| Print the new label, or choose No label needed and add a reason. | برچسب جدید را چاپ کنید، یا «نیازی به برچسب نیست» را انتخاب کرده و دلیل بنویسید. |
| Use a reminder time above zero and a later Owner and Manager alert time. | زمان یادآوری باید بیشتر از صفر و زمان هشدار مالک و مدیر دیرتر باشد. |

Labels referenced from a task retain current Regular/Promo template geometry and actual print behavior. A queue/preview is not a physical print; confirm only the genuine current preparation, and retain successful output evidence if another check fails. This stage builds in-browser personal notifications only, with no browser push permission prompt.

## E3 phone rows, installation and safe update presentation

The specified seven phone list families now use Lookup-style compact rows, superseding Hard rules' general cards-below-760 wording only for those families. Use Klead surface, typography, status tokens and dividers; identifying current-language name/translation at start, key value at end, one muted secondary line and one end chevron. Labels keeps its custom checkbox at row start. Do not show redundant Product/Details/Action labels or isolated chevrons. Preserve independent row/menu/checkbox/expander keyboard targets. All private-field projections and wider table rules remain.

Check actual line fragments and inner panel/page overflow at 390/430 in both directions/themes. No word breaks, sideways tables, duplicate account controls, scrolling sidebar or stretched numeric fields. Manifest icons use supplied company logo on a legible background, never the reference logo. Standalone and No connection use the same configured theme/typography with reduced motion/focus supported. Offline is an availability page, not a fabricated signed-in screen.

Additional canonical copy:

| English | Persian |
| --- | --- |
| No connection | اتصال برقرار نیست |
| Reconnect, then try again. | دوباره متصل شوید و تلاش کنید. |
| Try again | تلاش دوباره |
| Update available | به‌روزرسانی آماده است |
| Update app | به‌روزرسانی برنامه |
| Finish or close your current work before updating. | پیش از به‌روزرسانی، کار فعلی را تمام کنید یا ببندید. |

Update controls live only in the small Demo menu. They never interrupt a real pending operation or dirty editor; retain the current app until explicit safe activation. This presentation adds no copy claiming that email, a register, another phone, a real passkey or a production server has synchronized.

## C9 price, list and note presentation (current owner contract)

These rules supersede conflicting earlier presentation and note wording. Match the owner’s Prices, Notes and Lists pictures using the existing Klead tokens and components, without importing their HTML. Settings is deferred, except that notebook management moves entirely to Notes.

- Use one shared selling-price renderer in Products, Labels, Lookup results and detail, Product, Prices by store, Offers and Price updates. The bold current amount follows the grey struck regular amount on one unbroken line, only when the actual sale price is lower. Weight prices retain separate main/secondary unit lines, both end-aligned; price snapshots retain their original effective amounts rather than using today’s live price. Read-only unit costs show cents; storage, editing and calculations retain four decimals.
- Tables align Price to the end. Offer is its own start-aligned dot-and-words column: “Sale · ends Oct 28”, “Sale · no end date”, “2 for $7.00”, “Sale requested · $7.99”, or “Paused during sale”, interpolating genuine terms. Status contains only approval status. Phone rows put the price at the end and offer text below. Labels columns are checkbox 52 px, flexible Product, Product Code 140 px, Offer 240 px, Price 180 px; adapt without overflow.
- Product sale detail shows the large charge and “Sale · 19% off”, the regular comparison, then a grey Ends/Stores/Started/After the sale panel and Change sale/End sale now. Under its hairline retain actual regular-price calculation provenance and Last received. Show both sale-price and regular-price margins only to permitted roles. Lookup keeps its 60 px charge, Sale pill, “Before tax · Taxable”, and one regular-price/end-date line. Use real values and existing localized dates.
- Every list filter bar lives inside the list card, 20 px from its edges. Its controls, including the entire segmented track, are 40 px high and share a centre line; selected segment buttons fit inside that track. Use 12 px wrapping gaps. Search/segments come first, then dropdowns, then chips; count and Columns stay at the end. Apply to Price updates, Date tracking, Products, Labels, Received, Returns, Suppliers, Orders, Payables, Offers, Branch requests and History. Product and Label boolean filters are chips, with white/hairline resting and blue-tint selected treatment. Show Clear filters only after a genuine filter change. Phone filter controls retain the owner’s specific 40 px filter-bar height; ordinary phone text actions remain 44 px.
- Notes use Open / Done / All segments and a “Not seen by me” chip. Explicit footer actions below a hairline replace the hidden Mark seen menu. “Mark as seen” becomes a disabled green-check “Seen by you”; “Mark done” or “Mark ordered” uses current status permissions. Seen receipts record each reader and time in order, with “Not seen yet” before the first. More than three readers use “and 2 others” with a full tooltip/tap disclosure. Done/Ordered records actor and timestamp in green, plus a plain Reopen link. Open is blue, Seen grey and Done/Ordered green. Eligible status and receipt actions use the existing eight-second Undo, separately from the ten-second author edit window. Status-enabled custom notebooks follow the same presentation and their existing ACLs.
- New notebook, Edit notebook, Archive, Restore and Show archived notebooks belong to Notes, not Settings. The built-in former “For Supervisor” tab becomes “For managers”; configured E1 person and role labels replace legacy demo-role wording. “Branch Supervisor” remains.
- Branch request rows show bold reference, item count/name below, From → To, dot-and-words Status, Date and one end chevron. New request puts Ask this location and Deliver to side by side, with one Items section and the combined field “Add a product, or type an item that isn’t in the catalog”. Footer Cancel / Save as draft / Send request follows a hairline with 12 px gaps and end alignment.
- App actions and session changes retain shell chrome, never a transient sign-in layout. Protected content must still be cleared immediately when authority is invalidated. Show only a thin progress bar under the top bar after 300 ms; the first-start loading card also waits 300 ms. Apply saved theme/background/color-scheme before app code, including sign-in/lock/loading. Genuine final sign-out, lock and access denial retain their existing authority behavior.

Product uses a 3:2 Price/Cost desktop row with Dates spanning the row below, and one column on phones or without private cost. Its charge uses named 44/48 typography tokens at weight 800 and 16 px content gaps; Lookup retains 60/60. Regular comparisons stay visibly struck through inside the shared renderer. End sale now is plain danger-red text with the existing confirmation.

C9 proof includes Chromium and WebKit dark-theme frame/no-reload checks at a non-localhost address. **WebKit runs only the new no-reload test**, not the existing browser suite. Keep existing Chromium projects, workers, retries and skips. Capture the requested requested scene families in EN light, EN dark, FA and phone, compare against the three supplied pictures and record every remaining difference honestly. Documentation is a contract, not a claim that these checks have run.

## Foundation rules (S1, 2026-10-19 — current owner contract)

These rules replace any earlier per-PR wording that conflicts with them. The code lives in `prototype/src/foundation.css` (loaded last) plus a few shared components. **Do not restyle these parts in page stylesheets.** If a page needs something new, add it to the foundation and use it everywhere.

1. **Tables.** Use `DataTable`. Every row has the same rhythm: 12px cell padding, 16px at the first and last cell, header and values aligned the same way. Numbers, money and dates-as-numbers are right-aligned with tabular figures. Never set a cell's padding to 0 to make room. Give phones a `phoneList` (name, value, secondary) so rows stay readable.
2. **Blue means you can open it.** Product, supplier and invoice names that open a page are accent blue (`--link-text`); use `a.entity-link` for new links. Plain text stays ink.
3. **Empty values say so.** Use `<NotAdded />` or `<LtrValue value=… />` for anything that was never entered ("Not added" in muted italics). Use "—" only in table columns that mean "none" (for example no offer).
4. **Fields look editable everywhere.** Inputs, text areas and selects have a visible border (`--field-border`), including on grey panels. Errors outline the field in red and say how to fix it. A wrong password is cleared and focused.
5. **One item, one box.** Things that belong together in a list (queue requests, Seen/Done steps, rule choices) sit in one `list-box` with a hairline border and 16px padding.
6. **Tabs and filter segments never wrap.** They scroll sideways on narrow screens. A choice inside a table cell (such as an invoice line decision) may wrap so its full text stays visible.
7. **KPI cards line up.** Label row, number row, detail row; numbers sit on the same line whether or not a card has an arrow button.
8. **Detail lists** use `dl.detail-grid` (label above value, auto-fit columns).
9. **Detail pages** start with a `back-link` ("← Back to …") above the page title, never a loose button beside it.
10. **Status records show who and when** in one line: "Demo Richmond Hill Supervisor · 2026-10-19 14:22".
11. **Never a blank screen.** Loading keeps the app frame visible; never show an empty page between pages.
12. **Colors only from tokens.** New colors go into `klead-tokens.css` for both light and dark; `klead-tokens.test.ts` fails otherwise.
13. **One list for alerts.** All alerts sit in one list of `list-box` rows (product, one-line summary, category label). Details open on click; short facts stay on the row.
