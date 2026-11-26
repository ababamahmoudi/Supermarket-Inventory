import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage, signIn, setBranch } from "./helpers";
import {
  configureLive,
  fictionalPhoto,
  newLiveOriginal,
  retainedSourceHashes,
  t,
} from "./r3-live-reading-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R3c F4 discard retains original, records reason, denies editing and Undo recovers without a request ${language}`, async ({
    page,
  }) => {
    await configureLive(page);
    if (language === "fa") await setLanguage(page, "fa");
    const original = await fictionalPhoto(
      page,
      "fictional-discard-original.png",
    );
    const invoice = await newLiveOriginal(page, original, "photo", language);
    const hashes = await retainedSourceHashes(page, invoice);
    const before = await readCanonicalBusinessEvidence(page);
    const discard = page.locator("#invoice-review-header").getByRole("button", {
      name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
      exact: true,
    });
    await discard.click();
    const dialog = page.getByRole("dialog", {
      name: t(language, "Discard invoice?", "فاکتور کنار گذاشته شود؟"),
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      })
      .click();
    await expect(
      dialog.getByText(t(language, "Add a reason.", "یک دلیل اضافه کنید."), {
        exact: true,
      }),
    ).toBeVisible();
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      before.invoice,
    );
    await dialog
      .getByRole("button", {
        name: t(language, "Cancel", "انصراف"),
        exact: true,
      })
      .click();
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      before.invoice,
    );
    await discard.click();
    await dialog
      .getByRole("textbox", {
        name: t(language, "Reason", "دلیل"),
        exact: true,
      })
      .fill("Fictional duplicate delivery");
    await dialog
      .getByRole("button", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(
        async () => (await readCanonicalBusinessEvidence(page)).invoice.status,
      )
      .toBe("cancelled");
    const cancelled = await readCanonicalBusinessEvidence(page);
    expect(cancelled.invoice.cancellation?.reason).toBe(
      "Fictional duplicate delivery",
    );
    expect(cancelled.invoice.cancellation?.by_user_id).toBeTruthy();
    expect(cancelled.invoice.original_pages).toEqual(invoice.original_pages);
    expect(await retainedSourceHashes(page, cancelled.invoice)).toEqual(hashes);
    expect(cancelled.ledger).toEqual(before.ledger);
    expect(cancelled.stock_movements).toEqual(before.stock_movements);
    expect(cancelled.products).toEqual(before.products);
    expect(cancelled.approvals).toEqual(before.approvals);
    await expect(
      page.getByRole("tab", { name: /^(Cancelled|لغوشده) 1$/ }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /^(Cancelled|لغوشده) 1$/ }).click();
    await page
      .locator(
        `.invoice-saved-table a.entity-link[href="#invoices?id=${encodeURIComponent(invoice.id)}"]`,
      )
      .click();
    await expect(page.getByTestId("invoice-cancelled-detail")).toBeVisible();
    const retainedViewer = page.locator(
      `.original-viewer[data-original-invoice-id="${invoice.id}"]`,
    );
    await expect
      .poll(async () =>
        retainedViewer
          .locator(".original-viewer-panel img")
          .evaluateAll((images) =>
            images.some(
              (image) => (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const otherInvoice = before.invoices?.find(
      (record) =>
        record.id !== invoice.id &&
        record.status === "posted" &&
        record.branch === invoice.branch,
    );
    expect(otherInvoice).toBeTruthy();
    await page.goto(`/#invoices?id=${encodeURIComponent(otherInvoice!.id)}`);
    await expect
      .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice.id)
      .toBe(otherInvoice!.id);
    const workspaceB = (await readCanonicalBusinessEvidence(page)).invoice;
    const undo = page
      .getByTestId("undo-toast")
      .getByRole("button", { name: t(language, "Undo", "واگرد"), exact: true });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoices?.find(
            (record) => record.id === invoice.id,
          )?.status,
      )
      .toBe("reading");
    const restored = await readCanonicalBusinessEvidence(page);
    expect(restored.invoice).toEqual(workspaceB);
    const restoredA = restored.invoices!.find(
      (record) => record.id === invoice.id,
    )!;
    expect(restoredA.live_reading?.phase).toBe("cancelled");
    expect(restoredA.live_reading?.attempt_id).not.toBe(
      invoice.live_reading?.attempt_id,
    );
    expect(await retainedSourceHashes(page, restoredA)).toEqual(hashes);
    await page.goto(`/#invoices?id=${encodeURIComponent(invoice.id)}`);
    await expect(
      page
        .getByRole("button", {
          name: t(language, "Read again", "خواندن دوباره"),
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        t(language, "Reading with AI…", "در حال خواندن با هوش مصنوعی…"),
        { exact: true },
      ),
    ).toHaveCount(0);
  });

  test(`R3c F4 Drafts More discards an empty draft without a dialog ${language}`, async ({
    page,
  }) => {
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    if (language === "fa") await setLanguage(page, "fa");
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
    await chooser
      .getByRole("button", {
        name: t(language, "Manual entry", "ورود دستی"),
        exact: true,
      })
      .click();
    await expect(page.locator("#invoice-review-header")).toBeVisible();
    const empty = (await readCanonicalBusinessEvidence(page)).invoice;
    await page
      .locator("#invoice-review-header")
      .getByRole("button", {
        name: t(language, "Save and close", "ذخیره و بستن"),
        exact: true,
      })
      .click();
    await page.getByRole("tab", { name: /^(Drafts|پیش‌نویس‌ها) / }).click();
    const row = page.locator("tr[data-row-href]").filter({
      has: page.locator(
        `a[href="#invoices?id=${encodeURIComponent(empty.id)}"]`,
      ),
    });
    const more = row.getByRole("button", {
      name: t(language, "More", "بیشتر"),
      exact: true,
    });
    await more.scrollIntoViewIfNeeded();
    const geometry = await more.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const parent = button.closest("tr")!.getBoundingClientRect();
      return {
        inside:
          bounds.left >= parent.left - 2 &&
          bounds.right <= parent.right + 2 &&
          bounds.top >= parent.top - 2 &&
          bounds.bottom <= parent.bottom + 2,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(geometry.inside).toBe(true);
    expect(geometry.overflow).toBeLessThanOrEqual(2);
    if ((page.viewportSize()?.width ?? 1440) <= 760)
      await expect(row.locator(".phone-list-chevron a")).toHaveCount(1);
    await more.click();
    await page
      .getByRole("menuitem", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () => (await readCanonicalBusinessEvidence(page)).invoice.status,
      )
      .toBe("cancelled");
    await expect(
      page.getByRole("dialog", {
        name: t(language, "Discard invoice?", "فاکتور کنار گذاشته شود؟"),
        exact: true,
      }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: /^(Cancelled|لغوشده) 1$/ }).click();
    await page
      .locator(
        `.invoice-saved-table a.entity-link[href="#invoices?id=${encodeURIComponent(empty.id)}"]`,
      )
      .click();
    await expect(page.getByTestId("invoice-cancelled-detail")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: t(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      }),
    ).toHaveCount(0);
  });
}
