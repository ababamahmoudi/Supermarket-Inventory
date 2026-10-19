import { expect, type Locator, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import configuration from "../../seed/arzon-config.json" with { type: "json" };

export type DemoRole =
  | "Cashier"
  | "Floor Worker"
  | "Supervisor"
  | "cashier"
  | "floor_worker"
  | "supervisor";

export async function openShellAction(page: Page, name: string) {
  const direct = page.getByRole("button", { name, exact: true });
  if (await direct.isVisible()) return direct;
  const item = page.getByRole("menuitem", { name, exact: true });
  if (!(await item.isVisible()))
    await page.locator(".mobile-more-menu").click();
  await expect(item).toBeVisible();
  return item;
}

export async function signIn(page: Page, role: DemoRole) {
  const roleKey = {
    Cashier: "cashier",
    "Floor Worker": "floor_worker",
    Supervisor: "supervisor",
    cashier: "cashier",
    floor_worker: "floor_worker",
    supervisor: "supervisor",
  }[role];
  const account = demoSeed.demo_users.find((user) => user.role === roleKey)!;
  if (await page.locator(".topbar").count()) {
    await (await openShellAction(page, "Demo")).click();
    await page
      .getByRole("menuitem", {
        name: `Switch to ${account.name}`,
        exact: true,
      })
      .click();
  } else {
    await page.goto("/");
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page
      .getByLabel("Password", { exact: true })
      .fill(account.password ?? "demo1234");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".user-chip-copy strong")).toHaveText(account.name);
  // Initial file migration is asynchronous; fixtures must wait for the real
  // durable snapshot instead of racing its first localStorage write.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("supermarket-prototype-v1");
        if (!raw) return false;
        const saved = JSON.parse(raw);
        return Array.isArray(saved.products) && Array.isArray(saved.ledger);
      }),
    )
    .toBe(true);
}

export async function chooseOption(
  page: Page,
  control: Locator,
  value: string,
  label = value,
) {
  await expect(control).toHaveAttribute("role", "combobox");
  await control.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

export async function setBranch(page: Page, branch: string) {
  await chooseOption(
    page,
    page.locator(".topbar").getByLabel("Branch", { exact: true }),
    branch,
    branch === "all"
      ? "All branches"
      : (configuration.branches.find((location) => location.id === branch)
          ?.name ?? branch),
  );
}

export async function setLanguage(page: Page, language: "en" | "fa") {
  if ((await page.locator("html").getAttribute("lang")) === language) return;
  await (
    await openShellAction(
      page,
      language === "fa" ? "Switch to Persian" : "تغییر به انگلیسی",
    )
  ).click();
}

export async function resetDemo(page: Page) {
  await (await openShellAction(page, "Demo")).click();
  await page.getByRole("menuitem", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Reset demo", exact: true })
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
}

export async function visitPage(page: Page, label: string) {
  if (await page.evaluate(() => window.innerWidth <= 760))
    await page.locator("#menu-toggle").click();
  const link = page
    .getByRole("navigation", { name: "Pages", exact: true })
    .getByRole("link", { name: label, exact: true, includeHidden: true });
  if (!(await link.isVisible())) {
    const section = link.locator(
      'xpath=ancestor::div[contains(@class, "nav-section")][1]',
    );
    const groupToggle = section.getByRole("button");
    if (await groupToggle.count()) await groupToggle.first().click();
  }
  await expect(link).toBeVisible();
  await link.click();
}

export const invoiceImage = {
  name: "fictional-supplier-invoice.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUjYAAAAASUVORK5CYII=",
    "base64",
  ),
};

export async function openInvoiceUpload(page: Page) {
  const input = page.getByLabel("Upload a PDF or photo", { exact: true });
  // A retained unread original now has a real list row. Start the upload
  // workspace through its action rather than replacing a browser record.
  if ((await input.count()) === 0) {
    await page
      .getByRole("button", { name: "New invoice", exact: true })
      .click();
  }
  await expect(input).toBeAttached();
  return input;
}

export async function uploadInvoice(page: Page) {
  await (await openInvoiceUpload(page)).setInputFiles(invoiceImage);
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible({ timeout: 8000 });
}
