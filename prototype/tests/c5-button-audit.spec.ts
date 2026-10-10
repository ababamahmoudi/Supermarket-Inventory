import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { chooseOption, setBranch, signIn } from "./helpers";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import {
  appearance,
  inspect,
  type C5Inspection,
} from "../scripts/c5-browser-proof.mjs";

test.setTimeout(180000);
test.use({ actionTimeout: 10000 });

/** Source census covers conditional calls; this checks real rendered states. */
function audit(page: Page, info: TestInfo) {
  const inspections: C5Inspection[] = [];
  return {
    async check(screen: string, role = "supervisor") {
      const modal = await page.locator("dialog[open]").count();
      const variants = modal
        ? (["en-light"] as const)
        : (["en-light", "en-dark", "fa-light"] as const);
      for (const variant of variants) {
        // A real modal makes the top bar inert. Extra dialogs are measured in
        // English light; the required C5 dialogs have all-theme coverage in
        // c5-presentation.spec.ts and the screenshot capture.
        if (!modal) await appearance(page, variant);
        const report = await inspect(
          page,
          screen,
          `${info.project.name}-${variant}`,
          role,
        );
        inspections.push(report);
        expect.soft(report.failures, `${screen}: ${variant}`).toEqual([]);
      }
      if (!modal) await appearance(page, "en-light");
    },
    async save() {
      const output = info.outputPath("button-audit.json");
      await writeFile(output, JSON.stringify(inspections, null, 2));
      await info.attach("Rendered button audit", {
        path: output,
        contentType: "application/json",
      });
    },
  };
}

async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

test("C5 button contract covers Suppliers, every supplier tab and item dialogs", async ({
  page,
}, info) => {
  const proof = audit(page, info);
  try {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await page.goto("/#suppliers");
    await proof.check("Suppliers overview");
    await page
      .getByRole("button", { name: "Add supplier", exact: true })
      .click();
    await proof.check("Add supplier dialog");
    await closeDialog(page);
    await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
    for (const tab of [
      "Overview",
      "Invoices",
      "Supplier items",
      "Received",
      "Returns and credits",
      "Shorts",
      "Price alerts",
      "Payments",
      "Notes",
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await proof.check(`Supplier: ${tab}`);
    }
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await proof.check("Edit supplier dialog");
    await closeDialog(page);
    await page
      .getByRole("tab", { name: "Supplier items", exact: true })
      .click();
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await proof.check("Add supplier item dialog");
    await closeDialog(page);
    const item = page.locator(".supplier-items-table tbody tr").first();
    if (await item.count()) {
      await item.getByRole("button", { name: "History", exact: true }).click();
      await proof.check("Supplier item price history dialog");
      await closeDialog(page);
      await item.getByRole("button", { name: "Edit", exact: true }).click();
      await proof.check("Edit supplier item dialog");
      await closeDialog(page);
    }
    await signIn(page, "Floor Worker");
    await page.goto("/#suppliers");
    await proof.check("Suppliers overview", "floor_worker");
    await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
    for (const tab of [
      "Overview",
      "Invoices",
      "Supplier items",
      "Received",
      "Returns and credits",
      "Shorts",
      "Price alerts",
      "Notes",
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await proof.check(`Supplier: ${tab}`, "floor_worker");
      await expect(page.locator(".supplier-tab-card .money")).toHaveCount(0);
    }
  } finally {
    await proof.save();
  }
});

test("C5 button contract covers working Settings groups and their dialogs", async ({
  page,
}, info) => {
  const proof = audit(page, info);
  try {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await page.goto("/#settings");
    const navigation = page.getByRole("navigation", {
      name: "Settings groups",
    });
    for (const group of [
      "Company",
      "Branches",
      "People",
      "Catalog",
      "Pricing and approvals",
      "Offers",
      "Taxes",
      "Receiving",
      "Returns/date tracking/labels",
      "Notes",
      "Notifications",
      "Modules",
      "Data",
    ]) {
      await navigation
        .getByRole("button", { name: group, exact: true })
        .click();
      await proof.check(`Settings: ${group}`);
    }
    await navigation
      .getByRole("button", { name: "Branches", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add location", exact: true })
      .click();
    await proof.check("Add location dialog");
    await closeDialog(page);
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await proof.check("Edit location dialog");
    await closeDialog(page);
    await navigation
      .getByRole("button", { name: "Catalog", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add category", exact: true })
      .click();
    await proof.check("Add pricing category dialog");
    await closeDialog(page);
    await navigation
      .getByRole("button", { name: "Notes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "New notebook", exact: true })
      .click();
    await proof.check("New notebook dialog");
    await closeDialog(page);
  } finally {
    await proof.save();
  }
});

test("C5 button contract covers Labels, Notes, History, Received and ledger forms", async ({
  page,
}, info) => {
  const proof = audit(page, info);
  try {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await page.goto("/#labels");
    await proof.check("Labels Products");
    for (const tab of [/^Waitlist/, /^Templates$/]) {
      await page.getByRole("tab", { name: tab }).click();
      await proof.check(`Labels ${tab.source}`);
    }
    await chooseOption(
      page,
      page.getByLabel("Saved template", { exact: true }),
      "Regular",
    );
    await proof.check("Edit Regular label template");
    await page.goto("/#notes");
    await proof.check("Notes");
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await proof.check("Add note dialog");
    await closeDialog(page);
    await page.goto("/#received");
    await proof.check("Received");
    await page.goto("/#history");
    await proof.check("History");
    const revert = page
      .getByRole("button", { name: "Revert", exact: true })
      .first();
    if (await revert.count()) {
      await revert.click();
      await proof.check("Revert History change dialog");
      await closeDialog(page);
    }
    await page.goto("/#payables");
    await proof.check("Payables overview");
    await page
      .locator(".payables-overview")
      .getByRole("link", { name: "Fresh Valley Foods", exact: true })
      .click();
    await proof.check("Supplier ledger");
    await page
      .getByRole("button", { name: "Record external payment", exact: true })
      .click();
    await proof.check("Record external payment form");
    await page
      .getByRole("button", {
        name: "Record opening balance, credit, or adjustment",
        exact: true,
      })
      .click();
    await proof.check("Record ledger entry form");
    const dispute = page
      .getByRole("button", { name: "Record dispute", exact: true })
      .first();
    if (await dispute.count()) {
      await dispute.click();
      await proof.check("Record supplier dispute form");
    }
  } finally {
    await proof.save();
  }
});

test("C5 button contract covers Orders and Branch request forms and retained details", async ({
  page,
}, info) => {
  const proof = audit(page, info);
  try {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await page.goto("/#orders");
    await proof.check("Orders list");
    await page.getByRole("button", { name: "New order", exact: true }).click();
    const form = page.getByRole("form", { name: "New order", exact: true });
    await chooseOption(
      page,
      form.getByLabel("Supplier", { exact: true }),
      "Fresh Valley Foods",
    );
    await proof.check("New order with supplier items");
    await page.getByRole("button", { name: "New item", exact: true }).click();
    await proof.check("New order item dialog");
    await closeDialog(page);
    await page.goto("/#requests");
    await proof.check("Branch requests Incoming");
    await page.getByRole("tab", { name: "Outgoing", exact: true }).click();
    await proof.check("Branch requests Outgoing");
    await page
      .getByRole("button", { name: "New request", exact: true })
      .click();
    await proof.check("New request");
    await chooseOption(
      page,
      page.getByLabel("Sending location", { exact: true }),
      "Warehouse",
    );
    await page.getByLabel("Search products", { exact: true }).fill("0003");
    await page
      .locator(".request-search-results")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await proof.check("New request with item");
    await page
      .getByRole("button", { name: "Save as draft", exact: true })
      .click();
    await proof.check("Saved request detail");
    await page
      .getByRole("button", { name: "Cancel request", exact: true })
      .click();
    await proof.check("Cancel request reason");
  } finally {
    await proof.save();
  }
});

test("C5 button contract covers sign-in, first-sign-in password and lock actions", async ({
  page,
}, info) => {
  const reports: C5Inspection[] = [];
  const measure = async (
    screen: string,
    variant: string,
    role = "anonymous",
  ) => {
    const report = await inspect(
      page,
      screen,
      `${info.project.name}-${variant}`,
      role,
    );
    reports.push(report);
    expect.soft(report.failures, `${screen}: ${variant}`).toEqual([]);
  };
  try {
    await page.goto("/");
    await measure("Sign in", "en-light");
    await page
      .getByRole("button", { name: "Switch to Persian", exact: true })
      .click();
    await measure("Sign in", "fa-light");
    await page
      .getByRole("button", { name: "تغییر به انگلیسی", exact: true })
      .click();
    const employee = demoSeed.demo_users.find(
      (user) => user.username === "newemployee",
    )!;
    await page.getByLabel("Username", { exact: true }).fill(employee.username);
    await page
      .getByLabel("Password", { exact: true })
      .fill(employee.temporary_password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Choose a new password", exact: true }),
    ).toBeVisible();
    await measure("Choose a new password", "en-light", employee.role);
    await page
      .getByRole("button", { name: "Switch to Persian", exact: true })
      .click();
    await measure("Choose a new password", "fa-light", employee.role);
    await page
      .getByRole("button", { name: "تغییر به انگلیسی", exact: true })
      .click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await appearance(page, "en-dark");
    const userMenu = page.getByRole("button", {
      name: "User menu",
      exact: true,
    });
    if (!(await userMenu.isVisible()))
      await page.locator("#menu-toggle").click();
    await userMenu.click();
    await page.getByRole("menuitem", { name: "Lock", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Screen locked", exact: true }),
    ).toBeVisible();
    await measure("Screen locked", "en-dark", "supervisor");
    await page
      .getByRole("button", { name: "Switch to Persian", exact: true })
      .click();
    await measure("Screen locked", "fa-dark", "supervisor");
  } finally {
    const output = info.outputPath("button-audit.json");
    await writeFile(output, JSON.stringify(reports, null, 2));
    await info.attach("Rendered auth button audit", {
      path: output,
      contentType: "application/json",
    });
  }
});
