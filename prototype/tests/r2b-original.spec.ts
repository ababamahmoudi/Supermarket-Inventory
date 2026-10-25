import { expect, test } from "@playwright/test";
import { importReceivingFixture } from "./r2-receiving-helpers";
import { openInvoiceDetails } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

test("R2b 2.1 edits retain original image nodes without placeholders", async ({
  page,
}) => {
  const imported = await importReceivingFixture(page, "en");
  await openInvoiceDetails(page);
  const original = page.locator(".original-viewer");
  await expect(original.locator("img").first()).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(original.locator(".invoice-original-skeleton")).toHaveCount(0);
  await original.evaluate((element) => {
    const images = [...element.querySelectorAll("img")];
    const state = { images, replacements: 0, placeholders: 0 };
    Object.assign(window, { originalEditEvidence: state });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const added of record.addedNodes) {
          if (!(added instanceof Element)) continue;
          if (added.matches("img") || added.querySelector("img"))
            state.replacements++;
          if (
            added.matches(
              ".invoice-original-skeleton,.original-viewer-thumbnail-skeleton",
            ) ||
            added.querySelector(
              ".invoice-original-skeleton,.original-viewer-thumbnail-skeleton",
            )
          )
            state.placeholders++;
        }
      }
    }).observe(element, { childList: true, subtree: true });
  });
  const number = page.getByLabel("Invoice number", { exact: true });
  await number.fill("R2B-INVENTED-EDIT");
  await number.press("Tab");
  await expect
    .poll(async () => {
      const state = await readCanonicalBusinessEvidence(page);
      return state.invoice.id === imported.id
        ? state.invoice.supplier_invoice_number
        : state.invoices?.find((row) => row.id === imported.id)
            ?.supplier_invoice_number;
    })
    .toBe("R2B-INVENTED-EDIT");
  await expect(original.locator(".invoice-original-skeleton")).toHaveCount(0);
  expect(
    await original.evaluate((element) => {
      const state = (
        window as typeof window & {
          originalEditEvidence: {
            images: HTMLImageElement[];
            replacements: number;
            placeholders: number;
          };
        }
      ).originalEditEvidence;
      return {
        replacements: state.replacements,
        placeholders: state.placeholders,
        sameNodes: state.images.every((image) => element.contains(image)),
      };
    }),
  ).toEqual({ replacements: 0, placeholders: 0, sameNodes: true });
});
