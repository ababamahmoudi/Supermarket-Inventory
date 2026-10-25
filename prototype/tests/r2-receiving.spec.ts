import { openInvoiceDetails } from "./helpers";
import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction } from "./helpers";
import {
  importReceivingFixture,
  openReceivingLine,
  receivingRow,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2 compact receiving, posting, grouped approval and delivery link in ${language}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const caseStarted = performance.now();
    const phone = testInfo.project.name === "phone";
    await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.text().startsWith("[canonical-evidence:")) {
        console.log(message.text());
      }
    });
    const canonicalAt = async (stage: string) => {
      const started = performance.now();
      console.log(
        `[canonical-evidence:${stage}] requested; ${Math.round(testInfo.timeout - (performance.now() - caseStarted))}ms remain`,
      );
      const evidence = await readCanonicalBusinessEvidence(page, stage);
      testInfo.annotations.push({
        type: `${stage}-evidence-read-ms`,
        description: String(Math.round(performance.now() - started)),
      });
      return evidence;
    };
    const imported = await importReceivingFixture(page, language);
    await expect(
      page.locator('[data-testid^="invoice-line-row-"]'),
    ).toHaveCount(25);
    await expect(
      page.locator('[id^="invoice-line-"][id$="-name-en"]'),
    ).toHaveCount(0);
    const review = page.getByTestId("invoice-review");
    if (!phone) {
      const height = await review.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(
        height,
        "All 25 closed lines, header and totals fit in three desktop windows",
      ).toBeLessThanOrEqual(2700);
      const documentHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      testInfo.annotations.push({
        type: "closed-invoice-height",
        description: JSON.stringify({
          review: height,
          document: documentHeight,
        }),
      });
      expect(
        documentHeight,
        "The entire invoice page, including the app header, fits in three desktop windows",
      ).toBeLessThanOrEqual(2700);
      const table = review.locator(".receiving-lines-table");
      await expect(table).toHaveCount(1);
      expect(
        await table.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await expect(table.locator("thead th")).toHaveCount(5);
      const status = receivingRow(page, 0).locator(".receiving-status-icon");
      await expect(status).toBeInViewport({ ratio: 1 });
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    // Direct evidence links also target a closed draft line without opening an editor.
    const draftLine = imported.lines[0].id ?? "0";
    await page.goto(
      `/#invoices?id=${encodeURIComponent(imported.id)}&line=${encodeURIComponent(draftLine)}`,
    );
    await expect(page.locator(".invoice-line-target")).toHaveAttribute(
      "data-line-id",
      draftLine,
    );
    await expect(page.locator(".invoice-line-target")).toBeInViewport();
    await expect(
      page.locator('[id^="invoice-line-"][id$="-name-en"]'),
    ).toHaveCount(0);
    // Empty optional fields marked check in the export must not create review work.
    expect(
      imported.lines.every(
        (line) =>
          !(line.low_confidence_fields ?? []).some((field) =>
            /lot|expiry|barcode/.test(field),
          ),
      ),
    ).toBe(true);
    expect(imported.subtotal).toBe("96.35");
    const incompletePost = page.getByRole("button", {
      name: word(language, "Post invoice", "ثبت فاکتور"),
      exact: true,
    });
    await expect(incompletePost).toBeEnabled();
    await incompletePost.click();
    const missingPanel = page.getByRole("alert", {
      name: word(language, "What's missing", "موارد ناقص"),
      exact: true,
    });
    await expect(missingPanel).toBeVisible();
    await expect(missingPanel).toContainText(
      word(language, "choose a pricing category", "دسته قیمت‌گذاری"),
    );
    await openInvoiceDetails(page);
    await page
      .getByRole("button", {
        name: word(
          language,
          "Looks right: Invoice details",
          "درست است: اطلاعات فاکتور",
        ),
        exact: true,
      })
      .click();
    for (let index = 0; index < 25; index++) {
      const editor = await openReceivingLine(page, index);
      await setReceivingCategory(page, editor, language);
      if (index === 0) {
        await expect(editor.locator("#invoice-line-0-name-en")).toHaveValue(
          "Aurora Test Chickpeas 500ml",
        );
        await expect(
          editor.getByRole("button", { name: /^Looks right:/ }),
        ).toHaveCount(0);
      }
      await editor
        .getByRole("button", {
          name: word(language, "Confirm line", "تأیید ردیف"),
          exact: true,
        })
        .click();
      await expect(
        receivingRow(page, index).getByRole("img", {
          name: word(language, "Confirmed", "تأیید شد"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.locator('[id^="invoice-line-"][id$="-name-en"]'),
      ).toHaveCount(0);
    }
    await page
      .getByRole("button", {
        name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
        exact: true,
      })
      .click();
    await expect
      .poll(async () => {
        const canonical = await readCanonicalBusinessEvidence(page);
        const ready =
          canonical.invoice.id === imported.id
            ? canonical.invoice
            : canonical.invoices!.find((entry) => entry.id === imported.id)!;
        return {
          lines: ready.lines.length,
          unconfirmed: ready.lines.flatMap((line, index) =>
            line.review_confirmed
              ? []
              : [
                  {
                    line: index + 1,
                    confirmed: line.review_confirmed ?? false,
                    changed: line.review_changed_after_confirmation ?? false,
                    highlights: line.low_confidence_fields ?? [],
                  },
                ],
          ),
        };
      })
      .toEqual({ lines: 25, unconfirmed: [] });
    expect(
      (await readCanonicalBusinessEvidence(page)).suppliers?.find(
        (entry) => entry.name === "Cedar Valley Foods Inc.",
      )?.phone ?? "",
    ).toBe("");
    const post = page.getByRole("button", {
      name: word(language, "Post invoice", "ثبت فاکتور"),
      exact: true,
    });
    await expect(post).toBeEnabled();
    await post.click();
    await page
      .getByRole("dialog", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .getByRole("button", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .click();
    await expect(
      page
        .locator(".invoice-posted-workspace")
        .getByText(word(language, "Posted", "ثبت‌شده"), { exact: true }),
    ).toBeVisible();
    const posted = await canonicalAt("posted");
    expect(
      posted.invoices?.find((entry) => entry.id === imported.id)?.status,
    ).toBe("posted");
    expect(posted.products).toHaveLength(25);
    expect(
      posted.stock_movements?.filter(
        (entry) => entry.invoice_id === imported.id,
      ),
    ).toHaveLength(25);
    expect(
      posted.ledger
        .filter((entry) => entry.supplier === "Cedar Valley Foods Inc.")
        .map((entry) => entry.amount),
    ).toEqual(["96.35"]);
    await page.goto("/#approvals");
    const group = page.getByTestId(`invoice-approval-group-${imported.id}`);
    const approveAll = group.getByRole("button", {
      name: /^(Approve all 25|تأیید همهٔ 25)/,
    });
    await approveAll.click();
    const approvalDialog = page.getByRole("dialog");
    await expect(approvalDialog.getByRole("checkbox")).toHaveCount(25);
    // Unticking affects the preview and the committed approval selection.
    await approvalDialog.getByRole("checkbox").last().uncheck();
    await approvalDialog.getByRole("checkbox").last().check();
    const commit = approvalDialog
      .getByRole("button", { name: /^(Approve 25 products|تأیید 25 کالا)$/ })
      .last();
    // Exercise a real scrolled board while its review dialog remains open.
    await page.evaluate(() => window.scrollTo(0, 480));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(100);
    await commit.click();
    await expect(approvalDialog).toHaveCount(0);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore),
    ).toBeLessThanOrEqual(2);
    await expect(
      page.getByRole("tab", { name: /^(Approved|تأییدشده) 25$/ }),
    ).toBeVisible();
    const approved = await canonicalAt("approved");
    expect(
      approved.products.filter((product) => product.status === "active"),
    ).toHaveLength(25);
    // Follow the genuine Received link, then the product's delivery link, to the exact line.
    await page.goto("/#received");
    const deliveryLink = page
      .locator('a[href^="#invoices?"][href*="&line="]:visible')
      .first();
    await expect(deliveryLink).toBeVisible();
    const href = await deliveryLink.getAttribute("href");
    expect(href).toContain(`id=${encodeURIComponent(imported.id)}`);
    await deliveryLink.click();
    await expect(page.locator(".invoice-line-target")).toHaveCount(1);
    await expect(page.locator(".invoice-line-target")).toBeInViewport();
    expect(
      await page
        .locator(".invoice-line-target td")
        .first()
        .evaluate((element) => getComputedStyle(element).animationDuration),
    ).toBe("2s");
    await (
      await openShellAction(
        page,
        word(language, "Switch to dark theme", "تغییر به تم تیره"),
      )
    ).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const firstProduct = (await readCanonicalBusinessEvidence(page))
      .products[0];
    await page.goto(`/#product?code=${encodeURIComponent(firstProduct.code)}`);
    await expect(
      page.getByRole("heading", {
        name: word(language, "Deliveries", "تحویل‌ها"),
        exact: true,
      }),
    ).toBeVisible();
    const productDelivery = page
      .locator('a[href^="#invoices?"][href*="&line="]:visible')
      .first();
    await expect(productDelivery).toBeVisible();
    await productDelivery.click();
    await expect(page.locator(".invoice-line-target")).toHaveCount(1);
    await expect(page.locator(".invoice-line-target")).toBeInViewport();
    expect(
      await page
        .locator(".invoice-line-target td")
        .first()
        .evaluate((element) => getComputedStyle(element).animationDuration),
    ).toBe("2s");
    await expect(page.locator(".invoice-line-target")).toHaveCount(0, {
      timeout: 4000,
    });
    expect(errors).toEqual([]);
  });
}
