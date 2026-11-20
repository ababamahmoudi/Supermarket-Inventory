import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openInvoiceDetails, setBranch, setLanguage } from "./helpers";
import {
  configureLive,
  expectReview,
  fictionalPhoto,
  jpegFacts,
  mockReader,
  newLiveOriginal,
  retainedSourceHashes,
  sourceHash,
  t,
} from "./r3-live-reading-helpers";

const pdfPath = fileURLToPath(
  new URL("./fixtures/r3-fictional-two-page.pdf", import.meta.url),
);
async function addPicker(page: Page, language: "en" | "fa" = "en") {
  const add = page.getByRole("button", {
    name: t(language, "Add page", "افزودن صفحه"),
    exact: true,
  });
  await expect(add).toBeEnabled();
  const opened = page.waitForEvent("filechooser");
  await add.click();
  const picker = await opened;
  expect(await picker.element().getAttribute("data-testid")).toBe(
    "live-invoice-add-pages",
  );
  expect(await picker.element().getAttribute("accept")).toBe("image/*");
  expect(await picker.element().getAttribute("capture")).toBeNull();
  expect(picker.isMultiple()).toBe(true);
  return picker;
}
async function activeNames(page: Page) {
  return (
    (await readCanonicalBusinessEvidence(page)).invoice.original_pages?.map(
      (source) => source.file_name,
    ) ?? []
  );
}
async function remove(page: Page, index: number, language: "en" | "fa") {
  const before =
    (await readCanonicalBusinessEvidence(page)).invoice.version ?? 1;
  await page
    .getByRole("button", {
      name: t(language, `Remove page ${index}`, `حذف صفحهٔ ${index}`),
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () => (await readCanonicalBusinessEvidence(page)).invoice.version,
    )
    .toBeGreaterThan(before);
}

for (const language of ["en", "fa"] as const) {
  test(`R3c F8 photos add remove all and reorder only active pages while retaining originals ${language}`, async ({
    page,
  }) => {
    const reader = await mockReader(page, [{ kind: "success" }]);
    await configureLive(page);
    await setLanguage(page, language);
    const first = await fictionalPhoto(
      page,
      "fictional-page-red.png",
      "#d41414",
    );
    const second = await fictionalPhoto(
      page,
      "fictional-page-green.png",
      "#14c814",
    );
    const third = await fictionalPhoto(
      page,
      "fictional-page-blue.png",
      "#144ed4",
    );
    const original = await newLiveOriginal(
      page,
      [first, second],
      "photo",
      language,
    );
    const before = await readCanonicalBusinessEvidence(page);
    const cancel = await addPicker(page, language);
    await cancel.setFiles([]);
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    const invalid = await addPicker(page, language);
    await invalid.setFiles({
      name: "fictional-invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Fictional invalid page"),
    });
    await expect(
      page.getByText(
        t(
          language,
          "Choose PNG, JPEG, WebP or GIF invoice photos.",
          "عکس‌های فاکتور با قالب PNG، JPEG، WebP یا GIF انتخاب کنید.",
        ),
        { exact: true },
      ),
    ).toBeVisible();
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);

    const stale = await addPicker(page, language);
    await setBranch(page, "Branch 2");
    if (await stale.element().evaluate((element) => element.isConnected))
      await stale.setFiles(third);
    const staleState = await readCanonicalBusinessEvidence(page);
    expect(staleState.invoice).toEqual(before.invoice);
    expect(staleState.invoices).toEqual(before.invoices);
    expect(staleState.activity).toEqual(before.activity);
    await setBranch(page, "Branch 1");
    await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
    const chosen = await addPicker(page, language);
    await chosen.setFiles(third);
    await expect
      .poll(() => activeNames(page))
      .toEqual([first.name, second.name, third.name]);
    await remove(page, 2, language);
    await expect
      .poll(() => activeNames(page))
      .toEqual([first.name, third.name]);
    let state = await readCanonicalBusinessEvidence(page);
    expect(
      state.invoice.retained_original_pages?.map((source) => source.file_name),
    ).toEqual([second.name]);
    expect(new Set(await retainedSourceHashes(page, state.invoice))).toEqual(
      new Set([sourceHash(first), sourceHash(second), sourceHash(third)]),
    );
    await remove(page, 2, language);
    await remove(page, 1, language);
    await expect.poll(() => activeNames(page)).toEqual([]);
    state = await readCanonicalBusinessEvidence(page);
    expect(state.invoice.retained_original_pages).toHaveLength(3);
    const read = page.getByRole("button", {
      name: t(language, "Read invoice", "خواندن فاکتور"),
      exact: true,
    });
    await expect(read).toBeDisabled();
    await expect(
      page.getByText(
        t(
          language,
          "No pages selected for reading. Add a page to continue.",
          "صفحه‌ای برای خواندن انتخاب نشده است. برای ادامه یک صفحه اضافه کنید.",
        ),
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      })
      .click();
    const discard = page.getByRole("dialog", {
      name: t(language, "Discard invoice?", "فاکتور کنار گذاشته شود؟"),
      exact: true,
    });
    await expect(
      discard.getByRole("textbox", {
        name: t(language, "Reason", "دلیل"),
        exact: true,
      }),
    ).toBeVisible();
    await discard
      .getByRole("button", {
        name: t(language, "Cancel", "انصراف"),
        exact: true,
      })
      .click();
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      state.invoice,
    );
    const restored = await addPicker(page, language);
    await restored.setFiles([first, third]);
    await expect
      .poll(() => activeNames(page))
      .toEqual([first.name, third.name]);
    await page
      .getByRole("button", {
        name: t(language, "Move page 2 up", "انتقال صفحهٔ 2 به بالا"),
        exact: true,
      })
      .click();
    await expect
      .poll(() => activeNames(page))
      .toEqual([third.name, first.name]);
    await page.reload();
    await expect(read).toBeEnabled();
    expect(await activeNames(page)).toEqual([third.name, first.name]);
    expect(reader.requests).toHaveLength(0);
    await read.click();
    const reviewed = await expectReview(page, original.id, language);
    expect(reviewed.id).toBe(original.id);
    expect(reviewed.created_by_user_id).toBe(original.created_by_user_id);
    expect(reviewed.company_id).toBe(original.company_id);
    expect(reviewed.reading_record?.page_sha256s).toEqual([
      sourceHash(third),
      sourceHash(first),
    ]);
    expect(new Set(await retainedSourceHashes(page, reviewed))).toEqual(
      new Set([sourceHash(first), sourceHash(second), sourceHash(third)]),
    );
    expect(reader.requests).toHaveLength(1);
    expect(reader.requests[0].images).toHaveLength(2);
    const pixels = await jpegFacts(page, reader.requests[0].images);
    expect(pixels[0].pixel[2]).toBeGreaterThan(pixels[0].pixel[0]);
    expect(pixels[1].pixel[0]).toBeGreaterThan(pixels[1].pixel[2]);
    await expect(page.getByTestId("live-invoice-page-editor")).toHaveCount(0);
    await expect(
      page.getByLabel(t(language, "Replace file", "جایگزینی فایل"), {
        exact: true,
      }),
    ).toBeDisabled();
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(after.approvals).toEqual(before.approvals);
    expect(after.products).toEqual(before.products);
  });

  test(`R3c F8 PDF logical selection retains every original page and sends only the chosen page ${language}`, async ({
    page,
  }) => {
    const reader = await mockReader(page, [
      { kind: "network" },
      { kind: "success" },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    const original = await newLiveOriginal(page, pdfPath, "pdf", language);
    const before = await readCanonicalBusinessEvidence(page);
    const expected = createHash("sha256")
      .update(await readFile(pdfPath))
      .digest("hex");
    await expect(
      page.getByTestId("live-reading-pages").locator("li"),
    ).toHaveCount(2);
    await page
      .getByRole("button", {
        name: t(language, "Read invoice", "خواندن فاکتور"),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.live_reading
            ?.phase,
      )
      .toBe("failed");
    await expect(
      page.getByRole("button", {
        name: t(language, "Remove page 1", "حذف صفحهٔ 1"),
        exact: true,
      }),
    ).toBeEnabled();
    await remove(page, 1, language);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice
            .pdf_page_selection,
      )
      .toEqual([2]);
    await page
      .getByRole("button", {
        name: t(language, "Add page", "افزودن صفحه"),
        exact: true,
      })
      .click();
    const add = page.getByRole("dialog", {
      name: t(language, "Add a PDF page", "افزودن صفحهٔ PDF"),
      exact: true,
    });
    await expect(add).toContainText(
      t(
        language,
        "Choose a saved page from this PDF.",
        "صفحه‌ای ذخیره‌شده از همین PDF انتخاب کنید.",
      ),
    );
    await add
      .getByRole("button", {
        name: t(language, "Add page 1", "افزودن صفحهٔ 1"),
        exact: true,
      })
      .click();
    await expect(add).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice
            .pdf_page_selection,
      )
      .toEqual([1, 2]);
    await remove(page, 2, language);
    await remove(page, 1, language);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice
            .pdf_page_selection,
      )
      .toEqual([]);
    const read = page.getByRole("button", {
      name: t(language, "Read invoice", "خواندن فاکتور"),
      exact: true,
    });
    await expect(read).toBeDisabled();
    expect((await readCanonicalBusinessEvidence(page)).invoice.file_data).toBe(
      original.file_data,
    );
    await page
      .getByRole("button", {
        name: t(language, "Add page", "افزودن صفحه"),
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog", {
        name: t(language, "Add a PDF page", "افزودن صفحهٔ PDF"),
        exact: true,
      })
      .getByRole("button", {
        name: t(language, "Add page 2", "افزودن صفحهٔ 2"),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice
            .pdf_page_selection,
      )
      .toEqual([2]);
    await page.reload();
    await expect(read).toBeEnabled();
    await expect(
      page.getByTestId("live-reading-pages").locator("li"),
    ).toHaveCount(1);
    expect(
      await retainedSourceHashes(
        page,
        (await readCanonicalBusinessEvidence(page)).invoice,
      ),
    ).toEqual([expected]);
    await read.click();
    const reviewed = await expectReview(page, original.id, language);
    expect(reader.requests).toHaveLength(2);
    expect(reader.requests[1].images).toHaveLength(1);
    expect(
      (await jpegFacts(page, reader.requests[1].images)).map(
        ({ width, height }) => ({ width, height }),
      ),
    ).toEqual([{ width: 1700, height: 2200 }]);
    expect(reviewed.pdf_page_selection).toEqual([2]);
    expect(reviewed.file_data).toBe(original.file_data);
    expect(reviewed.original_pages).toHaveLength(1);
    expect(reviewed.reading_record?.page_sha256s).toEqual([expected]);
    expect(await retainedSourceHashes(page, reviewed)).toEqual([expected]);
    const phone = (page.viewportSize()?.width ?? 1440) <= 760;
    if (phone)
      await page
        .getByRole("button", {
          name: language === "en" ? /^View original \(/ : /^مشاهده اصل/,
        })
        .click();
    const viewer = page.getByRole(phone ? "dialog" : "complementary", {
      name: t(language, "Original invoice", "فاکتور اصلی"),
      exact: true,
    });
    await expect(viewer.locator(".invoice-original-page")).toHaveText("1 / 2");
    await viewer
      .getByRole("button", {
        name: t(language, "Next page", "صفحه بعد"),
        exact: true,
      })
      .click();
    await expect(viewer.locator(".invoice-original-page")).toHaveText("2 / 2");
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(after.approvals).toEqual(before.approvals);
  });
}

test("R3c F8 an accepted photo upload finishes on retained A while actual manual B stays unchanged", async ({
  page,
}) => {
  await mockReader(page, []);
  await configureLive(page);
  const first = await fictionalPhoto(page, "fictional-saved-A.png");
  const later = await fictionalPhoto(
    page,
    "fictional-pending-add.png",
    "#143fd4",
  );
  const original = await newLiveOriginal(page, first);
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  await openInvoiceDetails(page);
  await page
    .getByLabel("Invoice number", { exact: true })
    .fill("FICTIONAL-MANUAL-B");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice
          .supplier_invoice_number,
    )
    .toBe("FICTIONAL-MANUAL-B");
  const manual = structuredClone(
    (await readCanonicalBusinessEvidence(page)).invoice,
  );
  await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
  await expect
    .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice.id)
    .toBe(original.id);
  await page.evaluate(() => {
    const actual = File.prototype.arrayBuffer;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.assign(window, { fictionalAddStorage: { started: false, release } });
    File.prototype.arrayBuffer = async function () {
      if (this.name === "fictional-pending-add.png") {
        (
          window as unknown as { fictionalAddStorage: { started: boolean } }
        ).fictionalAddStorage.started = true;
        await pending;
      }
      return actual.call(this);
    };
  });
  const picker = await addPicker(page);
  await picker.setFiles(later);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { fictionalAddStorage: { started: boolean } })
            .fictionalAddStorage.started,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await page.getByRole("tab", { name: /^Drafts \d+$/, exact: false }).click();
  await page
    .getByRole("link", { name: "FICTIONAL-MANUAL-B", exact: true })
    .click();
  await expect
    .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice.id)
    .toBe(manual.id);
  await page.evaluate(() =>
    (
      window as unknown as { fictionalAddStorage: { release(): void } }
    ).fictionalAddStorage.release(),
  );
  await expect
    .poll(async () =>
      (await readCanonicalBusinessEvidence(page)).invoices
        ?.find((invoice) => invoice.id === original.id)
        ?.original_pages?.map((source) => source.file_name),
    )
    .toEqual([first.name, later.name]);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoice).toEqual(manual);
  await expect(page).toHaveURL(
    (url) =>
      new URLSearchParams(url.hash.split("?")[1]).get("id") === manual.id,
  );
  const saved = after.invoices!.find((invoice) => invoice.id === original.id)!;
  expect(saved.created_by_user_id).toBe(original.created_by_user_id);
  expect(saved.company_id).toBe(original.company_id);
  expect(await retainedSourceHashes(page, saved)).toEqual([
    sourceHash(first),
    sourceHash(later),
  ]);
  expect(saved.lines).toEqual([]);
});
