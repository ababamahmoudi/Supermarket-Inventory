# Design language

**Direction (fixed by the owner):** light, lightweight, not fancy, but sleek and modern. The reference is the "School Teacher Dashboard": dark navy sidebar, light gray page, white bordered cards, small colored icon tiles, pill tabs, status badges, toggles, and a bottom action bar with "Save as draft" plus a primary button.
Do not reinterpret this into a different style. Improve only the points listed under "Where we differ from the reference".

## Principles
1. **Calm and fast.** Used all day on a shared store computer by busy people. Few clicks, big targets, nothing decorative.
2. **Status at a glance.** Pending, approved, short, expiring, conflict: recognizable by color **and** icon **and** word (never color alone).
3. **Consistency over cleverness.** Same component, same look, every screen. One primary action per screen.
4. **Rebrandable.** Logo, brand color, and company name are settings; no brand colors hardcoded in components (use tokens).
5. **Bilingual.** English (left-to-right) and Persian (right-to-left) with identical quality.

## Color tokens
Sampled from the reference screenshots and the Super Arzon logo. Brand values are approximate; replace with the official brand file when available.

| Token | Value | Use |
|---|---|---|
| `--sidebar` | `#0F172A` | Sidebar background |
| `--sidebar-active` | `#1E293B` | Active/hover item in sidebar |
| `--page` | `#F9FAFB` | Page background |
| `--card` | `#FFFFFF` | Cards, tables, inputs |
| `--border` | `#E2E8F0` | 1px borders |
| `--text` | `#0F172A` | Primary text |
| `--text-muted` | `#475569` | Secondary text (darker than the reference for legibility) |
| `--brand` | `#284898` | Logo blue: primary buttons, active tabs, links, focus ring |
| `--brand-hover` | `#1F3A80` | Primary hover |
| `--brand-red` | `#E00A12` | **Logo only** and rare brand moments. Never used for status. |
| `--pending` | `#B45309` on `#FEF3C7` | Pending, waiting |
| `--approved` | `#15803D` on `#DCFCE7` | Approved, resolved, posted |
| `--danger` | `#B91C1C` on `#FEE2E2` | Short, conflict, overdue, expired, errors |
| `--info` | `#1D4ED8` on `#DBEAFE` | Informational |
| `--neutral` | `#475569` on `#F1F5F9` | Draft, archived, cleared |

The logo's colors are poor on a dark sidebar. Show the logo on a **white tile** at the top of the sidebar (or a light header), never directly on navy.
Icon tiles on stat cards: use one tint per meaning (pending = amber, approved = green, danger = red, info = blue), not a rainbow.

## Typography
- Latin: **Inter**. Persian: **Vazirmatn**. Load both; use `font-family: Inter, Vazirmatn, system-ui, sans-serif` and the reverse order when `dir="rtl"`.
- Base size **16px** (the reference is smaller). Tables **15px**. Page title 24px/600. Card title 18px/600. Labels 14px/500. Small helper text never below 13px.
- Sentence case everywhere. No ALL CAPS labels. Prices use tabular (monospaced-digit) numerals and are visually prominent.

## Spacing, shape, depth
- 4px base unit; page padding 24px (16px on phones); card padding 20px; gap between cards 16px.
- Radius: cards 12px, inputs and buttons 8px, badges fully rounded.
- Borders instead of shadows. At most one very soft shadow for menus and dialogs.
- Motion: only to answer an action (open/close, toast). No entrance animations, no hover flourishes. Respect reduced-motion.

## Components (build once, reuse)
Use a mainstream component library with Tailwind CSS (shadcn/ui style) and restyle with these tokens.

| Component | Rules |
|---|---|
| **App shell** | Sidebar (logo tile, store name, nav, user + Lock + Sign out at the bottom) and top bar (branch switcher for Supervisor, language toggle, date). Sidebar collapses to a menu on small screens; mirrors to the right in RTL. |
| **Page header** | Title + one-line description; page actions on the opposite side. |
| **Stat card** | Label, big number, small tinted icon tile; clickable to the filtered list. |
| **Card** | White, 1px border, optional title with icon. |
| **Tabs** | Pill/segmented tabs (as in the reference), e.g. Drafts / Under review / Posted. |
| **Data table** | Compact rows (40px), sticky header, search box and filters above, row actions at the end, sortable columns, empty state, pagination or virtual scroll, keyboard navigation. |
| **Status badge** | Rounded, tinted background + icon + word. Fixed vocabulary: Pending, Approved, Rejected, Draft, Needs review, Ready to post, Posted, Short, Resolved, Open, Picked up, Cancelled, Expiring soon, Expired, Conflict, Taxable. |
| **Price display** | Large, bold, tabular. Approved price first; **Pending** price beside it with an amber badge. Taxable tag beside the price. Offer shown as a small pill ("2 for $5"). |
| **Forms** | Labels above fields, 2-column grid on desktop, 1 column on phone, inputs 44px tall with visible 1px borders (stronger than the reference's light gray fill), inline validation text that says how to fix the problem. |
| **Toggle / checkbox / radio** | As in the reference, with visible focus ring. |
| **Bottom action bar** | Sticky on long forms: **Save as draft** (secondary) + one primary action. |
| **Banner** | Inline, tinted, for blockers ("Waiting for Supervisor to confirm supplier"). |
| **Dialog** | Confirmations for destructive or approval actions; the confirm button repeats the action name ("Approve price"). |
| **Toast** | Short, same verb as the button ("Saved as draft", "Posted"). |
| **Empty state** | One sentence + the primary action. |
| **Label preview** | Exact-size on-screen preview of an A4 sheet with slots; used slots grayed. |

## Where we differ from the reference
1. Larger text, darker secondary text, stronger input borders (store-counter legibility).
2. Denser, searchable tables for invoice lines, products, stock.
3. A real status palette (the reference is nearly monochrome).
4. Brand blue primary buttons instead of near-black.
5. A dedicated **Cashier lookup** screen: one very large search box, big price, Pending/Taxable/Offer tags (see `screens.md`).
6. Full RTL support.

## Copy rules
- Plain verbs; say what happens: "Save as draft", "Post invoice", "Approve price", "Mark as short".
- One name per action everywhere (button, toast, history).
- Errors explain what went wrong and how to fix it; no apologies, no codes. Example: "Add the original invoice (PDF or photo) before posting."
- Empty screens invite action: "No drafts. Start a new invoice."
- Use the terminology list in `requirements.md` §18.

## Accessibility and RTL
- WCAG AA contrast, visible keyboard focus, touch targets ≥ 44px, tables fully keyboard-operable, labels linked to inputs.
- Use CSS logical properties (`margin-inline-start`, `padding-inline-end`), `dir` attribute on the root, mirrored icons only where direction matters (arrows, chevrons).
- Prices, product codes, and dates use Western digits and a fixed format in both languages **(assumed; see open-questions)**.
