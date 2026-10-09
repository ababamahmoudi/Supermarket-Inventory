import { expect, test } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";

test("request catalog cases and free text; fulfil at Warehouse, receive Missing, close and copy residual once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#requests");
  const baseline = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("supermarket-prototype-v1")!);
    return { stock: state.stock, ledger: state.ledger };
  });
  await page.getByRole("button", { name: "New request", exact: true }).click();
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
  const catalogLine = page.locator(".request-draft-line").first();
  await catalogLine.getByLabel("Quantity", { exact: true }).fill("2");
  await chooseOption(
    page,
    catalogLine.getByLabel("Units / Cases", { exact: true }),
    "cases",
    "Cases",
  );
  await catalogLine.getByLabel("Units per case", { exact: true }).fill("12");
  await catalogLine
    .getByLabel("Note (optional)", { exact: true })
    .fill("For the front shelf");
  await page
    .getByLabel("Free-text item", { exact: true })
    .fill("Small paper bags");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const freeLine = page.locator(".request-draft-line").nth(1);
  await freeLine.getByLabel("Quantity", { exact: true }).fill("3");
  await chooseOption(
    page,
    freeLine.getByLabel("Units / Cases", { exact: true }),
    "cases",
    "Cases",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const reference = await page.locator(".request-detail h2").innerText();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Requested",
  );
  await expect(
    page.getByRole("button", { name: "Mark as sent", exact: true }),
  ).toHaveCount(0);
  await signIn(page, "Supervisor");
  await setBranch(page, "Warehouse");
  await page.goto("/#requests");
  await page.getByRole("tab", { name: "Incoming", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: reference })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Confirm every item");
  await page
    .locator(".request-checklist-item")
    .first()
    .getByRole("button", { name: "Short", exact: true })
    .click();
  await page.getByLabel("Quantity being sent", { exact: true }).fill("1");
  await page
    .locator(".request-checklist-item")
    .nth(1)
    .getByRole("checkbox", { name: "Being sent", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Print picking list", exact: true })
    .click();
  await expect(page.locator(".operational-print-output")).toHaveCount(1);
  const printable = page.locator(".operational-print-document");
  await expect(printable).toContainText("Small paper bags");
  await expect(printable.locator('[lang="fa"]')).not.toHaveCount(0);
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Sent",
  );
  // The print content is a snapshot: later checklist decisions cannot rewrite the earlier picking list.
  await expect(printable).not.toContainText("Short: 1");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".operational-print-output")).toHaveCount(0);
  await signIn(page, "Floor Worker");
  await page.goto("/#requests");
  await page
    .getByRole("row")
    .filter({ hasText: reference })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page
    .locator(".request-checklist-item")
    .first()
    .getByRole("button", { name: "Missing", exact: true })
    .click();
  await page.getByLabel("Quantity arrived", { exact: true }).fill("0.5");
  await page
    .locator(".request-checklist-item")
    .nth(1)
    .getByRole("checkbox", { name: "Arrived", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark as received", exact: true })
    .click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Received",
  );
  await expect(page.locator(".request-checklist-item").first()).toContainText(
    "Missing",
  );
  await page
    .getByRole("button", { name: "Close request", exact: true })
    .click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Closed",
  );
  await page
    .getByRole("button", { name: "Copy short or missing items", exact: true })
    .click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Draft",
  );
  await expect(page.locator(".request-checklist-item")).toHaveCount(1);
  await expect(page.locator(".request-checklist-heading > strong")).toHaveText(
    "1.5 Cases",
  );
  const final = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
  expect(final.stock).toEqual(baseline.stock);
  expect(final.ledger).toEqual(baseline.ledger);
  const original = final.branch_requests.find(
    (item: { reference: string }) => item.reference === reference,
  );
  expect(original.status).toBe("closed");
  expect(
    final.request_transfer_events
      .filter((item: { request_id: string }) => item.request_id === original.id)
      .map(
        (item: { normalized_units: number | null }) => item.normalized_units,
      ),
  ).toEqual([12, null, 6, null]);
});

for (const language of ["en", "fa"] as const) {
  test(`Supervisor All requires explicit endpoint and bilingual A4 picking list paginates in ${language}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await signIn(page, "Supervisor");
    await page.evaluate(() => {
      const state = JSON.parse(
        localStorage.getItem("supermarket-prototype-v1")!,
      );
      const product = state.products.find(
        (item: { code: string }) => item.code === "0003",
      );
      const now = new Date().toISOString();
      state.branch_requests = [
        {
          id: "request-print-proof",
          reference: "REQ-PRINT",
          company_id: state.config.company.seed_key,
          branch: "Branch 1",
          from_branch: "Branch 1",
          to_branch: "Warehouse",
          status: "requested",
          revision: 2,
          created_at: now,
          created_by: "Demo Floor Worker",
          updated_at: now,
          requested_at: now,
          requested_by: "Demo Floor Worker",
          items: Array.from({ length: 70 }, (_, index) => ({
            id: `print-line-${index}`,
            kind: "catalog",
            product_code: product.code,
            name_en: product.name_en,
            name_fa: product.name_fa,
            unit_size: product.unit_size,
            quantity: "2",
            quantity_unit: "cases",
            units_per_case: 12,
            normalized_units: 24,
            note: `Picking line ${index + 1}`,
          })),
        },
      ];
      localStorage.setItem("supermarket-prototype-v1", JSON.stringify(state));
    });
    await page.reload();
    await setBranch(page, "all");
    await page.goto("/#requests");
    await page
      .getByRole("row")
      .filter({ hasText: "REQ-PRINT" })
      .getByRole("button", { name: "Open", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Mark as sent", exact: true }),
    ).toHaveCount(0);
    await chooseOption(
      page,
      page.getByLabel("Acting location", { exact: true }),
      "Warehouse",
    );
    await expect(
      page.getByRole("button", { name: "Mark as sent", exact: true }),
    ).toBeVisible();
    if (language === "en")
      await page
        .getByRole("button", { name: "Switch to dark theme", exact: true })
        .click();
    if (language === "fa") await setLanguage(page, "fa");
    await page
      .getByRole("button", {
        name: language === "en" ? "Print picking list" : "چاپ فهرست آماده‌سازی",
        exact: true,
      })
      .click();
    await page.emulateMedia({ media: "print" });
    const document = page.locator(".operational-print-document");
    await expect(document).toHaveAttribute(
      "dir",
      language === "fa" ? "rtl" : "ltr",
    );
    await expect(document.locator("tbody tr")).toHaveCount(70);
    const styles = await document.evaluate((element) => ({
      page: getComputedStyle(element).page,
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
      paperBackground: getComputedStyle(element.ownerDocument.body)
        .backgroundColor,
      thead: getComputedStyle(element.querySelector("thead")!).display,
      rowBreak: getComputedStyle(element.querySelector("tr")!).breakInside,
      pages: Array.from(element.ownerDocument.styleSheets)
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules).map((rule) => rule.cssText);
          } catch {
            return [];
          }
        })
        .filter((rule) => rule.startsWith("@page operational-document")),
    }));
    expect(styles.page).toBe("operational-document");
    expect(styles.color).toBe("rgb(0, 0, 0)");
    expect(styles.background).toBe("rgb(255, 255, 255)");
    expect(styles.paperBackground).toBe("rgb(255, 255, 255)");
    expect(styles.thead).toBe("table-header-group");
    expect(styles.rowBreak).toBe("avoid");
    expect(styles.pages.join(" ")).toContain("15mm");
    expect(styles.pages.join(" ")).toContain("a4 portrait");
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    const pdfText = pdf.toString("latin1");
    expect((pdfText.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    const boxes = [
      ...pdfText.matchAll(
        /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g,
      ),
    ];
    expect(boxes.length).toBeGreaterThan(1);
    for (const box of boxes) {
      expect(Number(box[1])).toBeCloseTo(595, 0);
      expect(Number(box[2])).toBeCloseTo(842, 0);
    }
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  });
}
