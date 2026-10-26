import { expect, test } from "@playwright/test";
import { setBranch, signIn, visitPage } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

test("On shift now uses unique unclosed staff and opens the scoped daily sheet", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Manager");
  await setBranch(page, "North York");
  await page.goto("/#dashboard");
  const tile = page.locator(".timesheet-on-shift-tile");
  await expect(tile).toBeVisible();
  const state = await readCanonicalBusinessEvidence(page);
  const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: state.config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (key: string) => parts.find((item) => item.type === key)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`,
    clock = `${part("hour")}:${part("minute")}`;
  const open = new Set(
    (state.timesheet_rows ?? [])
      .filter(
        (row) =>
          row.company_id === state.config.company.seed_key &&
          row.branch === "Branch 1" &&
          !row.removed_at &&
          row.in_time &&
          !row.out_time &&
          (row.date < today || (row.date === today && row.in_time <= clock)),
      )
      .map((row) => row.staff_id),
  );
  await expect(tile.locator(".kpi-value")).toHaveText(String(open.size));
  await expect(page.locator(".dashboard-kpis > .kpi-card")).toHaveCount(6);
  await tile.click();
  await expect(page.locator(".timesheets-page")).toHaveAttribute(
    "data-timesheet-branch",
    "Branch 1",
  );
  await page.goto("/#settings?group=modules");
  await page.getByRole("switch", { name: "Timesheets", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).config.modules.timesheets,
    )
    .toBe(false);
  await page.goto("/#dashboard");
  await expect(page.locator(".dashboard-kpis > .kpi-card")).toHaveCount(5);
  await expect(page.locator(".timesheet-on-shift-tile")).toHaveCount(0);
});

test("Branch Supervisor on-shift tile asks for a branch instead of choosing one", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Branch Supervisor");
  const tile = page.locator(".timesheet-on-shift-tile");
  await expect(tile).toBeVisible();
  await expect(tile.locator(".kpi-value")).toHaveText("—");
  await tile.click();
  await expect(
    page.getByText("Choose a branch to view or edit its daily sheet.", {
      exact: true,
    }),
  ).toBeVisible();
  await setBranch(page, "Richmond Hill");
  await visitPage(page, "Dashboard");
  await expect(page.locator(".timesheet-on-shift-tile .kpi-value")).toHaveText(
    "0",
  );
});
