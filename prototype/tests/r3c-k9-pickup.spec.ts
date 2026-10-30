import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage, signIn } from "./helpers";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";

for (const language of ["en", "fa"] as const)
  test(`K9 compact actual pickup keeps optional reference and signed evidence ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, "Manager");
    await setLanguage(page, language);
    await page.goto("/#return?id=demo-return-1");
    await page
      .locator(".return-header-card")
      .getByRole("button", {
        name: language === "fa" ? "ثبت جمع‌آوری" : "Record pickup",
        exact: true,
      })
      .click();
    const form = page.locator(".return-compact-pickup");
    const quantity = form.locator(".return-pickup-quantity input");
    await expect(quantity).toHaveCount(1);
    const before = await readCanonicalBusinessEvidence(page);
    const record = before.returns.find((row) => row.id === "demo-return-1")!;
    const code = record.lines[0].product_code;
    const full = String(record.lines[0].qty);
    const reports = [];
    for (const width of [1440, 1000, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const responsive = await inspectResponsiveLayout(
        page,
        "K9 actual pickup",
        language,
        width,
      );
      expect(responsive.failures).toEqual([]);
      const boxes = await form.evaluate((element) => {
        const rect = (selector: string) => {
          const r = element.querySelector(selector)!.getBoundingClientRect();
          return {
            top: r.top,
            left: r.left,
            right: r.right,
            bottom: r.bottom,
            height: r.height,
          };
        };
        return {
          name: rect(".return-pickup-name"),
          returned: rect(".return-pickup-return-qty"),
          quantity: rect(".return-pickup-quantity"),
          shortfall: rect(".return-pickup-shortfall"),
          rep: rect(".return-pickup-person-row > .field:first-child input"),
          reference: rect(
            ".return-pickup-person-row > .field:last-child input",
          ),
          columns: getComputedStyle(
            element.querySelector(".return-pickup-item")!,
          ).gridTemplateColumns,
        };
      });
      if (width >= 1000) {
        expect(
          Math.abs(boxes.quantity.top - boxes.shortfall.top),
        ).toBeLessThanOrEqual(1);
        expect(Math.max(boxes.name.top, boxes.returned.top)).toBeLessThan(
          boxes.quantity.bottom,
        );
        expect(boxes.columns.split(/\s+/)).toHaveLength(4);
      }
      expect(Math.abs(boxes.rep.top - boxes.reference.top)).toBeLessThanOrEqual(
        1,
      );
      expect(
        boxes.rep.right <= boxes.reference.left ||
          boxes.reference.right <= boxes.rep.left,
      ).toBe(true);
      await form.screenshot({
        path: info.outputPath(`pickup-form-${width}-${language}.png`),
      });
      reports.push({ width, boxes, responsive });
    }
    await quantity.fill(full);
    await expect(form.locator(".return-pickup-shortfall")).toHaveCount(0);
    await expect(form.locator(".return-pickup-increase")).toBeDisabled();
    await form.locator(".return-pickup-decrease").click();
    await expect(quantity).toHaveValue(String(Number(full) - 1));
    await expect(form.locator(".return-pickup-shortfall")).toHaveCount(1);
    await form.locator(".return-pickup-increase").click();
    await quantity.fill(full);
    await form
      .locator("#return-pickup-representative")
      .fill("Fictional K9 driver");
    await expect(form.locator("#return-pickup-slip")).toHaveValue("");
    await expect(form.locator("#return-pickup-slip")).toHaveAccessibleName(
      language === "fa" ? "مرجع (اختیاری)" : "Reference (optional)",
    );
    await form
      .getByRole("button", {
        name: language === "fa" ? "ثبت جمع‌آوری" : "Record pickup",
        exact: true,
      })
      .click();
    await expect(form).toHaveCount(0);
    const after = await readCanonicalBusinessEvidence(page);
    const saved = after.returns.find((row) => row.id === record.id)!;
    const memo = saved.pickup_memos!.at(-1)!;
    expect(memo.pickup_request_id).toMatch(/^return-pickup-/);
    expect(memo.signed_evidence_reference).toBe("");
    expect(memo.lines).toContainEqual(
      expect.objectContaining({ product_code: code, quantity: Number(full) }),
    );
    expect(after.ledger).toEqual(before.ledger);
    await page.reload();
    await page
      .locator(".return-memos-card")
      .getByRole("button", { name: memo.reference, exact: true })
      .click();
    const preview = page.locator(".return-memo-preview");
    await expect(preview).toContainText("Fictional K9 driver");
    await expect(preview).toContainText("No reference provided");
    await expect(preview).toContainText("Signature");
    expect(errors).toEqual([]);
    await info.attach(`pickup-${language}.json`, {
      body: JSON.stringify(reports, null, 2),
      contentType: "application/json",
    });
  });
