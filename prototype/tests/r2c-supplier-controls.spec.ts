import { expect, test } from "@playwright/test";
import { appearance, inspect } from "../scripts/c5-browser-proof.mjs";
import { signIn } from "./helpers";

test.setTimeout(90_000);

for (const variant of ["en-light", "fa-light", "en-dark"] as const) {
  test(`supplier and payables controls retain the full rendered contract in ${variant}`, async ({
    page,
  }, info) => {
    await signIn(page, "Manager");
    await appearance(page, variant);
    const reports = [];
    for (const route of [
      "#suppliers",
      "#suppliers?name=Corner%20Spice%20Co.",
      "#payables",
      "#payables?supplier=Fresh%20Valley%20Foods",
    ]) {
      await page.goto(`/${route}`);
      await expect(page.locator("main > .r2c-screen")).toBeVisible();
      const report = await inspect(page, route, variant, "manager");
      reports.push(report);
      expect(report.failures, `${route}: full C5 contract`).toEqual([]);
    }
    await page.goto("/#suppliers?name=Corner%20Spice%20Co.");
    await page.getByRole("button", { name: /^(Edit|ویرایش)$/ }).click();
    await expect(page.locator("dialog.supplier-editor-dialog")).toBeVisible();
    const dialogReport = await inspect(
      page,
      "supplier-editor",
      variant,
      "manager",
    );
    reports.push(dialogReport);
    expect(dialogReport.failures).toEqual([]);
    await info.attach("Supplier/payables rendered controls", {
      body: JSON.stringify(reports, null, 2),
      contentType: "application/json",
    });
  });
}

test("the R2c audit rejects a short control, a missing section and a copied class", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await page.goto("/#suppliers?name=Corner%20Spice%20Co.");
  await expect(page.locator(".supplier-contact-card")).toBeVisible();
  await page
    .locator(".supplier-detail-header .button")
    .first()
    .evaluate((button) => {
      button.setAttribute(
        "style",
        "height:40px!important;min-height:40px!important;max-height:40px!important",
      );
    });
  expect(
    (await inspect(page, "short-control", "en-light", "manager")).failures.some(
      (failure) => failure.startsWith("R2c control height:"),
    ),
  ).toBe(true);
  await page.reload();
  await page
    .locator(".supplier-contact-card")
    .evaluate((card) => card.remove());
  expect(
    (await inspect(page, "missing-section", "en-light", "manager")).failures,
  ).toContain("Invalid R2c screen composition: suppliers");
  await page.reload();
  await expect(page.locator(".supplier-contact-card")).toBeVisible();
  await page.locator("main").evaluate((main) => {
    const counterfeit = document.createElement("div");
    counterfeit.className = "r2c-screen";
    counterfeit.dataset.r2cScreen = "suppliers";
    counterfeit.innerHTML = '<button type="button">Copied opt-in</button>';
    main.append(counterfeit);
  });
  expect(
    (await inspect(page, "copied-class", "en-light", "manager")).failures,
  ).toContain("Invalid R2c screen composition: suppliers");
});
