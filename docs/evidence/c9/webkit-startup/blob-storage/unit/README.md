# Binary IndexedDB unit proof

This package verifies the real `browserFileRepository` with `fake-indexeddb`. A spy rejects every IndexedDB `put` containing a nested Blob/File with the observed WebKit `UnknownError` message. This is a controlled failure model, **not native WebKit execution**.

- Final production adapter: **18/18 passed**, CLI exit 0 (`positive-third.json.gz`).
- Exact same final test against the committed old adapter: **1 legacy-read pass, 17 expected write failures**, CLI exit 1 (`negative-bound.json.gz`). The old source is isolated through a temporary external `.mts` alias config; only three dependency import paths were rewritten. The live production adapter was never replaced.
- Final test SHA-256: `f9f60624a138ae4daded54db58ecec2dccab07251a9e0e7e65f0c770d22ad707`.
- Production adapter SHA-256: `33d3af5f0a6e46be01dd74964558ef449b618f807d6734941f978fcff30fdb7a`.
- Scoped ESLint, Prettier and the production agent's complete TypeScript check passed. Their logs are included. Empty compiler/lint logs are preserved as empty originals, not rewritten to say “passed.” The two scoped checks were repeated once solely to capture their previously unsaved stdout; no unit, native, build or typecheck run occurred during packaging.

Coverage includes nontext original bytes, distinct preview bytes/MIME/dimensions, retained metadata and references, exact UTF-8 backup strings and hashes, both object stores, same-content idempotency, shared public source/preview identity, existing Blob rows with no rewrite, cross-company read denial, corrupted bytes, unknown/missing markers, wrong MIME metadata, plain objects, typed views and genuine foreign-realm SharedArrayBuffer rejection.

`RESULTS.json` catalogues every retained round honestly: the first cross-realm codec/BOM-fixture failures, the later typed-array assertion refinement, the failed temporary config startup (zero tests), and the successful final result. Redundant negatives remain included for traceability. Historical rounds are not bound to the final spec unless their own proof says so.

`originals/*.gz` preserves each original byte-for-byte. `MANIFEST.json` records both compressed and uncompressed hashes and sizes; all gzip roundtrips were verified. `SHA256SUMS` covers every packaged file except itself. To check copied files, run `sha256sum -c SHA256SUMS` in this directory. Native browser CI results belong in the parent C9 review evidence; this package makes no native-browser success claim.
