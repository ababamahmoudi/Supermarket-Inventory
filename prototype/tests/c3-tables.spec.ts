import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setLanguage, signIn } from "./helpers";
import { installLocationReturnScene } from "./r2f-location-return-fixture";

test.setTimeout(180000);
test.use({ actionTimeout: 10000 });

async function newOrder(page: Page) {
  await page.goto("/#orders");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await chooseOption(
    page,
    form.getByLabel("Location", { exact: true }),
    "North York",
  );
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  return form;
}

async function expectApprovedCatalogPrice(page: Page) {
  const row = page.locator(".catalog-products-table tbody tr").filter({
    has: page.locator('a[href="#product?code=0001"]'),
  });
  await expect(row).toHaveCount(1);
  await expect(row).toBeVisible();
  const compact = await row.evaluate((element) =>
    element.matches(".phone-list-row"),
  );
  const price = compact
    ? row.locator(".phone-list-value")
    : row.locator("td[data-column-key=price]");
  await expect(price).toBeVisible();
  await expect(price).toContainText("$23.99");
}

async function proveTables(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  return page.evaluate(() => {
    const failures: string[] = [];
    let cells = 0;
    let textFragments = 0;
    const boundedScrolls: {
      columns: string[];
      rows: number;
      overflow: number;
    }[] = [];
    const wrappers = [
      ...document.querySelectorAll<HTMLElement>("main .ui-data-table"),
    ].filter((element) => element.getClientRects().length);
    for (const wrapper of wrappers) {
      const table = wrapper.querySelector("table")!;
      const box = wrapper.getBoundingClientRect();
      const tableBox = table.getBoundingClientRect();
      const card = wrapper.closest(".returns-overview.card.ui-card");
      const cardBox = card?.getBoundingClientRect();
      const keys = [
        ...table.querySelectorAll<HTMLElement>("thead th[data-column-key]"),
      ].map((cell) => cell.dataset.columnKey!);
      const rows = [...table.querySelectorAll<HTMLElement>("tbody > tr")];
      // D8 explicitly retains every selected fact through this keyboard-focusable
      // internal scroller. Qualify the real card, columns and record destinations;
      // a copied is-scrollable class grants no containment exception.
      const retainedReturns =
        wrapper.matches(
          ".returns-overview-table.is-responsive.is-scrollable.has-record-details:not(.is-mobile)",
        ) &&
        card?.querySelector(".returns-toolbar.filter-toolbar") &&
        table.matches("table.has-defined-columns") &&
        wrapper.dataset.widthHiddenColumnCount === "0" &&
        ["reference", "supplier", "items", "date", "status", "actions"].every(
          (key) => keys.includes(key),
        ) &&
        table.querySelectorAll(":scope > colgroup > col").length ===
          keys.length &&
        rows.length > 0 &&
        rows.every((row) => {
          const href = row.dataset.rowHref;
          return (
            href?.startsWith("#return?id=") &&
            JSON.stringify(
              [
                ...row.querySelectorAll<HTMLElement>(
                  ":scope > td[data-column-key]",
                ),
              ].map((cell) => cell.dataset.columnKey),
            ) === JSON.stringify(keys) &&
            row.querySelectorAll(".table-row-link").length === 1 &&
            row
              .querySelector("td[data-column-key='actions'] .table-row-link")
              ?.getAttribute("href") === href
          );
        });
      const boundedReturns = Boolean(
        retainedReturns &&
        cardBox &&
        /^(auto|scroll)$/.test(getComputedStyle(wrapper).overflowX) &&
        wrapper.tabIndex >= 0 &&
        box.left >= cardBox.left - 2 &&
        box.right <= cardBox.right + 2 &&
        box.left >= -2 &&
        box.right <= innerWidth + 2 &&
        Math.abs(tableBox.width - wrapper.scrollWidth) <= 2,
      );
      if (retainedReturns && !boundedReturns)
        failures.push(
          "Returns selected-column scroller is not bounded and keyboard accessible",
        );
      if (boundedReturns && wrapper.scrollWidth > wrapper.clientWidth + 2)
        boundedScrolls.push({
          columns: keys,
          rows: rows.length,
          overflow: wrapper.scrollWidth - wrapper.clientWidth,
        });
      if (wrapper.scrollWidth > wrapper.clientWidth + 2 && !boundedReturns)
        failures.push(
          `${wrapper.className}: horizontal scroll ${wrapper.scrollWidth}/${wrapper.clientWidth}`,
        );
      if (
        (tableBox.left < box.left - 2 || tableBox.right > box.right + 2) &&
        !boundedReturns
      )
        failures.push(`${wrapper.className}: table outside its panel`);
      if (box.left < -2 || box.right > innerWidth + 2)
        failures.push(`${wrapper.className}: panel outside viewport`);
      for (const cell of table.querySelectorAll<HTMLElement>("th, td")) {
        if (!cell.getClientRects().length) continue;
        const headingGroup = cell.closest("thead");
        if (headingGroup && getComputedStyle(headingGroup).clipPath !== "none")
          continue;
        cells++;
        const bounds = cell.getBoundingClientRect();
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (
            !node.textContent?.trim() ||
            !parent?.getClientRects().length ||
            parent.closest(".sr-only, [aria-hidden=true], [hidden]")
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            textFragments++;
            if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
              failures.push(`Clipped cell text: ${node.textContent.trim()}`);
          }
        }
        const key = cell.dataset.columnKey;
        if (cell.tagName !== "TH" || !key) continue;
        const bodyCell = table.querySelector<HTMLElement>(
          `tbody [data-column-key="${key}"]`,
        );
        if (!bodyCell?.getClientRects().length) continue;
        const bodyBox = bodyCell.getBoundingClientRect();
        if (
          Math.abs(bounds.left - bodyBox.left) > 2 ||
          Math.abs(bounds.right - bodyBox.right) > 2
        )
          failures.push(`Heading is not above its values: ${key}`);
        const headerAlignment = getComputedStyle(cell).textAlign;
        const bodyAlignment = getComputedStyle(bodyCell).textAlign;
        if (headerAlignment !== bodyAlignment)
          failures.push(
            `Heading/value alignment differs: ${key} ${headerAlignment}/${bodyAlignment}`,
          );
      }
    }
    return {
      tables: wrappers.length,
      cells,
      textFragments,
      boundedScrolls,
      failures,
    };
  });
}

function plainValue(value: string | null) {
  return (value ?? "")
    .replace(/[\u200e\u200f\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

for (const language of ["en", "fa"] as const) {
  test(`R2f D8 selected columns scroll only inside the real bounded Returns card (${language})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1280, height: 1080 });
    await installLocationReturnScene(page);
    await setLanguage(page, language);
    await page.goto("/#returns");
    const wrapper = page.locator(".returns-overview-table");
    await expect(wrapper.locator("tbody > tr")).toHaveCount(3);
    const before = await readCanonicalBusinessEvidence(page);
    const extraItems = wrapper.locator(
      'tr[data-row-href="#return?id=r2f-return-three"]',
    );
    await expect(
      extraItems.locator(".return-list-item-quantity").nth(1),
    ).toHaveText(language === "fa" ? "× 1 · +2 قلم دیگر" : "× 1 · +2 more");
    const product = before.products.find((item) => item.code === "0005")!;
    await expect(
      extraItems.locator(".return-list-item-name").nth(1),
    ).toHaveAttribute(
      "title",
      language === "fa" ? product.name_fa || product.name_en : product.name_en,
    );
    const initial = await proveTables(page);
    expect(initial.failures).toEqual([]);
    expect(initial.boundedScrolls).toHaveLength(1);
    expect(initial.boundedScrolls[0].overflow).toBeGreaterThan(2);
    expect(initial.boundedScrolls[0].columns).toContain("credit");
    expect(initial.boundedScrolls[0].rows).toBe(3);
    await expect(wrapper).toHaveAttribute(
      "data-width-hidden-column-count",
      "0",
    );
    const retained = await wrapper.locator("tbody").innerText();
    const maxScroll = await wrapper.evaluate(
      (node) => node.scrollWidth - node.clientWidth,
    );
    const scans = [];
    for (const position of [0, language === "fa" ? -maxScroll : maxScroll]) {
      await wrapper.evaluate(
        (node, left) => (node.scrollLeft = left),
        position,
      );
      scans.push(await proveTables(page));
      expect(scans.at(-1)!.failures).toEqual([]);
      expect(await wrapper.locator("tbody").innerText()).toBe(retained);
    }
    expect(
      Math.abs(await wrapper.evaluate((node) => node.scrollLeft)),
    ).toBeGreaterThan(2);
    await wrapper.focus();
    await expect(wrapper).toBeFocused();
    await page.keyboard.press(language === "fa" ? "ArrowRight" : "ArrowLeft");
    await expect
      .poll(async () =>
        Math.abs(await wrapper.evaluate((node) => node.scrollLeft)),
      )
      .toBeLessThan(maxScroll);

    // Every qualification is exercised against the actual scroller, with the
    // original cell text, heading edges and 2px budgets still inspected.
    await wrapper.evaluate((node) => (node.tabIndex = -1));
    expect((await proveTables(page)).failures).toContain(
      "Returns selected-column scroller is not bounded and keyboard accessible",
    );
    await wrapper.evaluate((node) => (node.tabIndex = 0));
    await wrapper.evaluate((node) => (node.style.overflowX = "visible"));
    expect(
      (await proveTables(page)).failures.some(
        (failure) =>
          failure.includes("horizontal scroll") ||
          failure.includes("outside its panel"),
      ),
    ).toBe(true);
    await wrapper.evaluate((node) => node.style.removeProperty("overflow-x"));
    await wrapper.evaluate((node) => (node.style.marginInlineStart = "-100px"));
    expect((await proveTables(page)).failures).toContain(
      "Returns selected-column scroller is not bounded and keyboard accessible",
    );
    await wrapper.evaluate((node) =>
      node.style.removeProperty("margin-inline-start"),
    );
    const first = wrapper.locator("tbody > tr").first();
    const rowHref = await first.getAttribute("data-row-href");
    await first.evaluate((node) => node.removeAttribute("data-row-href"));
    expect(
      (await proveTables(page)).failures.some((failure) =>
        failure.includes("horizontal scroll"),
      ),
    ).toBe(true);
    await first.evaluate(
      (node, href) => node.setAttribute("data-row-href", href!),
      rowHref,
    );
    const quantity = extraItems.locator(".return-list-item-quantity").nth(1);
    await quantity.evaluate(
      (node) => (node.style.transform = "translateX(400px)"),
    );
    expect(
      (await proveTables(page)).failures.some((failure) =>
        failure.includes("Clipped cell text"),
      ),
    ).toBe(true);
    await quantity.evaluate((node) => node.style.removeProperty("transform"));
    const final = await proveTables(page);
    expect(final.failures).toEqual([]);
    expect(final.boundedScrolls).toHaveLength(1);
    expect(await wrapper.locator("tbody").innerText()).toBe(retained);
    // The approved phone composition keeps a short name's quantity adjacent,
    // while the desktop's narrow name track still reserves the complete +N.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(wrapper).toHaveClass(/is-phone-list/);
    const firstItem = wrapper.locator(".return-list-item-names > span").first();
    const firstProduct = before.products.find((item) => item.code === "0001")!;
    await expect(firstItem.locator(".return-list-item-name")).toHaveText(
      language === "fa"
        ? firstProduct.name_fa || firstProduct.name_en
        : firstProduct.name_en,
    );
    const adjacency = await firstItem.evaluate((node) => {
      const glyphs = (selector: string) => {
        const range = document.createRange();
        range.selectNodeContents(node.querySelector(selector)!);
        return range.getBoundingClientRect();
      };
      const name = glyphs(".return-list-item-name");
      const quantity = glyphs(".return-list-item-quantity");
      const gap =
        getComputedStyle(node).direction === "rtl"
          ? name.left - quantity.right
          : quantity.left - name.right;
      const style = getComputedStyle(
        node.querySelector(".return-list-item-name")!,
      );
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return { gap, inlineSpace: context.measureText(" ").width };
    });
    expect(adjacency.gap).toBeGreaterThanOrEqual(0);
    expect(
      Math.abs(adjacency.gap - 4),
      JSON.stringify(adjacency),
    ).toBeLessThanOrEqual(1.5);
    await page.screenshot({
      path: info.outputPath(`adjacent-items-${language}.png`),
      fullPage: true,
    });
    const after = await readCanonicalBusinessEvidence(page);
    for (const field of [
      "returns",
      "ledger",
      "stock",
      "stock_movements",
    ] as const)
      expect(after[field], `Scrolling preserves ${field}`).toEqual(
        before[field],
      );
    await info.attach("bounded-selected-column-scroller", {
      body: JSON.stringify(
        { initial, scans, final, phoneAdjacency: adjacency },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
}

async function proveSupplierRecord(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  return page.evaluate(() => {
    const failures: string[] = [];
    let fragments = 0;
    const fields = document.querySelectorAll<HTMLElement>(
      ".supplier-detail-header h1,.supplier-contact-grid dd,.supplier-kpis .kpi-value,.supplier-overview-facts dd",
    );
    for (const field of fields) {
      const bounds = field.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0)
        failures.push(`Supplier fact is hidden: ${field.textContent}`);
      if (bounds.left < -2 || bounds.right > innerWidth + 2)
        failures.push(`Supplier fact leaves viewport: ${field.textContent}`);
      const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (
          !node.textContent?.trim() ||
          !node.parentElement?.getClientRects().length ||
          node.parentElement.closest(".sr-only,[aria-hidden=true],[hidden]")
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          fragments++;
          if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
            failures.push(`Clipped supplier fact: ${node.textContent.trim()}`);
        }
      }
    }
    return { fields: fields.length, fragments, failures };
  });
}

for (const width of [1280, 1440, 1920]) {
  for (const language of ["en", "fa"] as const) {
    test(`all seven table pages fit and retain their complete text at ${width}px (${language})`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name === "phone", "Desktop table geometry.");
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Supervisor");
      const form = await newOrder(page);
      await form
        .getByRole("textbox", { name: /^Cases —/ })
        .first()
        .fill("1");
      await form
        .getByRole("button", { name: "Save as draft", exact: true })
        .click();
      await expect(page).toHaveURL(/#orders\?id=/);
      const orderUrl = page.url();
      await setLanguage(page, language);
      const report: {
        scene: string;
        proof: Awaited<ReturnType<typeof proveTables>>;
      }[] = [];
      const check = async (scene: string) => {
        await expect(page.locator("main .ui-data-table").first()).toBeVisible();
        const proof = await proveTables(page);
        expect(proof.cells, `${scene}: nonempty table proof`).toBeGreaterThan(
          5,
        );
        expect(
          proof.textFragments,
          `${scene}: real visible text checked`,
        ).toBeGreaterThan(5);
        expect(proof.failures, scene).toEqual([]);
        report.push({ scene, proof });
      };
      for (const route of [
        "products",
        "suppliers",
        "received",
        "payables",
        "returns",
        "expiry",
        "orders",
      ]) {
        await page.goto(`/#${route}`);
        await check(route);
        if (route === "products") {
          const edit = page
            .locator(".catalog-products-table tbody tr")
            .first()
            .getByRole("button", {
              name: language === "en" ? /^Edit / : /^ویرایش /,
            });
          await edit.scrollIntoViewIfNeeded();
          const hit = await edit.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            return [0.2, 0.5, 0.8].every(
              (fraction) =>
                document
                  .elementFromPoint(
                    rect.left + rect.width * fraction,
                    rect.top + rect.height / 2,
                  )
                  ?.closest("button") === button,
            );
          });
          expect(
            hit,
            "The first Products Edit button must have no white overlay",
          ).toBe(true);
        }
        if (route === "suppliers") {
          await page
            .getByRole("button", {
              name: language === "en" ? "Columns" : "ستون‌ها",
              exact: true,
            })
            .click();
          const dialog = page.getByRole("dialog", {
            name: language === "en" ? "Columns" : "ستون‌ها",
            exact: true,
          });
          for (const checkbox of await dialog.getByRole("checkbox").all())
            if (!(await checkbox.isDisabled())) await checkbox.check();
          await dialog
            .getByRole("button", {
              name: language === "en" ? "Close" : "بستن",
              exact: true,
            })
            .click();
          const supplierTable = page.locator(".suppliers-table");
          // All twelve permitted columns remain configurable. R2c routes
          // omitted facts through the one full-record control at the row end.
          const supplierColumns = [
            ["name", "Supplier", "تأمین‌کننده"],
            ["status", "Status", "وضعیت"],
            ["last_delivery", "Last delivery", "آخرین تحویل"],
            ["deliveries", "Deliveries", "تحویل‌ها"],
            ["returns", "Open returns", "مرجوعی‌های باز"],
            ["shorts", "Open shorts", "کسری‌های باز"],
            ["terms", "Payment terms", "شرایط پرداخت"],
            ["contact", "Sales rep and phone", "نماینده فروش و تلفن"],
            ["balance", "Balance", "مانده"],
            ["overdue", "Overdue", "سررسید گذشته"],
            ["due", "Next due date", "سررسید بعدی"],
            ["actions", "Action", "عملیات"],
          ];
          await expect
            .poll(async () => {
              const visible = Number(
                await supplierTable.getAttribute("data-visible-column-count"),
              );
              const widthHidden = Number(
                await supplierTable.getAttribute(
                  "data-width-hidden-column-count",
                ),
              );
              return visible + widthHidden;
            })
            .toBe(supplierColumns.length);
          const widthHidden = Number(
            await supplierTable.getAttribute("data-width-hidden-column-count"),
          );
          const visibleKeys = await supplierTable
            .locator("thead [data-column-key]")
            .evaluateAll((headers) =>
              headers.map((header) => header.getAttribute("data-column-key")),
            );
          expect(visibleKeys).toContain("name");
          expect(visibleKeys).toContain("actions");
          const hiddenColumns = supplierColumns.filter(
            ([key]) => !visibleKeys.includes(key),
          );
          expect(hiddenColumns).toHaveLength(widthHidden);
          expect(visibleKeys).toEqual(
            supplierColumns
              .filter(([key]) => visibleKeys.includes(key))
              .map(([key]) => key),
          );
          await expect(
            supplierTable.locator(".table-details-toggle,.table-expanded-row"),
          ).toHaveCount(0);
          await check("suppliers with every optional column enabled");
          const supplierRow = supplierTable
            .locator(".supplier-overview-row")
            .filter({ hasText: "Fresh Valley Foods" });
          await expect(supplierRow).toHaveCount(1);
          const recordLink = supplierRow.locator(
            'td[data-column-key="actions"] .table-row-link',
          );
          await expect(recordLink).toHaveCount(1);
          await expect(supplierRow.locator(".table-row-link")).toHaveCount(1);
          await expect(recordLink).toHaveAttribute(
            "href",
            "#suppliers?name=Fresh%20Valley%20Foods",
          );
          const visibleValues = await supplierRow
            .locator("td[data-column-key]")
            .evaluateAll((cells) =>
              Object.fromEntries(
                cells.map((cell) => [
                  cell.getAttribute("data-column-key"),
                  cell.textContent,
                ]),
              ),
            );
          const before = await readCanonicalBusinessEvidence(page);
          const source = before.suppliers!.find(
            (supplier) => supplier.name === "Fresh Valley Foods",
          )!;
          expect(source).toBeDefined();
          await recordLink.click();
          await expect(page).toHaveURL(
            /#suppliers\?name=Fresh%20Valley%20Foods$/,
          );
          await expect(page.locator(".supplier-detail-header h1")).toHaveText(
            source.name,
          );
          if (visibleKeys.includes("status"))
            expect(
              plainValue(
                await page
                  .locator(".supplier-detail-title .ui-badge")
                  .textContent(),
              ),
            ).toBe(plainValue(visibleValues.status));
          const contact = page.locator(".supplier-contact-grid");
          for (const [field, en, fa] of [
            ["phone", "Phone", "تلفن"],
            ["email", "Email", "ایمیل"],
            ["website", "Website", "وب‌سایت"],
            ["address", "Address", "نشانی"],
            ["sales_rep_name", "Sales representative", "نماینده فروش"],
            ["sales_rep_phone", "Sales rep phone", "تلفن نماینده فروش"],
            ["payment_terms", "Payment terms", "شرایط پرداخت"],
          ] as const) {
            const fact = contact.locator(":scope > div").filter({
              has: page.getByText(language === "en" ? en : fa, {
                exact: true,
              }),
            });
            await expect(fact).toBeVisible();
            await expect(fact.locator("dd")).toHaveText(
              source[field]?.trim() ||
                (language === "en" ? "Not added" : "ثبت نشده"),
            );
          }
          const tile = (en: string, fa: string) =>
            page.locator(".supplier-kpis .ui-summary-tile").filter({
              has: page.locator(".kpi-label", {
                hasText: language === "en" ? en : fa,
              }),
            });
          const overviewFact = (en: string, fa: string) =>
            page.locator(".supplier-overview-facts > div").filter({
              has: page.getByText(language === "en" ? en : fa, {
                exact: true,
              }),
            });
          const destinations = {
            last_delivery: tile("Last delivery", "آخرین تحویل").locator(
              ".kpi-value",
            ),
            deliveries: tile(
              "Deliveries this month",
              "تحویل‌های این ماه",
            ).locator(".kpi-value"),
            returns: tile("Open returns", "مرجوعی‌های باز").locator(
              ".kpi-value",
            ),
            shorts: overviewFact("Open shorts", "کسری‌های باز").locator("dd"),
            balance: tile("Balance", "مانده").locator(".kpi-value"),
            overdue: overviewFact("Overdue", "سررسید گذشته").locator("dd"),
            due: overviewFact("Next due date", "سررسید بعدی").locator("dd"),
          };
          for (const [key, destination] of Object.entries(destinations)) {
            await expect(destination, `${key}: full record fact`).toBeVisible();
            await expect(
              destination,
              `${key}: real fact or empty value`,
            ).not.toBeEmpty();
            if (visibleKeys.includes(key))
              expect(plainValue(await destination.textContent()), key).toBe(
                plainValue(visibleValues[key]),
              );
          }
          for (const [key] of hiddenColumns)
            expect(
              [...Object.keys(destinations), "terms", "contact"],
              `${key}: omitted column has a tested full-record destination`,
            ).toContain(key);
          const detailProof = await proveSupplierRecord(page);
          expect(detailProof.fields).toBeGreaterThan(10);
          expect(detailProof.fragments).toBeGreaterThan(10);
          expect(detailProof.failures).toEqual([]);
          const after = await readCanonicalBusinessEvidence(page);
          for (const field of [
            "suppliers",
            "invoices",
            "invoice",
            "ledger",
            "returns",
          ] as const)
            expect(
              after[field],
              `Reading supplier details preserves ${field}`,
            ).toEqual(before[field]);
          await testInfo.attach(`supplier-record-${width}-${language}.json`, {
            body: JSON.stringify({ hiddenColumns, detailProof }, null, 2),
            contentType: "application/json",
          });
          await page
            .getByRole("button", {
              name:
                language === "en"
                  ? "Back to Suppliers"
                  : "بازگشت به تأمین‌کنندگان",
              exact: true,
            })
            .click();
          await check("supplier full-record Back retains the complete table");
        }
      }
      await page.goto(orderUrl);
      await check("saved order detail");
      await page.goto("/#payables");
      await page
        .locator(".payables-overview tbody tr")
        .filter({ hasText: "Fresh Valley Foods" })
        .getByRole("link", {
          name: "Fresh Valley Foods",
          exact: true,
        })
        .click();
      await check("supplier ledger");
      await page.goto("/#orders");
      await page
        .getByRole("button", {
          name: language === "en" ? "New order" : "سفارش جدید",
          exact: true,
        })
        .click();
      await chooseOption(
        page,
        page.getByLabel(language === "en" ? "Supplier" : "تأمین‌کننده", {
          exact: true,
        }),
        "Fresh Valley Foods",
      );
      await check("new order item and cost fields");
      await testInfo.attach(`tables-${width}-${language}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
    });
  }
}

test("Columns keeps mandatory names, persists by user and never exposes Supervisor money to a Floor Worker", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Columns", exact: true });
  await expect(
    dialog.getByRole("checkbox", { name: "Product", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Price", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(0);
  await page.reload();
  // An absent optional header also matches an app that has not resumed yet.
  // Assert the real signed-in catalog before checking its persisted columns.
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(
    page.locator(".catalog-products-table tbody tr").first(),
  ).toBeVisible();
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(0);
  await signIn(page, "Floor Worker");
  await page.goto("/#products");
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(1);
  await expectApprovedCatalogPrice(page);
  await page.goto("/#suppliers");
  await expect(
    page.locator(
      ".suppliers-table [data-column-key=balance], .suppliers-table [data-column-key=overdue], .suppliers-table [data-column-key=due]",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Columns", exact: true });
  await expect(
    dialog.getByRole("checkbox", { name: /Balance|Overdue|Next due date/ }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Columns", exact: true });
  await dialog
    .getByRole("button", { name: "Reset columns", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(1);
  await expectApprovedCatalogPrice(page);
});

test("browser Back restores the Products search and Orders status without mutating data", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  const search = page.getByLabel("Search products", { exact: true });
  await search.fill("0004");
  await page
    .locator(".catalog-products-table tbody tr")
    .first()
    .getByRole("link", { name: "Black Tea 450 g", exact: true })
    .click();
  await expect(page).toHaveURL(/#product\?code=/);
  await page.goBack();
  await expect(search).toHaveValue("0004");
  await expect(page.locator(".catalog-products-table tbody tr")).toHaveCount(1);
  const form = await newOrder(page);
  await form
    .getByRole("textbox", { name: /^Cases —/ })
    .first()
    .fill("1");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to Orders", exact: true })
    .click();
  await chooseOption(page, page.getByLabel("Status", { exact: true }), "Draft");
  const order = page.locator(".orders-list-table tbody tr").first();
  await order.locator(".order-reference-link").click();
  await expect(page).toHaveURL(/#orders\?id=/);
  await page.goBack();
  await expect(page.getByLabel("Status", { exact: true })).toHaveText("Draft");
  await expect(page.locator(".orders-list-table tbody tr")).toHaveCount(1);
});

test("an order error belongs to its invalid item and clears immediately only when that item changes", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const form = await newOrder(page);
  const details = form.getByRole("button", {
    name: "Show details",
    exact: true,
  });
  while (await details.count()) await details.first().click();
  const costs = form.getByRole("textbox", { name: /^Expected unit cost —/ });
  const cases = form.getByRole("textbox", { name: /^Cases —/ });
  expect(await costs.count()).toBeGreaterThan(1);
  await cases.nth(0).fill("1");
  await cases.nth(1).fill("1");
  await costs.nth(0).fill("1.00001");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(costs.nth(0)).toHaveAttribute("aria-invalid", "true");
  await expect(costs.nth(1)).toHaveAttribute("aria-invalid", "false");
  await costs.nth(1).fill("2.5000");
  await expect(costs.nth(0)).toHaveAttribute("aria-invalid", "true");
  await costs.nth(0).fill("1.0000");
  await expect(costs.nth(0)).toHaveAttribute("aria-invalid", "false");
  const saved = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).orders,
  );
  expect(saved).toHaveLength(0);
});

test("external payment is unchanged until explicit money confirmation, and cancellation records nothing", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#payables");
  await page
    .locator(".payables-overview tbody tr")
    .filter({ hasText: "Fresh Valley Foods" })
    .getByRole("link", { name: "Fresh Valley Foods", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record external payment", exact: true })
    .click();
  await page
    .getByLabel("Payment receipt reference", { exact: true })
    .fill("C3-CONFIRM-DEMO");
  await page
    .getByRole("button", {
      name: "Preview oldest-due allocations",
      exact: true,
    })
    .click();
  const ledger = () =>
    readCanonicalBusinessEvidence(page).then(
      (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).ledger,
    );
  const before = await ledger();
  await page
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Record external payment",
    exact: true,
  });
  await expect(dialog).toContainText("C3-CONFIRM-DEMO");
  expect(await ledger()).toEqual(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await ledger()).toEqual(before);
  await page
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Record external payment",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  const after = await ledger();
  expect(after).toHaveLength(before.length + 1);
  expect(after.at(-1)).toMatchObject({
    type: "payment",
    reference: "C3-CONFIRM-DEMO",
    amount: "-50.00",
  });
  await expect(page.getByTestId("undo-toast")).toHaveCount(0);
});
