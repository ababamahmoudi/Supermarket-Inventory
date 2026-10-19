# Native WebKit success and retained proof-helper alignment

All four shards, all seven checks and CI run39290234090 finished on exact source **be25d01c613a467da100111bfb5addb3b68a30b6** before preparing this follow-up. Native WebKit **passed** its single no-reload case. Foundation and prototype lint/unit/pricing/build passed. Browser totals were779passed,12failed,50existing-skipped,0flaky, across841cases; the final browser gate correctly failed.

Every failed case rejected the same newly approved private storage format in `scripts/capture-c8-proof.mjs` → `readC8OriginalSHA`. The helper read raw IndexedDB and called a valid ArrayBuffer original “missing” because it required `record.source instanceof Blob` before hashing. This does not establish missing or damaged application evidence. Failures were the English/Persian C8 cost-up posting cases on both projects (four cases), and E3's390/430English/Persian layouts on both projects (eight cases). All original byte/hash, invoice-money, posting/Keep/End, delivery-hold and layout assertions remain.

The correction changes only that helper: accept an unmarked genuine legacy Blob or an explicitly marked `array-buffer-v1` with genuine ArrayBuffer internal slots and valid MIME metadata. Unknown/malformed encodings still fail closed. Reconstruct the same bytes and retain the existing native SHA-256/hex oracle and missing-evidence error for invalid records. The helper's35existing assertion/poll calls, controls and source outside this function remain unchanged; app code, test files, configuration, retries, workers, skips and time budgets are unchanged.

Corrected helper SHA256: **7abfe1055b246becf73a0de14835b80a1b42c026732f460658af2e3dc14b5b04**. Production adapter remains **33d3af5f0a6e46be01dd74964558ef449b618f807d6734941f978fcff30fdb7a**. [Source-bound audit, original CI, native WebKit proof and verification manifest](manifest.json).

## Native WebKit proof

The committed Playwright configuration assigns exactly one WebKit case, `c9-no-reload.spec.ts`, to shard4. Its source contains one unconditional case and no skip/fixme guard. The exact shard4case plan includes it; test/config sources match `git show be25d01c:<path>` byte-for-byte. Shard4completed with193passed,13existing skips,4failed; its only failures were the four E3 cases. No flaky case was reported. This establishes native WebKit's actual pass, including its post-sign-in no-reload assertions, independently of synthetic unit modeling.

Native diagnostics show actual network origin `http://10.1.0.215:5174`, the normal second sign-in step, no storage banner, no native exceptions and no browser errors. The [earlier byte-storage unit model](../blob-storage/README.md) remains separate evidence; its local wait failures and runner artifact interruption are not relabelled as successes.

## Executed follow-up checks

Scoped ESLint and Prettier passed with exit0. The original12affected desktop/phone C8/E3 cases **passed12/12**, actual exit0, in1.9minutes, with no retries, skips or changed assertions/budgets. [Actual command, final outcome, original logs and before/after source hashes](manifest.json). No new browser case or skip was added. Discovery remains841cases, with WebKit limited to its one case.

New exact-head CI must still pass all four shards, all seven checks and the newest CI run. **C9 remains open and unmerged for Ali to test.** Use PR26's live Checks for the final published head; the failed be25d01c run is historical evidence.
