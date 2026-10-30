import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import {
  openInvoiceDetails,
  chooseOption,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openReceivingLine, word } from "./r2-receiving-helpers";
const fixture = fileURLToPath(
  new URL("./fixtures/r2e-weight-cases.json", import.meta.url),
);
for (const language of ["en", "fa"] as const) {
  test(`R2e A imports measured cases, converts money, posts and proposes the real per-lb price in ${language}`, async ({
    page,
  }, info) => {
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#invoices");
    await page
      .getByRole("button", {
        name: word(language, "New invoice", "فاکتور جدید"),
        exact: true,
      })
      .click();
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page
        .getByRole("dialog")
        .getByRole("button", {
          name: word(language, "JSON file", "فایل JSON"),
          exact: true,
        })
        .click(),
    ]);
    await chooser.setFiles(fixture);
    const preview = page.getByRole("dialog", {
      name: word(language, "Import invoice readings", "ورود خوانش فاکتورها"),
      exact: true,
    });
    await preview
      .getByRole("button", {
        name: word(language, "Import 1 invoice", "ورود 1 فاکتور"),
        exact: true,
      })
      .click();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    const editor = await openReceivingLine(page, 0);
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-category"),
      "grocery",
      word(language, "Grocery", "خواربار"),
    );
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-unit"),
      "lb",
      word(language, "Weight (lb)", "وزن (پوند)"),
    );
    await expect(editor.locator("#invoice-line-0-invoiced")).toHaveValue("40");
    await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("2.5000");
    await expect(editor.locator(".receiving-pack-equation")).toContainText(
      "10 lb",
    );
    await expect(editor.locator(".receiving-paper-mismatch")).toHaveCount(0);
    await editor.locator("#invoice-line-0-cost").fill("25.0000");
    await editor.locator("#invoice-line-0-cost").press("Tab");
    await expect(editor.locator(".receiving-paper-mismatch")).toContainText(
      "1,000.00",
    );
    await editor
      .getByRole("button", {
        name: word(language, "Use $2.50/lb", "استفاده از $2.50 برای هر واحد"),
        exact: true,
      })
      .click();
    await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("2.5000");
    await expect(editor.locator(".receiving-paper-mismatch")).toHaveCount(0);

    await chooseOption(
      page,
      editor.locator("#invoice-line-0-unit"),
      "kg",
      word(language, "Weight (kg)", "وزن (کیلوگرم)"),
    );
    await expect(editor.locator("#invoice-line-0-invoiced")).toHaveValue(
      "18.144",
    );
    await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("5.5116");
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-unit"),
      "cases",
      word(language, "Cases", "کارتن"),
    );
    await expect(editor.locator("#invoice-line-0-case-weight")).toHaveValue(
      "10",
    );
    await expect(editor.locator("#invoice-line-0-invoiced")).toHaveValue("4");
    await expect(editor.locator("#invoice-line-0-delivered")).toHaveValue("4");
    await expect(editor.locator("#invoice-line-0-cost")).toHaveAttribute(
      "readonly",
      "",
    );
    await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("2.5000");
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-unit"),
      "lb",
      word(language, "Weight (lb)", "وزن (پوند)"),
    );
    await editor.screenshot({
      path: info.outputPath(`r2e-weight-${language}.png`),
    });
    await editor
      .getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      })
      .click();
    await expect(editor).toHaveCount(0);
    const invoiceDetails = page.getByRole("button", {
      name: word(
        language,
        "Looks right: Invoice details",
        "درست است: اطلاعات فاکتور",
      ),
      exact: true,
    });
    if (!(await invoiceDetails.isVisible())) await openInvoiceDetails(page);
    if (await invoiceDetails.isVisible()) await invoiceDetails.click();
    const totals = page.getByRole("button", {
      name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
      exact: true,
    });
    if (await totals.isVisible()) await totals.click();
    const post = page
      .locator(
        info.project.name === "phone"
          ? ".receiving-mobile-post"
          : ".receiving-desktop-post",
      )
      .getByRole("button", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      });
    await expect(post).toBeEnabled();
    await post.click();
    const confirm = page.getByRole("dialog").getByRole("button", {
      name: word(language, "Post invoice", "ثبت فاکتور"),
      exact: true,
    });
    if (await confirm.isVisible()) await confirm.click();
    await expect
      .poll(async () => {
        const state = await readCanonicalBusinessEvidence(page);
        const invoice = [state.invoice, ...(state.invoices ?? [])].find(
          (row) => row.supplier_invoice_number === "ALDER-WEIGHT-01",
        );
        return {
          status: invoice?.status,
          total: invoice?.final_total,
          cost: invoice?.lines[0].unit_cost_before_tax,
        };
      })
      .toEqual({ status: "posted", total: "100.00", cost: "2.5000" });
    await page.goto("/#approvals");
    const proposal = page
      .locator(".approval-card")
      .filter({ hasText: "Fictional Alder Spice" });
    await expect(proposal).toBeVisible();
    await expect(proposal).toContainText("3.99");
    const state = await readCanonicalBusinessEvidence(page);
    const product = state.products.find(
      (row) => row.name_en === "Fictional Alder Spice",
    )!;
    expect(
      state.approvals.find(
        (row) => row.product_code === product.code && row.status === "pending",
      ),
    ).toMatchObject({
      unit_cost: "2.5000",
      proposed_price: "3.99",
      type: "new_product",
    });
  });
}
