# CI203 invoice integration checks

## Retained receiving-name font

On a fresh production build of `2fead8b`, the existing Persian 1280px invoice clipping oracle reproduced “Canned Fava Beans 400 g” leaving its product cell. Temporary CDP inspection identified bundled Manrope letters mixed with bundled Vazirmatn spacing/punctuation: about 173px versus 170px in English. The cell was 182.44px wide with 12px start padding. The comparison table's bilingual ProductName was already contained.

A reusable `--font-en-bilingual` token puts Manrope before bundled Vazirmatn only for the retained English receiving name. The actual title, one-line ellipsis, columns, check counts and all clipping tolerances are unchanged. Temporary diagnostics were removed.

All four existing 1280px EN/FA × light/dark invoice cases pass (1.1min, Chromium, fresh production build, port5196, one worker). The token suite passes all three tests; affected formatting/lint and the build pass.

Click check: Supervisor → Invoices → New invoice → Photo (AI reading) → upload the fictional invoice fixture → compare with a real same-supplier order → switch EN/FA and light/dark at 1280px. Product names retain the same Latin glyph metrics without changing the financial evidence.

## Approved Lookup mass labels

The original C4 layout flow reproduced a stale Persian expectation: Lookup displays `$7.49/پوند` and `$16.51/کیلوگرم`. Only those two assertions now select the approved labels by language. English `/lb` and `/kg`, exact amounts, approved-price setup, private/canonical evidence and every geometry assertion are unchanged. The ordinary Catalog price contract is unchanged.

All six original desktop workflows pass at 1280/1440/1920px in EN/FA (3.2min, fresh production source plus the receiving font correction, one worker). This includes the explicit New item order comparison, retained posted original, correction evidence, dates and pending credits. No tolerance, timeout or skip changed.

## Exact original-viewer title

The existing original-document flow reproduced a stale phone-only Persian dialog name. Its exact anchored name now matches the approved `فاکتور اصلی`; the English `Original invoice` name is unchanged. Every retained source/Blob/byte/SHA-256 comparison, supplier document route, bilingual close/reopen, reload and no-console-error assertion remains. Both original desktop/phone cases pass (17.3sec). The posted version-navigation link still deliberately uses `اصل فاکتور`; source inspection confirmed its separate existing test is correct and remains untouched.

Final local total: 12 original browser cases pass (four invoice theme/language cases, six document-layout cases and two original-viewer cases), plus all three token tests, fresh production build, affected lint/format and diff checks. No C5 Catalog assertions or proof script changes are included.

## CI204 — integrated actual-box correction

A clean detached `8a30702` production build reproduced no failures in the six original 1280px cases locally (6/6), while CI204 still reported the same six variants across retries. The font pin alone was insufficient: CSS-only ellipsis retained an unbounded live name range, with the ordinary English name using almost all available cell space. A new strict test against the actual name box failed in both EN/FA on this baseline, including the checked Sour Cherry Juice and Dried Barberries lines.

The source now reuses bounded FitText for the visible prefix, retains the exact complete native title and complete disclosure aria-label plus check count, and preserves all table widths/numeric gaps. Names missing entered text display the existing localized Not added placeholder without writing business data.

Core fresh-production proof after the fix: all six unchanged original 1280px cases and both strict actual-box resize cases pass (8/8, 1.4min). The latter cover390/1000/1279/1280/1281/1440px, exact prefix/title/full accessible name, actual disclosure navigation, unchanged canonical business evidence and a genuine injected-overflow failure followed by restoration. Both original EN/FA C5 reference and C8 receiving flows also pass (4/4, 54.4sec), including their title-removal-only negative and restored-positive checks. The stricter C5/C8 title capability checks add no clipping exception or tolerance change.

Click check: Supervisor → Invoices → upload the fictional fixture → resize around1280px in EN/FA. Hover the one-line shortened name for its exact original; open the row to review the full product. Numeric columns and all financial evidence retain their existing values.

CI204 companion proof: R0 D9's four original alignment scenes pass; explicit phone-emulation actual-box EN/FA cases and both phone R2 reference receiving flows pass. Together with the core cases above, 20 distinct browser cases pass (repeated desktop actual-box diagnostics are not counted twice). The existing LinesTable component suite passes3/3; the source production build, affected ESLint/Prettier and diff checks pass.

Saved fictional full-page/panel captures and actual CDP metrics are outside the repository in `/workspace/r2ef-final-review/ci204-invoice-fit`. The EN/light and FA/dark 1280px panels and full pages were individually viewed. Canned Fava's actual fitted glyphs use bundled Manrope Bold, about151.64px within the158.44px name box; the cell remains182.44px wide. Its native title remains exactly `Canned Fava Beans 400 g`. Both interfaces now share this measured result.

Two extra phone C8 receiving-flow checks failed before reaching the receiving component, at their posted-short heading: the unchanged C8 word oracle reports `QA-SHORT-LAYOUT` breaking across the heading. Both EN/FA failures, traces and snapshots were retained in the same external evidence folder for separate root triage. Their desktop counterparts and title-removal-only negative probes pass; no heading test or oracle was weakened here.
