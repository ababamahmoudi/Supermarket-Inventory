import { guardR2gBrowserErrors } from "./r2g-browser-errors";
import { expect, test } from "@playwright/test";
import { signIn, setLanguage, openShellAction } from "./helpers";
import { inspect } from "../scripts/c5-browser-proof.mjs";

guardR2gBrowserErrors();

for (const [language, theme] of [
  ["en", "light"],
  ["fa", "dark"],
] as const)
  for (const width of [360, 390, 509, 760])
    test(`R2g A7 page primaries fill their row at ${width}px (${language}/${theme})${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
          )
        ).click();
      for (const route of ["dashboard", "invoices", "offers", "notes"]) {
        await page.goto(`/#${route}`);
        const header = page
          .locator('main [data-ui-component="page-header"]')
          .first();
        const primary = header.locator(":scope > .actions > .button-primary");
        await expect(primary).toHaveCount(1);
        await expect(primary).toBeVisible();
        const headerBox = await header.boundingBox();
        const before = await primary.boundingBox();
        expect(
          Math.abs(before!.width - headerBox!.width),
          `${route}: primary width`,
        ).toBeLessThanOrEqual(1.5);
        expect(
          Math.abs(before!.x - headerBox!.x),
          `${route}: primary start`,
        ).toBeLessThanOrEqual(1.5);
        expect(before!.height).toBe(44);
        const report = await inspect(
          page,
          `R2g A7 ${route}`,
          `${width}-${language}-${theme}`,
          "manager",
        );
        expect(report.failures).toEqual([]);
        if (route === "dashboard") {
          const actions = header.locator(":scope > .actions");
          const priorStyle = await actions.getAttribute("style");
          await actions.evaluate((node) => {
            node.style.inlineSize = "75%";
          });
          expect(
            (
              await inspect(
                page,
                "R2g A7 original gap negative",
                `${width}-${language}-${theme}`,
                "manager",
              )
            ).failures.some((failure: string) =>
              failure.includes("Phone page primary"),
            ),
          ).toBe(true);
          await actions.evaluate((node, style) => {
            if (style === null) node.removeAttribute("style");
            else node.setAttribute("style", style);
          }, priorStyle);
          const priorButtonStyle = await primary.getAttribute("style");
          await primary.evaluate((node) => {
            node.style.inlineSize = `${node.getBoundingClientRect().width - 4}px`;
            node.style.flex = "0 0 auto";
          });
          expect(
            (
              await inspect(
                page,
                "R2g A7 shrunken negative",
                `${width}-${language}-${theme}`,
                "manager",
              )
            ).failures.some((failure: string) =>
              failure.includes("Phone page primary"),
            ),
          ).toBe(true);
          await primary.evaluate((node, style) => {
            if (style === null) node.removeAttribute("style");
            else node.setAttribute("style", style);
          }, priorButtonStyle);
          await page.screenshot({
            path: info.outputPath(
              `A7-dashboard-${width}-${language}-${theme}.png`,
            ),
          });
          await primary.click();
          await expect(page).toHaveURL(/#approvals/);
          await page.goto("/#dashboard");
          const restored = await page
            .locator(
              'main [data-ui-component="page-header"] > .actions > .button-primary',
            )
            .boundingBox();
          for (const key of ["x", "y", "width", "height"] as const)
            expect(Math.abs(restored![key] - before![key])).toBeLessThanOrEqual(
              2,
            );
        }
        if (route === "notes") {
          const secondary = header.locator(
            ":scope > .actions > .button-neutral",
          );
          await expect(secondary).toHaveCount(1);
          expect((await secondary.boundingBox())!.width).toBeLessThan(
            headerBox!.width - 20,
          );
        }
      }
    });
