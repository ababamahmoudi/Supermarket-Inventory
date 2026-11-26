import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";

test("Settings Data keeps one History destination while retaining the actual change attribution", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await page.goto("/#settings?group=data");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", { name: "History", exact: true }),
  ).toHaveCount(1);
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      state.activity.unshift({
        id: "fictional-data-settings-change",
        company_id: state.config.company.seed_key,
        branch: "all",
        action: "Update data settings",
        by: "Fictional settings manager",
        at: "2026-10-18T18:20:00.000Z",
        entity_type: "settings",
        entity_id: "data",
      });
    },
    undefined,
  );
  await page.reload();
  await expect(main.locator(".settings-changed-line")).toContainText(
    "Fictional settings manager",
  );
  const history = main.getByRole("link", { name: "History", exact: true });
  await expect(history).toHaveCount(1);
  await expect(history).toHaveAttribute("href", "#history");
  await history.click();
  await expect(page).toHaveURL(/#history$/);
  await expect(
    main.getByRole("heading", { level: 1, name: "History", exact: true }),
  ).toBeVisible();
});
