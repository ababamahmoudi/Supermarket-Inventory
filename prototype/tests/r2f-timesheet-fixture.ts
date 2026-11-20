import { expect, type Page } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { setBranch, setLanguage, signIn, openShellAction } from "./helpers";

/** Invented, approved-reference practice sheet, installed through the real repository. */
export async function prepareR2fTimesheet(
  page: Page,
  language: "en" | "fa" = "en",
  theme: "light" | "dark" = "light",
) {
  await page.clock.setFixedTime(new Date("2026-10-27T17:42:00Z"));
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "Branch 1");
  await runCanonicalBusinessFixture(
    page,
    (draft) => {
      draft.config.company.timezone = "America/Toronto";
      const branch = draft.config.branches.find(
        (item) => item.id === "Branch 1",
      )!;
      branch.timezone = "America/Toronto";
      draft.config.modules.timesheets = true;
      draft.timesheet_staff = [];
      draft.timesheet_days = [];
      draft.timesheet_rows = [];
      const company_id = draft.config.company.seed_key;
      const date = "2026-10-27";
      const stamp = {
        created_at: "2026-10-27T17:42:00Z",
        updated_at: "2026-10-27T17:42:00Z",
        created_by_user_id: "demo-person-manager",
        updated_by_user_id: "demo-person-manager",
        version: 1,
      };
      const day = {
        id: "r2f-day",
        company_id,
        branch: "Branch 1",
        branch_id: "Branch 1",
        date,
        notes: "Kai covered the night shift for Iris.",
        ...stamp,
      };
      draft.timesheet_days.push(day);
      const people = [
        ["Emery Vale", "امری ویل", "bakery", "06:00", "14:00"],
        ["Sami Rowe", "سامی رو", "bakery", "05:30", "13:30"],
        ["Rowan Pine", "روان پاین", "cash", "07:00", ""],
        ["June Park", "جون پارک", "cash", "15:00", "23:00"],
        ["Mira Fern", "میرا فرن", "kitchen", "08:00", "16:00"],
        ["Nila Haven", "نیلا هیون", "pastry", "06:30", "14:30"],
        ["Luca Wren", "لوکا رن", "buffet", "08:30", "15:30"],
        ["Iris Cedar", "آیریس سدار", "floor", "10:00", "18:00"],
        ["Kai Moss", "کای ماس", "floor", "22:00", "06:00"],
        ["Arlo Willow", "آرلو ویلو", "butchery", "07:00", "15:00"],
      ];
      for (const [
        index,
        [name_en, name_fa, key, in_time, out_time],
      ] of people.entries()) {
        const department = draft.config.timesheets!.departments.find(
          (item) => item.key === key,
        )!;
        if (!department)
          throw new Error(`Missing configured department ${key}`);
        const staff = {
          id: `r2f-person-${index}`,
          company_id,
          branch: "Branch 1",
          branch_id: "Branch 1",
          name_en,
          name_fa,
          usual_department_key: key,
          status: "active" as const,
          ...(name_en === "Rowan Pine"
            ? { app_person_id: "demo-person-cashier" }
            : {}),
          ...stamp,
        };
        draft.timesheet_staff.push(staff);
        draft.timesheet_rows.push({
          id: `r2f-shift-${index}`,
          company_id,
          branch: "Branch 1",
          branch_id: "Branch 1",
          day_id: day.id,
          date,
          department_key: key,
          department_name_en: department.name_en,
          department_name_fa: department.name_fa,
          staff_id: staff.id,
          name_en,
          name_fa,
          in_time,
          out_time,
          ...stamp,
        });
      }
      draft.timesheet_staff.push({
        id: "r2f-archived-person",
        company_id,
        branch: "Branch 1",
        branch_id: "Branch 1",
        name_en: "Theo Birch",
        name_fa: "تئو برچ",
        usual_department_key: "kebab",
        status: "archived",
        ...stamp,
      });
    },
    undefined,
  );
  await page.reload();
  await expect(page.locator(".topbar")).toBeVisible();
  if ((await page.evaluate(() => innerWidth)) <= 760)
    await expect(page.locator(".mobile-more-menu")).toBeVisible();
  await setLanguage(page, language);
  if (theme === "dark")
    await (
      await openShellAction(
        page,
        language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
      )
    ).click();
  await page.evaluate(() => {
    location.hash = "timesheets?date=2026-10-27";
  });
  await expect(page.locator(".timesheets-page")).toHaveAttribute(
    "data-timesheet-date",
    "2026-10-27",
  );
  await page.evaluate(() => document.fonts.ready);
}
