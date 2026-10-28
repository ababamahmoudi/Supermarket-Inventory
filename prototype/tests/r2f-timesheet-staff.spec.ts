import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { chooseOption } from "./helpers";
import { prepareR2fTimesheet } from "./r2f-timesheet-fixture";

for (const language of ["en", "fa"] as const)
  for (const theme of ["light", "dark"] as const)
    for (const width of [1440, 1000, 390])
      test(`R2f D2 staff and inline add ${width} ${language} ${theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await prepareR2fTimesheet(page, language, theme);
        await page
          .getByRole("button", {
            name: language === "en" ? "Manage staff" : "مدیریت کارکنان",
            exact: true,
          })
          .click();
        const dialog = page.locator("dialog.timesheet-manage-staff[open]");
        await expect(dialog).toBeVisible();
        const rows = dialog.locator(".timesheet-managed-person");
        await expect(rows).toHaveCount(10);
        await expect(
          dialog.locator(
            '[data-staff-id="r2f-person-2"] .timesheet-staff-login',
          ),
        ).toHaveText("cashier");
        const toolbar = dialog.locator(".timesheet-staff-toolbar");
        await expect(toolbar.getByRole("tab").first()).toContainText("10");
        await expect(toolbar.getByRole("tab").last()).toContainText("1");
        const geometry = await dialog.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const controls = [
            ...node.querySelectorAll(".timesheet-staff-toolbar > *"),
          ].map((item) => {
            const box = item.getBoundingClientRect();
            return {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              center: box.y + box.height / 2,
            };
          });
          const row = node.querySelector(".timesheet-managed-person")!;
          const menu = row
            .querySelector(".timesheet-staff-menu")!
            .getBoundingClientRect();
          const textStart = (item: Element) => {
            const range = document.createRange();
            range.selectNodeContents(item);
            const box = range.getBoundingClientRect();
            return getComputedStyle(node).direction === "rtl"
              ? box.right
              : box.left;
          };
          const headings = [
            ...node.querySelectorAll(".timesheet-managed-head > span"),
          ];
          const alignment = [
            ...node.querySelectorAll(".timesheet-managed-person"),
          ].map((person) => ({
            secondary: Math.abs(
              textStart(
                person.querySelector(".timesheet-staff-names > span")!,
              ) - textStart(headings[1]),
            ),
            name: Math.abs(
              textStart(
                person.querySelector(".timesheet-staff-names strong")!,
              ) - textStart(headings[1]),
            ),
            department: Math.abs(
              textStart(person.querySelector(".timesheet-staff-department")!) -
                textStart(headings[2]),
            ),
            login: Math.abs(
              (getComputedStyle(node).direction === "rtl"
                ? person
                    .querySelector(".timesheet-staff-login")!
                    .getBoundingClientRect().right
                : person
                    .querySelector(".timesheet-staff-login")!
                    .getBoundingClientRect().left) - textStart(headings[3]),
            ),
          }));
          const body = node.querySelector(".ui-dialog-body")!;
          return {
            width: rect.width,
            x: rect.x,
            controls,
            rowHeight: row.getBoundingClientRect().height,
            menu: { width: menu.width, height: menu.height },
            alignment,
            overflow:
              node.scrollWidth > node.clientWidth ||
              body.scrollWidth > body.clientWidth,
            viewportOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(geometry.width).toBe(width === 390 ? 358 : 880);
        expect(geometry.x).toBeGreaterThanOrEqual(16);
        expect(geometry.menu).toEqual({ width: 36, height: 36 });
        expect(geometry.overflow).toBe(false);
        expect(geometry.viewportOverflow).toBe(false);
        geometry.controls.forEach((control) => expect(control.height).toBe(44));
        if (width === 390) {
          expect(
            new Set(
              geometry.controls.map((control) => Math.round(control.width)),
            ).size,
          ).toBe(1);
          expect(geometry.controls[1].y - geometry.controls[0].y).toBe(54);
          expect(geometry.controls[2].y - geometry.controls[1].y).toBe(54);
          expect(Math.round(geometry.rowHeight)).toBe(102);
        } else {
          expect(geometry.rowHeight).toBe(64);
          expect(
            Math.max(...geometry.controls.map((control) => control.center)) -
              Math.min(...geometry.controls.map((control) => control.center)),
          ).toBeLessThanOrEqual(1);
          geometry.alignment.forEach((row) =>
            Object.values(row).forEach((difference) =>
              expect(difference).toBeLessThanOrEqual(1.5),
            ),
          );
        }
        await dialog.getByRole("heading").click();
        await page.screenshot({
          path: info.outputPath(`D2-list-${width}-${language}-${theme}.png`),
          fullPage: false,
        });
        await rows.first().evaluate((node) => {
          (node as HTMLElement).dataset.retainedForAdd = "true";
        });
        await toolbar
          .getByRole("button", {
            name: language === "en" ? "Add person" : "افزودن فرد",
            exact: true,
          })
          .click();
        const form = dialog.locator(".timesheet-new-person");
        const english = form.getByRole("textbox").first();
        await expect(english).toBeFocused();
        await expect(rows).toHaveCount(10);
        await expect(rows.first()).toHaveAttribute(
          "data-retained-for-add",
          "true",
        );
        expect(
          await form.evaluate((node) =>
            Boolean(
              node.compareDocumentPosition(
                node.parentElement!.querySelector(".timesheet-managed-list")!,
              ) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          ),
        ).toBe(true);
        await english.fill("Theo Moss");
        await chooseOption(
          page,
          form.getByRole("combobox").first(),
          language === "en" ? "Kitchen" : "آشپزخانه",
        );
        await english.focus();
        expect(
          await form
            .locator(".timesheet-new-person-actions button")
            .evaluateAll((buttons) =>
              buttons.map((button) => button.getBoundingClientRect().height),
            ),
        ).toEqual([40, 40]);
        await page.screenshot({
          path: info.outputPath(`D2-add-${width}-${language}-${theme}.png`),
          fullPage: false,
        });
        const before = await readCanonicalBusinessEvidence(page);
        await form
          .getByRole("button", {
            name: language === "en" ? "Add person" : "افزودن فرد",
            exact: true,
          })
          .click();
        await expect(form).toHaveCount(0);
        await expect(rows).toHaveCount(11);
        const created = rows.filter({ hasText: "Theo Moss" });
        await expect(created.locator(".timesheet-staff-login")).toHaveText(
          language === "en" ? "No app login" : "بدون ورود به برنامه",
        );
        await expect(toolbar.getByRole("tab").first()).toContainText("11");
        const actual = await readCanonicalBusinessEvidence(page);
        const person = actual.timesheet_staff!.find(
          (item) => item.name_en === "Theo Moss",
        )!;
        expect(person.usual_department_key).toBe("kitchen");
        expect(person.status).toBe("active");
        expect(person.app_person_id).toBeFalsy();
        expect(person.created_by_user_id).toBe("demo-person-manager");
        expect(actual.timesheet_rows).toEqual(before.timesheet_rows);
        expect(actual.timesheet_days).toEqual(before.timesheet_days);
        await dialog
          .getByRole("button", {
            name: language === "en" ? "Done" : "تمام",
            exact: true,
          })
          .click();
        await expect(dialog).toHaveCount(0);
        expect(errors).toEqual([]);
      });

test("R2f D2 stale staff edit keeps the form and the newer canonical person", async ({
  page,
}) => {
  await prepareR2fTimesheet(page);
  await page.getByRole("button", { name: "Manage staff", exact: true }).click();
  const dialog = page.locator("dialog.timesheet-manage-staff[open]");
  const person = dialog.locator('[data-staff-id="r2f-person-0"]');
  await person
    .getByRole("button", { name: "Actions for Emery Vale", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const form = page.getByRole("dialog", {
    name: "Edit staff member",
    exact: true,
  });
  await form.getByRole("textbox").first().fill("Old staged name");
  await runCanonicalBusinessFixture(
    page,
    (draft) => {
      const canonical = draft.timesheet_staff!.find(
        (item) => item.id === "r2f-person-0",
      )!;
      canonical.name_en = "Newer saved person";
      canonical.version += 1;
    },
    undefined,
  );
  await form
    .getByRole("button", { name: "Save staff member", exact: true })
    .click();
  await expect(form.getByRole("alert")).toHaveText(
    "This person changed while the form was open. Close it and try again.",
  );
  await expect(form.getByRole("textbox").first()).toHaveValue(
    "Old staged name",
  );
  const canonical = (
    await readCanonicalBusinessEvidence(page)
  ).timesheet_staff!.find((item) => item.id === "r2f-person-0")!;
  expect(canonical.name_en).toBe("Newer saved person");
  expect(canonical.version).toBe(2);
});

test("R2f D2 a failed archive retains its confirmation and history for Retry", async ({
  page,
}) => {
  await prepareR2fTimesheet(page);
  await page.getByRole("button", { name: "Manage staff", exact: true }).click();
  const dialog = page.locator("dialog.timesheet-manage-staff[open]");
  await dialog
    .locator('[data-staff-id="r2f-person-0"]')
    .getByRole("button", { name: "Actions for Emery Vale", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  const confirm = page.getByRole("dialog", {
    name: "Archive this staff member?",
    exact: true,
  });
  const before = await readCanonicalBusinessEvidence(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (value, key) {
      if (
        fail &&
        this.name === "business" &&
        value?.state?.timesheet_staff?.some(
          (person: { id: string; status: string }) =>
            person.id === "r2f-person-0" && person.status === "archived",
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
  await confirm.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("alert")).toHaveText(
    "This could not be saved. Check your location and permissions, then try again.",
  );
  const failed = await readCanonicalBusinessEvidence(page);
  expect(failed.timesheet_staff).toEqual(before.timesheet_staff);
  expect(failed.timesheet_rows).toEqual(before.timesheet_rows);
  await confirm.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  const saved = await readCanonicalBusinessEvidence(page);
  expect(
    saved.timesheet_staff!.find((person) => person.id === "r2f-person-0")!
      .status,
  ).toBe("archived");
  expect(saved.timesheet_rows).toEqual(before.timesheet_rows);
  expect(
    saved.activity.filter(
      (event) =>
        event.entity_id === "r2f-person-0" &&
        event.action === "Archive timesheet staff",
    ),
  ).toHaveLength(1);
});

for (const width of [1440, 390])
  test(`R2f D2 modal Undo keeps Done stable and restores the approved footer note at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await prepareR2fTimesheet(page);
    const before = await readCanonicalBusinessEvidence(page);
    await page.evaluate(() => {
      location.hash = "offers";
    });
    const row = page.locator(
      '.current-offers-table tr[data-product-code="0003"]',
    );
    await row.getByRole("button", { name: "Stop offer", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Stop offer", exact: true })
      .getByRole("button", { name: "Stop offer", exact: true })
      .click();
    await expect(page.getByTestId("undo-toast")).toBeVisible();
    await page.evaluate(() => {
      location.hash = "timesheets?date=2026-10-27";
    });
    await page
      .getByRole("button", { name: "Manage staff", exact: true })
      .click();
    const dialog = page.locator("dialog.timesheet-manage-staff[open]");
    const feedback = dialog.getByTestId("dialog-action-status");
    await expect(feedback).toBeVisible();
    await expect(dialog.locator(".timesheet-staff-footnote")).toBeHidden();
    const done = dialog.getByRole("button", { name: "Done", exact: true });
    const withFeedback = await done.boundingBox();
    const footerWithFeedback = await dialog
      .locator(".ui-dialog-footer")
      .boundingBox();
    await feedback.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(feedback).toHaveCount(0);
    await expect(dialog.locator(".timesheet-staff-footnote")).toBeVisible();
    const withoutFeedback = await done.boundingBox();
    const footerWithoutFeedback = await dialog
      .locator(".ui-dialog-footer")
      .boundingBox();
    expect(Math.abs(withFeedback!.x - withoutFeedback!.x)).toBeLessThanOrEqual(
      2,
    );
    expect(Math.abs(withFeedback!.y - withoutFeedback!.y)).toBeLessThanOrEqual(
      2,
    );
    expect(
      Math.abs(footerWithFeedback!.height - footerWithoutFeedback!.height),
    ).toBeLessThanOrEqual(2);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.timesheet_rows).toEqual(before.timesheet_rows);
    expect(after.timesheet_staff).toEqual(before.timesheet_staff);
    expect(
      after.offers.find((offer) => offer.product_code === "0003")!.status,
    ).toBe("active");
  });
