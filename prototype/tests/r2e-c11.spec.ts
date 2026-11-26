import { expect, test } from "@playwright/test";
import { setBranch, signIn } from "./helpers";

test("C11 six quick filters combine and persist with scoped expiry badges", async ({
  page,
}) => {
  const { runCanonicalBusinessFixture } = await import("./business-fixture");
  await signIn(page, "Manager");
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      const product = state.products.find((row) => row.code === "0009")!;
      const now = new Date();
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: state.config.company.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      product.date_tracking = true;
      product.date_reminder_days = 5;
      product.price_provenance = {
        "Branch 1": {
          invoice_number: "",
          calculated_price: "2.99",
          changed_price: "2.99",
          changed_at: now.toISOString(),
        },
      };
      state.expiry = [
        {
          id: "fictional-r2e-soon",
          company_id: product.company_id,
          branch: "Branch 1",
          product_code: product.code,
          date: today,
          expires_in_days: 0,
          status: "active",
        },
      ];
      const invoice = state.invoices!.find((row) =>
        row.lines.some((line) => line.product_code === product.code),
      )!;
      invoice.branch = "Branch 1";
      invoice.received_at = now.toISOString();
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(
    page
      .locator(".lookup-price-context")
      .getByText("Expiring soon", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".lookup-result-row")
      .getByText("Expiring soon", { exact: true }),
  ).toBeVisible();
  for (const name of [
    "On offer",
    "Expiring soon",
    "Arrived today",
    "Price changed recently",
    "Taxable",
  ]) {
    const chip = page.getByRole("button", { name, exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".lookup-result-row")).toHaveCount(1);
  }
  await page.reload();
  for (const name of [
    "On offer",
    "Expiring soon",
    "Arrived today",
    "Price changed recently",
    "Taxable",
  ])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  for (const name of [
    "On offer",
    "Expiring soon",
    "Arrived today",
    "Price changed recently",
    "Taxable",
    "Not approved here yet",
  ])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
});
