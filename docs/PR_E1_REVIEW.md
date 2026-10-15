# E1: roles, People and locations

[Pull request #22](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/22) · Branch `feat/prototype-e1-location-roles` · Base C8.

## What changed

Five configured roles replace the former three-role model. People, assigned-location selection, setup/password/second-step flows, registered computers, protected queries and local account revocation now use genuine current browser authority. Owner/Manager retain company-wide access; operational roles retain only their documented locations and actions. Existing invoice receiving-origin behavior, public Cashier product links, note-status Undo and order-cost review remain functional. New/Manual/original attachment transitions protect the old form until the accepted workspace is ready. Pricing, money and immutable original evidence remain intact.

## How to test on Ubuntu

Use the [complete combined-branch installation guide](phone-demo-hosting.md), then run this PR's branch if reviewing E1 alone. From the repository: `git fetch origin`, `git switch feat/prototype-e1-location-roles`, `cd prototype`, `npm ci`, `npm run dev`. Open http://localhost:5174/; Docker and make setup are unnecessary.

1. Sign in as `manager`, password `demo1234`. Choose **Use simulated passkey** when the second step appears.
2. Open **Settings → People**. Six demo people appear. Open **Add person**, choose Floor Worker and locations; save using fictional details. Record the one-time setup code shown once, then sign out and use that account/code to set a password.
3. As Manager, edit a person with a reason. Do not change your own role or deactivate yourself. Deactivation preserves records and revokes that person's local sessions. Owner/Manager safety rules reject removing the last usable Owner.
4. In the small **Demo** menu, switch to the Richmond Hill Supervisor. The picker offers Richmond Hill, Newmarket and All my locations. North York/Warehouse and company-wide All locations are absent. Dashboard has operational cards without supplier money.
5. Switch to Cashier. Lookup works; operational/private detail links stay denied. An exact public Product Code link opens its Lookup search without private Product content.
6. As Manager, open Invoices and start New invoice, then Manual entry. Wait for the accepted form before typing. Details stay on the new draft; attachment and order-cost decisions retain original evidence and disclosure.
7. Repeat the People/picker screens in Persian and dark theme and resize the browser to phone width. Phone dialogs scroll normally.

## Tests added and executed

- Complete actual E1 app source suite: **1,323/1,323 passed**, zero failures/pending. Pricing fixtures are included.
- Separate native permission SDK: **75/75 passed**, zero failures/skips, after correcting its obsolete synthetic reviewer-origin fixture with stronger canonical identity/negative checks.
- Actual full build and required lint: **exit 0**. Source hashes and raw results are retained under evidence/e1/recovered-fixes.
- Existing E1 sign-in/setup/reset browser checks: **12/12 passed**. Final committed capture: **20/20 images**, zero browser errors or geometry findings, all individually reviewed or reverified as byte-identical to individually reviewed originals.
- A complete E1-only browser attempt was deliberately stopped to run every retained assertion on the final E3 stack: **36 passed, 2 interrupted, 740 not run**, not a whole-suite pass. Final combined browser/CI results are recorded separately. Do not sum overlapping scoped runs or infer a complete browser pass.

## Docs updated

Requirements, workflows, screens, decisions, changelog, authority handoff, raw test evidence and the screenshot gallery document current behavior. The owner request and superseded failed diagnostics remain retained.

## Open questions and limits

No blocking product question. Sign-in/passkeys/invites and colleague switching are browser-local simulation; there is no authenticated server or cross-phone synchronisation. Physical phone installation and printer alignment were not tested. Current GitHub CI status is separate from the passing local checks; the initial saved E1 browser job was cancelled before completion. No new stage was merged into main.

[All twenty screenshots](redesign-screenshots/pr-e1/README.md)
