@AGENTS.md

# Working rules for Claude (from Ali, October 2026)

Ali is not a programmer: Claude builds, tests and explains; Ali reviews and decides. Use plain English and short steps. End each task with:
1. What I did
2. How to test it, click by click
3. What isn't done
4. What you need from me

## Work on your own
- Do the whole job without asking: edit, run tests, commit, push the branch, open or update the pull request, then check the GitHub checks yourself (`repos/ababamahmoudi/supermarket-inventory/commits/<sha>/check-runs`; failure messages from `.../check-runs/<job id>/annotations`). Fix failures and push again until every check is green. Never ask Ali whether CI passed; find out and tell Ali.
- Ask Ali only before: merging into `main`, force-pushing or deleting branches, spending money or creating cloud resources, putting real data or keys anywhere, or a product decision the docs don't answer. Otherwise pick the sensible option, note it in the pull request, and keep going.

## Rules (don't break these)
- Never merge without Ali's test and his OK. Push branches and open pull requests only.
- One pull request at a time; Ali tests each one before the next.
- Real invoices, real export files and screenshots may be shared with ChatGPT and Claude in chat for private review. They must never be committed to GitHub, seed data, tests, fixtures, docs or commit messages. Use invented supplier/product names, amounts and images in repository examples. `keys.env`, answer sheets and the invoice-reader kit's work folders never go to GitHub, seed data, test fixtures or chat. API keys stay only in `keys.env` on Ali's Mac, never in browser code or the repo. Don't prefill answer sheets from your own reading. Fictional fixtures may be committed; never derive them from private invoice data.
- No paid cloud resources without Ali's "yes".
- Update a test only when it checks behaviour you changed on purpose. Never weaken a test to make it pass.
- Pull request description: What changed · How Ali can test it · Tests added · Docs updated · Open questions.
- Commits end with the attribution lines the session gives you.

## Ali's product rules (October 2026)
- Everyone (including Cashiers) can add dates, and the record shows who added them.
- Everyone (including floor workers, supervisors and cashiers) can create a return with photos.
- Price updates have only Seen and Done, each with who and when.
- A note's author can't mark their own note as seen. A notebook setting decides who can mark its notes done.
- Names you can click are blue. Empty values say "Not added". Fields look editable everywhere. A wrong password is cleared. Each item in a list sits in its own box. Tabs never wrap (they scroll sideways).

## How Ali tests
From `prototype/`: `npm ci`, `npm run build`, `npm run preview` (port 5174), then Safari or Firefox on the local network. `vite preview` keeps the old file list after a rebuild, so restart it.

## Working notes
- Keep the conversation lean: targeted searches and line ranges, not whole large files.
- On a small machine (for example a 2-CPU container) a full `npm test` run gives random timing failures; re-run the failed files alone with `npx vitest run --maxWorkers=1 <files>`.
- Browser tests: `npx playwright test --project=desktop|phone <spec> -g "<name>"` (set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` where Chromium is preinstalled). Run the affected specs locally; CI runs everything in 4 shards (about 35 minutes) and cancels the previous run on each push.
- `scripts/c5-browser-proof.mjs` audits many pages: top-bar controls have no border, phone rows have one chevron, nothing is clipped, and text actions keep the button contract. A clickable row that opens details (not an action) declares `data-control-kind="disclosure"`.
