import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage } from "./helpers";
import {
  configureLive,
  deferred,
  fictionalPhoto,
  mockReader,
  newLiveOriginal,
  pressRead,
  retainedSourceHashes,
  t,
} from "./r3-live-reading-helpers";
for (const language of ["en", "fa"] as const) {
  test(`R3c F7 processing header has a real reading caption and no missing fragments or Post ${language}`, async ({
    page,
  }) => {
    const held = deferred();
    const reader = await mockReader(page, [
      { kind: "held", wait: held.promise },
    ]);
    try {
      await configureLive(page);
      if (language === "fa") await setLanguage(page, "fa");
      const original = await fictionalPhoto(
        page,
        "fictional-header-original.png",
      );
      const invoice = await newLiveOriginal(page, original, "photo", language);
      const hashes = await retainedSourceHashes(page, invoice);
      const before = await readCanonicalBusinessEvidence(page);
      const header = page.locator("#invoice-review-header");
      await expect(
        header.getByRole("heading", {
          name: t(language, "New invoice", "فاکتور جدید"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        header.getByText(
          t(
            language,
            "Original saved · ready to read",
            "اصل فایل ذخیره شد · آمادهٔ خواندن",
          ),
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        header.getByRole("button", {
          name: t(language, "Post invoice", "ثبت فاکتور"),
          exact: true,
        }),
      ).toHaveCount(0);
      await pressRead(page, language);
      await expect.poll(() => reader.requests.length).toBe(1);
      await expect(
        header.getByText(
          t(language, "Reading with AI…", "در حال خواندن با هوش مصنوعی…"),
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        header.getByText(t(language, "Not added", "ثبت نشده"), {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(header.locator(".value-empty")).toHaveCount(0);
      await expect(header.locator(".invoice-title-reference")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: t(language, "Post invoice", "ثبت فاکتور"),
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByTestId("live-reading-progress")
        .getByRole("button", {
          name: t(language, "Cancel", "انصراف"),
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.live_reading
              ?.phase,
        )
        .toBe("cancelled");
      await expect(
        header.getByText(
          t(
            language,
            "Reading cancelled · original saved",
            "خوانش لغو شد · اصل فایل ذخیره شد",
          ),
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        header.getByText(
          t(language, "Reading with AI…", "در حال خواندن با هوش مصنوعی…"),
          { exact: true },
        ),
      ).toHaveCount(0);
      held.resolve();
      await expect.poll(() => reader.finished).toBe(1);
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.invoice.id).toBe(invoice.id);
      expect(after.invoice.status).toBe("reading");
      expect(after.invoice.live_reading?.phase).toBe("cancelled");
      expect(after.ledger).toEqual(before.ledger);
      expect(after.approvals).toEqual(before.approvals);
      expect(after.products).toEqual(before.products);
      expect(after.stock_movements).toEqual(before.stock_movements);
      expect(await retainedSourceHashes(page, after.invoice)).toEqual(hashes);
      expect(reader.requests).toHaveLength(1);
    } finally {
      held.resolve();
    }
  });
}
