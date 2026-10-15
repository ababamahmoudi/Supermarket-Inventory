# Complete original browser replay at f154

Both complete original projects ran against the same exact committed `f1545dfb4da4e0ea1a4059dcdd3aa1d59e231f76` source and a fresh normal build. **Desktop: 406 passed, actual CLI 0. Phone: 363 passed, 1 failed, 42 original intentional skips, actual CLI 1. Combined: 769 passed / 1 failed / 42 skipped.** All 812 original case keys were executed/classified; there were no unexecuted, interrupted, retried, flaky or global-error outcomes. [Actual summary](summary.json) and [complete case matrix](all812-outcomes.json) retain the failure.

The failure is the original English phone sale-cost/held-delivery/end test: its delivery-release paragraph splits the raw product-name fragment `24 cm` across two lines at 390 px. The protected heading keeps it together. Original trace, unchanged failure frame/context and extracted geometry are preserved under `actual-failure/`. A subsequent narrow `UnitText` presentation correction and its checks belong to their own source-specific evidence; they do not turn this run into a passing result.

All 2,179 frozen source files, 61 built files and every served output file remained unchanged before/after both projects. Normal build exited 0; no older build was reused. Original assertions, budgets, retry rules and skip conditions were retained.

Phone's raw harness skip-annotation equality is **false** because its current annotations additionally carry source-location metadata. The separate compressed metadata comparison proves all 42 original case keys, skip types and descriptions match, with matching pinned test source locations. Both the raw false guard and derived comparison remain available; neither changes the real native CLI 1 or failing case.

Original reports/logs/lifecycles are compressed unchanged. [Compressed original-byte hashes](compressed-originals-integrity.json) and [packet manifest](manifest-original.json) bind their contents. This is Chromium desktop/phone-width coverage with an explicit simulated insecure HTTP transport fixture, not physical phone installation, Safari hardware, printer alignment, a real register or deployment.
