# Actual post-print application verification

Exact source: `e47e0c665bc85cbb619f9ab4c946a7dfe6d27e8a`.

- Application: **1,426/1,426 passed**, actual process exit **0**, 140 files, no failed or pending tests, no unhandled errors at run end or process exit. The normal default reporter, JSON reporter and a read-only external error observer ran together.
- Separate SDK: **75/75 passed**, actual exit **0**. Normal lint/formatting: exit **0**. All 23 seed pricing cases are included in the application suite.
- Every pinned source, seed, asset and instruction input remained unchanged; the two runs used identical pinned inputs.

An earlier JSON-only application run had all 1,426 assertions pass but actual process **exit 1**. That run is classified as failed. Its reporter did not retain the cause, so no cause is invented here. The unchanged-source diagnostic rerun exited 0 with an empty global-error list; same-head GitHub unit/build steps also succeeded. No error checking, assertion, timeout or exit status was disabled or rewritten. Original failed output is preserved alongside the successful diagnostic, SDK and lint outputs.

[Verification and exact raw-file hashes](verification.json) identify each compressed original. Gunzip a `.gz` to obtain its original bytes. The two Python runners record the actual child-process exit codes, which are the results reported here. This packet does not prove a full browser pass; that job remains separate.
