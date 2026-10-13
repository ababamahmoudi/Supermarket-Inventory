# Pull request E1 — review guide (source-first plan)

E1 stacks on C8 and defines five configured roles, assigned locations, People/setup/sign-in and current actor enforcement. **Implementation, tests and screenshots are Planned in this source-first document.** No unrun result or owner approval is implied. E2 store price tasks and E3 phone installation/private hosting are separate authorised stages, built without an intermediate review pause.

## What changes

Owner and Manager share former Supervisor company access, including future locations. Branch Supervisor receives an operational dashboard, own-location invoice/Supplier items/Orders purchase costs, pending read-only approvals, requests and a separate sale-cost delivery-hold instruction; no supplier balances, margins, price decisions, credit closing or pickup correction. Existing Floor Worker operational/template/calibration grants remain. Cashier stays Store-only Lookup/custom-note access. People supports invitation/setup, reasoned scope changes, deactivation/reactivation and registered-computer locations, with atomic last-active-Owner/self-change/session checks. Browser data remains separate on each device.

## Run on Ubuntu (planned branch)

No Docker is needed for the browser prototype. The final delivery guide will record the actual branch/PR and verified commands. Intended commands, using the existing repository and Node 22:

```bash
cd ~/Supermarket-Inventory
git fetch origin
git switch feat/prototype-e1-location-roles
git pull --ff-only
cd prototype
npm ci
npm run dev -- --host 0.0.0.0 --port 5174
```

Expected when implemented: Vite shows Local `http://localhost:5174/`. Open it in the Ubuntu browser; leave the Terminal open. If this planned branch is not yet available, use the actual final E3 branch from the joint review guide. Installation failures and current test counts are added after validation, not assumed here.

## Click paths to verify after implementation

1. Sign in as **owner**, password **demo1234**. Open **Settings → People**. Check six configured people, role/location/status/last-sign-in, search and role/location filters. Sign in as **supervisor** and confirm the same Manager identity rather than a seventh fixture.
2. In **Add person**, enter an English name, username and phone or email. Choose Cashier: Warehouse must be absent; choose one or more Stores. Switch role to Owner/Manager: assignments disappear and company scope is explicit. Save: setup code appears once. Close and reopen People: it must not be listed again.
3. Sign out. Sign in with that new username/setup code. Choose a new password; business access waits. A new Branch Supervisor/Manager/Owner must also finish the explicitly simulated Passkey/Authenticator step. Reload mid-setup to check resume. Sign out and retry consumed code: it must fail; use the chosen password instead.
4. As owner/manager edit another person's locations/role with a reason. Check old → new in protected History after commit, without raw authority/setup/session data. Try changing your own role/deactivating yourself and removing/resetting the last usable Active Owner: each fails without partial mutation. Promote a Floor Worker to Owner: they stay Invited until required second-step setup completes, old sessions are revoked, and they cannot yet justify removing the last usable Owner.
5. Open a second tab with the same browser data, sign in as the new person, then deactivate them from owner/manager's tab. The person tab must sign out; even a missed notification/stale route cannot save/read protected data. Reactivate: old session remains revoked, and a new sign-in is required. This does not test logout across separate phone/browser databases.
6. Demo → **rh-supervisor** on the North York demo computer. The safe default is **All my locations**, containing Richmond Hill and Newmarket only, without North York/Warehouse/company-wide selection or a silent first-store fallback. View location dashboard arrivals/sales/dates/returns/requests/notes. Check absence of supplier balances/margins/Payables/Settings/People and decision controls.
7. At Richmond Hill open an allowed invoice, Supplier items and Orders: purchase costs are visible there, while Products catalog costs/margins and supplier Balance/Payments stay absent. Pending approvals are read-only. Try a North York direct link: it must be denied, not silently moved to another store.
8. Branch Supervisor can create/record signed return pickup, but cannot correct pickup, record replacements or close with credit. **ny-floor** retains their existing permitted replacement/ordinary-offer and Labels template/calibration actions without access to Company Settings.
9. At an allowed sale-cost alert, Branch Supervisor can tick **Keep this delivery in the back** and save that instruction independently. The Manager's alert decision stays pending; no Keep/Change/End sale or margin/minimum fields appear for Branch Supervisor. Request a sale: pending is shown beside the approved charge, not charged immediately. Separately open **Change price → New regular price**, propose an amount and **Send request** at one assigned Store. The approved amount/manual flag stay until Owner/Manager's guarded approval; no labels/price execution happens on submission.
10. Demo → **wh-floor**: only Warehouse operations, no selling-price action. Demo → **cashier**: North York/Richmond Hill only, read-only sales/pending display. Device defaults must not broaden either person's assignments; aggregate Lookup needs a concrete Store or explicit comparison.
11. Open an existing saved browser state: people/passwords/forced newemployee setup/preferences and invoice/return/price/files/History must remain. Explicit **Reset demo** states its People effect, restores the six fictional users and revokes replaced sessions. All six Active/setup-complete canonical demo fixtures may reset via demo.reset; custom/invited people cannot obtain this capability by choosing a familiar username or role. Historical author names/records remain unchanged by person edits.

## Verification and screenshots

Planned: full existing pricing/unit/browser checks plus the E1 permission/People/session/migration matrix. People list/Add/Edit, Branch Supervisor picker/dashboard: English light, English dark, Persian and phone. Publish exact source fingerprint, actual counts/failures/skips and individually reviewed original screenshots only after execution. E2 tasks and E3 installed phone evidence remain Planned; no real external account/resource is created.

## What is outside E1

No production backend/authentication, real text/email invitations, real passkey/authenticator verification or remote synchronized records. Browser storage demonstrates role flows, not tamper-proof server security. No physical phone installation result is claimed here. Owner review is joint after all four stacked PRs; no local testing is required from the owner while development continues.
