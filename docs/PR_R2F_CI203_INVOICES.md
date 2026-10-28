# CI203 invoice integration checks

## Retained receiving-name font

On a fresh production build of `2fead8b`, the existing Persian 1280px invoice clipping oracle reproduced “Canned Fava Beans 400 g” leaving its product cell. Temporary CDP inspection identified bundled Manrope letters mixed with bundled Vazirmatn spacing/punctuation: about 173px versus 170px in English. The cell was 182.44px wide with 12px start padding. The comparison table's bilingual ProductName was already contained.

A reusable `--font-en-bilingual` token puts Manrope before bundled Vazirmatn only for the retained English receiving name. The actual title, one-line ellipsis, columns, check counts and all clipping tolerances are unchanged. Temporary diagnostics were removed.

All four existing 1280px EN/FA × light/dark invoice cases pass (1.1min, Chromium, fresh production build, port5196, one worker). The token suite passes all three tests; affected formatting/lint and the build pass.

Click check: Supervisor → Invoices → New invoice → Photo (AI reading) → upload the fictional invoice fixture → compare with a real same-supplier order → switch EN/FA and light/dark at 1280px. Product names retain the same Latin glyph metrics without changing the financial evidence.

## Approved Lookup mass labels

The original C4 layout flow reproduced a stale Persian expectation: Lookup displays `$7.49/پوند` and `$16.51/کیلوگرم`. Only those two assertions now select the approved labels by language. English `/lb` and `/kg`, exact amounts, approved-price setup, private/canonical evidence and every geometry assertion are unchanged. The ordinary Catalog price contract is unchanged.

All six original desktop workflows pass at 1280/1440/1920px in EN/FA (3.2min, fresh production source plus the receiving font correction, one worker). This includes the explicit New item order comparison, retained posted original, correction evidence, dates and pending credits. No tolerance, timeout or skip changed.
