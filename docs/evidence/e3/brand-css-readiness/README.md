> Historical candidate-stage record. The [final exact E1/E2 checks](../brand-css-readiness-final/README.md) and [complete corrected-source application checks](../final-a6c66dc-validation/README.md) are now available; the original pending text below describes staging time.

# Company-brand CSS readiness: candidate and actual CI failure

Exact source `0786ea262b6ebdf573cd02f2b56479952633ee21`, PR CI run `38806913395`, failed the actual unit step in `store.test.tsx`: expected `--company-primary` **#0F766E**, received the default **#2B59C3**. Build and browser steps were skipped. This failure is separate from earlier 30-minute browser job cancellations. Original API annotation/job payloads are preserved unchanged here.

The fixture's `show()` waits for the rendered authentication stage to leave `loading`. `DemoProvider` writes branding properties on `document.documentElement.style` in a separate passive effect after its projected configuration changes. The former stage predicate does not guarantee that the CSS effect has published. The CI annotation does not capture exact stage/effect scheduling; no CPU cause or proven production fault is claimed.

The minimal candidate wraps **all three original exact color assertions together** in the existing `waitFor`. Values, property names and matchers remain unchanged: **#0F766E**, **#5EEAD4**, **#0D9488**. No timeout option is added: Testing Library's default **1,000 ms** remains; the existing `show()` 10,000 ms and Vitest 30,000 ms budgets are unchanged. There are no new imports, timers, mocks, authority/repository/result replacements or production changes. If the configured palette never appears, the unchanged exact assertions fail.

**Candidate tests/builds: Pending.** All heavy work is held while the four-worker final native verification runs. The original full local application pass and actual CI failure remain separate outcomes; this candidate has not been presented as verified. [Diagnosis and raw hashes](diagnosis.json) records source/ref fingerprints and current limits. Root is the sole applier; this staging task made no tracked edits.
