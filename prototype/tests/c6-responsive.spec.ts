import { expect, test, type Locator } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { signIn, setLanguage } from "./helpers";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";

async function expectDelayedNavigationTooltip(
  navigationItem: Locator,
  label: string,
  intent: "focus" | "mouseenter",
) {
  await navigationItem.evaluate((element, eventName) => {
    performance.clearMarks("c6-tooltip-intent");
    performance.clearMeasures("c6-tooltip-delay");
    element.addEventListener(
      eventName,
      () => {
        performance.mark("c6-tooltip-intent");
        const observer = new MutationObserver(() => {
          const tooltip = document.querySelector(".collapsed-nav-tooltip");
          if (
            tooltip &&
            getComputedStyle(tooltip).visibility === "visible" &&
            tooltip.getBoundingClientRect().width > 0
          ) {
            performance.measure("c6-tooltip-delay", "c6-tooltip-intent");
            observer.disconnect();
          }
        });
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      },
      { once: true },
    );
  }, intent);
  if (intent === "focus") await navigationItem.focus();
  else await navigationItem.hover();
  const tooltip = navigationItem
    .page()
    .getByRole("tooltip", { name: label, exact: true });
  await expect(tooltip).toBeVisible();
  const delay = await navigationItem.evaluate(
    () =>
      performance.getEntriesByName("c6-tooltip-delay", "measure")[0]?.duration,
  );
  // Allow one frame of measurement tolerance around the 300ms intent delay.
  expect(delay).toBeGreaterThanOrEqual(290);
  await expect(navigationItem).toHaveAttribute(
    "aria-describedby",
    (await tooltip.getAttribute("id"))!,
  );
  await expect(tooltip).toHaveCSS("pointer-events", "auto");
  expect(
    await tooltip.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      return {
        portal: element.parentElement === document.body,
        topLayer: element.matches(":popover-open"),
        hit: Boolean(hit && element.contains(hit)),
      };
    }),
  ).toEqual({ portal: true, topLayer: true, hit: true });
}

for (const language of ["en", "fa"] as const)
  for (const width of [390, 768, 900, 1024, 1180, 1280, 1440, 1920]) {
    test(`C7 adaptive tables and shell: ${language} ${width}px`, async ({
      page,
    }, info) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Supervisor");
      await setLanguage(page, language);
      for (const control of await page
        .locator(".topbar > button,.topbar > .ui-select")
        .all()) {
        if (!(await control.isVisible())) continue;
        await expect(control).toHaveCSS("height", "36px");
        await expect(control).toHaveCSS("border-top-width", "0px");
      }
      const reports = [];
      for (const scene of [
        "dashboard",
        "returns",
        "expiry",
        "payables",
        "invoices",
        "products",
        "received",
        "suppliers",
      ]) {
        await page.goto(`/#${scene}`);
        await expect(page.locator("main h1")).toBeVisible();
        const proof = await inspectResponsiveLayout(
          page,
          scene,
          language,
          width,
        );
        reports.push(proof);
        expect(proof.actualWidth).toBe(width);
        expect(proof.failures, `${scene} ${language} ${width}`).toEqual([]);
        if (scene === "dashboard") {
          const actual = await page.evaluate(() => {
            const rect = (element: Element) => {
              const value = element.getBoundingClientRect();
              return {
                x: value.x,
                y: value.y,
                width: value.width,
                height: value.height,
                right: value.right,
                bottom: value.bottom,
              };
            };
            return {
              topbar: rect(document.querySelector(".topbar")!),
              accounts: document.querySelectorAll(
                ".user-menu,.mobile-account-menu",
              ).length,
              kpis: [
                ...document.querySelectorAll(".dashboard-kpis>.kpi-card"),
              ].map(rect),
              rows: [...document.querySelectorAll(".dashboard-row")].map(
                (element) => ({
                  halves: element.classList.contains("dashboard-row-halves"),
                  cards: [...element.querySelectorAll(":scope>.card")].map(
                    rect,
                  ),
                }),
              ),
              aside: rect(document.querySelector(".dashboard-aside")!),
              main: rect(document.querySelector(".dashboard-main")!),
              contentCards: [
                ...document.querySelectorAll(".dashboard-layout .card"),
              ]
                .filter((element) => element.getBoundingClientRect().height > 0)
                .map((element) => ({
                  alignSelf: getComputedStyle(element).alignSelf,
                  ...rect(element),
                })),
            };
          });
          await writeFile(
            info.outputPath("dashboard-geometry.json"),
            JSON.stringify(actual, null, 2) + "\n",
          );
          expect(actual.topbar.height).toBe(60);
          expect(actual.accounts).toBe(1);
          expect(actual.kpis).toHaveLength(5);
          expect(
            new Set(actual.kpis.map((card) => Math.round(card.y))).size,
          ).toBe(width < 760 ? 3 : 1);
          for (const row of actual.rows) {
            expect(row.cards).toHaveLength(2);
            const [first, second] = row.cards;
            if (width <= 1100) {
              expect(first.width).toBeCloseTo(second.width, 0);
              expect(second.y).toBeGreaterThanOrEqual(first.bottom + 15);
            } else {
              expect(first.y).toBeCloseTo(second.y, 0);
              // R2c approved cards size to content, rather than stretching.
              expect(first.height).toBeGreaterThan(0);
              expect(second.height).toBeGreaterThan(0);
              const gap =
                Math.max(first.x, second.x) -
                Math.min(first.right, second.right);
              expect(gap).toBeCloseTo(20, 0);
              // Grid track spans include their internal gutters: adding the
              // shared gutter proves the actual 8+4 or 6+6 allocation.
              expect((first.width + gap) / (second.width + gap)).toBeCloseTo(
                row.halves ? 1 : 2,
                2,
              );
            }
          }
          if (width >= 1440)
            expect(actual.main.width / actual.aside.width).toBeCloseTo(2, 1);
          expect(
            actual.contentCards.every((card) => card.alignSelf === "start"),
          ).toBe(true);
        }
      }
      await page.goto("/#product?code=0006");
      const editProduct = page
        .locator(".product-page")
        .getByRole("button", { name: /^(Edit |ویرایش )/ })
        .first();
      if (info.project.name === "phone") await editProduct.tap();
      else await editProduct.click();
      const productDialog = page.locator(".product-editor-dialog[open]");
      await expect(productDialog).toBeVisible();
      for (const position of ["top", "dates"] as const) {
        if (position === "dates")
          await productDialog
            .locator(".product-date-editor")
            .scrollIntoViewIfNeeded();
        const proof = await inspectResponsiveLayout(
          page,
          `edit-product:${position}`,
          language,
          width,
        );
        reports.push(proof);
        expect(proof.forms.length).toBeGreaterThan(0);
        expect(proof.failures).toEqual([]);
        const frame = await productDialog.evaluate((dialog) => {
          const header = dialog
            .querySelector(".ui-dialog-header")!
            .getBoundingClientRect();
          const footer = dialog
            .querySelector(".product-editor-actions")!
            .getBoundingClientRect();
          return {
            headerTop: header.top,
            headerBottom: header.bottom,
            footerTop: footer.top,
            footerBottom: footer.bottom,
            viewportHeight: document.documentElement.clientHeight,
          };
        });
        expect(frame.headerTop).toBeGreaterThanOrEqual(0);
        expect(frame.footerBottom).toBeLessThanOrEqual(frame.viewportHeight);
        expect(frame.headerBottom).toBeLessThan(frame.footerTop);
      }
      await productDialog.locator(".ui-dialog-header .ui-icon-button").click();
      await expect(productDialog).not.toBeVisible();
      if (width >= 760 && width < 1280) {
        await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
        const navigationItem = page.locator('.sidebar nav a[href="#products"]');
        const navigationLabel = navigationItem.locator(".nav-item-label");
        const tooltip = page.getByRole("tooltip", {
          name: language === "en" ? "Products" : "محصولات",
          exact: true,
        });
        await page.locator("#menu-toggle").click();
        await expect(page.locator("#menu-toggle")).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await expect(page.locator(".sidebar")).toHaveCSS("width", "248px");
        await expect(navigationLabel).toBeVisible();
        await navigationItem.hover();
        await navigationItem.focus();
        expect(
          await page.evaluate(
            () =>
              new Promise<boolean>((resolve) => {
                const started = performance.now();
                let appeared = false;
                const observe = () => {
                  appeared ||= Boolean(
                    document.querySelector(".collapsed-nav-tooltip"),
                  );
                  if (performance.now() - started >= 350) resolve(appeared);
                  else requestAnimationFrame(observe);
                };
                observe();
              }),
          ),
        ).toBe(false);
        await page.keyboard.press("Escape");
        await expect(page.locator("#menu-toggle")).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        await page.mouse.move(width / 2, 540);
        await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
        await expect(navigationLabel).not.toBeVisible();
        await expect(tooltip).toHaveCount(0);
        await expectDelayedNavigationTooltip(
          navigationItem,
          language === "en" ? "Products" : "محصولات",
          "focus",
        );
        await page.locator(".topbar-search-icon").focus();
        await expect(tooltip).toHaveCount(0);
        await expectDelayedNavigationTooltip(
          navigationItem,
          language === "en" ? "Products" : "محصولات",
          "mouseenter",
        );
        if (info.project.name === "phone")
          await page.locator(".topbar-search-icon").tap();
        else await page.locator(".topbar-search-icon").click();
        const dialog = page.locator(".topbar-search-dialog");
        await expect(dialog).toBeVisible();
        await dialog.locator("input").fill("0003");
        await dialog
          .getByRole("button", {
            name: language === "en" ? "Search" : "جست‌وجو",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/lookup\?search=0003/);
        await expect(dialog).not.toBeVisible();
      }
      const proofPath = info.outputPath("responsive-geometry.json");
      await writeFile(proofPath, JSON.stringify(reports, null, 2) + "\n");
      await info.attach("Actual responsive geometry", {
        path: proofPath,
        contentType: "application/json",
      });
    });
  }
