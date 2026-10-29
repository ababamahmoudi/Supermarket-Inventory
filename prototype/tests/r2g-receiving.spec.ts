import { expect, test, type Page, type Locator } from "@playwright/test";
import Decimal from "decimal.js";
import readingsFixture from "./fixtures/r2-fictional-readings-export.json" with { type: "json" };
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction } from "./helpers";
import {
  expectReceivingStable,
  importReceivingFixture,
  word,
} from "./r2-receiving-helpers";
import { inspect } from "../scripts/c5-browser-proof.mjs";

async function geometry(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  return page.locator(".receiving-lines").evaluate((card) => {
    const failures: string[] = [];
    const viewport = document.documentElement.clientWidth;
    const phone = viewport <= 760;
    const cardBox = card.getBoundingClientRect();
    const elements = [
      ...card.querySelectorAll<HTMLElement>(
        ".receiving-product-name,.receiving-line-check-count,.receiving-charge,.receiving-charge .ui-input,.receiving-charge .ui-segments,.receiving-charge-remove,.receiving-add-line .ui-select,.receiving-add-line .ui-button",
      ),
    ].filter(
      (node) =>
        node.getClientRects().length &&
        getComputedStyle(node).display !== "none",
    );
    for (const node of elements) {
      const box = node.getBoundingClientRect();
      if (box.left < cardBox.left - 1.5 || box.right > cardBox.right + 1.5)
        failures.push(`Outside lines card: ${node.className}`);
      if (node.matches(".receiving-product-name")) {
        if (node.textContent !== node.title)
          failures.push("A complete product name was replaced with a prefix");
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const glyph of range.getClientRects())
          if (
            glyph.left < box.left - 1.5 ||
            glyph.right > box.right + 1.5 ||
            glyph.top < box.top - 1.5 ||
            glyph.bottom > box.bottom + 1.5
          )
            failures.push(`Product glyph outside its box: ${node.title}`);
      }
      if (
        node.matches(".receiving-line-check-count") &&
        !node.closest(".receiving-product-meta")
      )
        failures.push("Check count is not beside category");
    }
    for (const button of card.querySelectorAll<HTMLElement>(
      ".receiving-charge-tax button,.receiving-add-line .ui-button",
    )) {
      const box = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      for (const glyph of range.getClientRects())
        if (glyph.left < box.left - 1.5 || glyph.right > box.right + 1.5)
          failures.push(`Clipped button text: ${button.textContent}`);
    }
    for (const short of card.querySelectorAll(".receiving-short-summary")) {
      if (!short.getClientRects().length) continue;
      const range = document.createRange();
      range.selectNodeContents(short);
      if (
        new Set(
          Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
        ).size > 1
      )
        failures.push("Short delivery wraps");
    }
    if (!phone) {
      const row = card.querySelector(".receiving-row-check")!;
      const first = getComputedStyle(row.firstElementChild!);
      const last = getComputedStyle(row.lastElementChild!);
      const radius = first.getPropertyValue("--radius-small").trim();
      if (
        first.getPropertyValue("border-start-start-radius") !== radius ||
        first.getPropertyValue("border-end-start-radius") !== radius ||
        last.getPropertyValue("border-start-end-radius") !== radius ||
        last.getPropertyValue("border-end-end-radius") !== radius
      )
        failures.push(
          "Desktop amber rows do not retain their approved corners",
        );
      if (first.paddingTop !== "12px" || first.paddingBottom !== "12px")
        failures.push("Desktop line padding is not 12px");
      if (
        getComputedStyle(card.querySelector("table")!).borderSpacing !==
        "0px 4px"
      )
        failures.push("Desktop line gap is not 4px");
    }
    if (phone) {
      const line = card.querySelector(".invoice-line-summary")!;
      const lineStyle = getComputedStyle(line);
      for (const charge of card.querySelectorAll(".receiving-charge")) {
        const chargeStyle = getComputedStyle(charge);
        for (const corner of [
          "borderTopLeftRadius",
          "borderTopRightRadius",
          "borderBottomRightRadius",
          "borderBottomLeftRadius",
        ] as const)
          if (
            lineStyle[corner] !== chargeStyle[corner] ||
            lineStyle[corner] !==
              lineStyle.getPropertyValue("--radius-menu").trim()
          )
            failures.push(
              "Line and charge cards do not share their approved corners",
            );
      }
    }
    for (const field of card.querySelectorAll<HTMLElement>(
      ".receiving-charge-money",
    )) {
      const input = field.querySelector<HTMLInputElement>("input")!;
      const currency = field.querySelector<HTMLElement>(
        ".receiving-charge-currency",
      )!;
      const box = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = style.font;
      const textWidth = context.measureText(input.value).width;
      const valueRight =
        box.right -
        parseFloat(style.borderRightWidth) -
        parseFloat(style.paddingRight);
      const valueLeft = valueRight - textWidth;
      const moneyRange = document.createRange();
      moneyRange.selectNodeContents(currency);
      const symbolRight = Math.max(
        ...Array.from(moneyRange.getClientRects(), (rect) => rect.right),
      );
      if (input.value && symbolRight + 3 > valueLeft)
        failures.push(
          `Currency overlaps the actual amount glyphs: ${input.value}`,
        );
      if (
        input.value &&
        valueLeft <
          box.left +
            parseFloat(style.borderLeftWidth) +
            parseFloat(style.paddingLeft) -
            1.5
      )
        failures.push(
          `Amount glyphs do not fit inside the input: ${input.value}`,
        );
      if (style.direction !== "ltr")
        failures.push("Inline money is not one LTR monetary group");
    }
    const original = document.querySelector<HTMLElement>(
      ".original-viewer-phone-trigger",
    )!;
    const originalBox = original.getBoundingClientRect();
    const thumbnail = original.querySelector<HTMLElement>(
      ".original-viewer-thumbnail",
    )!;
    const thumbBox = thumbnail.getBoundingClientRect();
    if (
      phone &&
      (thumbBox.left < originalBox.left ||
        thumbBox.right > originalBox.right ||
        thumbBox.top < originalBox.top ||
        thumbBox.bottom > originalBox.bottom ||
        getComputedStyle(thumbnail).overflow !== "hidden")
    )
      failures.push("Original thumbnail is not clipped inside its opener");
    if (
      phone &&
      Math.abs(
        originalBox.width -
          original.parentElement!.getBoundingClientRect().width,
      ) > 1.5
    )
      failures.push("Original opener does not fill the card");
    const progress = document.querySelector<HTMLElement>(
      ".receiving-progress-actions",
    )!;
    const progressButtons = [
      ...progress.querySelectorAll<HTMLElement>("button"),
    ].filter((node) => node.getClientRects().length);
    if (
      phone &&
      (progressButtons.length !== 2 ||
        Math.abs(
          progressButtons[0].getBoundingClientRect().width -
            progressButtons[1].getBoundingClientRect().width,
        ) > 1.5)
    )
      failures.push("Phone progress actions are not equal width");
    if (document.documentElement.scrollWidth > viewport + 1.5)
      failures.push("Document horizontal overflow");
    return {
      width: viewport,
      phone,
      fields: elements.length,
      names: card.querySelectorAll(".receiving-product-name").length,
      failures,
    };
  });
}

async function palette(input: Locator) {
  return input.evaluate((element) => {
    const style = getComputedStyle(element);
    const swatch = document.createElement("span");
    document.body.appendChild(swatch);
    const token = (name: string) => {
      swatch.style.color = style.getPropertyValue(name);
      return getComputedStyle(swatch).color;
    };
    const tokens = {
      field: token("--klead-field"),
      surface: token("--surface"),
      pending: token("--pending-dot"),
      accent: token("--accent"),
      border: token("--field-border"),
    };
    swatch.remove();
    return {
      fill: style.backgroundColor,
      border: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      tokens,
    };
  });
}

async function rejectsBrokenComposition(page: Page) {
  const add = page.locator(".receiving-add-line .button-secondary");
  const addStyle = await add.getAttribute("style");
  await add.evaluate((element) => {
    (element as HTMLElement).style.inlineSize = "calc(100% - 4px)";
  });
  const narrow = await inspect(
    page,
    "R2g B4 wrong footer slot",
    "negative-509",
    "owner",
  );
  expect(narrow.failures).toContain(
    "Receiving phone add footer must fill its full and half-width slots",
  );
  await add.evaluate((element, style) => {
    if (style === null) element.removeAttribute("style");
    else element.setAttribute("style", style);
  }, addStyle);
  const thumbnail = page.locator(".original-viewer-thumbnail");
  const thumbnailStyle = await thumbnail.getAttribute("style");
  await thumbnail.evaluate((element) => {
    (element as HTMLElement).style.inlineSize = "44px";
  });
  const clipped = await inspect(
    page,
    "R2g B4 wrong original thumbnail",
    "negative-509",
    "owner",
  );
  expect(clipped.failures).toContain(
    "Receiving original opener must retain its genuine full-width card and clipped thumbnail",
  );
  await thumbnail.evaluate((element, style) => {
    if (style === null) element.removeAttribute("style");
    else element.setAttribute("style", style);
  }, thumbnailStyle);
  await page.locator(".original-viewer-phone-trigger").evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.id = "b4-counterfeit-original";
    copy.style.display = "grid";
    copy.style.inlineSize = "100%";
    copy.style.minBlockSize = "64px";
    document.querySelector(".receiving-lines")!.appendChild(copy);
  });
  await expect(page.locator("#b4-counterfeit-original")).toBeVisible();
  const copied = await inspect(
    page,
    "R2g B4 copied original class",
    "negative-509",
    "owner",
  );
  expect(copied.failures).toContain(
    "Receiving original opener must retain its genuine full-width card and clipped thumbnail",
  );
  await page
    .locator("#b4-counterfeit-original")
    .evaluate((element) => element.remove());
  expect(
    (
      await inspect(
        page,
        "R2g B4 restored composition",
        "restored-509",
        "owner",
      )
    ).failures,
  ).toEqual([]);
}

async function appearance(page: Page, language: "en" | "fa") {
  if (language === "fa") {
    await (await openShellAction(page, "تغییر به تم تیره")).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  }
}

for (const language of ["en", "fa"] as const) {
  test(`B4 invoice lines charges and totals match their responsive composition in ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const imported = await importReceivingFixture(page, language);
    await appearance(page, language);
    const original = await readCanonicalBusinessEvidence(page);
    await expect(
      page.locator(".receiving-lines .receiving-charges"),
    ).toHaveCount(1);
    await expect(
      page.locator(".receiving-work > .invoice-other-charges"),
    ).toHaveCount(0);
    await expect(
      page.locator(".receiving-lines .receiving-add-line"),
    ).toHaveCount(1);
    for (const width of [360, 390, 509, 760, 1000, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      const proof = await geometry(page);
      expect(proof.width).toBe(width);
      expect(proof.names).toBe(imported.lines.length);
      expect(proof.fields).toBeGreaterThan(8);
      if (width === 1440 || width === 509) {
        const report = await inspect(
          page,
          "R2g B4 receiving",
          `${language}-${width}`,
          "owner",
        );
        expect(report.failures).toEqual([]);
        await info.attach(`B4-controls-${language}-${width}`, {
          body: JSON.stringify(report),
          contentType: "application/json",
        });
      }
      if (width === 509) await rejectsBrokenComposition(page);
      await info.attach(`B4-geometry-${language}-${width}`, {
        body: JSON.stringify(proof),
        contentType: "application/json",
      });
      await page.screenshot({
        path: info.outputPath(`B4-${language}-${width}.png`),
        fullPage: true,
      });
    }
    await page.locator(".invoice-line-toggle").first().click();
    await expect(page.locator("#invoice-line-0-detail")).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`B4-expanded-${language}-1440.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 509, height: 960 });
    await page.screenshot({
      path: info.outputPath(`B4-expanded-${language}-509.png`),
    });
    expect(await readCanonicalBusinessEvidence(page)).toEqual(original);
    expect(errors).toEqual([]);
  });

  test(`B4 inline charge corrections keep original identity and money at 509px in ${language} @r2g-509`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 509, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const readings = structuredClone(readingsFixture);
    const complete = readings.invoices.find(
      (entry) => entry.id === "fictional-r2-complete",
    )!;
    Object.assign(complete.ai_statuses, {
      "lines[25].description": "check",
      "lines[25].line_total": "check",
      "lines[25].taxable": "check",
    });
    await importReceivingFixture(page, language, undefined, undefined, {
      name: "fictional-b4-charge-checks.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(readings)),
    });
    await appearance(page, language);
    const flagged = page.locator("#invoice-check-charge-0-input-line_total");
    const amber = await palette(flagged);
    expect(amber.fill).toBe(amber.tokens.field);
    expect(amber.border).toBe(amber.tokens.pending);
    expect(amber.borderWidth).toBe("2px");
    await flagged.focus();
    const focusedAmber = await palette(flagged);
    expect(focusedAmber.fill).toBe(focusedAmber.tokens.surface);
    expect(focusedAmber.border).toBe(focusedAmber.tokens.pending);
    await flagged.blur();
    const noTax = page
      .locator("#invoice-check-charge-0-input-taxable")
      .getByRole("button", {
        name: word(language, "No tax", "بدون مالیات"),
        exact: true,
      });
    await expectReceivingStable(page, noTax, async () => {
      await noTax.click();
      await expect
        .poll(async () =>
          (
            await readCanonicalBusinessEvidence(page)
          ).invoice.other_charges?.[0]?.low_confidence_fields?.includes(
            "taxable",
          ),
        )
        .toBe(false);
    });
    expect(
      await page
        .locator("#invoice-check-charge-0-input-taxable")
        .evaluate((node) => getComputedStyle(node).borderTopWidth),
    ).toBe("0px");
    const before = await readCanonicalBusinessEvidence(page);
    const count = before.invoice.other_charges!.length;
    const add = page.getByRole("button", {
      name: word(
        language,
        "+ Add charge or credit",
        "+ افزودن هزینه یا اعتبار",
      ),
      exact: true,
    });
    await expectReceivingStable(page, add, async () => {
      await add.click();
      await expect(page.locator(".receiving-charge")).toHaveCount(count + 1);
    });
    const description = page.locator(
      `#invoice-check-charge-${count}-input-description`,
    );
    await description.fill("Fictional handling fee");
    const amount = page.locator(
      `#invoice-check-charge-${count}-input-line_total`,
    );
    const defaultAmount = await palette(amount);
    expect(defaultAmount.fill).toBe(defaultAmount.tokens.field);
    expect(defaultAmount.border).toBe(defaultAmount.tokens.border);
    expect(defaultAmount.borderWidth).toBe("1px");
    await expectReceivingStable(page, amount, async () => {
      await amount.fill("4.25");
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.other_charges?.[
              count
            ]?.amount,
        )
        .toBe("4.25");
    });
    const focusedAmount = await palette(amount);
    expect(focusedAmount.fill).toBe(focusedAmount.tokens.surface);
    expect(focusedAmount.border).toBe(focusedAmount.tokens.accent);
    expect(focusedAmount.shadow).not.toBe("none");
    const taxable = page
      .locator(`#invoice-check-charge-${count}-input-taxable`)
      .getByRole("button", {
        name: word(language, "Taxable", "مشمول"),
        exact: true,
      });
    await expectReceivingStable(page, taxable, async () => {
      await taxable.click();
      await expect(taxable).toHaveAttribute("aria-pressed", "true");
    });
    const updated = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(updated.id).toBe(before.invoice.id);
    expect(updated.other_charges?.[count]).toMatchObject({
      description: "Fictional handling fee",
      amount: "4.25",
      taxable: true,
    });
    expect(updated.lines).toEqual(before.invoice.lines);
    expect(updated.file_data).toBe(before.invoice.file_data);
    expect(updated.original_pages).toEqual(before.invoice.original_pages);
    expect(updated.reading_record).toEqual(before.invoice.reading_record);
    const derivedSubtotal =
      before.invoice.calculated_from_lines &&
      before.invoice.calculated_fields?.includes("subtotal");
    const expectedSubtotal = derivedSubtotal
      ? [
          ...updated.lines.map((line) => line.line_total),
          ...updated.other_charges!.map((charge) => charge.amount),
        ]
          .reduce((sum, amount) => sum.plus(amount), new Decimal(0))
          .toFixed(2)
      : before.invoice.subtotal;
    expect(updated.subtotal).toBe(expectedSubtotal);
    // Printed tax and final total stay as reconciliation evidence.
    expect([updated.tax, updated.final_total]).toEqual([
      before.invoice.tax,
      before.invoice.final_total,
    ]);
    const expectedCharges = updated.other_charges!.reduce(
      (sum, charge) => sum.plus(charge.amount),
      new Decimal(0),
    );
    const chargesTotal = page
      .locator(".receiving-totals-group")
      .first()
      .locator(".receiving-total-row")
      .nth(1);
    await expect(chargesTotal).toContainText(expectedCharges.toFixed(2));
    expect((await geometry(page)).failures).toEqual([]);
    await page.reload();
    await expect(description).toHaveValue("Fictional handling fee");
    await expect(amount).toHaveValue("4.25");
    await expect(taxable).toHaveAttribute("aria-pressed", "true");
    await page.locator(".receiving-charge-remove").nth(count).click();
    await expect(page.locator(".receiving-charge")).toHaveCount(count);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.other_charges).toEqual(before.invoice.other_charges);
    expect([
      after.invoice.subtotal,
      after.invoice.tax,
      after.invoice.final_total,
    ]).toEqual([
      before.invoice.subtotal,
      before.invoice.tax,
      before.invoice.final_total,
    ]);
    expect(after.invoice.file_data).toBe(before.invoice.file_data);
    expect(after.invoice.status).toBe("review");
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    await info.attach(`B4-recovery-${language}-509`, {
      body: JSON.stringify(await geometry(page)),
      contentType: "application/json",
    });
    expect(errors).toEqual([]);
  });
}
