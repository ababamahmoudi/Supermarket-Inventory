# C8 → E1 → E2 → E3 implementation status

This is an implementation handoff, not the final review report. The owner's
complete request is in `owner-requests/C8-E1-E2-E3-2026-10-12.md`. Continue all
four stacked pull requests without an intermediate owner approval pause.
Change only `prototype/`, `docs/`, and `seed/`. Do not merge the new pull
requests or create hosting accounts/resources.

## Completed C8

- C6 and C7 were merged in the approved order after their checks passed.
- C8 is ready for review as [PR #21](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/21),
  branch `feat/prototype-c8-sales-fixes`, head
  `0c80d38e8e6920c57a5a390cb1418c93aed5b179`.
- Exact-head GitHub CI run `38447627723` passed both jobs. See
  `PR_C8_REVIEW.md` and the committed C8 evidence and screenshots.
- Main remains `3b6da31d84afa6bb8b454320bb26b4cc6b5454d2`.

## Current E1 work

The checkout is on `feat/prototype-e1-location-roles`. Its docs-first commit is
`d7cdde3e9509997e5d52e073f72b6dba25e9c982`; the implementation remains in the
working tree and is not yet an E1 pull request. Do not confuse that docs commit
with the tested implementation's source identity.

Implemented: genuine IndexedDB authority and business transactions; configured
roles and location permissions; People/invitation/password/second-step flows;
registered computers; scoped dashboards and queries; protected files; migration
and reset; preserved invoice, pricing, returns, notes, and label workflows.
Read-only authority service queries no longer republish the app snapshot, and
they recheck persisted authority after an asynchronous result. Invitation codes
survive the creator's directory refresh while identity changes still hide
private state.

Actual validation as of this handoff:

- Full app v2 passed **1,275/1,275**, zero failures/skips, actual exit0 and all546 source files unchanged: `/tmp/e1-root-full-app-v2/`, fingerprint `bba505d64531aad3c5a08af8ae14a813cf3265b515b38507f5f2223d295fc58e`. Previous v1 1,264/1,271 with seven failures remains preserved; all seven were fixed with actual production/fixture/readiness changes.
- Final required `npm run lint` and `npm run build` both exit0 on unchanged545 inputs: `/tmp/e1-root-required-static-build-v6/`; production55 asset hashes retained.
- Native authority24/24 passed on the same current full-app fingerprint: `/tmp/e1-current-browser-proof-v1/`; final SDK75 also passed75/75 at `/tmp/e1-root-sdk-final-v1/` on unchanged545 inputs.
- Controller protected-read4/4 and Return photo13/13 passed. Notes6/6, Undo7/7, financial9/9, invoice UI/orders31/31 and corrected original-document7/7 earlier genuine focused runs remain separate evidence, not summed.
- Native shell14 v4 passed14/14, zero skips/flaky/retries and actual build/test0; source547frozen/live and55asset hashes unchanged, ownedserver alive through final checks. Previous v3 12pass2fail phone readiness result is preserved.
- Read-only canonical IndexedDB ports37files/126reads+1readinesswait are now Rootapplied with all1658originalmatcher calls/expected arguments retained. Mutation/migration ports and first full runtime remain pending.
- Retained browser742 discovery is exact. Many original tests still inspect retired live localStorage; a test-only genuine canonical IndexedDB evidence-reader port is being staged. Explicit preload/migration/quota mutations require individual treatment. No production compatibility mirror or authority bypass is allowed.

Do not add overlapping targeted counts into one total. Record each run's actual
exit, source fingerprint, failures, skips, and unhandled errors. Root is the
sole working-tree applier; source-only agent manifests under `/tmp` must match
both current baselines and staged hashes before application. Keep at most four
heavy test/compiler/browser workers, with one serial worker per agent.

## Next concrete actions

1. Finish runtime/migration test ports and genuine damaged-History quarantine/recovery. Fullbrowser diagnosticexit130 retained12passes7failures1interrupted722notrun (not intentional skips). No productionstorage mirror or authority bypass.
2. Full app and required lint/build passed. Finish final SDK75 and retained browser regressions on the final source.
   Frozen test copies must include the real `docs/return-policy.md` raw import.
3. Commit normally, push the E1 branch, and open a stacked pull request based
   on C8. Verify exact-head CI and the full retained browser suite.
4. Capture and individually review the five E1 scenes in English light,
   English dark, Persian, and phone width. The location picker must show the
   actual Richmond Hill/Newmarket Branch Supervisor's restricted options.
5. Continue E2, then E3; do not stop for owner review after E1.

## E2 and E3 preparation

E2's price-task core, source adapters, notifications, and UI are prepared under
`/tmp/e2-*`. Some isolated core checks passed, but the actual source hooks,
clock, migration, notification sink, frozen labels, and runtime ports are not
yet integrated in the repository. Regenerate docs-first changes against final
E1 docs before branching to `feat/prototype-e2-price-updates`.

E3 compact lists, PWA, and an officially researched private-hosting guide are
prepared under `/tmp/e3-*`. They are not an implemented product. Apply E3 docs
first on top of final E2. No hosting account/resource or physical phone
installation has been performed; never substitute emulation for that claim.

Final delivery must include all four pull requests and branch names, final
Ubuntu commands, click-by-click scripts, actual test results, screenshots, and
explicit remaining limitations. No owner action is needed during development.
