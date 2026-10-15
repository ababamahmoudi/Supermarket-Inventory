# Narrow Payables same-location repair

The original native Phone trace showed North York was already selected before the user selected North York again. Ordinary supplier search typing then disappeared. Reselecting the existing value unnecessarily called the real authority location transaction/resume/adopt path, invalidated the protected-query generation and replaced the still-enabled input while the user typed.

The production patch adds exactly `if (value === branch && !clear) return;` at the start of Payables `changeBranch`. Actual branch changes and the explicit Clear filters operation are retained. No permission, authority query or financial command is changed. Only the Payables route is affected.

## Review and application

[Source manifest](source-manifest.json) binds the staged files to their source hashes and production baseline. Root applied the patch; the diagnostic agent made no tracked writes. The exact one-line [production patch](production.patch.gz) is compressed unchanged.

## Actual proof

[Final evidence](final-evidence.json) records commands, actual exit codes, raw reports, hashes and source guards. Identical final test code produced one failure and two passes on the old source, then three passes and no failures on the patched source. The failing old assertion expected the complete search text `fresh` and received an empty input. Patched full TypeScript, changed-file ESLint and Prettier all exited zero. Both frozen runs retained all 595 source-file hashes.

The new regression uses the standard actual Provider fixture with fake-indexeddb and Node WebCrypto, actual authority/authentication/repository/React code, and a delayed delivery of a genuinely completed controller projection. It retains checks for full search text, input identity/focus, the actual selected branch, the one matching supplier, scoped session preferences, unchanged ledger/products, explicit Clear filters, and genuine Floor Worker financial denial. No actor, permission or business result is fabricated.

The native trace is historical causal evidence. This agent did not run a browser or claim a full application test run. Root owns final build and full-suite/native validation. The granted single heavy worker has completed and is released.
