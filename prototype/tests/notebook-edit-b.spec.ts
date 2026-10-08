import { expect, test, type Page } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

const storage = "supermarket-prototype-v1";
test.setTimeout(60000);
async function deliTab(page: Page) {
  await page.goto("/#notes");
  await page.getByRole("tab", { name: /^Deli temperatures(?: \d+)?$/ }).click();
}
async function storedEntry(page: Page, text: string) {
  return page.evaluate(
    ({ key, text }) =>
      JSON.parse(localStorage.getItem(key)!).notebook_entries.find(
        (entry: { text: string }) => entry.text === text,
      ),
    { key: storage, text },
  );
}

test("a worker corrects their own note within five seconds, the original author window expires, and the Supervisor can edit later", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await deliTab(page);
  await page.getByLabel("Note", { exact: true }).fill("Afternoon fridge check");
  await page.getByLabel("Measurement (°C)", { exact: true }).fill("3.4");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const original = await storedEntry(page, "Afternoon fridge check");
  const card = page.locator(`[data-notebook-entry="${original.id}"]`);
  await expect(
    card.getByRole("button", { name: "Edit note", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(4000);
  await card.getByRole("button", { name: "Edit note", exact: true }).click();
  const editor = page.getByRole("form", { name: "Edit note", exact: true });
  await editor
    .getByLabel("Note", { exact: true })
    .fill("Afternoon check corrected");
  await editor.getByLabel("Measurement (°C)", { exact: true }).fill("3.6");
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(card).toContainText("Afternoon check corrected");
  const corrected = await storedEntry(page, "Afternoon check corrected");
  expect(corrected).toMatchObject({
    id: original.id,
    by: original.by,
    branch: original.branch,
    company_id: original.company_id,
    created_at: original.created_at,
    status: original.status,
    notify_supervisor: original.notify_supervisor,
    measurement_unit: "°C",
  });
  await page.clock.runFor(1001);
  await expect(
    card.getByRole("button", { name: "Edit note", exact: true }),
  ).toHaveCount(0);

  await signIn(page, "Supervisor");
  await deliTab(page);
  await card.getByRole("button", { name: "Edit note", exact: true }).click();
  await page
    .getByRole("form", { name: "Edit note", exact: true })
    .getByLabel("Note", { exact: true })
    .fill("Supervisor verified fridge check");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card).toContainText("Supervisor verified fridge check");
  await expect(page.getByRole("status")).toHaveText("Saved changes.");
  await setLanguage(page, "fa");
  await expect(page.getByRole("status")).toHaveText("تغییرات ذخیره شد.");
  await setLanguage(page, "en");
  await expect(page.getByRole("status")).toHaveText("Saved changes.");
  const verified = await storedEntry(page, "Supervisor verified fridge check");
  expect(verified).toMatchObject({
    id: original.id,
    by: original.by,
    created_at: original.created_at,
    measurement: "3.6",
    measurement_unit: "°C",
  });
  const audit = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)!).activity.filter(
        (entry: { action: string }) =>
          entry.action === "notebook_entry_updated",
      ),
    storage,
  );
  expect(audit).toHaveLength(2);
  expect(audit[0]).toMatchObject({
    by: "Demo Supervisor",
    before: { text: "Afternoon check corrected" },
    after: { text: "Supervisor verified fridge check" },
    reversible: true,
  });
  expect(audit[1]).toMatchObject({
    by: "Demo Floor Worker",
    before: { text: "Afternoon fridge check" },
    after: { text: "Afternoon check corrected" },
    reversible: true,
  });
});

test("an already-open worker editor expires after five seconds and Cancel keeps the saved record intact", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await deliTab(page);
  await page.getByLabel("Note", { exact: true }).fill("Unchanged saved check");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const original = await storedEntry(page, "Unchanged saved check");
  await page
    .locator(`[data-notebook-entry="${original.id}"]`)
    .getByRole("button", { name: "Edit note", exact: true })
    .click();
  const editor = page.getByRole("form", { name: "Edit note", exact: true });
  await editor.getByLabel("Note", { exact: true }).fill("Unsaved correction");
  await page.clock.runFor(5001);
  await expect(
    editor.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await storedEntry(page, "Unchanged saved check")).toEqual(original);
  await expect(
    page.getByRole("form", { name: "Edit note", exact: true }),
  ).toHaveCount(0);
});
