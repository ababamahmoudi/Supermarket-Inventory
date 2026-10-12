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

**Pending owner colour decision:** dark accent `#7397F0` with white Primary text fails 4.5:1. Owner chooses darker Primary fill `#2B59C3` with white (retain lighter dark accent for links/icons), or lighter fill with ink text. Do not silently relax contrast or claim unresolved pairing passes. Every status/secondary/selected/hover/disabled text pair is measured on its actual background; inaccessible raw reference combinations require a documented token adjustment.

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

**Sidebar:** 248 px, white in light theme or dark surface, hairline at inline end. Own logo directly on white; dark uses a small white tile. Group labels Daily, Catalog, Supervisor and Admin: 12 px SemiBold grey. Items: 34 px high, radius 10, outline 18 px grey icon; active blue tint, blue icon and Bold label. Counts are small grey capsules; Approvals/Alerts use blue tint. The signed-in person sits at the bottom in a soft grey block with Lock/Sign out menu. Below 1280 px use icons only, retaining hover/focus labels and count dots. Desktop account remains at sidebar bottom. On phones the same initials/account menu may move to the priority top bar, matching the phone reference; hide its sidebar copy while the top-bar version is shown so only one account control is visible. Never make the sidebar scroll.

Groups remain Daily (Lookup, Invoices, Received, Returns, Labels, Date tracking, Notes, Branch requests); Catalog (Products, Offers, Suppliers); Supervisor (Dashboard, Approvals, Alerts, Payables, Orders); Admin (Users and devices, Settings, History). Filter by role and actual implemented destinations; icons remain unique.

**Top bar:** 60 px, page colour at 85% with background blur and bottom hairline. Left: sidebar button then breadcrumb (location grey, page ink). Right in order: filled search pill with `/` hint; soft location pill with blue pin; plain round target-language **فا in EN / EN in FA**, theme, text size, notifications with blue count; soft Demo pill. All 36 px high, no outlines. At 760–1279 px the breadcrumb shows current page only and search becomes an icon opening the field. `/` stays a key hint. Nothing overlaps or hides a permitted action; responsive mobile placement retains all actions.

**Page header:** Large title, secondary line, Primary action at inline end. Dashboard right panel is 280 px at ≥1440 px; below the main content at narrower widths. Notes for Supervisor/Activity use actual records and initials rather than copied avatars.

## Key layouts

**Supervisor dashboard: preserve exact order and grid.**

1. Four KPIs: **Approvals waiting · Open alerts · Open shorts · Expiring soon**. The two coloured variants are now **solid blue and solid ink**, replacing gradients.
2. A 12-column row: **Approvals queue** (8 columns) / **Alerts** (4), equal-height cards. Approval rows preserve product/names/code, change type, Old → New, location and Approve/Reject; narrow actions move below and never overlap. Alerts use title, secondary line, status and end action.
3. Equal-height **Recent invoices** (8) / **Returns** (4), retaining the View all returns header link.
4. **Supplier balances**, top five by balance, Supervisor-only.
5. Equal-height **Purchases by supplier, this month** / **Purchases, last 8 weeks**, 6 columns each.
6. Equal-height **Arrived this week** / **Price changes this week**, 6 each. Actual Received and approved/manual changes; no stock or sales estimate, no additional KPI.
7. Notes for Supervisor and Activity in the right panel. Scope all content to company/allowed location and stack responsively.

Worker home retains My drafts, Needs review, Offers to confirm and Expiring soon, then Today's suppliers and open returns and My notes. Purchase charts derive posted non-voided purchases net of shorts, linked credits and corrections, Decimal until rendering, configured-zone periods and honest empty states. Never invent sales.

**Lookup:** centered column, max 880 px. White/surface search 56 px, radius 16, scan inside. AI-category chips: All, most-used categories, More. Calm result list with names/code at start, prices at end, offers as pills, selected blue tint. Product price **60 px**, offer pill beside. Read-only Dates and Last received are two quiet rows with small icon tiles: `Expires YYYY-MM-DD · Location`, close-date pill. **No tracking switch, date entry or Add in Lookup.** Current-location price/clearance/expiry only; no other store's prices/lots. Supervisor Edit opens the shared editor.

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

**Klead contrast adjustment (2026-10-11):** The supplied green text `#1A7F45` on `#E6F4EC` measures 4.4451:1, below the owner's mandatory 4.5:1. Use the smallest measured darkening, `#197D44`, giving 4.56258:1 with the same tint. Keep the original reference files unchanged and list this deliberate accessibility difference; all rendered pairs still require actual contrast proof. This does not resolve the separately pending dark Primary choice.
