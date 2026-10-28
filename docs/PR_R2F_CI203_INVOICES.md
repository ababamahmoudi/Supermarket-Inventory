# CI203 invoice integration checks

## Retained receiving-name font

On a fresh production build of `2fead8b`, the existing Persian 1280px invoice clipping oracle reproduced “Canned Fava Beans 400 g” leaving its product cell. Temporary CDP inspection identified bundled Manrope letters mixed with bundled Vazirmatn spacing/punctuation: about 173px versus 170px in English. The cell was 182.44px wide with 12px start padding. The comparison table's bilingual ProductName was already contained.

A reusable `--font-en-bilingual` token puts Manrope before bundled Vazirmatn only for the retained English receiving name. The actual title, one-line ellipsis, columns, check counts and all clipping tolerances are unchanged. Temporary diagnostics were removed.

All four existing 1280px EN/FA × light/dark invoice cases pass (1.1min, Chromium, fresh production build, port5196, one worker). The token suite passes all three tests; affected formatting/lint and the build pass.

Click check: Supervisor → Invoices → New invoice → Photo (AI reading) → upload the fictional invoice fixture → compare with a real same-supplier order → switch EN/FA and light/dark at 1280px. Product names retain the same Latin glyph metrics without changing the financial evidence.
