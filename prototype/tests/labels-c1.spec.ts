import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`ready Regular and Promo labels print exact millimetres and truthful monochrome offers in ${language}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await signIn(page, "Floor Worker");
    await page.goto("/#labels");
    await page.getByLabel("Search products", { exact: true }).fill("0003");
    await page
      .getByRole("button", { name: "Add to waitlist", exact: true })
      .click();
    await page.getByRole("tab", { name: /^Waitlist/ }).click();
    await expect(page.getByLabel("Saved template", { exact: true })).toHaveText(
      "Regular",
    );
    await expect(
      page.getByRole("heading", { name: "Grayscale preview", exact: true }),
    ).toBeVisible();
    const shelf = page.locator(".label-bilingual-preview .shelf-label");
    await expect(shelf.locator(".regular-label-special")).toHaveText("SPECIAL");
    await expect(shelf.locator(".label-offer-badge")).toHaveText("2 for $5");
    await page
      .getByRole("button", { name: "Print labels", exact: true })
      .click();
    await page.emulateMedia({ media: "print" });
    const regularMetrics = await page
      .locator(".label-print-output .shelf-label")
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const sheet = element.closest(".print-sheet")!.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          sheetWidth: sheet.width,
          sheetHeight: sheet.height,
          filter: getComputedStyle(element).filter,
        };
      });
    expect(Math.abs(regularMetrics.width - (60 * 96) / 25.4)).toBeLessThan(0.2);
    expect(Math.abs(regularMetrics.height - (40 * 96) / 25.4)).toBeLessThan(
      0.2,
    );
    expect(
      Math.abs(regularMetrics.sheetWidth - (210 * 96) / 25.4),
    ).toBeLessThan(0.2);
    expect(
      Math.abs(regularMetrics.sheetHeight - (297 * 96) / 25.4),
    ).toBeLessThan(0.2);
    expect(regularMetrics.filter).toBe("grayscale(1)");
    await page.emulateMedia({ media: "screen" });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "No", exact: true })
      .click();
    await page.getByLabel("Saved template", { exact: true }).click();
    await page.getByRole("option", { name: "Promo", exact: true }).click();
    if (language === "fa") await setLanguage(page, "fa");
    const promo = page.locator(".label-bilingual-preview .promo-shelf-label");
    await expect(promo.locator(".promo-label-special")).toHaveText(
      language === "en" ? "SPECIAL" : "ویژه",
    );
    await expect(promo.locator(".promo-label-price")).toHaveText(
      language === "en" ? "2 for $5" : "۲ عدد $5",
    );
    await expect(promo.locator(".promo-label-regular-price")).toHaveText(
      language === "en" ? "Regular $2.99" : "عادی $2.99",
    );
    await expect(promo.locator('[lang="en"]')).toBeVisible();
    await expect(promo.locator('[lang="fa"]')).toBeVisible();
    await expect(page.locator(".label-preview-caption")).toContainText(
      language === "en" ? "2 labels per sheet" : "2 برچسب در هر برگه",
    );
    await page
      .getByRole("button", {
        name: language === "en" ? "Print labels" : "چاپ برچسب‌ها",
        exact: true,
      })
      .click();
    await page.emulateMedia({ media: "print" });
    const promoMetrics = await page
      .locator(".label-print-output .promo-shelf-label")
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const frameElement = element.querySelector(".promo-label-frame")!;
        const frame = frameElement.getBoundingClientRect();
        const band = element.querySelector(".promo-label-special")!;
        const content = element
          .querySelector(".promo-label-content")!
          .getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          inset: frame.left - box.left,
          border:
            (Number(
              frameElement.querySelector("rect")!.getAttribute("stroke-width"),
            ) *
              frame.width) /
            (frameElement as SVGSVGElement).viewBox.baseVal.width,
          bandFill: getComputedStyle(band).backgroundColor,
          bandColor: getComputedStyle(band).color,
          offerFont: Number.parseFloat(
            getComputedStyle(element.querySelector(".promo-label-price")!)
              .fontSize,
          ),
          regularFont: Number.parseFloat(
            getComputedStyle(
              element.querySelector(".promo-label-regular-price")!,
            ).fontSize,
          ),
          overflow: Math.max(
            box.left - content.left,
            box.top - content.top,
            content.right - box.right,
            content.bottom - box.bottom,
            0,
          ),
        };
      });
    expect(Math.abs(promoMetrics.width - (210 * 96) / 25.4)).toBeLessThan(0.2);
    expect(Math.abs(promoMetrics.height - (148.5 * 96) / 25.4)).toBeLessThan(
      0.2,
    );
    expect(Math.abs(promoMetrics.inset - (5 * 96) / 25.4)).toBeLessThan(0.2);
    expect(Math.abs(promoMetrics.border - (1.5 * 96) / 25.4)).toBeLessThan(0.2);
    expect(promoMetrics.bandFill).toBe("rgb(0, 0, 0)");
    expect(promoMetrics.bandColor).toBe("rgb(255, 255, 255)");
    expect(promoMetrics.offerFont).toBeGreaterThan(
      promoMetrics.regularFont * 3,
    );
    expect(promoMetrics.overflow).toBeLessThanOrEqual(0.2);
  });
}

test("built-in templates can be duplicated, edited, archived and restored without deletion", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByLabel("Saved template", { exact: true }).click();
  await page.getByRole("option", { name: "Promo", exact: true }).click();
  await page
    .getByRole("button", { name: "Duplicate template", exact: true })
    .click();
  await expect(page.getByLabel("Template name", { exact: true })).toHaveValue(
    "Promo copy",
  );
  await page.getByLabel("Template name", { exact: true }).fill("Weekend Promo");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archive template", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save template", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "This template is archived. Restore it before editing or printing.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore template", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save template", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByLabel("Saved template", { exact: true }).click();
  await page
    .getByRole("option", { name: "Weekend Promo", exact: true })
    .click();
  await expect(page.getByLabel("Label style", { exact: true })).toHaveText(
    "Promo",
  );
  await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  const templates = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).templates,
  );
  expect(templates).toHaveLength(3);
  expect(
    templates.filter((item: { built_in?: string }) => item.built_in),
  ).toHaveLength(2);
});

test("Promo without an active offer never invents SPECIAL or an offer", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await page.getByLabel("Search products", { exact: true }).fill("0004");
  await page
    .getByRole("button", { name: "Add to waitlist", exact: true })
    .click();
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await page.getByLabel("Saved template", { exact: true }).click();
  await page.getByRole("option", { name: "Promo", exact: true }).click();
  const promo = page.locator(".label-bilingual-preview .promo-shelf-label");
  await expect(promo.locator(".promo-label-price")).toHaveText("$6.49");
  await expect(promo.locator(".promo-label-special")).toBeEmpty();
  await expect(promo.locator(".promo-label-regular-price")).toBeEmpty();
});
