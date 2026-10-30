import { expect, test } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";

test("C13 departments use one language, hours stay compact and day arrows mirror", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#timesheets");
  await expect(
    page.locator(".timesheet-department-heading h2").first(),
  ).toHaveText("Bakery");
  await expect(
    page.locator(".timesheet-department-heading [lang=fa]"),
  ).toHaveCount(0);
  await expect(page.locator(".timesheet-hours strong").first()).toHaveText(
    /^\d+:\d{2}$/,
  );
  await expect(
    page
      .getByRole("button", { name: "Previous day", exact: true })
      .locator("svg"),
  ).toHaveClass(/lucide-arrow-left/);
  await setLanguage(page, "fa");
  await expect(
    page.locator(".timesheet-department-heading h2").first(),
  ).toHaveText("نانوایی");
  await expect(
    page.locator(".timesheet-department-heading").first(),
  ).not.toContainText("Bakery");
  await expect(page.locator(".timesheet-hours strong").first()).toHaveText(
    /^\d+:\d{2}$/,
  );
  await expect(
    page.getByRole("button", { name: "روز قبل", exact: true }).locator("svg"),
  ).toHaveClass(/lucide-arrow-right/);
});
