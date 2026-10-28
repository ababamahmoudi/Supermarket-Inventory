# CI202 compatibility checks — receiving and shell helpers

Reproduced on integrated application source `48902e2` using a fresh production build, Chromium, port5196 and one worker. The three originally assigned failures reproduced on desktop and phone before edits. No application, financial, permission, assertion tolerance or timeout behavior changes are included.

## C1/C2 — where the simulated-reading explanation belongs

The removed inline invoice-entry card no longer puts its simulated AI warning on the Drafts queue. The existing regression now verifies the warning is absent from the queue and retained review, present in the actual New invoice chooser, and present after selecting Photo. The Demo menu disclaimer and unrelated-page absence checks remain. Both desktop and phone cases pass.

## C5 — reuse an already open invoice source chooser

`openInvoiceUpload` now selects Photo from the real chooser when an audit already opened it. It opens New invoice only when that chooser is closed, preserving native modal blocking and every original-upload/hash/status/review readiness assertion. The complete existing primary product/date/approval/invoice dialog audit passes on desktop and phone; no C5 geometry or action contract changed.
