import { expect, test } from "@playwright/test";
import Decimal from "decimal.js";
import {
  appearance,
  button,
  exact,
  settled,
} from "../scripts/c5-browser-proof.mjs";
import {
  chooseC8Date,
  inspectC8Layout,
  openC8ProductEditor,
  prepareC8NewOrder,
  readC8State,
  visitC8,
} from "../scripts/capture-c8-proof.mjs";
import { setBranch, setLanguage, signIn } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`C8 supplier purchase bars keep 3:1 contrast and dark filled primary/summary cards use approved blue (${language})`, async ({
    page,
  }, info) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    const before = await readC8State(page);
    const reports = [];
    for (const theme of ["light", "dark"] as const) {
      await appearance(page, theme === "dark" ? "en-dark" : "en-light");
      await setLanguage(page, language);
      await visitC8(page, "dashboard");
      await expect(page.locator(".purchase-bar-row").first()).toBeVisible();
      await page.mouse.move(0, 0);
      const proof = await page.evaluate(() => {
        const parse = (value: string) => {
          const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
          return [
            channels[0] ?? 0,
            channels[1] ?? 0,
            channels[2] ?? 0,
            channels[3] ?? 1,
          ];
        };
        const blend = (foreground: number[], background: number[]) =>
          foreground
            .slice(0, 3)
            .map(
              (value, index) =>
                value * foreground[3] + background[index] * (1 - foreground[3]),
            )
            .concat(1);
        const surface = (element: Element) => {
          const ancestors: Element[] = [];
          for (
            let current: Element | null = element;
            current;
            current = current.parentElement
          )
            ancestors.unshift(current);
          return ancestors.reduce(
            (background, current) =>
              blend(
                parse(getComputedStyle(current).backgroundColor),
                background,
              ),
            [255, 255, 255, 1],
          );
        };
        const luminance = (colour: number[]) =>
          colour
            .slice(0, 3)
            .map((channel) => channel / 255)
            .map((channel) =>
              channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4,
            )
            .reduce(
              (sum, channel, index) =>
                sum + channel * [0.2126, 0.7152, 0.0722][index],
              0,
            );
        const ratio = (first: number[], second: number[]) => {
          const a = luminance(first),
            b = luminance(second);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const bars = Array.from(
          document.querySelectorAll(".purchase-bar-row"),
          (row) => {
            const track = row.querySelector(".purchase-bar-track")!,
              fill = track.querySelector("span")!;
            const style = getComputedStyle(fill),
              background = surface(track),
              colour = parse(style.backgroundColor);
            colour[3] *= Number(style.opacity);
            return {
              supplier: row.textContent,
              fill: style.backgroundColor,
              opacity: Number(style.opacity),
              width: fill.getBoundingClientRect().width,
              contrast: ratio(blend(colour, background), background),
            };
          },
        );
        const primary = document.querySelector(".page-header .button-primary")!;
        const summaries = Array.from(
          document.querySelectorAll(".dashboard-kpis .kpi-accent"),
        );
        const filled = [primary, ...summaries].map((element) => {
          const text = element.querySelector(".kpi-value") ?? element;
          const style = getComputedStyle(element),
            foreground = getComputedStyle(text).color;
          return {
            label: element.textContent,
            fill: style.backgroundColor,
            text: foreground,
            contrast: ratio(
              blend(parse(foreground), surface(element)),
              surface(element),
            ),
          };
        });
        return { bars, filled, summaryCount: summaries.length };
      });
      reports.push({ theme, language, ...proof });
      expect(proof.bars.length).toBeGreaterThanOrEqual(3);
      for (const bar of proof.bars) {
        expect(bar.width, bar.supplier ?? "Real supplier bar").toBeGreaterThan(
          0,
        );
        expect(
          bar.contrast,
          bar.supplier ?? "Supplier bar contrast",
        ).toBeGreaterThanOrEqual(3);
      }
      expect(proof.summaryCount).toBe(2);
      for (const control of proof.filled) {
        expect(control.fill).toBe("rgb(43, 89, 195)");
        expect(control.text).toBe("rgb(255, 255, 255)");
        expect(control.contrast).toBeGreaterThanOrEqual(4.5);
      }
    }
    await info.attach(
      "C8 actual light/dark supplier-bar and solid-fill contrast",
      {
        body: JSON.stringify(reports, null, 2),
        contentType: "application/json",
      },
    );
    const after = await readC8State(page);
    expect(after.products).toEqual(before.products);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.ledger).toEqual(before.ledger);
  });
  test(`C8 Edit product date rows, column-filling selects and hairlines render as requested (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    const before = await readC8State(page);
    const dialog = await openC8ProductEditor(page, "0006");
    const fields = await dialog
      .locator(".product-editor-fields .field:has(.ui-select)")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const control = element.querySelector(".ui-select")!;
          const field = element.getBoundingClientRect(),
            input = control.getBoundingClientRect();
          return {
            label: element.querySelector("label")?.textContent,
            width: field.width,
            controlWidth: input.width,
            startGap: input.left - field.left,
            endGap: field.right - input.right,
          };
        }),
      );
    expect(fields.length).toBeGreaterThanOrEqual(4);
    for (const field of fields) {
      expect(
        Math.abs(field.width - field.controlWidth),
        field.label ?? "Select fills its column",
      ).toBeLessThanOrEqual(1);
      expect(Math.abs(field.startGap)).toBeLessThanOrEqual(1);
      expect(Math.abs(field.endGap)).toBeLessThanOrEqual(1);
    }
    const sections = await dialog
      .locator(".product-editor-section,.product-date-editor")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          return {
            title: element.querySelector("h3")?.textContent,
            width: parseFloat(style.borderTopWidth),
            style: style.borderTopStyle,
            colour: style.borderTopColor,
          };
        }),
      );
    expect(sections).toHaveLength(4);
    for (const section of sections) {
      expect(section.width, section.title ?? "Section hairline").toBe(1);
      expect(section.style).toBe("solid");
      expect(section.colour).not.toMatch(/rgba\([^)]*,\s*0\)/);
    }
    const inline = dialog.locator(".product-editor-date-inline");
    await inline.scrollIntoViewIfNeeded();
    const add = button(inline, "Add", "افزودن");
    const date = inline.getByLabel(exact("Date", "تاریخ"));
    const localDay = await page.evaluate(
      (timeZone) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      before.config.company.timezone,
    );
    const relative = (days: number) => {
      const value = new Date(localDay + "T12:00:00Z");
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };
    for (const days of [-1, 60]) {
      await chooseC8Date(page, date, relative(days));
      await add.click();
    }
    const inlineProof = await inline.evaluate((element) => {
      const labels = Array.from(
        element.querySelectorAll(".field > label"),
        (label) => {
          const range = document.createRange();
          range.selectNodeContents(label);
          return {
            text: label.textContent,
            lines: Array.from(range.getClientRects())
              .filter((rect) => rect.width > 0)
              .map((rect) => rect.top),
            width: label.getBoundingClientRect().width,
            textWidth: range.getBoundingClientRect().width,
          };
        },
      );
      const controls = Array.from(
        element.querySelectorAll(
          ".field > input,.field > button,.field > .ui-select,.field > .ui-date",
        ),
        (control) => ({
          height: control.getBoundingClientRect().height,
          bottom: control.getBoundingClientRect().bottom,
        }),
      );
      const add = element.querySelector(":scope > button")!;
      return {
        labels,
        controls,
        add: {
          height: add.getBoundingClientRect().height,
          bottom: add.getBoundingClientRect().bottom,
        },
      };
    });
    expect(inlineProof.labels).toHaveLength(4);
    expect(inlineProof.controls).toHaveLength(4);
    for (const label of inlineProof.labels) {
      expect(
        new Set(label.lines.map((top) => Math.round(top))).size,
        label.text ?? "Single-line label",
      ).toBe(1);
      expect(label.textWidth).toBeLessThanOrEqual(label.width + 1);
    }
    expect(inlineProof.add.height).toBeCloseTo(44, 0);
    for (const control of inlineProof.controls) {
      expect(control.height).toBeCloseTo(44, 0);
      if (await page.evaluate(() => window.innerWidth >= 760))
        expect(
          Math.abs(control.bottom - inlineProof.add.bottom),
        ).toBeLessThanOrEqual(1);
    }
    const rows = await dialog
      .locator(".product-editor-date-row")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const value = element.querySelector(".product-editor-date-value")!,
            status = element.querySelector(".product-editor-date-status")!,
            remove = element.querySelector(".product-editor-remove-date")!,
            dot = element.querySelector(".product-date-dot")!;
          const rects = [value, status, remove].map((part) =>
            part.getBoundingClientRect(),
          );
          const token = dot.classList.contains("danger")
            ? "--danger-dot"
            : dot.classList.contains("pending")
              ? "--pending-dot"
              : "--approved-dot";
          const probe = document.createElement("span");
          probe.style.color = `var(${token})`;
          dot.append(probe);
          const expectedColour = getComputedStyle(probe).color;
          probe.remove();
          return {
            text: status.textContent,
            centers: rects.map((rect) => rect.top + rect.height / 2),
            statusWhiteSpace: getComputedStyle(status).whiteSpace,
            dotColour: getComputedStyle(dot).backgroundColor,
            expectedColour,
            dotKind: dot.className,
            edges: rects.map((rect) => ({
              left: rect.left,
              right: rect.right,
            })),
          };
        }),
      );
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((row) => row.dotKind.includes("danger"))).toBe(true);
    expect(rows.some((row) => row.dotKind.includes("pending"))).toBe(true);
    expect(rows.some((row) => row.dotKind.includes("approved"))).toBe(true);
    for (const row of rows) {
      expect(
        Math.max(...row.centers) - Math.min(...row.centers),
      ).toBeLessThanOrEqual(1);
      expect(row.statusWhiteSpace).toBe("nowrap");
      expect(row.text).not.toMatch(/\d\s{2,}(?:days?|روز)/);
      expect(row.dotColour).toBe(row.expectedColour);
      for (let index = 1; index < row.edges.length; index++)
        expect(
          Math.min(row.edges[index - 1].right, row.edges[index].right) -
            Math.max(row.edges[index - 1].left, row.edges[index].left),
        ).toBeLessThanOrEqual(1);
    }
    const proof = await inspectC8Layout(
      page,
      "edit-product-dates",
      language,
      await page.evaluate(() => window.innerWidth),
    );
    expect(proof.failures).toEqual([]);
    await button(dialog, "Cancel", "انصراف").click();
    const after = await readC8State(page);
    expect(after.products).toEqual(before.products);
    expect(after.expiry).toEqual(before.expiry);
    expect(after.ledger).toEqual(before.ledger);
  });

  test(`C8 New order uses filled inputs and headers, units and totals share their real columns (${language})`, async ({
    page,
  }) => {
    // Use the required wide review context for the full seven-column proof;
    // the phone project retains its actual 390px field and containment guards.
    if ((page.viewportSize()?.width ?? 0) >= 760)
      await page.setViewportSize({ width: 1440, height: 1080 });
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    const before = await readC8State(page);
    const form = await prepareC8NewOrder(page);
    await setLanguage(page, language);
    const first = form.locator(".order-items-table tbody > tr").first();
    await expect(first.locator("td").nth(3)).toContainText(
      language === "en" ? "= 48 units" : "= 48 واحد",
    );
    const cost = first.getByRole("textbox", {
      name: /^(Expected unit cost|هزینهٔ مورد انتظار واحد) —/,
    });
    await cost.fill("18.4000");
    await cost.blur();
    await settled(page);
    await expect(cost).toHaveValue("18.40");
    await expect(first).toContainText("$18.40");
    await expect(first).not.toContainText("$18.4000");
    const second = form.locator(".order-items-table tbody > tr").nth(1);
    await expect(second.locator("td").nth(3)).toContainText(
      language === "en" ? "= 24 units" : "= 24 واحد",
    );
    const secondCost = second.getByRole("textbox", {
      name: /^(Expected unit cost|هزینهٔ مورد انتظار واحد) —/,
    });
    const lineAmount = new Decimal(await cost.inputValue()).times(48);
    const grandAmount = lineAmount.plus(
      new Decimal(await secondCost.inputValue()).times(24),
    );
    expect(lineAmount.toFixed(2)).toBe("883.20");
    expect(grandAmount.toFixed(2)).toBe("933.60");
    await expect(first.locator("td").last()).toHaveText(
      "$" + lineAmount.toFixed(2),
    );
    await expect(form.locator(".order-total strong")).toHaveText(
      "$" + grandAmount.toFixed(2),
    );
    const inputs = await form
      .locator(".order-items-table input")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element),
            parent = getComputedStyle(element.closest("td")!);
          const visibleBorder =
            [
              style.borderTopColor,
              style.borderRightColor,
              style.borderBottomColor,
              style.borderLeftColor,
            ].some((color) => !/rgba\([^)]*,\s*0\)/.test(color)) &&
            [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ].some((width) => parseFloat(width) > 0);
          return {
            fill: style.backgroundColor,
            parentFill: parent.backgroundColor,
            visibleBorder,
            outline: style.outlineStyle,
            shadow: style.boxShadow,
          };
        }),
      );
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    for (const input of inputs) {
      expect(input.visibleBorder).toBe(false);
      expect(input.outline).toBe("none");
      expect(input.shadow).toBe("none");
      expect(input.fill).not.toBe(input.parentFill);
      expect(input.fill).not.toMatch(/rgba\([^)]*,\s*0\)/);
    }
    const alignment = await form.evaluate((element) => {
      const table = element.querySelector(".order-items-table table")!;
      const headers = Array.from(table.querySelectorAll("thead th"));
      const row = table.querySelector("tbody > tr")!;
      const cells = Array.from(row.querySelectorAll(":scope > td"));
      const total = element.querySelector(".order-total");
      const value = total?.querySelector("strong");
      // This cell contains the real formatted total; pseudo-labels are not
      // text nodes, so its Range measures only the complete amount glyphs.
      const lastMoney = cells.at(-1);
      const edge = (node: Element | null | undefined) => {
        if (!node) return null;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      };
      return {
        width: window.innerWidth,
        headers: headers.map((header, index) => ({
          label: header.textContent,
          visible:
            getComputedStyle(header).display !== "none" &&
            header.getBoundingClientRect().width > 0,
          left: header.getBoundingClientRect().left,
          right: header.getBoundingClientRect().right,
          cellLeft: cells[index].getBoundingClientRect().left,
          cellRight: cells[index].getBoundingClientRect().right,
          align: getComputedStyle(header).textAlign,
        })),
        total: total
          ? {
              left: total.getBoundingClientRect().left,
              right: total.getBoundingClientRect().right,
              text: total.textContent,
              value: edge(value),
              columnValue: edge(lastMoney),
            }
          : null,
      };
    });
    expect(alignment.headers).toHaveLength(7);
    if (alignment.width >= 760)
      for (const [index, header] of alignment.headers.entries()) {
        expect(header.visible).toBe(true);
        expect(
          Math.abs(header.left - header.cellLeft),
          header.label ?? "Header left edge",
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(header.right - header.cellRight),
          header.label ?? "Header right edge",
        ).toBeLessThanOrEqual(1);
        if (index >= 2) expect(header.align).toMatch(/^(right|end)$/);
      }
    expect(
      alignment.total,
      "Expected total has its own aligned rendered footer",
    ).not.toBeNull();
    expect(alignment.total!.value).not.toBeNull();
    expect(alignment.total!.columnValue).not.toBeNull();
    if (alignment.width >= 760)
      expect(
        Math.abs(
          alignment.total!.value!.right - alignment.total!.columnValue!.right,
        ),
      ).toBeLessThanOrEqual(2);
    const proof = await inspectC8Layout(
      page,
      "new-order",
      language,
      await page.evaluate(() => window.innerWidth),
    );
    expect(proof.containment.rowCount).toBeGreaterThan(0);
    expect(proof.failures).toEqual([]);
    const after = await readC8State(page);
    expect(after.orders).toEqual(before.orders);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
  });
}
