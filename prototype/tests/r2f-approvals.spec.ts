import { expect, test } from "@playwright/test";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { word } from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2f D6 approval number groups and ordered actions in ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#approvals");
    await expect(page.locator(".approval-card").first()).toBeVisible();
    await expect(
      page.locator(".sale-request-card .approval-numbers"),
    ).toBeVisible();
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"] as const) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              word(
                language,
                `Switch to ${theme} theme`,
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        const cards = page.locator(".approval-detail-row");
        expect(await cards.count()).toBeGreaterThanOrEqual(3);
        for (const card of await cards.all()) {
          const group = card.locator(".approval-numbers");
          await expect(group).toBeVisible();
          await expect(
            group.locator(".approval-number-price > .ui-number-value"),
          ).toHaveCSS("font-size", "26px");
          const geometry = await group.evaluate((element) => {
            const leading = element.querySelector<HTMLElement>(
              ".approval-number-leading > .ui-number-value",
            )!;
            const price = element.querySelector<HTMLElement>(
              ".approval-number-price > .ui-number-value",
            )!;
            const margin = element.querySelector<HTMLElement>(
              ".approval-number-margin > .ui-number-value",
            )!;
            const baseline = (node: HTMLElement) => {
              const probe = document.createElement("span");
              probe.style.display = "inline-block";
              probe.style.width = "0";
              probe.style.height = "0";
              node.append(probe);
              const result = probe.getBoundingClientRect().bottom;
              probe.remove();
              return result;
            };
            return {
              width: element.getBoundingClientRect().width,
              cost: baseline(leading),
              price: baseline(price),
              margin: baseline(margin),
              overflow: element.scrollWidth - element.clientWidth,
            };
          });
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.cost - geometry.price)).toBeLessThanOrEqual(
            1.5,
          );
          if (width === 1440) {
            expect(geometry.width).toBeCloseTo(521, 0);
            expect(
              Math.abs(geometry.margin - geometry.price),
            ).toBeLessThanOrEqual(1.5);
          }
          const actions = card.locator(
            ".approval-card-footer .actions > button",
          );
          await expect(actions).toHaveCount(3);
          const names = await actions.allTextContents();
          expect(names).toEqual([
            word(
              language,
              (await card.getAttribute("data-sale-request-id"))
                ? "Change and approve"
                : "Edit and approve",
              (await card.getAttribute("data-sale-request-id"))
                ? "تغییر و تأیید"
                : "ویرایش و تأیید",
            ),
            word(language, "Reject", "رد کردن"),
            word(language, "Approve", "تأیید"),
          ]);
          const boxes = await actions.evaluateAll((nodes) =>
            nodes.map((node) => node.getBoundingClientRect().toJSON()),
          );
          if (width === 390) {
            expect(boxes[2].y + boxes[2].height).toBeLessThanOrEqual(
              boxes[0].y + 1,
            );
            expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThanOrEqual(1.5);
          } else {
            expect(
              Math.max(...boxes.map((box) => box.y + box.height / 2)) -
                Math.min(...boxes.map((box) => box.y + box.height / 2)),
            ).toBeLessThanOrEqual(1.5);
          }
        }
        if (
          (width === 1440 &&
            ((language === "en" && theme === "light") ||
              (language === "fa" && theme === "dark"))) ||
          (width === 390 && language === "en" && theme === "light")
        )
          await page.screenshot({
            path: info.outputPath(
              `approvals-${width}-${theme}-${language}.png`,
            ),
            fullPage: true,
          });
      }
    }
    expect(errors).toEqual([]);
  });
}
