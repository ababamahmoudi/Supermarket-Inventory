import { expect, test } from "@playwright/test";
import { signIn, setBranch, setLanguage } from "./helpers";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";
import {
  inspectDashboardCardLayout,
  inspectDashboardColumnSpacing,
} from "./dashboard-card-layout";

for (const language of ["en", "fa"] as const)
  test(`K9 Dashboard independent columns and supplier glyph containment ${language}`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await signIn(page, "Manager");
    await setBranch(page, "North York");
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    await expect(page.locator(".r2c-dashboard")).toBeVisible();
    const reports = [];
    for (const width of [
      390, 759, 760, 768, 900, 950, 951, 1000, 1024, 1100, 1101, 1180, 1440,
      1920, 390, 1440, 1000,
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const responsive = await inspectResponsiveLayout(
        page,
        "K9 Dashboard",
        language,
        width,
      );
      const supplierCells = await page
        .locator(".dashboard-invoices td")
        .evaluateAll((cells) =>
          cells
            .filter((cell) => cell.textContent?.includes("Distributors"))
            .map((cell) => {
              const rect = (element: Element) => {
                const r = element.getBoundingClientRect();
                return {
                  left: r.left,
                  right: r.right,
                  top: r.top,
                  bottom: r.bottom,
                  width: r.width,
                };
              };
              const walker = document.createTreeWalker(
                cell,
                NodeFilter.SHOW_TEXT,
              );
              const words = [];
              for (
                let node = walker.nextNode();
                node;
                node = walker.nextNode()
              ) {
                const text = node.textContent ?? "";
                for (const match of text.matchAll(/\S+/g)) {
                  const range = document.createRange();
                  range.setStart(node, match.index!);
                  range.setEnd(node, match.index! + match[0].length);
                  words.push({
                    text: match[0],
                    rects: [...range.getClientRects()].map((r) => ({
                      left: r.left,
                      right: r.right,
                      top: r.top,
                      bottom: r.bottom,
                      width: r.width,
                    })),
                  });
                }
              }
              const style = getComputedStyle(cell);
              return {
                text: cell.textContent,
                cell: rect(cell),
                table: rect(cell.closest("table")!),
                display: style.display,
                whiteSpace: style.whiteSpace,
                wordBreak: style.wordBreak,
                overflowWrap: style.overflowWrap,
                words,
              };
            }),
        );
      const layout = await inspectDashboardCardLayout(page);
      const spacing = await inspectDashboardColumnSpacing(page);
      const report = { width, responsive, supplierCells, layout, spacing };
      reports.push(report);
      // Keep first-failure rectangles, rather than retrying a failed glyph oracle.
      if (
        responsive.failures.length ||
        spacing.failures.length ||
        layout.failures.length
      )
        await info.attach(`first-failure-${width}.json`, {
          body: JSON.stringify(report, null, 2),
          contentType: "application/json",
        });
      expect(responsive.failures).toEqual([]);
      expect(layout.failures).toEqual([]);
      expect(spacing.failures).toEqual([]);
      expect(layout.sameRow).toBe(width > 1100);
      if (width >= 951) {
        for (const column of spacing.columns) {
          expect(column.display).toBe("flex");
          expect(column.direction).toBe("column");
        }
      } else if (width >= 760) {
        const aside = spacing.columns.find(
          (column) => column.name === "dashboard-aside",
        )!;
        expect(aside.display).toBe("grid");
        expect(aside.gridColumns.split(/\s+/)).toHaveLength(2);
      } else {
        for (const column of spacing.columns)
          expect(column.display).toBe("contents");
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .locator(".dashboard-main > .card")
      .first()
      .evaluate((card) => {
        const spacer = document.createElement("div");
        spacer.id = "k9-deliberate-gap";
        spacer.style.cssText =
          "block-size:64px;min-block-size:64px;flex:0 0 64px";
        card.after(spacer);
      });
    expect(
      (await inspectDashboardColumnSpacing(page)).failures.some((failure) =>
        failure.includes("dashboard-main: card gap"),
      ),
    ).toBe(true);
    await page
      .locator("#k9-deliberate-gap")
      .evaluate((element) => element.remove());
    expect((await inspectDashboardColumnSpacing(page)).failures).toEqual([]);
    // Genuine overflowing supplier text must still fail the strict shared glyph oracle.
    const supplier = page
      .locator(".dashboard-invoices td")
      .filter({ hasText: "Distributors" })
      .first();
    await expect(supplier).toBeVisible();
    await supplier
      .locator("bdi")
      .evaluate((cell) =>
        cell.setAttribute(
          "style",
          "display:inline-block;white-space:nowrap;transform:translateX(500px)",
        ),
      );
    const broken = await inspectResponsiveLayout(
      page,
      "K9 supplier negative",
      language,
      1440,
    );
    expect(
      broken.failures.some((failure: string) =>
        failure.includes("text leaves cell"),
      ),
    ).toBe(true);
    await supplier
      .locator("bdi")
      .evaluate((cell) => cell.removeAttribute("style"));
    expect(
      (
        await inspectResponsiveLayout(
          page,
          "K9 Dashboard restored",
          language,
          1440,
        )
      ).failures,
    ).toEqual([]);
    await info.attach(`dashboard-${language}.json`, {
      body: JSON.stringify(reports, null, 2),
      contentType: "application/json",
    });
  });
