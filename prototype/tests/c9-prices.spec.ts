import Decimal from "decimal.js";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import { expect, test, type Locator, type Page } from "@playwright/test";
import { openC8PriceDialog, visitC8 } from "../scripts/capture-c8-proof.mjs";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { configuredPersonExpectation } from "./configured-person-expectations";
import { setBranch, setLanguage, signIn } from "./helpers";

test.setTimeout(120000);

const money = (amount: string) => `$${new Decimal(amount).toFixed(2)}`;
const translated = (language: "en" | "fa", en: string, fa: string) =>
  language === "en" ? en : fa;

async function prepareManager(page: Page, language: "en" | "fa") {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
}

async function productRow(page: Page, code: string) {
  await visitC8(page, "products");
  await page
    .getByRole("searchbox", { name: /^(Search products|جست‌وجوی محصولات)$/ })
    .fill(code);
  const row = page.locator(
    `.catalog-products-table tbody tr[data-row-href="#product?code=${code}"]`,
  );
  await expect(row).toBeVisible();
  return row;
}

async function expectUnbrokenPrice(line: Locator) {
  await expect(line).toBeVisible();
  const geometry = await line.evaluate((element) => {
    const previous = element.querySelector(":scope > del")!;
    const current = element.querySelector(":scope > strong")!;
    const oldRect = previous.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    return {
      previous: {
        left: oldRect.left,
        right: oldRect.right,
        top: oldRect.top,
        bottom: oldRect.bottom,
        height: oldRect.height,
      },
      current: {
        left: currentRect.left,
        right: currentRect.right,
        top: currentRect.top,
        bottom: currentRect.bottom,
        height: currentRect.height,
      },
      lines: element.getClientRects().length,
      wrap: getComputedStyle(element).flexWrap,
      whitespace: getComputedStyle(element).whiteSpace,
      overflow: element.scrollWidth - element.clientWidth,
    };
  });
  expect(geometry.previous.height).toBeGreaterThan(0);
  expect(geometry.current.height).toBeGreaterThan(0);
  expect(geometry.previous.right).toBeLessThanOrEqual(
    geometry.current.left + 1,
  );
  const overlap =
    Math.min(geometry.previous.bottom, geometry.current.bottom) -
    Math.max(geometry.previous.top, geometry.current.top);
  expect(overlap).toBeGreaterThanOrEqual(
    Math.min(geometry.previous.height, geometry.current.height) - 1,
  );
  expect(geometry.lines).toBe(1);
  expect(geometry.wrap).toBe("nowrap");
  expect(geometry.whitespace).toBe("nowrap");
  expect(geometry.overflow).toBeLessThanOrEqual(1);
}

async function submitPrice(dialog: Locator, name: RegExp) {
  const save = dialog.getByRole("button", { name });
  await expect(save).toBeEnabled();
  const acknowledgment = dialog.getByRole("checkbox", {
    name: /^(Use this price anyway|با این حال از این قیمت استفاده شود)$/,
  });
  if (await acknowledgment.isVisible()) await acknowledgment.click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).toBeHidden();
}

for (const language of ["en", "fa"] as const) {
  test(`C9 sale price stays on one line at 1440/900/390, and ending an equal-price sale preserves its task snapshot (${language})`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "This proof sets each required desktop/tablet/phone viewport explicitly.",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await prepareManager(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    const sale = before.sales!.find(
      (entry) => entry.id === "demo-c8-pot-sale",
    )!;
    const product = before.products.find(
      (entry) => entry.code === sale.product_code,
    )!;
    const regular =
      product.branch_prices?.[sale.branch] ?? product.selling_price;
    expect(new Decimal(sale.sale_price).lt(regular)).toBe(true);

    for (const width of [1440, 900, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const row = await productRow(page, product.code);
      const price = row.locator('.selling-price-value[data-sale-price="true"]');
      const line = price.locator(":scope > .selling-price-line");
      await expect(line.locator("del")).toHaveText(money(regular));
      await expect(line.locator("strong")).toHaveText(money(sale.sale_price));
      await expectUnbrokenPrice(line);
      let offer = row.locator(".product-offer-line");
      let disclosed = false;
      if (width === 900 && !(await offer.isVisible())) {
        const disclosure = row.getByRole("button", {
          name: translated(language, "Show details", "نمایش جزئیات"),
          exact: true,
        });
        await expect(disclosure).toHaveAttribute("aria-expanded", "false");
        const detailsId = await disclosure.getAttribute("aria-controls");
        expect(detailsId).toBeTruthy();
        await disclosure.click();
        const expandedDisclosure = row.getByRole("button", {
          name: translated(language, "Hide details", "پنهان کردن جزئیات"),
          exact: true,
        });
        await expect(expandedDisclosure).toHaveAttribute(
          "aria-controls",
          detailsId!,
        );
        await expect(expandedDisclosure).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        const detail = page
          .locator(`[id="${detailsId}"]`)
          .locator("dl > div")
          .filter({
            has: page.locator("dt").filter({
              hasText: new RegExp(
                `^${translated(language, "Offer", "پیشنهاد")}$`,
              ),
            }),
          });
        await expect(detail.locator("dt")).toHaveText(
          translated(language, "Offer", "پیشنهاد"),
        );
        offer = detail.locator(".product-offer-line");
        disclosed = true;
      }
      await expect(offer).toBeVisible();
      await expect(offer).toContainText(translated(language, "Sale", "حراج"));
      // Offer terms must not become approval status or part of the numeric price cell.
      const placement = await row.evaluate((element) => {
        const value = element.querySelector(".selling-price-value")!;
        const terms =
          element.querySelector(".product-offer-line") ??
          element.nextElementSibling?.querySelector(".product-offer-line");
        if (!terms) throw new Error("No visible row or disclosed Offer terms");
        const priceCell = value.closest("td")!;
        const offerCell = terms.closest("td")!;
        const priceRect = value.getBoundingClientRect();
        const offerRect = terms.getBoundingClientRect();
        return {
          separate: priceCell !== offerCell,
          priceCell: priceCell.getAttribute("data-column-key"),
          offerCell: offerCell.getAttribute("data-column-key"),
          phone: element.classList.contains("phone-list-row"),
          below: offerRect.top >= priceRect.bottom - 1,
        };
      });
      expect(placement.separate).toBe(true);
      if (width === 390) {
        expect(placement.phone).toBe(true);
        expect(placement.below).toBe(true);
      } else {
        expect(placement.priceCell).toBe("price");
        if (disclosed) {
          expect(width).toBe(900);
          await expect(offer.locator("xpath=ancestor::tr")).toHaveClass(
            "table-expanded-row",
          );
          await expectUnbrokenPrice(line);
        } else expect(placement.offerCell).toBe("offer");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
    }

    // The regular amount can change while the customer still pays the sale.
    const afterSale = new Decimal(regular).plus(1).toFixed(2);
    let dialog = await openC8PriceDialog(page, product.code);
    await dialog
      .getByRole("radio", { name: /^(New regular price|قیمت عادی جدید)/ })
      .click();
    await dialog.locator(".change-price-amount-field input").fill(afterSale);
    await expect(dialog.locator(".change-price-summary")).toContainText(
      /Applies after the sale|پس از حراج اعمال می‌شود/,
    );
    await submitPrice(dialog, /^(Save new price|ذخیرهٔ قیمت جدید)$/);
    let saved = await readCanonicalBusinessEvidence(page);
    expect(saved.sales!.find((entry) => entry.id === sale.id)?.status).toBe(
      "active",
    );
    expect(
      saved.products.find((entry) => entry.code === product.code)
        ?.branch_prices?.[sale.branch],
    ).toBe(afterSale);

    // Equal is not a discount: the default decision ends this store's sale.
    dialog = await openC8PriceDialog(page, product.code);
    await dialog
      .getByRole("radio", { name: /^(New regular price|قیمت عادی جدید)/ })
      .click();
    await dialog
      .locator(".change-price-amount-field input")
      .fill(sale.sale_price);
    await expect(
      dialog.getByRole("radio", {
        name: /^(End the sale now|حراج را اکنون پایان بده)$/,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await submitPrice(dialog, /^(Save new price|ذخیرهٔ قیمت جدید)$/);
    saved = await readCanonicalBusinessEvidence(page);
    expect(saved.sales!.find((entry) => entry.id === sale.id)?.status).toBe(
      "ended",
    );
    for (const width of [1440, 900, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const row = await productRow(page, product.code);
      await expect(row.locator(".selling-price-current")).toHaveText(
        money(sale.sale_price),
      );
      await expect(
        row.locator("del,.sale-pill,[data-sale-price=true]"),
      ).toHaveCount(0);
      await expect(row.locator(".product-offer-line")).toHaveCount(0);
    }

    // A retained task renders its old sale comparison, not today's equal regular amount.
    const task = saved.price_update_tasks!.find(
      (entry) =>
        entry.product_code === product.code &&
        entry.branch === sale.branch &&
        entry.status === "pending",
    )!;
    expect(task).toBeDefined();
    expect(task.old_price.sale_id).toBe(sale.id);
    expect(
      new Decimal(task.old_price.regular_price!).gt(task.old_price.price!),
    ).toBe(true);
    expect(task.old_price.regular_price).not.toBe(sale.sale_price);
    await visitC8(page, `price-update?id=${encodeURIComponent(task.id)}`);
    const oldPrice = page
      .locator(".price-update-change > del .selling-price-line")
      .first();
    await expect(oldPrice.locator(":scope > del")).toHaveText(
      money(task.old_price.regular_price!),
    );
    await expect(oldPrice.locator(":scope > strong")).toHaveText(
      money(task.old_price.price!),
    );
    await expectUnbrokenPrice(oldPrice);
  });

  test(`C9 lower regular price can change the running sale atomically (${language})`, async ({
    page,
  }) => {
    await prepareManager(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    const sale = before.sales!.find(
      (entry) => entry.id === "demo-c8-pot-sale",
    )!;
    const newRegular = new Decimal(sale.sale_price).minus("0.50").toFixed(2);
    const newSale = new Decimal(newRegular).minus("0.50").toFixed(2);
    const dialog = await openC8PriceDialog(page, sale.product_code);
    await dialog
      .getByRole("radio", { name: /^(New regular price|قیمت عادی جدید)/ })
      .click();
    await dialog.locator(".change-price-amount-field input").fill(newRegular);
    await expect(
      dialog.getByRole("radio", {
        name: /^(End the sale now|حراج را اکنون پایان بده)$/,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await dialog
      .getByRole("radio", { name: /^(Change the sale price|تغییر قیمت حراج)$/ })
      .click();
    await dialog
      .getByRole("textbox", { name: /^(New sale price|قیمت جدید حراج)$/ })
      .fill(newSale);
    await submitPrice(dialog, /^(Save new price|ذخیرهٔ قیمت جدید)$/);
    const saved = await readCanonicalBusinessEvidence(page);
    expect(saved.sales!.find((entry) => entry.id === sale.id)).toMatchObject({
      status: "active",
      sale_price: newSale,
    });
    expect(
      saved.products.find((entry) => entry.code === sale.product_code)
        ?.branch_prices?.[sale.branch],
    ).toBe(newRegular);
    const row = await productRow(page, sale.product_code);
    const line = row.locator(
      '.selling-price-value[data-sale-price="true"] > .selling-price-line',
    );
    await expect(line.locator("del")).toHaveText(money(newRegular));
    await expect(line.locator("strong")).toHaveText(money(newSale));
    await expectUnbrokenPrice(line);
    expect(saved.ledger).toEqual(before.ledger);
    expect(saved.returns).toEqual(before.returns);
  });
}

async function requestSale(page: Page, code: string) {
  const before = await readCanonicalBusinessEvidence(page);
  const product = before.products.find((entry) => entry.code === code)!;
  const regular = product.branch_prices?.["Branch 1"] ?? product.selling_price;
  const requested = new Decimal(regular).minus("0.10").toFixed(2);
  const dialog = await openC8PriceDialog(page, code);
  await dialog.locator(".change-price-amount-field input").fill(requested);
  await submitPrice(dialog, /^Send request$/);
  await expect
    .poll(async () =>
      (await readCanonicalBusinessEvidence(page)).sale_requests?.some(
        (entry) => entry.product_code === code && entry.status === "pending",
      ),
    )
    .toBe(true);
  return (await readCanonicalBusinessEvidence(page)).sale_requests!.find(
    (entry) => entry.product_code === code && entry.status === "pending",
  )!;
}

test("C9 approved, rejected, withdrawn and expired sale requests retain their terms, deciders, counts and read-only cards in English and Persian", async ({
  page,
}) => {
  test.setTimeout(180000);
  await signIn(page, "Floor Worker");
  const rejection = await requestSale(page, "0002");
  const withdrawal = await requestSale(page, "0009");
  const approval = await requestSale(page, "0004");
  await visitC8(page, `product?code=${withdrawal.product_code}`);
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: "Product actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Withdraw request", exact: true })
    .click();
  const withdrawDialog = page.getByRole("dialog", {
    name: "Withdraw request",
    exact: true,
  });
  await withdrawDialog
    .getByRole("button", { name: "Withdraw request", exact: true })
    .click();
  await expect(withdrawDialog).toBeHidden();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).sale_requests!.find(
          (entry) => entry.id === withdrawal.id,
        )?.status,
    )
    .toBe("withdrawn");

  await prepareManager(page, "en");
  await visitC8(page, "approvals");
  const approvedCard = page.locator(`[data-sale-request-id="${approval.id}"]`);
  await approvedCard
    .getByRole("button", { name: "Change and approve", exact: true })
    .click();
  const dialog = page.locator(".change-price-dialog[open]");
  const approvedPrice = new Decimal(approval.requested_price)
    .plus("0.01")
    .toFixed(2);
  await dialog.locator(".change-price-amount-field input").fill(approvedPrice);
  await submitPrice(dialog, /^Change and approve$/);
  const rejectedCard = page.locator(`[data-sale-request-id="${rejection.id}"]`);
  await rejectedCard
    .getByRole("button", { name: "Reject", exact: true })
    .click();
  const rejectDialog = page.getByRole("dialog", {
    name: "Reject sale request",
    exact: true,
  });
  const reason = "C9 owner review: keep the current shelf price";
  await rejectDialog.getByLabel("Reason", { exact: true }).fill(reason);
  await rejectDialog
    .getByRole("button", { name: "Reject", exact: true })
    .click();
  await expect(rejectDialog).toBeHidden();

  const decided = await readCanonicalBusinessEvidence(page);
  const approved = decided.sale_requests!.find(
    (entry) => entry.id === approval.id,
  )!;
  expect(approved.approved_terms?.sale_price).toBe(approvedPrice);
  expect(approved.requested_price).toBe(approval.requested_price);
  expect(approved.approved_terms?.sale_price).not.toBe(
    approved.requested_price,
  );
  const expiring = decided.sale_requests!.find(
    (entry) => entry.product_code === "0008" && entry.status === "pending",
  )!;
  expect(expiring.last_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // Move beyond the actual saved civil date, independent of when this test runs.
  await page.clock.setFixedTime(
    new Date(
      new Date(`${expiring.last_day}T12:00:00Z`).getTime() + 3 * 86400000,
    ),
  );
  await page.reload();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).sale_requests!.find(
          (entry) => entry.id === expiring.id,
        )?.status,
    )
    .toBe("expired");

  // The real clock jump also expires sensitive-screen password freshness.
  // Continue through the app's genuine confirmation rather than changing authority.
  const confirmation = page.getByRole("dialog", {
    name: "Confirm your password",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  const manager = demoSeed.demo_users.find(
    (person) => person.username === "manager",
  )!;
  expect(manager.password).toEqual(expect.any(String));
  await confirmation
    .getByLabel("Password", { exact: true })
    .fill(manager.password);
  await confirmation
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(confirmation).toBeHidden();
  const finalEvidence = await readCanonicalBusinessEvidence(page);
  // Historical invoice decisions retain their recorded branch; only pending
  // proposals follow source-invoice corrections in effectiveApprovalLocation.
  const invoiceCount = (status: "approved" | "rejected" | "superseded") =>
    finalEvidence.approvals.filter(
      (entry) =>
        entry.company_id === finalEvidence.config.company.seed_key &&
        entry.status === status &&
        ["all", "Branch 1"].includes(entry.branch),
    ).length;

  for (const language of ["en", "fa"] as const) {
    await setLanguage(page, language);
    await visitC8(page, "approvals");
    const cases = [
      {
        label: translated(language, "Approved", "تأییدشده"),
        count: 1 + invoiceCount("approved"),
        ids: [approval.id],
      },
      {
        label: translated(language, "Rejected", "ردشده"),
        count: 1 + invoiceCount("rejected"),
        ids: [rejection.id],
      },
      {
        label: translated(language, "Superseded", "جایگزین‌شده"),
        count: 2 + invoiceCount("superseded"),
        ids: [withdrawal.id, expiring.id],
      },
    ];
    for (const entry of cases) {
      const tab = page.getByRole("tab", {
        name: `${entry.label} ${entry.count}`,
        exact: true,
      });
      await expect(tab.locator(".tab-count")).toHaveText(String(entry.count));
      await tab.click();
      for (const id of entry.ids) {
        const card = page.locator(`[data-sale-request-id="${id}"]`);
        await expect(card).toBeVisible();
        await expect(card.getByRole("button")).toHaveCount(0);
      }
      await expect(page.locator("main")).not.toContainText(
        /Receive an invoice to create a proposal|برای ایجاد پیشنهاد، یک فاکتور دریافت کنید/,
      );
      if (entry.ids.includes(approval.id)) {
        await expect(approvedCard.locator(".selling-price-current")).toHaveText(
          money(approvedPrice),
        );
        await expect(approvedCard).toContainText(
          approved.approved_terms!.starts_on,
        );
        if (approved.approved_terms!.last_day)
          await expect(approvedCard).toContainText(
            approved.approved_terms!.last_day,
          );
        await expect(
          approvedCard.locator(".sale-request-decision"),
        ).toContainText(
          translated(
            language,
            configuredPersonExpectation("manager").name_en,
            configuredPersonExpectation("manager").name_fa,
          ),
        );
      } else if (entry.ids.includes(rejection.id)) {
        await expect(rejectedCard).toContainText(reason);
        await expect(
          rejectedCard.locator(".sale-request-decision"),
        ).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
        await expect(
          rejectedCard.locator(".sale-request-decision"),
        ).toContainText(
          translated(
            language,
            configuredPersonExpectation("manager").name_en,
            configuredPersonExpectation("manager").name_fa,
          ),
        );
      } else {
        await expect(
          page.locator(`[data-sale-request-id="${withdrawal.id}"] .badge`),
        ).toHaveText(translated(language, "Withdrawn", "پس‌گرفته‌شده"));
        await expect(
          page.locator(`[data-sale-request-id="${expiring.id}"] .badge`),
        ).toHaveText(translated(language, "Expired", "منقضی‌شده"));
      }
    }
  }
});
