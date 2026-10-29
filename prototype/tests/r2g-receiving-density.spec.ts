import { expect, test } from "@playwright/test";
import {
  importReceivingFixture,
  openReceivingLine,
  word,
} from "./r2-receiving-helpers";
import { openShellAction } from "./helpers";
import { inspectReceivingDensity } from "./r2g-receiving-density";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const language of ["en", "fa"] as const)
  test(`B4 reference-based closed rows reject extra padding gaps wraps and fixed bands in ${language}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const invoice = await importReceivingFixture(page, language);
    if (language === "fa")
      await (await openShellAction(page, "تغییر به تم تیره")).click();
    const before = await readCanonicalBusinessEvidence(page);
    const positive = await inspectReceivingDensity(page, invoice);
    await info.attach("B4 exact density composition", {
      body: JSON.stringify(positive),
      contentType: "application/json",
    });
    expect(positive.failures).toEqual([]);
    expect(positive.rows).toHaveLength(25);
    await page.screenshot({
      path: info.outputPath(`B4-density-${language}-1440.png`),
      fullPage: true,
    });
    for (const mutation of ["padding", "gap", "wrap", "fixed"] as const) {
      const target = page
        .locator(
          {
            padding: ".invoice-line-summary > .receiving-product-cell",
            gap: ".receiving-table",
            wrap: ".receiving-product-meta",
            fixed: ".receiving-details",
          }[mutation],
        )
        .first();
      const saved = await target.getAttribute("style");
      await target.evaluate((element, kind) => {
        const style = (element as HTMLElement).style;
        if (kind === "padding") style.paddingBottom = "16px";
        if (kind === "gap") style.borderSpacing = "0 8px";
        if (kind === "wrap") style.inlineSize = "100px";
        if (kind === "fixed") style.paddingBottom = "20px";
      }, mutation);
      try {
        const negative = await inspectReceivingDensity(page, invoice);
        const wanted = {
          padding: "Density 12px row padding: 1",
          gap: "Density 4px table spacing",
          wrap: "Density category/check peer line: 1",
          fixed: "Density oversized section: invoice details",
        }[mutation];
        expect(negative.failures).toContain(wanted);
        await info.attach(`B4 density negative ${mutation}`, {
          body: JSON.stringify(negative),
          contentType: "application/json",
        });
      } finally {
        await target.evaluate((element, original) => {
          if (original === null) element.removeAttribute("style");
          else element.setAttribute("style", original);
        }, saved);
      }
      expect((await inspectReceivingDensity(page, invoice)).failures).toEqual(
        [],
      );
    }
    await openReceivingLine(page, 0);
    await expect(page.locator("#invoice-line-0-supplier-code")).toHaveValue(
      invoice.lines[0].supplier_item_code!,
    );
    const editor = page.locator("#invoice-line-0-detail");
    const more = editor.getByText(
      word(language, "More details", "جزئیات بیشتر"),
      { exact: true },
    );
    if (!(await page.locator("#invoice-line-0-pack_size").isVisible()))
      await more.click();
    await expect(page.locator("#invoice-line-0-pack_size")).toHaveValue(
      invoice.lines[0].pack_size!,
    );
    await expect(page.locator("#invoice-line-0-pack_size")).toHaveAttribute(
      "readonly",
      "",
    );
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
  });
