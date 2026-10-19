# Current C9 handoff — 2026-10-19

The owner approved a separate CI sharding PR rather than raising time limits. [PR25](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/25) merged after all seven checks passed. Main was then merged into C8/E1/E2/E3 (no rebases); all seven checks passed on each exact integrated head. PR21, PR22, PR23 and PR24 merged into main in that order with ordinary two-parent merge commits. Main is `d1fcb4ffdf55e4bb33792aa2564790dbac473e0b`. [Actual merge/check records](evidence/ci-shards-2026-10-19/merge-and-check-results.json).

Only C9 is now authorized. Branch `feat/prototype-c9` starts at that main. Read requirements §38, the C9 section of design-language.md and the original owner request below. C9 is in progress; no C9 tests or screenshots are claimed yet. Scope is prototype/, docs/ and seed/. Settings stays deferred except removing its Notes destination. The new WebKit project runs only the new no-reload test. The four preserved device-access documentation fixes were restored onto C9; keep them in its review summary. No hosting account/resource/deployment is authorized or performed.

The earlier handoff below is retained as historical evidence. Its unfinished-CI, 90-minute-proposal and permission statements are superseded by the owner’s sharding authorization and the completed green merges above. Do not request that permission again or repeat the completed merges.

---

# C8 → E1 → E2 → E3: review handoff

Updated 2026-10-15 21:30 UTC. All four requested implementations, review guides, screenshot galleries and local verification packets are complete and ready for the owner's combined review. Required full GitHub browser checks remain unfinished. Do not call the four PRs fully green, merge them, or deploy. No application question remains. The next owner decision is only the proposed CI file-scope exception described below.

## Branches and PRs

| Stage | PR | Branch | Tested code source |
| --- | --- | --- | --- |
| C8 | [21](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/21) | `feat/prototype-c8-sales-fixes` | `0c80d38` |
| E1 | [22](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/22) | `feat/prototype-e1-location-roles` | `48d9c27` |
| E2 | [23](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/23) | `feat/prototype-e2-price-updates` | `b2988e3` |
| E3 | [24](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/24) | `feat/prototype-e3-phones` | `a6c66dc` |

Each branch includes its predecessor. E3 includes all four. Later E3 commits only publish proof/docs; do not relabel old tests with a new documentation SHA. All PR descriptions were updated through the API with the five required sections, Ubuntu guide, click paths, screenshots, actual test counts and limits; [publication receipts](evidence/e3/final-a6c66dc-validation/pr-review-publication.json). C8 is non-draft and green. E1/E2/E3 remain drafts while required CI is incomplete. Main was confirmed unchanged at `3b6da31d84afa6bb8b454320bb26b4cc6b5454d2`; all four remain unmerged. Check actual remote state before further work. Root's final task is to normally commit/push the completed proof/docs to E3 and confirm clean/published state; if already remote, do not repeat implementation or tests.

## Actual final local checks

- [Final corrected-source application/static packet](evidence/e3/final-a6c66dc-validation/README.md): **1,444/1,444 application tests**, **75/75 SDK tests**, full lint and fresh normal TypeScript/Vite build, each actual exit **0**. No failed/pending cases or application global errors; all595 inputs unchanged. All23 seed pricing cases included. App ran alone2workers. All61 fresh build files exactly match the browser-tested0786 files. Source delta from0786 is solely store.test.tsx, which awaits three unchanged exact configured colors with the default1,000ms wait; no production/pricing/data/permission/asset changes.
- [Final native original-file replay](evidence/e3/final-0786-native/README.md): **72/72 passed** on actual0786, Desktop36 and Phone36, both CLI0, no skips/retries/global errors/not-run. Four entire selected files cover sales, stronger genuine layout negative controls, unit ordering and all-page C8 geometry. All2441source/61Dist/all61HTTP guards passed. Root personally opened untouched EN/FA phone release trace frames; complete24cm/Persiancompound fragments visibly stay together and measured clean. This is not a new complete812-case run.
- [Actual E1/E2 backport checks](evidence/e3/brand-css-readiness-final/README.md): entire store.test.tsx11/11 on each exact branch plus scopedESLint/Prettier0, no errors and unchanged562/576inputs. Earlier posted-heading seven-case checks also passed on their recorded exact E1/E2 sources. Do not call combined E3 results standalone E1/E2 full suites.
- Packet/galleries were independently audited: native690 original artifacts,616JSON attachments,61compressed originals; galleries75/20/28/79 with original hashes. All205 final guide/evidence relative links resolved. All47literal owner blocks and83required-proof columns were preserved; [check](evidence/e3/final-a6c66dc-validation/owner-acceptance-preserved.json). Normal commit hooks remain enabled.

The first final a6 archived app attempt genuinely exited1:1392assertions passed,9suites unloaded due external sharedPDFworker denied by the archive's fs.allow,52original cases unexecuted,SDK not run. Root missed that isolated-runner setting. Its actual outputs remain in the final packet; a fresh complete replay used a private adapter importing unchanged config and adding only the genuine shared dependency directory. No mock/module/timeout/assertion replacement. Formatting failures before the final palette fixture were also preserved.

## Historical outcomes stay historical

- Full f154:769passed/1actual English unit-wrap failure/42original skips, all812accounted for, not a pass. [Complete original reports](evidence/e3/retained-native-full-f154/README.md).
- Scoped431:28passed but actual Persian frame failed Root manual review; old agent PASS was wrong and is explicitly corrected. [Rejected original](evidence/e3/sale-inline-units-native/manual-review.json). Shared formatter/oracle then corrected; [genuine old-fail/new-pass control proof](evidence/e3/persian-compound-units-private/README.md) and final72 are separate.
- Earlier whole574:710/60/42; e47:759/11/42; stopped4524, interrupted7964 and genuine failing first431app remain in their source-specific packets. Never sum overlapping scopes into812pass. Private Persian proof's sole hook-added newline is explicitly mapped to exact compressed original bytes; do not invalidate the recorded mapping or silently rewrite originals.

## CI and exact permission needed

[Corrected code snapshot21:28](evidence/e3/exact-ci-a6c66dc/README.md): E1/E2/E3 foundation, prototype lint, unit/pricing and build all passed; browsers running. The real0786configured-color CIunit failure is preserved separately and the corrected E3 code subsequently passed that actual CIstep. Concurrency-cancelled runs are not timeouts/passes. A final docs-only push may enqueue fresh required checks; query actual new-head status rather than copying the code-source result.

[Earlier exact repaired heads](evidence/e3/exact-ci-f154/README.md) explicitly exceeded30m0s. The recorded complete local browser suite alone took about53minutes. The concrete [one-line proposal](ci-prototype-time-budget.md) changes only prototype job30→90minutes; foundation30, allchecks/workers/retries/skips unchanged. It is unapplied. The [latest owner request](owner-requests/C8-E1-E2-E3-2026-10-12.md) explicitly says “Rules: change only prototype/, docs/ and seed/.” `.github/workflows/ci.yml` is outside that scope. Ask only that precise exception after final authorized publication; no auto-review rejection occurred. Do not treat old generic FixCI permission as overriding this later explicit restriction.

## Owner review and limitations

[Ubuntu installation/run and click-by-click guide](PR_C8_E1_E2_E3_REVIEW.md) has all four branch names, exact Git/Node22.23.3 commands, safe pause for local Git modifications and expected localhost5174. No Docker/make needed. Fresh/reset manager/demo1234 → Use simulated passkey; normal updates preserve changed passwords and fictional records. Guides cover People, Black Tea task, Sunflower seeded request, pot sale, real HW-5012 original, invoice Back and Payables search. [Phone/Wi-Fi/VM/HTTPS instructions](phone-demo-hosting.md). Every browser/device/site address has separate records.

Galleries:C875/E120/E228/E379. E3main capture belongs to90ad, not latest source:18frames freshly reviewed/61exactbyte prior-review reuse. Final0786release frames are separately reviewed. No physical Android/iPhoneHomeScreen/Safari/printer/register/realCloudflare policy verification, hosting account/resource creation or deployment. Scan focuses search; no live camera decoder. Final response must be self-contained with allfourPRlinks/branches, actual results/screenshots, exact Ubuntu run path and only necessary CI exception question.

## Runtime

Repo `/workspace/Supermarket-Inventory`; Node22.23.3 `/workspace/scratch/node-install/node-v22.23.3-linux-x64/bin`, Chromium `/usr/bin/chromium`. Normal commit PATH also `/workspace/scratch/tools-venv/bin`, PRE_COMMIT_HOME `/workspace/scratch/pre-commit`. No jobs remain running; do not rerun green checks solely for docs edits. Four-heavy-worker cap. Root sole tracked writer; helpers `/tmp/apply-staged.py` and `/tmp/convert-proof-packet.py` validate scope/hashes. Onboarding/runtime skills already applied and reusable setupdraft saved; deployment is not claimed.
