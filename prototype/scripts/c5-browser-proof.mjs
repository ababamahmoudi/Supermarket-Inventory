/* global document, window, getComputedStyle, NodeFilter, requestAnimationFrame */
import { expect } from "@playwright/test";

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const exact = (en, fa = en) =>
  new RegExp(`^(?:${escape(en)}|${escape(fa)})$`);
export const button = (scope, en, fa) =>
  scope.getByRole("button", { name: exact(en, fa) });
export const field = (scope, en, fa) => scope.getByLabel(exact(en, fa));

export async function shellAction(page, en, fa) {
  const control = button(page, en, fa);
  if (await control.isVisible()) return control;
  const item = page.getByRole("menuitem", { name: exact(en, fa) });
  if (!(await item.isVisible()))
    await page.locator(".mobile-more-menu").click();
  await expect(item).toBeVisible();
  return item;
}

export async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

export async function appearance(page, variant) {
  const language = variant === "fa-light" ? "fa" : "en";
  const theme = variant === "en-dark" ? "dark" : "light";
  if ((await page.locator("html").getAttribute("lang")) !== language)
    await (
      await shellAction(page, "Switch to Persian", "تغییر به انگلیسی")
    ).click();
  if ((await page.locator("html").getAttribute("data-theme")) !== theme)
    await (
      await shellAction(
        page,
        theme === "dark" ? "Switch to dark theme" : "Switch to light theme",
        theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
      )
    ).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await settled(page);
}

export async function choose(page, control, name) {
  await control.click();
  await page
    .getByRole("option", { name, exact: typeof name === "string" })
    .click();
}

export async function today(page, scope = page) {
  await field(scope, "Date", "تاریخ").click();
  await button(page.locator(".ui-calendar"), "Today", "امروز").click();
}

/** Measures every visible real control, including semantic widget exceptions. */
export async function inspect(page, screen, variant, role = "supervisor") {
  await settled(page);
  return page.evaluate(
    ({ screen, variant, role }) => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          element.getClientRects().length &&
          rect.width > 2 &&
          rect.height > 2 &&
          style.visibility !== "hidden" &&
          style.clipPath === "none" &&
          // aria-hidden removes decorative dots/icons from the accessibility
          // tree; it does not hide their rendered pixels. Measure CSS visibility.
          !element.closest("[hidden]")
        );
      };
      const tidy = (value) =>
        (value ?? "")
          .replace(/[\u2066-\u2069]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const round = (value) => Math.round(value * 100) / 100;
      const textContrastOf = (element) => {
        const parse = (color) => {
          const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
          return [channels[0], channels[1], channels[2], channels[3] ?? 1];
        };
        const blend = (foreground, background) =>
          foreground
            .slice(0, 3)
            .map(
              (channel, index) =>
                channel * foreground[3] +
                background[index] * (1 - foreground[3]),
            )
            .concat(1);
        const ancestors = [];
        for (let current = element; current; current = current.parentElement)
          ancestors.unshift(parse(getComputedStyle(current).backgroundColor));
        const background = ancestors.reduce(
          (surface, color) => blend(color, surface),
          [255, 255, 255, 1],
        );
        const foreground = blend(
          parse(getComputedStyle(element).color),
          background,
        );
        const luminance = (color) =>
          color
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
        const light = luminance(foreground);
        const dark = luminance(background);
        return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
      };
      const failures = [];
      const buttons = [];
      const widgetRoles = [
        "tab",
        "switch",
        "radio",
        "checkbox",
        "combobox",
        "option",
        "menuitem",
        "menuitemcheckbox",
        "menuitemradio",
      ];
      const semanticSelectors = [
        ".ui-calendar-day",
        ".ui-calendar-header",
        ".nav-section",
        ".lookup-result",
        ".invoice-line-toggle",
        ".product-picker-result",
        ".kpi-card",
        ".ui-kpi",
        ".label-preview-slot",
        ".supplier-filter-chip",
        ".supplier-sort",
        ".ui-segments",
        ".ui-select-option",
        ".ui-menu-content",
        ".notebook-tabs",
      ].join(",");
      const kindOf = (element) => {
        // Category choices are actual pressed-state chips; their menu trigger
        // belongs to the same pill group. Keep them measured, with their own
        // fully-round shape rule, rather than treating them as ordinary actions.
        if (
          element.matches(
            '.filter-chip[aria-pressed], .lookup-category-more.ui-menu-trigger[aria-haspopup="menu"]',
          )
        )
          return "choice";
        const kind = element.getAttribute("data-control-kind");
        if (kind && kind !== "action") return kind;
        const controlRole = element.getAttribute("role");
        if (widgetRoles.includes(controlRole)) return controlRole;
        if (
          element.matches(
            ".ui-icon-button, .icon-button, .language-toggle, .lookup-scan-button",
          )
        )
          return "icon";
        if (element.matches(".ui-date, .ui-date-trigger, .date-picker-trigger"))
          return "date";
        if (element.querySelector(".user-chip")) return "account";
        if (element.matches('tr[role="button"]')) return "entity-row";
        if (kind === "action")
          return element.closest(".topbar") ? "topbar" : "action";
        if (
          element.matches(
            '.invoice-details-toggle[aria-expanded][aria-controls="invoice-details-fields"]',
          )
        )
          return "disclosure";
        if (element.closest(semanticSelectors)) return "widget";
        if (element.closest(".topbar")) return "topbar";
        return "action";
      };
      for (const element of document.querySelectorAll(
        'button, a.ui-button, [role="button"]',
      )) {
        if (!visible(element)) continue;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const label = tidy(
          element.getAttribute("aria-label") || element.textContent,
        );
        const kind = kindOf(element);
        const choiceTextContrast =
          kind === "choice" ? textContrastOf(element) : null;
        const variantClass = [
          "primary",
          "secondary",
          "tinted",
          "neutral",
          "danger",
          "destructive",
          "quiet",
          "plain",
        ].find((value) => element.classList.contains(`button-${value}`));
        const nearestRow = element.closest("tbody tr");
        const dialog = element.closest("dialog");
        const row =
          nearestRow && (!dialog || !nearestRow.contains(dialog))
            ? nearestRow
            : null;
        let textWidth = 0;
        const textWalker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
        );
        let textNode;
        while ((textNode = textWalker.nextNode())) {
          if (
            !tidy(textNode.textContent) ||
            !textNode.parentElement ||
            !visible(textNode.parentElement) ||
            textNode.parentElement.closest(".sr-only, .visually-hidden")
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          for (const bounds of range.getClientRects())
            textWidth += bounds.width;
        }
        const icons = [...element.querySelectorAll("svg, img")]
          .filter((icon) => {
            const bounds = icon.getBoundingClientRect();
            return (
              bounds.width > 2 &&
              bounds.height > 2 &&
              getComputedStyle(icon).visibility !== "hidden"
            );
          })
          .reduce((sum, icon) => sum + icon.getBoundingClientRect().width, 0);
        let flexItems = 0;
        let anonymousText = "";
        const finishTextRun = () => {
          if (tidy(anonymousText)) flexItems += 1;
          anonymousText = "";
        };
        for (const node of element.childNodes) {
          if (node.nodeType === 3) {
            anonymousText += node.textContent;
            continue;
          }
          if (node.nodeType !== 1) continue;
          finishTextRun();
          const bounds = node.getBoundingClientRect();
          const childStyle = getComputedStyle(node);
          if (
            bounds.width > 2 &&
            bounds.height > 2 &&
            childStyle.visibility !== "hidden" &&
            !["absolute", "fixed"].includes(childStyle.position)
          )
            flexItems += 1;
        }
        finishTextRun();
        const gaps = style.display.includes("flex")
          ? Math.max(0, flexItems - 1) * (parseFloat(style.columnGap) || 0)
          : 0;
        const intrinsicWidth =
          textWidth +
          icons +
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth) +
          gaps;
        const entry = {
          screen,
          variant,
          role,
          label,
          kind,
          style: variantClass ?? kind,
          radius: style.borderTopLeftRadius,
          radii: [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius,
          ],
          height: round(rect.height),
          width: round(rect.width),
          textWidth: round(textWidth),
          intrinsicWidth: round(intrinsicWidth),
          inTable: Boolean(row),
          disabled: Boolean(element.disabled),
          border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
          glow: style.boxShadow,
          className: element.className,
          ...(kind === "choice"
            ? { textContrast: round(choiceTextContrast) }
            : {}),
        };
        buttons.push(entry);
        if (kind === "action" || kind === "choice") {
          const phone = document.documentElement.clientWidth < 760;
          const small =
            element.classList.contains("button-sm") ||
            element.closest(".table-actions, .catalog-row-actions");
          const expectedRadius = small ? "10px" : "12px";
          // C8 requires field-aligned Add controls to be 44px at every width.
          const fieldAlignedAdd = element.matches(
            ".date-quick-actions > button[type='submit'], .product-editor-date-add > button",
          );
          const expectedHeight = element.closest(".c9-filter-toolbar")
            ? element.closest(".ui-segments")
              ? 32
              : 40
            : phone || fieldAlignedAdd
              ? 44
              : small
                ? 32
                : 40;
          if (kind === "choice") {
            const requiredRadius = Math.min(rect.width, rect.height) / 2;
            const fullyRound = entry.radii.every((radius) => {
              const parts = radius.split(/\s+/);
              return parts.every((part, index) => {
                const value = parseFloat(part);
                const pixels = part.endsWith("%")
                  ? (value / 100) * (index === 0 ? rect.width : rect.height)
                  : value;
                return (
                  Number.isFinite(pixels) && pixels >= requiredRadius - 0.5
                );
              });
            });
            if (!fullyRound)
              failures.push(
                `Choice pill radius: ${label} (${entry.radii.join("/")})`,
              );
            if (
              !Number.isFinite(choiceTextContrast) ||
              choiceTextContrast < 4.5
            )
              failures.push(
                `Choice text contrast: ${label} (${round(choiceTextContrast)}:1)`,
              );
          } else if (entry.radii.some((radius) => radius !== expectedRadius))
            failures.push(
              `Text action radius: ${label} (${entry.radii.join("/")})`,
            );
          if (Math.abs(rect.height - expectedHeight) > 1)
            failures.push(
              `Text action height: ${label} (${round(rect.height)}px)`,
            );
          if (!variantClass) failures.push(`Unstyled text action: ${label}`);
          if (
            kind === "action" &&
            element.closest(".card, .ui-card, dialog") &&
            parseFloat(style.borderTopWidth) > 0.5 &&
            style.borderTopStyle !== "none"
          )
            failures.push(`Card/dialog text action resting border: ${label}`);
          if (style.boxShadow !== "none" && !element.matches(":focus-visible"))
            failures.push(`Text action resting shadow: ${label}`);
          if (row && rect.width > 200.5)
            failures.push(
              `Table action wider than 200px: ${label} (${round(rect.width)}px)`,
            );
          if (rect.width > Math.max(40, intrinsicWidth) + 5)
            failures.push(
              `${row ? "Table action" : "Text action"} stretched: ${label} (${round(rect.width)} > ${round(intrinsicWidth)})`,
            );
        }
      }
      for (const row of document.querySelectorAll("tbody tr")) {
        const rowNavigation = [...row.querySelectorAll(".table-row-link")]
          .filter(visible)
          .filter((element) => element.closest("tbody tr") === row);
        const rowDisclosure = [...row.querySelectorAll(".table-details-toggle")]
          .filter(visible)
          .filter((element) => element.closest("tbody tr") === row);
        if (rowNavigation.length > 1)
          failures.push("Duplicate row navigation chevron");
        if (rowDisclosure.length > 1)
          failures.push("Duplicate hidden-column disclosure");
        if (row.matches("tr.phone-list-row")) {
          // E3 compact rows place the muted secondary line last in the DOM;
          // CSS grid keeps their single navigation chevron at the visual end.
          const cells = [...row.querySelectorAll(":scope > td")].filter(
            visible,
          );
          const chevronCells = cells.filter((cell) =>
            cell.matches(".phone-list-chevron"),
          );
          if (
            getComputedStyle(row).display !== "grid" ||
            chevronCells.length !== 1 ||
            rowNavigation.length !== 1 ||
            rowDisclosure.length !== 0
          )
            failures.push("Compact phone row needs one navigation chevron");
          const control = rowNavigation[0];
          const chevronCell = chevronCells[0];
          if (control && chevronCell) {
            const style = getComputedStyle(row);
            const bounds = row.getBoundingClientRect();
            const rect = control.getBoundingClientRect();
            const rtl = style.direction === "rtl";
            const end = rtl
              ? bounds.left +
                parseFloat(style.borderLeftWidth || "0") +
                parseFloat(style.paddingLeft || "0")
              : bounds.right -
                parseFloat(style.borderRightWidth || "0") -
                parseFloat(style.paddingRight || "0");
            if (
              control.closest("td") !== chevronCell ||
              control.querySelectorAll("svg").length !== 1 ||
              Math.abs((rtl ? rect.left : rect.right) - end) > 2 ||
              rect.top < bounds.top - 1 ||
              rect.bottom > bounds.bottom + 1 ||
              cells.some((cell) => {
                if (cell === chevronCell) return false;
                const other = cell.getBoundingClientRect();
                return rtl
                  ? other.left < rect.right - 1
                  : other.right > rect.left + 1;
              })
            )
              failures.push(
                "Compact phone navigation is not at the visual row end",
              );
          }
        } else {
          for (const control of [...rowNavigation, ...rowDisclosure]) {
            if (control.closest("td") !== row.lastElementChild)
              failures.push("Row navigation/disclosure is not at the row end");
          }
        }
        for (const disclosure of rowDisclosure) {
          if (!disclosure.getAttribute("aria-controls"))
            failures.push("Hidden-column disclosure has no details target");
          if (disclosure.getAttribute("aria-expanded") === "true") {
            const detail = document.getElementById(
              disclosure.getAttribute("aria-controls"),
            );
            if (!detail?.querySelector("dl > div > dd"))
              failures.push(
                "Expanded disclosure does not retain omitted values",
              );
          }
        }
        for (const cell of row.querySelectorAll("td")) {
          const controls = [...cell.querySelectorAll("button, a.ui-button")]
            .filter(visible)
            .filter((element) => {
              const dialog = element.closest("dialog");
              return (
                element.closest("td") === cell &&
                (!dialog || !row.contains(dialog)) &&
                element.closest("tbody tr") === row
              );
            })
            // The C8 details chevron reveals omitted cells; it is not a
            // business action. Audit that navigation separately below.
            .filter((element) => !element.matches(".table-details-toggle"))
            // R1 acknowledgments belong beside their field in the expanded
            // invoice form, rather than at the row end. The independent
            // action/control/style/size audits above still measure them.
            .filter((element) => !element.closest(".reading-check-actions"))
            .filter((element) => ["action", "icon"].includes(kindOf(element)));
          if (controls.length > 2)
            failures.push(
              `More than two row actions: ${tidy(cell.textContent)}`,
            );
          if (
            cell.querySelector(
              ".table-actions, .catalog-row-actions, .supplier-item-actions",
            ) &&
            (controls.filter((element) => kindOf(element) === "action").length >
              1 ||
              (controls.length === 2 &&
                !controls.some((element) =>
                  element.matches('.ui-menu-trigger[aria-haspopup="menu"]'),
                )))
          )
            failures.push(
              `Row end actions exceed one small button plus More: ${tidy(cell.textContent)}`,
            );
          if (controls.length === 2) {
            const [first, second] = controls.map((element) =>
              element.getBoundingClientRect(),
            );
            if (
              Math.abs(
                first.top + first.height / 2 - second.top - second.height / 2,
              ) > 1
            )
              failures.push(`Stacked row actions: ${tidy(cell.textContent)}`);
            if (
              Math.min(first.right, second.right) -
                Math.max(first.left, second.left) >
              1
            )
              failures.push(
                `Overlapping row actions: ${tidy(cell.textContent)}`,
              );
          }
        }
      }
      const toolbarGroups = [];
      for (const wrapper of document.querySelectorAll(".filter-count")) {
        if (!visible(wrapper)) continue;
        const columns = [...wrapper.querySelectorAll("button")].find(
          (element) =>
            visible(element) &&
            /^(Columns|ستون‌ها)$/.test(tidy(element.textContent)),
        );
        if (!columns) continue;
        const group = columns.closest(
          ".filter-toolbar-end, .returns-toolbar-end, .date-filter-result-actions",
        );
        const count = group?.querySelector(":scope > span");
        if (!group || !count) {
          failures.push("Columns and result count have no shared end group");
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(count);
        const text = range.getBoundingClientRect();
        const countBox = count.getBoundingClientRect();
        const control = columns.getBoundingClientRect();
        const direction = getComputedStyle(group).direction;
        const gap =
          direction === "rtl"
            ? text.left - control.right
            : control.left - text.right;
        const centerDifference = Math.abs(
          countBox.top + countBox.height / 2 - control.top - control.height / 2,
        );
        toolbarGroups.push({
          count: tidy(count.textContent),
          columns: tidy(columns.textContent),
          direction,
          gap: round(gap),
          centerDifference: round(centerDifference),
          countBounds: {
            left: round(text.left),
            right: round(text.right),
            top: round(text.top),
            height: round(text.height),
          },
          controlBounds: {
            left: round(control.left),
            right: round(control.right),
            top: round(control.top),
            height: round(control.height),
          },
        });
        if (gap < -0.5 || gap > 16.5 || centerDifference > 1)
          failures.push(
            `Columns separated from result count: ${tidy(count.textContent)} (${round(gap)}px gap; ${round(centerDifference)}px center difference)`,
          );
      }
      const topbar = [];
      const header = document.querySelector(".topbar");
      if (header) {
        for (const element of header.querySelectorAll(
          "button, .topbar-search, .branch-pill.static",
        )) {
          if (
            !visible(element) ||
            element.closest('[role="menu"], [role="listbox"]')
          )
            continue;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const label = tidy(
            element.getAttribute("aria-label") ||
              element.textContent ||
              "Search",
          );
          topbar.push({
            label,
            height: round(rect.height),
            radius: style.borderRadius,
            borderWidth: style.borderTopWidth,
            borderColor: style.borderTopColor,
            borderStyle: style.borderTopStyle,
            glow: style.boxShadow,
          });
          if (Math.abs(rect.height - 36) > 1)
            failures.push(`Topbar height: ${label} (${round(rect.height)}px)`);
          if (
            parseFloat(style.borderTopWidth) > 0.5 &&
            style.borderTopStyle !== "none"
          )
            failures.push(`Topbar resting border: ${label}`);
          if (style.boxShadow !== "none" && !element.matches(":focus-visible"))
            failures.push(`Topbar resting shadow: ${label}`);
        }
      }
      const statuses = [...document.querySelectorAll(".ui-badge, .badge")]
        .filter(visible)
        .map((element) => {
          const style = getComputedStyle(element);
          const tableStatus = Boolean(
            element.closest(".ui-data-table:not(.is-mobile)"),
          );
          const sharedStatus =
            element.classList.contains("ui-badge") &&
            !element.classList.contains("offer-pill");
          const presentation = sharedStatus && tableStatus ? "dot" : "pill";
          if (sharedStatus) {
            const dot = element.querySelector(".ui-status-dot");
            if (presentation === "dot") {
              if (!dot || !visible(dot))
                failures.push(
                  `Desktop table status has no visible dot: ${tidy(element.textContent)}`,
                );
              if (style.backgroundColor !== "rgba(0, 0, 0, 0)")
                failures.push(
                  `Desktop table status retains a pill fill: ${tidy(element.textContent)}`,
                );
            } else if (dot && visible(dot)) {
              failures.push(
                `Card status retains a table dot: ${tidy(element.textContent)}`,
              );
            }
          }
          return {
            label: tidy(element.textContent),
            color: style.color,
            background: style.backgroundColor,
            classes: element.className,
            returnStatus: element.getAttribute("data-return-status"),
            outcome: element.getAttribute("data-return-outcome"),
            presentation,
          };
        });
      for (const [label, values] of Object.entries(
        Object.groupBy(
          statuses,
          (status) => `${status.label}/${status.presentation}`,
        ),
      ))
        if (
          new Set(
            values.map((status) => `${status.color}/${status.background}`),
          ).size > 1
        )
          failures.push(
            `Inconsistent status color within presentation: ${label}`,
          );
      for (const control of document.querySelectorAll(
        'select,input[type="file"],input[type="checkbox"],input[type="radio"],input[type="date"]',
      ))
        if (visible(control))
          failures.push(
            `Visible native control: ${control.tagName}/${control.getAttribute("type")}`,
          );
      const clientWidth = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > clientWidth + 2)
        failures.push("Document horizontal overflow");
      const area =
        document.querySelector("dialog[open]") ??
        document.querySelector("#main-content");
      if (clientWidth > 760 && area) {
        for (const panel of [
          area,
          ...area.querySelectorAll(
            ".card, .ui-data-table, table, .filter-toolbar",
          ),
        ]) {
          if (!visible(panel)) continue;
          const scrollable = panel.matches(
            ".ui-data-table.is-scrollable:not(.is-phone-list)",
          );
          if (scrollable) {
            const bounds = panel.getBoundingClientRect();
            const parent = panel.parentElement.getBoundingClientRect();
            if (
              !/^(auto|scroll)$/.test(getComputedStyle(panel).overflowX) ||
              panel.tabIndex < 0 ||
              bounds.left < parent.left - 2 ||
              bounds.right > parent.right + 2
            )
              failures.push(
                "Scrollable table is not contained and keyboard accessible",
              );
          }
          if (panel.scrollWidth > panel.clientWidth + 2 && !scrollable)
            failures.push(
              `Desktop panel overflow: ${panel.className || panel.tagName}`,
            );
        }
        for (const cell of area.querySelectorAll("th, td")) {
          if (!visible(cell)) continue;
          const bounds = cell.getBoundingClientRect();
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (
              !tidy(node.textContent) ||
              !parent ||
              !visible(parent) ||
              parent.closest(".sr-only, .visually-hidden")
            )
              continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects())
              if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
                failures.push(`Clipped table text: ${tidy(node.textContent)}`);
          }
        }
      }
      return {
        screen,
        variant,
        role,
        route: window.location.hash,
        viewport: {
          width: clientWidth,
          height: document.documentElement.clientHeight,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          visualWidth: window.visualViewport?.width ?? null,
        },
        buttons,
        toolbarGroups,
        topbar,
        statuses,
        failures,
      };
    },
    { screen, variant, role },
  );
}

/** Contrast is measured against the actual rendered field and adjacent surface. */
export async function fieldContrast(page, scope = "dialog[open]") {
  return page.locator(scope).evaluate((container) => {
    const parse = (color) => {
      const parts = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const blend = (top, bottom) =>
      top
        .slice(0, 3)
        .map(
          (channel, index) => channel * top[3] + bottom[index] * (1 - top[3]),
        )
        .concat(1);
    const surface = (element) => {
      const ancestors = [];
      for (let current = element; current; current = current.parentElement)
        ancestors.unshift(parse(getComputedStyle(current).backgroundColor));
      return ancestors.reduce(
        (background, color) => blend(color, background),
        [255, 255, 255, 1],
      );
    };
    const luminance = (color) =>
      color
        .slice(0, 3)
        .map((channel) => channel / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (total, value, index) =>
            total + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const contrast = (a, b) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    return [
      ...container.querySelectorAll(
        'input, textarea, button[role="combobox"], .ui-date, .ui-date-trigger',
      ),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.getClientRects().length &&
          style.clipPath === "none" &&
          style.visibility !== "hidden"
        );
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const background = surface(element);
        const adjacent = surface(element.parentElement);
        const border = blend(parse(style.borderTopColor), background);
        return {
          label:
            element.getAttribute("aria-label") ||
            element.id ||
            element.className,
          border: style.borderTopColor,
          borderWidth: style.borderTopWidth,
          textContrast: contrast(parse(style.color), background),
          focused: element === document.activeElement,
          interiorContrast: contrast(border, background),
          adjacentContrast: contrast(border, adjacent),
          glow: style.boxShadow,
        };
      });
  });
}
