import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setBranch, signIn, visitPage } from "./helpers";

test("cashier adds two people and buffered times and notes survive fast typing and reload", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Cashier");
  await visitPage(page, "Timesheets");
  const bakery = page.locator(".timesheet-department").filter({
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

test("week totals match actual day shifts and payroll CSV opens the same days", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await signIn(page, "Cashier");
  await visitPage(page, "Timesheets");
  const date = await page
    .locator(".timesheets-page")
    .getAttribute("data-timesheet-date");
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() - ((instant.getUTCDay() + 6) % 7));
  const monday = instant.toISOString().slice(0, 10);
  instant.setUTCDate(instant.getUTCDate() + 6);
  const sunday = instant.toISOString().slice(0, 10);
  const state = await readCanonicalBusinessEvidence(page);
  const rows = (state.timesheet_rows ?? []).filter(
    (row) =>
      row.company_id === state.config.company.seed_key &&
      row.branch === "Branch 1" &&
      !row.removed_at &&
      row.date >= monday &&
      row.date <= sunday,
  );
  const total = rows.reduce((sum, row) => {
    if (!row.in_time || !row.out_time) return sum;
    const minutes = (value: string) =>
      Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    return sum + ((minutes(row.out_time) - minutes(row.in_time) + 1440) % 1440);
  }, 0);
  await page.getByRole("button", { name: "Week view", exact: true }).click();
  const scope = page.locator(
    testInfo.project.name === "phone"
      ? ".timesheet-week-phone"
      : ".timesheet-week-wide",
  );
  await expect(scope.locator("[data-week-total-minutes]")).toHaveAttribute(
    "data-week-total-minutes",
    String(total),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("week");
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv.replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(
    '"staff","department","date","in","out","hours"',
  );
  expect(csv).toContain(date!);
  const activePerson = rows.find((row) => row.in_time && row.out_time)!;
  const cell = scope.getByRole("button", {
    name: new RegExp(`${activePerson.name_en} · ${activePerson.date}`),
  });
  await cell.click();
  await expect(page.locator(".timesheets-page")).toHaveAttribute(
    "data-timesheet-date",
    activePerson.date,
  );
  await expect(page.locator(".timesheet-departments")).toBeVisible();
  await page.reload();
  await expect(page.locator(".timesheet-departments")).toBeVisible();
});
