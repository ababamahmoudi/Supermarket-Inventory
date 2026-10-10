import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setLanguage, signIn } from "./helpers";

test.setTimeout(180000);
test.use({ actionTimeout: 10000 });

type Language = "en" | "fa";
const copy = (language: Language, en: string, fa: string) =>
  language === "en" ? en : fa;

async function geometry(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => resolve()),
      ),
    );
  });
  return page.evaluate(() => {
    const failures: string[] = [];
    const area =
      document.querySelector<HTMLElement>("dialog[open]") ??
      document.querySelector<HTMLElement>("#main-content");
    if (!area) throw new Error("The visible page or dialog is missing.");
    if (document.documentElement.scrollWidth > innerWidth + 2)
      failures.push("The document scrolls horizontally.");
    let panels = 0;
    let cells = 0;
    let textFragments = 0;
    for (const panel of [
      area,
      ...area.querySelectorAll<HTMLElement>(
        ".card, .ui-data-table, table, .field, .invoice-correction-line, .invoice-original-media, .lookup-approved-price",
      ),
    ]) {
      if (!panel.getClientRects().length) continue;
      panels++;
      const bounds = panel.getBoundingClientRect();
      if (panel.scrollWidth > panel.clientWidth + 2)
        failures.push(
          `${panel.className || panel.tagName}: horizontal panel scroll`,
        );
      if (bounds.left < -2 || bounds.right > innerWidth + 2)
        failures.push(`${panel.className || panel.tagName}: outside viewport`);
    }
    for (const container of area.querySelectorAll<HTMLElement>(
      "th, td, .field > label, .posted-invoice-totals dt, .posted-invoice-totals dd, .lookup-approved-price",
    )) {
      if (!container.getClientRects().length) continue;
      // Compact invoice rows retain accessible labels using the same
      // visually-hidden clip as sr-only; these are not visible text.
      if (getComputedStyle(container).clipPath !== "none") continue;
      if (container.matches("th, td")) cells++;
      const bounds = container.getBoundingClientRect();
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (
          !node.textContent?.trim() ||
          !parent?.getClientRects().length ||
          getComputedStyle(parent).clipPath !== "none" ||
          parent.closest(
            ".sr-only, .visually-hidden, [hidden], [aria-hidden=true]",
          )
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          textFragments++;
          if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
            failures.push(`Clipped visible text: ${node.textContent.trim()}`);
        }
      }
    }
    return { panels, cells, textFragments, failures };
  });
}

for (const width of [1280, 1440, 1920]) {
  for (const language of ["en", "fa"] as const) {
    test(`C4 documents, new items, weighed prices, dates and pending credits fit at ${width}px (${language})`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name === "phone",
        "Desktop no-clipping matrix.",
      );
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Supervisor");
      const report: {
        scene: string;
        proof: Awaited<ReturnType<typeof geometry>>;
      }[] = [];
      const check = async (
        scene: string,
        selector: string,
        hasTable = false,
      ) => {
        await expect(page.locator(selector).first()).toBeVisible();
        const proof = await geometry(page);
        expect(proof.panels, `${scene}: real panels checked`).toBeGreaterThan(
          0,
        );
        expect(
          proof.textFragments,
          `${scene}: visible text checked`,
        ).toBeGreaterThan(2);
        if (hasTable)
          expect(
            proof.cells,
            `${scene}: populated table checked`,
          ).toBeGreaterThan(5);
        expect(proof.failures, scene).toEqual([]);
        report.push({ scene, proof });
      };

      // Make the order through the interface so pack, money and temporary-name
      // columns contain real values rather than an empty layout fixture.
      await page.goto("/#orders");
      await page
        .getByRole("button", { name: "New order", exact: true })
        .click();
      const form = page.getByRole("form", { name: "New order", exact: true });
      await chooseOption(
        page,
        form.getByLabel("Supplier", { exact: true }),
        "Fresh Valley Foods",
      );
      await form.getByLabel(/^Cases — Canned Fava Beans/).fill("1");
      await form
        .getByLabel(/^Expected unit cost — Canned Fava Beans/)
        .fill("0.98");
      await form.getByRole("button", { name: "New item", exact: true }).click();
      const newItem = page.getByRole("dialog", {
        name: "New item",
        exact: true,
      });
      await newItem
        .getByLabel("Name", { exact: true })
        .fill("Sample barley biscuits");
      await newItem
        .getByLabel("Units per case (optional)", { exact: true })
        .fill("12");
      await newItem.getByLabel("Cases", { exact: true }).fill("2");
      await newItem
        .getByLabel("Expected unit cost (optional)", { exact: true })
        .fill("1.25");
      await newItem
        .getByRole("button", { name: "Add item", exact: true })
        .click();
      await expect(newItem).not.toBeVisible();
      await expect(page.locator(".order-new-item-row")).toContainText("$30.00");
      await setLanguage(page, language);
      await check(
        "New order with retained packs and a New item",
        ".order-items-table",
        true,
      );
      await page
        .getByRole("button", {
          name: copy(language, "Place order", "ثبت سفارش"),
          exact: true,
        })
        .click();
      const orderHeading = page.getByRole("heading", { level: 1 });
      await expect(orderHeading).toHaveText(/^ORD-/);
      const reference = (await orderHeading.innerText()).trim();

      await setLanguage(page, "en");
      await page.goto("/#invoices");
      await page
        .getByRole("button", { name: "New invoice", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Manual entry", exact: true })
        .click();
      await page
        .locator("#invoice-details-fields")
        .getByLabel("Supplier", { exact: true })
        .click();
      await page
        .getByRole("listbox", { name: "Supplier", exact: true })
        .getByRole("option", { name: /Fresh Valley Foods/ })
        .click();
      await page.getByRole("button", { name: "Add line", exact: true }).click();
      const line = page.locator(".invoice-line").first();
      const quantity = line.getByLabel("Invoiced quantity", { exact: true });
      if (!(await quantity.isVisible()))
        await line.locator(".invoice-line-toggle").click();
      await line.getByLabel("Units per case", { exact: true }).fill("12");
      await quantity.fill("12");
      await line
        .getByLabel("Unit cost before tax", { exact: true })
        .fill("0.98");
      const comparison = page.locator(".invoice-order-card");
      await comparison.getByLabel("Order (optional)", { exact: true }).click();
      await page
        .getByRole("option", { name: new RegExp(`^${reference} · `) })
        .click();
      await expect(comparison).toContainText("Sample barley biscuits");
      await expect(comparison.locator(".invoice-order-table")).toContainText(
        "Canned Fava Beans",
      );
      await setLanguage(page, language);
      await check(
        "Invoice review and explicit New item comparison",
        ".invoice-order-card",
        true,
      );

      await page.goto("/#invoices?id=a2-fixture%3AFV-20390");
      await expect(page.locator(".posted-invoice-document")).toContainText(
        "FV-20390",
      );
      const original = page.locator(".invoice-original-media img");
      await expect(original).toBeVisible();
      await expect
        .poll(() =>
          original.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await check(
        "Posted read-only invoice with retained original image",
        ".posted-invoice-document",
        true,
      );
      await page
        .getByRole("button", {
          name: copy(language, "Correct invoice", "اصلاح فاکتور"),
          exact: true,
        })
        .click();
      const correction = page.getByRole("dialog", {
        name: copy(language, "Correct invoice", "اصلاح فاکتور"),
        exact: true,
      });
      await correction
        .locator(".invoice-correction-line")
        .first()
        .getByLabel(
          copy(language, "Unit cost before tax", "هزینه هر واحد پیش از مالیات"),
          { exact: true },
        )
        .fill("1.01");
      await correction
        .getByLabel(copy(language, "Reason (required)", "دلیل (الزامی)"), {
          exact: true,
        })
        .fill("Correct the bean unit cost.");
      await check("Populated correction fields", ".invoice-correction-dialog");
      await correction
        .getByRole("button", {
          name: copy(language, "Preview correction", "پیش‌نمایش اصلاح"),
          exact: true,
        })
        .click();
      await expect(correction.locator(".posted-invoice-totals")).toContainText(
        "$0.72",
      );
      await check(
        "Correction payable, receipt, approval and date preview",
        ".invoice-correction-dialog",
      );

      await page.goto("/#lookup");
      await page
        .getByLabel(copy(language, "Search products", "جست‌وجوی محصولات"), {
          exact: true,
        })
        .fill("0016");
      await expect(page.locator(".lookup-approved-price")).toContainText(
        "$7.49/lb",
      );
      await expect(page.locator(".lookup-approved-price")).toContainText(
        "$16.51/kg",
      );
      await check(
        "Weighed primary and secondary selling prices",
        ".lookup-approved-price",
      );

      await page.goto("/#expiry");
      const quickAdd = page.locator(".date-quick-card");
      await quickAdd
        .getByLabel(copy(language, "Product", "محصول"), { exact: true })
        .fill("0001");
      await quickAdd
        .getByLabel(copy(language, "Date", "تاریخ"), { exact: true })
        .click();
      await page
        .locator(".ui-calendar")
        .getByRole("button", {
          name: copy(language, "Today", "امروز"),
          exact: true,
        })
        .click();
      await quickAdd
        .getByRole("button", {
          name: copy(language, "More", "بیشتر"),
          exact: true,
        })
        .click();
      await quickAdd
        .getByLabel(copy(language, "Quantity (optional)", "مقدار (اختیاری)"), {
          exact: true,
        })
        .fill("2");
      await quickAdd
        .getByLabel(copy(language, "Lot (optional)", "سری ساخت (اختیاری)"), {
          exact: true,
        })
        .fill("C4-LAYOUT-LOT");
      await check(
        "Manual quick-add bar with product, location and optional date evidence",
        ".date-quick-card",
      );

      // Pickup has evidence and leaves the ledger alone. The pending-claim
      // display must therefore have populated money and memo columns.
      await page.goto("/#return?id=demo-return-1");
      await setLanguage(page, "en");
      await page
        .locator(".return-header-card")
        .getByRole("button", { name: "Record pickup", exact: true })
        .click();
      const pickup = page.locator(".return-action-card");
      await pickup.getByLabel(/Actual pickup units$/).fill("3");
      await pickup
        .getByLabel("Supplier representative name", { exact: true })
        .fill("Demo Driver");
      await pickup
        .getByLabel("Signed paper pickup slip reference", { exact: true })
        .fill("SIGNED-C4-LAYOUT-001");
      await pickup
        .getByRole("button", { name: "Record pickup", exact: true })
        .click();
      await expect(
        page
          .locator(".return-memos-card")
          .getByRole("button", { name: /^RM-/ })
          .last(),
      ).toBeVisible();
      await page.goto("/#returns");
      await setLanguage(page, language);
      await expect(page.locator(".returns-overview-table")).toContainText(
        copy(language, "Waiting for credit", "در انتظار اعتبار"),
      );
      await check(
        "Returns Open with real pending pickup credit",
        ".returns-overview-table",
        true,
      );
      await page.goto("/#payables");
      const supplier = page
        .locator(".payables-overview-table tbody tr")
        .filter({ hasText: "Fresh Valley Foods" });
      await supplier
        .getByRole("button", {
          name: copy(language, "View", "مشاهده"),
          exact: true,
        })
        .click();
      await expect(page.locator(".pending-return-credits")).toContainText(
        copy(language, "Confirmed balance", "مانده تأییدشده"),
      );
      await check(
        "Payables pending credit and retained supplier ledger",
        ".pending-return-credits",
        true,
      );
      await testInfo.attach(`c4-layout-${width}-${language}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
    });
  }
}
