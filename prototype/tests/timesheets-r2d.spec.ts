import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setBranch, signIn, visitPage } from "./helpers";

test("cashier adds two people and buffered times and notes survive fast typing and reload", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Cashier");
  await visitPage(page, "Timesheets");
  const bakery = page
    .locator(".timesheet-department")
    .filter({
      has: page.getByRole("heading", { name: "Bakery", exact: true }),
    });
  for (const name of ["Juniper Avery", "Robin Vale"]) {
    await bakery
      .getByRole("button", { name: "Add person", exact: true })
      .click();
    await bakery
      .getByRole("combobox", { name: "Search staff or type a new name" })
      .fill(name);
    await bakery
      .getByRole("option", { name: `Add “${name}” to staff` })
      .click();
    const row = bakery.locator(".timesheet-row").filter({ hasText: name });
    const start = row.getByRole("textbox", {
      name: `In time for ${name}`,
      exact: true,
    });
    const box = await start.boundingBox();
    await start.pressSequentially("730", { delay: 10 });
    await row
      .getByRole("textbox", { name: `Out time for ${name}`, exact: true })
      .pressSequentially("1915", { delay: 10 });
    await expect(start).toHaveValue("07:30");
    const after = await start.boundingBox();
    expect(Math.abs(after!.y - box!.y)).toBeLessThanOrEqual(2);
    await expect(row).toContainText("11 h 45 m");
  }
  const notes = page.getByRole("textbox", {
    name: "Notes for this day",
    exact: true,
  });
  await notes.fill("");
  await notes.pressSequentially(
    "Fresh fictional team practiced the evening handover.",
    { delay: 5 },
  );
  await notes.blur();
  await expect
    .poll(async () => {
      const state = await readCanonicalBusinessEvidence(page);
      const people =
        state.timesheet_staff?.filter((item) =>
          ["Juniper Avery", "Robin Vale"].includes(item.name_en),
        ) ?? [];
      const rows =
        state.timesheet_rows?.filter((row) =>
          people.some((person) => person.id === row.staff_id),
        ) ?? [];
      return (
        rows.length === 2 &&
        rows.every(
          (row) => row.in_time === "07:30" && row.out_time === "19:15",
        ) &&
        state.timesheet_days?.some(
          (day) =>
            day.notes ===
            "Fresh fictional team practiced the evening handover.",
        )
      );
    })
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Timesheets", exact: true }),
  ).toBeVisible();
  for (const name of ["Juniper Avery", "Robin Vale"]) {
    const row = page.locator(".timesheet-row").filter({ hasText: name });
    await expect(
      row.getByRole("textbox", { name: `In time for ${name}`, exact: true }),
    ).toHaveValue("07:30");
    await expect(
      row.getByRole("textbox", { name: `Out time for ${name}`, exact: true }),
    ).toHaveValue("19:15");
  }
  await expect(
    page.getByRole("textbox", { name: "Notes for this day", exact: true }),
  ).toHaveValue("Fresh fictional team practiced the evening handover.");
});

test("floor worker cannot see or open Timesheets and aggregate viewing asks for a branch", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Floor Worker");
  await expect(
    page.getByRole("link", { name: "Timesheets", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#timesheets");
  await expect(page.locator(".timesheet-departments")).toHaveCount(0);
  await expect(page.locator(".timesheet-row")).toHaveCount(0);
  await signIn(page, "Manager");
  await setBranch(page, "all");
  await page.goto("/#timesheets");
  await expect(
    page.getByText("Choose a branch to view or edit its daily sheet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".timesheet-row")).toHaveCount(0);
});
