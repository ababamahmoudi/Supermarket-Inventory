# R2c Group 6 — personal notifications

## What changed

A price decision affecting three stores appears as one notification and one unread badge. Opening it marks the current person's permitted members read and opens the real related record. The company badge and inbox use the same `groupedNotifications` selector.

The inbox is 380px wide, bounded to the visible viewport and at most 70% of its height. Its header and two actions remain outside the internally scrolling, padded list. Every item has its own border, a reserved unread-dot position, public product/supplier copy, permitted location names and a nonwrapping company-zone 24-hour timestamp (`Today 14:20`, `Mon 14:20`, or the Persian equivalent). Read items remain available until personally cleared. Empty and read states keep the header in place. Escape closes the popover even after the focused action becomes disabled; reopening starts the list at its top.

## Personal state and permissions

- Clear all sets `dismissed_at` and, if needed, `read_at` on this current person's currently readable notification records. It never deletes a notification, a source business record or another person's state. Retained event keys prevent clock reconciliation from recreating cleared notices; a genuinely new decision has its own event key and remains eligible.
- `notificationReadable` excludes dismissed records, finished/cancelled price tasks, price escalations with no remaining pending tasks, and pending-approval notices whose exact canonical approval has been decided. Existing requester outcomes and sale-request history retain their established visibility.
- The protected read projection emits an opaque `group_key`. For price notices, identity comes from the exact task/version step's genuine same-company source activity, product and effective boundary. A shared decision joins its affected stores; different source decisions remain separate even for the same product at the same instant. A legacy/unattributed task keeps its own identity rather than guessing from its product or time.
- The projection still checks company, stable recipient ID, current capabilities and permitted source locations before grouping. It does not publish recipient IDs, event keys, source-decision payloads, costs or margins. Groups can contain only already permitted branch records.
- `openNotificationGroup` and `clearAllNotifications` resolve the fresh actor again inside the existing protected command. Group opening finds current permitted source members, prefers the person's currently selected eligible branch, marks only that person's current group, and reconstructs the destination from canonical source IDs. Stored href text cannot redirect to another task. A pending UI open checks current actor, request sequence, location and route intent before adopting a related location or navigating.

No pricing calculation, task completion evidence, money, physical movement or notification-recipient routing setting changes.

## Shared presentation contract

The two neutral filled inbox header actions use the shared 44px size contract at:

`notifications-popover > personal-notifications > personal-notifications-header > personal-notifications-actions > button.ui-button.button[data-control-kind="action"]`

Each related-record item is a `button.personal-notification[data-control-kind="disclosure"]` inside `.personal-notifications-scroll`. It has a minimum height of 44px and grows to its intrinsic content height. The scroll grid uses `max-content` rows so multiline product/supplier/location text stays inside its own box. Header and list share the same surface/divider/radius/type tokens as other popovers. Neither the test budgets nor existing button-audit exceptions are changed.

## How to test

1. Sign in as Manager and open the bell. Scroll to the last notification in a short browser window. The title, Mark all as read and Clear all stay visible; text stays inside the individual boxes and dates stay on one line.
2. Click Mark all as read. The badge disappears and the unread dots clear; the panel stays open.
3. Click Clear all. Close and reopen the panel, then reload. The cleared items stay absent. Sign in as another configured person: their inbox retains its own state.
4. In fictional demo data, open Black Tea, Change price, New regular price, All stores. Enter a price that differs at all three stores (for example 7.79 in the unmodified fixture), then Save new price. The bell has one new group listing its three actual stores.
5. Select Richmond Hill and open that group. Its related Richmond Hill price task opens; this person's three records become read. Mark the price task Done elsewhere; that handled store disappears from the group. After every member is handled, the group disappears.
6. Approve an item on Approvals. Its pending-approval notice disappears from the inbox and badge. Repeat the inbox checks in Persian, both themes and phone width.

## Tests and validation

New domain tests cover real three-store grouping, separate source decisions at the same instant, safe fallback identity, mixed read state, personal persistent clear, handled sources, scoped groups, stale-role rejection, foreign task/wrong recipient, canonical route reconstruction and 24-hour timestamps including midnight.

A real IndexedDB Provider test covers one grouped price item, Mark all, Clear all, per-person persistence, and Escape after disabling the focused header action. Browser tests use genuine sign-in and price-change UI operations to prove three task records produce exactly one badge/group, related-task navigation and personal read/clear persistence. The layout browser case checks short-height bounds, fixed header, last-item reachability, 44px controls, nonwrapping dates, intrinsic card content, reopened scroll reset and trigger stability in EN/FA on desktop and phone.

The existing notification routing/privacy and price-update/reminder suites remain intact. The 12-variant local visual proof covers 1440/1000/390px × EN/FA × light/dark with populated, short, scrolled, read and empty states; screenshots remain outside the repository. Source typecheck, ESLint, formatting, build and token-audit results accompany the integration handoff.

## Open questions

None. This remains the existing browser-only prototype; there is no external notification service or deployment.
