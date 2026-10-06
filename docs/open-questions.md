# Open questions

On **2026-10-06** Ali confirmed Toronto, Ontario, Canada; CAD; 13% HST and accepted safe physical return cancellation. He authorized the lead developer to choose/document the remaining defaults. The resolved rules now live in `requirements.md`, `workflows.md`, `pricing-engine.md`, `decisions.md`, `return-policy.md`, and `seed/arzon-config.json`; they are no longer unanswered questions.

The following inputs do not block Phase 0.1. Ask only when the relevant slice needs them, at most one or two questions at a time. Keep configurable defaults while waiting; request explicit approval before paid resources or production deployment.

| # | Input still needed | Default / when needed |
|---|---|---|
| 1 | Real branch names/addresses and whether all three launch together | Branch 1/2/3; stable B1/B2/B3 codes. Confirm before real data import/go-live. |
| 2 | Which AI provider reads invoices? | Provider-agnostic interface; compare cost per invoice and ask Ali before Phase 1 slice 5. No real AI in Step 0.1 or the browser demo. |
| 3 | Final Persian terminology/translation review | Draft bilingual text; Western digits for prices/product codes/dates. Ali reviews translations before go-live. |
| 4 | Official logo/brand assets | Supplied PNG and design-language sampled values in editable branding configuration; replace when provided. |
| 5 | Actual supplier return agreements and opening balances | Use the documented staff checklist; Supervisor collects written supplier terms/evidence and verifies balances before real operations. No invented supplier terms or financial amounts. |

Recorded defaults adopted on 2026-10-06 include Rice rounding upward (including whole dollars), last approved price while pending, category minimum margins, proportional shortage tax, configured price→offer mappings, cashier lookup-only, worker own-invoice costs with no margins/catalog costs, worker-confirmed units per case, manually cleared dates, 0.49 minimum band result, logged stock adjustments with threshold off, sequential supplier invoice numbering within company, idle lock 5 minutes/password window 15 minutes, and product codes starting at 0001. See `decisions.md` for the reasons and the rules that resolved conflicting documents.
