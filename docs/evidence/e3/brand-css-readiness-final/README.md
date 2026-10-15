# Await actual company-brand CSS publication

Exact `0786ea2` PR CI run **38806913395** genuinely failed the unit step: `--company-primary` was still default **#2B59C3**, while the unchanged assertion required configured **#0F766E**. Build and browser steps were skipped. This is separate from earlier 30-minute job cancellations. The local complete `0786ea2` 1,444-case application pass remains a separate recorded outcome; it does not cancel the CI failure.

The test's `show()` helper waits for rendered authentication stage to leave `loading`. Branding properties are written in a separate `DemoProvider` passive effect after its projected configuration changes. Stage readiness alone does not establish CSS publication. The annotation does not record exact stage/effect timing; no CPU or other scheduling cause is claimed.

The test-only correction awaits the **existing `waitFor` around all three original exact assertions together**. Colors **#0F766E**, **#5EEAD4**, **#0D9488**, property names and matchers are unchanged. No timeout option is added: default waitFor **1,000 ms**, existing show **10,000 ms**, and Vitest case **30,000 ms** are retained. Production code, actor/permission checks, repository/storage, seed data and assets are unchanged. No timers, authority/result mocks or extra helpers are introduced. A palette that never appears still fails the original assertions.

Final actual checks, with no source overlays and one sequential real worker:

- E1 `48d9c27ec2925924431127f20b9185cf49ec09f1`: **entire store.test.tsx 11/11 passed**, actual unit exit **0**, scoped ESLint **0**, Prettier **0**, no global errors; all **562** source pins unchanged.
- E2 `b2988e382b473425508c0067ed2bd1c168e5154f`: **entire store.test.tsx 11/11 passed**, actual unit exit **0**, scoped ESLint **0**, Prettier **0**, no global errors; all **576** source pins unchanged.

Final fixture SHA-256 **bc5abad569a85b104e33ebc23971c5b7b822181888df8f23cf8aa5e90dd12c89** matches the inherited E1/E2/E3 versions. Each run used an exact committed Git archive. Its private runner adapter only allowed the actual shared dependency directory for the genuine PDF worker import. The working checkout was not edited and no branch was switched by this proof.

The unformatted first candidate is retained separately: E1 unit **11/11 passed** and ESLint exited 0, but Prettier genuinely exited **1**. Exact E3 `982577f` normal full lint also genuinely exited **1** after 44.14 seconds on unchanged inputs; no full application run was claimed for that unformatted version. The final correction only wraps the KPI assertion's color argument according to Prettier. The final formatted entire-file checks above ran afresh; failed attempts are not relabelled passing.

[Verification and original-byte hashes](verification.json) retain original CI payloads, every actual command/exit, logs/JSON/global-error observations, full source pins, runner adapters, the exact patch and reproducible drivers. At packaging, the final E3 complete application/SDK run is still in progress and is recorded separately from these scoped E1/E2 checks. Final E3 static results and the selected original-file native replay also have separate evidence. This bounded packet does not claim a new full812-case run, final E3 application pass, CI approval, merge, hardware test or deployment.

The later [complete E3 replay](../final-a6c66dc-validation/README.md) has now finished:1,444/1,444 application and75/75 SDK passed, actual exits0 and unchanged inputs. This later result does not rewrite the packaging-time state or earlier failures above.
