# CI202 compatibility checks — receiving and shell helpers

Reproduced on integrated application source `48902e2` using a fresh production build, Chromium, port5196 and one worker. The three originally assigned failures reproduced on desktop and phone before edits. No application, financial, permission, assertion tolerance or timeout behavior changes are included.

## C1/C2 — where the simulated-reading explanation belongs

The removed inline invoice-entry card no longer puts its simulated AI warning on the Drafts queue. The existing regression now verifies the warning is absent from the queue and retained review, present in the actual New invoice chooser, and present after selecting Photo. The Demo menu disclaimer and unrelated-page absence checks remain. Both desktop and phone cases pass.

## C5 — reuse an already open invoice source chooser

`openInvoiceUpload` now selects Photo from the real chooser when an audit already opened it. It opens New invoice only when that chooser is closed, preserving native modal blocking and every original-upload/hash/status/review readiness assertion. The complete existing primary product/date/approval/invoice dialog audit passes on desktop and phone; no C5 geometry or action contract changed.

## Shell readiness — retained language and mobile menu

A real reload at navigation commit reproduces the old race: the helper sees the new document's initial English and returns before the retained Persian preference and actor restore. All four original Supervisor/390px/1440px negative cases fail with the old helper. The repaired helper waits for the actual actor-backed branch picker to mount (not for permission to switch locations), checks the real menu's expanded state and enabled target, and verifies the resulting language/localized shell.

Twelve restored-session cases pass for Supervisor, one-branch Floor Worker and Cashier at 390px/1440px in both browser projects, retaining the same person. Both existing FA390 catalog cases also pass. No sleep, retry, timeout, permission or app source changes are added.

## R2e D / R2f D3 — complete persisted weighed settings and current editor

The persistence regression captures the full original weighed configuration, then compares it with exact deep equality after changing only the three intended display/rounding fields. Its original conversion-factor assertion remains explicit; package/container/barcode/ounce settings must survive unchanged. All original product and approved-price/cost assertions remain.

The regression follows the approved editor's Each/By weight selected state, explicitly switches cost to kg and verifies 11.0000, checks the read-only 7.49/lb price plus 16.51/kg comparison, opens More details for its existing date-tracking decision, and saves. It still requires canonical price 7.49/cost 4.9895 and the operational 16.51/kg display. No money, stock, permissions or product save behavior is changed.

The final six originally failing desktop/phone workflows pass with all repairs applied. The 12 new restored-role cases and two original FA390 catalog cases also pass as recorded above; counts are distinct. TypeScript, affected ESLint/Prettier and fresh production build pass. Final integrated CI is reported on the root branch.

## CI203 — approved Persian mass labels

The three existing Lookup role cases now expect the approved Persian labels `/پوند` and `/کیلوگرم` after switching language. Exact amounts 7.49/16.51, English assertions, bidi isolation and Cashier edit/privacy guards are unchanged. All six Supervisor/Floor Worker/Cashier desktop/phone cases pass against a fresh production build of `88b8f21`; affected lint/format pass. No application source or earlier weighed-editor regression changes are included.
