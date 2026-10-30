import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openInvoiceDetails } from "./helpers";
import {
  importReceivingFixture,
  openReceivingLine,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";

const source = fileURLToPath(
  new URL(
    "./fixtures/r2c-approval-fictional-readings-export.json",
    import.meta.url,
  ),
);

async function postThreeProductInvoice(
  page: Page,
  language: "en" | "fa",
  retainExisting = false,
) {
  const invoice = await importReceivingFixture(
    page,
    language,
    undefined,
    undefined,
    source,
    { retainExisting },
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
  for (let index = 0; index < 3; index++) {
    const editor = await openReceivingLine(page, index);
    await setReceivingCategory(page, editor, language);
    await editor
      .getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      })
      .click();
    await expect(editor).toHaveCount(0);
  }
  await page
    .getByRole("button", {
      name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
      exact: true,
    })
    .click();
  await page
    .locator(".receiving-post-control:visible")
    .getByRole("button")
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: word(language, "Post invoice", "ثبت فاکتور"),
      exact: true,
    })
    .click();
  await expect(page.locator(".posted-receiving")).toBeVisible();
  return invoice;
}

async function finishDeparture(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator(".approval-departure.is-leaving")).toHaveCount(0);
}

for (const language of ["en", "fa"] as const) {
  const bulkLast = language === "fa";
  test(`R3c K0 last ${bulkLast ? "bulk" : "individual"} approval reveals the empty board after a stable partial batch in ${language}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({
      width: info.project.name === "phone" ? 390 : 1440,
      height: 500,
    });
    if (language === "fa") await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const invoice = await postThreeProductInvoice(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    await page.goto("/#approvals");
    await expect(page.locator(".approval-detail-row")).toHaveCount(3);
    await page
      .getByTestId(`invoice-approval-group-${invoice.id}`)
      .getByRole("button", { name: /^(Approve all \(3\)|تأیید همه \(3\))/ })
      .click();
    const batch = page.getByRole("dialog");
    await batch.locator("tbody").getByRole("checkbox").nth(1).uncheck();
    await batch.locator("tbody").getByRole("checkbox").nth(2).uncheck();
    await page
      .locator(".approval-detail-row")
      .last()
      .evaluate((element) =>
        window.scrollTo(
          0,
          window.scrollY +
            element.getBoundingClientRect().top -
            window.innerHeight / 2,
        ),
      );
    const partialScroll = await page.evaluate(() => window.scrollY);
    expect(partialScroll).toBeGreaterThan(100);
    const survivorId = await page
      .locator(".approval-detail-row")
      .last()
      .getAttribute("data-approval-id");
    const survivor = page.locator(`[data-approval-id="${survivorId}"]`);
    await expect(survivor).toBeInViewport();
    await batch
      .getByRole("button", {
        name: word(language, "Approve 1 product", "تأیید 1 کالا"),
        exact: true,
      })
      .click();
    await expect(batch).toHaveCount(0);
    await finishDeparture(page);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - partialScroll),
    ).toBeLessThanOrEqual(2);
    await expect(page.locator(".approval-detail-row")).toHaveCount(2);
    await expect(survivor).toBeInViewport();
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - partialScroll),
    ).toBeLessThanOrEqual(2);
    await page
      .locator(".approval-detail-row")
      .first()
      .getByRole("button", {
        name: word(language, "Approve product", "تأیید کالا"),
        exact: true,
      })
      .click();
    const middle = page.getByRole("dialog", {
      name: word(language, "Review approval", "بررسی تأیید"),
      exact: true,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await middle
      .getByRole("button", {
        name: word(language, "Approve product", "تأیید کالا"),
        exact: true,
      })
      .click();
    await expect(middle).toHaveCount(0);
    await finishDeparture(page);
    await expect(page.locator(".approval-detail-row")).toHaveCount(1);
    await expect(
      page.getByText(
        word(
          language,
          "No pending requests. Receive an invoice to create a proposal.",
          "درخواستی در انتظار نیست. برای ایجاد پیشنهاد، یک فاکتور دریافت کنید.",
        ),
        { exact: true },
      ),
    ).toHaveCount(0);

    if (bulkLast)
      await page
        .getByTestId(`invoice-approval-group-${invoice.id}`)
        .getByRole("button", { name: /^(Approve all \(1\)|تأیید همه \(1\))/ })
        .click();
    else
      await page
        .locator(".approval-detail-row")
        .getByRole("button", {
          name: word(language, "Approve product", "تأیید کالا"),
          exact: true,
        })
        .click();
    const last = page.getByRole("dialog", {
      name: bulkLast
        ? word(language, "Review invoice approvals", "بررسی تأییدهای فاکتور")
        : word(language, "Review approval", "بررسی تأیید"),
      exact: true,
    });
    await page.evaluate(() => window.scrollTo(0, 480));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await last
      .getByRole("button", {
        name: bulkLast
          ? word(language, "Approve 1 product", "تأیید 1 کالا")
          : word(language, "Approve product", "تأیید کالا"),
        exact: true,
      })
      .click();
    await expect(last).toHaveCount(0);
    await finishDeparture(page);
    await expect(page.locator(".approval-detail-row")).toHaveCount(0);
    const empty = page.getByText(
      word(
        language,
        "No pending requests. Receive an invoice to create a proposal.",
        "درخواستی در انتظار نیست. برای ایجاد پیشنهاد، یک فاکتور دریافت کنید.",
      ),
      { exact: true },
    );
    await expect(empty).toBeVisible();
    const geometry = await empty.evaluate((element) => ({
      scrollY: window.scrollY,
      empty: {
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
      },
      viewportHeight: window.innerHeight,
      boardHeight: document
        .querySelector(".approval-board-list")
        ?.getBoundingClientRect().height,
      boardFloor: (
        document.querySelector(".approval-board-list") as HTMLElement | null
      )?.style.minBlockSize,
    }));
    await info.attach("last-approval-geometry", {
      body: JSON.stringify(geometry),
      contentType: "application/json",
    });
    await expect(empty).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() =>
        page
          .locator(".approval-board-list")
          .evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBeLessThanOrEqual(2);
    await expect(
      page.getByRole("tab", { name: /^(Pending|در انتظار) 0$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /^(Approved|تأییدشده) 3$/ }),
    ).toBeVisible();
    const after = await readCanonicalBusinessEvidence(page);
    expect(
      after.approvals.filter((approval) => approval.status === "approved"),
    ).toHaveLength(3);
    expect(
      after.products.filter((product) => product.status === "active"),
    ).toHaveLength(3);
    expect(after.invoice).toEqual(before.invoice);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(errors).toEqual([]);
    await page.goto("/#lookup");
    await expect(
      page.getByRole("heading", {
        name: word(language, "Cashier lookup", "جست‌وجوی صندوق‌دار"),
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("R3c K0 completing the bottom invoice group reveals remaining approvals above", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({
    width: info.project.name === "phone" ? 390 : 1440,
    height: 500,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const invoice = await postThreeProductInvoice(page, "en", true);
  await page.goto("/#approvals");
  const group = page.getByTestId(`invoice-approval-group-${invoice.id}`);
  await expect(group).toBeVisible();
  const before = await readCanonicalBusinessEvidence(page);
  const own = before.approvals.filter(
    (approval) =>
      approval.source_invoice_id === invoice.id ||
      approval.invoice_ids?.includes(invoice.id),
  );
  expect(own).toHaveLength(3);
  const other = before.approvals.filter(
    (approval) => !own.some((item) => item.id === approval.id),
  );
  const rows = page.locator(".approval-detail-row");
  const remainingCount = (await rows.count()) - 3;
  expect(remainingCount).toBeGreaterThan(0);
  expect(
    (
      await rows.evaluateAll((elements) =>
        elements.map((element) => (element as HTMLElement).dataset.approvalId),
      )
    )
      .slice(-3)
      .sort(),
  ).toEqual(own.map((approval) => approval.id).sort());
  await group
    .getByRole("button", { name: "Approve all (3)", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Review invoice approvals",
    exact: true,
  });
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await dialog
    .getByRole("button", { name: "Approve 3 products", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await finishDeparture(page);
  await expect(group).toHaveCount(0);
  await expect(rows).toHaveCount(remainingCount);
  await expect
    .poll(() =>
      rows.evaluateAll((elements) => {
        const top =
          document.querySelector(".topbar")?.getBoundingClientRect().bottom ??
          0;
        return elements.some((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.height > 0 &&
            bounds.bottom > top &&
            bounds.top < window.innerHeight
          );
        });
      }),
    )
    .toBe(true);
  await expect(page.locator(".approval-board-list")).toHaveCSS(
    "min-block-size",
    "0px",
  );
  const after = await readCanonicalBusinessEvidence(page);
  expect(
    after.approvals
      .filter((approval) => own.some((item) => item.id === approval.id))
      .every((approval) => approval.status === "approved"),
  ).toBe(true);
  expect(
    after.approvals.filter((approval) =>
      other.some((item) => item.id === approval.id),
    ),
  ).toEqual(other);
  expect(after.invoice).toEqual(before.invoice);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  expect(errors).toEqual([]);
});
