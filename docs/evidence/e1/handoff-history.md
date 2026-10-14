# Historical C8/E handoff checkpoints

Archived unchanged from the prior E_WORK_STATUS.md during the final E1 evidence refresh. These checkpoints include superseded running, failure, ownership and pending statements. They are historical evidence, **not current task instructions or readiness claims**. [E_WORK_STATUS.md](../../E_WORK_STATUS.md) is authoritative for the current checkpoint. Preserve failures and their original source scope; do not sum overlapping runs.

---

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

The checkout is on `feat/prototype-e1-location-roles`. Its original docs-first commit is
`d7cdde3e9509997e5d52e073f72b6dba25e9c982`. The actual E1 implementation plus
read-only browser ports is now committed at `e94d7e1`; docs-first recovery
contracts are saved at `7141945` and `2dae6df`. E1 is not yet published as a pull
request; further dashboard/browser/recovery corrections are in progress. Do not
confuse a docs commit with the tested implementation's source identity.

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
- Dashboard Activity now applies its selected-location filter after guarded History selection; genuine StopOffer-backed regression and existing dashboard checks passed3/3 on unchanged549files at `/tmp/e1-root-dashboard-location-proof-v1/`. This actual source fix and regression are not yet committed.
- Native fixture/readiness ports9files are actualRootapplied; all315 originalmatcher names/expectedargs preserved. Corrected18 genuinecurrentRoot browser checks are running after earlier12pass5fail1existingconditionalphoneSkip.
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
`/tmp/e2-*`. Genuine isolated source/calendar20/20 and UI/read-model/settings31/31
passed complete type/lint checks, separately from the older core51/51. They are
source-only preparations, not integrated E2 features. Private migration,
canonical ports, clocks, notification assembly and frozen real physical-label
printing are being prepared by `/root/e2_ui_finish`, with source hooks and
TaskShelfLabel owned by `/root/e2_sources_finish`. Regenerate docs-first changes against final
E1 docs before branching to `feat/prototype-e2-price-updates`.

E3 compact lists, PWA, and an officially researched private-hosting guide are
prepared under `/tmp/e3-*`. They are not an implemented product. Apply E3 docs
first on top of final E2. No hosting account/resource or physical phone
installation has been performed; never substitute emulation for that claim.

Final delivery must include all four pull requests and branch names, final
Ubuntu commands, click-by-click scripts, actual test results, screenshots, and
explicit remaining limitations. No owner action is needed during development.

## Current parallel ownership (2026-10-14 continuation)

- Root is sole actual-repo applier/committer. Current branch E1, code checkpoint e94d7e1, docs head2dae6df. No E1 PR yet; do not stop after E1.
- e1_ci_browser owns real fixture/readiness18 proof then full retained742, plus authored-person binding oracles. Its one serial heavy slot is shared with special migration agent e3_hosting_finish.
- e3_hosting_finish owns only3special legacy migration/storage specs and the completed E3 private-hosting guide. Static compile/lint0; first actual3migration cases1pass2fail (manualdraft setup raced actualnew ID beforeupload); fixture barriers staged, no all-passclaim.
- e1_browser_fixture_ports owns genuine damaged-History quarantine/backup/Reset source pack9. Isolated41affected tests passed with13newcases. Root review requested one additional same-company originalraw gate BEFORE backup because decodeerror preceded old company check; foreign-corruptsource14th newcase/final42 run in progress. Docs clarification2 mustapply/commit before actualsourcepack. Root has not applied recovery source yet.
- e1_shell_finish native14 is GREEN, screenshots20 stillUNRUN. Now additionally staging obsolete dashboard/Notes labels, realOwner-invited first-sign-in tests and genuine idle/expiry test-fixtures in offline/design-v2/design-polish/c5conditional specs. No additionalheavyworker. Resume final capture on exactfinalsourcecommit.
- e2_sources_finish source manifest18 ready `/tmp/e2-price-source-hooks-staging/manifest.json`, SHA6f0990ef5929fa27a124a0f1d5b17a000af76960b007723ee6c12189acaf5c1b, actual20/20/TSC/lint/format0 proofv5. Old separateinvoice4fielddelta nowincluded; DO NOTapplyit twice.
- e2_ui_finish UI22 manifest/31tests green; currently private assembly in `/tmp/e2-private-integration-staging`, noRootimplementationclaim.

E2 docs generator currently uses decision033, now occupied by E1 History recovery; renumber E2 decision034 and E3 decision035 before regenerating against final parent docs. Never blindapply proposed-old-parent docs. Normal commits use all required hooks; no skips. Full latestRoot app/SDK/lint/build and original screenshots/exactCI remain needed after final recovery/projection changes.

## Resume checkpoint — 2026-10-14, actual recovery integration

- Latest committed E1 docs head is `e9d8bf3`; the initial code checkpoint is `e94d7e1`. Nine History recovery production/test files are now applied to the actual checkout, after their docs-first contracts. The actual same-company originalraw check runs before any backup/quarantine; only committed verified recovery is announced, and Reset retirement can be retried without resetting completed data again. Source-only 42 cases passed; integrated app evidence follows.
- Actual Root full app v3 (`/tmp/e1-root-full-app-v3-recovery/`) exited1: **1,287 passed, 3 failed, 0 pending/todo**, all551 frozen sources unchanged, fingerprint `d764b525a9421d89a539a8470015888d0639ce479f9cb24503cc4060f6f7aa30`. Exactly3 failed test files were observed; suite aggregation's four failed suites is not evidence of a fourth failure or unhandled error. The failure/raw JSON remain preserved.
- Those same three unchanged current targets then genuinely passed13/13 in `/tmp/e1-three-failures-baseline-v1/`; this is bounded evidence, not a replacement full-suite claim. Root reviewed/applied3 test-only actual async/DOM completion barriers, preserving all75 original expectations and configured test budgets; production permissions and data were not changed. Recheck/full current suite remains required.
- Native fixture18 v6 exited1:16passed,1failed,1existing conditional phone skip. Actual Ops navhelper overlay then passed2/2; the helper is now applied to Root. No overlapping counts are summed.
- Root reviewed/applied17 retained browser helper/binding files in dependency order: actual sidebar group readiness, configured Manager dashboards/notes, genuine Owner invitation for first-sign-in, controlled actual browser clock for password freshness, current live-action configured author metadata, real Location/All locations topbar labels, and documented exact custom notebook role defaults. All canonical/source/quantity/privacy expectations remain. Special3 storage/migration overlays are still under native validation, not yet Rootapplied. Full742 retained suite remains pending.
- E2 private assembly v2 full-project TypeScript exited0; v3 runtime validation found31pass4fixturefail plus one external PDF-worker fs allow-list collection issue, preserved and being corrected. Final source followup v2 passed31/31 with TSC/lint/format0; source-only8-file manifest `/tmp/e2-source-followup-manifest.json`. None is actual Root E2 implementation yet. E2 docs generator now uses decision034 and includes actual Settings commercial captures/null equality/frozen task labels/History linked-intent preservation. Regenerate against final E1 docs.
- Root cleared only inactive reinstallable dependency caches from two archived approved scratch packages; all lockfiles, sources, evidence and screenshots are retained (`/tmp/obsolete-approved-dependency-cache-reclamation-20261014.json`). No live dependency tree was removed.

The next action is finish actual E1 tests/browser guards, commit normally, capture20 screenshots on the exact source, open stacked E1 PR and check CI, then continue E2 and E3 without an owner approval pause. Final delivery still requires all four PRs and Ubuntu commands.

## Resume checkpoint — 2026-10-14, explicit sign-out and browser ports

- Docs-first `7017de8` records successful explicit sign-out retiring the old route while unlock/reload and signed-in unauthorized direct-link denial remain. Actual store change and meaningful App regression are now Rootapplied (`/tmp/e1-root-explicit-signout-source-applied.json`). Store SHA `96f28f14d635b716e613a21c57d538f8b96865c9b275590300cbc94951ea9392`, App.test SHA `16f987de2184d7acdbc8361831e05a91902853b9403484519b628e09737b26b5`. E2UI is rebasing this actual delta; preserve it on E2 Store.
- Full app v4 (`/tmp/e1-root-full-app-v4-ready`) exited1: **1285/1290 passed, five failed, zero pending/todo** on immutable552/a01dab3dc5d19cd43e507e56ddacd50bc046682e5df0e7f34dfcaa62bebb6d03. Three earlier failures are fixed. Five new errors are real UI startup/save still incomplete at default assertion deadlines in ProductDateEditor, History storage, PricingSettings(2) and ReminderDocumentSettings. Four-file unchanged baseline subsequently passed24/25, with only History loading remaining; Shell is staging actual completion barriers without altering deadlines/authority/oracles. Full final app remains required.
- Retained bounded v8 actual30 (10files) exited1:17passed13failed0skip/flaky/retries, fullTSC/build0; frozen552/80bde7c7384be5723cdba32b8e9e82e4d688ae22dbcd01f19f95cdbda1c5b9d7 and55 local/HTTP asset hashes unchanged, liveRootunchanged. Diagnosed failures: old live usernames, aggregate Lookup without concreteStore, colliding notebook Location labels, prior route surviving sign-out, phone invoice fields before accepted draft/disclosure. Expectations stay intact; current role/location ports4 now Rootapplied, supplier readiness1 pending final review.
- Corrected migration v5 genuinely passed4/4, TSC/lint/format/build0, no retries/skips/unhandled. Source552/a99192fa54fed6d37d64b573229d05edd7850f298329e6c46b848c013621ce85 and55 built/HTTP assets unchanged; concurrent Root changes are explicitly recorded as frozen-candidate overlay, not finalhead proof. Its3 specs are now actualRootapplied with all8 original declarations preserved; long-photo/logo/quota/nonsecure-HTTP remain for fullsuite.
- Five canonical C6 scene/wait helper files are now Rootapplied. Real readonly native IDB status waits retain the original caller `page.waitForFunction` budget. Old historical capture-design-c6-c7/capture-c8 runners still have pre-E1 sign-in contracts and are not claimed current E1 captures; capture-e1 is separate.
- E2 acceptance14 executions/24 screenshots prepared in `/tmp/e2-browser-acceptance-staging/manifest.json`, source-only UNRUN. E2UI found/fixes actual bell task route, retains original normal-only bilingual label preview while task snapshots stay strictly frozen, and coordinates genuine test-only producer completion with Shell; final consolidated pack pending actual186 checks.
- E3 follow-up aggregate `/tmp/e3-followup-manifest.json` SHA45ca424b254163b4d5d2a292cad1cc48f35c79596e22ae5d0adad34e738a64c3:7files; credentialed manifest, real worker placeholder replaceAll, runtime startup/Reset/retirement/migration leases, and original test compatibility. Isolated actual64+18 distinct checks passed82 total with TSC/lint/format0, unchanged631candidate/547Root pins. Not actual Root E3 implementation or physical-device evidence.

Next: Rootreview/apply Shell completion barriers +supplier disclosure; CIagent corrected34 bounded then full742 (oneworker/retries0). Root final fullapp must run with reduced competing heavy load. Finish actual E1lint/build/SDK, normal codecommit, freeze20 exactcommit screenshots and draft stacked PR before continuing E2/E3. Do not stop after E1 or ask owner to test while work is unfinished.

## Resume checkpoint — 2026-10-14, final E1 source gates

- Latest docs head `0e3c331` records narrow Cashier plain unsupported top-level fallback to usableLookup, without weakening parameterized/detail/foreign route rejection. Source App2 +Supplier1 are Rootapplied after that docs commit; App SHA `028bc7dd9efcedb4e4da2d94e7c49a30d5b591d74ea31d7c42a9e7df7c19fffd`. Signout Store96f28f14 remains. New genuine Cashier route3 cases raise expected app total to1294, including signout1. Unit and native actualchecks remain required.
- Source ProductDateEditor expected-success barriers are consistent after guarded one-file apply; actual7/7 GREEN (`/tmp/e1-product-final-completion-actual-v3`), frozen552/c17c7a465dfc2496318cd790b11ce0cf7135bea9dc677c7cfcda016b55683100. Other41 cases passed in the six-file47/48 run; one oldSave failure preserved. Labels8 and App15 had no unhandled section. Never sum overlapping targets as full evidence.
- Corrected retained v9 exited1:30/34 passed,4fail,0skip/flaky/retry/unhandled; exact frozen/live552/7dbd6e7bf1d3b5f31337bc1c80d0d389948664bbc6188f0e7e0ea59691fe5808 and55 built/HTTP assets unchanged. Four remaining failures were Cashier oldfallback behavior and supplier intermediate activeworkspace ID inbothwidths. Rootreviewed/applied strict plainCashier presentation fix plus actualaccepted UIroute→canonical sameID+6draft lines fixture barrier (nofileattachment/reviewstatus fabrication); final focused4 browser checks then full742 scheduled with CIagent.
- Retained audit `/tmp/e1-retained-declaration-audit/summary.json` SHA5e928fbed85ff8b68edf5d7bb28d8f364763e7f2b58234cb929e7e5066900020 proves67 files/227 originaldeclarations/10skipcalls/48registrationloops/89 reachablemodules retained, Nodeattrs sound. Fresh full discovery/execution stillrequired.
- Root final fullapp v5 is started at `/tmp/e1-root-full-app-v5-final` on actualcurrent source. At most2 heavy verification workers now: Rootunit plus CIrepaired4/full742. Agents must keepSource/light-preparationonly until this finalunitfinishes; no unnecessarycompile/build/captures inparallel. Do not callrunning green.
- E2final private assembly is verified186/186 with compiler/lint/format0; immutable608 candidatepins unchanged. Manifest `/tmp/e2-private-integration-staging/verified-assembly-manifest.json` SHAa1561f688e41a05440b100c1302b788ccfa2221e1c707d843d10cf7d54ebfc76,86 files; use consolidatedassembly instead of blindoldoverlays. Preserve actualRecovery9/signout96f/labelproducer50193; a separate App seam rebase onto newCashier028b is underway byE2UI. NoactualRootE2 feature yet.
- E3private composition on exactE2v9 plusPWA/phone21/followup7 is nowowned e2_sources_finish in/tmp, Sourceonly; heavytests paused. Hostingguide finalstagedalready. Phone/homescreen/install/privatehosting notactualclaims.

Continue E1normal codecommit/screens20/stackedPR+CI then E2docs-regeneration/decision034/source86+seam/native14/screens24, E3docs-firstdecision035/guardedcomposition/phonePWA checks/screens/hostingguide. Finish ALL4 PRs, do notstopafterE1. FinalUbuntu guide usesE3branch; noowneractionneededduringwork.

## Resume checkpoint — 2026-10-14, completed unit/SDK/build and interrupted browser

- Completed full app v5 actual **exit 0**, **1,294/1,294 passed**, zero failures/pending/todo; unchanged **553** inputs / `2c4d5709d4538d8d01cd45309712556fc2e6fb849ce4467ae641bdb47a767539`. [Raw result](evidence/e1/app-full-v5.json). Current differences are explicitly recorded: seven unsupported ByRole-option removals; runtime generic-comma formatting with identical emitted JavaScript; three applied retained-browser fixture/readiness files awaiting native proof. Seed/assets and every other input remain unchanged. [Source comparison](evidence/e1/app-v5-current-source-match.json) is not a new unit execution. Recovery is implemented; all **14** genuine recovery cases are included in this completed app run.
- Repaired native v11 actual **4/4**, test/TypeScript/Vite exits **0**, zero skips/flaky/retries/unhandled errors; unchanged frozen/live **553** sources and **55** built/served assets, fingerprint `5d8efcb521cbcd1712cda7dee891507a245e2d2f07e19e812355a2dae7601db2`. [Bounded result](evidence/e1/native-repaired-v11.json). This does not replace complete browser execution.
- [Current Root standard commands](evidence/e1/standard-root-v1.json) completed: actual SDK **75/75** and full `npm run build` **exit 0**; required `npm run lint` **exit 1**, solely Prettier formatting in `src/e1-shell-runtime.ts`. All **553** inputs unchanged. The `b9e004415e3abe1a2cb718d309860a285f71387bee907c9e9b66f13b428d09e8` aggregate includes byte lengths; underlying path SHA-256 values equal native v12. Do not compare unlike aggregate methods as a source mismatch.
- Retained v12 was deliberately interrupted, actual **exit 130**, after discovery **742**. [Attempt-derived classification](evidence/e1/retained-full-v12-classification.json): **95 passed, 4 failed, 1 interrupted, 642 NOT_RUN, zero actual conditional skips**, no retries/flaky/unhandled errors. Raw reporter `skipped=643` combines interrupted plus NOT_RUN; preserve this distinction. Frozen/live source and all **55** local/HTTP assets stayed unchanged. Failed traces remain; the fixture origin and three C5 cases need genuine corrections, not dropped assertions or larger budgets.
- Next: validate the applied **one-file private-original fixture** barrier and Shell's **three-C5-case** Store/pickup readiness pack; required **lint** rerun follows the applied runtime formatting-only correction; finish meaningful affected/complete browser verification; commit E1 normally; capture/review **20** exact-source original screenshots; open the stacked **draft E1 PR** and verify exact-head CI. Final full browser proof/screens/PR/CI are still pending. Do not overwrite old proof directories.
- After E1 gates, continue E2 docs-first/source86 plus rebased App seam/native14/screens24, then E3 docs-first/phone/PWA/composition checks/hosting guide. Finish all four stacked PRs and final Ubuntu instructions without an intermediate owner approval pause. No owner action is needed during development; no hosting account/resource or deployment has been created.
