import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("C12 Settings labels do not wrap and logo is centred with Replace", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1000, height: 1000 });
  await signIn(page, "Manager");
  await page.goto("/#settings?group=company");
  await expect(
    page.getByRole("button", {
      name: "Returns, dates and labels",
      exact: true,
    }),
  ).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const wrapped = await page
      .locator(".settings-group-menu button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => {
            const range = document.createRange();
            range.selectNodeContents(button);
            const lines = Array.from(range.getClientRects()).filter(
              (rect) => rect.width > 0 && rect.height > 0,
            );
            return new Set(lines.map((rect) => Math.round(rect.top))).size > 1;
          })
          .map((button) => button.textContent),
      );
    expect(wrapped).toEqual([]);
  }
  const logo = page.locator(".company-logo-control img");
  const replace = page
    .locator(".company-logo-control")
    .getByRole("button", { name: "Replace", exact: true });
  const a = (await logo.boundingBox())!,
    b = (await replace.boundingBox())!;
  expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(
    1.5,
  );
});
