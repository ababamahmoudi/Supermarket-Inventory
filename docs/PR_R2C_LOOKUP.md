## R2c 0.13 — Lookup across locations

Choose All locations in the top bar, then Daily → Lookup. Every active company product remains searchable. The result list omits branch prices and date/delivery details. Select a product to see separate rows for each location you are permitted to read, with that location's approved price, last delivery and open dates. Cashiers receive only public date and delivery hints, never invoice numbers, supplier costs, quantities or staff details. Other companies and unassigned locations remain unavailable.

A concrete location is required when starting a branch action such as Add date or Change price, using the existing action's location choice. Merely browsing never chooses a first branch or writes business records. This supersedes the former aggregate Lookup requirement to choose a Store before viewing products; customer charging at a concrete Store retains its exact local approved price.

Verification: new protected projector tests cover all five roles, company/branch scope, unavailable products, public field allowlists, detached DTOs, forged actors and no business writes. The genuine Cashier route test now asserts visible aggregate product results and per-permitted-Store facts while retaining its complete private-field denial assertions and concrete-Store transition.
