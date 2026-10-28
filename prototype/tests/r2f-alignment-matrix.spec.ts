import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  chooseOption,
  openShellAction,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { auditR2fAlignment, type R2fScene } from "./r2f-alignment";
import { prepareR2fTimesheet } from "./r2f-timesheet-fixture";
import { addActualPackageSizes } from "./r2f-package-service-proof";
import { installLocationReturnScene } from "./r2f-location-return-fixture";

type Appearance = { language: "en" | "fa"; theme: "light" | "dark" };
const appearances: readonly Appearance[] = [
  { language: "en", theme: "light" },
  { language: "fa", theme: "dark" },
];
const scenes: readonly R2fScene[] = [
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "D8",
  "D9",
  "D10",
];

async function appearance(page: Page, { language, theme }: Appearance) {
  // Wait for the real responsive shell before its language action moves into More.
  if ((await page.evaluate(() => innerWidth)) <= 760)
    await expect(page.locator(".mobile-more-menu")).toBeVisible();
  await setLanguage(page, language);
  if ((await page.locator("html").getAttribute("data-theme")) !== theme)
    await (
      await openShellAction(
        page,
        language === "en"
          ? `Switch to ${theme} theme`
          : theme === "dark"
            ? "تغییر به تم تیره"
            : "تغییر به تم روشن",
      )
    ).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function manager(page: Page, variant: Appearance) {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await appearance(page, variant);
}

async function measure(
  page: Page,
  info: TestInfo,
  scene: R2fScene,
  phase: string,
  options: Omit<Parameters<typeof auditR2fAlignment>[1], "scene"> = {},
) {
  await page.evaluate(() => document.fonts.ready);
  const report = await auditR2fAlignment(page, { scene, ...options });
  await info.attach(`${scene}-${phase}-alignment`, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  const capture = info.outputPath(
    `${info.title.replace(/\s+/g, "-")}-${phase}.png`,
  );
  await page.screenshot({
    path: capture,
    fullPage: (await page.locator("dialog[open]").count()) === 0,
  });
  await info.attach(`${scene}-${phase}-actual-screen`, {
    path: capture,
    contentType: "image/png",
  });
  expect(report.failures, `${scene} ${phase}`).toEqual([]);
  expect(
    report.controls,
    `${scene} must audit actual visible controls`,
  ).toBeGreaterThan(0);
  expect(
    report.pairs,
    `${scene} must compare actual peer controls`,
  ).toBeGreaterThan(0);
  expect(
    await page
      .locator("html")
      .evaluate((node) => node.scrollWidth - innerWidth),
    `${scene} viewport overflow`,
  ).toBeLessThanOrEqual(1.5);
  return report;
}

async function prepareScene(
  page: Page,
  info: TestInfo,
  scene: R2fScene,
  variant: Appearance,
  width: number,
) {
  const { language } = variant;
  const t = (en: string, fa: string) => (language === "en" ? en : fa);
  if (scene === "D1" || scene === "D2") {
    await prepareR2fTimesheet(page, language, variant.theme);
    await expect(page.locator(".timesheet-row[data-row-id]")).toHaveCount(10);
    if (scene === "D1") {
      await expect(
        page.locator(".timesheet-department[data-department-key]"),
      ).toHaveCount(8);
      const report = await measure(page, info, scene, "daily-sheet");
      expect(report.columns).toBeGreaterThan(0);
      expect(report.cells).toBeGreaterThan(10);
      await page
        .locator('[data-row-id="r2f-shift-2"]')
        .getByRole("textbox")
        .nth(1)
        .focus();
      await expect(
        page.locator(".timesheet-now-popover[role=listbox]"),
      ).toBeVisible();
      await measure(page, info, scene, "suggested-now", {
        portals: ["timesheet-now"],
      });
    } else {
      await page
        .getByRole("button", {
          name: t("Manage staff", "مدیریت کارکنان"),
          exact: true,
        })
        .click();
      const dialog = page.locator("dialog.timesheet-manage-staff[open]");
      await expect(dialog.locator(".timesheet-managed-person")).toHaveCount(10);
      await measure(page, info, scene, "staff-list");
      await dialog
        .locator(".timesheet-staff-toolbar")
        .getByRole("button", {
          name: t("Add person", "افزودن فرد"),
          exact: true,
        })
        .click();
      await expect(dialog.locator(".timesheet-new-person")).toBeVisible();
      await expect(dialog.locator(".timesheet-managed-person")).toHaveCount(10);
      await measure(page, info, scene, "inline-person-form");
    }
    return;
  }

  if (scene === "D3" || scene === "D4") {
    await signIn(page, "Manager");
    expect(await addActualPackageSizes(page)).toHaveLength(4);
    await page.reload();
    await setBranch(page, "Branch 1");
    await appearance(page, variant);
    if (scene === "D3") {
      await page.goto("/#product?code=0016");
      await page
        .locator(".product-header-actions")
        .getByRole("button", { name: /^(Edit |ویرایش )/ })
        .click();
      const dialog = page.getByRole("dialog", {
        name: /^(Edit product|ویرایش محصول)$/,
      });
      await expect(dialog.locator(".weight-product-price-main")).toContainText(
        "$",
      );
      await expect(
        dialog.locator(".weight-package-row:not(.weight-package-table-head)"),
      ).toHaveCount(4);
      await dialog
        .getByRole("textbox", {
          name: t("New size", "اندازه جدید"),
          exact: true,
        })
        .fill("125");
      await expect(dialog.locator(".weight-package-add-preview")).toBeVisible();
      await expect(dialog.locator(".weight-package-add-preview")).toContainText(
        "$",
      );
      const report = await measure(
        page,
        info,
        scene,
        "canonical-weight-editor",
      );
      if (width === 1440) expect(report.columns).toBeGreaterThan(0);
    } else {
      await page.goto("/#lookup?search=0016");
      const detail = page.locator(".lookup-detail.is-weight-lookup");
      await expect(detail.locator(".lookup-package-box")).toHaveCount(4);
      await expect(
        page.locator(".lookup-pricing-filters .filter-chip"),
      ).toHaveCount(6);
      const report = await measure(page, info, scene, "weight-parent-packages");
      expect(report.icons).toBeGreaterThanOrEqual(4);
    }
    return;
  }

  if (scene === "D5" || scene === "D8") {
    await installLocationReturnScene(page);
    await appearance(page, variant);
    if (scene === "D5") {
      await setBranch(page, "all");
      await page.goto("/#lookup?search=0004");
      const table = page.locator(".lookup-locations-table");
      await expect(table.locator("tbody tr")).toHaveCount(4);
      await expect(table.locator('[data-location="Warehouse"]')).toContainText(
        t("Not sold here", "اینجا فروخته نمی‌شود"),
      );
      if (width === 390)
        await expect(table.locator(".lookup-location-phone-name")).toHaveCount(
          4,
        );
      const report = await measure(
        page,
        info,
        scene,
        "genuine-location-facts",
        { exceptionIds: [] },
      );
      if (width === 1440) {
        expect(report.columns).toBeGreaterThanOrEqual(4);
        expect(report.plainValues).toBeGreaterThan(0);
        await expect(table).toHaveClass(/\bis-medium\b/);
        const heights = await table.evaluate((node) => ({
          heading: node.querySelector("thead")!.getBoundingClientRect().height,
          rows: [...node.querySelectorAll("tbody tr")].map(
            (row) => row.getBoundingClientRect().height,
          ),
        }));
        expect(Math.abs(heights.heading - 32)).toBeLessThanOrEqual(1.5);
        for (const row of heights.rows)
          expect(Math.abs(row - 48)).toBeLessThanOrEqual(1.5);
      }
    } else {
      await setBranch(page, "Branch 1");
      await page.goto("/#returns");
      const table = page.locator(".returns-overview-table");
      await expect(table.locator("tbody tr")).toHaveCount(3);
      await expect(table).toContainText("$11.00");
      if (width === 390)
        await expect(table.locator(".return-phone-header")).toHaveCount(3);
      const report = await measure(page, info, scene, "retained-returns", {
        exceptionIds: [],
      });
      if (width === 1440) expect(report.columns).toBeGreaterThanOrEqual(5);
    }
    return;
  }

  if (scene === "D10") {
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await appearance(page, variant);
    await page.goto("/#requests");
    await page
      .getByRole("button", {
        name: t("New request", "درخواست جدید"),
        exact: true,
      })
      .click();
    await chooseOption(
      page,
      page.locator("#request-destination"),
      "Branch 2",
      t("Richmond Hill", "ریچموند هیل"),
    );
    const search = page.locator("#request-products");
    await search.fill("0001");
    const popup = page.locator(".request-search-results[data-r2f-scene=D10]");
    await popup
      .getByRole("button", { name: t("Add", "افزودن"), exact: true })
      .click();
    const catalog = page.locator(".request-draft-line").first();
    await catalog.getByLabel(t("Quantity", "تعداد"), { exact: true }).fill("2");
    await chooseOption(
      page,
      catalog.getByLabel(t("Units / Cases", "واحد / کارتن"), { exact: true }),
      "cases",
      t("Cases", "کارتن"),
    );
    await catalog.locator(".request-line-pack-action").click();
    await catalog
      .getByLabel(t("Units per case", "تعداد در کارتن"), { exact: true })
      .fill("12");
    await catalog.locator(".request-line-pack-action").click();
    await search.fill("Fictional bakery tray");
    await popup.locator(".request-search-new").click();
    const free = page.locator(".request-draft-line").nth(1);
    await free.getByLabel(t("Quantity", "تعداد"), { exact: true }).fill("10");
    await free
      .getByRole("button", {
        name: t("Add note", "افزودن یادداشت"),
        exact: true,
      })
      .click();
    await free
      .getByLabel(t("Note (optional)", "یادداشت (اختیاری)"), { exact: true })
      .fill(t("From the prepared shelf", "از قفسه آماده‌سازی"));
    await free
      .getByRole("button", { name: t("Done", "انجام شد"), exact: true })
      .click();
    await expect(page.locator(".request-draft-line")).toHaveCount(2);
    await measure(page, info, scene, "actual-draft");
    await search.fill("");
    await search.pressSequentially(t("Rice", "برنج"));
    await expect(
      popup.locator(".request-search-option[data-product-code='0001'] button"),
    ).toBeDisabled();
    await expect(popup.locator(".request-search-new")).toBeVisible();
    const report = await measure(
      page,
      info,
      scene,
      "catalog-and-new-item-popup",
      { portals: ["request-results"] },
    );
    expect(report.icons).toBeGreaterThan(0);
    return;
  }

  await manager(page, variant);
  if (scene === "D6") {
    await page.goto("/#approvals");
    await expect(page.locator(".approval-detail-row")).toHaveCount(3);
    await expect(
      page.locator(".sale-request-card .approval-numbers"),
    ).toBeVisible();
    for (const card of await page.locator(".approval-detail-row").all()) {
      const actions = card.locator(".approval-card-footer .actions > button");
      await expect(actions).toHaveCount(3);
      for (const action of await actions.all())
        await expect(action).toBeVisible();
    }
    const report = await measure(
      page,
      info,
      scene,
      "ordinary-and-sale-approvals",
      { exceptionIds: [] },
    );
    expect(report.numberGroups).toBe(3);
  } else if (scene === "D7") {
    await page.goto("/#dashboard");
    await expect(
      page.locator(".r2c-dashboard .dashboard-this-week"),
    ).toBeVisible();
    expect(
      await page.locator(".dashboard-activity-item").count(),
    ).toBeGreaterThanOrEqual(2);
    const report = await measure(
      page,
      info,
      scene,
      "dashboard-cards-and-tables",
    );
    expect(report.cardHeaders).toBeGreaterThan(0);
    if (width === 1440) {
      expect(report.columns).toBeGreaterThan(0);
      expect(report.cardPairs).toBeGreaterThan(0);
      for (const [key, pixels] of [
        ["type", 120],
        ["price", 128],
        ["margin", 80],
        ["actions", 168],
      ] as const) {
        const heading = page.locator(
          `.dashboard-approval-table th[data-column-key='${key}']`,
        );
        await expect(heading, `actual ${key} column is visible`).toBeVisible();
        expect(
          Math.abs((await heading.boundingBox())!.width - pixels),
          `${key} approved column width`,
        ).toBeLessThanOrEqual(1.5);
      }
      await expect(
        page.locator(".dashboard-approval-table th[data-column-key='actions']"),
      ).toHaveText("");
    }
  } else if (scene === "D9") {
    await page.goto("/#invoices");
    await page
      .locator(".invoice-saved-table tbody tr")
      .first()
      .locator("td")
      .first()
      .getByRole("link")
      .click();
    await page
      .getByRole("button", {
        name: t("Read invoice", "خواندن فاکتور"),
        exact: true,
      })
      .click();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    const toolbarName = t("Original invoice", "فاکتور اصلی");
    const requireOriginalToolbar = async () => {
      const toolbar = page.getByRole("toolbar", {
        name: toolbarName,
        exact: true,
      });
      await expect(toolbar).toBeVisible();
      await expect(
        toolbar.locator(":scope > .invoice-original-control-group"),
      ).toHaveCount(4);
      await expect(toolbar.getByRole("button")).toHaveCount(7);
    };
    if (width === 1440) await requireOriginalToolbar();
    const report = await measure(page, info, scene, "review-and-original");
    if (width === 1440) expect(report.columns).toBeGreaterThanOrEqual(5);
    else {
      await page.locator(".original-viewer-phone-trigger").click();
      await expect(
        page.getByRole("dialog", {
          name: t("Original invoice", "فاکتور اصلی"),
          exact: true,
        }),
      ).toBeVisible();
      await requireOriginalToolbar();
      await measure(page, info, scene, "phone-original-dialog");
    }
  }
}

// Ordinary discovered tests: every scene is exercised with actual app records in
// both directions/themes at both required widths. No test-only screen markup.
for (const scene of scenes)
  for (const width of [1440, 390])
    for (const variant of appearances)
      test(`R0 matrix ${scene} ${width} ${variant.language} ${variant.theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await prepareScene(page, info, scene, variant, width);
        expect(errors).toEqual([]);
      });
