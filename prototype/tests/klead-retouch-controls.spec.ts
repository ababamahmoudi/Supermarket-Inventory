import { expect, test, type Locator, type Page } from "@playwright/test";
import { openShellAction, setLanguage, signIn } from "./helpers";
import {
  button,
  choose,
  exact,
  field,
  settled,
} from "../scripts/c5-browser-proof.mjs";

test.setTimeout(90000);

async function start(page: Page, language: "en" | "fa") {
  await signIn(page, "Supervisor");
  await setLanguage(page, language);
}

async function dark(page: Page, language: "en" | "fa") {
  await (
    await openShellAction(
      page,
      language === "fa" ? "تغییر به تم تیره" : "Switch to dark theme",
    )
  ).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settled(page);
}

async function manual(page: Page, language: "en" | "fa") {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await button(page, "New invoice", "فاکتور جدید").click();
  await button(page, "Manual entry", "ورود دستی").click();
  await choose(
    page,
    page.locator("#invoice-supplier"),
    "\u2066Fresh Valley Foods\u2069",
  );
  await page
    .getByLabel(
      exact(
        "Supplier invoice number (optional)",
        "شماره فاکتور تأمین‌کننده (اختیاری)",
      ),
    )
    .fill("DEMO-C6-MISSING");
  await button(page, "Add line", "افزودن ردیف").click();
  await expect(page.locator(".invoice-line-detail")).toBeVisible();
  await setLanguage(page, language);
  await page.locator("main h1").click();
  await page.mouse.move(0, 0);
  await settled(page);
}

async function editor(page: Page) {
  await page.goto("/#lookup?search=0001");
  await expect(page.locator(".lookup-detail")).toBeVisible();
  await page
    .locator(".lookup-detail")
    .getByRole("button", { name: /^(Edit |ویرایش )/ })
    .click();
  const dialog = page.locator(".product-editor-dialog[open]");
  await expect(dialog).toBeVisible();
  await settled(page);
  return dialog;
}

async function stored(page: Page) {
  return page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("supermarket-prototype-v1")!);
    return { lines: state.invoice.lines, ledger: state.ledger };
  });
}

/** Checks painted surfaces, including transparent nested fields and outlines. */
async function appearance(control: Locator) {
  return control.evaluate((element) => {
    const rgba = (value: string) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const blend = (top: number[], bottom: number[]) =>
      top
        .slice(0, 3)
        .map((channel, i) => channel * top[3] + bottom[i] * (1 - top[3]))
        .concat(1);
    const surface = (node: Element) => {
      const layers: number[][] = [];
      for (
        let current: Element | null = node;
        current;
        current = current.parentElement
      )
        layers.unshift(rgba(getComputedStyle(current).backgroundColor));
      return layers.reduce(
        (bottom, top) => blend(top, bottom),
        [255, 255, 255, 1],
      );
    };
    const token = (name: string) => {
      const sample = document.createElement("span");
      sample.style.color = `var(${name})`;
      sample.style.visibility = "hidden";
      document.body.append(sample);
      const result = getComputedStyle(sample).color;
      sample.remove();
      return result;
    };
    const luminance = (channels: number[]) =>
      channels
        .slice(0, 3)
        .map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (total, channel, i) => total + channel * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    const style = getComputedStyle(element);
    const fill = surface(element);
    const ink = blend(rgba(style.color), fill);
    const light = Math.max(luminance(fill), luminance(ink));
    const shade = Math.min(luminance(fill), luminance(ink));
    const borderVisible = ["Top", "Right", "Bottom", "Left"].some((side) => {
      const width = style.getPropertyValue(
        `border-${side.toLowerCase()}-width`,
      );
      const colour = style.getPropertyValue(
        `border-${side.toLowerCase()}-color`,
      );
      const line = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
      return parseFloat(width) > 0 && line !== "none" && rgba(colour)[3] > 0;
    });
    const box = element.getBoundingClientRect();
    return {
      colour: style.color,
      background: style.backgroundColor,
      surface: fill.slice(0, 3).map(Math.round),
      borderVisible,
      outlineVisible:
        parseFloat(style.outlineWidth) > 0 &&
        style.outlineStyle !== "none" &&
        rgba(style.outlineColor)[3] > 0,
      shadow: style.boxShadow,
      radii: [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ].map(parseFloat),
      height: box.height,
      width: box.width,
      contrast: (light + 0.05) / (shade + 0.05),
      tokens: {
        surface: token("--surface"),
        surfaceRgb: rgba(token("--surface")).slice(0, 3).map(Math.round),
        text: token("--text"),
        field: token("--field-fill"),
        danger: token("--danger"),
        dangerFill: token("--danger-bg"),
        neutral: token("--neutral-fill"),
        accent: token("--accent"),
        tint: token("--accent-soft"),
        tintInk: token("--accent-tint-text"),
        hairline: token("--page-control-border"),
      },
      borderColour: style.borderTopColor,
      borderWidth: style.borderTopWidth,
    };
  });
}

for (const language of ["en", "fa"] as const) {
  test(`Klead retouch: expanded invoice resting controls retain focus and error cues (${language})`, async ({
    page,
  }, info) => {
    await manual(page, language);
    const controls = page.locator(
      '.invoice-line .field > input:not([type="file"]), .invoice-line .field > button[role="combobox"]',
    );
    expect(await controls.count()).toBeGreaterThan(4);
    const report = [];
    for (const control of await controls.all()) {
      if (!(await control.isVisible())) continue;
      await expect(control).not.toHaveAttribute("aria-invalid", "true");
      const style = await appearance(control);
      report.push({ name: await control.getAttribute("id"), ...style });
      expect
        .soft(
          style.borderVisible,
          "ordinary field has no painted resting border",
        )
        .toBe(false);
      expect
        .soft(style.outlineVisible, "ordinary field has no resting contour")
        .toBe(false);
      expect
        .soft(style.shadow, "ordinary field has no resting glow")
        .toBe("none");
      expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
    }
    await info.attach("Resting invoice controls", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    const quantity = page.locator("#invoice-line-0-invoiced");
    await quantity.focus();
    const focused = await appearance(quantity);
    expect.soft(focused.borderColour).toBe(focused.tokens.accent);
    expect
      .soft(focused.shadow, "keyboard focus remains visible")
      .not.toBe("none");
    await quantity.fill("");
    await button(page, "Post invoice", "ثبت فاکتور").click();
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    const invalid = await appearance(quantity);
    expect.soft(invalid.borderVisible).toBe(true);
    expect.soft(invalid.borderColour).toBe(invalid.tokens.danger);
  });

  test(`Klead retouch: Remove line has a destructive tone and preserves Undo (${language})`, async ({
    page,
  }) => {
    await manual(page, language);
    const before = await stored(page);
    const remove = button(page, "Remove line", "حذف ردیف");
    await expect(remove).toBeVisible();
    expect(
      await remove.evaluate((element) => !!element.closest("tbody > tr")),
    ).toBe(true);
    const style = await appearance(remove);
    expect.soft(style.colour).toBe(style.tokens.danger);
    // docs/design-language.md:76: "in rows neutral fill/red text".
    expect.soft(style.background).toBe(style.tokens.neutral);
    expect.soft(style.borderVisible).toBe(false);
    expect.soft(style.outlineVisible).toBe(false);
    expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
    await remove.click();
    await expect(page.locator(".invoice-line")).toHaveCount(0);
    await button(page.getByTestId("undo-toast"), "Undo", "واگرد").click();
    await expect(page.locator(".invoice-line")).toHaveCount(1);
    expect(await stored(page)).toEqual(before);
  });

  test(`Klead retouch: hyphenated invoice reference is whole and contained (${language})`, async ({
    page,
  }, info) => {
    await manual(page, language);
    await button(page, "Post invoice", "ثبت فاکتور").click();
    await expect(
      page.getByRole("alert", { name: exact("What's missing", "موارد ناقص") }),
    ).toBeVisible();
    await settled(page);
    const reference = page.locator(
      ".invoice-draft-list tbody td:first-child .ltr-fragment",
    );
    await expect(reference).toHaveText("DEMO-C6-MISSING");
    const geometry = await reference.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const boxes = [...range.getClientRects()].filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      const cell = element.closest("td")!.getBoundingClientRect();
      return {
        whiteSpace: getComputedStyle(element).whiteSpace,
        lines: new Set(boxes.map((rect) => Math.round(rect.top))).size,
        contained: boxes.every(
          (rect) => rect.left >= cell.left - 2 && rect.right <= cell.right + 2,
        ),
      };
    });
    await info.attach("Atomic invoice reference", {
      body: JSON.stringify(geometry),
      contentType: "application/json",
    });
    expect.soft(geometry.whiteSpace).toBe("nowrap");
    expect.soft(geometry.lines).toBe(1);
    expect.soft(geometry.contained).toBe(true);
  });

  test(`Klead retouch: Lookup category choices are pills with normal and selected token surfaces (${language})`, async ({
    page,
  }, info) => {
    await start(page, language);
    await page.goto("/#lookup");
    const chips = page.locator(".lookup-category-chips");
    const reports = [];
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark") await dark(page, language);
      await page.mouse.move(0, 0);
      await settled(page);
      for (const control of await chips.locator("button").all()) {
        const style = await appearance(control);
        const selected =
          (await control.getAttribute("aria-pressed")) === "true";
        reports.push({
          theme,
          text: await control.innerText(),
          selected,
          ...style,
        });
        for (const radius of style.radii)
          expect
            .soft(radius, "category chip has a fully round cap")
            .toBeGreaterThanOrEqual(Math.min(style.height, style.width) / 2);
        expect
          .soft(style.background)
          .toBe(selected ? style.tokens.tint : style.tokens.surface);
        expect
          .soft(style.colour)
          .toBe(selected ? style.tokens.tintInk : style.tokens.text);
        if (!selected) {
          expect
            .soft(style.borderVisible, "normal category choice has a hairline")
            .toBe(true);
          expect.soft(style.borderColour).toBe(style.tokens.hairline);
        }
        expect.soft(style.shadow).toBe("none");
        expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
      }
      const choice = chips.locator(".filter-chip").nth(1);
      await choice.click();
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await page.locator("main h1").click();
      await page.mouse.move(0, 0);
      await settled(page);
      const selected = await appearance(choice);
      expect.soft(selected.background).toBe(selected.tokens.tint);
      expect.soft(selected.colour).toBe(selected.tokens.tintInk);
      await chips.locator(".filter-chip").first().click();
    }
    await info.attach("Rendered category choices", {
      body: JSON.stringify(reports, null, 2),
      contentType: "application/json",
    });
  });

  test(`Klead retouch: tables paint one inset row divider without cell underlines (${language})`, async ({
    page,
  }, info) => {
    await start(page, language);
    await page.goto("/#products");
    const row = page
      .locator(".catalog-products-table tbody > tr:not(.table-expanded-row)")
      .first();
    await expect(row).toBeVisible();
    await page.mouse.move(0, 0);
    await settled(page);
    const geometry = await row.evaluate((element) => {
      const style = getComputedStyle(element);
      const size = style.backgroundSize.match(
        /^(calc\([^)]*\)|[\d.]+(?:%|px))\s+([\d.]+px)$/,
      );
      const measuring = document.createElement("div");
      measuring.style.cssText = `position:fixed;visibility:hidden;width:${element.getBoundingClientRect().width}px;`;
      const paint = document.createElement("div");
      paint.style.width = size?.[1] ?? "0px";
      paint.style.height = size?.[2] ?? "0px";
      measuring.append(paint);
      document.body.append(measuring);
      const line = paint.getBoundingClientRect();
      const result = {
        rowRule: style.backgroundImage,
        repeat: style.backgroundRepeat,
        position: style.backgroundPosition,
        inset: (element.getBoundingClientRect().width - line.width) / 2,
        lineHeight: line.height,
        cells: [...element.querySelectorAll(":scope > td")].map((cell) => {
          const value = getComputedStyle(cell);
          return {
            shadow: value.boxShadow,
            image: value.backgroundImage,
            border: value.borderBottomWidth,
          };
        }),
      };
      measuring.remove();
      return result;
    });
    await info.attach("Whole-row divider geometry", {
      body: JSON.stringify(geometry, null, 2),
      contentType: "application/json",
    });
    expect.soft(geometry.rowRule).not.toBe("none");
    expect.soft(geometry.repeat).toBe("no-repeat");
    expect.soft(geometry.position).toBe("50% 100%");
    expect.soft(geometry.inset).toBeCloseTo(16, 0);
    expect.soft(geometry.lineHeight).toBe(1);
    expect(geometry.cells.length).toBeGreaterThan(1);
    for (const cell of geometry.cells) {
      expect
        .soft(cell.shadow, "cell has no independent underline")
        .toBe("none");
      expect.soft(cell.image).toBe("none");
      expect.soft(cell.border).toBe("0px");
    }
  });

  test(`Klead retouch: product caption shares the title and body inset (${language})`, async ({
    page,
  }, info) => {
    await start(page, language);
    const report = [];
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark") await dark(page, language);
      for (const entry of ["lookup", "product-detail"] as const) {
        let dialog: Locator;
        if (entry === "lookup") {
          dialog = await editor(page);
        } else {
          await page.goto("/#product?code=0001");
          const product = await page.evaluate(() => {
            const saved = JSON.parse(
              localStorage.getItem("supermarket-prototype-v1")!,
            );
            return saved.products.find(
              (item: { code: string }) => item.code === "0001",
            ) as { name_en: string; name_fa: string };
          });
          await page
            .locator(".page-header")
            .getByRole("button", {
              name: exact(
                `Edit ${product.name_en}`,
                `ویرایش ${product.name_fa || product.name_en}`,
              ),
            })
            .click();
          dialog = page.locator(".product-editor-dialog[open]");
          await expect(dialog).toBeVisible();
          expect(
            await dialog.evaluate(
              (element) => !!element.closest(".page-header"),
            ),
          ).toBe(true);
        }
        await dialog.locator(".ui-dialog-header h2").click();
        await page.mouse.move(0, 0);
        await settled(page);
        const geometry = await dialog.evaluate((element) => {
          const title = element
            .querySelector(".ui-dialog-header h2")!
            .getBoundingClientRect();
          const description = element.querySelector(".dialog-description")!;
          const caption = description.getBoundingClientRect();
          const style = getComputedStyle(description);
          const body = element
            .querySelector(".product-editor-section-title")!
            .getBoundingClientRect();
          const rtl = getComputedStyle(element).direction === "rtl";
          const captionStart = rtl
            ? caption.right - parseFloat(style.paddingRight)
            : caption.left + parseFloat(style.paddingLeft);
          return {
            titleDifference: Math.abs(
              captionStart - (rtl ? title.right : title.left),
            ),
            bodyDifference: Math.abs(
              captionStart - (rtl ? body.right : body.left),
            ),
          };
        });
        await expect(dialog.locator(".product-editor-caption")).toContainText(
          "0001",
        );
        expect.soft(geometry.titleDifference).toBeLessThanOrEqual(2);
        expect.soft(geometry.bodyDifference).toBeLessThanOrEqual(2);
        const cancel = button(dialog, "Cancel", "انصراف");
        const style = await appearance(cancel);
        report.push({ theme, entry, geometry, cancel: style });
        expect
          .soft(style.background, "dialog Cancel keeps its neutral fill")
          .toBe(style.tokens.neutral);
        expect.soft(style.colour).toBe(style.tokens.text);
        expect
          .soft(
            style.borderVisible,
            "page-header hairline stays outside the dialog",
          )
          .toBe(false);
        expect.soft(style.outlineVisible).toBe(false);
        expect.soft(style.shadow).toBe("none");
        expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
        await cancel.click();
        await expect(dialog).not.toBeVisible();
      }
    }
    await info.attach("Product caption inset", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
  });

  test(`Klead retouch: reminder days remain a surface field inside the soft tracking group (${language})`, async ({
    page,
  }, info) => {
    await start(page, language);
    const report = [];
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark") await dark(page, language);
      const dialog = await editor(page);
      const tracking = dialog.getByRole("switch", {
        name: exact("Date tracking", "پیگیری تاریخ"),
      });
      if ((await tracking.getAttribute("aria-checked")) !== "true")
        await tracking.click();
      await expect(tracking).toHaveAttribute("aria-checked", "true");
      const reminder = dialog.getByLabel(
        exact("Reminder days", "روزهای یادآوری"),
      );
      await expect(reminder).toHaveValue("30");
      await reminder.scrollIntoViewIfNeeded();
      await dialog.locator(".product-date-editor-heading h3").click();
      await settled(page);
      const style = await appearance(reminder);
      report.push({ theme, ...style });
      expect
        .soft(style.surface, "nested reminder field has the surface fill")
        .toEqual(style.tokens.surfaceRgb);
      expect.soft(style.borderVisible).toBe(false);
      expect.soft(style.outlineVisible).toBe(false);
      expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
    await info.attach("Nested reminder surfaces", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
  });

  test(`Klead retouch: shared controls and a real partial return retain their surface hierarchy (${language})`, async ({
    page,
  }, info) => {
    await start(page, language);
    const before = await stored(page);
    const report: Record<string, unknown> = {};
    await page.goto("/#products");
    const columns = button(
      page.locator(".catalog-filter-toolbar .filter-count"),
      "Columns",
      "ستون‌ها",
    );
    await expect(columns).toBeVisible();
    // C8 puts the complete Products toolbar inside its list card. Its
    // Columns control uses the inside-card neutral fill; the actual outside
    // Supplier and Invoice headers below retain their white/hairline checks.
    const cardColumns = await appearance(columns);
    const columnsContainment = await columns.evaluate((element) => {
      const toolbar = element.closest(".catalog-filter-toolbar")!;
      const card = element.closest(".ui-card")!;
      const table = card.querySelector(".catalog-products-table")!;
      const contains = (outer: Element, inner: Element) => {
        const bounds = outer.getBoundingClientRect();
        const content = inner.getBoundingClientRect();
        return (
          content.left >= bounds.left - 1 &&
          content.right <= bounds.right + 1 &&
          content.top >= bounds.top - 1 &&
          content.bottom <= bounds.bottom + 1
        );
      };
      return {
        toolbarInsideCard: card.contains(toolbar),
        controlInsideToolbar: toolbar.contains(element),
        toolbarContained: contains(card, toolbar),
        controlContained: contains(toolbar, element),
        tableContained: contains(card, table),
        tableGap:
          table.getBoundingClientRect().top -
          toolbar.getBoundingClientRect().bottom,
      };
    });
    report.columns = {
      appearance: cardColumns,
      containment: columnsContainment,
    };
    expect.soft(cardColumns.background).toBe(cardColumns.tokens.neutral);
    expect.soft(cardColumns.colour).toBe(cardColumns.tokens.text);
    expect.soft(cardColumns.borderVisible).toBe(false);
    expect.soft(cardColumns.outlineVisible).toBe(false);
    expect.soft(cardColumns.shadow).toBe("none");
    expect.soft(cardColumns.contrast).toBeGreaterThanOrEqual(4.5);
    expect.soft(columnsContainment.toolbarInsideCard).toBe(true);
    expect.soft(columnsContainment.controlInsideToolbar).toBe(true);
    expect.soft(columnsContainment.toolbarContained).toBe(true);
    expect.soft(columnsContainment.controlContained).toBe(true);
    expect.soft(columnsContainment.tableContained).toBe(true);
    expect.soft(columnsContainment.tableGap).toBeGreaterThanOrEqual(0);
    expect
      .soft(columnsContainment.tableGap)
      .toBeLessThanOrEqual(page.viewportSize()!.width < 760 ? 16 : 24);

    await page.goto("/#suppliers");
    const search = page.locator(".suppliers-overview .filter-search-pill");
    await expect(search).toBeVisible();
    const inside = await appearance(search);
    report.search = inside;
    expect.soft(inside.background).toBe(inside.tokens.field);
    expect.soft(inside.borderVisible).toBe(false);
    expect.soft(inside.outlineVisible).toBe(false);
    expect
      .soft((await appearance(search.locator("input"))).contrast)
      .toBeGreaterThanOrEqual(4.5);

    const supplierViewport = page.viewportSize()!;
    if (supplierViewport.width > 760)
      await page.setViewportSize({
        width: 900,
        height: supplierViewport.height,
      });
    await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
    await expect(page.locator(".page-header h1")).toHaveText(
      "Fresh Valley Foods",
    );
    const supplierActions = page.locator(".page-header .actions button");
    await expect(supplierActions).toHaveCount(2);
    await expect(
      button(page.locator(".page-header"), "Edit", "ویرایش"),
    ).toBeVisible();
    await expect(
      button(page.locator(".page-header"), "More", "بیشتر"),
    ).toBeVisible();
    await page.mouse.move(0, 0);
    await settled(page);
    report.supplierHeader = [];
    for (const control of await supplierActions.all()) {
      expect(
        await control.evaluate((element) => !!element.closest(".ui-card")),
      ).toBe(false);
      const style = await appearance(control);
      (report.supplierHeader as unknown[]).push(style);
      expect.soft(style.background).toBe(style.tokens.surface);
      expect.soft(style.colour).toBe(style.tokens.text);
      expect.soft(style.borderVisible).toBe(true);
      expect.soft(style.borderWidth).toBe("1px");
      expect.soft(style.borderColour).toBe(style.tokens.hairline);
      expect.soft(style.outlineVisible).toBe(false);
      expect.soft(style.shadow).toBe("none");
      expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
    }

    await setLanguage(page, "en");
    await page.goto("/#invoices");
    await button(page.locator(".page-header"), "New invoice").click();
    await button(page, "Manual entry").click();
    await setLanguage(page, language);
    const newInvoice = button(
      page.locator(".page-header"),
      "New invoice",
      "فاکتور جدید",
    );
    await expect(newInvoice).toHaveClass(/button-neutral/);
    expect(
      await newInvoice.evaluate((element) => !!element.closest(".ui-card")),
    ).toBe(false);
    await page.locator("main h1").click();
    await page.mouse.move(0, 0);
    await settled(page);
    const invoiceHeader = await appearance(newInvoice);
    report.manualInvoiceHeader = invoiceHeader;
    expect.soft(invoiceHeader.background).toBe(invoiceHeader.tokens.surface);
    expect.soft(invoiceHeader.colour).toBe(invoiceHeader.tokens.text);
    expect.soft(invoiceHeader.borderVisible).toBe(true);
    expect.soft(invoiceHeader.borderWidth).toBe("1px");
    expect.soft(invoiceHeader.borderColour).toBe(invoiceHeader.tokens.hairline);
    expect.soft(invoiceHeader.outlineVisible).toBe(false);
    expect.soft(invoiceHeader.shadow).toBe("none");
    expect.soft(invoiceHeader.contrast).toBeGreaterThanOrEqual(4.5);

    await page.goto("/#dashboard");
    const more = page
      .locator(".ui-card .ui-menu-trigger.ui-icon-button")
      .first();
    await expect(more).toBeVisible();
    const icon = await appearance(more);
    report.more = icon;
    expect.soft(icon.background).toBe("rgba(0, 0, 0, 0)");
    expect.soft(icon.borderVisible).toBe(false);
    expect.soft(icon.outlineVisible).toBe(false);
    expect.soft(icon.shadow).toBe("none");

    // Use actual signed pickup and replacement events to expose the feedback,
    // memo and nested resolution controls without manufacturing stored state.
    await setLanguage(page, "en");
    const viewport = page.viewportSize()!;
    if (viewport.width > 760)
      await page.setViewportSize({ width: 900, height: viewport.height });
    await page.goto("/#return?id=demo-return-1");
    const header = page.locator(".return-header-card");
    await button(header, "Record pickup").click();
    const form = page.locator(".return-action-card");
    await field(form, "Actual pickup quantity").fill("3");
    await field(form, "Supplier representative name").fill(
      "Fictional Representative",
    );
    await field(form, "Signed paper pickup slip reference").fill(
      "C7-SIGNED-PAPER-001",
    );
    await button(form, "Record pickup").click();
    await expect(page.locator(".return-detail-title")).toContainText(
      "Waiting for credit",
    );
    await button(header, "Record resolution").click();
    await choose(page, field(form, "Outcome"), "Replaced");
    await field(form, "Original quantity covered").fill("1");
    await field(form, "Actual replacement quantity").fill("1");
    await field(form, "Supplier representative name").fill(
      "Fictional Representative",
    );
    await field(form, "Replacement receipt reference").fill(
      "C7-ACTUAL-REPLACEMENT-001",
    );
    await field(form, "Remaining expected date").click();
    await button(page, "Today").click();
    await button(form, "Record resolution").click();
    await expect(page.locator(".return-detail-title")).toContainText(
      "Waiting for credit",
    );
    await button(header, "Record resolution").click();
    await setLanguage(page, language);
    await choose(
      page,
      field(form, "Outcome", "نتیجه"),
      exact("Replaced", "جایگزین‌شده"),
    );
    await form.locator(".return-item-form h4").click();
    await page.mouse.move(0, 0);
    await settled(page);

    const alignment = await header
      .locator(".return-detail-header")
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const rtl = getComputedStyle(element).direction === "rtl";
        const actions = element.querySelector(".return-header-actions")!;
        const group = actions.getBoundingClientRect();
        const last = actions.lastElementChild!.getBoundingClientRect();
        return {
          groupEnd: Math.abs(
            rtl ? group.left - box.left : group.right - box.right,
          ),
          buttonEnd: Math.abs(
            rtl ? last.left - box.left : last.right - box.right,
          ),
        };
      });
    report.returnActions = alignment;
    expect.soft(alignment.groupEnd).toBeLessThanOrEqual(2);
    expect.soft(alignment.buttonEnd).toBeLessThanOrEqual(2);
    const fields = form.locator(".return-item-form input.ui-input");
    expect(await fields.count()).toBeGreaterThan(1);
    report.returnFields = [];
    for (const control of await fields.all()) {
      const style = await appearance(control);
      (report.returnFields as unknown[]).push(style);
      expect.soft(style.surface).toEqual(style.tokens.surfaceRgb);
      expect.soft(style.contrast).toBeGreaterThanOrEqual(4.5);
    }
    await choose(
      page,
      field(form, "Outcome", "نتیجه"),
      exact("Still outstanding", "هنوز باقی‌مانده"),
    );
    const expectedDate = field(form, "Expected date", "تاریخ مورد انتظار");
    await expect(expectedDate).toBeVisible();
    const date = await expectedDate.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      available: element.closest(".field")!.getBoundingClientRect().width,
    }));
    report.expectedDate = date;
    expect.soft(date.width).toBeLessThanOrEqual(280);
    expect.soft(date.width).toBeLessThanOrEqual(date.available + 2);

    const feedback = page.locator(".return-lines-card > .banner.info");
    await expect(feedback).toContainText(
      language === "en" ? "Replacement received" : "جایگزین دریافت‌شده",
    );
    await expect(feedback).toContainText(
      language === "en"
        ? "No amount was added to Payables."
        : "هیچ مبلغی به پرداختنی‌ها اضافه نشده است.",
    );
    const flow = await feedback.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const fragments: DOMRect[] = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        fragments.push(...range.getClientRects());
      }
      return {
        display: getComputedStyle(element).display,
        overflow: element.scrollWidth - element.clientWidth,
        contained: fragments.every(
          (rect) => rect.left >= box.left - 2 && rect.right <= box.right + 2,
        ),
      };
    });
    report.replacementFeedback = flow;
    expect.soft(flow.display).toBe("block");
    expect.soft(flow.overflow).toBeLessThanOrEqual(2);
    expect.soft(flow.contained).toBe(true);
    expect
      .soft((await appearance(feedback)).contrast)
      .toBeGreaterThanOrEqual(4.5);

    const documentReferences = await page.evaluate(() => {
      const saved = JSON.parse(
        localStorage.getItem("supermarket-prototype-v1")!,
      );
      const record = saved.returns.find(
        (item: { id: string }) => item.id === "demo-return-1",
      );
      return ["pickup", "replacement"].map(
        (kind) =>
          record.evidence.find((event: { kind: string }) => event.kind === kind)
            .document as string,
      );
    });
    expect(documentReferences).toEqual([
      "C7-SIGNED-PAPER-001",
      "C7-ACTUAL-REPLACEMENT-001",
    ]);
    report.evidenceReferences = [];
    for (const document of documentReferences) {
      const reference = page
        .locator(".return-evidence-card .history-row p .ltr-fragment")
        .filter({ hasText: exact(document) });
      await expect(reference).toHaveCount(1);
      await expect(reference).toHaveText(document);
      await reference.scrollIntoViewIfNeeded();
      await settled(page);
      const geometry = await reference.evaluate((element) => {
        const walker = globalThis.document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
        );
        const characters: DOMRect[] = [];
        while (walker.nextNode()) {
          for (
            let offset = 0;
            offset < (walker.currentNode.textContent?.length ?? 0);
            offset++
          ) {
            const range = globalThis.document.createRange();
            range.setStart(walker.currentNode, offset);
            range.setEnd(walker.currentNode, offset + 1);
            characters.push(
              ...[...range.getClientRects()].filter(
                (rect) => rect.width > 0 && rect.height > 0,
              ),
            );
          }
        }
        const paragraph = element.closest("p")!.getBoundingClientRect();
        const row = element.closest(".history-row")!.getBoundingClientRect();
        return {
          text: element.textContent,
          characterCount: characters.length,
          lines: new Set(characters.map((rect) => Math.round(rect.top))).size,
          contained: characters.every(
            (rect) =>
              rect.left >= paragraph.left - 2 &&
              rect.right <= paragraph.right + 2 &&
              rect.left >= row.left - 2 &&
              rect.right <= row.right + 2,
          ),
        };
      });
      (report.evidenceReferences as unknown[]).push(geometry);
      expect.soft(geometry.text).toBe(document);
      expect.soft(geometry.characterCount).toBe(document.length);
      expect.soft(geometry.lines).toBe(1);
      expect.soft(geometry.contained).toBe(true);
    }

    await button(form, "Close", "بستن").click();
    await page
      .locator(".return-memos-card")
      .getByRole("button")
      .first()
      .click();
    const memo = page.getByRole("dialog", {
      name: exact("Return memo", "یادداشت مرجوعی"),
    });
    await expect(
      memo.locator('.return-memo-document[lang="en"]'),
    ).toContainText("C7-SIGNED-PAPER-001");
    const print = await appearance(button(memo, "Print", "چاپ"));
    report.memoPrint = print;
    expect.soft(print.background).toBe(print.tokens.tint);
    expect.soft(print.colour).toBe(print.tokens.tintInk);
    expect.soft(print.borderVisible).toBe(false);
    expect.soft(print.outlineVisible).toBe(false);
    expect.soft(print.contrast).toBeGreaterThanOrEqual(4.5);
    const state = await page.evaluate(() => {
      const saved = JSON.parse(
        localStorage.getItem("supermarket-prototype-v1")!,
      );
      const record = saved.returns.find(
        (item: { id: string }) => item.id === "demo-return-1",
      );
      return {
        ledger: saved.ledger,
        pickedUp: record.lines[0].picked_up,
        resolved: record.lines[0].settled,
        replacement: record.replacement_received.qty,
      };
    });
    expect(state).toEqual({
      ledger: before.ledger,
      pickedUp: 3,
      resolved: 1,
      replacement: 1,
    });
    await info.attach("Shared controls and recorded partial return", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
  });
}
