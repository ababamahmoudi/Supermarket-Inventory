# C9 expectation alignment

The owner authorized updating retained tests when C9 explicitly replaces their old expected behavior. [Source hashes and actual local execution results](source-and-results.json) bind these checks to the expectation-alignment patch on `390fec0`, rather than relabelling the earlier screenshots or full-unit run.

Plain-text logs follow the normal repository whitespace/end-of-file hooks. Where hooks changed whitespace, matching `.gz` files preserve the exact original bytes and their uncompressed hashes are recorded in the source/results file. Screenshots are unedited originals.

- Return author: read the North York worker's display name from the demo identity.
- Notes: require the real Persian “Search notes” translation; while Deli is selected, find both a built-in note and a note in another custom notebook, then clear search and recover Deli's measurement.
- Shared prices: one outer test identity; inspect the native browser accessibility tree for exactly one announcement of each amount and no named/role-bearing nested copies.
- Offers: verify $2.99 in Price and “2 for $5.00” in Offer, including phone rows.
- Other obsolete expectations: keep notebook-management button/dialog coverage on Notes and prove Settings has no Notes destination; recognize counted Branch request tabs; distinguish the required 20px toolbar-to-list space from the 12px wrapped-control gap.

[Local executions](source-and-results.json): price unit 6 passed; manual-price browser 2 passed; focused desktop/phone browser 8 passed; spacing/accessibility desktop/phone browser 10 passed; normal lint and build exited 0. These browser scopes overlap and are not summed as unique coverage. Workers, retries, skips, time budgets, business assertions and the invoice-code wrapping guard remain unchanged.

All four shards of the [earlier CI run](earlier-complete-ci.json) completed: two assertion failures and two 30-minute time limits. [Deduplicated failure annotations](earlier-ci-failures.json) preserve the actual results. The new patch has no green exact-head CI claim.

## Separately approved real bug fix

The unchanged genuine invoice-posting fixture reproduced the Product phone failure. At 390px the new regular-price explanation split `C8-QA-SHORT-LAYOUT` after `C8-QA-`; the separate Last received link stayed whole. [Original failing phone screenshot](phone-invoice-code-wrap.png) and [text-node line measurements](phone-invoice-code-wrap.json), `codeOccurrences[0]`, show the two lines. This violates design hard rule 7 (codes stay whole), so the assertion is retained. The owner explicitly approved “Fix the wrapping and continue (Recommended).” The narrow fix keeps only the invoice-code fragment together, allowing the surrounding prose to wrap at spaces. Pricing, data, invoice-posting gates and the original geometry guard are unchanged.

The same genuine fixture and original inspector now pass: [fixed phone screenshot](phone-invoice-code-fixed.png), [line measurements and unchanged layout checks](phone-invoice-code-fixed.json), [actual CLI output](phone-invoice-code-fixed.txt). The invoice reference occupies one line, and the original inspector reports no word-break, overlap or overflow failure. The reviewer opened the unedited fixed phone image. [Build](wrap-build.txt), [format](wrap-format.txt) and source hashes are recorded separately from the pre-fix executions.

The subsequent original six-case all-pages layout replay passed five cases and failed English at 1440px: [actual run](c8-all-pages-first.txt). In Suppliers → Supplier items, the invoice reference extends beyond its column into Edit. [Unedited row screenshot](supplier-items-overlap-row.png), [full screenshot](supplier-items-overlap.png) and [native measurements](supplier-items-overlap.json) confirm a real 134px cell / 168px reference-button mismatch. The original guard is retained. Owner direction for this separate layout defect is pending; no green full-layout or exact-head CI claim is made.
