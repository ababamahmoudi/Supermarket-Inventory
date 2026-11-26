# R2 receiving: design reference

Approved by Ali on 2026-10-22. Every name, number and invoice here is invented.

- `png/`: what each screen must look like. Open these first.
- `html/`: the same screens as static pages, for exact sizes, colours and spacing. They use inline styles only so they're easy to read. **Don't copy the inline styles into the app.** Build the screens with the app's components, `klead-tokens.css` and `foundation.css` (rules in `docs/design-language.md`).

| # | Screen | File |
|---|---|---|
| 01 | Invoice review, desktop 1440 px (lines closed) | `png/01-Main.png`, `html/Main.html` |
| 02 | The same at 1000 px (original moves above the lines) | `png/02-Main-1000px.png` |
| 03 | A line open for editing, desktop | `png/03-LineEditor.png`, `html/LineEditor.html` |
| 04 | The same at 1000 px | `png/04-LineEditor-1000px.png` |
| 05 | Invoice review, phone 390 px | `png/05-Phone.png`, `html/Phone.html` |
| 06 | Line editor, phone (full-screen sheet) | `png/06-PhoneEditor.png`, `html/PhoneEditor.html` |
| 07 | Line editor, Persian (RTL), dark theme | `png/07-EditorFaDark.png`, `html/EditorFaDark.html` |
| 08 | "Start with an empty store" dialog | `png/08-DeleteDialog.png`, `html/DeleteDialog.html` |
| 09 | "Import complete" dialog | `png/09-ImportDone.png`, `html/ImportDone.html` |
| 10 | Tooltips: AI hint and collapsed-sidebar label | `png/10-Hints.png`, `html/Hints.html` |

The sidebar, top bar and logo in these pictures are stand-ins. **Keep the app's current sidebar and top bar.** The only changes there are the Invoices count and the collapsed-sidebar tooltip (screen 10).

## Token map (hex in the references → token in the app)

| Reference value | App token |
|---|---|
| `#f4f5f7` page | `--page` |
| `#ffffff` card | `--surface` |
| `#f0f1f4` field fill | `--field-fill` |
| `#eef0f3` neutral fill | `--neutral-fill` |
| `#e6e7eb` hairline | `--divider` |
| `#dcdfe5` field border | `--field-border` |
| `#141a2b` text | `--text` |
| `#5a6070` secondary text | `--text-muted` |
| `#6b7180` group text | `--group-text` |
| `#2b59c3` accent / primary | `--accent`, `--accent-fill` |
| `#e9eef9` accent tint | `--accent-soft` |
| `#197d44` / `#1f9d55` / `#e6f4ec` green | `--approved` / `--approved-dot` / `--approved-bg` |
| `#9a5b00` / `#e08a00` / `#fdf3e2` amber | `--pending` / `--pending-dot` / `--pending-bg` |
| `#b42318` / `#fce9e7` red | `--danger` / `--danger-bg` |
| radii 20 / 12 / 10 / 24 | `--radius-card` / `--radius-control` / `--radius-small` / `--radius-dialog` |
| shadows | `--shadow-card`, `--shadow-dialog`, `--shadow-menu` |

Dark theme and Persian use the same tokens (`:root[data-theme="dark"]`) and logical properties.

## Rules the screens show

1. **Lines table:**
   - It fits its card with **no horizontal scroll** at 1440 px with the original shown, and at 1000 px.
   - Columns: status icon + #, Product, Quantity (two lines: "2 cases × 4" over a muted "8 units"), Unit cost, Line total.
   - There are no Delivered, Category or Status columns.
2. **Product cell:** the name (one line, ellipsis) and, under it in 12 px: supplier code · category, or an amber "Choose a category", plus a small "New product" tag and an amber "· N to check". A short delivery shows in red under the quantity, on one line: "Delivered 20 · short 4".
3. **Row states:**
   - Confirmed: green row (`--approved-bg`) with a filled green check.
   - To check: very light amber row with an amber ring and "!".
   - Not confirmed: white row with a grey ring.
   - Status is always the FIRST thing on the left.
4. **Filter above the table:** All · Needs attention · Confirmed, with counts.
5. **Line editor:**
   - It opens directly under its row as a white panel. The row header gets the accent tint, and the panel has a light accent border and shadow.
   - It's never inside a horizontal-scroll box and never takes the table-row hover or active fill. (R2 bug: `tr.table-expanded-row` turned the whole editor grey on click.)
   - Two sections side by side on desktop, "Product" and "Quantity and cost". Headings are 15 px / 800 with a hairline under them; labels are 13 px / 600 muted.
   - Fields are 44 px high, and boxes in a row are level.
   - A bottom row holds Taxable and Track dates (segmented No/Yes; No is preselected for Track dates) and one quiet "Selling price" field.
   - "More details" stays closed.
   - The footer has Remove line (red tint), Report short or refused, then on the right Close and Confirm line (primary, with a check icon; NOT a checkbox).
6. **AI hint:**
   - The field gets a 2 px amber border.
   - A 16 px amber "!" marker sits right after the label text.
   - Labels never wrap (`white-space: nowrap`), so boxes stay level.
   - On hover or focus, a dark tooltip with an arrow shows ABOVE the marker, with `pointer-events: none` and `white-space: normal`. Nothing overlaps the value.
   - The amber note at the top of the editor says "N highlighted fields: compare them with the original before you confirm."
7. **Invoice details card:**
   - A 3-column grid; every grid item has `min-width: 0`, so no box spills into the next column.
   - "Received" is ONE read-only line, "Today, 12:34 · Demo Manager · Change". There are no separate date, time and "Received by" boxes.
   - "Looks right" for the whole card.
8. **Original invoice panel:**
   - ≥ 1180 px: on the right, sticky.
   - < 1180 px: above the work column at 320 px tall (with Expand).
   - Phone: a "View original" card that opens full screen.
   - Toolbar on one row: page arrows, zoom, fit width (icon), rotate, more.
   - It shows a skeleton while loading and never a broken-image icon.
9. **Progress strip:** sticks exactly under the top bar with no gap. On the phone it's a sticky bottom bar with progress, "Next to check" and "Post invoice".
10. **Totals:** label/amount rows, amounts right-aligned with tabular digits, and an amber "Calculated · not on the paper" tag on the subtotal when it's calculated.
11. **Persian:** amounts and codes in `<bdi dir="ltr">` / LtrValue. Amount columns have the same width and edge, with tabular digits.
12. **Dialogs:** one pattern.
    - Header: icon tile, 20 px / 800 title, one-line description, close button. Then the body, then a right-aligned footer with Cancel/secondary first and primary/destructive last.
    - The destructive button is red `--danger` and is disabled until DELETE (حذف in Persian) is typed.
13. **Collapsed sidebar:** the label tooltip shows only on hover or focus after 300 ms, floats above everything (portal or top layer), and never shows while the sidebar is open.
