import { expect, test, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { setBranch, signIn, visitPage } from "./helpers";
import { chooseOption } from "./helpers";

async function independentTimesheetRows(
  page: Page,
  role: "Cashier" | "Manager",
) {
  await page.goto("/");
  await signIn(page, "Manager");
  await setBranch(page, "North York");
  await runCanonicalBusinessFixture(
    page,
    (draft) => {
      // B precedes C's optional demo papers. Install explicit fictional setup
      // with the genuine signed-in Manager and canonical fixture transaction.
      draft.timesheet_staff = [];
      draft.timesheet_days = [];
      draft.timesheet_rows = [];
      draft.config.modules.timesheets = true;
      const departments = draft.config.timesheets?.departments;
      const bakery = departments?.find((item) => item.name_en === "Bakery");
      const cash = departments?.find((item) => item.name_en === "Cash");
      if (!bakery || !cash)
        throw new Error(
          "The configured Bakery and Cash departments are required.",
        );
      const branch = "Branch 1";
      const location = draft.config.branches.find((item) => item.id === branch);
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: location?.timezone || draft.config.company.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const part = (key: string) =>
        parts.find((item) => item.type === key)!.value;
      const date = `${part("year")}-${part("month")}-${part("day")}`;
      const company_id = draft.config.company.seed_key;
      const stamp = {
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        created_by_user_id: "demo-person-manager",
        updated_by_user_id: "demo-person-manager",
        version: 1,
      };
      const day = {
        id: "r2d-b-test-day",
        company_id,
        branch,
        branch_id: branch,
        date,
        notes: "Independent fictional browser-test sheet.",
        ...stamp,
      };
      draft.timesheet_days.push(day);
      for (const [name, key, department, inTime, outTime] of [
        ["Emery Vale", "emery", bakery, "06:00", "14:00"],
        ["Rowan Pine", "rowan", cash, "07:00", "15:00"],
      ] as const) {
        const staff = {
          id: `r2d-b-test-staff-${key}`,
          company_id,
          branch,
          branch_id: branch,
          name_en: name,
          usual_department_key: department.key,
          status: "active" as const,
          ...stamp,
        };
        draft.timesheet_staff.push(staff);
        draft.timesheet_rows.push({
          id: `r2d-b-test-row-${key}`,
          company_id,
          branch,
          branch_id: branch,
          day_id: day.id,
          date,
          department_key: department.key,
          department_name_en: department.name_en,
          department_name_fa: department.name_fa,
          staff_id: staff.id,
          name_en: staff.name_en,
          in_time: inTime,
          out_time: outTime,
          ...stamp,
        });
      }
    },
    undefined,
  );
  await page.reload();
  if (role !== "Manager") await signIn(page, role);
}

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
    await expect(row).toContainText("11:45");
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
  await independentTimesheetRows(page, "Cashier");
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
  await page.getByRole("tab", { name: "Week", exact: true }).click();
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

test("Print prepares the protected bilingual paper with all eight sections and Notes", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "print", {
      configurable: true,
      value: () => {
        document.documentElement.dataset.timesheetPrinted = "true";
      },
    });
  });
  await page.goto("/");
  await signIn(page, "Cashier");
  await visitPage(page, "Timesheets");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-timesheet-printed",
    "true",
  );
  await page.emulateMedia({ media: "print" });
  const paper = page.locator(".timesheet-print-output");
  await expect(paper).toBeVisible();
  await expect(paper.locator("[data-print-department]")).toHaveCount(8);
  for (const [english, persian] of [
    ["Bakery", "نانوایی"],
    ["Cash", "صندوق"],
    ["Kitchen", "آشپزخانه"],
    ["Kebab", "کباب"],
    ["Pastry", "شیرینی پزی"],
    ["Buffet", "بوفه"],
    ["Floor", "فلور"],
    ["Butchery", "قصابی"],
  ]) {
    const title = paper.locator("h2").filter({ hasText: english });
    await expect(title).toBeVisible();
    await expect(title).toContainText(persian);
  }
  await expect(paper.locator(".timesheet-paper-notes")).toContainText("Notes");
  await expect(paper.locator('footer [lang="en"]')).toHaveText(
    "Made with Klead",
  );
  await expect(paper.locator('footer [lang="fa"]')).toHaveText(
    "ساخته‌شده با Klead",
  );
  await expect(page.locator("#root")).toBeHidden();
  const columns = await paper
    .locator(".timesheet-paper-grid")
    .evaluate(
      (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(3);
  if (testInfo.project.name === "desktop") {
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(paper).toHaveCount(0);
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await page.evaluate(
    () => delete document.documentElement.dataset.timesheetPrinted,
  );
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-timesheet-printed",
    "true",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".timesheet-paper-week-table")).toBeVisible();
  await expect(page.locator(".timesheet-paper-week-table tfoot")).toContainText(
    "Week total",
  );
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await signIn(page, "Floor Worker");
  await page.goto("/#timesheets");
  await expect(page.locator(".timesheet-print-output")).toHaveCount(0);
});

test("invalid partial times retain typing and do not move the next person's fields", async ({
  page,
}) => {
  await independentTimesheetRows(page, "Cashier");
  await visitPage(page, "Timesheets");
  const bakery = page.locator(".timesheet-department").filter({
    has: page.getByRole("heading", { name: "Bakery", exact: true }),
  });
  await bakery.getByRole("button", { name: "Add person", exact: true }).click();
  await bakery
    .getByRole("combobox", { name: "Search staff or type a new name" })
    .fill("Sage Lark");
  await bakery
    .getByRole("option", { name: "Add “Sage Lark” to staff" })
    .click();
  const next = bakery.getByRole("textbox", {
    name: "In time for Sage Lark",
    exact: true,
  });
  await expect(next).toBeVisible();
  const input = bakery.getByRole("textbox", {
    name: "In time for Emery Vale",
    exact: true,
  });
  await input.fill("999");
  const before = await next.boundingBox();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveValue("999");
  const after = await next.boundingBox();
  expect(Math.abs(before!.y - after!.y)).toBeLessThanOrEqual(2);
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await expect(
    page.getByText("Check the entries that could not be saved.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".timesheet-departments")).toBeVisible();
  const awaitDate = await page
    .locator(".timesheets-page")
    .getAttribute("data-timesheet-date");
  await input.fill("7");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).timesheet_rows?.find(
          (row) => row.name_en === "Emery Vale" && row.date === awaitDate,
        )?.in_time,
    )
    .toBe("07:00");
  await expect(input).toHaveValue("7");
  await input.pressSequentially("30", { delay: 10 });
  await input.blur();
  await expect(input).toHaveValue("07:30");
});

test("staff can be edited, linked, archived and restored without removing past shifts", async ({
  page,
}) => {
  await independentTimesheetRows(page, "Cashier");
  await visitPage(page, "Timesheets");
  await page.getByRole("button", { name: "Manage staff", exact: true }).click();
  const dialog = page.locator("dialog.timesheet-manage-staff[open]");
  await dialog
    .locator(".timesheet-managed-person")
    .filter({ hasText: "Emery Vale" })
    .getByRole("button", { name: "Actions for Emery Vale", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", {
    name: "Edit staff member",
    exact: true,
  });
  await edit
    .getByLabel("Name (Persian) (optional)", { exact: true })
    .fill("نام نمونه");
  await chooseOption(
    page,
    edit.getByRole("combobox", { name: "App login (optional)" }),
    "Demo Cashier · cashier",
  );
  await edit
    .getByRole("button", { name: "Save staff member", exact: true })
    .click();
  const person = dialog
    .locator(".timesheet-managed-person")
    .filter({ hasText: "Emery Vale" });
  await person
    .getByRole("button", { name: "Actions for Emery Vale", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Archive this staff member?" })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(person).toHaveCount(0);
  await dialog.getByRole("tab", { name: /Archived/ }).click();
  await dialog
    .locator(".timesheet-managed-person")
    .filter({ hasText: "Emery Vale" })
    .getByRole("button", { name: "Actions for Emery Vale", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Restore", exact: true }).click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "In time for Emery Vale", exact: true }),
  ).toHaveValue("06:00");
  const state = await readCanonicalBusinessEvidence(page);
  const actual = state.timesheet_staff?.find(
    (item) => item.name_en === "Emery Vale",
  );
  expect(actual?.name_fa).toBe("نام نمونه");
  expect(actual?.app_person_id).toBe("demo-person-cashier");
  expect(actual?.status).toBe("active");
  expect(
    state.activity
      .filter((event) => event.entity_id === actual?.id)
      .map((event) => event.action),
  ).toEqual(
    expect.arrayContaining([
      "Edit timesheet staff",
      "Archive timesheet staff",
      "Restore timesheet staff",
    ]),
  );
});

test("configured departments can change while historical shifts survive and module Off closes the route", async ({
  page,
}) => {
  await independentTimesheetRows(page, "Manager");
  const before = await readCanonicalBusinessEvidence(page);
  await page.goto("/#settings?group=timesheets");
  await expect(page.locator(".timesheet-settings")).toBeVisible();
  await page
    .getByRole("button", { name: "Add department", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Department 9 English name", exact: true })
    .fill("Practice Room");
  await page
    .getByRole("textbox", { name: "Department 9 Persian name", exact: true })
    .fill("بخش تمرین");
  await page
    .getByRole("button", { name: "Move Practice Room up", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove Bakery", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(async () =>
      (
        await readCanonicalBusinessEvidence(page)
      ).config.timesheets?.departments.map((item) => item.name_en),
    )
    .toEqual([
      "Cash",
      "Kitchen",
      "Kebab",
      "Pastry",
      "Buffet",
      "Floor",
      "Practice Room",
      "Butchery",
    ]);
  await page.goto("/#timesheets");
  const retained = page.locator(".timesheet-department").filter({
    has: page.getByRole("heading", { name: "Bakery", exact: true }),
  });
  await expect(retained).toContainText(
    "Past department · existing shifts are retained.",
  );
  await expect(
    retained.getByRole("button", { name: "Add person", exact: true }),
  ).toHaveCount(0);
  expect((await readCanonicalBusinessEvidence(page)).timesheet_rows).toEqual(
    before.timesheet_rows,
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
  await page.goto("/#timesheets");
  await expect(page.locator(".timesheet-departments")).toHaveCount(0);
  await expect(page.locator(".timesheet-print-output")).toHaveCount(0);
});

/** Hold only the autosave scheduler; actual inputs, navigation and IDB commands stay real. */
async function holdTimesheetDebounce(page: Page) {
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) =>
      original(
        handler,
        timeout === 350 ? 60_000 : timeout,
        ...args,
      )) as typeof window.setTimeout;
  });
}

for (const role of ["Manager", "Cashier"] as const) {
  test(`${role} focused queued edit survives hash navigation before debounce without blur`, async ({
    page,
  }) => {
    await independentTimesheetRows(page, role);
    await visitPage(page, "Timesheets");
    const input = page.getByRole("textbox", {
      name: "In time for Emery Vale",
      exact: true,
    });
    await holdTimesheetDebounce(page);
    await input.fill("730");
    await expect(input).toBeFocused();
    const before = await readCanonicalBusinessEvidence(page);
    expect(
      before.timesheet_rows?.find((row) => row.name_en === "Emery Vale")
        ?.in_time,
    ).toBe("06:00");
    await page.evaluate(() => {
      window.location.hash = "#lookup";
    });
    await expect(page).toHaveURL(/#lookup$/);
    await expect(page.locator(".timesheet-departments")).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).timesheet_rows?.find(
            (row) => row.name_en === "Emery Vale",
          )?.in_time,
      )
      .toBe("07:30");
    const saved = await readCanonicalBusinessEvidence(page);
    expect(
      saved.activity.find((event) => event.action === "Edit timesheet row"),
    ).toMatchObject({
      actor_user_id:
        role === "Manager" ? "demo-person-manager" : "demo-person-cashier",
    });
    await page.reload();
    await visitPage(page, "Timesheets");
    await expect(
      page.getByRole("textbox", {
        name: "In time for Emery Vale",
        exact: true,
      }),
    ).toHaveValue("07:30");
  });
}

test("failed queued Browser Back retains text and Retry, then preserves the actual Back destination", async ({
  page,
}) => {
  await independentTimesheetRows(page, "Manager");
  await page.goto("/#lookup");
  await visitPage(page, "Timesheets");
  const sheetUrl = page.url();
  const input = page.getByRole("textbox", {
    name: "In time for Emery Vale",
    exact: true,
  });
  await holdTimesheetDebounce(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (value, key) {
      const state = value?.state;
      if (
        fail &&
        this.name === "business" &&
        state?.timesheet_rows?.some(
          (row: { name_en: string; in_time: string }) =>
            row.name_en === "Emery Vale" && row.in_time === "07:30",
        )
      ) {
        fail = false;
        throw new DOMException("Fictional storage full", "QuotaExceededError");
      }
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    };
  });
  await input.fill("730");
  await expect(input).toBeFocused();
  const before = await readCanonicalBusinessEvidence(page);
  await page.goBack();
  await expect(page).toHaveURL(sheetUrl);
  await expect(input).toHaveValue("730");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  expect((await readCanonicalBusinessEvidence(page)).timesheet_rows).toEqual(
    before.timesheet_rows,
  );
  await input
    .locator("..")
    .getByRole("button", { name: /Try again/ })
    .click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).timesheet_rows?.find(
          (row) => row.name_en === "Emery Vale",
        )?.in_time,
    )
    .toBe("07:30");
  await page.goBack();
  await expect(page).toHaveURL(/#lookup$/);
  await expect(page.locator(".timesheet-departments")).toHaveCount(0);
  await page.reload();
  await visitPage(page, "Timesheets");
  await expect(
    page.getByRole("textbox", { name: "In time for Emery Vale", exact: true }),
  ).toHaveValue("07:30");
});

test("native reload protects a queued edit and stops prompting after its actual save", async ({
  page,
}) => {
  await independentTimesheetRows(page, "Cashier");
  await visitPage(page, "Timesheets");
  const input = page.getByRole("textbox", {
    name: "In time for Emery Vale",
    exact: true,
  });
  await holdTimesheetDebounce(page);
  await input.fill("730");
  const prompt = page.waitForEvent("dialog");
  const reload = page
    .evaluate(() => window.location.reload())
    .catch(() => null);
  const dialog = await prompt;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reload;
  await expect(input).toHaveValue("730");
  await input.blur();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).timesheet_rows?.find(
          (row) => row.name_en === "Emery Vale",
        )?.in_time,
    )
    .toBe("07:30");
  await expect(input.locator("..").locator(".timesheet-save-state")).toHaveText(
    "Saved",
  );
  let unexpected = false;
  page.once("dialog", async (dialog) => {
    unexpected = true;
    await dialog.dismiss();
  });
  await page.reload();
  expect(unexpected).toBe(false);
  await expect(
    page.getByRole("textbox", { name: "In time for Emery Vale", exact: true }),
  ).toHaveValue("07:30");
});

test("an initial Timesheets invalid edit retains its day when a date hash requests another sheet", async ({
  page,
}) => {
  await independentTimesheetRows(page, "Cashier");
  await page.goto("/#timesheets");
  const input = page.getByRole("textbox", {
    name: "In time for Emery Vale",
    exact: true,
  });
  await expect(input).toHaveValue("06:00");
  const before = await readCanonicalBusinessEvidence(page);
  const date = before.timesheet_rows!.find(
    (row) => row.name_en === "Emery Vale",
  )!.date;
  const prior = new Date(`${date}T12:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const destination = `#timesheets?date=${prior.toISOString().slice(0, 10)}&view=week`;
  const originalUrl = page.url();
  await holdTimesheetDebounce(page);
  await page.evaluate(() => window.scrollTo(0, 120));
  await input.fill("999");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(0);
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, destination);
  await expect(page).toHaveURL(originalUrl);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("999");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".timesheets-page")).toHaveAttribute(
    "data-timesheet-date",
    date,
  );
  expect((await readCanonicalBusinessEvidence(page)).timesheet_rows).toEqual(
    before.timesheet_rows,
  );
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore),
  ).toBeLessThanOrEqual(2);
  await input.fill("730");
  await input.blur();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).timesheet_rows?.find(
          (row) => row.name_en === "Emery Vale",
        )?.in_time,
    )
    .toBe("07:30");
});
