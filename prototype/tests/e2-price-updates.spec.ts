import { expect, test } from "@playwright/test";
import { signIn, setBranch, setLanguage } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

import { route, applyBlackTeaAcrossStores } from "./e2-browser-flow";

test("Black Tea: real approval, scoped notification, Cashier pill, physical print confirmation and per-store progress", async ({
  page,
}) => {
  const { task, product } = await applyBlackTeaAcrossStores(page);
  await signIn(page, "Cashier");
  await setBranch(page, "Branch 2");
  await route(page, `lookup?search=${product.code}`);
  const search = page
    .locator(".lookup-page")
    .getByRole("combobox", { name: "Search products", exact: true });
  await search.fill(product.code);
  await search.press("Enter");
  await expect(page.locator(".lookup-detail")).toContainText("Price changed");
  await signIn(page, "Branch Supervisor");
  await setBranch(page, "Branch 2");
  await route(page, `price-update?id=${encodeURIComponent(task.id)}`);
  // Ali's rule: only Seen and Done, each recorded with who and when.
  const status = page.locator(".price-update-status-card");
  await expect(status).toContainText("Not seen yet");
  await expect(page.locator("main").getByRole("checkbox")).toHaveCount(0);
  await status
    .getByRole("button", { name: "Mark as seen", exact: true })
    .click();
  await expect(status).toContainText("Demo Richmond Hill Supervisor");
  await expect(
    status.getByRole("button", { name: "Mark as seen", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Print label now", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Did the labels print correctly?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "No", exact: true }).click();
  await page
    .getByRole("button", { name: "Print label now", exact: true })
    .click();
  await page
    .getByRole("dialog", {
      name: "Did the labels print correctly?",
      exact: true,
    })
    .getByRole("button", { name: "Yes", exact: true })
    .click();
  await expect(page.locator(".price-update-label-tools")).toContainText(
    "printed by",
  );
  await page.getByRole("button", { name: "Mark as done", exact: true }).click();
  await expect
    .poll(async () => {
      const state = await readCanonicalBusinessEvidence(page);
      return state.price_update_tasks?.find((row) => row.id === task.id)
        ?.status;
    })
    .toBe("done");
  await expect(status.locator("li.is-complete")).toHaveCount(2);
  await expect(
    page.locator(".price-update-history-table tbody tr").first(),
  ).toContainText("Latest");
  await signIn(page, "Cashier");
  await setBranch(page, "Branch 2");
  await route(page, `lookup?search=${product.code}`);
  await page
    .locator(".lookup-page")
    .getByRole("combobox", { name: "Search products", exact: true })
    .press("Enter");
  await expect(page.locator(".lookup-detail")).toBeVisible();
  await expect(page.locator(".lookup-detail")).not.toContainText(
    "Price changed",
  );
  await signIn(page, "Manager");
  await setBranch(page, "all");
  await route(page, "price-updates?view=progress");
  await expect(page.locator("main")).toContainText("Richmond Hill");
  await expect(page.locator("main")).toContainText("Done");
  const final = await readCanonicalBusinessEvidence(page);
  const saved = final.price_update_tasks!.find((row) => row.id === task.id)!;
  expect(saved.completed_by_user_id).toBe("demo-person-rh-supervisor");
  expect(saved.seen?.by_user_id).toBe("demo-person-rh-supervisor");
  expect(saved.label_printed?.print_id).toBeTruthy();
  expect(saved.completed_at).toBeTruthy();
});

test("Floor Worker and Warehouse cannot mark another store's task seen or acquire it by a direct link", async ({
  page,
}) => {
  const { task } = await applyBlackTeaAcrossStores(page);
  await signIn(page, "Floor Worker");
  await route(page, `price-update?id=${encodeURIComponent(task.id)}`);
  await expect(page.locator("main")).toContainText(
    "This task is no longer available",
  );
  expect(
    (await readCanonicalBusinessEvidence(page)).price_update_tasks?.find(
      (row) => row.id === task.id,
    )?.seen,
  ).toBeUndefined();
  await signIn(page, "wh-floor");
  await route(page, "price-updates");
  await expect(page.locator("main")).toContainText(
    "No price updates match these filters.",
  );
  const state = await readCanonicalBusinessEvidence(page);
  expect(
    state.price_update_tasks?.filter((row) => row.branch === "Warehouse"),
  ).toEqual([]);
});

for (const language of ["en", "fa"] as const) {
  test(`new price-update screens stay inside their cards at 390px and 430px: ${language}`, async ({
    page,
  }) => {
    const { task, product } = await applyBlackTeaAcrossStores(page);
    await signIn(page, "Branch Supervisor");
    await setBranch(page, "Branch 2");
    await setLanguage(page, language);
    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "price-updates",
        `price-update?id=${encodeURIComponent(task.id)}`,
      ]) {
        await route(page, path);
        await expect(
          page.locator(".price-updates-page,.price-update-detail"),
        ).toBeVisible();
        const change = page.locator(".price-update-change").first();
        const oldPrice = await change.locator("del").boundingBox();
        const newPrice = await change.locator(":scope > strong").boundingBox();
        expect(oldPrice).not.toBeNull();
        expect(newPrice).not.toBeNull();
        expect(oldPrice!.x + oldPrice!.width).toBeLessThan(newPrice!.x);
        if (path.startsWith("price-update?"))
          await expect(
            page.locator(".breadcrumbs [aria-current=page] bdi"),
          ).toHaveText(
            language === "fa"
              ? product.name_fa || product.name_en
              : product.name_en,
          );

        expect(
          await page.evaluate(() => {
            const elements = [
              document.documentElement,
              document.body,
              ...document.querySelectorAll<HTMLElement>(
                "main .card,main .price-updates-row,main .price-update-status-steps > li",
              ),
            ];
            return elements
              .filter((node) => node.scrollWidth > node.clientWidth + 2)
              .map((node) => ({
                tag: node.tagName,
                cls: node.className,
                scroll: node.scrollWidth,
                width: node.clientWidth,
              }));
          }),
        ).toEqual([]);
      }
    }
  });
}
