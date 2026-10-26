import { expect, test } from "@playwright/test";
import { inspectTableAlignment } from "./alignment-a2-proof";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage, signIn, uploadInvoice } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`table columns align and phone cards retain labelled contained values (${language})`, async ({
    page,
  }, testInfo) => {
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    const report: {
      route: string;
      tables: number;
      cells: number;
      maxError: number;
      cards: number;
    }[] = [];
    for (const route of [
      "products",
      "alerts",
      "product?code=0009",
      "returns",
      "return?id=demo-return-1",
      "suppliers",
      "suppliers?name=Fresh%20Valley%20Foods",
      "suppliers?name=Fresh%20Valley%20Foods|Invoices|فاکتورها",
      "suppliers?name=Fresh%20Valley%20Foods|Supplier items|کالاهای تأمین‌کننده",
      "suppliers?name=Fresh%20Valley%20Foods|Returns and credits|مرجوعی‌ها و اعتبارها",
      "suppliers?name=Fresh%20Valley%20Foods|Payments|پرداخت‌ها",
      "expiry",
      "offers",
      "payables",
      "settings",
      "dashboard",
      "labels",
      "invoices",
    ]) {
      const [path, englishTab, persianTab] = route.split("|");
      await page.goto(`/#${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      if (path === "invoices") {
        await setLanguage(page, "en");
        await uploadInvoice(page);
        await setLanguage(page, language);
        await expect(page.locator(".invoice-line")).toHaveCount(6);
      }
      if (englishTab) {
        await page
          .getByRole("tab", {
            name: language === "en" ? englishTab : persianTab,
            exact: true,
          })
          .click();
        await expect(
          page.locator(".supplier-tab-card .ui-data-table tbody tr").first(),
        ).toBeVisible();
      }
      const metrics = await inspectTableAlignment(page);
      expect(metrics.failures, `${route} (${language})`).toEqual([]);
      expect(metrics.maxError).toBeLessThanOrEqual(2);
      if (path === "invoices") {
        if ((page.viewportSize()?.width ?? 1280) <= 760) {
          const rows = page.locator(".receiving-table .invoice-line-summary");
          await expect(rows).toHaveCount(6);
          for (const row of await rows.all()) {
            await expect(row.locator(":scope > td:visible")).toHaveCount(3);
            for (const cell of ["status", "product", "total"])
              await expect(
                row.locator(`.receiving-${cell}-cell`),
              ).toBeVisible();
            await expect(row.locator(".receiving-status-icon")).toBeVisible();
            await expect(row.locator(".receiving-phone-chevron")).toBeVisible();
          }
          expect(metrics.cards).toBe(6);
          expect(metrics.cells).toBe(18);
        } else expect(metrics.cells).toBeGreaterThanOrEqual(30);
      }
      report.push({
        route,
        tables: metrics.tables,
        cells: metrics.cells,
        maxError: metrics.maxError,
        cards: metrics.cards,
      });
    }
    expect(report.reduce((sum, item) => sum + item.cells, 0)).toBeGreaterThan(
      100,
    );
    if (page.viewportSize()!.width < 760)
      expect(report.reduce((sum, item) => sum + item.cards, 0)).toBeGreaterThan(
        0,
      );
    await testInfo.attach(`alignment-${language}.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
  });
}

for (const language of ["en", "fa"] as const)
  test(`qualified Dashboard decisions retain genuine destinations and reject copied contracts (${language})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    const rows = page.locator(".dashboard-approval-table .dashboard-queue-row");
    await expect(rows.first()).toBeVisible();
    const clean = await inspectTableAlignment(page);
    expect(clean.failures).toEqual([]);
    expect(clean.decisionCards).toBeGreaterThan(0);
    expect(clean.maxError).toBeLessThanOrEqual(2);

    const first = rows.first();
    const product = first.locator(".phone-list-name a.entity-link");
    const productHref = await product.getAttribute("href");
    const approvalId = await first.getAttribute("data-approval-id");
    expect(productHref).toMatch(/^#product\?code=.+/);
    expect(approvalId).toBeTruthy();
    await product.click();
    await expect(page).toHaveURL((url) => url.hash === productHref);
    await page.goto("/#dashboard");
    await first
      .getByRole("button", {
        name: language === "en" ? "More" : "بیشتر",
        exact: true,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: language === "en" ? "View approval" : "مشاهده تأیید",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      (url) => url.hash === `#approvals?id=${encodeURIComponent(approvalId!)}`,
    );
    await page.goto("/#dashboard");
    const approve = rows
      .getByRole("button", {
        name: language === "en" ? "Approve" : "تأیید",
        exact: true,
      })
      .first();
    const before = await readCanonicalBusinessEvidence(page);
    await approve.click();
    const review = page.getByRole("dialog", {
      name: language === "en" ? "Review approval" : "بررسی تأیید",
      exact: true,
    });
    await expect(review).toBeVisible();
    await review
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    const after = await readCanonicalBusinessEvidence(page);
    for (const key of [
      "products",
      "approvals",
      "sale_requests",
      "ledger",
      "stock_movements",
    ] as const)
      expect(after[key]).toEqual(before[key]);

    const failures: { scene: string; failures: string[] }[] = [];
    const rejects = async (
      scene: string,
      mutate: () => Promise<unknown>,
      restore: () => Promise<unknown>,
    ) => {
      await mutate();
      try {
        const broken = await inspectTableAlignment(page);
        expect(
          broken.failures.some((failure) =>
            failure.includes("invalid Dashboard approval decision card"),
          ),
          scene,
        ).toBe(true);
        failures.push({ scene, failures: broken.failures });
      } finally {
        await restore();
      }
    };
    const decision = first.locator(
      ".dashboard-inline-actions > button:not(.ui-menu-trigger)",
    );
    const originalAction = await decision.innerHTML();
    await rejects(
      "wrong decision caption",
      () =>
        decision.evaluate((element) => {
          element.textContent = "Unrelated action";
        }),
      () =>
        decision.evaluate((element, html) => {
          element.innerHTML = html;
        }, originalAction),
    );
    await rejects(
      "wrong product destination",
      () =>
        product.evaluate((element) =>
          element.setAttribute("href", "#product?code=unrelated"),
        ),
      () =>
        product.evaluate(
          (element, href) => element.setAttribute("href", href!),
          productHref,
        ),
    );
    const originalStyle = await decision.getAttribute("style");
    await rejects(
      "short decision action",
      () =>
        decision.evaluate((element) => {
          for (const property of [
            "block-size",
            "min-block-size",
            "max-block-size",
          ])
            element.style.setProperty(property, "32px", "important");
        }),
      () =>
        decision.evaluate((element, style) => {
          if (style === null) element.removeAttribute("style");
          else element.setAttribute("style", style);
        }, originalStyle),
    );
    await rejects(
      "extra record control",
      () =>
        first.evaluate((row) => {
          const link = document.createElement("a");
          link.className = "table-row-link";
          link.href = "#approvals";
          link.textContent = ">";
          link.dataset.alignmentNegative = "record";
          row.querySelector(".phone-list-chevron")!.append(link);
        }),
      () =>
        page
          .locator('[data-alignment-negative="record"]')
          .evaluate((element) => element.remove()),
    );
    await rejects(
      "copied Dashboard classes",
      () =>
        first.evaluate((row) => {
          const fake = document.createElement("section");
          fake.className = "r2c-dashboard";
          fake.dataset.alignmentNegative = "copy";
          fake.innerHTML =
            '<div class="ui-data-table is-responsive is-mobile is-phone-list dashboard-approval-table"><table><tbody></tbody></table></div>';
          fake.querySelector("tbody")!.append(row.cloneNode(true));
          document.querySelector("main")!.append(fake);
        }),
      () =>
        page
          .locator('[data-alignment-negative="copy"]')
          .evaluate((element) => element.remove()),
    );
    const restored = await inspectTableAlignment(page);
    expect(restored.failures).toEqual([]);
    expect(restored.decisionCards).toBe(clean.decisionCards);
    expect(restored.maxError).toBeLessThanOrEqual(2);
    await info.attach(`dashboard-decision-contract-${language}.json`, {
      body: JSON.stringify({ clean, failures, restored }, null, 2),
      contentType: "application/json",
    });
  });

test("product editor is centered with focus trapped, Escape and backdrop restore focus", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#product?code=0009");
  const trigger = page.getByRole("button", {
    name: "Edit Potato Chips 150 g",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const metrics = await dialog.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return {
      x: Math.abs(r.x + r.width / 2 - innerWidth / 2),
      y: Math.abs(r.y + r.height / 2 - innerHeight / 2),
      focused: node.contains(document.activeElement),
    };
  });
  expect(metrics.x).toBeLessThanOrEqual(2);
  expect(metrics.y).toBeLessThanOrEqual(2);
  expect(metrics.focused).toBe(true);
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
