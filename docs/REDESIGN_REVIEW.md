# Redesign PR1 review

Branch: `feat/prototype-08-visual-redesign`. PR1 applies [design language v2](design-language.md) to the shared shell/controls and **sign-in, Supervisor dashboard, Cashier lookup, and invoice review**. References guide visual style only; their branding, names, avatars, and data are not copied.

Suppliers overview/detail and other page redesigns are PR2 work after Ali approves this set. Existing operational pages remain functional with earlier page layouts. This PR does not claim all prototype pages have the new design.

## Screenshot matrix

Desktop captures use 1600 × 1080. Phone captures use 390 × 844, English/light. Links reference files under `docs/redesign-screenshots/pr1/`.

| Screen               | English / light                                                  | Persian / light                                                  | English / dark                                                 | Phone                                                 |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| Sign-in              | [English light](redesign-screenshots/pr1/signin-en-light.png)    | [Persian light](redesign-screenshots/pr1/signin-fa-light.png)    | [English dark](redesign-screenshots/pr1/signin-en-dark.png)    | [Phone](redesign-screenshots/pr1/signin-phone.png)    |
| Supervisor dashboard | [English light](redesign-screenshots/pr1/dashboard-en-light.png) | [Persian light](redesign-screenshots/pr1/dashboard-fa-light.png) | [English dark](redesign-screenshots/pr1/dashboard-en-dark.png) | [Phone](redesign-screenshots/pr1/dashboard-phone.png) |
| Cashier lookup       | [English light](redesign-screenshots/pr1/lookup-en-light.png)    | [Persian light](redesign-screenshots/pr1/lookup-fa-light.png)    | [English dark](redesign-screenshots/pr1/lookup-en-dark.png)    | [Phone](redesign-screenshots/pr1/lookup-phone.png)    |
| Invoice review       | [English light](redesign-screenshots/pr1/invoice-en-light.png)   | [Persian light](redesign-screenshots/pr1/invoice-fa-light.png)   | [English dark](redesign-screenshots/pr1/invoice-en-dark.png)   | [Phone](redesign-screenshots/pr1/invoice-phone.png)   |

Captures start with fresh browser storage. Sign-in shows the recent-user row after successful sign-ins. The Supervisor/Branch 1 dashboard includes a demo invoice posted through the actual review controls, so its supplier balance is the computed $169.79. Cashier lookup shows Potato Chips (`0009`), its approved $2.99 price, Taxable pill, and `2 for $5` offer. Invoice review shows a fresh delivery using the fictional seed-derived image after simulated reading. Screenshots illustrate appearance; tests verify actions.

Also review [Choose a new password](redesign-screenshots/pr1/new-password-en-light.png). The capture metadata records screen widths, languages, themes, and absence of page overflow in [capture-results.json](redesign-screenshots/pr1/capture-results.json).

To repeat the invoice example, save [this fictional invoice image](redesign-screenshots/pr1/fictional-fv-20417.png) to your Ubuntu computer. In Invoices, click **Browse**, choose that saved image, and wait for the simulated reading. The image contains only the demo seed's products and amounts.

## What to inspect

- White grouped sidebar in light theme, soft page background, borderless rounded surfaces, thin icons, status pills, and generous spacing. Dark surfaces use v2 tokens.
- At 1080p, the sidebar user menu stays visible without sidebar scrolling. Main content stays within 1440px; lookup within 880px; forms within specified widths. Short numeric values use compact inputs.
- Sign-in has one centered logo/card, Username, Password, show/hide, recent-user chips, help text, and EN/فا. Dashboard has four KPIs and actionable lists, with Notes/Activity in the responsive right panel.
- Lookup focuses hero search and shows approved price prominently. Pending price remains secondary; unapproved products use muted **No approved price yet**.
- Wide invoice review has preview and lines side by side, four summary tiles, sticky actions, and inline blockers. Phone stacks them; tables scroll inside their surface.
- Visible select/file/checkbox/date/time/number controls use styled components. Tab focus is visible; menus/lookup support keyboard actions. Persian mirrors layout while prices, codes, and dates use Western digits.
- **Demo** contains role switching/reset. Theme and **Comfortable text size** persist per user/device. Demo controls stay out of business form fields.

## Click tests for Ali

Use [the Ubuntu run instructions](../prototype/README.md#run-on-ubuntu). Established accounts use `demo1234`: `supervisor`, `floorworker`, `cashier`.

1. **Sign-in:** enter `cashier` with a wrong password and Enter; check the correction message. Enter `demo1234`, show/hide, and sign in. In the user menu, **Lock**, unlock with `demo1234`, then **Sign out**. Tap Cashier's recent-user chip; username fills and password stays empty.
2. **First sign-in:** in a fresh profile, sign in `newemployee` / `temp1234`. **Choose a new password** stays after refresh or direct `#dashboard`. Try `short`, then `password123` in both fields: minimum/common-value errors. Use `NewStorePass2026!` in both fields and **Save password**. Invoices opens; after sign-out, `temp1234` fails and the chosen password works. Business reset preserves it.
3. **Shell:** **Demo → Switch to Demo Supervisor**, select Branch 2 then All branches, use `/` to focus top-bar search. Search `سماق` and Enter; Lookup opens. Click **فا**, inspect RTL, then **EN**. Switch dark theme/comfortable text, refresh, check persistence. At phone width, open/close the sidebar and use the top-bar text-size icon.
4. **Lookup:** **Demo → Reset demo → Reset demo**, then **Demo → Switch to Demo Cashier**. Search `0006`; approved **$1.99** stays large beside pending **$2.99**. `0009` shows Taxable/offer; `0015` shows **No approved price yet**. Search `sumac`/`سماق`, use arrows/Enter, then a complete fictional barcode. Cashier sees no costs, margins, or stock.
5. **Dashboard:** switch Supervisor/Branch 1. Inspect four KPIs plus queue, alerts, invoices, returns, balances, notes/activity. **View** a note, then return. Lavash **Approve → Apply price to: All branches (default) → Approve price**. Lookup `0006` becomes **$2.99** everywhere. Reset; try This branch only: Branch 2 stays **$1.99**.
6. **Invoice:** reset, switch Floor Worker, drop a fictional PDF/photo; wait about 2.5 seconds. Expand **Invoice details**. Sumac cost `1.30` → `1.60` changes price **$1.99** → **$2.99**; restore cost. Choose Juice's **Unknown — add a note** and enter a fictional explanation. Mark Chips short: 4 of 12, **$7.23** deduction/**$169.79** payable. Confirm each date decision/line, **Save as draft**, refresh, then **Post invoice**. Inspect preview, tiles, actions/blockers and Persian/dark/phone layouts.

[The prototype review guide](../prototype/REVIEW_GUIDE.md) adds partial deliveries, the missing-original blocker, returns, labels, notes, and Payables with exact expected amounts.

## Configuration and operational continuity

The owner's updated `seed/arzon-config.json` and `seed/demo-data.json` are authoritative and unchanged in this PR. Their schema omits metadata used by the working operational prototype. [prototype/src/config.ts](../prototype/src/config.ts) adapts them with retained [configuration.json](../prototype/src/compat/configuration.json) and [operational-data.json](../prototype/src/compat/operational-data.json).

Current seed values win. Missing metadata retains previously confirmed **CAD**, **13% HST**, **America/Toronto**, tax profiles and rounding/margin rules, actual received quantities, return pickup/replacement/safe-recovery records, evidence, and ledger behavior. Placeholder metadata uses earlier confirmed values. Missing fields must not turn a partial receipt into a full receipt, add imaginary recovered stock, erase a replacement, or lose financial history. Compatibility data is isolated to this prototype and configurable for another supermarket.

Account rules are browser simulations with a local common-password list. Server authentication, online breached-password checking, employee administration, and server-enforced permissions remain production work.

## Technical validation

Node must be **>=22.22.2 and <23**. From the repository root:

```bash
cd prototype
npm ci
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run e2e
```

`npm run dev` starts review on **5174**. Stop it before Playwright so tests preview the just-built files. A focused run is `npm run e2e -- tests/design-v2.spec.ts`.

Unit suites exercise account guards, password policy, session locks, configuration, keyboard controls, pricing fixtures, scoping, invoice/short calculations, returns, and ledger transactions. Desktop/phone browser checks exercise layouts/actions, RTL, theme/text persistence, approved versus pending prices, and retained operations. The PR validation report records actual run results and distinguishes skipped checks; this guide lists expected behavior without inventing totals.

Ali's decision covers PR1 appearance/usability. PR2 begins after that approval; merging or deploying is separate.

### Recorded results — 2026-10-07

| Prototype check                      | Result                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| TypeScript and Vite production build | Passed                                                                                           |
| ESLint and formatting                | Passed                                                                                           |
| Unit tests                           | 185 passed, 0 failed, 0 skipped                                                                  |
| Pricing unit tests, included above   | 66 passed; includes all 21 current seed cases and 3 retained boundary cases                      |
| Desktop/phone browser tests          | 62 passed, 2 skipped, 0 failed; skips are desktop-only search/layout checks in the phone project |
| Screenshot capture                   | 17 screenshots, no browser page errors or horizontal page overflow                               |

Invoice regression checks preserve the $7.23 short deduction and $169.79 payable. Two later partial deliveries restore $3.62 and $3.61, with exactly 12 physically received units. Persian text, RTL, theme, and comfortable text remain correct after reload.

### Existing GitHub workflow blocker

The unchanged foundation workflow on `main` starts with `make setup`. The owner's latest seed upload omits `company.seed_key` and contains currency/timezone placeholders. Its seeding command fails with `Invalid seed configuration: company.seed_key or --company-key is required.` This happens before the workflow reaches prototype-independent foundation tests.

Read-only checks also reproduced 37 failed/18 passed backend tests using the supported SQLite fallback, five failed foundation frontend tests caused by the placeholder timezone, and three Python lint errors in the uploaded pricing reference. These files match `origin/main` and are outside the permitted `prototype/` and `docs/` changes. A separate foundation repair is required before merging; this PR is for design review. Prototype test results above are separate from that failed foundation workflow.

The earlier prototype PRs were merged into successive feature branches instead of `main`. This PR carries their complete working prototype forward alongside the four redesigned screens. No code was pushed directly to `main`.
