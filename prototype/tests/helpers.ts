import { createHash } from "node:crypto";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, type Locator, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import configuration from "../../seed/arzon-config.json" with { type: "json" };
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1";

export type DemoRole =
  | "Cashier"
  | "Floor Worker"
  | "Supervisor"
  | "cashier"
  | "floor_worker"
  | "supervisor"
  | "Owner"
  | "Manager"
  | "Branch Supervisor"
  | "owner"
  | "manager"
  | "branch_supervisor"
  | "ny-floor"
  | "wh-floor";

/** Alerts are one list; a row's details open when you click it. */
export async function openAlert(scope: Page | Locator, name?: string | RegExp) {
  const rows = scope.locator(".alert-row");
  const row = name ? rows.filter({ hasText: name }).first() : rows.first();
  const head = row.locator('.alert-row-head[aria-expanded="false"]');
  if (await head.count()) await head.click();
}

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
  // Retained Supervisor cases exercise the same configured Manager person;
  // the legacy name is not an authority role or a fabricated seventh account.
  const username = {
    Cashier: "cashier",
    "Floor Worker": "ny-floor",
    Supervisor: "manager",
    cashier: "cashier",
    floor_worker: "ny-floor",
    supervisor: "manager",
    Owner: "owner",
    Manager: "manager",
    "Branch Supervisor": "rh-supervisor",
    owner: "owner",
    manager: "manager",
    branch_supervisor: "rh-supervisor",
    "ny-floor": "ny-floor",
    "wh-floor": "wh-floor",
  }[role];
  const account = demoSeed.demo_users.find(
    (user) => user.username === username,
  );
  if (!account)
    throw new Error(`Configured Demo person is missing: ${username}`);
  if (await page.locator(".topbar").isVisible()) {
    const fa = (await page.locator("html").getAttribute("lang")) === "fa";
    await (await openShellAction(page, fa ? "دمو" : "Demo")).click();
    await page
      .getByRole("menuitem", {
        name: fa
          ? `تغییر به ${account.name_fa}`
          : `Switch to ${account.name_en}`,
        exact: true,
      })
      .click();
  } else {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: /^(Sign in|ورود)$/ });
    await expect(heading).toBeVisible();
    const fa = (await heading.innerText()) === "ورود";
    await page
      .getByLabel(fa ? "نام کاربری" : "Username", { exact: true })
      .fill(account.username);
    await page
      .getByLabel(fa ? "گذرواژه" : "Password", { exact: true })
      .fill(account.password ?? "demo1234");
    await page
      .getByRole("button", { name: fa ? "ورود" : "Sign in", exact: true })
      .click();
    if (["owner", "manager", "branch_supervisor"].includes(account.role)) {
      // The normal privileged flow includes the real simulated challenge;
      // only the explicitly invoked Demo menu uses its configured shortcut.
      if (account.setup.second_step_method === "authenticator") {
        await page
          .getByLabel(fa ? "کد برنامهٔ احراز هویت" : "Authenticator app code", {
            exact: true,
          })
          .fill(configuration.session.simulated_authenticator_code);
        await page
          .getByRole("button", { name: fa ? "ادامه" : "Continue", exact: true })
          .click();
      } else {
        await page
          .getByRole("button", {
            name: fa
              ? "استفاده از کلید ورود شبیه‌سازی‌شده"
              : "Use simulated passkey",
            exact: true,
          })
          .click();
      }
    }
  }
  await expect(page.locator(".topbar")).toBeVisible();
  const fa = (await page.locator("html").getAttribute("lang")) === "fa";
  await expect(page.locator(".user-chip-copy strong")).toHaveText(
    fa ? account.name_fa : account.name_en,
  );
  // These controls only mount after actual session completion and the current
  // protected projection. E1 canonical business persistence is IndexedDB.
  await expect(
    page
      .locator(".topbar")
      .getByRole("combobox", { name: fa ? "مکان" : "Location", exact: true }),
  ).toBeEnabled();
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
  const fa = (await page.locator("html").getAttribute("lang")) === "fa";
  const control = page
    .locator(".topbar")
    .getByRole("combobox", { name: fa ? "مکان" : "Location", exact: true });
  if (branch === "all") {
    await control.click();
    await page
      .getByRole("option", {
        name: fa
          ? /^(همه مکان‌ها|همه مکان‌های من)$/
          : /^All (locations|my locations)$/,
      })
      .click();
    await expect(control).toBeEnabled();
    return;
  }
  const location = configuration.branches.find((row) => row.id === branch);
  await chooseOption(
    page,
    control,
    branch,
    (fa ? location?.name_fa : location?.name) ?? branch,
  );
  await expect(control).toBeEnabled();
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
  const fa = (await page.locator("html").getAttribute("lang")) === "fa";
  const locationName = fa ? "مکان" : "Location";
  const beforeLocation = (
    await page
      .locator(".topbar")
      .getByRole("combobox", { name: locationName, exact: true })
      .locator("bdi")
      .innerText()
  ).trim();
  const beforeSession = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw).session_id : null;
  }, AUTH_IDENTITY_KEY);
  await (await openShellAction(page, fa ? "دمو" : "Demo")).click();
  const resetName = fa ? "بازنشانی دمو" : "Reset demo";
  await page.getByRole("menuitem", { name: resetName, exact: true }).click();
  await page
    .getByRole("dialog", { name: resetName, exact: true })
    .getByRole("button", { name: resetName, exact: true })
    .click();
  // Observe the real reset's new SID without publishing or writing identities.
  // The dialog closes before its asynchronous transaction finishes.
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, previous }) => {
          const raw = sessionStorage.getItem(key);
          const current = raw ? JSON.parse(raw).session_id : null;
          return typeof current === "string" && current !== previous;
        },
        { key: AUTH_IDENTITY_KEY, previous: beforeSession },
      ),
    )
    .toBe(true);
  await expect(page.locator(".topbar")).toBeVisible();
  const current = page
    .locator(".topbar")
    .getByRole("combobox", { name: locationName, exact: true });
  await expect(current).toBeEnabled();
  if ((await current.locator("bdi").innerText()).trim() !== beforeLocation) {
    // Restore the caller's selection only when the fresh six-person directory
    // still permits it. Never switch personas or substitute a first store.
    await current.click();
    const permitted = page.getByRole("option", {
      name: beforeLocation,
      exact: true,
    });
    if (await permitted.count()) {
      await permitted.click();
      await expect(current).toBeEnabled();
    } else {
      await page.keyboard.press("Escape");
    }
  }
}

export async function visitPage(page: Page, label: string) {
  // Wait for the real route projection before choosing a compact sidebar group.
  await expect(page.locator("main h1")).toBeVisible();
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
    if (
      (await groupToggle.count()) &&
      (await groupToggle.first().getAttribute("aria-expanded")) === "false"
    )
      await groupToggle.first().click();
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
  const deadline = Date.now() + 8000;
  const remaining = () => Math.max(1, deadline - Date.now());
  // The heading mounts before the native original retention/read transaction.
  // Observe this actual upload's committed reference and completed review first.
  const originalHash = createHash("sha256")
    .update(invoiceImage.buffer)
    .digest("hex");
  await expect
    .poll(
      async () => {
        const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
        return {
          fileName: invoice.file_name,
          sourceHash: invoice.file_data?.split(":").at(-1),
          status: invoice.status,
        };
      },
      { timeout: remaining() },
    )
    .toEqual({
      fileName: invoiceImage.name,
      sourceHash: originalHash,
      status: "review",
    });
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible({ timeout: remaining() });
  await expect(page.locator(".invoice-line")).toHaveCount(6, {
    timeout: remaining(),
  });
}
