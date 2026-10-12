import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { signIn, setLanguage } from "./helpers";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";
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
            };
          });
          await writeFile(
            info.outputPath("dashboard-geometry.json"),
            JSON.stringify(actual, null, 2) + "\n",
          );
          expect(actual.topbar.height).toBe(60);
          expect(actual.accounts).toBe(1);
          expect(actual.kpis).toHaveLength(4);
          expect(
            new Set(actual.kpis.map((card) => Math.round(card.y))).size,
          ).toBe(width < 760 ? 2 : 1);
          for (const row of actual.rows) {
            expect(row.cards).toHaveLength(2);
            const [first, second] = row.cards;
            if (width < 760) {
              expect(first.width).toBeCloseTo(second.width, 0);
              expect(second.y).toBeGreaterThanOrEqual(first.bottom + 15);
            } else {
              expect(first.y).toBeCloseTo(second.y, 0);
              expect(first.height).toBeCloseTo(second.height, 0);
              const gap =
                Math.max(first.x, second.x) -
                Math.min(first.right, second.right);
              expect(gap).toBeCloseTo(24, 0);
              // Grid track spans include their internal gutters: adding the
              // shared gutter proves the actual 8+4 or 6+6 allocation.
              expect((first.width + gap) / (second.width + gap)).toBeCloseTo(
                row.halves ? 1 : 2,
                2,
              );
            }
          }
          if (width >= 1440) expect(actual.aside.width).toBe(280);
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
        await navigationItem.focus();
        await expect(navigationLabel).toBeVisible();
        await page.locator(".topbar-search-icon").focus();
        await expect(navigationLabel).not.toBeVisible();
        await navigationItem.hover();
        await expect(navigationLabel).toBeVisible();
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
