import type { Page } from "@playwright/test";
import type { DemoInvoice } from "../src/types";

/** R2g supersedes the old three-pixel/2700px aggregate-only density check.
 * Every allowance below belongs to an actual approved row or card component.
 * A larger total cannot excuse an oversized row, hidden fact, or extra gap.
 */
export async function inspectReceivingDensity(
  page: Page,
  invoice: DemoInvoice,
) {
  await page.evaluate(async () => document.fonts.ready);
  return page.getByTestId("invoice-review").evaluate((review, expected) => {
    const failures: string[] = [];
    const tidy = (value: string | null | undefined) =>
      (value ?? "").replace(/[\u2066-\u2069]/g, "").trim();
    const rect = (element: Element) => element.getBoundingClientRect();
    const visible = (element: Element) => {
      const box = rect(element);
      return (
        box.width > 0 &&
        box.height > 0 &&
        getComputedStyle(element).display !== "none" &&
        getComputedStyle(element).visibility === "visible"
      );
    };
    const glyphs = (element: Element) => {
      const result: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (
          !node.textContent?.trim() ||
          node.parentElement?.closest(".sr-only")
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        result.push(...range.getClientRects());
      }
      return result;
    };
    const contained = (element: Element, label: string) => {
      const box = rect(element);
      for (const glyph of glyphs(element))
        if (
          glyph.left < box.left - 1.5 ||
          glyph.right > box.right + 1.5 ||
          glyph.top < box.top - 1.5 ||
          glyph.bottom > box.bottom + 1.5
        )
          failures.push(`Density glyph containment: ${label}`);
    };
    const atMost = (element: Element | null, limit: number, label: string) => {
      if (!element || !visible(element)) {
        failures.push(`Density missing section: ${label}`);
        return 0;
      }
      const height = rect(element).height;
      if (height > limit + 0.5)
        failures.push(`Density oversized section: ${label}`);
      return height;
    };
    const fa = document.documentElement.lang.startsWith("fa");
    const rows = [
      ...review.querySelectorAll<HTMLElement>(".invoice-line-summary"),
    ];
    if (rows.length !== expected.lines.length || rows.length !== 25)
      failures.push("Density must retain all 25 canonical rows");
    if (
      review.querySelector(
        ".invoice-line-summary.is-expanded,.receiving-editor-row",
      )
    )
      failures.push("Density proof requires closed lines");
    const rowMetrics = rows.map((row, index) => {
      const line = expected.lines[index];
      const name = row.querySelector<HTMLElement>(".receiving-product-name")!;
      const meta = row.querySelector<HTMLElement>(".receiving-product-meta")!;
      const category = meta.querySelector<HTMLElement>(
        ".receiving-product-category",
      )!;
      const count = meta.querySelector<HTMLElement>(
        ".receiving-line-check-count",
      );
      const wantedName = line?.new_name_en || line?.description;
      const wantedCount = line?.low_confidence_fields?.length ?? 0;
      const nameLines = new Set(
        glyphs(name).map((glyph) => Math.round(glyph.top)),
      ).size;
      const nameStyle = getComputedStyle(name);
      const metaStyle = getComputedStyle(meta);
      const wantedCountText = fa
        ? `${wantedCount} برای بررسی`
        : `${wantedCount} to check`;
      if (
        name.textContent !== wantedName ||
        name.title !== wantedName ||
        nameLines < 1 ||
        nameLines > 2
      )
        failures.push(`Density full canonical name: ${index + 1}`);
      if (
        Math.abs(parseFloat(nameStyle.lineHeight) - 20) > 0.1 ||
        parseFloat(nameStyle.fontSize) < 14 ||
        Math.abs(parseFloat(metaStyle.lineHeight) - 16) > 0.1 ||
        parseFloat(metaStyle.fontSize) < 12
      )
        failures.push(`Density readable typography: ${index + 1}`);
      if (
        !category ||
        !tidy(category.textContent) ||
        (!line.pricing_category &&
          tidy(category.textContent) !==
            (fa ? "انتخاب دسته" : "Choose a category"))
      )
        failures.push(`Density canonical category: ${index + 1}`);
      if (
        wantedCount &&
        (!count || tidy(count.textContent) !== wantedCountText)
      )
        failures.push(`Density canonical check count: ${index + 1}`);
      if (
        rect(meta).height > 16.5 ||
        (count &&
          category &&
          Math.abs(rect(count).top - rect(category).top) > 1)
      )
        failures.push(`Density category/check peer line: ${index + 1}`);
      const box = rect(row);
      const maximum = 24 + 2 + 16 + 20 * nameLines;
      if (box.height < 44 || box.height > maximum + 0.5)
        failures.push(`Density row content budget: ${index + 1}`);
      for (const cell of row.querySelectorAll<HTMLElement>(":scope > td")) {
        const style = getComputedStyle(cell);
        if (style.paddingTop !== "12px" || style.paddingBottom !== "12px")
          failures.push(`Density 12px row padding: ${index + 1}`);
        contained(
          cell,
          `row ${index + 1} ${cell.dataset.columnKey ?? "status"}`,
        );
      }
      for (const atomic of row.querySelectorAll(
        ".unit-fragment,.quantity-pair",
      ))
        if (visible(atomic) && atomic.getClientRects().length !== 1)
          failures.push(`Density atomic unit: ${index + 1}`);
      contained(name, `name ${index + 1}`);
      contained(meta, `metadata ${index + 1}`);
      const cost = row.querySelector(".receiving-cost-cell")!;
      const total = row.querySelector(".receiving-total-cell")!;
      if (!/\d[.,]\d{4}(?:\D|$)/.test(tidy(cost.textContent)))
        failures.push(`Density four-decimal cost: ${index + 1}`);
      if (!tidy(total.textContent))
        failures.push(`Density missing line total: ${index + 1}`);
      if (index && Math.abs(box.top - rect(rows[index - 1]).bottom - 4) > 0.5)
        failures.push(`Density 4px row gap: ${index + 1}`);
      return {
        index,
        height: box.height,
        maximum,
        nameLines,
        metadataHeight: rect(meta).height,
      };
    });
    const table = review.querySelector(".receiving-table")!;
    if (getComputedStyle(table).borderSpacing !== "0px 4px")
      failures.push("Density 4px table spacing");
    const headings = [...table.querySelectorAll("thead th")];
    if (headings.length !== 5 || headings.some((heading) => !visible(heading)))
      failures.push("Density must retain all five table headings");
    const chargeCount = expected.other_charges?.length ?? 0;
    const charges = review.querySelector(".receiving-charges")!;
    const chargeRows = [...charges.querySelectorAll(".receiving-charge")];
    if (chargeRows.length !== chargeCount)
      failures.push("Density must retain all canonical charges");
    for (const control of review.querySelectorAll<HTMLElement>(
      ".receiving-charge input,.receiving-charge .ui-segments,.receiving-charge-remove,.receiving-add-line .ui-select,.receiving-add-line .ui-button",
    ))
      if (!visible(control) || Math.abs(rect(control).height - 44) > 0.5)
        failures.push("Density genuine charge/footer 44px control");
    if (
      review.querySelectorAll(".receiving-add-line .ui-button").length !== 3 ||
      review.querySelectorAll(".receiving-add-line .ui-select").length !== 1
    )
      failures.push("Density must retain all add actions and product picker");
    const totals = review.querySelector(".receiving-totals")!;
    if (
      totals.querySelectorAll(".receiving-total-row").length !== 7 ||
      totals.querySelectorAll(".receiving-totals-group").length !== 2
    )
      failures.push("Density must retain the complete grouped totals");
    for (const group of totals.querySelectorAll(".receiving-totals-group"))
      for (const amount of group.querySelectorAll(".receiving-total-row"))
        atMost(amount, 32, "total row");
    atMost(totals.querySelector(".receiving-total-payable"), 56, "Payable");
    // Three genuine field rows, including imported optional-paper review
    // actions, plus the standard More disclosure. No field is hidden to fit.
    const details = review.querySelector(".receiving-details")!;
    const detailFields = [
      ...details.querySelectorAll(".receiving-details-grid > .field"),
    ];
    if (
      detailFields.length !== 8 ||
      detailFields.some((field) => !visible(field))
    )
      failures.push("Density must retain all invoice detail fields");
    for (const field of detailFields) {
      const control = field.querySelector(
        ".ui-select,.ui-input,input:not([type='hidden']),.receiving-readonly-field",
      );
      if (
        !control ||
        !visible(control) ||
        Math.abs(rect(control).height - 44) > 0.5
      )
        failures.push("Density genuine detail 44px field");
    }
    const parts = {
      header: {
        actual: atMost(
          review.querySelector(":scope > .receiving-header"),
          132,
          "review header",
        ),
        maximum: 132,
      },
      progress: {
        actual: atMost(
          review.querySelector(":scope > .receiving-progress"),
          50,
          "progress",
        ),
        maximum: 50,
      },
      details: {
        actual: atMost(details, 434, "invoice details"),
        maximum: 434,
      },
      totals: { actual: atMost(totals, 390, "grouped totals"), maximum: 390 },
      linesHeading: {
        actual: atMost(
          review.querySelector(".receiving-lines-heading"),
          48,
          "lines heading",
        ),
        maximum: 48,
      },
      tableHeader: {
        actual: atMost(table.querySelector("thead"), 36, "table header"),
        maximum: 36,
      },
      charges: {
        actual: atMost(
          charges,
          20 + 20 + 10 + 44 * chargeCount + 8 * Math.max(0, chargeCount - 1),
          "inline charges",
        ),
        maximum:
          20 + 20 + 10 + 44 * chargeCount + 8 * Math.max(0, chargeCount - 1),
      },
      footer: {
        actual: atMost(
          review.querySelector(".receiving-add-line"),
          60,
          "add footer",
        ),
        maximum: 60,
      },
    };
    // Table spacing surrounds its header and every body row. The card has
    // 20/16px padding, two 1px borders, three 8px content gaps, then the
    // approved 20px charge margin and 16px add-footer margin.
    const lineMaximum =
      rowMetrics.reduce((sum, row) => sum + row.maximum, 0) +
      4 * (rows.length + 2) +
      parts.tableHeader.maximum +
      parts.linesHeading.maximum +
      parts.charges.maximum +
      parts.footer.maximum +
      38 +
      3 * 8 +
      20 +
      16;
    const lineHeight = atMost(
      review.querySelector(".receiving-lines"),
      lineMaximum,
      "complete lines card",
    );
    // Two 8px inter-card gaps; 8px after header/progress; 16px bottom padding.
    const reviewMaximum =
      parts.header.maximum +
      8 +
      parts.progress.maximum +
      8 +
      parts.details.maximum +
      8 +
      lineMaximum +
      8 +
      parts.totals.maximum +
      16;
    const reviewHeight = rect(review).height;
    if (reviewHeight > reviewMaximum + 0.5)
      failures.push("Density composed review budget");
    const outside = document.documentElement.scrollHeight - reviewHeight;
    if (outside > 116.5) failures.push("Density app/header outer budget");
    if (document.documentElement.scrollWidth > innerWidth + 1)
      failures.push("Density document horizontal overflow");
    return {
      rows: rowMetrics,
      parts,
      lineHeight,
      lineMaximum,
      reviewHeight,
      reviewMaximum,
      documentHeight: document.documentElement.scrollHeight,
      documentMaximum: reviewMaximum + 116,
      outside,
      failures,
    };
  }, invoice);
}
