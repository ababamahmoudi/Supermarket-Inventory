# Source431 sale and layout checks — Persian manual review failed

Both entire selected test files (`c8-sales.spec.ts` and `layout-proof-c6.spec.ts`) ran on exact committed431 source and its fresh build: **28passed**, actual desktop and phone CLIs0, zero skipped/retried/global-error outcomes. Source, build and all61served-file guards passed. [Actual summary](summary.json) and [case matrix](all28-outcomes.json) record this scoped run; it is not a new full812-case pass.

Root opened both untouched actual phone frames. The [English release frame](phone-en-release.jpeg) keeps24cm together. The [Persian release frame](phone-fa-release.jpeg) is **rejected**:۲۴ ends one line while سانتی‌متری starts the next. The recorded raw oracle did not recognise that Persian compound unit, so passing native assertions did not establish correct Persian presentation. [Manual review](manual-review.json) records the finding. The subsequent formatter/oracle correction has its own verification and must not relabel this frame clean.

The [original English failure](phone-en-before-f154.jpeg), actual passing traces, unedited frames, geometry and provenance remain preserved. Trace-on changes evidence collection only; test budgets, retry settings and existing assertions remained unchanged. See [original-byte integrity](compressed-originals-integrity.json) and [original manifest](manifest-original.json).
