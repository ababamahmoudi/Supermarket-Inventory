import type { Page } from "@playwright/test";
import Decimal from "decimal.js";
import { invoiceLineId } from "../src/invoice-line-links";
import { readCanonicalBusinessEvidence } from "./business-evidence";

export async function inspectTableAlignment(page: Page) {
  const expectedApprovals: {
    id: string;
    code: string;
    action: "Approve" | "Review";
    name_en: string;
    name_fa: string;
  }[] = [];
  if (await page.locator(".r2c-dashboard").count()) {
    const state = await readCanonicalBusinessEvidence(page);
    const company = state.config.company.seed_key;
    for (const approval of state.approvals.filter(
      (item) => item.company_id === company && item.status === "pending",
    )) {
      const product = state.products.find(
        (item) =>
          item.company_id === company && item.code === approval.product_code,
      );
      if (product)
        expectedApprovals.push({
          id: approval.id,
          code: product.code,
          action:
            approval.manual_override ||
            !["new_product", "price_change"].includes(approval.type)
              ? "Review"
              : "Approve",
          name_en: product.name_en,
          name_fa: product.name_fa || product.name_en,
        });
    }
    for (const request of (state.sale_requests ?? []).filter(
      (item) => item.company_id === company && item.status === "pending",
    )) {
      const product = state.products.find(
        (item) =>
          item.company_id === company && item.code === request.product_code,
      );
      if (product)
        expectedApprovals.push({
          id: request.id,
          code: product.code,
          action: "Review",
          name_en: product.name_en,
          name_fa: product.name_fa || product.name_en,
        });
    }
  }

  const expectedProducts: { code: string; en: string; fa: string }[] = [];
  const expectedReturns: {
    id: string;
    number: number;
    supplier: string;
    remaining: number;
    items: { en: string; fa: string; qty: number }[];
  }[] = [];
  if (await page.locator(".labels-products-card,.returns-overview").count()) {
    const state = await readCanonicalBusinessEvidence(page);
    const company = state.config.company.seed_key;
    expectedProducts.push(
      ...state.products
        .filter((item) => item.company_id === company)
        .map((item) => ({
          code: item.code,
          en: item.name_en,
          fa: item.name_fa.trim() ? item.name_fa : item.name_en,
        })),
    );
    state.returns
      .filter((item) => item.company_id === company)
      .forEach((record, index) => {
        expectedReturns.push({
          id: record.id,
          number: index + 1,
          supplier: record.supplier,
          remaining: Math.max(0, record.lines.length - 2),
          items: record.lines.slice(0, 2).map((line) => {
            const product = state.products.find(
              (item) =>
                item.company_id === company && item.code === line.product_code,
            );
            return {
              en: product?.name_en || line.product_code,
              fa: product?.name_fa || product?.name_en || line.product_code,
              qty: line.qty,
            };
          }),
        });
      });
  }
  const expectedReceiving: {
    id: string;
    rowId: string;
    name: string;
    total: string;
    cost: string;
    quantity: string;
    unit: { en: string; fa: string };
    currency: string;
    costUnit: string;
    category: { en: string; fa: string };
    checks: number;
  }[] = [];
  if (await page.locator(".receiving-lines table.receiving-table").count()) {
    const state = await readCanonicalBusinessEvidence(page);
    for (const [index, line] of state.invoice.lines.entries()) {
      const product = state.products.find(
        (item) =>
          item.company_id === state.invoice.company_id &&
          item.code === line.product_code,
      );
      const weighted = line.sold_by === "weight";
      const category = state.config.pricing_categories.find(
        (item) =>
          item.key === (line.pricing_category ?? product?.pricing_category),
      );
      // Public bilingual fixture captions; the selected category is always
      // resolved from the canonical invoice/config rather than the row text.
      const persianCategory: Record<string, string> = {
        grocery: "مواد غذایی",
        "grocery (taxable)": "مواد غذایی (مشمول مالیات)",
        rice: "برنج",
        kitchenware: "لوازم آشپزخانه",
      };
      const unit = weighted
        ? (line.source_quantity_unit ?? "lb")
        : line.quantity_unit === "cases"
          ? "cases"
          : "units";
      const QuantityDecimal = Decimal.clone({ precision: 80 });
      const quantity = weighted
        ? (line.source_quantity ??
          (unit === "kg"
            ? new QuantityDecimal(line.qty_invoiced).div(
                line.weight_conversion_factor ??
                  state.config.weighed_items?.conversion_factor ??
                  "2.20462",
              )
            : new QuantityDecimal(line.qty_invoiced)
          ).toString())
        : line.quantity_unit === "cases"
          ? String(line.quantity_entered ?? 0)
          : String(line.qty_invoiced);
      expectedReceiving.push({
        id: invoiceLineId(line, index),
        rowId: `invoice-line-row-${index}`,
        name: line.new_name_en || product?.name_en || line.description,
        total: new Decimal(line.line_total)
          .toFixed(4, Decimal.ROUND_HALF_UP)
          .replace(/(\.\d{2,}?)0+$/, "$1"),
        cost: new Decimal(
          line.sold_by === "weight"
            ? (line.source_cost_before_tax ?? line.unit_cost_before_tax)
            : line.unit_cost_before_tax,
        ).toFixed(4, Decimal.ROUND_HALF_UP),
        quantity,
        unit: {
          en:
            unit === "units" || unit === "cases"
              ? new Decimal(quantity).eq(1)
                ? unit.slice(0, -1)
                : unit
              : unit,
          fa: unit === "units" ? "واحد" : unit === "cases" ? "کارتن" : unit,
        },
        currency:
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: state.config.company.currency,
            currencyDisplay: "narrowSymbol",
          })
            .formatToParts(0)
            .find((part) => part.type === "currency")?.value ??
          state.config.company.currency,
        costUnit: weighted ? `/${line.source_cost_unit ?? "lb"}` : "",
        category: {
          en: category?.label ?? "Choose a category",
          fa: category
            ? (persianCategory[category.label.toLowerCase()] ?? category.label)
            : "انتخاب دسته",
        },
        // The canonical review normalizer has already filtered unsupported
        // reader fields and deduplicated aliases before retaining these checks.
        checks: line.low_confidence_fields?.length ?? 0,
      });
    }
  }
  const evidence = {
    expectedApprovals,
    expectedProducts,
    expectedReturns,
    expectedReceiving,
  };
  return page.locator("main").evaluate((main, data) => {
    const {
      expectedApprovals,
      expectedProducts,
      expectedReturns,
      expectedReceiving,
    } = data;
    let cells = 0;
    let maxError = 0;
    let cards = 0;
    let decisionCards = 0;
    let selectionHeaderCards = 0;
    let returnCards = 0;
    let receivingCards = 0;
    const failures: string[] = [];
    const tidy = (value: string | null | undefined) =>
      (value ?? "")
        .replace(/[\u2066-\u2069]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const visible = (element: Element) =>
      element.getBoundingClientRect().height > 0 &&
      getComputedStyle(element).visibility !== "hidden";
    const linkProbe = document.createElement("span");
    linkProbe.style.color = "var(--link-text)";
    linkProbe.style.display = "none";
    main.append(linkProbe);
    const linkColor = getComputedStyle(linkProbe).color;
    linkProbe.remove();
    const dashboardDecision = (row: Element, table: Element) => {
      const root = row.closest(".r2c-dashboard");
      const wrapper = table.closest(
        ".dashboard-approval-table.ui-data-table.is-mobile.is-responsive.is-phone-list",
      );
      if (
        !root ||
        !wrapper ||
        root.querySelector(
          ":scope > .dashboard-layout > .dashboard-main > .dashboard-approvals > .dashboard-approval-table > table",
        ) !== table ||
        !root.querySelector(":scope > .page-header h1") ||
        !root.querySelector(".dashboard-main > .dashboard-invoices") ||
        !root.querySelector(
          ".dashboard-aside > .price-update-dashboard-card",
        ) ||
        !root.querySelector(".dashboard-aside > .dashboard-alerts") ||
        !root.querySelector(".dashboard-aside > .dashboard-balances")
      )
        return false;
      const tiles = [
        ...root.querySelectorAll(
          ":scope > .dashboard-kpis > button.ui-summary-tile",
        ),
      ];
      const onShift = tiles.filter((tile) =>
        tile.matches(".timesheet-on-shift-tile"),
      );
      const timesheets =
        root.getAttribute("data-timesheets-module") === "on" &&
        root.getAttribute("data-timesheets-access") === "allowed";
      if (
        (timesheets
          ? tiles.length !== 6 ||
            onShift.length !== 1 ||
            !["On shift now", "اکنون در حال کار"].includes(
              tidy(onShift[0]?.querySelector(".kpi-label")?.textContent),
            )
          : tiles.length !== 5 || onShift.length !== 0) ||
        tiles.some(
          (tile) =>
            !["kpi-label", "kpi-value", "kpi-detail", "summary-tile-dot"].every(
              (part) => tile.querySelector(`:scope > .${part}`),
            ),
        )
      )
        return false;
      const expected = expectedApprovals.find(
        (item) => item.id === row.getAttribute("data-approval-id"),
      );
      if (!expected || row.children.length !== 4) return false;
      const name = row.querySelector(":scope > .phone-list-name");
      const value = row.querySelector(":scope > .phone-list-value");
      const secondary = row.querySelector(":scope > .phone-list-secondary");
      const chevron = row.querySelector(":scope > .phone-list-chevron");
      const product = name?.querySelector(
        ".dashboard-queue-product > a.entity-link",
      );
      const actions = secondary?.querySelector(".dashboard-inline-actions");
      const buttons = [...(actions?.querySelectorAll(":scope > button") ?? [])];
      const decision = buttons.filter(
        (button) => !button.matches(".ui-menu-trigger"),
      );
      const more = buttons.filter((button) =>
        button.matches('.ui-menu-trigger[aria-haspopup="menu"]'),
      );
      const fa = document.documentElement.lang.startsWith("fa");
      const expectedDecision = fa
        ? expected.action === "Approve"
          ? "تأیید"
          : "بررسی"
        : expected.action;
      return Boolean(
        row.matches(".dashboard-queue-row.phone-list-row[data-approval-id]") &&
        getComputedStyle(row).display === "grid" &&
        name &&
        value &&
        secondary &&
        chevron &&
        [name, value, secondary].every(
          (region) => visible(region) && tidy(region.textContent),
        ) &&
        product &&
        visible(product) &&
        product.getAttribute("href") ===
          `#product?code=${encodeURIComponent(expected.code)}` &&
        tidy(product.querySelector(".product-name strong")?.textContent) ===
          tidy(fa ? expected.name_fa : expected.name_en) &&
        getComputedStyle(product).color === linkColor &&
        row.querySelectorAll("a").length === 1 &&
        name.querySelectorAll(".dashboard-product-context").length === 1 &&
        value.querySelectorAll(".dashboard-approval-price").length === 1 &&
        secondary.querySelectorAll(":scope > span").length === 2 &&
        secondary.querySelectorAll(".ui-badge").length === 1 &&
        buttons.length === 2 &&
        decision.length === 1 &&
        more.length === 1 &&
        tidy(decision[0].textContent) === expectedDecision &&
        tidy(more[0].getAttribute("aria-label") || more[0].textContent) ===
          (fa ? "بیشتر" : "More") &&
        buttons.every(
          (button) =>
            visible(button) &&
            !button.hasAttribute("disabled") &&
            Math.abs(button.getBoundingClientRect().height - 44) <= 1,
        ) &&
        chevron.children.length === 0 &&
        !tidy(chevron.textContent) &&
        row.querySelectorAll(
          ".table-row-link,.table-details-toggle,[data-control-kind='disclosure']",
        ).length === 0,
      );
    };
    const edge = (element: Element, end = false) => {
      const box = element.getBoundingClientRect();
      const rtl = getComputedStyle(element).direction === "rtl";
      return end ? (rtl ? box.left : box.right) : rtl ? box.right : box.left;
    };
    const glyphEdge = (element: Element, end = false) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const box = range.getBoundingClientRect();
      const rtl = getComputedStyle(element).direction === "rtl";
      return end ? (rtl ? box.left : box.right) : rtl ? box.right : box.left;
    };
    const labelsSelectionHeader = (table: Element, headers: Element[]) => {
      const wrapper = table.closest(
        ".labels-products-card > .r2e-labels-products.is-mobile.is-responsive.is-phone-list.has-phone-selection",
      );
      return Boolean(
        wrapper &&
        main.querySelector(
          ".labels-products-card > .r2e-labels-products > table",
        ) === table &&
        headers.length >= 3 &&
        headers[0].getAttribute("data-column-key") === "selection" &&
        headers[1].getAttribute("data-column-key") === "product" &&
        headers.some(
          (header) => header.getAttribute("data-column-key") === "price",
        ) &&
        headers.slice(2).every((header) => !visible(header)) &&
        headers.slice(0, 2).every(visible) &&
        ["Product", "کالا"].includes(tidy(headers[1].textContent)) &&
        headers[0].querySelectorAll('[role="checkbox"]').length === 1 &&
        visible(headers[0].querySelector('[role="checkbox"]')!) &&
        ["Select all filtered", "انتخاب همه نتایج فیلترشده"].includes(
          headers[0]
            .querySelector('[role="checkbox"]')
            ?.getAttribute("aria-label") || "",
        ),
      );
    };
    const richReturn = (row: Element, table: Element) => {
      const wrapper = table.closest(
        ".returns-overview .returns-overview-table.is-mobile.is-responsive.is-phone-list",
      );
      const expected = expectedReturns.find(
        (item) =>
          `#return?id=${encodeURIComponent(item.id)}` ===
          row.getAttribute("data-row-href"),
      );
      const slots = [
        "return-phone-header",
        "return-phone-items",
        "return-phone-meta",
        "return-phone-next",
      ];
      if (
        !wrapper ||
        main.querySelector(
          ".returns-overview .returns-overview-table > table",
        ) !== table ||
        !expected ||
        row.children.length !== 4 ||
        !row.matches(".returns-clickable-row.phone-list-row") ||
        !slots.every(
          (slot, index) =>
            row.children[index].matches(`.${slot}`) &&
            visible(row.children[index]),
        )
      )
        return false;
      const reference = row.querySelector(
        ".return-phone-reference > a.returns-number-link",
      );
      const supplier = row.querySelector(
        ".return-phone-supplier > a.entity-link",
      );
      const names = [
        ...row.querySelectorAll(
          ".return-phone-items .return-list-item-names > span",
        ),
      ];
      const meta = row.querySelector(".return-phone-meta")!;
      const next = row.querySelector(".return-phone-next")!;
      const chevrons = [...next.querySelectorAll(".table-row-link")];
      const href = row.getAttribute("data-row-href");
      const credit = table.querySelector('thead th[data-column-key="credit"]');
      const fa = document.documentElement.lang.startsWith("fa");
      return Boolean(
        reference &&
        supplier &&
        visible(reference) &&
        visible(supplier) &&
        reference.getAttribute("href") === href &&
        supplier.getAttribute("href") === href &&
        tidy(reference.textContent) === `#${expected.number}` &&
        tidy(supplier.textContent) === tidy(expected.supplier) &&
        row
          .querySelector(".return-phone-status .ui-badge")
          ?.textContent?.trim() &&
        names.length === expected.items.length &&
        names.every((name, index) => {
          const sourceName = tidy(
            fa ? expected.items[index].fa : expected.items[index].en,
          );
          const metadata = `× ${expected.items[index].qty}${index === 1 && expected.remaining > 0 ? ` · +${expected.remaining} ${fa ? "قلم دیگر" : "more"}` : ""}`;
          const fitted = name.querySelector(".return-list-item-name[title]");
          if (!fitted)
            return tidy(name.textContent) === `${sourceName} ${metadata}`;
          const shown = tidy(fitted.textContent);
          const prefix = shown.replace(/…$/, "").trim();
          return (
            fitted.getAttribute("title") === sourceName &&
            visible(fitted) &&
            prefix.length > 0 &&
            (shown.endsWith("…")
              ? sourceName.startsWith(prefix)
              : shown === sourceName) &&
            tidy(
              name.querySelector(".return-list-item-quantity")?.textContent ??
                "",
            ) === metadata
          );
        }) &&
        row
          .querySelector(".return-phone-items .return-list-items > small")
          ?.textContent?.trim() &&
        meta.children.length === 2 &&
        meta.children[0].querySelector(".date-text")?.textContent?.trim() &&
        (credit
          ? Boolean(tidy(meta.children[1].textContent))
          : !tidy(meta.children[1].textContent)) &&
        next
          .querySelector(".actions > [data-action-fact]")
          ?.textContent?.trim() &&
        chevrons.length === 1 &&
        visible(chevrons[0]) &&
        chevrons[0].getAttribute("href") === href &&
        !row.querySelector(".table-details-toggle"),
      );
    };
    const tables = [
      ...main.querySelectorAll(".ui-data-table table, table.receiving-table"),
    ];
    for (const [tableIndex, table] of tables.entries()) {
      const headers = [...table.querySelectorAll("thead tr:first-child th")];
      const selectionHeader = labelsSelectionHeader(table, headers);
      const stacked =
        getComputedStyle(table).display !== "table" &&
        (headers.every(
          (header) => header.getBoundingClientRect().height === 0,
        ) ||
          selectionHeader);
      const labelledCard = table.closest(
        ".ui-data-table.is-mobile.is-responsive",
      );
      for (const [rowIndex, row] of [
        ...table.querySelectorAll("tbody tr"),
      ].entries()) {
        const compact = row.matches(".phone-list-row");
        const receiving = table.matches(".receiving-table");
        if (
          !compact &&
          (row.children.length !== headers.length ||
            [...row.children].some(
              (cell) => (cell as HTMLTableCellElement).colSpan > 1,
            ))
        )
          continue;
        if (stacked) {
          cards++;
          const bounds = row.getBoundingClientRect();
          if (receiving) {
            for (const region of ["status", "product", "total"]) {
              const matches = row.querySelectorAll(
                `:scope > .receiving-${region}-cell`,
              );
              const element = matches[0] as HTMLElement | undefined;
              if (
                matches.length !== 1 ||
                !element ||
                element.getBoundingClientRect().height <= 0
              )
                failures.push(
                  `table ${tableIndex}, receiving card ${rowIndex}: missing visible ${region}`,
                );
            }
            // B4's complete line card opens its genuine inline editor through
            // the row or product disclosure. Ordinary phone-list records keep
            // their separate, strictly checked record chevron below.
            const expected = expectedReceiving.find(
              (line) => line.id === row.getAttribute("data-line-id"),
            );
            const toggle = row.querySelector(
              ":scope > .receiving-product-cell > a.invoice-line-toggle",
            );
            const name = toggle?.querySelector(".receiving-product-name");
            const status = row.querySelector(
              ".receiving-status-icon[role='img'][aria-label]",
            );
            const quantity = row.querySelector(".receiving-phone-quantity");
            const cost = quantity?.querySelector(".receiving-phone-cost");
            const total = row.querySelector(".receiving-total-cell");
            const category = row.querySelector(
              ".receiving-product-meta > span:not([aria-hidden])",
            );
            const checkCount = row.querySelector(".receiving-line-check-count");
            const expanded = row.getAttribute("aria-expanded");
            const language =
              document.documentElement.lang === "fa" ? "fa" : "en";
            if (
              !table.closest(
                ".receiving-lines > .receiving-lines-table[role='region']",
              ) ||
              !row.matches(
                ".invoice-line-summary[data-control-kind='disclosure'][tabindex='0']",
              ) ||
              !expected ||
              row.id !== expected.rowId ||
              main.querySelectorAll(`[id="${CSS.escape(row.id)}"]`).length !==
                1 ||
              row.getAttribute("data-testid") !== expected.rowId ||
              !["true", "false"].includes(expanded ?? "") ||
              !toggle ||
              !visible(toggle) ||
              toggle.getAttribute("href") !== "#invoice-line-editor" ||
              toggle.getAttribute("data-control-kind") !== "disclosure" ||
              toggle.getAttribute("aria-expanded") !== expanded ||
              !name ||
              tidy(name.textContent) !== tidy(expected.name) ||
              tidy(name.getAttribute("title")) !== tidy(expected.name) ||
              !status ||
              !visible(status) ||
              !tidy(status.getAttribute("aria-label")) ||
              !category ||
              !visible(category) ||
              tidy(category.textContent) !== expected.category[language] ||
              (expected.checks > 0
                ? !checkCount ||
                  !visible(checkCount) ||
                  tidy(checkCount.textContent) !==
                    `${expected.checks} ${language === "fa" ? "برای بررسی" : "to check"}`
                : checkCount !== null) ||
              !quantity ||
              !visible(quantity) ||
              tidy(quantity.querySelector(".quantity-number")?.textContent) !==
                expected.quantity ||
              tidy(quantity.querySelector(".quantity-label")?.textContent) !==
                expected.unit[language] ||
              !cost ||
              !visible(cost) ||
              tidy(cost.textContent)
                .replaceAll(",", "")
                .replace(expected.currency, "") !==
                expected.cost + expected.costUnit ||
              !tidy(cost.textContent).includes(expected.currency) ||
              !total ||
              tidy(total.textContent)
                .replaceAll(",", "")
                .replace(expected.currency, "") !== expected.total ||
              !tidy(total.textContent).includes(expected.currency) ||
              row.querySelectorAll(".invoice-line-toggle").length !== 1 ||
              row.querySelector(".receiving-phone-chevron,.table-row-link")
            )
              failures.push(
                `table ${tableIndex}, receiving card ${rowIndex}: invalid B4 line disclosure or source values`,
              );
            else receivingCards++;
            if (total) {
              const style = getComputedStyle(row);
              const totalBox = total.getBoundingClientRect();
              const endError =
                style.direction === "rtl"
                  ? Math.abs(
                      totalBox.left -
                        bounds.left -
                        parseFloat(style.paddingLeft),
                    )
                  : Math.abs(
                      bounds.right -
                        totalBox.right -
                        parseFloat(style.paddingRight),
                    );
              maxError = Math.max(maxError, endError);
              if (endError > 2)
                failures.push(
                  `table ${tableIndex}, receiving card ${rowIndex}: line total end ${endError}px`,
                );
            }
          } else if (compact) {
            const returnCandidate = Boolean(
              table.closest(".returns-overview-table"),
            );
            const returnCard = returnCandidate && richReturn(row, table);
            if (returnCandidate && !returnCard)
              failures.push(
                `table ${tableIndex}, phone list ${rowIndex}: invalid retained Returns card`,
              );
            if (returnCard) {
              returnCards++;
              const reference = row.querySelector(".return-phone-reference")!;
              const meta = row.querySelector(".return-phone-meta")!;
              const next = row.querySelector(".return-phone-next")!;
              const chevron = next.querySelector(".table-row-link")!;
              const rtl = getComputedStyle(row).direction === "rtl";
              const style = getComputedStyle(row);
              const end = rtl
                ? bounds.left + parseFloat(style.paddingLeft)
                : bounds.right - parseFloat(style.paddingRight);
              const errors = [
                Math.abs(glyphEdge(reference) - glyphEdge(meta.children[0])),
                Math.abs(
                  glyphEdge(reference) -
                    glyphEdge(next.querySelector("[data-action-fact]")!),
                ),
                Math.abs(edge(chevron, true) - end),
              ];
              if (tidy(meta.children[1].textContent))
                errors.push(Math.abs(glyphEdge(meta.children[1], true) - end));
              maxError = Math.max(maxError, ...errors);
              if (errors.some((error) => error > 2))
                failures.push(
                  `table ${tableIndex}, Returns card ${rowIndex}: logical edges ${errors.join("/")}px`,
                );
            }
            if (selectionHeader) {
              const href = row.getAttribute("data-row-href");
              const expected = expectedProducts.find(
                (item) =>
                  href === `#product?code=${encodeURIComponent(item.code)}`,
              );
              const name = row.querySelector(
                ".phone-list-name .product-name strong",
              );
              const selection = row.querySelector(
                '.phone-list-selection [role="checkbox"]',
              );
              const fa = document.documentElement.lang.startsWith("fa");
              if (
                !expected ||
                tidy(name?.textContent) !==
                  tidy(fa ? expected.fa : expected.en) ||
                !selection ||
                !visible(selection) ||
                selection.getAttribute("aria-label") !==
                  (fa
                    ? `انتخاب کالای ${expected.code}`
                    : `Select product ${expected.code}`)
              ) {
                failures.push(
                  `table ${tableIndex}, phone list ${rowIndex}: invalid Labels product selection`,
                );
              } else {
                selectionHeaderCards++;
                const headerSelection =
                  headers[0].querySelector('[role="checkbox"]')!;
                const errors = [
                  Math.abs(edge(headerSelection) - edge(selection)),
                  Math.abs(edge(headerSelection, true) - edge(selection, true)),
                  Math.abs(
                    glyphEdge(headers[1]) -
                      edge(row.querySelector(".phone-list-name")!),
                  ),
                ];
                maxError = Math.max(maxError, ...errors);
                if (errors.some((error) => error > 2))
                  failures.push(
                    `table ${tableIndex}, Labels selection ${rowIndex}: edges ${errors.join("/")}px`,
                  );
              }
            }
            const decisionCandidate =
              row.matches(".dashboard-queue-row[data-approval-id]") &&
              Boolean(table.closest(".dashboard-approval-table"));
            const decisionCard =
              decisionCandidate && dashboardDecision(row, table);
            if (decisionCandidate && !decisionCard)
              failures.push(
                `table ${tableIndex}, phone list ${rowIndex}: invalid Dashboard approval decision card`,
              );
            if (decisionCard) decisionCards++;
            // E3 replaces repeated label/value cards with explicit list
            // regions. Keep the same containment check on every cell.
            for (const region of returnCard
              ? ["header", "items", "meta", "next"]
              : decisionCard
                ? ["name", "value", "secondary"]
                : ["name", "value", "secondary", "chevron"]) {
              const matches = row.querySelectorAll(
                `:scope > .${returnCard ? "return-phone" : "phone-list"}-${region}`,
              );
              const element = matches[0] as HTMLElement | undefined;
              if (
                matches.length !== 1 ||
                !element ||
                element.getBoundingClientRect().height <= 0 ||
                (region !== "chevron" && !element.textContent?.trim())
              )
                failures.push(
                  `table ${tableIndex}, phone list ${rowIndex}: missing visible ${region}`,
                );
            }
            if (
              !decisionCard &&
              !returnCard &&
              row.querySelectorAll(".phone-list-chevron .table-row-link")
                .length !== 1
            )
              failures.push(
                `table ${tableIndex}, phone list ${rowIndex}: expected one record chevron`,
              );
            if (row.querySelector(".table-details-toggle"))
              failures.push(
                `table ${tableIndex}, phone list ${rowIndex}: obsolete detail disclosure`,
              );
            const selected = table.closest(".has-phone-selection");
            if (
              selected &&
              row.querySelectorAll(".phone-list-selection [role='checkbox']")
                .length !== 1
            )
              failures.push(
                `table ${tableIndex}, phone list ${rowIndex}: missing selection checkbox`,
              );
          }
          const rowCells = [...row.children].filter(
            (cell) => !receiving || getComputedStyle(cell).display !== "none",
          );
          for (const [columnIndex, cell] of rowCells.entries()) {
            const rect = cell.getBoundingClientRect();
            const error = Math.max(
              0,
              bounds.left - rect.left,
              rect.right - bounds.right,
              cell.scrollWidth - cell.clientWidth,
            );
            maxError = Math.max(maxError, error);
            cells++;
            if (error > 2)
              failures.push(
                `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: containment ${error}px`,
              );
            if (compact || receiving) {
              if (
                cell.getAttribute("data-column-label") ||
                !["none", "normal"].includes(
                  getComputedStyle(cell, "::before").content,
                )
              )
                failures.push(
                  `table ${tableIndex}, phone list ${rowIndex}: obsolete field caption`,
                );
              continue;
            }
            const label = cell.getAttribute("data-column-label");
            const headerLabel = headers[columnIndex].cloneNode(
              true,
            ) as HTMLElement;
            for (const decoration of headerLabel.querySelectorAll(
              '[aria-hidden="true"]',
            ))
              decoration.remove();
            const expectedLabel = headerLabel.textContent
              ?.replace(/\s+/g, " ")
              .replace(/\s*[↑↓]$/, "")
              .trim();
            if (expectedLabel && label !== expectedLabel)
              failures.push(
                `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: label ${label}/${expectedLabel}`,
              );
            if (
              columnIndex > 0 &&
              label &&
              labelledCard &&
              getComputedStyle(cell, "::before").content !==
                JSON.stringify(label)
            )
              failures.push(
                `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: missing visible ${label} label`,
              );
            if (columnIndex > 0 && !labelledCard) {
              const captionSelector =
                "label,.invoice-line-price,.invoice-line-mobile-caption,.ui-checked-control";
              const captions = [
                ...(cell.matches(captionSelector) ? [cell] : []),
                ...cell.querySelectorAll(captionSelector),
              ];
              if (
                !captions.some(
                  (caption) => caption.getBoundingClientRect().height > 0,
                )
              )
                failures.push(
                  `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: missing visible field or price caption`,
                );
              const totalCaption = cell.querySelector(
                ".invoice-line-mobile-caption",
              );
              if (
                totalCaption &&
                totalCaption.textContent?.trim() !== expectedLabel
              )
                failures.push(
                  `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: caption ${totalCaption.textContent}/${expectedLabel}`,
                );
            }
          }
          continue;
        }
        for (const [columnIndex, header] of headers.entries()) {
          const cell = row.children[columnIndex];
          const h = header.getBoundingClientRect();
          const b = cell.getBoundingClientRect();
          const hs = getComputedStyle(header);
          const bs = getComputedStyle(cell);
          const error = Math.max(
            Math.abs(h.left - b.left),
            Math.abs(h.right - b.right),
          );
          maxError = Math.max(maxError, error);
          cells++;
          if (
            error > 2 ||
            hs.paddingInlineStart !== bs.paddingInlineStart ||
            hs.paddingInlineEnd !== bs.paddingInlineEnd ||
            hs.textAlign !== bs.textAlign
          )
            failures.push(
              `table ${tableIndex}, row ${rowIndex}, column ${columnIndex}: edges ${error}px; alignment ${hs.textAlign}/${bs.textAlign}; padding ${hs.paddingInlineStart}/${bs.paddingInlineStart}`,
            );
        }
      }
    }
    return {
      tables: tables.length,
      cells,
      cards,
      decisionCards,
      selectionHeaderCards,
      returnCards,
      receivingCards,
      maxError,
      failures,
    };
  }, evidence);
}
