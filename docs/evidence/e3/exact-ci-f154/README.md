# Exact-head GitHub CI terminal status

Checked 2026-10-15 after the three final feature runs completed. C8 `0c80d38` remains green (run 38447627723). E1 `f9cdd1d` run 38797564811, E2 `b59de22` run 38797563056 and E3 `f1545df` run 38797561832 each passed their foundation job and prototype lint, unit/pricing and production-build steps. Their browser jobs then ended cancelled with the exact failure **“The job has exceeded the maximum execution time of 30m0s”** at `.github:1`.

Every returned terminal check annotation was retained. The three latest runs report **zero browser assertion annotations**: each prototype check has only the maximum-time failure, generic operation-cancelled failure, Node action warning and Ubuntu image notice. This is not a completed browser pass or proof that unreturned full logs contain no failed assertions. Historical earlier runs did have real browser assertions and remain separately recorded.

Separately, the still-running local original `f1545df` phone project found a real `SalesAlerts` release-note `24 cm` wrap; it is being repaired/verified. Do not infer its outcome from the GitHub annotation list or describe the local original complete replay as all passing.

`summary.json` separates exact heads, maximum-time and cancellation annotations, reported browser assertions, and actual job/step outcomes. Compressed terminal JSON preserves original API bodies. `main-status.json.gz` confirms remote main remains `3b6da31d84afa6bb8b454320bb26b4cc6b5454d2`; the all-four snapshot confirms all four PRs are unmerged. No workflow or external resource was changed. The one-line prototype-only timeout proposal remains unapplied and outside the owner-authorized path scope until explicitly approved after the authorized work is concrete.

At 20:27:28 UTC a later E3 documentation head `1bfa28d51163f124b5482f6c34566071bcfea9be` had new CI run 38802075638 in progress. That pending run is recorded separately; it does not alter or replace the exact `f1545df` terminal result.
