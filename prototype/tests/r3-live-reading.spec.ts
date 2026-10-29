import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Decimal from "decimal.js";
import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  chooseOption,
  openInvoiceDetails,
  openInvoiceLine,
  openShellAction,
  setLanguage,
  signIn,
} from "./helpers";
import {
  configureLive,
  deferred,
  expectNoPosting,
  expectReview,
  failureMessage,
  fictionalPhoto,
  fictionalResponse,
  jpegFacts,
  liveModels,
  mockReader,
  newLiveOriginal,
  openReceiving,
  pressRead,
  readerAddress,
  renewDemoSession,
  retainedSourceHashes,
  sourceHash,
  t,
  type ReaderOutcome,
} from "./r3-live-reading-helpers";

const pdfPath = fileURLToPath(
  new URL("./fixtures/r3-fictional-two-page.pdf", import.meta.url),
);
const oversizedPdfPath = fileURLToPath(
  new URL("./fixtures/r3-fictional-eleven-page.pdf", import.meta.url),
);

test("R3 settings use the dynamic reader default, real connection outcomes and one shared Demo mode", async ({
  page,
}) => {
  const health = { ok: true };
  const reader = await mockReader(page, [], health);
  await signIn(page, "Manager");
  await openReceiving(page);
  const mode = page.getByRole("combobox", {
    name: "Reading mode",
    exact: true,
  });
  const address = page.getByRole("textbox", {
    name: "Reader address",
    exact: true,
  });
  await expect(mode).toHaveText("Simulated");
  const expectedDefault = `http://${new URL(page.url()).hostname}:5191`;
  await expect(address).toHaveValue(expectedDefault);
  await address.fill(readerAddress);
  await chooseOption(page, mode, "live", "Live");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(
      async () => (await readCanonicalBusinessEvidence(page)).config.receiving,
    )
    .toMatchObject({
      ai_reading_mode: "live",
      ai_reader_address: readerAddress,
    });
  const connection = page.getByRole("button", {
    name: "Test connection",
    exact: true,
  });
  await connection.click();
  await expect(
    page.getByText("Connected · reader ready", { exact: true }),
  ).toBeVisible();
  expect(reader.healthCalls).toBe(1);
  health.ok = false;
  await connection.click();
  await expect(page.getByText(/^Can't reach the reader at /)).toContainText(
    "same Wi-Fi",
  );
  expect(reader.healthCalls).toBe(2);
  await page
    .getByRole("button", { name: "Reset reader address", exact: true })
    .click();
  await expect(address).toHaveValue(expectedDefault);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).config.receiving
          .ai_reader_address,
    )
    .toBeNull();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Reader address", exact: true }),
  ).toHaveValue(expectedDefault);
  await (await openShellAction(page, "Demo")).click();
  const simulated = page.getByRole("menuitemcheckbox", {
    name: "Simulated reading",
    exact: true,
  });
  await expect(simulated).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Home");
  await expect(simulated).toBeFocused();
  await page.keyboard.press("Space");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).config.receiving
          .ai_reading_mode,
    )
    .toBe("simulated");
  await expect(simulated).toHaveAttribute("aria-checked", "true");
  await expect(simulated).toBeEnabled();
  await expect(simulated).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await openReceiving(page);
  await expect(
    page.getByRole("combobox", { name: "Reading mode", exact: true }),
  ).toHaveText("Simulated");
  expect(reader.requests).toHaveLength(0);
});

for (const language of ["en", "fa"] as const) {
  test(`R3 live photos preserve both originals, reorder payload pages and open highlighted review (${language})`, async ({
    page,
  }, info) => {
    await page.clock.install();
    const gate = deferred();
    const reader = await mockReader(page, [
      { kind: "held", wait: gate.promise },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    if (language === "fa") {
      await (await openShellAction(page, "تغییر به تم تیره")).click();
    }
    const first = await fictionalPhoto(
      page,
      "r3-fictional-red-page.png",
      "#df1010",
    );
    const second = await fictionalPhoto(
      page,
      "r3-fictional-blue-page.png",
      "#1010df",
    );
    const before = await readCanonicalBusinessEvidence(page);
    const original = await newLiveOriginal(
      page,
      [first, second],
      "photo",
      language,
    );
    expect(original.branch).toBe("Branch 1");
    expect(await retainedSourceHashes(page, original)).toEqual([
      sourceHash(first),
      sourceHash(second),
    ]);
    const pages = page.getByTestId("live-reading-pages");
    await expect(
      pages.locator(".live-reading-page-name").nth(0),
    ).toHaveAttribute("title", first.name);
    await expect(
      pages.locator(".live-reading-page-name").nth(1),
    ).toHaveAttribute("title", second.name);
    await pages
      .getByRole("button", {
        name: t(language, "Move page 2 up", "انتقال صفحهٔ 2 به بالا"),
        exact: true,
      })
      .click();
    await expect(
      pages.locator(".live-reading-page-name").nth(0),
    ).toHaveAttribute("title", second.name);
    const ordered = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(ordered.id).toBe(original.id);
    expect(await retainedSourceHashes(page, ordered)).toEqual([
      sourceHash(second),
      sourceHash(first),
    ]);
    await pressRead(page, language);
    await expect.poll(() => reader.requests.length).toBe(1);
    const progress = page.getByTestId("live-reading-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(
      t(language, "Usually 1–2 minutes", "معمولاً ۱ تا ۲ دقیقه"),
    );
    await expect(
      progress.getByRole("button", {
        name: t(language, "Cancel", "انصراف"),
        exact: true,
      }),
    ).toBeEnabled();
    const elapsedSeconds = async () => {
      const match = (await progress.innerText()).match(
        /(?:^|\s)(\d+):(\d{2})(?=\s|$)/,
      );
      expect(match, "The active reading has an elapsed clock").not.toBeNull();
      return Number(match![1]) * 60 + Number(match![2]);
    };
    const elapsedBefore = await elapsedSeconds();
    await page.clock.fastForward(72_000);
    const elapsedAfter = await elapsedSeconds();
    expect(elapsedAfter - elapsedBefore).toBeGreaterThanOrEqual(72);
    expect(elapsedAfter - elapsedBefore).toBeLessThanOrEqual(73);
    await expect(progress.locator('[aria-current="step"]')).toHaveText(
      t(language, "Reading the invoice", "خواندن فاکتور"),
    );
    const processing = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(processing.id).toBe(original.id);
    expect(processing.status).toBe("reading");
    expect(processing.live_reading?.phase).toBe("processing");
    expect(processing.file_data).toBe(ordered.file_data);
    expect(reader.requests[0].images).toHaveLength(2);
    const facts = await jpegFacts(page, reader.requests[0].images);
    expect(facts[0].pixel[2]).toBeGreaterThan(180);
    expect(facts[0].pixel[0]).toBeLessThan(60);
    expect(facts[1].pixel[0]).toBeGreaterThan(180);
    expect(facts[1].pixel[2]).toBeLessThan(60);
    for (const fact of facts)
      expect(Math.max(fact.width, fact.height)).toBeLessThanOrEqual(2400);
    await page.screenshot({
      path: info.outputPath(`r3-live-progress-${language}.png`),
      fullPage: true,
    });
    gate.resolve();
    const after = await expectReview(page, original.id, language);
    expect(after.supplier_invoice_number).toBe("R3-FICTIONAL-001");
    expect(after.lines).toHaveLength(1);
    expect(after.lines[0].unit_cost_before_tax).toBe("1.2345");
    expect(after.lines[0].low_confidence_fields).toContain(
      "unit_cost_before_tax",
    );
    const line = await openInvoiceLine(page, 0);
    await expect(
      line.getByLabel(
        t(language, "Unit cost before tax", "هزینه هر واحد پیش از مالیات"),
        { exact: true },
      ),
    ).toHaveValue("1.2345");
    const costCheck = line.locator(".please-check-field").filter({
      has: page.getByLabel(
        t(language, "Unit cost before tax", "هزینه هر واحد پیش از مالیات"),
        { exact: true },
      ),
    });
    await expect(costCheck).toHaveCount(1);
    await expect(
      costCheck.getByRole("img", {
        name: t(
          language,
          "Check this against the original",
          "با اصل فاکتور بررسی کنید",
        ),
        exact: true,
      }),
    ).toBeVisible();
    await line
      .getByRole("button", { name: t(language, "Close", "بستن"), exact: true })
      .click();
    await openInvoiceDetails(page);
    const provenance = page.getByTestId("live-reading-provenance");
    await expect(provenance).toContainText("84");
    await expect(provenance).toContainText("0.11");
    for (const model of liveModels)
      await expect(provenance).toContainText(model);
    expect(after.reading_record?.source).toBe("live");
    expect(after.reading_record?.seconds).toBe(84);
    expect(after.reading_record?.models).toEqual(liveModels);
    expect(
      new Decimal(after.reading_record!.reading_cost_usd).equals("0.11"),
    ).toBe(true);
    expect(await retainedSourceHashes(page, after)).toEqual([
      sourceHash(second),
      sourceHash(first),
    ]);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
    await expect(page.getByText(/\(not live\)/)).toHaveCount(0);
    await expect(
      page.getByText("AI invoice reading is simulated", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`r3-live-review-${language}.png`),
      fullPage: true,
    });
    const retained = structuredClone(after);
    await page.reload();
    await expectReview(page, original.id, language);
    await openInvoiceDetails(page);
    await expect(page.getByTestId("live-reading-provenance")).toContainText(
      "84",
    );
    for (const model of liveModels)
      await expect(page.getByTestId("live-reading-provenance")).toContainText(
        model,
      );
    const viewport = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(viewport.content).toBeLessThanOrEqual(viewport.width + 1.5);
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      retained,
    );
    expect(await retainedSourceHashes(page, retained)).toEqual([
      sourceHash(second),
      sourceHash(first),
    ]);
    expect(reader.requests).toHaveLength(1);
  });
}

test("R3 real two-page PDF becomes ordered bounded JPEGs and false checks still opens review", async ({
  page,
}) => {
  const response = fictionalResponse("R3-FICTIONAL-PDF");
  response.checksPassed = false;
  const reader = await mockReader(page, [{ kind: "success", response }]);
  await configureLive(page);
  const before = await readCanonicalBusinessEvidence(page);
  const original = await newLiveOriginal(page, pdfPath, "pdf");
  const pdf = await readFile(pdfPath);
  const expected = sourceHash({
    name: "fictional.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  expect(await retainedSourceHashes(page, original)).toEqual([expected]);
  await pressRead(page);
  const invoice = await expectReview(page, original.id);
  expect(reader.requests).toHaveLength(1);
  expect(reader.requests[0].images).toHaveLength(2);
  const rendered = await jpegFacts(page, reader.requests[0].images);
  // Fixture page1 is 1440×720pt, page2 is Letter612×792pt: 200dpi,
  // capped at2400px, must retain the distinct landscape/portrait ordering.
  expect(rendered.map(({ width, height }) => ({ width, height }))).toEqual([
    { width: 2400, height: 1200 },
    { width: 1700, height: 2200 },
  ]);
  expect(invoice.lines[0].low_confidence_fields).toContain(
    "unit_cost_before_tax",
  );
  expect(invoice.file_type).toBe("application/pdf");
  expect(invoice.file_data).toBe(original.file_data);
  expect(await retainedSourceHashes(page, invoice)).toEqual([expected]);
  const phone = (page.viewportSize()?.width ?? 1440) <= 760;
  if (phone)
    await page.getByRole("button", { name: /^View original \(/ }).click();
  const viewer = page.getByRole(phone ? "dialog" : "complementary", {
    name: "Original invoice",
    exact: true,
  });
  await expect(viewer).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Next page", exact: true }),
  ).toBeEnabled();
  await expect(viewer.locator(".invoice-original-page")).toHaveText("1 / 2");
  await viewer.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(viewer.locator(".invoice-original-page")).toHaveText("2 / 2");
  await expect(
    viewer.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled();
  await viewer.getByRole("button", { name: "More", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Download", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("r3-fictional-two-page.pdf");
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error("The original PDF download is missing.");
  expect(
    sourceHash({
      name: "download.pdf",
      mimeType: "application/pdf",
      buffer: await readFile(downloadedPath),
    }),
  ).toBe(expected);
  const afterViewing = await readCanonicalBusinessEvidence(page);
  expect(afterViewing.invoice).toEqual(invoice);
  expectNoPosting(before, afterViewing);
});

for (const failure of ["http", "network", "invalid-json"] as const) {
  for (const choice of ["retry", "manual", "simulated"] as const) {
    test(`R3 ${failure} keeps the original and ${choice} is an explicit recovery choice`, async ({
      page,
    }, info) => {
      await page.clock.install();
      const outcomes: ReaderOutcome[] = [{ kind: failure }];
      if (choice === "retry") outcomes.push({ kind: "success" });
      const reader = await mockReader(page, outcomes);
      await configureLive(page);
      const photo = await fictionalPhoto(
        page,
        `r3-fictional-${failure}-${choice}.png`,
      );
      const before = await readCanonicalBusinessEvidence(page);
      const original = await newLiveOriginal(page, photo);
      await pressRead(page);
      await expect(
        page.getByText(failureMessage, { exact: true }),
      ).toBeVisible();
      for (const label of [
        "Try again",
        "Enter by hand",
        "Use simulated reading",
      ])
        await expect(
          page.getByRole("button", { name: label, exact: true }),
        ).toBeEnabled();
      await page.clock.fastForward(5000);
      if (failure === "http" && choice === "manual")
        await page.screenshot({
          path: info.outputPath("r3-live-error-en.png"),
          fullPage: true,
        });
      expect(reader.requests).toHaveLength(1);
      const failed = (await readCanonicalBusinessEvidence(page)).invoice;
      expect(failed.id).toBe(original.id);
      expect(failed.live_reading?.phase).toBe("failed");
      expect(await retainedSourceHashes(page, failed)).toEqual([
        sourceHash(photo),
      ]);
      expect(failed.status).not.toBe("posted");
      if (failure === "invalid-json" && choice === "simulated")
        await renewDemoSession(page, "Manager");
      const label =
        choice === "retry"
          ? "Try again"
          : choice === "manual"
            ? "Enter by hand"
            : "Use simulated reading";
      await page.getByRole("button", { name: label, exact: true }).click();
      if (choice === "simulated") await page.clock.fastForward(3000);
      const after = await expectReview(page, original.id);
      expect(after.file_data).toBe(original.file_data);
      expect(await retainedSourceHashes(page, after)).toEqual([
        sourceHash(photo),
      ]);
      expect(reader.requests).toHaveLength(choice === "retry" ? 2 : 1);
      if (choice === "manual") {
        expect(after.entry_mode).toBe("manual");
        expect(after.lines).toHaveLength(0);
      } else expect(after.lines.length).toBeGreaterThan(0);
      if (choice === "simulated") {
        expect(after.simulated_reading).toBe(true);
        expect(after.reading_record).toBeUndefined();
        await expect(
          page.getByText("Simulated reading", { exact: true }),
        ).toBeVisible();
        await expect(page.getByTestId("live-reading-provenance")).toHaveCount(
          0,
        );
        await page.reload();
        const reloaded = await expectReview(page, original.id);
        expect(reloaded.simulated_reading).toBe(true);
        expect(reloaded.reading_record).toBeUndefined();
        await expect(
          page.getByText("Simulated reading", { exact: true }),
        ).toBeVisible();
        expect(await retainedSourceHashes(page, reloaded)).toEqual([
          sourceHash(photo),
        ]);
        expect(
          (await readCanonicalBusinessEvidence(page)).config.receiving
            .ai_reading_mode,
        ).toBe("live");
      }
      expectNoPosting(before, await readCanonicalBusinessEvidence(page));
    });
  }
}

test("R3 Cancel aborts an active reading and ignores its late response while retaining the draft", async ({
  page,
}) => {
  const gate = deferred();
  const reader = await mockReader(page, [{ kind: "held", wait: gate.promise }]);
  await configureLive(page);
  const photo = await fictionalPhoto(page, "r3-fictional-cancel.png");
  const before = await readCanonicalBusinessEvidence(page);
  const original = await newLiveOriginal(page, photo);
  await pressRead(page);
  await expect.poll(() => reader.requests.length).toBe(1);
  await page
    .getByTestId("live-reading-progress")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  gate.resolve();
  await expect.poll(() => reader.finished).toBe(1);
  await expect(
    page.getByRole("button", { name: "Read again", exact: true }),
  ).toBeVisible();
  const cancelled = (await readCanonicalBusinessEvidence(page)).invoice;
  expect(cancelled.id).toBe(original.id);
  expect(cancelled.live_reading?.phase).toBe("cancelled");
  expect(cancelled.status).not.toBe("review");
  expect(await retainedSourceHashes(page, cancelled)).toEqual([
    sourceHash(photo),
  ]);
  expectNoPosting(before, await readCanonicalBusinessEvidence(page));
});

test("R3 reload during Processing offers Read again and never resumes a simulated timer", async ({
  page,
}) => {
  await page.clock.install();
  const gate = deferred();
  const reader = await mockReader(page, [
    { kind: "held", wait: gate.promise },
    { kind: "success" },
  ]);
  await configureLive(page);
  const photo = await fictionalPhoto(page, "r3-fictional-reload.png");
  const original = await newLiveOriginal(page, photo);
  await pressRead(page);
  await expect.poll(() => reader.requests.length).toBe(1);
  const oldAttempt = (await readCanonicalBusinessEvidence(page)).invoice
    .live_reading?.attempt_id;
  await page.reload();
  gate.resolve();
  await expect.poll(() => reader.finished).toBe(1);
  await expect(
    page.getByRole("button", { name: "Read again", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Enter by hand", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByTestId("live-reading-progress").locator(".live-reading-time"),
  ).toHaveCount(0);
  await page.clock.fastForward(5000);
  expect(reader.requests).toHaveLength(1);
  const retained = (await readCanonicalBusinessEvidence(page)).invoice;
  expect(retained.id).toBe(original.id);
  expect(retained.status).toBe("reading");
  expect(await retainedSourceHashes(page, retained)).toEqual([
    sourceHash(photo),
  ]);
  await page.getByRole("button", { name: "Read again", exact: true }).click();
  const after = await expectReview(page, original.id);
  expect(after.live_reading?.attempt_id).not.toBe(oldAttempt);
  expect(reader.requests).toHaveLength(2);
  expect(after.file_data).toBe(original.file_data);
});

test("R3 duplicate supplier and invoice number uses the existing message and retains the second draft", async ({
  page,
}) => {
  const reader = await mockReader(page, [
    { kind: "success" },
    { kind: "success" },
  ]);
  await configureLive(page);
  const first = await newLiveOriginal(
    page,
    await fictionalPhoto(page, "r3-fictional-first.png", "#df1010"),
  );
  await pressRead(page);
  const imported = await expectReview(page, first.id);
  const secondPhoto = await fictionalPhoto(
    page,
    "r3-fictional-second.png",
    "#1010df",
  );
  const before = await readCanonicalBusinessEvidence(page);
  const second = await newLiveOriginal(page, secondPhoto);
  expect(second.id).not.toBe(first.id);
  await pressRead(page);
  await expect(
    page.getByText(
      "This supplier already has that invoice number in the app.",
      { exact: true },
    ),
  ).toBeVisible();
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoice.id).toBe(second.id);
  expect(after.invoice.status).not.toBe("review");
  expect(await retainedSourceHashes(page, after.invoice)).toEqual([
    sourceHash(secondPhoto),
  ]);
  expect(after.invoices?.find((invoice) => invoice.id === first.id)).toEqual(
    imported,
  );
  expectNoPosting(before, after);
  expect(reader.requests).toHaveLength(2);
});

test("R3 over-ten-page PDF keeps the original and stops before sending any images", async ({
  page,
}) => {
  const reader = await mockReader(page, []);
  await configureLive(page);
  const original = await newLiveOriginal(page, oversizedPdfPath, "pdf");
  const bytes = await readFile(oversizedPdfPath);
  const expected = sourceHash({
    name: "fictional.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await pressRead(page);
  await expect(page.getByText(/10 pages/)).toBeVisible();
  expect(reader.requests).toHaveLength(0);
  const after = (await readCanonicalBusinessEvidence(page)).invoice;
  expect(after.id).toBe(original.id);
  expect(await retainedSourceHashes(page, after)).toEqual([expected]);
  await expect(
    page.getByRole("button", { name: "Enter by hand", exact: true }),
  ).toBeEnabled();
});

test("R3 Floor Worker can read an own draft but live model, cost and seconds provenance stays private", async ({
  page,
}) => {
  await mockReader(page, [{ kind: "success" }]);
  await configureLive(page);
  await signIn(page, "Floor Worker");
  const photo = await fictionalPhoto(page, "r3-fictional-worker.png");
  const original = await newLiveOriginal(page, photo);
  await pressRead(page);
  const invoice = await expectReview(page, original.id);
  expect(invoice.reading_record?.models).toEqual(liveModels);
  await openInvoiceDetails(page);
  await expect(page.getByTestId("live-reading-provenance")).toHaveCount(0);
  for (const model of liveModels)
    await expect(page.getByText(model, { exact: false })).toHaveCount(0);
  const route = page.url();
  await signIn(page, "Manager");
  await page.goto(route);
  await expectReview(page, original.id);
  await openInvoiceDetails(page);
  const provenance = page.getByTestId("live-reading-provenance");
  for (const model of liveModels) await expect(provenance).toContainText(model);
  await expect(provenance).toContainText("0.11");
  expect(
    await retainedSourceHashes(
      page,
      (await readCanonicalBusinessEvidence(page)).invoice,
    ),
  ).toEqual([sourceHash(photo)]);
});

test("R3 Floor Worker failure can enter an own retained draft by hand and Add line after an authorized Warehouse move without a global manual grant", async ({
  page,
}) => {
  const reader = await mockReader(page, [{ kind: "http" }]);
  await configureLive(page);
  await signIn(page, "Floor Worker");
  const photo = await fictionalPhoto(page, "r3-fictional-worker-manual.png");
  const before = await readCanonicalBusinessEvidence(page);
  const original = await newLiveOriginal(page, photo);
  await pressRead(page);
  await expect(page.getByText(failureMessage, { exact: true })).toBeVisible();
  await renewDemoSession(page, "Floor Worker");
  await page
    .getByRole("button", { name: "Enter by hand", exact: true })
    .click();
  await expectReview(page, original.id);
  await openInvoiceDetails(page);
  await page
    .getByRole("button", { name: "Change location", exact: true })
    .click();
  const locationDialog = page.getByRole("dialog", {
    name: "Change receiving location",
    exact: true,
  });
  await chooseOption(
    page,
    locationDialog.getByLabel("Location", { exact: true }),
    "Warehouse",
    "Warehouse",
  );
  await locationDialog
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await expect(locationDialog).toHaveCount(0);
  await expect
    .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice)
    .toMatchObject({
      id: original.id,
      branch: "Warehouse",
      handling_branch: "Branch 1",
      reviewer_origin_location_id: "Branch 1",
    });
  await expect(page.locator(".topbar .branch-pill")).toContainText(
    "North York",
  );
  await chooseOption(
    page,
    page.getByRole("combobox", {
      name: "Add a product to the invoice",
      exact: true,
    }),
    "0002",
    "Canned Fava Beans 400 g",
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines.length,
    )
    .toBe(1);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoice.id).toBe(original.id);
  expect(after.invoice.branch).toBe("Warehouse");
  expect(after.invoice.lines[0].product_code).toBe("0002");
  expect(await retainedSourceHashes(page, after.invoice)).toEqual([
    sourceHash(photo),
  ]);
  expectNoPosting(before, after);
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  const chooser = page.getByRole("dialog", {
    name: "New invoice",
    exact: true,
  });
  await expect(
    chooser.getByRole("button", { name: "Manual entry", exact: true }),
  ).toBeDisabled();
  await expect(
    chooser.getByRole("button", { name: "JSON file", exact: true }),
  ).toBeDisabled();
  expect(reader.requests).toHaveLength(1);
});
