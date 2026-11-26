import { expect, test } from "@playwright/test";
import { openShellAction, setLanguage, signIn } from "./helpers";

for (const role of ["Supervisor", "Floor Worker", "Cashier"] as const)
  for (const width of [390, 1440]) {
    test(`${role} shell language helpers wait for restored session at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, role);
      const person = await page.locator(".user-chip-copy strong").innerText();
      await setLanguage(page, "fa");
      await expect(page.locator("html")).toHaveAttribute("lang", "fa");
      // A committed navigation has a new document before its retained session
      // and preferences are restored. The helper must wait for that real shell.
      await page.reload({ waitUntil: "commit" });
      await setLanguage(page, "en");
      await expect(page.locator(".topbar")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator(".user-chip-copy strong")).toHaveText(person);
      await expect(
        page
          .locator(".topbar")
          .getByRole("combobox", { name: "Location", exact: true }),
      ).toBeVisible();

      await page.reload({ waitUntil: "commit" });
      await (await openShellAction(page, "Switch to Persian")).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "fa");
      if (width === 390)
        await expect(page.locator(".mobile-more-menu")).toHaveAttribute(
          "aria-expanded",
          "false",
        );
      await setLanguage(page, "en");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  }
