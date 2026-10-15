# Corrected-code CI observation

This is a read-only GitHub API snapshot at **20261015T212827Z**, before later proof-only documentation publication. [Structured results](summary.json) and the original raw response archive retain exact source heads, all returned job steps, concurrent-run cancellations, annotations, main state and PR bases. All four PRs remained unmerged and main matched `3b6da31d84afa6bb8b454320bb26b4cc6b5454d2`. [Archive integrity](integrity.json) records its original bytes.

The source heads are C8 `0c80d38`, E1 `48d9c27`, E2 `b2988e3`, E3 `a6c66dc`. C8's complete required CI passed. The corrected E3 unit/pricing and build steps succeeded and browsers started; the complete current-source browser/required-CI result was still unfinished. E1/E2 statuses are recorded separately in the exact snapshot. Do not call a running or superseded cancelled job a pass or a 30-minute timeout, and do not infer absent browser failures from incomplete API annotations.

The [original 0786 color assertion failure](../exact-ci-0786/README.md) and [older explicit maximum-job-time failures](../exact-ci-f154/README.md) remain separate evidence. The [one-line prototype-only90-minute proposal](../../../ci-prototype-time-budget.md) remains unapplied outside the owner's allowed folders. No workflow, PR, branch or deployment was changed by the API observation.
