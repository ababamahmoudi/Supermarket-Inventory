import { expect, test, type Page } from "@playwright/test";
import { openReceivingLine, word } from "./r2-receiving-helpers";
import { openPr29Invoice } from "./pr29-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function setAllCategories(page: Page, language: "en" | "fa") {
  await page
    .locator(".receiving-bulk-bar .receiving-new-category-action")
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page
    .getByRole("option", {
      name: word(language, "Grocery", "مواد غذایی"),
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", {
      name: word(language, "Set category", "تعیین دسته"),
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
}

const payableTotals = async (page: Page) => {
  const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
  return [invoice.subtotal, invoice.tax, invoice.final_total];
};

for (const language of ["en", "fa"] as const) {
  test(`PR 29 a credit on chosen items lowers their cost, not the totals, in ${language}`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "One posting walk is enough.");
    test.setTimeout(120_000);
    await openPr29Invoice(page, language);
    const credit = page.locator("#invoice-check-charge-1-applies_to");
    await expect(credit).toHaveClass(/please-check-field/);
    // A fee has no Applies to.
    await expect(
      page.locator("#invoice-check-charge-0-applies_to"),
    ).toHaveCount(0);
    // Nothing preselected.
    await expect(credit.locator('button[aria-pressed="true"]')).toHaveCount(0);

    // Unanswered: posting is blocked and What's missing names the fix.
    await setAllCategories(page, language);
    await page
      .getByTestId("invoice-details-card")
      .getByRole("button", {
        name: word(
          language,
          "Looks right: Invoice details",
          "درست است: اطلاعات فاکتور",
        ),
      })
      .click();
    const ready = page.locator(".receiving-confirm-ready");
    await ready.click();
    const editor = await openReceivingLine(page, 1);
    await editor
      .getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      })
      .click();
    await expect
      .poll(async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines.every(
          (line) => line.review_confirmed,
        ),
      )
      .toBe(true);
    const post = page
      .locator(".receiving-post-control:visible")
      .getByRole("button");
    // Blocked Post looks unavailable but still explains what is missing.
    await expect(post).toHaveAttribute("aria-disabled", "true");
    await post.click({ force: true });
    await expect(
      page.getByRole("alert", {
        name: word(language, "What's missing", "موارد ناقص"),
      }),
    ).toContainText(
      word(
        language,
        "Credit 2: choose Invoice total or Chosen items",
        "اعتبار 2: جمع فاکتور یا کالاهای انتخابی را انتخاب کنید",
      ),
    );
    expect((await readCanonicalBusinessEvidence(page)).invoice.status).not.toBe(
      "posted",
    );

    const before = await payableTotals(page);
    await credit
      .getByRole("button", {
        name: word(language, "Chosen items", "کالاهای انتخابی"),
      })
      .click();
    for (const name of ["Golden Test Lentils 1 kg", "Harbor Trial Rice 2 kg"]) {
      await credit.getByRole("combobox").click();
      await page.getByRole("option", { name, exact: true }).click();
    }
    await expect(credit.locator(".receiving-credit-info")).toContainText(
      "$4.8000",
    );
    await expect(credit.locator(".receiving-credit-info")).toContainText(
      "$8.0000",
    );
    await expect(credit).not.toHaveClass(/please-check-field/);
    const draft = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(await payableTotals(page)).toEqual(before);
    expect(
      draft.other_charges?.[1].allocations?.map((row) => row.amount),
    ).toEqual(["-12.00", "-8.00"]);
    expect(
      draft.lines.map((line) => line.allocated_unit_cost_before_tax ?? null),
    ).toEqual(["4.8000", "8.0000", null, null]);
    // The paper line totals are untouched.
    expect(draft.lines.map((line) => line.line_total)).toEqual([
      "60.00",
      "40.00",
      "30.00",
      "12.00",
    ]);

    // Item 7: Payable keeps its tint with weight 700 at 20 px.
    const payable = await page
      .locator(".receiving-total-payable")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.fontWeight, style.fontSize];
      });
    expect(payable).toEqual(["700", "20px"]);

    // Lines changed category/credit, so confirm them again, then post.
    const again = page.locator(".receiving-confirm-ready");
    if (await again.isVisible()) await again.click();
    await expect
      .poll(async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines.every(
          (line) => line.review_confirmed,
        ),
      )
      .toBe(true);
    await post.click();
    await page
      .getByRole("dialog", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .getByRole("button", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .click();
    await expect(page.locator(".invoice-posted-workspace")).toBeVisible();
    const posted = await readCanonicalBusinessEvidence(page);
    const record = posted.invoices?.find((entry) => entry.id === draft.id);
    expect(record?.status).toBe("posted");
    expect(record?.other_charges?.[1]).toMatchObject({
      applies_to: "chosen_items",
      allocations: [
        { amount: "-12.00", unit_cost_after: "4.8000" },
        { amount: "-8.00", unit_cost_after: "8.0000" },
      ],
    });
    expect([record?.subtotal, record?.tax, record?.final_total]).toEqual(
      before,
    );
    // The new products carry the lowered cost.
    const lentils = posted.products.find(
      (product) => product.name_en === "Golden Test Lentils 1 kg",
    );
    expect(lentils?.last_cost_before_tax).toBe("4.8000");
    await expect(page.getByTestId("posted-charge-1-applies-to")).toContainText(
      "$4.8000",
    );
    const history = posted.activity.filter(
      (entry) => entry.invoice_credit_allocations?.length,
    );
    expect(history.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        "Choose what a credit applies to",
        "Posted invoice",
      ]),
    );
    await page.goto("/#history");
    await expect(page.locator(".history-credit").first()).toContainText(
      "$4.8000",
    );
  });

  test(`PR 29 Subtotal shows the calculated sum and the paper difference in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    const totals = page.getByTestId("invoice-totals-card");
    await totals
      .getByRole("button", {
        name: word(language, "Edit totals", "ویرایش جمع‌ها"),
      })
      .click();
    await page.locator("#invoice-subtotal").fill("130.00");
    await page.locator("#invoice-subtotal").press("Tab");
    await totals
      .getByRole("button", {
        name: word(language, "Edit totals", "ویرایش جمع‌ها"),
      })
      .click();
    const row = totals.locator(".receiving-total-subtotal");
    // Items $142.00 + charges -$18.80 = $123.20 calculated.
    await expect(row.locator(".receiving-total-row")).toContainText("$123.20");
    await expect(row.locator(".receiving-total-difference")).toContainText(
      word(language, "On the paper:", "روی کاغذ:"),
    );
    await expect(row.locator(".receiving-total-difference")).toContainText(
      "$130.00",
    );
    await expect(row.locator(".receiving-total-difference")).toContainText(
      "$6.80",
    );
  });
}
