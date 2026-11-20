# R2f original-viewer filename and page-count follow-up

The viewer now fits only the filename and reserves space for the complete page count. The title and header actions share available width, and the fullscreen description uses the same bounded composition. The exact original filename remains in its native title and screen-reader text; the decorative fitted prefix is aria-hidden. Expand/Hide stay32px; the document toolbar stays44px. No original-source, business-data, page, download, zoom or rotation logic changed.

## Evidence and checks

On a clean production build of `3f823a6`, both EN/FA real two-page cases failed before the fix: `2 pages`/`۲ صفحه` left the actual subtitle box. The test reuses the existing fictional C1 import → checked review → protected post workflow without modifying its JSON, page images or business values.

Eight distinct browser cases pass across desktop/phone emulation: four new two-page caption cases at1440/1280/1000/390px in EN/light and FA/dark, plus all four existing D9 toolbar/original-byte cases. The new proof measures visible filename and count glyphs within their actual groups, verifies a one-line count, exact full filename title/accessible description,32px header actions,44px toolbar, desktop Expand/Hide, phone fullscreen, both original Blob hashes, page navigation, page-two native download hash, zoom/rotation, retained route and unchanged canonical business records. The existing D9 test changes only its old full-visible-filename assertion to the exact native-title contract; all original money/source/control guards remain.

The existing OriginalInvoice unit suite passes5/5. Fresh production build, affected ESLint/Prettier and diff checks pass. Fictional captures are saved outside the repository at `/workspace/r2ef-final-review/d9-file-caption/final`; EN/FA1440/1280/1000 and390phone captions were individually viewed. Final whole-page C8 integration belongs to the root validation after the separate posted-cost/charges fixes.

## Click check

Open a retained two-page original from an invoice, or use New invoice → JSON file with the existing fictional R1 readings fixture and review/post its first invoice. At each requested width, the complete count stays beside the shortened filename; hovering the filename shows its exact original. Expand on desktop or View original on a phone; the full description still includes filename/count. Go to page2, zoom/rotate and download, then return to page1. Closing/hiding the viewer retains the posted invoice and all amounts.

The screenshot helper waits for the actual PNG decode, image layout and two animation frames before recording; this avoids a transient unpainted mobile image capture without changing app media behavior or adding a sleep/retry/timeout. The final FA390 image was viewed again and contains the correct complete fictional paper. Temporary bounds diagnostics were removed.

## CI205 — scope the unread-original driver to its active caption

On fresh production source `db6ba0f`, both original phone unread-original cases reproduced the stale global exact-text count: the complete screen-reader filename and a fully fitting decorative prefix were both counted. The active desktop aside also legitimately retains a closed fullscreen caption.

The C8 driver now selects the named active viewer and its direct embedded header or dialog description, requiring exactly one filename widget. It verifies the exact native title, complete readable copy and exact full/prefix painted text within its actual box. The phone dialog must still announce the complete filename and page count. A mismatched native-title negative fails the same identity predicate while both text copies remain; restoration and reload pass. The pre-open Drafts absence, read transition, invoice/line identity, exact retained byte hashes and all other C8 guards remain unchanged. No app/accessibility source, count tolerance, skip or timeout changed.

All four final EN/FA desktop/phone unread-original cases pass (30.4sec). On the same frozen production build, all four existing real two-page D9 caption cases also pass with source/download hashes, native/accessible filename, visible count and canonical-evidence checks. Fresh build, affected ESLint/Prettier and diff checks pass. A read-only targeted audit found no other global exact original-filename/count driver affected by this composition; upload/source/canonical/download checks and the valid pre-open absence assertion remain intact.
