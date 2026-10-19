# Grocery divisor save acceptance

The retained full native run clicked Save and started reload 3.688 ms after the click returned. The real asynchronous authority transaction had not yet been accepted; the refreshed Grocery divisor was still 0.65 instead of the submitted 0.50. The pricing command already awaits its durable authority transaction. The existing new-category Settings test explicitly checks the canonical saved category before refreshing for this reason.

This fixture now waits for the actual configured company business record to contain Grocery divisor 0.50 after the real UI Save, then performs the original refresh and every original live-price, saved-price, invalid-divisor, invalid-money, margin and badge assertion. The evidence helper opens only a native readonly IndexedDB transaction. It does not initialize a database, authenticate a user, bypass a permission check, or write business data.

The original case passed on both original projects: Desktop Chrome and iPhone 13 Chromium. The actual Playwright process exited 0, with 2 passed, 0 failed/skipped/flaky and 0 retries. The original 60-second test and 5-second expectation budgets were retained, with one worker. Raw reporter output and the original failure/trace events are retained here.

The run transparently reused the exact e47 normal production build (actual build exit 0), independently copied and checked all 61 built files and their served HTTP bytes before and after. Its production source was unchanged. Only the recorded test fixture overlay differs. The private runner, input manifest, exact patch, source hashes, distribution hashes and final execution guards are retained. This is a bounded two-case follow-up, not a replacement claim that the original complete browser run passed.
