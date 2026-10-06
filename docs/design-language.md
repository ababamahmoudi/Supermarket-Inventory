# Design language (v2)

**Direction (chosen by Ali):** the style of the reference dashboards in `docs/design-references/` (a SnowUI-style web dashboard): white grouped sidebar, soft light-gray page, white borderless cards with large rounded corners, generous spacing, bold KPI cards, pastel status pills, rounded table rows, thin line icons, a breadcrumb top bar, an optional right-hand activity panel, and light + dark themes. Calm, sleek, modern.

We take the **visual style only**. Do not copy the references' logo, illustrations, photos/avatars, sample names, or chart data. The iOS mockups in the reference set are not relevant (this is a web app).

Version 1 of this document (navy sidebar, bordered cards) is replaced in full.

## Hard rules (mandatory, check every screen)
1. **No native browser controls on screen.** Replace every `<select>` with a styled Select/Combobox, every file input with a **dropzone**, and every checkbox/radio/switch/date input/number stepper with the styled component. "Choose File · No file chosen" must never appear.
2. **Content never stretches edge to edge.** Page container max **1440px**. Forms: one column max **720px**, two columns max **960px**. Short values (quantity, copies, price) use fixed narrow inputs (120 to 160px). Do not spread two related values across the full width.
3. **Borderless cards.** Separate surfaces by fill color, not borders or shadows.
4. **Clear hierarchy.** One page title, one short subtitle, one primary action (top right). Numbers big; labels small and muted. Empty or missing values are muted text ("No approved price yet"), never large headings.
5. **The sidebar never scrolls** on a 1080p screen: grouped sections, 40px items, role-filtered.
6. **Demo-only controls** (role switcher, reset) live in one small **Demo** menu in the top bar, never as labeled form fields.
7. **No invented wording.** Use the terms in `requirements.md` §18 and the copy rules below.
8. **Max four KPI cards per page.** Everything else is a list or table you can act on, not a wall of counters.

## Tokens
Light values are sampled from the references; dark values likewise. Brand tokens are per company (Settings) so other supermarkets can rebrand.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--page` | `#F5F5F7` | `#333333` | Page background |
| `--sidebar` | `#FFFFFF` | `#333333` | Sidebar and top bar |
| `--surface` | `#FFFFFF` | `#3B3B3B` | Cards |
| `--surface-soft` | `#FAFAFA` | `#434343` | Table row stripes, inner panels, input fill |
| `--nav-active` | `#EBEBED` | `#474747` | Active sidebar item, hovered rows |
| `--search-fill` | `#F0F0F2` | `#474747` | Search pill, icon buttons |
| `--divider` | `#EDEDED` | `#4A4A4A` | Rare dividers (top bar bottom edge) |
| `--text` | `#1C1C1C` | `#FFFFFF` | Primary text |
| `--text-muted` | `#666666` | `#ADADAD` | Labels, secondary text, table headers |
| `--accent` | `#2B59C3` | `#5B86E5` | Primary buttons, focus ring, links, active indicators |
| `--accent-hover` | `#234AA8` | `#7398EA` | Hover |
| `--accent-soft` | `#E6EDFA` | `rgba(91,134,229,.18)` | Offer pills, selected rows |
| `--kpi-accent` | `linear-gradient(135deg,#234AA8,#3D68D4)` | same | KPI card variant A |
| `--kpi-charcoal` | `linear-gradient(135deg,#0F0F0F,#4A4A4A)` | `linear-gradient(135deg,#4A4A4A,#5E5E5E)` | KPI card variant B |
| `--tile-lavender` | `#ECEEFB` | `rgba(149,164,252,.14)` | Summary tile A |
| `--tile-sky` | `#E7F1FD` | `rgba(0,122,255,.14)` | Summary tile B |
| `--brand-red` | `#E00A12` | same | **Logo only.** Never for status or buttons. |

Super Arzon's accent `#2B59C3` is a brighter tone of the logo blue (`#284898`) so the vivid style of the references keeps the store's brand. Replace with official brand colors when received.

### Status pills (fixed vocabulary; text colors meet WCAG AA on their backgrounds)
| Meaning | Statuses | Light text / bg | Dark text / bg |
|---|---|---|---|
| Waiting | Pending, Waiting for supplier, Expiring soon, Still pending | `#9A5B00` / `#FEF5E6` | `#FFB547` / `rgba(255,150,0,.16)` |
| Done | Approved, Posted, Active, Resolved, Taken care of, Picked up | `#1A7F37` / `#EAFAEF` | `#5BD67C` / `rgba(51,199,89,.16)` |
| In progress | Needs review, Processing, Ready to post, Partially resolved | `#7E2FA8` / `#F1E9F6` | `#D18BF0` / `rgba(176,81,223,.18)` |
| Info | Open, New product, Price change, Taxable, Intentional | `#0058B8` / `#E1EDFB` | `#5AA9FF` / `rgba(0,122,255,.18)` |
| Neutral | Draft, Cancelled, Rejected, Archived, Cleared, Stopped | `#5C5C5C` / `#F0F0F0` | `#BDBDBD` / `rgba(255,255,255,.10)` |
| Problem | Short, Conflict, Expired, Overdue, Failed, Tax discrepancy | `#C4281C` / `#FFEBEA` | `#FF7A70` / `rgba(255,59,47,.18)` |

Pill: fully rounded, 12px/500 text, padding 4px 10px, optional 6px leading dot. Always a word, never color alone. Offer pills ("2 for $5") use `--accent-soft` with `--accent` text.

## Typography
- **Inter** for Latin, **Vazirmatn** for Persian (`Inter, Vazirmatn, system-ui, sans-serif`; reversed when `dir="rtl"`). Tabular numerals for prices, quantities, codes.
- Sizes in `rem` so one **"Comfortable text size"** setting (+2px) can scale everything on the shared store computer.

| Role | Size / weight |
|---|---|
| Page title | 24 / 600 |
| Card title | 16 / 600 (neutral text color; color is reserved for status) |
| Body, table cells | 14 / 400 |
| Labels, table headers, helper text | 13 / 500, `--text-muted` |
| KPI number | 28 / 600 |
| Cashier hero price | 40 / 700 |
| Buttons | 14 / 500 |

## Spacing, shape, icons, motion
- 4px base. Page padding 28px (16px on phones). Card padding 24px. Gap between cards 28px (16px on phones).
- Radius: cards and dropzones 16px; inputs, buttons, table rows, inner panels 12px; dialogs 20px; pills, search, segmented controls fully rounded.
- Icons: lucide at 20px, stroke width 1.5 (thin line style of the references).
- Motion: 150 to 200ms for hover, open/close, toasts only. Respect reduced motion.

## App shell
**Sidebar (240px, white, collapsible to 72px icons-only):**
- Top: Super Arzon logo (horizontal, 32px tall, directly on white, no box) and the company name.
- Sections with muted 13px labels, items shown by role:
  - **Daily:** Lookup · Invoices · Returns · Labels · Date tracking · Notes
  - **Catalog:** Products · Offers · Suppliers · Stock
  - **Supervisor:** Dashboard · Approvals · Alerts · Payables
  - **Admin:** Users and devices · Settings
- Item: 40px, icon + label, active = `--nav-active` fill + 3px accent bar at the inline-start edge. Counts as small pills at the inline-end.
- Bottom: user chip (initials avatar, name, role) opening a menu with **Lock** and **Sign out**.

**Top bar (64px, `--sidebar` background, 1px `--divider` bottom):** sidebar toggle · breadcrumbs ("Branch 1 / Invoices / FV-20417") · spacer · search pill (280px, `/` shortcut; products by name, code, barcode) · branch pill (Supervisor: switcher incl. "All branches"; others: static) · language segmented **EN | فا** · theme toggle (sun/moon) · notifications bell with count · **Demo** menu (prototype only).

**Right panel (280px, only on dashboards and only at ≥1440px width; otherwise it moves below the main content):** "Notes for Supervisor" (like the references' Notifications list) and "Activity" (timeline: initials avatar, action, relative time).

## Components
| Component | Rules |
|---|---|
| **KPI card** | Bold. Alternate `--kpi-accent` and `--kpi-charcoal` across the row (as in the reference). White text: label 14/500, number 28/600, a one-line breakdown ("2 price changes · 1 new product"), small round icon button top-right. Clickable to the filtered list. Max 4 per page. |
| **Summary tile** | Soft. `--tile-lavender` / `--tile-sky` alternating, dark text. For totals inside pages (invoice subtotal, tax, shorts deduction, payable). |
| **Card** | `--surface`, radius 16, padding 24. Header: title left; text tabs (active in `--text`, inactive in `--text-muted`), filters, or a round "…" icon button right. |
| **Data table** | Header row: no fill, 13px muted. Rows: 48px, radius 12, alternating `--surface-soft` stripes, hover `--nav-active`. Numbers right-aligned and tabular. Row actions in a "…" menu or as 32px icon buttons. Toolbar above: search pill + filter chips + "Clear filters" link. Sticky header on long tables. |
| **Buttons** | Primary: `--accent` fill, white text, 40px, radius 12. Secondary: `--surface-soft` fill, `--text`. Ghost: text only. Destructive: Problem-pill colors. Icon button: 36px circle, `--search-fill`. One primary per view. |
| **Inputs** | 44px, `--surface-soft` fill, no border, radius 12, 2px `--accent` focus ring, label above (13/500), helper/error text below. |
| **Select / Combobox** | Looks like Inputs with a chevron; searchable when more than 8 options; options in a radius-12 popover. |
| **File dropzone** | Radius 16, 1.5px dashed `--divider` border, upload icon, "Drop a PDF or photo here, or browse". After upload: file chip with name, size, remove. Camera capture on phones. |
| **Checkbox / switch / radio** | Custom, 18px, radius 5, `--accent` when on, visible focus ring. |
| **Segmented control / tabs** | Pill container in `--search-fill`; active segment `--surface` with soft shadow. |
| **Dialog** | Radius 20, max width 520; confirm button repeats the action ("Approve price"). |
| **Toast** | Charcoal pill at bottom center, white text, same verb as the button. |
| **Empty state** | Icon in a soft circle, one sentence, one primary button. Never a big "0". |
| **Avatar** | Initials in a soft tinted circle. No photos. |
| **Price block** | Approved price large; pending price beside it with a Waiting pill; Taxable (Info pill) and offer pill below. A product without an approved price shows muted "No approved price yet". |
| **Charts** | Only where real data exists (none required in the prototype). If used: thin lines, rounded bars, soft fills, as in the references. |

## Key layouts
**Supervisor dashboard**
1. KPI row (4): **Approvals waiting · Open alerts · Open shorts · Expiring soon**.
2. Row: **Approvals queue** card (2/3 width): rows with product, type pill, old → new price, branch, inline **Approve** / **Reject**. **Alerts** card (1/3): same-supplier lower price, cross-branch conflicts, tax discrepancies, each with its pill and one action.
3. Row: **Recent invoices** table (2/3) with status pills. **Returns** card (1/3): open, waiting for credit.
4. Row: **Supplier balances** table, top five by balance (Supervisor only).
5. Right panel: Notes for Supervisor and Activity.

**Floor Worker home:** KPI row (4): **My drafts · Needs review · Offers to confirm · Expiring soon**; then "Today's suppliers and open returns" and "My notes".

**Cashier lookup:** centered column (max 880px). Hero search pill (56px tall, large icon, autofocus, accepts barcode scanner input). Results as rows: name (EN), Persian name below in muted text, product code, price right-aligned, pills. Arrow keys + Enter select. Selected product shows the price block with the 40px price.

**Invoice review:** on wide screens two panes: document preview left (40%, sticky), lines table right. Summary tiles above the lines (subtotal, tax, shorts deduction, payable). Sticky bottom action bar: **Save as draft** (secondary) and **Post invoice** (primary). Blockers as an inline banner above the bar.

**Sign-in:** soft gray page, one centered card (max 420px, radius 20): logo, title "Sign in", Username, Password (with show/hide), primary **Sign in** button full card width, muted help line. On registered store computers, a row of "recent users" name chips (initials avatar + first name) above the fields. Language toggle in the top corner. No PIN pad.

**Suppliers overview:** toolbar (search pill, branch pill, filter chips), then the data table; money columns appear only for Supervisors. Supplier page: header card, KPI row (max 4), tabs as a segmented control, tab content in cards.

**Forms (e.g., new label template, add note):** one card, max 720px, fields in a logical order, actions at the bottom.

## Copy rules
- Sentence case. Plain verbs that say what happens: "Save as draft", "Post invoice", "Approve price", "Mark as short", "Record pickup".
- One name per action everywhere (button, toast, history).
- Errors say what went wrong and how to fix it: "Add the original invoice (PDF or photo) before posting."
- Empty states invite the next action: "No drafts. Start a new invoice."
- Use the terminology in `requirements.md` §18. Do not invent new section names or labels.

## Accessibility, RTL, theming
- WCAG AA contrast (the pill colors above are chosen for it), visible focus rings, targets at least 40px, keyboard-operable tables and menus.
- RTL: `dir` on the root, CSS logical properties, sidebar and right panel mirror, directional icons mirror. Prices, codes, and dates use Western digits.
- Light theme is the default. Dark theme uses the dark token column; the toggle is in the top bar. Theme and text size are remembered per user/device.
