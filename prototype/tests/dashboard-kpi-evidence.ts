import { expect, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";

/** Keep the five operational tiles distinct from the authorized R2d addition. */
export async function assertDashboardOperationalAndShiftTiles(
  page: Page,
  {
    language = "en",
    branch = "Branch 1",
    navigate = true,
  }: { language?: "en" | "fa"; branch?: string; navigate?: boolean } = {},
) {
  if (!branch || branch === "all")
    throw new Error(
      "Choose an explicit current branch before asserting its shift count.",
    );
  const dashboard = page.locator(".r2c-dashboard");
  await expect(dashboard.locator(".dashboard-kpis > .kpi-card")).toHaveCount(6);
  const operational = dashboard.locator(
    ".dashboard-kpis > .ui-summary-tile:not(.timesheet-on-shift-tile)",
  );
  await expect(operational).toHaveCount(5);
  await expect(operational.locator(":scope > .kpi-label")).toHaveText(
    language === "en"
      ? [
          "Approvals waiting",
          "Price updates to apply",
          "Open alerts",
          "Open shorts",
          "Expiring soon",
        ]
      : [
          "تأییدهای در انتظار",
          "به‌روزرسانی قیمت‌های قابل اجرا",
          "هشدارهای باز",
          "کسری‌های باز",
          "انقضای نزدیک",
        ],
  );
  const state = await readCanonicalBusinessEvidence(page);
  expect(state.config.modules.timesheets).toBe(true);
  await expect(dashboard).toHaveAttribute("data-timesheets-access", "allowed");
  await expect(dashboard).toHaveAttribute("data-timesheets-module", "on");
  const location = state.config.branches.find(
    (location) => location.id === branch,
  );
  if (!location)
    throw new Error(`The explicit fixture location ${branch} is required.`);
  await expect(page.locator(".topbar .branch-pill")).toHaveText(
    language === "fa" ? location.name_fa || location.name_en : location.name_en,
  );
  const now = await page.evaluate(() => Date.now());
  const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: location.timezone || state.config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const part = (key: string) => parts.find((item) => item.type === key)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}`;
  const currentDays = new Map(
    (state.timesheet_days ?? [])
      .filter(
        (day) =>
          day.company_id === state.config.company.seed_key &&
          day.branch === branch &&
          day.branch_id === branch &&
          day.date <= today,
      )
      .map((day) => [day.id, day.date]),
  );
  const unclosed = new Set(
    (state.timesheet_rows ?? [])
      .filter(
        (row) =>
          row.company_id === state.config.company.seed_key &&
          row.branch === branch &&
          row.branch_id === branch &&
          currentDays.get(row.day_id) === row.date &&
          !row.removed_at &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(row.in_time) &&
          !row.out_time &&
          (row.date < today || (row.date === today && row.in_time <= time)),
      )
      .map((row) => row.staff_id),
  );
  const onShift = dashboard.locator(
    ".dashboard-kpis > .ui-summary-tile.timesheet-on-shift-tile",
  );
  await expect(onShift).toHaveCount(1);
  await expect(onShift.locator(":scope > .kpi-label")).toHaveText(
    language === "fa" ? "اکنون در حال کار" : "On shift now",
  );
  await expect(onShift.locator(":scope > .kpi-value")).toHaveText(
    String(unclosed.size),
  );
  if (navigate) {
    await onShift.click();
    await expect(page.locator(".timesheets-page")).toHaveAttribute(
      "data-timesheet-branch",
      branch,
    );
    await page.goto("/#dashboard");
    await expect(dashboard).toBeVisible();
  }
}
