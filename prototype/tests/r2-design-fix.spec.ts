import { expect, test, type Locator, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import {
  openInvoiceDetails,
  openShellAction,
  setLanguage,
  signIn,
} from "./helpers";
import {
  importReceivingFixture,
  openReceivingLine,
  receivingRow,
  setReceivingCategory,
  word,
  type ReceivingLanguage,
} from "./r2-receiving-helpers";

async function auditReferenceControls(
  page: Page,
  scene: string,
  language: ReceivingLanguage,
) {
  const report = await inspect(
    page,
    scene,
    `${test.info().project.name}-${language}-${page.viewportSize()!.width}`,
    "owner",
  );
  await test.info().attach(`Reference controls: ${scene}`, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  expect(
    report.buttons.length,
    `${scene} measures actual controls`,
  ).toBeGreaterThan(2);
  expect(report.failures, scene).toEqual([]);
}

async function missingProductTitleIsDetected(page: Page) {
  const name = page.locator(".receiving-table .receiving-product-name").first();
  const title = await name.getAttribute("title");
  expect(title).toBeTruthy();
  if (!title)
    throw new Error("The full product title must exist before removal");
  const prefix = (await name.innerText())
    .replace(/[\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  expect(prefix).toBe(title);
  expect(prefix.endsWith("…")).toBe(false);
  await name.evaluate((element) => element.removeAttribute("title"));
  try {
    const report = await inspect(
      page,
      "Complete receiving name without title",
      "desktop-en-1280-negative",
      "owner",
    );
    expect(report.failures).toContain(
      `Receiving full product title is missing or inconsistent: ${prefix}`,
    );
  } finally {
    await name.evaluate(
      (element, value) => element.setAttribute("title", value),
      title,
    );
  }
  await auditReferenceControls(page, "Restored full product title", "en");
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("A visible reference control has no bounds");
  return bounds;
}

async function tokenColor(locator: Locator, token: string) {
  return locator.evaluate((element, name) => {
    const probe = document.createElement("span");
    probe.style.cssText = `position:fixed;inline-size:0;block-size:0;pointer-events:none;background:var(${name})`;
    element.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

async function noHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const selector of [".receiving-lines-table", "table.receiving-table"]) {
    const sizes = await page.locator(selector).evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    expect(
      sizes.scroll,
      `${selector} fits its visible width`,
    ).toBeLessThanOrEqual(sizes.client);
  }
}

async function originalToolbarFits(toolbar: Locator) {
  await expect(toolbar).toBeVisible();
  const geometry = await toolbar.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const visible = (child: Element) =>
      child.checkVisibility() && child.getBoundingClientRect().width > 0;
    const rect = (child: Element) => {
      const box = child.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      scroll: element.scrollWidth,
      client: element.clientWidth,
      containerWidth: element.parentElement!.clientWidth,
      children: Array.from(element.children).filter(visible).map(rect),
      buttons: Array.from(element.querySelectorAll("button"))
        .filter(visible)
        .map(rect),
    };
  });
  expect(
    geometry.scroll,
    "Original toolbar fits without sideways scroll",
  ).toBeLessThanOrEqual(geometry.client);
  expect(geometry.children).toHaveLength(4);
  await expect(
    toolbar.locator(":scope > .invoice-original-control-group"),
  ).toHaveCount(4);
  for (const child of geometry.children) {
    expect(child.left).toBeGreaterThanOrEqual(geometry.left);
    expect(child.right).toBeLessThanOrEqual(geometry.right);
    expect(child.top).toBeGreaterThanOrEqual(geometry.top);
    expect(child.bottom).toBeLessThanOrEqual(geometry.bottom);
  }
  expect(geometry.buttons).toHaveLength(7);
  for (const button of geometry.buttons) {
    expect(button.width).toBeGreaterThanOrEqual(28);
    expect(button.width).toBeLessThanOrEqual(36);
    expect(Math.abs(button.height - 44)).toBeLessThanOrEqual(1);
  }
  const tops = geometry.buttons.map((button) => button.top);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
  await expect(toolbar.locator(".invoice-original-rotate")).toBeVisible();
}

async function phoneOriginalKeepsItsToolbar(
  page: Page,
  language: ReceivingLanguage,
) {
  await page.locator(".original-viewer-phone-trigger").click();
  const dialog = page.getByRole("dialog", {
    name: word(language, "Original invoice", "فاکتور اصلی"),
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const original = page.locator("aside#invoice-original-field.original-viewer");
  const invoiceId = new URLSearchParams(
    new URL(page.url()).hash.split("?")[1],
  ).get("id");
  expect(invoiceId).toBeTruthy();
  await expect(original).toHaveAttribute(
    "data-original-invoice-id",
    invoiceId!,
  );
  await expect(original).not.toHaveAttribute("data-invoice-id");
  const bounds = await box(dialog);
  expect(Math.abs(bounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.width - 390)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.height - 900)).toBeLessThanOrEqual(1);
  for (const width of [360, 390, 509, 760]) {
    await page.setViewportSize({ width, height: 900 });
    const report = await inspect(
      page,
      "Original native fullscreen frame",
      `phone-${language}-${width}`,
      "owner",
    );
    expect(report.failures).toEqual([]);
    expect(report.originalFullscreenFrames).toHaveLength(1);
    expect(report.originalFullscreenFrames[0]).toMatchObject({
      x: 0,
      y: 0,
      width,
      height: 900,
    });
    await test.info().attach(`Original fullscreen ${language} ${width}`, {
      body: JSON.stringify(report.originalFullscreenFrames),
      contentType: "application/json",
    });
    if (width === 509)
      await dialog.screenshot({
        path: test.info().outputPath(`original-fullscreen-${language}-509.png`),
      });
  }
  if (language === "en") {
    await original.evaluate((element) => {
      element.setAttribute(
        "data-original-invoice-id",
        "r2g-fictional-unrelated-original",
      );
    });
    try {
      const wrongSource = await inspect(
        page,
        "Wrong original invoice identity",
        "negative",
        "owner",
      );
      expect(wrongSource.failures).toContain(
        "Invalid original invoice fullscreen composition",
      );
    } finally {
      await original.evaluate((element, id) => {
        element.setAttribute("data-original-invoice-id", id);
      }, invoiceId!);
    }
    const originalStyle = await dialog.getAttribute("style");
    await dialog.evaluate((element) => {
      element.style.transform = "translateY(4px)";
    });
    try {
      const shifted = await inspect(
        page,
        "Shifted original frame",
        "negative",
        "owner",
      );
      expect(shifted.failures).toContain(
        "Original invoice viewer must fill the complete phone viewport",
      );
    } finally {
      await dialog.evaluate((element, style) => {
        if (style === null) element.removeAttribute("style");
        else element.setAttribute("style", style);
      }, originalStyle);
    }
    await page.evaluate(() => {
      const fake = document.createElement("dialog");
      fake.className =
        "ui-dialog confirm-dialog original-viewer-dialog dialog-phone-fullscreen";
      fake.setAttribute("open", "");
      fake.setAttribute("data-counterfeit-original-frame", "true");
      document.body.append(fake);
    });
    try {
      const counterfeit = await inspect(
        page,
        "Counterfeit original frame",
        "negative",
        "owner",
      );
      expect(counterfeit.failures).toContain(
        "Invalid original invoice fullscreen composition",
      );
    } finally {
      await page
        .locator("[data-counterfeit-original-frame]")
        .evaluate((element) => element.remove());
    }
    await auditReferenceControls(
      page,
      "Restored original fullscreen frame",
      language,
    );
  }
  await page.setViewportSize({ width: 390, height: 900 });
  const toolbar = dialog.locator(".invoice-original-controls");
  await originalToolbarFits(toolbar);
  const pageLabel = await toolbar
    .locator(".invoice-original-page")
    .getAttribute("aria-label");
  expect(pageLabel).toBeTruthy();
  await toolbar
    .getByRole("button", { name: word(language, "More", "بیشتر"), exact: true })
    .click();
  await page
    .getByRole("menuitem", {
      name: word(language, "Rotate", "چرخش"),
      exact: true,
    })
    .click();
  await expect(dialog.locator(".invoice-original-media")).toHaveAttribute(
    "data-rotation",
    "90",
  );
  await expect(toolbar.locator(".invoice-original-page")).toHaveAttribute(
    "aria-label",
    pageLabel!,
  );
  await dialog
    .getByRole("button", {
      name: word(language, "Close dialog", "بستن پنجره"),
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
}

async function importStatusFits(
  page: Page,
  preview: Locator,
  language: ReceivingLanguage,
  phone: boolean,
) {
  const table = preview.locator(".invoice-readings-table");
  const statusName = word(language, "Status", "وضعیت");
  const duplicateName = word(
    language,
    "Same invoice twice in this file",
    "همین فاکتور دو بار در این فایل است",
  );
  await expect(table.locator("[data-import-id]")).toHaveCount(2);
  if (!phone) {
    const header = table.locator('th[data-column-key="status"]');
    await expect(header).toHaveText(statusName);
    await expect(header).toBeVisible();
    const headerBounds = await box(header);
    const dialogBounds = await box(preview);
    expect(headerBounds.x).toBeGreaterThanOrEqual(dialogBounds.x);
    expect(headerBounds.x + headerBounds.width).toBeLessThanOrEqual(
      dialogBounds.x + dialogBounds.width,
    );
  }
  for (const id of ["fictional-r2-page-one-only", "fictional-r2-complete"]) {
    const row = table.locator(`[data-import-id="${id}"]`);
    const status = row.locator(
      phone ? ".phone-list-value" : 'td[data-column-key="status"]',
    );
    await expect(status).toBeVisible();
    await expect(status).toHaveText(duplicateName);
    await status.scrollIntoViewIfNeeded();
    const statusBounds = await box(status);
    const rowBounds = await box(row);
    const dialogBounds = await box(preview);
    for (const container of [rowBounds, dialogBounds]) {
      expect(statusBounds.x).toBeGreaterThanOrEqual(container.x);
      expect(statusBounds.x + statusBounds.width).toBeLessThanOrEqual(
        container.x + container.width,
      );
    }
    // Measure every rendered text line as well as the cell: a visible status
    // cell with clipped badge text still fails the reference requirement.
    const textLines = await status.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return Array.from(range.getClientRects(), (rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }));
    });
    expect(textLines.length).toBeGreaterThan(0);
    for (const line of textLines) {
      expect(line.left).toBeGreaterThanOrEqual(statusBounds.x);
      expect(line.right).toBeLessThanOrEqual(
        statusBounds.x + statusBounds.width,
      );
      expect(line.top).toBeGreaterThanOrEqual(statusBounds.y);
      expect(line.bottom).toBeLessThanOrEqual(
        statusBounds.y + statusBounds.height,
      );
      expect(line.left).toBeGreaterThanOrEqual(dialogBounds.x);
      expect(line.right).toBeLessThanOrEqual(
        dialogBounds.x + dialogBounds.width,
      );
    }
    await expect(row.getByRole("checkbox")).toBeEnabled();
  }
  if (!phone) {
    const row = table.locator('[data-import-id="fictional-r2-complete"]');
    const location = row.locator('td[data-column-key="location"]');
    if (!(await location.count())) {
      const disclosure = row.getByRole("button", {
        name: word(language, "Show details", "نمایش جزئیات"),
        exact: true,
      });
      const detailsId = await disclosure.getAttribute("aria-controls");
      expect(detailsId).toBeTruthy();
      await disclosure.click();
      const details = preview.locator(`[id="${detailsId}"]`);
      await expect(
        details.getByRole("term").filter({
          hasText: new RegExp(`^${word(language, "Location", "مکان")}$`),
        }),
      ).toBeVisible();
      await expect(details.getByRole("combobox")).toBeEnabled();
      await disclosure.click();
    }
  }
  const widths = await preview.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

async function detailsDoNotOverlap(page: Page) {
  await openInvoiceDetails(page);
  const fields = await page
    .locator(".receiving-details-grid")
    .evaluate((grid) =>
      Array.from(grid.children).flatMap((element) => {
        const bounds = element.getBoundingClientRect();
        return element.checkVisibility() && bounds.width && bounds.height
          ? [
              {
                name:
                  element.querySelector("label")?.textContent ??
                  element.textContent,
                left: bounds.left,
                top: bounds.top,
                right: bounds.right,
                bottom: bounds.bottom,
              },
            ]
          : [];
      }),
    );
  expect(fields.length).toBeGreaterThanOrEqual(6);
  for (const [index, first] of fields.entries())
    for (const second of fields.slice(index + 1)) {
      const overlapX =
        Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY =
        Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      expect(
        overlapX > 1 && overlapY > 1,
        `${first.name} does not overlap ${second.name}`,
      ).toBe(false);
    }
}

async function alignedControls(editor: Locator) {
  let alignedRows = 0;
  let highlightedRows = 0;
  for (const selector of [
    ".receiving-product-grid",
    ".receiving-quantity-grid",
  ]) {
    const fields = await editor.locator(selector).evaluate((grid) =>
      Array.from(grid.querySelectorAll<HTMLElement>(".field")).flatMap(
        (field) => {
          const control = field.querySelector<HTMLElement>(
            "input:not([type='hidden']), [role='combobox']",
          );
          if (!control?.checkVisibility()) return [];
          const fieldBox = field.getBoundingClientRect();
          const controlBox = control.getBoundingClientRect();
          const label = field.querySelector("label");
          return [
            {
              name: label?.textContent,
              fieldTop: fieldBox.top,
              top: controlBox.top,
              height: controlBox.height,
              labelSpace: label ? getComputedStyle(label).whiteSpace : "",
              highlighted: field.classList.contains("please-check-field"),
            },
          ];
        },
      ),
    );
    expect(fields.length).toBeGreaterThanOrEqual(2);
    const rows: (typeof fields)[] = [];
    for (const field of fields) {
      expect(
        Math.abs(field.height - 44),
        `${field.name} is 44px high`,
      ).toBeLessThanOrEqual(0.5);
      expect(field.labelSpace, `${field.name} stays on one label line`).toBe(
        "nowrap",
      );
      const row = rows.find(
        (items) => Math.abs(items[0].fieldTop - field.fieldTop) <= 1,
      );
      if (row) row.push(field);
      else rows.push([field]);
    }
    for (const row of rows.filter((items) => items.length > 1)) {
      alignedRows++;
      if (row.some((field) => field.highlighted)) highlightedRows++;
      const tops = row.map((field) => field.top);
      expect(
        Math.max(...tops) - Math.min(...tops),
        "Inputs in the same field-grid row stay level",
      ).toBeLessThanOrEqual(1);
    }
  }
  expect(alignedRows).toBeGreaterThanOrEqual(2);
  expect(
    highlightedRows,
    "At least one measured shared row includes an AI marker",
  ).toBeGreaterThanOrEqual(1);
}

async function aiHintDoesNotCoverTheInput(page: Page, editor: Locator) {
  const field = editor.locator(".please-check-field").filter({
    has: page.locator("#invoice-line-0-cost"),
  });
  const marker = field.locator(".reading-check-marker");
  const input = field.locator("#invoice-line-0-cost");
  await expect(input).toHaveCSS("border-width", "2px");
  await expect(input).toHaveCSS(
    "border-color",
    await tokenColor(field, "--pending-dot"),
  );
  await expect(marker).toHaveCount(1);
  await marker.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await marker.hover();
  const tooltip = marker.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCSS("pointer-events", "none");
  const markerBox = await box(marker);
  const tipBox = await box(tooltip);
  const inputBox = await box(field.locator("#invoice-line-0-cost"));
  expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(markerBox.y);
  expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(inputBox.y);
  expect(
    await tooltip.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ),
      );
    }),
  ).toBe(false);
  const [hoverFrames] = await Promise.all([
    marker.evaluate(async (element) => {
      const frames: boolean[] = [true];
      for (let frame = 0; frame < 8; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        frames.push(
          element.querySelector("[role='tooltip']")?.checkVisibility() ?? false,
        );
      }
      return frames;
    }),
    page.mouse.move(tipBox.x + tipBox.width / 2, tipBox.y + tipBox.height / 2),
  ]);
  const hoverChanges = hoverFrames.filter(
    (visible, index) => index > 0 && visible !== hoverFrames[index - 1],
  ).length;
  expect(
    hoverChanges,
    "Crossing the explanation may dismiss it once, without hover oscillation",
  ).toBeLessThanOrEqual(1);
  await marker.hover();
  await expect(tooltip).toBeVisible();
  // Keyboard focus keeps the explanation relevant while the pointer crosses
  // its area; it must not steal the hover or oscillate in and out of the DOM.
  await marker.focus();
  await page.mouse.move(
    tipBox.x + tipBox.width / 2,
    tipBox.y + tipBox.height / 2,
  );
  const stayedVisible = await tooltip.evaluate(async (element) => {
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (!element.isConnected || !element.checkVisibility()) return false;
    }
    return true;
  });
  expect(stayedVisible).toBe(true);
  await field.locator("#invoice-line-0-cost").focus();
  await expect(tooltip).toBeHidden();
}

async function collapsedLabelIsDelayedAndOnTop(page: Page) {
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  const link = page
    .getByRole("navigation", { name: "Pages", exact: true })
    .getByRole("link", { name: "Orders", exact: true });
  await link.evaluate((element) => {
    const timing = { started: 0, visibleAt: 0 };
    const observer = new MutationObserver(() => {
      const tooltip = document.querySelector<HTMLElement>(
        ".collapsed-nav-tooltip",
      );
      if (timing.started && tooltip?.checkVisibility()) {
        timing.visibleAt ||= performance.now();
        observer.disconnect();
      }
    });
    Object.assign(element, { __r2HintTiming: timing });
    element.addEventListener(
      "mouseenter",
      () => {
        timing.started = performance.now();
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          childList: true,
        });
      },
      { once: true },
    );
  });
  await link.hover();
  const label = page.locator(".collapsed-nav-tooltip");
  await expect(label).toBeVisible();
  await expect(label).toHaveText("Orders");
  const elapsed = await link.evaluate((element) => {
    const timing = (
      element as HTMLElement & {
        __r2HintTiming: { started: number; visibleAt: number };
      }
    ).__r2HintTiming;
    return timing.visibleAt - timing.started;
  });
  expect(
    elapsed,
    "The collapsed label does not appear immediately",
  ).toBeGreaterThanOrEqual(290);
  const bounds = await box(label);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  expect(
    await label.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ),
      );
    }),
  ).toBe(true);
  await page.mouse.move(500, 200);
  await expect(label).toHaveCount(0);
  await link.focus();
  await expect(label).toBeVisible();
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page
    .getByRole("navigation", { name: "Pages", exact: true })
    .getByRole("link", { name: "Settings", exact: true })
    .hover();
  await expect(label).toHaveCount(0);
}

for (const language of ["en", "fa"] as const) {
  test(`R2 import preview Status fits each row in ${language}`, async ({
    page,
  }, testInfo) => {
    const phone = testInfo.project.name === "phone";
    await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
    await importReceivingFixture(
      page,
      language,
      async (preview) => {
        for (const width of phone ? [390] : [1440, 1000]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          await importStatusFits(page, preview, language, phone);
          await auditReferenceControls(
            page,
            "Import readings preview",
            language,
          );
        }
      },
      async () => {
        await auditReferenceControls(page, "Import complete", language);
      },
    );
    await expect(page.getByTestId("invoice-review")).toBeVisible();
  });

  test(`R2 reference receiving geometry and hints in ${language}`, async ({
    page,
  }, testInfo) => {
    const phone = testInfo.project.name === "phone";
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
    await importReceivingFixture(page, language);
    if (!phone)
      await expect(page.locator("#menu-toggle")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    if (language === "fa") {
      await (await openShellAction(page, "تغییر به تم تیره")).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    const filters = page.getByRole("group", {
      name: word(language, "Filter invoice lines", "فیلتر ردیف‌های فاکتور"),
      exact: true,
    });
    await expect(
      filters.getByRole("button", {
        name: word(language, "All 25", "همه 25"),
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await filters
      .getByRole("button", {
        name: word(language, "Needs attention 25", "نیازمند بررسی 25"),
        exact: true,
      })
      .click();
    if (phone) await phoneOriginalKeepsItsToolbar(page, language);
    let editor: Locator | undefined;
    for (const width of phone ? [390] : [1440, 1280, 1180, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await expect(page.getByTestId("invoice-review")).toBeAttached();
      expect(
        pageErrors,
        `No runtime error after resizing to ${width}px`,
      ).toEqual([]);
      if (!phone) {
        const chargeWidths = await page
          .locator(".receiving-lines > .receiving-charges")
          .evaluate(async (element) => {
            const widths: { width: number; connected: boolean }[] = [];
            for (let frame = 0; frame < 8; frame++) {
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              );
              widths.push({
                width: element.getBoundingClientRect().width,
                connected: element.isConnected,
              });
            }
            return widths;
          });
        expect(chargeWidths.every((frame) => frame.connected)).toBe(true);
        const widths = chargeWidths.map((frame) => frame.width);
        expect(Math.min(...widths)).toBeGreaterThan(0);
        expect(
          Math.max(...widths) - Math.min(...widths),
          "Other charges stays stable through responsive table measurement",
        ).toBeLessThanOrEqual(1);
        expect(pageErrors).toEqual([]);
      }
      const table = page.locator("table.receiving-table");
      await expect(table.locator("thead th")).toHaveCount(5);
      await noHorizontalScroll(page);
      if (!phone) {
        await originalToolbarFits(
          page.locator(".original-viewer-panel .invoice-original-controls"),
        );
        await receivingRow(page, 0).scrollIntoViewIfNeeded();
        const status = receivingRow(page, 0).locator(".receiving-status-icon");
        await expect(status).toBeInViewport();
        const iconBox = await box(status);
        const tableBox = await box(page.locator(".receiving-lines-table"));
        expect(iconBox.x).toBeGreaterThanOrEqual(tableBox.x);
        expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(
          tableBox.x + tableBox.width,
        );
      }
      await detailsDoNotOverlap(page);
      editor ??= await openReceivingLine(page, 0);
      await expect(editor).toBeVisible();
      const confirm = editor.getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      });
      if (phone) {
        const sheet = await box(editor);
        expect(Math.abs(sheet.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(sheet.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(sheet.width - 390)).toBeLessThanOrEqual(1);
        expect(Math.abs(sheet.height - 900)).toBeLessThanOrEqual(1);
        await expect(confirm).toBeInViewport({ ratio: 1 });
        const footer = editor.locator(".receiving-line-footer");
        const contentWidth = await footer.evaluate((element) => {
          const style = getComputedStyle(element);
          return (
            element.getBoundingClientRect().width -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight)
          );
        });
        expect(Math.abs(contentWidth - (sheet.width - 32))).toBeLessThanOrEqual(
          1,
        );
        const confirmBounds = await box(confirm);
        expect(
          Math.abs(confirmBounds.width - contentWidth),
          "Phone Confirm line fills the footer content width",
        ).toBeLessThanOrEqual(1);
        const secondary = footer.locator(
          ".receiving-line-secondary-actions > button",
        );
        await expect(secondary).toHaveCount(2);
        const reportBounds = await box(secondary.nth(0));
        const removeBounds = await box(secondary.nth(1));
        expect(Math.abs(reportBounds.y - removeBounds.y)).toBeLessThanOrEqual(
          1,
        );
        expect(
          Math.abs(reportBounds.width - removeBounds.width),
          "Phone Report and Remove share the second footer row equally",
        ).toBeLessThanOrEqual(1);
        expect(reportBounds.y).toBeGreaterThanOrEqual(
          confirmBounds.y + confirmBounds.height,
        );
      }
      const surface = await tokenColor(editor, "--surface");
      await expect(editor).toHaveCSS("background-color", surface);
      await editor.locator(".receiving-editor-columns h3").first().hover();
      await page.mouse.down();
      try {
        await expect(editor).toHaveCSS("background-color", surface);
      } finally {
        await page.mouse.up();
      }
      await expect(editor).toHaveCSS("background-color", surface);
      await alignedControls(editor);
      await aiHintDoesNotCoverTheInput(page, editor);
      await expect(editor.getByText("?", { exact: true })).toHaveCount(0);
      await expect(
        editor.getByText(word(language, "Please check", "لطفاً بررسی کنید"), {
          exact: true,
        }),
      ).toHaveCount(0);
      if (language === "fa") {
        const labels = await editor
          .locator("label")
          .evaluateAll((elements) =>
            elements
              .filter((element) => element.checkVisibility())
              .map((element) => element.textContent?.trim() ?? ""),
          );
        expect(labels.length).toBeGreaterThan(8);
        expect(labels.filter((label) => /[A-Za-z]/.test(label))).toEqual([]);
        const directions = await receivingRow(page, 0)
          .locator(
            ".receiving-cost-cell > .ltr-fragment, .receiving-total-cell > .ltr-fragment",
          )
          .evaluateAll((elements) =>
            elements.map((element) => ({
              direction: getComputedStyle(element).direction,
              digits: getComputedStyle(element).fontVariantNumeric,
            })),
          );
        expect(directions.length).toBeGreaterThanOrEqual(2);
        expect(
          directions.every(
            (value) =>
              value.direction === "ltr" &&
              value.digits.includes("tabular-nums"),
          ),
        ).toBe(true);
      }
      await noHorizontalScroll(page);
      await auditReferenceControls(page, "Open receiving line", language);
      if (!phone && language === "en" && width === 1280)
        await missingProductTitleIsDetected(page);
    }
    await setReceivingCategory(page, editor!, language);
    await editor!
      .getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      })
      .click();
    await expect(editor!).toHaveCount(0);
    await expect(
      filters.getByRole("button", {
        name: word(language, "Needs attention 24", "نیازمند بررسی 24"),
        exact: true,
      }),
    ).toBeVisible();
    // R2c immediately removes a confirmed line from Needs attention.
    await expect(receivingRow(page, 0)).toHaveCount(0);
    await filters
      .getByRole("button", {
        name: word(language, "Confirmed 1", "تأییدشده 1"),
        exact: true,
      })
      .click();
    const confirmed = receivingRow(page, 0);
    const approvedFill = await tokenColor(confirmed, "--approved-bg");
    // Phone cards own their fill; rounded desktop cells own the table's continuous fill.
    if (phone) {
      await expect(confirmed).toHaveCSS("background-color", approvedFill);
      const clear = await tokenColor(confirmed, "--color-clear");
      for (const cell of await confirmed.locator(":scope > td").all())
        await expect(cell).toHaveCSS("background-color", clear);
      const radius = await confirmed.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--radius-search").trim(),
      );
      expect(radius).not.toBe("");
      for (const corner of [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ])
        await expect(confirmed).toHaveCSS(`border-${corner}-radius`, radius);
    } else
      for (const cell of await confirmed.locator(":scope > td").all())
        await expect(cell).toHaveCSS("background-color", approvedFill);
    await expect(
      confirmed.locator(".receiving-status-icon"),
    ).toHaveAccessibleName(word(language, "Confirmed", "تأیید شد"));
    await noHorizontalScroll(page);
  });

  test(`R2 destructive confirmation guard in ${language}`, async ({
    page,
  }, testInfo) => {
    const phone = testInfo.project.name === "phone";
    await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
    await signIn(page, "Owner");
    await setLanguage(page, language);
    await page.goto("/#settings");
    await page
      .getByRole("navigation", {
        name: word(language, "Settings groups", "گروه‌های تنظیمات"),
        exact: true,
      })
      .getByRole("button", {
        name: word(language, "Data", "داده‌ها"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: word(language, "Remove fictional data…", "حذف داده‌های خیالی…"),
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: word(language, "Start with an empty store", "شروع با فروشگاه خالی"),
      exact: true,
    });
    const remove = dialog.getByRole("button", {
      name: word(language, "Remove fictional data", "حذف داده‌های خیالی"),
      exact: true,
    });
    const input = dialog.getByRole("textbox", {
      name: word(
        language,
        "Type DELETE to confirm",
        "برای تأیید حذف را بنویسید",
      ),
      exact: true,
    });
    await expect(remove).toBeDisabled();
    await auditReferenceControls(
      page,
      "Empty store: disabled DELETE",
      language,
    );
    for (const wrong of [
      word(language, "DELET", "حذ"),
      word(language, "delete", "حذف!"),
    ]) {
      await input.fill(wrong);
      await expect(remove).toBeDisabled();
    }
    await input.fill(word(language, "DELETE", "حذف"));
    await expect(remove).toBeEnabled();
    await auditReferenceControls(page, "Empty store: enabled DELETE", language);
    await input.clear();
    await expect(remove).toBeDisabled();
    await dialog
      .getByRole("button", {
        name: word(language, "Cancel", "انصراف"),
        exact: true,
      })
      .click();
    await expect(dialog).toHaveCount(0);
    if (!phone && language === "en")
      await collapsedLabelIsDelayedAndOnTop(page);
  });
}
