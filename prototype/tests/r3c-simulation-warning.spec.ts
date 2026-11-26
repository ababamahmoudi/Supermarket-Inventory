import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  chooseOption,
  openInvoiceSourcePicker,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import {
  expectReview,
  fictionalPhoto,
  mockReader,
  newLiveOriginal,
  readerAddress,
  retainedSourceHashes,
  sourceHash,
  t,
} from "./r3-live-reading-helpers";

for (const language of ["en", "fa"] as const)
  test(`R3c F1 simulation is explicit and stays with the invoice after Live is enabled ${language}`, async ({
    page,
  }) => {
    const reader = await mockReader(page, [{ kind: "success" }]);
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#invoices");
    await page
      .getByRole("button", {
        name: t(language, "New invoice", "فاکتور جدید"),
        exact: true,
      })
      .click();
    const chooser = page.getByRole("dialog", {
      name: t(language, "New invoice", "فاکتور جدید"),
      exact: true,
    });
    const warning = page.getByTestId("invoice-simulation-warning");
    await expect(
      chooser.getByTestId("invoice-simulation-warning"),
    ).toBeVisible();
    await expect(warning).toContainText(
      t(
        language,
        "Photos and PDFs use fictional values; your invoice is not read.",
        "عکس و PDF با مقادیر ساختگی پر می‌شوند؛ فاکتور شما خوانده نمی‌شود.",
      ),
    );
    await expect(warning.locator("svg")).toBeVisible();
    const before = await readCanonicalBusinessEvidence(page);
    const cancelled = await openInvoiceSourcePicker(page, "photo", language);
    await cancelled.setFiles([]);
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);

    const photo = await fictionalPhoto(page, "fictional-simulation-proof.png");
    const picker = await openInvoiceSourcePicker(page, "photo", language);
    await picker.setFiles(photo);
    await expect(
      page.getByTestId("invoice-review").getByRole("heading", {
        name: t(language, "Invoice lines", "ردیف‌های فاکتور"),
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(
        async () => (await readCanonicalBusinessEvidence(page)).invoice.status,
      )
      .toBe("review");
    const simulated = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(simulated.id).not.toBe(before.invoice.id);
    expect(simulated.simulated_reading).toBe(true);
    expect(await retainedSourceHashes(page, simulated)).toEqual([
      sourceHash(photo),
    ]);
    await expect(warning).toBeVisible();
    expect(reader.requests).toHaveLength(0);

    await page.goto("/#settings?group=receiving");
    await chooseOption(
      page,
      page.getByRole("combobox", {
        name: t(language, "Reading mode", "حالت خواندن"),
        exact: true,
      }),
      "live",
      t(language, "Live", "زنده"),
    );
    await page
      .getByRole("textbox", {
        name: t(language, "Reader address", "نشانی خواننده"),
        exact: true,
      })
      .fill(readerAddress);
    await page
      .getByRole("button", {
        name: t(language, "Save changes", "ذخیره تغییرات"),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).config.receiving
            .ai_reading_mode,
      )
      .toBe("live");
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      simulated,
    );
    await page.goto(`/#invoices?id=${encodeURIComponent(simulated.id)}`);
    await page.reload();
    await expectReview(page, simulated.id, language);
    await expect(warning).toBeVisible();
    expect(
      (await readCanonicalBusinessEvidence(page)).invoice.simulated_reading,
    ).toBe(true);

    await page
      .getByRole("button", {
        name: t(language, "Save and close", "ذخیره و بستن"),
        exact: true,
      })
      .click();
    const livePhoto = await fictionalPhoto(page, "fictional-live-proof.png");
    const live = await newLiveOriginal(page, [livePhoto], "photo", language);
    await expect(warning).toHaveCount(0);
    expect(live.simulated_reading).toBeUndefined();
    await page
      .getByRole("button", {
        name: t(language, "Read invoice", "خواندن فاکتور"),
        exact: true,
      })
      .click();
    await expectReview(page, live.id, language);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.reading_record?.source).toBe("live");
    expect(after.invoice.simulated_reading).toBeUndefined();
    await expect(warning).toHaveCount(0);
    expect(await retainedSourceHashes(page, after.invoice)).toEqual([
      sourceHash(livePhoto),
    ]);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(reader.requests).toHaveLength(1);
  });
