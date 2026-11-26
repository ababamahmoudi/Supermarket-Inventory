import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setBranch } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { createPriceUpdates } from "./pr29-price-updates-helpers";

test.setTimeout(120_000);

const mm = (px: number) => (px * 25.4) / 96;

async function counts(page: Page) {
  const nav = page.locator('nav a[href="#price-updates"] .nav-count');
  const sidebar = (await nav.count())
    ? Number((await nav.first().innerText()).trim())
    : 0;
  const tab = await page
    .locator("main")
    .getByRole("tab", { name: /^Pending/ })
    .innerText();
  return { sidebar, pending: Number(tab.replace(/\D+/g, "") || 0) };
}

async function openList(page: Page) {
  await page.goto("/#price-updates");
  await expect(page.locator(".price-updates-row").first()).toBeVisible();
}

test.describe("PR 29 Price updates", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Widths are set per test.");
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
  });

  test("one label prints on one A4 page in the chosen slot with 10 mm margins", async ({
    page,
  }) => {
    await createPriceUpdates(page, [{ code: "0004", price: "7.79" }]);
    await openList(page);
    for (const slot of [1, 2]) {
      await page.locator(".price-updates-print").first().click();
      const choice = page.getByRole("dialog", { name: "Print label" });
      await expect(choice).toContainText("60 × 40 mm label");
      await expect(
        choice.getByRole("radio", { name: /^Print now/ }),
      ).toBeChecked();
      await chooseOption(
        page,
        choice.getByRole("combobox", { name: "Starting slot" }),
        String(slot),
      );
      await choice
        .getByRole("button", { name: "Print now", exact: true })
        .click();
      const confirm = page.getByRole("dialog", {
        name: "Did the labels print correctly?",
      });
      await expect(confirm).toBeVisible();
      const output = page.locator(".price-task-print-output");
      await expect(output.locator(".print-sheet")).toHaveCount(1);
      await expect(output.locator(".shelf-label")).toHaveCount(1);
      await page.emulateMedia({ media: "print" });
      const box = await output.evaluate((root) => {
        const sheet = root
          .querySelector(".print-sheet")!
          .getBoundingClientRect();
        const label = root
          .querySelector(".shelf-label")!
          .getBoundingClientRect();
        return {
          left: label.left - sheet.left,
          top: label.top - sheet.top,
          width: label.width,
          height: label.height,
        };
      });
      expect(Math.abs(mm(box.width) - 60)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(mm(box.height) - 40)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(mm(box.top) - 10)).toBeLessThanOrEqual(0.5);
      if (slot === 1)
        expect(Math.abs(mm(box.left) - 10)).toBeLessThanOrEqual(0.5);
      else {
        // Slot 2 is the next place on the first row of the same sheet.
        expect(mm(box.left)).toBeGreaterThanOrEqual(70 - 0.5);
        expect(mm(box.left) + 60).toBeLessThanOrEqual(200 + 0.5);
      }
      const pdf = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
      });
      expect(
        (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length,
      ).toBe(1);
      await page.emulateMedia({ media: "screen" });
      await confirm.getByRole("button", { name: "No", exact: true }).click();
      await expect(confirm).toBeHidden();
    }
  });

  test("Add to queue adds exactly one waitlist entry, then counts it up", async ({
    page,
  }) => {
    await createPriceUpdates(page, [{ code: "0004", price: "7.79" }]);
    await openList(page);
    const before =
      (await readCanonicalBusinessEvidence(page)).label_waitlist ?? [];
    const matching = (rows: typeof before) =>
      rows.filter(
        (row) => row.branch === "Branch 1" && row.product_code === "0004",
      );
    for (const copies of [1, 2]) {
      await page.locator(".price-updates-print").first().click();
      const choice = page.getByRole("dialog", { name: "Print label" });
      await choice.getByRole("radio", { name: /^Add to print queue/ }).click();
      await choice
        .getByRole("button", { name: "Add to queue", exact: true })
        .click();
      await expect(choice).toBeHidden();
      await expect(page.locator(".ui-toast")).toContainText(
        "Added 1 label to the print queue in Labels",
      );
      const after =
        (await readCanonicalBusinessEvidence(page)).label_waitlist ?? [];
      expect(matching(after)).toHaveLength(1);
      expect(matching(after)[0].copies).toBe(
        (matching(before)[0]?.copies ?? 0) + copies,
      );
    }
  });

  test("Seen and Done have their own columns and never overlap the product", async ({
    page,
  }) => {
    await createPriceUpdates(page);
    await openList(page);
    await page
      .locator(".price-updates-row")
      .first()
      .locator(".price-update-open")
      .click();
    await page
      .getByRole("button", { name: "Mark as seen", exact: true })
      .click();
    await expect(page.locator(".price-update-status-card")).toContainText(
      "Demo Manager",
    );
    await openList(page);
    for (const width of [1440, 1000, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const row = page
        .locator(".price-updates-row")
        .filter({ hasText: "Demo Manager" })
        .filter({ has: page.locator(".price-updates-step.is-complete") })
        .first();
      await expect(row).toBeVisible();
      // Name plus 24-hour time today (YYYY-MM-DD on other days).
      await expect(
        row
          .locator(".price-updates-step.is-complete")
          .filter({ visible: true })
          .first(),
      ).toHaveText(
        /Demo Manager\s*\d{2}:\d{2}$|Demo Manager\s*\d{4}-\d{2}-\d{2}$/,
      );
      const overlap = await page
        .locator(".price-updates-row")
        .evaluateAll((rows) =>
          rows.flatMap((row) => {
            const product = row
              .querySelector(".price-updates-product")!
              .getBoundingClientRect();
            return Array.from(row.children)
              .filter(
                (cell) => !cell.classList.contains("price-updates-product"),
              )
              .map((cell) => cell.getBoundingClientRect())
              .filter((cell) => cell.width && cell.height)
              .filter(
                (cell) =>
                  cell.left < product.right - 0.5 &&
                  cell.right > product.left + 0.5 &&
                  cell.top < product.bottom - 0.5 &&
                  cell.bottom > product.top + 0.5,
              ).length;
          }),
        );
      expect(
        overlap.every((count) => count === 0),
        `overlap at ${width}`,
      ).toBe(true);
      if (width === 1440) {
        await expect(page.locator(".price-updates-table-header")).toContainText(
          /Product\s*Price\s*Seen\s*Done\s*Action/,
        );
      }
    }
  });

  test("Select all takes only the filtered rows; bulk Done records who and when and reports skips", async ({
    page,
  }) => {
    await createPriceUpdates(page);
    await setBranch(page, "all");
    await openList(page);
    const all = await page.locator(".price-updates-row").count();
    expect(all).toBe(9);
    await chooseOption(
      page,
      page
        .locator("main")
        .getByRole("combobox", { name: "Location", exact: true }),
      "Branch 2",
      "Richmond Hill",
    );
    await expect(page.locator(".price-updates-row")).toHaveCount(3);
    await page
      .getByRole("checkbox", { name: "Select all on this page" })
      .click();
    const bar = page.locator(".price-updates-bulk-bar");
    await expect(bar).toContainText("3 selected");
    await expect(
      bar.getByRole("button", { name: "Mark as seen" }),
    ).toBeVisible();
    await expect(
      bar.getByRole("button", { name: "Print labels" }),
    ).toBeVisible();
    await bar.getByRole("button", { name: "Clear" }).click();
    await expect(bar).toBeHidden();
    // One of the three is already seen: Mark as seen skips it.
    await page
      .locator(".price-updates-row")
      .first()
      .locator(".price-update-open")
      .click();
    await page
      .getByRole("button", { name: "Mark as seen", exact: true })
      .click();
    await openList(page);
    await chooseOption(
      page,
      page
        .locator("main")
        .getByRole("combobox", { name: "Location", exact: true }),
      "Branch 2",
      "Richmond Hill",
    );
    await page
      .getByRole("checkbox", { name: "Select all on this page" })
      .click();
    await bar.getByRole("button", { name: "Mark as seen" }).click();
    await expect(page.locator(".ui-toast")).toHaveText(
      "Marked 2 as seen · 1 skipped",
    );
    await page
      .getByRole("checkbox", { name: "Select all on this page" })
      .click();
    await bar.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.locator(".ui-toast")).toHaveText("Marked 3 as done");
    const state = await readCanonicalBusinessEvidence(page);
    const done = (state.price_update_tasks ?? []).filter(
      (row) => row.status === "done",
    );
    expect(done).toHaveLength(3);
    expect(done.every((row) => row.branch === "Branch 2")).toBe(true);
    for (const row of done) {
      expect(row.completed_by).toBe("Demo Manager");
      expect(row.completed_at).toBeTruthy();
    }
    expect(
      (state.price_update_tasks ?? []).filter(
        (row) => row.status === "pending",
      ),
    ).toHaveLength(6);
  });

  test("Done tab opens on the last 30 days, dates change the list, CSV matches the filter", async ({
    page,
  }) => {
    await createPriceUpdates(page);
    await openList(page);
    await page
      .getByRole("checkbox", { name: "Select all on this page" })
      .click();
    await page
      .locator(".price-updates-bulk-bar")
      .getByRole("button", { name: "Mark as done" })
      .click();
    await expect(page.locator(".ui-toast")).toHaveText("Marked 3 as done");
    await page.locator("main").getByRole("tab", { name: /^Done/ }).click();
    const range = page.getByRole("button", { name: "Date range" });
    await expect(range).toHaveText("Last 30 days");
    await expect(page.locator("main")).toContainText(
      "Done updates are kept forever.",
    );
    await expect(page.locator(".price-updates-row")).toHaveCount(3);
    // A range before today hides today's updates.
    await range.click();
    const dates = page.getByRole("dialog", { name: "Date range" });
    const now = new Date();
    const previous = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const month = previous.toISOString().slice(0, 7);
    for (const [label, day] of [
      ["From", "01"],
      ["To", "02"],
    ] as const) {
      await dates.getByRole("button", { name: label, exact: true }).click();
      await page.getByRole("button", { name: "Previous month" }).click();
      await page
        .getByRole("button", { name: `${month}-${day}`, exact: true })
        .click();
    }
    await dates.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".price-updates-row")).toHaveCount(0);
    await range.click();
    await dates.getByRole("button", { name: "Last 30 days" }).click();
    await expect(page.locator(".price-updates-row")).toHaveCount(3);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await readFile((await (await download).path())!, "utf8");
    const lines = csv.trim().split(/\r\n/);
    expect(lines[0]).toBe(
      "Product,Code,Old price,New price,Location,Seen by,Seen at,Done by,Done at",
    );
    expect(lines).toHaveLength(4);
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      expect(cells[2]).toMatch(/^\d+\.\d{2}$/);
      expect(cells[3]).toMatch(/^\d+\.\d{2}$/);
      expect(cells[7]).toBe("Demo Manager");
      expect(cells[8]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }
  });

  test("the sidebar count always equals the Pending tab", async ({ page }) => {
    await createPriceUpdates(page);
    await openList(page);
    await expect
      .poll(async () => counts(page))
      .toEqual({ sidebar: 3, pending: 3 });
    await page
      .locator(".price-updates-row")
      .first()
      .locator(".price-update-open")
      .click();
    await page
      .getByRole("button", { name: "Mark as done", exact: true })
      .click();
    await openList(page);
    await expect
      .poll(async () => counts(page))
      .toEqual({ sidebar: 2, pending: 2 });
    await setBranch(page, "all");
    await openList(page);
    await expect
      .poll(async () => counts(page))
      .toEqual({ sidebar: 8, pending: 8 });
    await setBranch(page, "Branch 3");
    await openList(page);
    await expect
      .poll(async () => counts(page))
      .toEqual({ sidebar: 3, pending: 3 });
  });
});
