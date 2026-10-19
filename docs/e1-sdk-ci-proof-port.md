# Retained E1 SDK and native browser proof

This port is implemented. The final actual SDK run passed **75/75**, native authority passed **24/24**, and the separately registered native shell passed **14/14**. All had zero failures/skips; local native runs used zero retries. See [exact fingerprints and raw results](evidence/e1/verification.json). These do not substitute for the still-pending retained full browser suite, damaged-History recovery and original screenshots. Earlier failed and source-only checks remain historical evidence.

Apply these files under prototype/. The five src/e1-authority/*.test.mjs suites
register the original64 cases directly in Vitest. They retain each title, all
fixture operations and all311 assertion calls across unit/native source. Imports
now reference actual flat TypeScript SDK modules. The lifecycle suite uses the
official fake-indexeddb dev dependency, not a private installation. Its genuine
repository/authentication fixtures include the FW dashboard denial and real
BS/company-role grants. Initializer cases read the actual seed/demo-data.json,
including the exact configured demo users/computers; no stale TMP fixture copy
can make a changed integrated seed silently pass.

The runner port adds a separate vitest.e1-sdk.config.ts, with actual Node
semantics, no DOM-only React setup, all five original suites, one worker and no
fixture/source substitution. It avoids the existing setup's unconditional
HTMLDialogElement access. Add test:sdk as “vitest run --config
vitest.e1-sdk.config.ts”, and chain it after the current original “vitest run” in
npm test. Both are actual registered test suites; no empty wrapper, filter, skip,
authority proxy or shortened assertion is added. The old Vitest include and UI
setup remain unchanged. The package-script port is saved beside this document.

The Playwright spec registers12 actual native cases. Existing desktop and phone
projects discover24 executions; collect actual --list counts after integration.
Each gets a fresh browser context and runs the real prerequisite transactions
before its selected assertion family. The repeated prerequisites preserve native
concurrency/last-Owner/deactivation/migration/reset state without making later
cases skipped when an earlier case fails. Cases use the actual BrowserAuthority-
Repository and authentication/People services, actual native IndexedDB and
BroadcastChannel, and original private-backup verification. Original test-only
initialization is explicit fixture setup; it is not a production escape hatch.

The worker fixture compiles actual src/ flat SDK modules using the installed
TypeScript and pinned Node22, then serves only those compiler outputs and current
configured fictional seed on an ephemeral loopback origin. It appends .js only
to emitted relative imports. No test route, raw state, auth record or compiled
fixture is added to production/public assets. The test records source hashes and
actual compiler exit, checks source/seed unchanged, and closes owned context,
server and temporary output. The real browser launcher remains the repository's
Playwright configuration (installed Chromium override when needed).

Verification requirements and completed checks (the linked evidence records exact source):

- Scoped formatter/lint and full semantic compiler, fixing real integrated type
  boundaries rather than replacing the SDK with the prepared TMP graph.
- Actual Vitest discovery and all64 retained cases, official fake-indexeddb.
- Actual Playwright --list and all24 project executions (12 logical families),
  retries0 for first proof, source/compiler attachments and actual exit/counts.
- Retained full unit/browser suites and the actual E1 role/private-DTO/new-screen
  flows remain required. These SDK tests do not substitute for those app proofs.

The ports preserve physical foreign-origin invoice post/receiving/reviewer
denials, active exact-draft System witness rejection of spread/cloned/retained
values, repository lifecycle/accepted commit durability, and preferences retry
without directory/credential resurrection. Native device installation, camera,
HTTPS deployment and E2 source/notification/task app integration stay separate.
