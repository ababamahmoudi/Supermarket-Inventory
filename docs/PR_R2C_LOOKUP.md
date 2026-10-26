## R2c 0.13 — Lookup across locations

Choose All locations in the top bar, then Daily → Lookup. Every active company product remains searchable. The result list omits branch prices and date/delivery details. Select a product to see separate rows for each location you are permitted to read, with that location's approved price, last delivery and open dates. Cashiers receive only public date and delivery hints, never invoice numbers, supplier costs, quantities or staff details. Other companies and unassigned locations remain unavailable.

A concrete location is required when starting a branch action such as Add date or Change price, using the existing action's location choice. Merely browsing never chooses a first branch or writes business records. This supersedes the former aggregate Lookup requirement to choose a Store before viewing products; customer charging at a concrete Store retains its exact local approved price.

Verification: new protected projector tests cover all five roles, company/branch scope, unavailable products, public field allowlists, detached DTOs, forged actors and no business writes. The genuine Cashier route test now asserts visible aggregate product results and per-permitted-Store facts while retaining its complete private-field denial assertions and concrete-Store transition.


# R2c 7.2–7.4 — Lookup and Settings Data

## What changed

- Lookup has configured pricing categories with counts, Taxable and Not approved here yet. Optional AI chips remain. Combined filters are remembered separately for each company, person and location through navigation and reload.
- A concrete location initially lists its delivered, stocked or priced products. Typed search adds matching products from permitted other locations in a separate group. Show the current location's own approved effective price; otherwise show an explicit unapproved-here message and permitted other-store prices. An actual approval here removes the comparisons. A company default alone never establishes local approval. Existing accepted all-store decisions, approved sales and genuine Owner/Manager product creation remain recognized.
- The protected query exposes only product codes, presence booleans and public selling prices. Stock quantities, private financial evidence, invoice identities and staff attribution do not leave it. All locations retains 0.13's catalog and explicit location facts. Long names retain their complete accessible identity and tooltip; visible text fits without overlapping price facts.
- Settings Data has one History destination while retaining actual change attribution.

## How Ali can test

1. Open Lookup at one location. Choose a pricing category; its count includes imported products without AI categories. Combine Taxable, Not approved here yet and an AI chip when available. Leave Lookup, return and reload: the choice stays. Switch people: each person's choice stays separate. Check English and Persian category labels.
2. At a location, search an item stocked or priced only at another assigned location. It appears under At other locations. With no approved price here, the detail shows Not approved here yet and the other permitted prices, without presenting the company default as a chargeable local price.
3. As an authorized Manager, save a new regular price using Only [current location]. The item shows that approved price; comparison prices disappear. Its other location prices and company default remain unchanged. Verify the real price decision in History.
4. Choose All locations. The full company catalog remains available; the selected item shows its explicit permitted location facts.
5. Open Settings → Data. There is one History link, including when a Changed by/date attribution is present. Open it to reach History.

## Executed verification

- 29 unit tests passed across the branch query, combined filters/preferences, unchanged 0.13 protection and shared token audit. Tests cover all five roles, company/assigned-location boundaries, forged identities, returned-reference isolation, private-field exclusion, actual all-store and branch decisions, actual rule-price product creation, and pending/rejected proposals.
- The 12 Lookup variants passed strict shared-control and loaded-glyph/layout proofs at 1440/1000/390, English/Persian, light/dark. Every resulting screenshot was opened and visually inspected. Filter pills match the shared radius; long EN phone names fit without glyph overlap.
- 14 desktop/phone Lookup/Settings cases passed, covering actual price commands, public comparisons, all three aggregate cases and unique History navigation. Six retained price-scope/audit and Persian offer-style cases passed with explicit approved local-price fixtures. Four focused final per-person/Settings checks passed; two final bilingual category cases also passed, including actual person switches and EN/FA selected-category labels.
- Targeted lint, TypeScript and production build passed. No test threshold, timeout, retry or worker policy was weakened. The matrix used one worker.

Useful commands from `prototype/`:

```sh
npx vitest run src/lookup-branch.r2c.test.ts src/lookup-filters.r2c.test.ts src/lookup-locations.r2c.test.ts src/klead-tokens.test.ts
npm run build
npx playwright test tests/r2c-lookup-branch.spec.ts tests/r2c-lookup-filters.spec.ts tests/r2c-lookup.spec.ts tests/r2c-settings-data.spec.ts --workers=1
```

## Docs and open question

Active requirements, screens, decisions and changelog were updated. `docs/open-questions.md` explicitly records the requested 7.3 default pending Ali's confirmation: branch-local initial lists, typed-search discovery elsewhere, and comparison prices only until local approval. This does not grant access to another person's unassigned locations or introduce an inventory count display.

## Reviewed Sale basis follow-up

An actual approved Sale retains its reviewed canonical regular basis at that Store when it ends or expires. Lookup returns to that exact regular price without writing a new approval. The retained creator/decision must be Owner/Manager, product/company/location and current amount must match, and audited currency changes must not reinterpret the snapshot in another currency. A changed company default, another Store/company, unreviewed or stopped Sale cannot establish this local price. The regular snapshot stays canonical per lb even when the Sale was entered per kg.

Verification includes real Start → active Lookup → End → regular Lookup commands, readonly query/no-regular-write assertions, weighed-unit preservation and branch/company/unreviewed/changed-default/stopped/currency negatives. The stated Ali-to-confirm default scope remains unchanged.

If a genuine company-currency change has the exact same recorded timestamp as the price-term review, command order is not proven. Lookup withholds this Sale-basis evidence instead of guessing or relabeling the amount; the read still writes no business record.
