# C8 first-import fixture isolation proof

The final e47 retained browser run exposed one setup race: E3’s real service worker served the9039-byte application shell at the URL that the migration fixture expected to be a54-byte inert page. The extra application could import data before the backup failure hook was installed. The original failure and network/body diagnosis are preserved here; no production error-handling change is justified by this evidence.

The test-only correction awaits service-worker unregistration for this explicit first-import setup, leaves the controlled application through `about:blank`, then verifies the actual inert title, absence of module scripts and absence of the app top bar before deleting only the authority database. Legacy source, immutable files, existing backups, fault injection, verified-before-publication, exact-state/history/hash, privacy and real recovery assertions remain. Service workers stay enabled for the actual application and all independent PWA tests.

Actual bounded result: **4/4 passed**, no skips/retries/flakiness/global errors; desktop and phone both ran the two original migration cases. CLI exit0; original60-second test and5-second assertion budgets; two workers. Source, built files and all61served asset hashes remained unchanged. The normal build was reused explicitly from exact e47 production; no fresh build is claimed. Only the included single test-fixture overlay differs from the1841-file base source.

This is a scoped correction and replay. The original full812 report must keep its actual results. Do not describe this packet or any later evidence combination as a single clean812-case run. Raw JSON/log, original failure context, original network diagnosis, exact patch, per-file pins, successful migration attachments and runner are included.

The exact patch is stored as `fixture.patch.gz` to preserve its context spaces through normal whitespace hooks. [Integrity pins](fixture-patch-integrity.json) record the original and compressed hashes.
