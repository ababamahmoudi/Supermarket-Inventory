import type { Page } from "@playwright/test";
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

  return page.locator("main").evaluate((main, expectedApprovals) => {
    let cells = 0;
    let maxError = 0;
    let cards = 0;
    let decisionCards = 0;
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
    const tables = [
      ...main.querySelectorAll(".ui-data-table table, table.receiving-table"),
    ];
    for (const [tableIndex, table] of tables.entries()) {
      const headers = [...table.querySelectorAll("thead tr:first-child th")];
      const stacked =
        getComputedStyle(table).display !== "table" &&
        headers.every((header) => header.getBoundingClientRect().height === 0);
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
            if (row.querySelectorAll(".receiving-phone-chevron").length !== 1)
              failures.push(
                `table ${tableIndex}, receiving card ${rowIndex}: expected one record chevron`,
              );
          } else if (compact) {
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
            for (const region of decisionCard
              ? ["name", "value", "secondary"]
              : ["name", "value", "secondary", "chevron"]) {
              const matches = row.querySelectorAll(
                `:scope > .phone-list-${region}`,
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
      maxError,
      failures,
    };
  }, expectedApprovals);
}
