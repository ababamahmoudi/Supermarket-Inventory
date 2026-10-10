import { expect, test, type Page } from "@playwright/test";
import { setBranch, signIn } from "./helpers";
import {
  appearance,
  button,
  choose,
  field,
  fieldContrast,
  inspect,
  today,
  type C5Inspection,
} from "../scripts/c5-browser-proof.mjs";

test.setTimeout(180000);
test.use({ actionTimeout: 10000 });

async function assertContract(page: Page, scene: string, variant: string) {
  const proof = await inspect(page, scene, variant);
  expect(
    proof.buttons.length,
    `${scene}: real controls measured`,
  ).toBeGreaterThan(2);
  expect(
    proof.topbar.length,
    `${scene}: all topbar controls measured`,
  ).toBeGreaterThanOrEqual(7);
  expect(proof.failures, scene).toEqual([]);
  return proof;
}

for (const variant of ["en-light", "en-dark", "fa-light"] as const) {
  test(`C5 Waiting for credit is amber for different retained return states (${variant})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await page.goto("/#return?id=demo-return-1");
    await button(page.locator(".return-header-card"), "Record pickup").click();
    const pickup = page.locator(".return-action-card");
    await pickup.getByLabel(/Actual pickup units$/).fill("3");
    await field(pickup, "Supplier representative name").fill("Demo Driver");
    await field(pickup, "Signed paper pickup slip reference").fill(
      "SIGNED-C5-COLOR-001",
    );
    await button(pickup, "Record pickup").click();
    await page.goto("/#returns");
    await appearance(page, variant);
    const proof = await assertContract(
      page,
      "Waiting for credit across return states",
      variant,
    );
    const credit = proof.statuses.filter(
      (status) => status.returnStatus === "waiting_for_credit",
    );
    expect(credit.length).toBeGreaterThanOrEqual(2);
    expect(
      credit.every((status) => status.classes.split(" ").includes("pending")),
    ).toBe(true);
    expect(
      new Set(credit.map((status) => `${status.color}/${status.background}`))
        .size,
    ).toBe(1);
  });

  test(`C5 rounded text actions, intrinsic table actions and uniform topbar (${variant})`, async ({
    page,
  }, info) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await appearance(page, variant);
    const proofs: C5Inspection[] = [];
    for (const route of [
      "invoices",
      "products",
      "alerts",
      "returns",
      "expiry",
      "offers",
      "approvals",
    ]) {
      await page.goto(`/#${route}`);
      proofs.push(await assertContract(page, route, variant));
    }
    await info.attach(`c5-controls-${variant}.json`, {
      body: JSON.stringify(proofs, null, 2),
      contentType: "application/json",
    });
    const statuses = proofs.flatMap((proof) => proof.statuses);
    for (const label of [...new Set(statuses.map((status) => status.label))]) {
      const colors = statuses
        .filter((status) => status.label === label)
        .map((status) => `${status.color}/${status.background}`);
      expect(new Set(colors).size, `Same visible status: ${label}`).toBe(1);
    }
    const language = page.getByRole("button", {
      name: variant === "fa-light" ? "تغییر به انگلیسی" : "Switch to Persian",
      exact: true,
    });
    await expect(language).toHaveText(variant === "fa-light" ? "EN" : "فا");
    await expect(page.locator(".topbar .language-toggle")).toHaveCount(1);
    await language.click();
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      variant === "fa-light" ? "en" : "fa",
    );
  });

  test(`C5 posted invoice, whole-page viewer, correction contrast and return policy (${variant})`, async ({
    page,
  }, info) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await appearance(page, variant);
    await page.goto("/#invoices?id=a2-fixture%3AFV-20390");
    const document = page.locator(".posted-invoice-document");
    await expect(document).toContainText("FV-20390");
    const title = page.locator(".posted-invoice-title");
    expect(
      await title.evaluate((element) => {
        const heading = element.querySelector("h2")!.getBoundingClientRect();
        const badge = element.querySelector(".badge")!.getBoundingClientRect();
        return Math.abs(
          heading.top + heading.height / 2 - badge.top - badge.height / 2,
        );
      }),
    ).toBeLessThanOrEqual(2);
    const totals = page.locator(".posted-invoice-totals > div");
    await expect(totals).toHaveCount(5);
    const totalRows = await totals.evaluateAll((rows) =>
      rows.map((row) => {
        const term = row.querySelector("dt")!.getBoundingClientRect();
        const amount = row.querySelector("dd")!.getBoundingClientRect();
        return {
          sameLine: Math.abs(term.top - amount.top) <= 2,
          gap: Math.min(
            Math.abs(amount.left - term.right),
            Math.abs(term.left - amount.right),
          ),
        };
      }),
    );
    expect(totalRows.every((row) => row.sameLine && row.gap <= 40)).toBe(true);
    const media = page.locator(".invoice-original-media");
    const image = media.locator("img");
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(media).toHaveAttribute("data-fit", "page");
    const fits = () =>
      media.evaluate((element) => {
        const child = element
          .querySelector("img,canvas")!
          .getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return (
          child.width <= element.clientWidth + 2 &&
          child.height <= element.clientHeight + 2 &&
          child.left >= rect.left - 2 &&
          child.right <= rect.right + 2
        );
      });
    await expect.poll(fits).toBe(true);
    const toolbar = page.locator(".invoice-original-controls");
    await button(toolbar, "Fit width", "اندازه عرض").click();
    await expect(media).toHaveAttribute("data-fit", "width");
    await expect(media).toHaveAttribute("data-zoom", "1");
    const out = button(toolbar, "Zoom out", "کوچک‌نمایی");
    for (let count = 0; count < 3; count++) await out.click();
    await expect(media).toHaveAttribute("data-zoom", "0.25");
    await expect(out).toBeDisabled();
    const zoomIn = button(toolbar, "Zoom in", "بزرگ‌نمایی");
    for (let count = 0; count < 15; count++) await zoomIn.click();
    await expect(media).toHaveAttribute("data-zoom", "4");
    await expect(zoomIn).toBeDisabled();
    await button(toolbar, "Fit page", "اندازه صفحه").click();
    await expect(media).toHaveAttribute("data-fit", "page");
    await expect.poll(fits).toBe(true);
    const posted = await assertContract(page, "Posted invoice", variant);
    await button(page, "Correct invoice", "اصلاح فاکتور").click();
    const correction = page.locator(".invoice-correction-dialog");
    await expect(correction).toBeVisible();
    const contrast = await fieldContrast(page, ".invoice-correction-dialog");
    expect(contrast.length).toBeGreaterThan(5);
    for (const control of contrast) {
      expect(
        parseFloat(control.borderWidth),
        control.label,
      ).toBeGreaterThanOrEqual(1);
      expect(control.adjacentContrast, control.label).toBeGreaterThanOrEqual(3);
      expect(control.interiorContrast, control.label).toBeGreaterThanOrEqual(3);
    }
    await assertContract(page, "Correct invoice", variant);
    await page.keyboard.press("Escape");
    await page.goto("/#return?id=demo-return-1");
    await button(page, "Return policy", "سیاست مرجوعی").click();
    const policy = page.locator(".return-policy-dialog");
    await expect(policy).toBeVisible();
    await expect(policy.locator("ol > li")).toHaveCount(5);
    await expect(policy.locator(".card")).toHaveCount(0);
    if (info.project.name === "desktop")
      expect(
        await policy.evaluate(
          (element) => element.getBoundingClientRect().width,
        ),
      ).toBeGreaterThanOrEqual(620);
    await expect(
      button(policy, "Download full policy", "دانلود سیاست کامل"),
    ).toHaveClass(/button-secondary/);
    await expect(button(policy, "Close", "بستن")).toHaveClass(/button-primary/);
    const policyProof = await assertContract(page, "Return policy", variant);
    await info.attach(`c5-documents-${variant}.json`, {
      body: JSON.stringify({ posted, policy: policyProof, contrast }, null, 2),
      contentType: "application/json",
    });
  });
}

test("C5 shelf quick-add accepts Enter, resets focus, pins new row and undoes without money changes", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#expiry");
  const quick = page.locator(".date-quick-card");
  const product = field(quick, "Product");
  await today(page, quick);
  await button(quick, "More").click();
  await field(quick, "Lot (optional)").fill("C5-SHELF-ENTER");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
  await product.fill("0001");
  await product.press("Enter");
  await expect(product).toHaveValue("");
  await expect(product).toBeFocused();
  const first = page.locator(".expiry-table tbody tr").first();
  await expect(first).toHaveAttribute("data-new-date", "true");
  await expect(first).toContainText("C5-SHELF-ENTER");
  await expect(field(quick, "Lot (optional)")).toHaveValue("");
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  const toast = page.getByTestId("undo-toast").filter({ hasText: "Add date" });
  await button(toast, "Undo").click();
  await expect(
    page
      .locator(".expiry-table tbody tr")
      .filter({ hasText: "C5-SHELF-ENTER" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Add date", exact: true }),
  ).toHaveCount(0);
});

for (const role of ["Supervisor", "Floor Worker"] as const) {
  test(`C5 Lookup Dates supports inline entry, automatic On and scoped Undo (${role})`, async ({
    page,
  }) => {
    await signIn(page, role);
    if (role === "Supervisor") await setBranch(page, "Branch 1");
    await page.goto("/#lookup");
    await field(page, "Search products").fill("0001");
    const dates = page.locator(".product-dates-section");
    await expect(dates).toBeVisible();
    const tracking = dates.getByRole("switch", {
      name: "Date tracking",
      exact: true,
    });
    if ((await tracking.getAttribute("aria-checked")) === "true")
      await tracking.click();
    await expect(tracking).toHaveAttribute("aria-checked", "false");
    const openBefore = await dates
      .locator(".product-open-dates")
      .allTextContents();
    const form = dates.locator(".date-quick-add-inline");
    await today(page, form);
    await button(form, "Add").click();
    await expect(tracking).toHaveAttribute("aria-checked", "true");
    await expect(form.getByRole("status")).toContainText(
      "Date added. Date tracking turned on.",
    );
    await expect(
      page.getByRole("dialog", { name: "Add date", exact: true }),
    ).toHaveCount(0);
    const toast = page
      .getByTestId("undo-toast")
      .filter({ hasText: "Add date" });
    await button(toast, "Undo").click();
    await expect(tracking).toHaveAttribute("aria-checked", "false");
    await expect
      .poll(() => dates.locator(".product-open-dates").allTextContents())
      .toEqual(openBefore);
  });
}

test("C5 repeated current offer is idempotent, stop moves retained record to Past and Undo restores Current", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#offers");
  const existing = page.locator(
    '.current-offers-table tr[data-product-code="0003"]',
  );
  await expect(existing).toHaveCount(1);
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
  await button(page, "Create offer").click();
  const dialog = page.getByRole("dialog", {
    name: "Create offer",
    exact: true,
  });
  await choose(page, field(dialog, "Product"), /Sour Cherry Juice 1 L.*0003/);
  await button(dialog, "Create offer").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "This offer already exists.",
  );
  const repeated = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
  expect(repeated.offers).toEqual(before.offers);
  expect(repeated.activity).toEqual(before.activity);
  await button(existing, "Stop offer").click();
  const stop = page.getByRole("dialog", { name: "Stop offer", exact: true });
  await button(stop, "Stop offer").click();
  await expect(existing).toHaveCount(0);
  await page.getByRole("tab", { name: "Past offers", exact: true }).click();
  await expect(
    page.locator('.past-offers-table tr[data-product-code="0003"]'),
  ).toContainText("Stopped");
  const toast = page
    .getByTestId("undo-toast")
    .filter({ hasText: "Stop offer" });
  await button(toast, "Undo").click();
  await expect(
    page.locator('.past-offers-table tr[data-product-code="0003"]'),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Current offers", exact: true }).click();
  await expect(existing).toHaveCount(1);
});
