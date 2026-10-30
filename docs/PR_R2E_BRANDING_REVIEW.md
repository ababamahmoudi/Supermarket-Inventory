# R2e E — Maker branding review

Klead remains secondary to the configured store. The original SVG/PNG files are copied without modification to `prototype/public/brand/klead/`, including their clear-space README.

1. Open the built prototype in a fresh browser profile. Sign-in shows the store logo/form and a small **Powered by Klead** line. The tab reads **Super Arzon · Klead** and uses the supplied Klead icon.
2. Sign in as `manager / demo1234`, complete the simulated passkey step, open **Settings → About** (the last settings item). See the configured store name, **Version 0.2.0**, **Made by Klead** and the original full logo. No empty support line appears.
3. Switch to Persian and dark theme. Store title and surrounding attribution translate; the maker's proper name stays Klead and the supplied full white logo appears. Use **Lock**: the form keeps the same small maker line below it.
4. Open **Timesheets → Print**, a supplier **Order → Print**, an existing signed **Return pickup memo → Print**, and a supplier **Payables → Print summary**. Each staff document includes a small **Made with Klead** footer. Timesheet/internal paper remains bilingual; English supplier documents remain English.
5. Open **Labels**, print-preview both Regular and Promo styles. They retain the store identity and have no maker footer.

Configuration uses `branding.maker` plus `branding.maker_support`. The default support is empty. A null maker, `enabled: false` or blank name hides all maker attribution and restores company icon fallbacks. Another maker may supply its own name, public logo/icon paths and support without application-code changes. Existing saved data missing the optional block reads seed presentation defaults without a migration/write. The build generates native install metadata from config; the running app updates title/favicon from its current public config.

Validation: the focused unit suite covers legacy-store preservation, public projection, a different store/maker/support/assets, omitted/disabled/blank maker, icon fallback, English-only and bilingual staff footer policy. Browser scenarios cover 1440/1000/390px in EN/FA and both themes, including sign-in, title/icons/manifest, About's last menu position, asset loading/clear space, and lock. Exact executed results are supplied with the integration report. No physical printer, native icon refresh or hardware installation is claimed.

Maker file ownership is explicit in `maker.asset_identity` (default Klead). Replacing only `maker.name` suppresses inherited logos/icons rather than displaying another maker's lettering; supply replacement files with the matching asset identity, or a complete new maker block.

Executed on the E worktree: 42 focused unit tests across maker/PWA/worker/document/token suites passed; all 12 branding browser scenarios passed; the unchanged native PWA/cache/offline test and the affected exact Settings-group/button contracts passed. The final build also passed the 390px Persian-dark scenario. Whole-prototype lint (ESLint and Prettier) and TypeScript/production build passed. Supplied asset verification confirmed all 13 files are byte-for-byte identical to the upload. The final PR-wide CI result is owned by the integration report.
