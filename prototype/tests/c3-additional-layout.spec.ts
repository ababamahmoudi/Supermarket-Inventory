import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

for (const width of [1280, 1440, 1920])
  for (const language of ["en", "fa"] as const)
    test(`supplier item history and settings fit at ${width}px (${language})`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name === "phone", "Desktop width proof.");
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Supervisor");
      await setLanguage(page, language);
      const report: { scene: string; findings: string[] }[] = [];
      const prove = async (scene: string) => {
        await page.evaluate(async () => document.fonts.ready);
        const findings = await page.evaluate(() => {
          const failures: string[] = [];
          const area =
            document.querySelector("dialog[open]") ??
            document.querySelector("main")!;
          for (const panel of [
            area,
            ...area.querySelectorAll(
              ".card, .ui-data-table, table, .request-form",
            ),
          ]) {
            if (!panel.getClientRects().length) continue;
            const rect = panel.getBoundingClientRect();
            if (panel.scrollWidth > panel.clientWidth + 2)
              failures.push(
                `${panel.className}: horizontal ${panel.scrollWidth}/${panel.clientWidth}`,
              );
            if (rect.left < -2 || rect.right > innerWidth + 2)
              failures.push(`${panel.className}: outside viewport`);
          }
          for (const cell of area.querySelectorAll("th, td")) {
            if (!cell.getClientRects().length) continue;
            const bounds = cell.getBoundingClientRect();
            const walker = document.createTreeWalker(
              cell,
              NodeFilter.SHOW_TEXT,
            );
            let node;
            while ((node = walker.nextNode())) {
              const parent = node.parentElement;
              if (
                !node.textContent?.trim() ||
                !parent?.getClientRects().length ||
                parent.closest(".sr-only, [aria-hidden=true], [hidden]")
              )
                continue;
              if (getComputedStyle(parent).clipPath !== "none") continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const rect of range.getClientRects())
                if (
                  rect.left < bounds.left - 2 ||
                  rect.right > bounds.right + 2
                )
                  failures.push(`Clipped cell: ${node.textContent.trim()}`);
            }
          }
          return failures;
        });
        report.push({ scene, findings });
        expect(findings, scene).toEqual([]);
      };
      await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
      await page
        .getByRole("tab", {
          name: language === "en" ? "Supplier items" : "کالاهای تأمین‌کننده",
          exact: true,
        })
        .click();
      await expect(
        page.locator(".supplier-items-table tbody tr").first(),
      ).toBeVisible();
      await prove("supplier items");
      await page.locator(".supplier-item-history-row").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await prove("supplier price history");
      await page.keyboard.press("Escape");
      await page.goto("/#settings?group=branches");
      await expect(page.locator("main table")).toBeVisible();
      await prove("location settings");
      await page.goto("/#requests");
      await page
        .getByRole("button", {
          name: language === "en" ? "New request" : "درخواست جدید",
          exact: true,
        })
        .click();
      await expect(page.locator(".request-form")).toBeVisible();
      await prove("new branch request");
      await testInfo.attach(`layout-${width}-${language}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
    });
