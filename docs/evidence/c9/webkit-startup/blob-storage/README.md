# Confirmed WebKit attachment-storage repair

**Later verification:** the complete be25d01c run passed the actual native WebKit network no-reload case. Its remaining12browser failures all came from one old raw-Blob proof helper, now aligned without changing the app or existing assertions. See the [native result and helper follow-up](../capture-helper/README.md). The original failed/local evidence below remains historical and is not relabelled.

Native CI identifies the startup failure as IndexedDB `UnknownError`, code0: **Error preparing Blob/File data to be stored in object store**, followed by `FileStorageError: unavailable`. The configured/resolved Toronto date was valid `2026-10-19` in every diagnostic snapshot. The [date-format repair](../date-format/README.md) is separate portability hardening; it is not the cause observed in these native runs.

All four shards finished before either diagnostic assessment was reported:

| Exact source | Browser results | Check outcomes |
| --- | --- | --- |
| `f3718812a6c7824a6c202198742ac1f43d7683db` | 790 passed, 50 existing skips, one WebKit failure, no flaky cases | Foundation, static and shards1–3 passed; shard4 and final browser gate failed |
| `a1b37c3e2b1b52c716c7736eb18d7793dbef1d6f` | 788 passed, two ultimately passing flaky cases, 50 existing skips, one WebKit failure | Same terminal outcomes; precise native Blob/File failure recurred |

[Complete native assessments, all-level annotations and original hashes](originals.json). GitHub high-level states arrived much later than actual completed job steps; they did not establish the runner queue previously described. These failures precede the repair below and must not be labelled green.

## Repair and retained guarantees

The public file repository still returns Blobs. New private IndexedDB file/source/preview/backup writes use `binary_encoding: array-buffer-v1` plus explicit MIME metadata. Byte conversion finishes before the existing write transaction opens. Read-back reconstructs Blobs, and existing callers continue verifying content hashes, sizes and raw recovery text before publishing business records or replacing inline originals.

Legacy unmarked Blob rows are read without rewriting or deleting them. Database name/version/stores, references, metadata, company scoping, authentication and original download bytes are unchanged. Unknown/malformed encodings fail closed. The decoder checks genuine cross-realm ArrayBuffer internal slots, rejecting lookalike objects, typed views and SharedArrayBuffers. A shared source/preview remains one shared public Blob when its content and MIME identity match.

Six retained raw-IDB browser inspectors now decode both physical formats: `storage-c6`, `sha256-lan-c6`, `c8-migration`, `c8-layout-display`, `invoice-c4` and `invoice-a2`. All 413 original assertion/poll calls and 22 test declarations remain, as do their timeouts, skips and configuration. The migration probe tracks Blobs reconstructed from actual read-back backup buffers, retaining its original proof that committed raw text/hash verification precedes business publication. Quota failure still prevents publication and retains originals until recovery. [Independent AST audit and exact source hashes](browser-audit/preservation-audit.json.gz).

## Executed local verification

The new `file-database.webkit.c9.test.ts` exercises the real repository against disposable fake IndexedDB. Its put probe rejects nested Blob/File values with the observed native error. The same final test source passes18/18 on the repair; against the isolated original adapter it passes the one legacy-read case and fails17 write-dependent cases. This proves the controlled regression model, not native WebKit execution. It verifies exact nontext originals, distinct preview bytes/MIME/dimensions, shared identity, UTF-8 recovery snapshots, legacy reads without rewrite, scope, content integrity and malformed binary rows. [Original unit proof, earlier attempts and source manifest](unit/README.md).

Repair source SHA256: `file-database.ts` **33d3af5f0a6e46be01dd74964558ef449b618f807d6734941f978fcff30fdb7a**; new test **f9f60624a138ae4daded54db58ecec2dccab07251a9e0e7e65f0c770d22ad707**.

| Actual command/scope | Result |
| --- | --- |
| Initial six-file storage/recovery/startup/SHA/pricing run | 145/145 passed, actual exit0 observed in tool output; original temporary log/report lost during execution transport interruption |
| Same six-file run after reconnect | 144 passed, one History startup-wait failure; actual exit1 |
| Same failed History file, unchanged | 14/14 passed; actual exit0 |
| `npm run build` | TypeScript and production build passed; actual exit0 |
| `npm run lint` | ESLint and Prettier passed; actual exit0 |
| Original C6 storage configuration, all five cases | Four passed, one photo-upload wait failure; actual exit1 |
| Same twenty-photo case, unchanged and isolated | Photo13's reference was not observed within the original five-second predicate; actual exit1. No timeout/assertion was changed |
| Retained migration, invoice original/PDF and no-randomUUID cases, desktop and phone | Initial12/12 passed, actual exit0 observed; original temporary logs lost. Persistent replay11passed, one phone included-original wait failure, actual exit1 |
| Same failed phone included-original case, unchanged | 1/1 passed; actual exit0 |

Scopes overlap; the18 adapter cases and68 pricing checks are included in145 and are not added to it. All23 seeded pricing cases pass within that pricing scope. The complete local replays are mixed; focused passes do not turn those executions into whole-suite passes. Trace review finds the expected one-line invoice shortly after its five-second assertion expired and the uploaded photo's later filename/image without a storage/save error. No rejected storage operation or byte corruption was observed; the reason completion missed those assertion windows is not established. No CPU or resource-contention cause is claimed. [Original persistent logs, exact commands, actual exit codes, trace analysis and before/after source hashes](verification.json). The earlier lost-log observations are explicitly labelled as observations, not recreated raw logs. An earlier twenty-photo run completed its byte/download/reload/History assertions but failed report teardown after two concurrent commands shared a trace directory; its proof and error context remain separate from genuine test passes. A later isolated replay was interrupted with the execution transport; it has no claimed result.

Native WebKit is available only on the GitHub runner in this environment. Local non-localhost requests are blocked before reaching the app, so the LAN test is retained for CI and is not replaced with a localhost substitute. The new WebKit project still runs only its one no-reload case. All worker, retry, skip and timeout settings remain unchanged; no workflow change, reset, deletion, credential bypass, merge or deployment is part of this repair. Require all four shards, all seven checks and the newest exact-head CI run to pass before calling C9 green. C9 remains open and unmerged for Ali to test; use PR26's live checks for the final published commit.
