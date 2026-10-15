# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: c8-migration.spec.ts >> C8 backup write failure blocks schema replacement and retains exact state and originals until recovery
- Location: tests/c8-migration.spec.ts:564:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Browser storage (?:is full or disabled|could not be read or updated)/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/Browser storage (?:is full or disabled|could not be read or updated)/) with timeout 5000ms
  - waiting for getByText(/Browser storage (?:is full or disabled|could not be read or updated)/)

```

```yaml
- button "Switch to Persian": فا
- img "C8 Saved Market"
- heading "Sign in" [level=1]
- paragraph: Recent users on this computer
- button "Manager"
- text: Username
- textbox "Username"
- text: Password
- textbox "Password"
- button "Show password"
- button "Sign in"
- paragraph: Forgot your password? Ask a person who manages accounts to reset it.
- paragraph: "Demo accounts: owner, manager, rh-supervisor, ny-floor, wh-floor, cashier / Fresh demo password demo1234"
```

# Test source

```ts
  473 |     reference: boundary.reference,
  474 |     sha256: boundary.sha256,
  475 |   });
  476 |   expect(events[publishedAt].schema).toBe(1);
  477 |   const backup = await readBackup(page, boundary.reference);
  478 |   expect(backup).toEqual({
  479 |     reference: boundary.reference,
  480 |     company_id: "super-arzon",
  481 |     storage_key: mainKey,
  482 |     sha256: boundary.sha256,
  483 |     raw: boundary.raw,
  484 |     bytes: Buffer.byteLength(boundary.raw),
  485 |   });
  486 |   expect(digest(backup!.raw)).toBe(backup!.sha256);
  487 |   return { events, backup };
  488 | }
  489 |
  490 | test("C8 schema-only boundary preserves real saved settings, manual prices, all records and original bytes after verified exact backup", async ({
  491 |   page,
  492 | }, testInfo) => {
  493 |   const errors: string[] = [];
  494 |   page.on("pageerror", (error) => errors.push(error.message));
  495 |   const prepared = await prepareRetainedState(page);
  496 |   const boundary = await prepareSchemaBoundary(page, prepared.state);
  497 |   await observeMigration(page, boundary.reference);
  498 |   await signIn(page, "Manager");
  499 |   // E1's root invoice route is the Drafts list. Open this actual retained
  500 |   // invoice's protected workspace before asserting its original is visible.
  501 |   await page.goto(
  502 |     `/#invoices?id=${encodeURIComponent(prepared.state.invoice.id)}`,
  503 |   );
  504 |   await expect
  505 |     .poll(async () => (await saved(page)).prototype_c8_schema)
  506 |     .toBe(1);
  507 |   const proof = await assertVerifiedBeforePublish(page, boundary);
  508 |   expect(
  509 |     await savedRaw(page),
  510 |     "First import must preserve its exact legacy source",
  511 |   ).toBe(boundary.raw);
  512 |   expect(
  513 |     await saved(page),
  514 |     "Every decoded saved field must survive the additive boundary",
  515 |   ).toEqual(prepared.state);
  516 |   expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
  517 |     prepared.original,
  518 |   );
  519 |   await expect(
  520 |     page.getByRole("img", { name: "Original invoice image", exact: true }),
  521 |   ).toBeVisible();
  522 |   await expect(page.getByText(storageFailure)).toHaveCount(0);
  523 |   await page.reload();
  524 |   await expect.poll(async () => await saved(page)).toEqual(prepared.state);
  525 |   expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
  526 |     prepared.original,
  527 |   );
  528 |   expect(
  529 |     (await migrationEvents(page)).filter((event) =>
  530 |       event.kind.startsWith("backup-"),
  531 |     ),
  532 |   ).toEqual([]);
  533 |   expect(errors).toEqual([]);
  534 |   await testInfo.attach("c8-schema-only-migration-proof.json", {
  535 |     contentType: "application/json",
  536 |     body: Buffer.from(
  537 |       JSON.stringify(
  538 |         {
  539 |           fixture:
  540 |             "Actual UI-produced E1 business state with only prototype_c8_schema removed; not an archived C7 snapshot",
  541 |           saved_sha256_before: digest(prepared.originalRaw),
  542 |           exact_boundary_backup_sha256: boundary.sha256,
  543 |           source_sha256: prepared.sourceHash,
  544 |           retained_activity_count: prepared.state.activity.length,
  545 |           sale_ids: prepared.state.sales?.map((sale) => sale.id),
  546 |           sale_request_ids: prepared.state.sale_requests?.map(
  547 |             (request) => request.id,
  548 |           ),
  549 |           every_decoded_field_preserved: true,
  550 |           backup_verified_before_publish: true,
  551 |           repeated_load_idempotent: true,
  552 |           events: proof.events.map(({ raw, ...event }) => ({
  553 |             ...event,
  554 |             ...(raw === undefined ? {} : { raw_sha256: digest(raw) }),
  555 |           })),
  556 |         },
  557 |         null,
  558 |         2,
  559 |       ),
  560 |     ),
  561 |   });
  562 | });
  563 |
  564 | test("C8 backup write failure blocks schema replacement and retains exact state and originals until recovery", async ({
  565 |   page,
  566 | }, testInfo) => {
  567 |   const errors: string[] = [];
  568 |   page.on("pageerror", (error) => errors.push(error.message));
  569 |   const prepared = await prepareRetainedState(page);
  570 |   const boundary = await prepareSchemaBoundary(page, prepared.state);
  571 |   await observeMigration(page, boundary.reference, true);
  572 |   await page.goto("/#invoices");
> 573 |   await expect(page.getByText(storageFailure)).toBeVisible();
      |                                                ^ Error: expect(locator).toBeVisible() failed
  574 |   await expect
  575 |     .poll(
  576 |       async () =>
  577 |         (await migrationEvents(page)).filter(
  578 |           (event) => event.kind === "backup-failed",
  579 |         ).length,
  580 |     )
  581 |     .toBeGreaterThan(0);
  582 |   expect(await savedRaw(page)).toBe(boundary.raw);
  583 |   expect(await readBackup(page, boundary.reference)).toBeNull();
  584 |   expect(
  585 |     (await migrationEvents(page)).filter((event) => event.kind === "publish"),
  586 |   ).toEqual([]);
  587 |   expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
  588 |     prepared.original,
  589 |   );
  590 |   // A failed first import cannot expose private invoice data before a genuine
  591 |   // authority/session exists. Retained bytes above are still verified exactly.
  592 |   expect(await canonicalBusinessExists(page)).toBe(false);
  593 |   await expect(page.locator(".topbar")).toHaveCount(0);
  594 |   await expect(
  595 |     page.getByRole("img", { name: "Original invoice image", exact: true }),
  596 |   ).toHaveCount(0);
  597 |   const failureEvents = await migrationEvents(page);
  598 |
  599 |   // Release only the injected environmental fault; recovery still runs the
  600 |   // actual app migration and must verify its real IndexedDB backup first.
  601 |   await page.evaluate((key) => sessionStorage.setItem(key, "yes"), recoveryKey);
  602 |   await signIn(page, "Manager");
  603 |   await page.goto("/#invoices");
  604 |   await expect
  605 |     .poll(async () => (await saved(page)).prototype_c8_schema)
  606 |     .toBe(1);
  607 |   const recovery = await assertVerifiedBeforePublish(page, boundary);
  608 |   expect(await saved(page)).toEqual(prepared.state);
  609 |   expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
  610 |     prepared.original,
  611 |   );
  612 |   await expect(page.getByText(storageFailure)).toHaveCount(0);
  613 |   expect(errors).toEqual([]);
  614 |   await testInfo.attach("c8-backup-failure-recovery-proof.json", {
  615 |     contentType: "application/json",
  616 |     body: Buffer.from(
  617 |       JSON.stringify(
  618 |         {
  619 |           fixture:
  620 |             "Actual UI-produced E1 business state with only prototype_c8_schema removed; actual backup put throws QuotaExceededError",
  621 |           boundary_sha256: boundary.sha256,
  622 |           source_sha256: prepared.sourceHash,
  623 |           exact_raw_preserved_during_failure: true,
  624 |           durable_replacement_blocked: true,
  625 |           every_decoded_field_preserved_after_recovery: true,
  626 |           failure_events: failureEvents,
  627 |           recovery_events: recovery.events.map(({ raw, ...event }) => ({
  628 |             ...event,
  629 |             ...(raw === undefined ? {} : { raw_sha256: digest(raw) }),
  630 |           })),
  631 |         },
  632 |         null,
  633 |         2,
  634 |       ),
  635 |     ),
  636 |   });
  637 | });
  638 |
```
