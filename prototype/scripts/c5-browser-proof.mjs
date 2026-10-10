/* global document, window, getComputedStyle, NodeFilter, requestAnimationFrame */
import { expect } from "@playwright/test";

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const exact = (en, fa = en) =>
  new RegExp(`^(?:${escape(en)}|${escape(fa)})$`);
export const button = (scope, en, fa) =>
  scope.getByRole("button", { name: exact(en, fa) });
export const field = (scope, en, fa) => scope.getByLabel(exact(en, fa));

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
    await button(page, "Switch to Persian", "تغییر به انگلیسی").click();
  if ((await page.locator("html").getAttribute("data-theme")) !== theme)
    await button(
      page,
      theme === "dark" ? "Switch to dark theme" : "Switch to light theme",
      theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
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
          !element.closest("[hidden], [aria-hidden=true]")
        );
      };
      const tidy = (value) =>
        (value ?? "")
          .replace(/[\u2066-\u2069]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const round = (value) => Math.round(value * 100) / 100;
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
        const variantClass = ["primary", "secondary", "danger", "quiet"].find(
          (value) => element.classList.contains(`button-${value}`),
        );
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
        const icons = [...element.querySelectorAll("svg")]
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
        };
        buttons.push(entry);
        if (kind === "action") {
          if (entry.radii.some((radius) => radius !== "12px"))
            failures.push(
              `Text action radius: ${label} (${entry.radii.join("/")})`,
            );
          if (Math.abs(rect.height - 40) > 1)
            failures.push(
              `Text action height: ${label} (${round(rect.height)}px)`,
            );
          if (!variantClass) failures.push(`Unstyled text action: ${label}`);
          if (
            variantClass === "quiet" &&
            !/^Clear filters$|^Back to\b|^پاک کردن فیلترها$|^بازگشت به/.test(
              label,
            )
          )
            failures.push(`Quiet ordinary action: ${label}`);
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
            .filter((element) => ["action", "icon"].includes(kindOf(element)));
          if (controls.length > 2)
            failures.push(
              `More than two row actions: ${tidy(cell.textContent)}`,
            );
          if (controls.length === 2) {
            const [first, second] = controls.map((element) =>
              element.getBoundingClientRect(),
            );
            if (Math.abs(first.top - second.top) > 1)
              failures.push(`Stacked row actions: ${tidy(cell.textContent)}`);
          }
        }
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
          if (Math.abs(rect.height - 40) > 1)
            failures.push(`Topbar height: ${label} (${round(rect.height)}px)`);
          if (
            parseFloat(style.borderTopWidth) < 0.5 ||
            style.borderTopStyle === "none"
          )
            failures.push(`Topbar missing border: ${label}`);
          if (style.boxShadow === "none")
            failures.push(`Topbar missing glow: ${label}`);
        }
      }
      const statuses = [...document.querySelectorAll(".ui-badge, .badge")]
        .filter(visible)
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            label: tidy(element.textContent),
            color: style.color,
            background: style.backgroundColor,
            classes: element.className,
            returnStatus: element.getAttribute("data-return-status"),
            outcome: element.getAttribute("data-return-outcome"),
          };
        });
      for (const [label, values] of Object.entries(
        Object.groupBy(statuses, (status) => status.label),
      ))
        if (
          new Set(
            values.map((status) => `${status.color}/${status.background}`),
          ).size > 1
        )
          failures.push(`Inconsistent status color: ${label}`);
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
          if (panel.scrollWidth > panel.clientWidth + 2)
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
          interiorContrast: contrast(border, background),
          adjacentContrast: contrast(border, adjacent),
          glow: style.boxShadow,
        };
      });
  });
}
