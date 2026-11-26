import type { Page } from "@playwright/test";

export type R2fScene =
  "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9" | "D10";

/** Explicit semantic exceptions, never a page/class-wide bypass of the audit. */
export const r2fAlignmentExceptions = [
  {
    id: "D2-linked-login-icon",
    scene: "D2",
    kind: "composite-column-value",
    selector:
      ".timesheet-manage-staff .timesheet-managed-person[data-staff-id] > .timesheet-staff-login:has(> svg[aria-hidden='true'])",
    reason:
      "The approved linked app login includes its leading user icon and 6px gap. Compare the complete icon/login value edge with the plain No app login and heading edges; the Name/Department columns retain actual glyph probes.",
  },
  {
    id: "D1-independent-departments",
    scene: "D1",
    kind: "independent-controls",
    selector: ".timesheets-page .timesheet-department[data-department-key]",
    reason:
      "The approved masonry departments have independent rows/heights; controls in two distinct departments are not peers. Controls within one department remain strict.",
  },
  {
    id: "D7-independent-columns",
    scene: "D7",
    kind: "independent-dashboard-columns",
    selector:
      ".r2c-dashboard .dashboard-layout > .dashboard-main > .card, .r2c-dashboard .dashboard-layout > .dashboard-aside > .card",
    reason:
      "Main and aside dashboard stacks have independent record rows. Only cross-stack controls are separate; each real card and paired-card header remains audited.",
  },
  {
    id: "D7-approval-type-decoration",
    scene: "D7",
    kind: "composite-column-value",
    selector:
      ".r2c-dashboard .dashboard-approval-table td[data-column-key='type'] > .ui-badge",
    reason:
      "The approved Dashboard Type value is a contextual chip. Compare its complete visible value edge; all numeric/text captions retain actual glyph probes.",
  },
  {
    id: "D7-decision-control-group",
    scene: "D7",
    kind: "composite-control-column",
    selector:
      ".r2c-dashboard .dashboard-approval-table td[data-column-key='actions'] > .dashboard-inline-actions",
    reason:
      "The approved decision column has a blank heading and uniformly sized controls with centred Approve/Review captions. Compare the real control-group edge; peer button centres/heights and all money/text columns remain strict.",
  },
  {
    id: "D7-status-dot",
    scene: "D7",
    kind: "composite-column-value",
    selector:
      ".r2c-dashboard .dashboard-invoices td[data-column-key='status'] .ui-badge:has(> .ui-status-dot)",
    reason:
      "The existing genuine invoice status includes its semantic leading dot. Compare the complete dot-and-label value, not only the text after that dot.",
  },
  {
    id: "D8-status-dot",
    scene: "D8",
    kind: "composite-column-value",
    selector:
      ".returns-overview-table td[data-column-key='status'] .ui-badge:has(> .ui-status-dot)",
    reason:
      "The approved Returns status retains the canonical status dot. Its complete visible value starts at the heading edge; money and item text use actual glyph probes.",
  },
  {
    id: "D7-activity-avatar",
    scene: "D7",
    kind: "centred-decorative-column",
    selector:
      ".r2c-dashboard .dashboard-activity-item > .initials-avatar[aria-hidden='true']",
    reason:
      "Activity initials are a decorative icon in a fixed 32px column. Audit actual avatar-container centres instead of comparing differently wide initials; main copy and end time retain glyph probes.",
  },
  {
    id: "D9-line-status-number",
    scene: "D9",
    kind: "composite-column-value",
    selector:
      ".receiving-table > tbody > .invoice-line-summary > .receiving-status-cell > .receiving-status-number",
    reason:
      "The approved # column labels the complete leading status-icon and row-number value. Compare that complete composite edge; Quantity, Unit cost and Line total retain actual glyph probes.",
  },
  {
    id: "D10-inline-note-action",
    scene: "D10",
    kind: "compact-text-control",
    selector: ".request-draft-line .request-line-note-action",
    reason:
      "The approved Add note/Edit action is a 24px inline action beneath the item name, separate from the 44px Quantity/Unit/bin row.",
  },
  {
    id: "D10-inline-pack-action",
    scene: "D10",
    kind: "compact-text-control",
    selector:
      ".request-draft-line .request-line-meta .request-line-pack-action",
    reason:
      "A 24px metadata disclosure preserves the existing required/optional case-pack editor without adding a permanently expanded field to the approved 44px Quantity/Unit/bin row.",
  },
] as const;

export interface R2fAlignmentOptions {
  scene: R2fScene;
  /** Omit to use the documented exceptions for this scene; [] proves none apply. */
  exceptionIds?: readonly string[];
  portals?: readonly ("timesheet-now" | "request-results")[];
}

/**
 * Port of the approved source/align.js: same visible peer-pair/48px/half-overlap
 * scan and table/grid column groups, with logical RTL edges, actual glyph ranges,
 * centred editable-column probes and explicit, reported semantic exceptions.
 */
export async function auditR2fAlignment(
  page: Page,
  options: R2fAlignmentOptions,
) {
  const registered = r2fAlignmentExceptions.filter(
    (entry) => entry.scene === options.scene,
  );
  const exceptions =
    options.exceptionIds === undefined
      ? registered
      : registered.filter((entry) => options.exceptionIds!.includes(entry.id));
  for (const id of options.exceptionIds ?? [])
    if (!registered.some((entry) => entry.id === id))
      throw new Error(
        `Unregistered ${options.scene} alignment exception: ${id}`,
      );
  return page.evaluate(
    ({ options, exceptions }) => {
      const failures: string[] = [];
      const used = new Map<string, number>();
      const allow = (entry: (typeof exceptions)[number]) =>
        used.set(entry.id, (used.get(entry.id) ?? 0) + 1);
      const visible = (element: Element) => {
        if (
          typeof element.checkVisibility === "function" &&
          !element.checkVisibility({
            contentVisibilityAuto: true,
            visibilityProperty: true,
          })
        )
          return false;
        const closed = element.closest("details:not([open])");
        if (
          closed &&
          !closed.querySelector(":scope > summary")?.contains(element)
        )
          return false;
        const rect = element.getBoundingClientRect(),
          css = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          css.visibility !== "hidden" &&
          css.display !== "none"
        );
      };
      const name = (element: Element) =>
        `${element.tagName.toLowerCase()}.${typeof element.className === "string" ? element.className.split(" ").slice(0, 2).join(".") : ""} "${(element.getAttribute("aria-label") || element.textContent || (element as HTMLInputElement).value || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
      const primary =
        [...document.querySelectorAll("dialog[open]")].at(-1) ??
        document.querySelector("main");
      if (!primary)
        return {
          failures: ["No rendered main or open dialog to audit"],
          controls: 0,
          pairs: 0,
          separateOverlayPairs: 0,
          columns: 0,
          cells: 0,
          numberGroups: 0,
          numberAssociations: 0,
          icons: 0,
          cardHeaders: 0,
          cardPairs: 0,
          plainValues: 0,
          allowed: [],
        };
      const scopes: Element[] = [primary];
      for (const portal of options.portals ?? []) {
        const selector =
          portal === "timesheet-now" && options.scene === "D1"
            ? ".timesheet-now-popover[role='listbox']"
            : portal === "request-results" && options.scene === "D10"
              ? ".request-search-results[data-r2f-scene='D10']"
              : null;
        if (!selector) {
          failures.push(`Portal ${portal} does not belong to ${options.scene}`);
          continue;
        }
        const root = document.querySelector(selector);
        if (!root || !visible(root))
          failures.push(`Expected visible portal: ${portal}`);
        else if (
          !["absolute", "fixed"].includes(getComputedStyle(root).position)
        )
          failures.push(`Expected an actual overlay plane: ${portal}`);
        else if (!scopes.includes(root)) scopes.push(root);
      }
      const all = (selector: string) => [
        ...new Set(
          scopes.flatMap((scope) => [
            ...scope.querySelectorAll<HTMLElement>(selector),
          ]),
        ),
      ];
      const controls = all(
        "button,input:not([type=checkbox]),.ui-select,.ui-segments,.filter-search-pill,.ui-date,a.ui-button",
      )
        .filter(visible)
        .filter(
          (element) =>
            !element.closest(".ui-segments") || element.matches(".ui-segments"),
        )
        .filter(
          (element) =>
            !element.closest(".filter-search-pill") ||
            element.matches(".filter-search-pill"),
        )
        .filter((element) => !element.closest(".lookup-search-pill"));
      let pairs = 0,
        separateOverlayPairs = 0;
      // A scrolled control can have a raw rectangle behind a fixed footer.
      // Classify peers by their painted intersection, then retain the original
      // full-control centre and height measurements for genuine visible peers.
      const paintedRect = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        let left = Math.max(0, rect.left),
          right = Math.min(innerWidth, rect.right),
          top = Math.max(0, rect.top),
          bottom = Math.min(innerHeight, rect.bottom);
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const css = getComputedStyle(ancestor);
          const clipX = /^(auto|scroll|hidden|clip)$/.test(css.overflowX);
          const clipY = /^(auto|scroll|hidden|clip)$/.test(css.overflowY);
          if (!clipX && !clipY) continue;
          const bounds = ancestor.getBoundingClientRect();
          if (clipX) {
            const start = bounds.left + ancestor.clientLeft;
            left = Math.max(left, start);
            right = Math.min(right, start + ancestor.clientWidth);
          }
          if (clipY) {
            const start = bounds.top + ancestor.clientTop;
            top = Math.max(top, start);
            bottom = Math.min(bottom, start + ancestor.clientHeight);
          }
        }
        return right > left && bottom > top
          ? { left, right, top, bottom }
          : null;
      };
      const rects = controls.map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
        painted: paintedRect(element),
        plane:
          [...scopes].reverse().find((scope) => scope.contains(element)) ??
          primary,
      }));
      const independent = (a: Element, b: Element) => {
        for (const entry of exceptions) {
          if (
            entry.kind !== "independent-controls" &&
            entry.kind !== "independent-dashboard-columns"
          )
            continue;
          const x = a.closest(entry.selector),
            y = b.closest(entry.selector);
          if (!x || !y || x === y) continue;
          const xr = x.getBoundingClientRect(),
            yr = y.getBoundingClientRect();
          // Separate DOM wrappers alone cannot excuse a real same-column or
          // phone overlap. These must be distinct horizontal visual columns.
          if (Math.min(xr.right, yr.right) - Math.max(xr.left, yr.left) > 1.5)
            continue;
          if (entry.kind === "independent-dashboard-columns") {
            const layout = x.closest(".dashboard-layout");
            const style = layout && getComputedStyle(layout);
            if (
              !style ||
              style.display !== "grid" ||
              style.gridTemplateColumns.trim().split(/\s+/).length < 2
            )
              continue;
            if (
              x.closest(".dashboard-main,.dashboard-aside") ===
              y.closest(".dashboard-main,.dashboard-aside")
            )
              continue;
          }
          allow(entry);
          return true;
        }
        return false;
      };
      const compact = (element: Element) =>
        exceptions.find(
          (entry) =>
            entry.kind === "compact-text-control" &&
            element.matches(entry.selector),
        );
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          if (a.element.contains(b.element) || b.element.contains(a.element))
            continue;
          if (!a.painted || !b.painted) continue;
          const overlap =
            Math.min(a.painted.bottom, b.painted.bottom) -
            Math.max(a.painted.top, b.painted.top);
          if (overlap < Math.min(a.rect.height, b.rect.height) * 0.5) continue;
          const gap =
            Math.max(a.painted.left, b.painted.left) -
            Math.min(a.painted.right, b.painted.right);
          if (gap > 48 || gap < -2) continue;
          // source/align.js audits one main/dialog render root. Registered
          // portals add their own audit plane, not peers behind that overlay.
          if (a.plane !== b.plane) {
            separateOverlayPairs++;
            continue;
          }
          if (independent(a.element, b.element)) continue;
          if (a.rect.height < 28 || b.rect.height < 28) {
            const tiny = [a, b].filter((item) => item.rect.height < 28);
            for (const item of tiny) {
              const entry = compact(item.element);
              if (entry) allow(entry);
              else if (
                item.element.querySelector("svg") &&
                !item.element.textContent?.trim()
              ) {
                /* Original align.js ignores tiny icon controls. */
              } else
                failures.push(
                  `Unregistered compact control: ${name(item.element)}`,
                );
            }
            continue;
          }
          pairs++;
          const centre = Math.abs(
              (a.rect.top + a.rect.bottom - b.rect.top - b.rect.bottom) / 2,
            ),
            height = Math.abs(a.rect.height - b.rect.height);
          if (centre > 1.5 || height > 2)
            failures.push(
              `row: ${name(a.element)} vs ${name(b.element)} centre Δ${centre.toFixed(2)} height ${a.rect.height.toFixed(2)}/${b.rect.height.toFixed(2)}`,
            );
        }
      type Box = { left: number; right: number; top: number; bottom: number };
      const textRect = (element: Element): Box | null => {
        const rects: DOMRect[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (
            !node.textContent?.trim() ||
            !node.parentElement ||
            !visible(node.parentElement) ||
            node.parentElement.closest(
              "svg,[aria-hidden='true'],.sr-only,.visually-hidden",
            )
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          rects.push(
            ...[...range.getClientRects()].filter(
              (rect) => rect.width > 0 && rect.height > 0,
            ),
          );
        }
        return rects.length
          ? {
              left: Math.min(...rects.map((rect) => rect.left)),
              right: Math.max(...rects.map((rect) => rect.right)),
              top: Math.min(...rects.map((rect) => rect.top)),
              bottom: Math.max(...rects.map((rect) => rect.bottom)),
            }
          : null;
      };
      const logicalAlignment = (
        element: Element,
      ): "left" | "right" | "center" => {
        const css = getComputedStyle(element),
          rtl = css.direction === "rtl";
        if (
          css.textAlign === "center" ||
          css.justifySelf === "center" ||
          css.justifyItems === "center"
        )
          return "center";
        if (css.textAlign === "right") return "right";
        if (css.textAlign === "left") return "left";
        if (css.textAlign === "end" || /^(end|flex-end)$/.test(css.justifySelf))
          return rtl ? "left" : "right";
        return rtl ? "right" : "left";
      };
      const probe = (cell: HTMLElement) => {
        for (const entry of exceptions) {
          if (
            entry.kind === "centred-decorative-column" &&
            cell.matches(entry.selector) &&
            visible(cell)
          ) {
            allow(entry);
            return {
              element: cell,
              box: cell.getBoundingClientRect(),
              align: "center" as const,
            };
          }
          if (
            entry.kind !== "composite-column-value" &&
            entry.kind !== "composite-control-column"
          )
            continue;
          const composite = cell.matches(entry.selector)
            ? cell
            : cell.querySelector<HTMLElement>(entry.selector);
          if (composite && visible(composite)) {
            allow(entry);
            return {
              element: cell,
              box: composite.getBoundingClientRect(),
              align: logicalAlignment(cell),
            };
          }
        }
        const box = textRect(cell);
        if (box) return { element: cell, box, align: logicalAlignment(cell) };
        const field = cell.matches("input,.ui-select,.ui-date")
          ? cell
          : cell.querySelector<HTMLElement>(
              "input:not([type=hidden]),.ui-select,.ui-date",
            );
        return field && visible(field)
          ? {
              element: cell,
              box: field.getBoundingClientRect(),
              align: logicalAlignment(field),
            }
          : null;
      };
      const groups: { name: string; rows: HTMLElement[][] }[] = [];
      for (const table of all("table")) {
        const rows = [
          ...table.querySelectorAll<HTMLTableRowElement>("tr"),
        ].filter(
          (row) =>
            row.closest("table") === table &&
            visible(row) &&
            !row.matches(".table-expanded-row"),
        );
        groups.push({
          name: name(table),
          rows: rows.map((row) => [...row.children] as HTMLElement[]),
        });
      }
      const parents = new Set<Element>();
      for (const element of all("*")) {
        const css = getComputedStyle(element);
        if (
          css.display === "grid" &&
          css.gridTemplateColumns.split(" ").length >= 3 &&
          element.parentElement
        )
          parents.add(element.parentElement);
      }
      for (const parent of parents) {
        const rows = [...parent.children].filter(
          (child) =>
            visible(child) &&
            getComputedStyle(child).display === "grid" &&
            getComputedStyle(child).gridTemplateColumns.split(" ").length >= 3,
        );
        if (rows.length >= 2)
          groups.push({
            name: name(parent),
            rows: rows.map((row) => [...row.children] as HTMLElement[]),
          });
      }
      let columns = 0,
        cells = 0;
      for (const group of groups) {
        const count = Math.max(...group.rows.map((row) => row.length));
        for (let index = 0; index < count; index++) {
          const probes = group.rows
            .map((row) => row[index])
            .filter(
              (cell): cell is HTMLElement =>
                Boolean(cell) &&
                visible(cell) &&
                !cell.matches("[colspan]:not([colspan='1'])"),
            )
            .map(probe)
            .filter((value): value is NonNullable<typeof value> =>
              Boolean(value),
            );
          if (probes.length < 2) continue;
          const alignments = probes.map((item) => item.align);
          const align = ["left", "right", "center"].sort(
            (a, b) =>
              alignments.filter((value) => value === b).length -
              alignments.filter((value) => value === a).length,
          )[0];
          const edges = probes.map((item) =>
            align === "center"
              ? (item.box.left + item.box.right) / 2
              : align === "right"
                ? item.box.right
                : item.box.left,
          );
          const spread = Math.max(...edges) - Math.min(...edges);
          columns++;
          cells += probes.length;
          if (spread > 1.5)
            failures.push(
              `col ${group.name}[${index}] ${align} edge spread ${spread.toFixed(2)}px: ${probes.map((item, i) => `${name(item.element)}@${edges[i].toFixed(2)}`).join(" | ")}`,
            );
        }
      }
      let numberGroups = 0,
        numberAssociations = 0,
        icons = 0;
      for (const group of all(".ui-number-group")) {
        const values = [
          ...group.querySelectorAll<HTMLElement>("[data-number-baseline]"),
        ].filter(visible);
        if (values.length < 2) continue;
        const slotEdge = (
          element: HTMLElement,
          alignment: "left" | "right" | "center",
        ) => {
          const rect = element.getBoundingClientRect();
          return alignment === "left"
            ? rect.left
            : alignment === "right"
              ? rect.right
              : (rect.left + rect.right) / 2;
        };
        for (const stat of group.querySelectorAll<HTMLElement>(
          ":scope > .ui-number-stat",
        )) {
          const label = stat.querySelector<HTMLElement>(
            ":scope > .ui-number-label",
          );
          const value = stat.querySelector<HTMLElement>(
            ":scope > .ui-number-value",
          );
          const note = stat.querySelector<HTMLElement>(
            ":scope > .ui-number-note",
          );
          if (!label || !value || !visible(label) || !visible(value)) continue;
          const alignment = logicalAlignment(value);
          numberAssociations++;
          if (
            Math.abs(slotEdge(label, alignment) - slotEdge(value, alignment)) >
            1.5
          )
            failures.push(`number label/value slot: ${name(stat)}`);
          if (
            note &&
            visible(note) &&
            note.textContent?.trim() &&
            getComputedStyle(note).gridRowStart !==
              getComputedStyle(value).gridRowStart
          ) {
            numberAssociations++;
            if (
              Math.abs(slotEdge(note, alignment) - slotEdge(value, alignment)) >
              1.5
            )
              failures.push(`number value/note slot: ${name(stat)}`);
          }
        }
        const baselines = values.map((value) => {
          const marker = document.createElement("span");
          marker.setAttribute("aria-hidden", "true");
          Object.assign(marker.style, {
            display: "inline-block",
            inlineSize: "0",
            blockSize: "0",
            padding: "0",
            margin: "0",
            border: "0",
            verticalAlign: "baseline",
          });
          value.append(marker);
          const y = marker.getBoundingClientRect().top;
          marker.remove();
          return { y, row: getComputedStyle(value).gridRowStart };
        });
        numberGroups++;
        // Compare declared grid tracks, never cluster by observed Y: moving a
        // value must fail rather than accidentally earn a new-row exemption.
        const rows = new Map<string, number[]>();
        for (const item of baselines)
          rows.set(item.row, [...(rows.get(item.row) ?? []), item.y]);
        for (const row of rows.values())
          if (Math.max(...row) - Math.min(...row) > 1.5)
            failures.push(
              `number baseline: ${name(group)} ${row.map((y) => y.toFixed(2)).join("/")}`,
            );
      }
      for (const row of all(".ui-icon-text")) {
        const icon = row.querySelector<HTMLElement>("[data-icon-text-icon]"),
          copy = row.querySelector<HTMLElement>("[data-icon-text-copy]");
        if (!icon || !copy || !visible(icon) || !visible(copy)) continue;
        const a = icon.getBoundingClientRect(),
          b = copy.getBoundingClientRect();
        icons++;
        const difference = Math.abs((a.top + a.bottom - b.top - b.bottom) / 2);
        if (difference > 1.5)
          failures.push(
            `icon/text centre: ${name(row)} Δ${difference.toFixed(2)}`,
          );
      }
      let cardHeaders = 0,
        cardPairs = 0,
        plainValues = 0;
      for (const header of all(".ui-card-header").filter(visible)) {
        cardHeaders++;
        if (header.getBoundingClientRect().height < 43.5)
          failures.push(`card header below 44px: ${name(header)}`);
      }
      for (const row of all(".ui-card-row")) {
        const cards = [...row.children].filter(
          (child) => child.matches(".card") && visible(child),
        );
        for (let i = 0; i < cards.length; i++)
          for (let j = i + 1; j < cards.length; j++) {
            const a = cards[i].getBoundingClientRect(),
              b = cards[j].getBoundingClientRect();
            if (Math.abs(a.top - b.top) > 1.5) continue;
            cardPairs++;
            if (Math.abs(a.height - b.height) > 1.5)
              failures.push(
                `paired card heights: ${name(cards[i])}/${name(cards[j])} Δ${Math.abs(a.height - b.height).toFixed(2)}`,
              );
            const ah = cards[i].querySelector(".ui-card-header h2"),
              bh = cards[j].querySelector(".ui-card-header h2");
            const at = ah && textRect(ah),
              bt = bh && textRect(bh);
            if (at && bt && Math.abs(at.top - bt.top) > 1.5)
              failures.push(
                `paired card title lines: ${name(cards[i])}/${name(cards[j])} Δ${Math.abs(at.top - bt.top).toFixed(2)}`,
              );
          }
      }
      for (const value of all(".ui-column-value").filter(visible)) {
        plainValues++;
        const css = getComputedStyle(value);
        if (
          parseFloat(css.paddingInlineStart) > 0.1 ||
          parseFloat(css.paddingInlineEnd) > 0.1 ||
          !["rgba(0, 0, 0, 0)", "transparent"].includes(css.backgroundColor)
        )
          failures.push(`column value is a padded pill: ${name(value)}`);
      }
      return {
        failures: [...new Set(failures)],
        controls: controls.length,
        pairs,
        separateOverlayPairs,
        columns,
        cells,
        numberGroups,
        numberAssociations,
        icons,
        cardHeaders,
        cardPairs,
        plainValues,
        allowed: exceptions
          .filter((entry) => used.has(entry.id))
          .map((entry) => ({
            id: entry.id,
            reason: entry.reason,
            count: used.get(entry.id)!,
          })),
      };
    },
    { options, exceptions },
  );
}
