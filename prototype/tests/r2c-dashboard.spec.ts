import { expect, test } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { setBranch, setLanguage, signIn } from "./helpers";

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const)
    for (const theme of ["light", "dark"] as const) {
      test(`R2c dashboard ${width} ${language} ${theme}`, async ({
        page,
      }, info) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 1000 });
        await signIn(page, "Manager");
        await setBranch(page, "North York");
        await setLanguage(page, language);
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
          localStorage.setItem("arzon-theme", value);
        }, theme);
        await page.goto("/#dashboard");
        const dashboard = page.locator(".r2c-dashboard");
        await expect(dashboard).toBeVisible();
        await expect(
          dashboard.locator(".dashboard-kpis > .kpi-card"),
        ).toHaveCount(6);
        await page.evaluate(() => document.fonts.ready);
        const proof = await dashboard.evaluate((root) => {
          const rect = (el: Element) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              bottom: r.bottom,
              right: r.right,
            };
          };
          const kpis = [
            ...root.querySelectorAll(".dashboard-kpis > .kpi-card"),
          ].map((el) => ({
            ...rect(el),
            background: getComputedStyle(el).backgroundColor,
          }));
          const cards = [
            ...root.querySelectorAll(
              ".dashboard-layout > div > .card,.dashboard-layout > aside > .card",
            ),
          ].map((el) => ({
            className: el.className,
            ...rect(el),
            alignSelf: getComputedStyle(el).alignSelf,
          }));
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            kpis,
            cards,
            headings: [
              ...root.querySelectorAll(".dashboard-card-header h2"),
            ].map((el) => ({
              size: getComputedStyle(el).fontSize,
              weight: getComputedStyle(el).fontWeight,
            })),
            actions: [...root.querySelectorAll(".button,.menu-trigger")]
              .filter((el) => el.getBoundingClientRect().height > 0)
              .map((el) => ({
                text: el.textContent,
                height: el.getBoundingClientRect().height,
              })),
            links: [...root.querySelectorAll("a.entity-link")].map(
              (el) => getComputedStyle(el).color,
            ),
          };
        });
        expect(proof.overflow).toBeLessThanOrEqual(1);
        expect(
          proof.kpis.every(
            (kpi) => kpi.background === proof.kpis[0].background,
          ),
        ).toBe(true);
        expect(
          proof.headings.every(
            (heading) => heading.size === "17px" && heading.weight === "800",
          ),
        ).toBe(true);
        expect(proof.actions.filter((action) => action.height < 43.5)).toEqual(
          [],
        );
        if (width === 1440) {
          await expect(
            dashboard
              .locator(".dashboard-approval-table")
              .getByRole("columnheader", {
                name: language === "en" ? "Type" : "نوع",
                exact: true,
              }),
          ).toBeVisible();
          await expect(
            dashboard.locator(
              ".dashboard-approval-table .table-details-toggle",
            ),
          ).toHaveCount(0);
          const labels = await dashboard
            .locator(".purchase-week-column time")
            .allTextContents();
          expect(labels.every((label) => /[0-9]/.test(label))).toBe(true);
          expect(new Set(labels).size).toBe(8);
          const types = await dashboard
            .locator(".dashboard-approval-table tbody .ui-badge")
            .evaluateAll((badges) =>
              badges.map((badge) => ({
                background: getComputedStyle(badge).backgroundColor,
                radius: getComputedStyle(badge).borderRadius,
                dot: getComputedStyle(badge.querySelector(".ui-status-dot")!)
                  .display,
              })),
            );
          expect(types.length).toBeGreaterThan(0);
          expect(
            types.every(
              (type) =>
                type.background !== "rgba(0, 0, 0, 0)" &&
                type.radius === "999px" &&
                type.dot === "none",
            ),
          ).toBe(true);
        }
        if (width >= 760) {
          expect(new Set(proof.kpis.map((kpi) => Math.round(kpi.y))).size).toBe(
            1,
          );
          expect(proof.cards.every((card) => card.alignSelf === "start")).toBe(
            true,
          );
        } else {
          expect(new Set(proof.kpis.map((kpi) => Math.round(kpi.y))).size).toBe(
            3,
          );
          const order = [
            "dashboard-approvals",
            "price-update-dashboard-card",
            "dashboard-alerts",
            "dashboard-invoices",
            "dashboard-balances",
          ].map((name) =>
            proof.cards.find((card) =>
              card.className.split(" ").includes(name),
            )!,
          );
          for (let index = 1; index < order.length; index++)
            expect(order[index].y).toBeGreaterThanOrEqual(
              order[index - 1].bottom + 15,
            );
        }
        const newRow = dashboard
          .locator(".dashboard-queue-row")
          .filter({ hasText: language === "en" ? "New product" : "محصول جدید" })
          .first();
        await expect(newRow).toContainText(
          language === "en" ? "first price" : "قیمت نخست",
        );
        await expect(newRow).not.toContainText(/Old\s*—/);
        const sale = dashboard
          .locator(".dashboard-queue-row")
          .filter({
            hasText: language === "en" ? "Sale request" : "درخواست تخفیف",
          })
          .first();
        await expect(
          sale.getByRole("button", {
            name: language === "en" ? "Review" : "بررسی",
            exact: true,
          }),
        ).toBeVisible();
        await info.attach("dashboard geometry", {
          body: JSON.stringify(proof, null, 2),
          contentType: "application/json",
        });
        await page.screenshot({
          path: info.outputPath(`dashboard-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        expect(errors).toEqual([]);
      });
    }

test("R2c dashboard shared-control proof has effective negative controls", async ({
  page,
}, info) => {
  const { inspect } = await import("../scripts/c5-browser-proof.mjs");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "Manager");
  await setBranch(page, "North York");
  const reports = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#dashboard");
    await expect(page.locator(".dashboard-approval-table")).toBeVisible();
    const clean = await inspect(
      page,
      `r2c-dashboard-${width}`,
      "en-light",
      "manager",
    );
    expect(clean.failures).toEqual([]);
    reports.push(clean);
  }
  const button = page
    .locator(".dashboard-inline-actions .button-primary")
    .first();
  const original = await button.getAttribute("style");
  await button.evaluate((element) => {
    element.style.setProperty("height", "32px", "important");
    element.style.setProperty("min-height", "32px", "important");
    element.style.setProperty("max-height", "32px", "important");
  });
  const negative = await inspect(
    page,
    "r2c-dashboard-short-action",
    "en-light",
    "manager",
  );
  expect(
    negative.failures.some((failure: string) =>
      failure.includes("Text action height"),
    ),
  ).toBe(true);
  await button.evaluate((element, value) => {
    if (value === null) element.removeAttribute("style");
    else element.setAttribute("style", value);
  }, original);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const tile = page.locator(".dashboard-kpis > .kpi-card").first();
  await tile.evaluate((element) => element.classList.remove("ui-summary-tile"));
  const invalid = await inspect(
    page,
    "r2c-dashboard-invalid-composition",
    "en-light",
    "manager",
  );
  expect(
    invalid.failures.some((failure: string) =>
      failure.includes("Text action height"),
    ),
  ).toBe(true);
  await tile.evaluate((element) => element.classList.add("ui-summary-tile"));
  const root = page.locator(".r2c-dashboard");
  await root.evaluate((element) => {
    element.dataset.timesheetsAccess = "denied";
  });
  const deniedSix = await inspect(
    page,
    "r2d-denied-sixth-tile",
    "en-light",
    "manager",
  );
  expect(
    deniedSix.failures.some((failure: string) =>
      failure.includes("Text action height"),
    ),
  ).toBe(true);
  await root.evaluate((element) => {
    element.dataset.timesheetsAccess = "allowed";
  });
  const onShiftLabel = page.locator(".timesheet-on-shift-tile > .kpi-label");
  await onShiftLabel.evaluate((element) => {
    element.textContent = "Unexpected sixth tile";
  });
  const misnamedSix = await inspect(
    page,
    "r2d-misnamed-sixth-tile",
    "en-light",
    "manager",
  );
  expect(
    misnamedSix.failures.some((failure: string) =>
      failure.includes("Text action height"),
    ),
  ).toBe(true);
  await onShiftLabel.evaluate((element) => {
    element.textContent = "On shift now";
  });
  const restored = await inspect(
    page,
    "r2c-dashboard-restored",
    "en-light",
    "manager",
  );
  expect(restored.failures).toEqual([]);
  await info.attach("strict dashboard control proof", {
    body: JSON.stringify({ reports, negative, invalid, restored }, null, 2),
    contentType: "application/json",
  });
});

test("R2c All locations shows six approvals with a truthful full queue count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "Manager");
  await runCanonicalBusinessFixture(
    page,
    (saved) => {
      const template = saved.approvals.find(
        (row) => row.status === "pending" && row.type !== "new_supplier",
      );
      if (!template)
        throw new Error("The fictional approval template is missing");
      saved.approvals = Array.from({ length: 8 }, (_, index) => ({
        ...structuredClone(template),
        id: `r2c-queue-fixture-${index}`,
        branch: "Branch 1",
        product_code: saved.products[index].code,
        type: "price_change" as const,
        proposed_price: "2.99",
        status: "pending" as const,
      }));
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "all");
  await expect(
    page
      .locator(".topbar")
      .getByRole("combobox", { name: "Location", exact: true }),
  ).toContainText("All locations");
  const approvals = page.locator(".dashboard-approvals");
  await expect(approvals.locator(".dashboard-queue-row")).toHaveCount(6);
  const total = Number(
    await page
      .locator(".dashboard-summary-tile")
      .first()
      .locator(".kpi-value")
      .innerText(),
  );
  expect(total).toBeGreaterThan(6);
  await expect(approvals.locator(".dashboard-count")).toHaveText(String(total));
  await expect(approvals.locator(".dashboard-table-caption")).toContainText(
    `Showing 6 of ${total}`,
  );
  await approvals
    .getByRole("button", { name: "View all", exact: true })
    .click();
  await expect(page).toHaveURL(/#approvals$/);
  await expect(
    page.getByRole("heading", { name: "Approvals", level: 1, exact: true }),
  ).toBeVisible();
});
