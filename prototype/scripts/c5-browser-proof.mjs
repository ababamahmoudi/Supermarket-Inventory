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
      const canonicalColor = (value) => {
        const context = document.createElement("canvas").getContext("2d");
        if (!context) return value;
        context.fillStyle = value;
        return context.fillStyle;
      };
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
      const invoiceSourceTiles = new Set();
      const notificationHeaderActions = new Set();
      const kindOf = (element) => {
        if (invoiceSourceTiles.has(element)) return "source-tile";
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
        // A compact field-label action remains an action. Its declared shared
        // structure is validated below before granting its 32px size contract.
        if (kind === "label-action") return "action";
        if (kind && kind !== "action") return kind;
        // Inbox header controls remain ordinary actions even though menu keyboard
        // navigation gives them menuitem semantics. The exact composition below
        // alone grants their 44px desktop contract.
        if (
          element.matches(".personal-notifications-actions > .ui-button.button")
        )
          return "action";
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
      // The approved receiving sheets use explicit grid actions on phones.
      // Measure those exact slots instead of treating a full-width action as
      // an accidentally stretched ordinary button.
      const phoneReceivingWidths = new Map();
      const phone = document.documentElement.clientWidth < 760;
      const contentBounds = (element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const left =
          bounds.left +
          parseFloat(style.paddingLeft || "0") +
          parseFloat(style.borderLeftWidth || "0");
        const right =
          bounds.right -
          parseFloat(style.paddingRight || "0") -
          parseFloat(style.borderRightWidth || "0");
        return { left, right, width: right - left };
      };
      // Only the complete four-source invoice dialog earns a tile contract.
      // A copied class elsewhere remains an ordinary, measured action.
      for (const dialog of document.querySelectorAll(
        "dialog.invoice-entry-choice-dialog",
      )) {
        if (!visible(dialog)) continue;
        const fa = document.documentElement.lang.startsWith("fa");
        const choices = fa
          ? [
              ["عکس (خوانش هوش مصنوعی)", "عکس", "camera"],
              ["PDF (خوانش هوش مصنوعی)", "PDF", "file-text"],
              ["ورود دستی", "ورود دستی", "pen-line"],
              ["فایل JSON", "فایل JSON", "file-json"],
            ]
          : [
              ["Photo (AI reading)", "Photo", "camera"],
              ["PDF (AI reading)", "PDF", "file-text"],
              ["Manual entry", "Manual entry", "pen-line"],
              ["JSON file", "JSON file", "file-json"],
            ];
        const grid = dialog.querySelector(
          ":scope > .ui-dialog-body > .invoice-entry-choice-grid",
        );
        const controls = [...(grid?.children ?? [])];
        const footer = [
          ...dialog.querySelectorAll(":scope > .ui-dialog-footer > button"),
        ];
        const valid =
          dialog.matches("dialog[open].ui-dialog.ui-dialog-structured") &&
          tidy(dialog.querySelector(".ui-dialog-header h2")?.textContent) ===
            (fa ? "فاکتور جدید" : "New invoice") &&
          dialog.querySelector(".ui-dialog-header .ui-dialog-icon svg") &&
          tidy(
            dialog.querySelector(".ui-dialog-header .dialog-description")
              ?.textContent,
          ) ===
            (fa
              ? "روش افزودن فاکتور را انتخاب کنید."
              : "Choose how to add the invoice.") &&
          controls.length === 4 &&
          controls.every((tile, index) => {
            const [label, title, icon] = choices[index];
            return (
              tile.matches(
                "button.ui-button.button.button-neutral.invoice-entry-choice-tile",
              ) &&
              visible(tile) &&
              tile.children.length === 3 &&
              [...tile.children].every(visible) &&
              tile.querySelector(
                `:scope > svg.lucide-${icon}[aria-hidden='true']`,
              ) &&
              tidy(tile.getAttribute("aria-label")) === label &&
              tidy(tile.querySelector(":scope > strong")?.textContent) ===
                title &&
              Boolean(tidy(tile.querySelector(":scope > span")?.textContent))
            );
          }) &&
          footer.length === 1 &&
          footer[0].classList.contains("button-neutral") &&
          tidy(footer[0].textContent) === (fa ? "انصراف" : "Cancel");
        if (!valid) {
          failures.push(
            "Invoice source tiles need the exact four-choice dialog composition",
          );
          continue;
        }
        const gridStyle = getComputedStyle(grid);
        const columns = phone ? 1 : 2;
        const gap = parseFloat(gridStyle.columnGap);
        const bounds = contentBounds(grid);
        const requiredWidth = (bounds.width - gap * (columns - 1)) / columns;
        if (
          gridStyle.display !== "grid" ||
          gridStyle.gridTemplateColumns.split(/\s+/).length !== columns ||
          Math.abs(gap - 12) > 0.5 ||
          Math.abs(parseFloat(gridStyle.rowGap) - 12) > 0.5
        )
          failures.push(
            "Invoice source tiles need their equal two-column or phone one-column grid",
          );
        const textHeight = (element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const tops = [];
          for (const rect of range.getClientRects())
            if (
              rect.width > 0 &&
              !tops.some((top) => Math.abs(top - rect.top) < 1)
            )
              tops.push(rect.top);
          return tops.length * parseFloat(getComputedStyle(element).lineHeight);
        };
        const minimum = phone ? 104 : 116;
        const requiredHeight = Math.max(
          minimum,
          ...controls.map((tile) => {
            const style = getComputedStyle(tile);
            return (
              textHeight(tile.querySelector(":scope > strong")) +
              textHeight(tile.querySelector(":scope > span")) +
              parseFloat(style.rowGap) +
              parseFloat(style.paddingTop) +
              parseFloat(style.paddingBottom) +
              parseFloat(style.borderTopWidth) +
              parseFloat(style.borderBottomWidth)
            );
          }),
        );
        for (const [index, tile] of controls.entries()) {
          invoiceSourceTiles.add(tile);
          const style = getComputedStyle(tile);
          const rect = tile.getBoundingClientRect();
          const label = tidy(tile.getAttribute("aria-label"));
          if (
            Math.abs(rect.width - requiredWidth) > 1 ||
            Math.abs(
              rect.left -
                (bounds.left +
                  (gridStyle.direction === "rtl"
                    ? columns - 1 - (index % columns)
                    : index % columns) *
                    (requiredWidth + gap)),
            ) > 1 ||
            Math.abs(
              rect.top -
                (grid.getBoundingClientRect().top +
                  Math.floor(index / columns) *
                    (requiredHeight + parseFloat(gridStyle.rowGap))),
            ) > 2 ||
            rect.left < bounds.left - 1 ||
            rect.right > bounds.right + 1 ||
            tile.scrollWidth > tile.clientWidth + 1
          )
            failures.push(`Invoice source tile width or containment: ${label}`);
          if (
            Math.abs(parseFloat(style.minHeight) - minimum) > 1 ||
            Math.abs(rect.height - requiredHeight) > 2 ||
            tile.scrollHeight > tile.clientHeight + 1
          )
            failures.push(`Invoice source tile height: ${label}`);
          if (
            [
              style.borderTopLeftRadius,
              style.borderTopRightRadius,
              style.borderBottomRightRadius,
              style.borderBottomLeftRadius,
            ].some((radius) => radius !== "12px")
          )
            failures.push(`Invoice source tile radius: ${label}`);
          if (
            ["Top", "Right", "Bottom", "Left"].some(
              (side) =>
                Math.abs(parseFloat(style[`border${side}Width`]) - 1) > 0.01 ||
                style[`border${side}Style`] !== "solid",
            )
          )
            failures.push(`Invoice source tile border: ${label}`);
          for (const text of tile.querySelectorAll(
            ":scope > strong, :scope > span",
          )) {
            const contrast = textContrastOf(text);
            if (!Number.isFinite(contrast) || contrast < 4.5)
              failures.push(`Invoice source tile text contrast: ${label}`);
          }
          if (style.boxShadow !== "none" && !tile.matches(":focus-visible"))
            failures.push(`Invoice source tile resting shadow: ${label}`);
        }
      }
      const checkPhoneActionGrid = (
        group,
        controls,
        count,
        label,
        container,
      ) => {
        const style = getComputedStyle(group);
        const bounds = contentBounds(group);
        const containerBounds = contentBounds(container);
        const gap = parseFloat(style.columnGap || "0") || 0;
        const requiredWidth = (bounds.width - gap * (count - 1)) / count;
        if (
          style.display !== "grid" ||
          controls.length !== count ||
          Math.abs(bounds.left - containerBounds.left) > 1 ||
          Math.abs(bounds.right - containerBounds.right) > 1
        )
          failures.push(`Receiving phone action grid: ${label}`);
        const measured = controls
          .map((control) => ({
            control,
            bounds: control.getBoundingClientRect(),
          }))
          .sort((a, b) => a.bounds.left - b.bounds.left);
        for (const [index, { control, bounds: rect }] of measured.entries()) {
          phoneReceivingWidths.set(control, requiredWidth);
          if (
            Math.abs(rect.width - requiredWidth) > 1 ||
            Math.abs(
              rect.left - (bounds.left + index * (requiredWidth + gap)),
            ) > 1 ||
            Math.abs(rect.top - measured[0].bounds.top) > 1
          )
            failures.push(
              `Receiving phone action does not fill its grid slot: ${tidy(control.textContent)}`,
            );
        }
      };
      for (const form of document.querySelectorAll(
        ".receiving-editor-row > td > .receiving-line-editor",
      )) {
        if (!visible(form)) continue;
        const footer = form.querySelector(":scope > .receiving-line-footer");
        if (!footer || !visible(footer)) {
          failures.push("Receiving editor footer needs its exact action set");
          continue;
        }
        const secondary = footer.querySelector(
          ":scope > .receiving-line-secondary-actions",
        );
        const confirmation = footer.querySelector(
          ":scope > .receiving-line-confirm-actions",
        );
        const controls = [
          ...footer.querySelectorAll(":scope > .actions > button"),
        ].filter(visible);
        if (
          !secondary ||
          !confirmation ||
          controls.length !== (phone ? 3 : 4) ||
          controls.filter((control) =>
            control.matches(".receiving-line-confirm"),
          ).length !== 1 ||
          controls.filter((control) =>
            control.matches(".receiving-line-remove"),
          ).length !== 1 ||
          controls.filter((control) => control.matches(".receiving-line-close"))
            .length !== (phone ? 0 : 1)
        )
          failures.push("Receiving editor footer needs its exact action set");
        if (phone && secondary && confirmation) {
          checkPhoneActionGrid(
            secondary,
            [...secondary.querySelectorAll(":scope > button")].filter(visible),
            2,
            "line secondary actions",
            footer,
          );
          checkPhoneActionGrid(
            confirmation,
            [...confirmation.querySelectorAll(":scope > button")].filter(
              visible,
            ),
            1,
            "Confirm line",
            footer,
          );
        }
      }
      if (phone)
        for (const review of document.querySelectorAll(".receiving-review")) {
          if (!visible(review)) continue;
          if (review.matches(".posted-receiving")) {
            const header = review.querySelector(":scope > .receiving-header");
            const composition =
              review.dataset.invoiceStatus === "posted" &&
              Boolean(review.dataset.invoiceId) &&
              ["true", "false"].includes(review.dataset.canCorrect) &&
              ["true", "false"].includes(review.dataset.canMove) &&
              header?.querySelector("h1") &&
              header.querySelector(".badge.approved") &&
              review.querySelector(".receiving-work .posted-invoice-lines") &&
              review.querySelector(".receiving-work .posted-invoice-totals") &&
              review.querySelector(
                ":scope > .receiving-layout > .original-viewer",
              );
            if (composition) {
              const controls = [
                ...header.querySelectorAll("[data-posted-action]"),
              ].filter(visible);
              const required = [
                "done",
                ...(review.dataset.canCorrect === "true" ? ["correct"] : []),
                ...(review.dataset.canMove === "true" ? ["move"] : []),
              ];
              if (
                controls.length !== required.length ||
                required.some(
                  (action) =>
                    controls.filter(
                      (control) => control.dataset.postedAction === action,
                    ).length !== 1,
                )
              )
                failures.push(
                  "Posted receiving header must show exactly its authorized actions",
                );
              const headerBounds = header.getBoundingClientRect();
              const bounds = controls.map((control) =>
                control.getBoundingClientRect(),
              );
              if (
                bounds.some(
                  (rect) =>
                    rect.left < headerBounds.left - 2 ||
                    rect.right > headerBounds.right + 2 ||
                    rect.top < headerBounds.top - 2 ||
                    rect.bottom > headerBounds.bottom + 2,
                )
              )
                failures.push(
                  "Posted receiving header actions must stay inside the header",
                );
              if (
                bounds.some(
                  (rect) =>
                    Math.abs(rect.height - 44) > 1 ||
                    Math.abs(rect.top - bounds[0].top) > 2,
                ) ||
                controls.some(
                  (control) =>
                    !control.classList.contains(
                      control.dataset.postedAction === "done"
                        ? "button-primary"
                        : "button-secondary",
                    ),
                )
              )
                failures.push(
                  "Posted receiving header actions must use the shared 44px row and variants",
                );
              for (let index = 0; index < bounds.length; index++)
                for (const next of bounds.slice(index + 1))
                  if (
                    Math.min(bounds[index].right, next.right) -
                      Math.max(bounds[index].left, next.left) >
                      1 &&
                    Math.min(bounds[index].bottom, next.bottom) -
                      Math.max(bounds[index].top, next.top) >
                      1
                  )
                    failures.push(
                      "Posted receiving header actions must not overlap",
                    );
              continue;
            }
            failures.push(
              "Posted receiving composition and state must be complete",
            );
          }
          const group = review.querySelector(
            ":scope > .receiving-progress > .receiving-progress-actions",
          );
          if (!group || !visible(group)) {
            failures.push("Receiving phone action grid: receiving progress");
            continue;
          }
          const controls = [
            ...group.querySelectorAll(
              ":scope > .ui-button.button, :scope > .receiving-post-control > .ui-button.button",
            ),
          ].filter(visible);
          checkPhoneActionGrid(group, controls, 2, "receiving progress", group);
        }
      // R2c's approved dashboard explicitly uses 44px actions and two
      // full-width calls to action. Require the complete composition first.
      const dashboardRoots = new Set(
        [...document.querySelectorAll(".r2c-dashboard")].filter((root) => {
          const tiles = [
            ...root.querySelectorAll(
              ":scope > .dashboard-kpis > button.ui-summary-tile",
            ),
          ];
          const onShift = tiles.filter((tile) =>
            tile.classList.contains("timesheet-on-shift-tile"),
          );
          const timesheets =
            root.dataset.timesheetsModule === "on" &&
            root.dataset.timesheetsAccess === "allowed";
          const validTileCount = timesheets
            ? tiles.length === 6 &&
              onShift.length === 1 &&
              ["On shift now", "اکنون در حال کار"].includes(
                onShift[0]
                  .querySelector(":scope > .kpi-label")
                  ?.textContent?.trim() ?? "",
              )
            : tiles.length === 5 && onShift.length === 0;
          return (
            validTileCount &&
            tiles.every(
              (tile) =>
                tile.querySelector(":scope > .kpi-label") &&
                tile.querySelector(":scope > .kpi-value") &&
                tile.querySelector(":scope > .kpi-detail") &&
                tile.querySelector(":scope > .summary-tile-dot"),
            ) &&
            root.querySelector(":scope > .page-header h1") &&
            (root.querySelector(
              ":scope > .dashboard-layout > .dashboard-main > .dashboard-approvals .dashboard-approval-table",
            ) ||
              root.querySelector(
                ":scope > .dashboard-layout > .dashboard-main > .dashboard-approvals .dashboard-empty",
              )) &&
            root.querySelector(
              ":scope > .dashboard-layout > .dashboard-main > .dashboard-invoices",
            ) &&
            root.querySelector(
              ":scope > .dashboard-layout > .dashboard-aside > .price-update-dashboard-card",
            ) &&
            root.querySelector(
              ":scope > .dashboard-layout > .dashboard-aside > .dashboard-alerts",
            ) &&
            root.querySelector(
              ":scope > .dashboard-layout > .dashboard-aside > .dashboard-balances",
            )
          );
        }),
      );
      const dashboardWideActions = new Set();
      for (const root of dashboardRoots)
        for (const control of root.querySelectorAll(
          ".price-update-dashboard-card > button.dashboard-open-tasks, :scope > .page-header > .actions > button",
        )) {
          if (
            !visible(control) ||
            (!phone && !control.matches(".dashboard-open-tasks"))
          )
            continue;
          const container = control.matches(".dashboard-open-tasks")
            ? control.parentElement
            : control.closest(".actions");
          const expected = contentBounds(container).width;
          if (Math.abs(control.getBoundingClientRect().width - expected) > 2)
            failures.push(
              "Dashboard primary action must fill its approved slot",
            );
          else dashboardWideActions.add(control);
        }
      // R2c grants 44px only to an actual opted-in screen/dialog composition.
      // A copied class or a missing page section never weakens the legacy contract.
      const r2cRoots = new Set();
      for (const root of document.querySelectorAll(".r2c-screen")) {
        const module = root.getAttribute("data-r2c-screen");
        const route = window.location.hash.split("?")[0];
        const directPage =
          root.parentElement?.matches("main#main-content") &&
          root.querySelector(":scope > .page-header");
        const supplierList =
          root.querySelector(
            ":scope > .suppliers-overview .suppliers-toolbar",
          ) &&
          root.querySelector(":scope > .suppliers-overview .suppliers-table");
        const supplierDetail =
          root.querySelectorAll(
            ":scope > .supplier-contact-card .supplier-contact-grid > div",
          ).length === 7 &&
          root.querySelectorAll(":scope > .supplier-kpis > .ui-summary-tile")
            .length === 4 &&
          root.querySelector(":scope > .supplier-tabs .ui-segments");
        const payableList =
          root.querySelector(":scope > .payables-overview .payables-filters") &&
          root.querySelector(
            ":scope > .payables-overview .payables-overview-table",
          );
        const payableStatement =
          root.querySelector(":scope > .payables-toolbar") &&
          root.querySelector(":scope > .payables-report") &&
          root.querySelector(":scope > .payables-back");
        const payableUnavailable =
          root.querySelector(":scope > .payables-back") &&
          root.querySelector(":scope > .ui-empty-state") &&
          !root.querySelector(".money,.payables-toolbar,.payables-overview");
        const supplierEditor =
          root.matches("dialog.supplier-editor-dialog[open]") &&
          root.querySelector(":scope > .ui-dialog-header h2") &&
          root.querySelector("form.manual-entry-form #supplier-name") &&
          root.querySelectorAll(
            "form.manual-entry-form input,form.manual-entry-form textarea",
          ).length >= 7;
        const offerPage =
          root.querySelector(":scope > .ui-segments") &&
          (root.querySelector(
            ":scope > .ui-card .current-offers-table.has-record-details",
          ) ||
            root.querySelector(":scope > .r2c-offer-pools"));
        const offerEditor =
          root.matches("dialog.r2c-offer-create[open]") &&
          root.querySelector(":scope > .ui-dialog-header h2") &&
          root.querySelector(
            ":scope > .ui-dialog-header .dialog-description",
          ) &&
          root.querySelector(
            ":scope > .ui-dialog-body > form.r2c-offer-form .r2c-offer-kind-grid",
          ) &&
          root.querySelector(
            ":scope > .ui-dialog-body > form.r2c-offer-form .r2c-offer-fields",
          ) &&
          root.querySelectorAll(":scope > .ui-dialog-footer > button")
            .length === 2;
        const valid =
          offerEditor ||
          supplierEditor ||
          (directPage &&
            ((module === "offers" && route === "#offers" && offerPage) ||
              (module === "suppliers" &&
                route === "#suppliers" &&
                (supplierList || supplierDetail)) ||
              (module === "payables" &&
                route === "#payables" &&
                (payableList || payableStatement || payableUnavailable))));
        if (valid) r2cRoots.add(root);
        else
          failures.push(
            `Invalid R2c screen composition: ${module ?? "unknown"}`,
          );
      }
      const r2cOrdinaryButton = (element) =>
        element.matches(
          'button:not(.ui-icon-button):not(.table-details-toggle):not(.ui-summary-tile):not(.ui-kpi):not([data-control-kind="disclosure"]):not([data-control-kind="label-action"])',
        );
      for (const element of document.querySelectorAll(
        '.r2c-screen input:not([type="file"]):not([type="checkbox"]):not([type="radio"]),.r2c-screen select',
      )) {
        if (
          visible(element) &&
          r2cRoots.has(element.closest(".r2c-screen")) &&
          Math.abs(element.getBoundingClientRect().height - 44) > 1
        )
          failures.push(
            `R2c field height: ${tidy(element.getAttribute("aria-label") || element.id)}`,
          );
      }
      const approvalDecisionButtons = new Set();
      for (const group of document.querySelectorAll(
        ".approval-detail-row > .approval-decision-actions",
      )) {
        if (!visible(group)) continue;
        const card = group.parentElement;
        const controls = [...group.querySelectorAll(":scope > button")].filter(
          visible,
        );
        const expectedCount =
          card?.dataset.approvalType === "barcode_conflict" ? 2 : 3;
        const hasEditor = expectedCount === 3;
        const valid =
          card?.dataset.approvalId &&
          card.dataset.approvalStatus === "pending" &&
          card.querySelector(
            ".approval-row-heading h2 a[href^='#product?code=']",
          ) &&
          card.querySelector(".approval-meta") &&
          [
            "new_product",
            "price_change",
            "tax_profile",
            "barcode_conflict",
          ].includes(card.dataset.approvalType) &&
          controls.length === expectedCount &&
          (!hasEditor || controls[0].classList.contains("button-secondary")) &&
          controls.at(-2).classList.contains("button-danger") &&
          controls.at(-1).classList.contains("button-primary") &&
          /^(Approve|تأیید)$/.test(tidy(controls.at(-1).textContent)) &&
          /^(Reject|رد کردن)$/.test(tidy(controls.at(-2).textContent));
        const rects = controls.map((control) =>
          control.getBoundingClientRect(),
        );
        if (
          !valid ||
          getComputedStyle(group).display !== "flex" ||
          Math.abs(parseFloat(getComputedStyle(group).columnGap) - 8) > 0.1 ||
          rects.some((rect) => Math.abs(rect.top - rects[0].top) > 2)
        ) {
          failures.push(
            "Approval decision row needs its exact ordered, aligned actions",
          );
          continue;
        }
        controls.forEach((control) => approvalDecisionButtons.add(control));
      }
      const approvalEditorFooters = new Set();
      for (const footer of document.querySelectorAll(
        ".approval-product-editor .product-editor-actions",
      )) {
        if (!visible(footer)) continue;
        const dialog = footer.closest("dialog"),
          form = footer.closest("form");
        const controls = [...footer.querySelectorAll(":scope > button")].filter(
          visible,
        );
        const valid =
          dialog?.classList.contains("ui-form-surface") &&
          form?.querySelector(".approval-product-decision") &&
          form.querySelector("input[id$='-name_en']") &&
          form.querySelector("input[id$='-price']") &&
          form.querySelector("input[id$='-supplier-code']") &&
          controls.length === 2 &&
          controls[0].classList.contains("button-neutral") &&
          controls[1].classList.contains("button-primary") &&
          /^(Save and approve|ذخیره و تأیید)$/.test(
            tidy(controls[1].textContent),
          );
        if (!valid)
          failures.push(
            "Approval product editor needs its exact staged form and footer",
          );
        else controls.forEach((control) => approvalEditorFooters.add(control));
      }
      for (const popup of document.querySelectorAll(".notifications-popover")) {
        if (!visible(popup)) continue;
        const fa = document.documentElement.lang.startsWith("fa");
        const title = fa ? "اعلان‌ها" : "Notifications";
        const captions = fa
          ? ["همه را خوانده‌شده علامت بزن", "پاک کردن همه"]
          : ["Mark all as read", "Clear all"];
        const panel = popup.querySelector(
          ":scope > section.personal-notifications",
        );
        const header = panel?.querySelector(
          ":scope > header.personal-notifications-header",
        );
        const heading = header?.querySelector(":scope > h2");
        const actions = header?.querySelector(
          ":scope > .personal-notifications-actions",
        );
        const controls = [
          ...(actions?.querySelectorAll(":scope > button") ?? []),
        ];
        const list = panel?.querySelector(
          ":scope > .personal-notifications-scroll",
        );
        const bell = [
          ...document.querySelectorAll(
            '.topbar > button.notifications-menu.ui-icon-button[aria-haspopup="menu"][aria-expanded="true"]',
          ),
        ].filter(
          (element) =>
            visible(element) &&
            element.getAttribute("aria-controls") === popup.id,
        );
        const actualBell =
          bell.length === 1 &&
          Boolean(
            bell[0].querySelector(
              '.notification-button > svg.lucide-bell[aria-hidden="true"]',
            ),
          ) &&
          (fa
            ? /^اعلان‌ها، \d+ خوانده‌نشده$/
            : /^Notifications, \d+ unread$/
          ).test(bell[0].getAttribute("aria-label") ?? "");
        let valid = Boolean(
          popup.matches('.ui-popover.ui-menu-popover[role="menu"]') &&
          popup.id &&
          actualBell &&
          panel?.getAttribute("aria-label") === title &&
          heading &&
          tidy(heading.textContent) === title &&
          controls.length === 2 &&
          controls.every(
            (control, index) =>
              control.matches(
                '.ui-button.button.button-secondary[data-control-kind="action"][role="menuitem"]',
              ) && tidy(control.textContent) === captions[index],
          ) &&
          list &&
          getComputedStyle(header).position === "sticky" &&
          !list.contains(header),
        );
        if (!valid)
          failures.push(
            "Notification inbox requires its real expanded bell, title, two header actions and separate scroll body",
          );
        const box = popup.getBoundingClientRect();
        const viewport = window.visualViewport;
        const view = {
          left: viewport?.offsetLeft ?? 0,
          top: viewport?.offsetTop ?? 0,
          width: viewport?.width ?? window.innerWidth,
          height: viewport?.height ?? window.innerHeight,
        };
        if (
          Math.abs(box.width - Math.min(380, Math.max(0, view.width - 24))) >
            1 ||
          box.height > view.height * 0.7 + 1 ||
          box.left < view.left + 11 ||
          box.right > view.left + view.width - 11 ||
          box.top < view.top + 15 ||
          box.bottom > view.top + view.height - 15 ||
          popup.scrollHeight > popup.clientHeight + 2
        ) {
          valid = false;
          failures.push(
            "Notification inbox must remain 380px wide within the visible viewport and 70% height without outer scrolling",
          );
        }
        if (header && actions && list) {
          const headBox = header.getBoundingClientRect(),
            listBox = list.getBoundingClientRect();
          const listStyle = getComputedStyle(list);
          const actionBoxes = controls.map((control) =>
            control.getBoundingClientRect(),
          );
          const sorted = [...actionBoxes].sort((a, b) => a.left - b.left);
          if (
            controls.some(
              (control, index) =>
                Math.abs(actionBoxes[index].height - 44) > 1 ||
                actionBoxes[index].left < headBox.left ||
                actionBoxes[index].right > headBox.right ||
                actionBoxes[index].top < headBox.top ||
                actionBoxes[index].bottom > headBox.bottom,
            ) ||
            (sorted.length === 2 &&
              (sorted[1].left - sorted[0].right < 7 ||
                Math.abs(sorted[1].top - sorted[0].top) > 2)) ||
            listBox.top < headBox.bottom - 1 ||
            !["auto", "scroll"].includes(listStyle.overflowY) ||
            ["Top", "Right", "Bottom", "Left"].some(
              (side) => parseFloat(listStyle[`padding${side}`]) < 12,
            )
          ) {
            valid = false;
            failures.push(
              "Notification header actions require their separate 44px row above a padded internal scroll body",
            );
          }
          const items = [
            ...list.querySelectorAll(":scope > button.personal-notification"),
          ];
          const empty = list.querySelector(
            ":scope > .personal-notifications-empty",
          );
          if (!items.length && (!empty || list.children.length !== 1)) {
            valid = false;
            failures.push(
              "Notification inbox needs boxed related records or its one empty state",
            );
          }
          for (const item of items) {
            const copy = item.querySelector(
              ":scope > .personal-notification-copy",
            );
            const dot = item.querySelector(
              ":scope > .personal-notification-dot",
            );
            const date = copy?.querySelector(
              ":scope > .personal-notification-heading > time[datetime]",
            );
            const itemStyle = getComputedStyle(item),
              itemBox = item.getBoundingClientRect();
            if (
              !item.matches(
                '.ui-menu-item[role="menuitem"][data-control-kind="disclosure"]',
              ) ||
              !copy ||
              !dot ||
              !copy.querySelector(
                ":scope > .personal-notification-heading > strong",
              ) ||
              !copy.querySelector(":scope > .personal-notification-branches") ||
              !date ||
              getComputedStyle(date).whiteSpace !== "nowrap" ||
              /\b(?:am|pm)\b/i.test(date.textContent ?? "") ||
              itemBox.height < 44 ||
              item.scrollHeight > item.clientHeight + 2 ||
              item.scrollWidth > item.clientWidth + 2 ||
              ["Top", "Right", "Bottom", "Left"].some(
                (side) => parseFloat(itemStyle[`border${side}Width`]) < 0.5,
              )
            ) {
              valid = false;
              failures.push(
                "Notification related records require intrinsic boxed content, unread state and one-line 24-hour dates",
              );
            }
          }
        }
        if (valid)
          controls.forEach((control) => notificationHeaderActions.add(control));
      }
      for (const control of document.querySelectorAll(
        ".personal-notifications-actions > .ui-button.button",
      ))
        if (visible(control) && !notificationHeaderActions.has(control))
          failures.push(
            `Invalid notification header action composition: ${tidy(control.textContent)}`,
          );
      // Only the actual new-return page action and complete creation dialog use 44px.
      // Ordinary Returns controls retain their existing contract.
      const newReturnControls = new Set();
      const returnRoute = window.location.hash.split("?")[0];
      const faReturn = document.documentElement.lang.startsWith("fa");
      for (const header of document.querySelectorAll(
        "main#main-content > .page-header",
      )) {
        const overview = header.nextElementSibling;
        if (
          returnRoute !== "#returns" ||
          !overview?.matches(".returns-overview")
        )
          continue;
        const actions = [
          ...header.querySelectorAll(":scope > .actions > button"),
        ];
        const valid =
          tidy(header.querySelector("h1")?.textContent) ===
            (faReturn ? "مرجوعی‌ها" : "Returns") &&
          overview.querySelector(".returns-toolbar") &&
          overview.querySelector(".returns-overview-table") &&
          actions.length === 1 &&
          actions[0].matches(".ui-button.button.button-primary") &&
          tidy(actions[0].textContent) ===
            (faReturn ? "مرجوعی جدید" : "New return");
        if (valid) newReturnControls.add(actions[0]);
        else if (actions.length)
          failures.push("Invalid New return page action composition");
      }
      for (const dialog of document.querySelectorAll(".new-return-dialog")) {
        if (!visible(dialog)) continue;
        const body = dialog.querySelector(":scope > .ui-dialog-body");
        const grid = body?.querySelector(":scope > .new-return-grid");
        const photos = body?.querySelector(
          ":scope > section.new-return-photos#new-return-photos",
        );
        const footer = [
          ...dialog.querySelectorAll(":scope > .ui-dialog-footer > button"),
        ];
        const fields = [
          "location",
          "supplier",
          "product",
          "quantity",
          "reason",
          "note",
        ];
        const valid =
          ["#returns", "#return"].includes(returnRoute) &&
          dialog.matches("dialog[open].ui-dialog.ui-dialog-structured") &&
          tidy(
            dialog.querySelector(":scope > .ui-dialog-header h2")?.textContent,
          ) === (faReturn ? "مرجوعی جدید" : "New return") &&
          dialog.querySelector(
            ":scope > .ui-dialog-header .ui-dialog-icon svg.lucide-rotate-ccw",
          ) &&
          Boolean(
            tidy(
              dialog.querySelector(
                ":scope > .ui-dialog-header .dialog-description",
              )?.textContent,
            ),
          ) &&
          grid?.querySelectorAll(":scope > .field").length === 7 &&
          fields.every((field) =>
            grid?.querySelector(`#new-return-${field}`),
          ) &&
          grid?.querySelector(":scope > .new-return-receipt") &&
          photos?.querySelector(":scope > .new-return-photo-heading strong") &&
          photos?.querySelectorAll(
            ":scope > .new-return-photo-actions > button",
          ).length === 2 &&
          photos?.querySelector('input[type="file"][multiple]') &&
          photos?.querySelector('input[type="file"][capture="environment"]') &&
          footer.length === 2 &&
          footer[0].matches(".button-neutral") &&
          footer[1].matches(".button-primary") &&
          tidy(footer[0].textContent) === (faReturn ? "انصراف" : "Cancel") &&
          tidy(footer[1].textContent) ===
            (faReturn ? "ایجاد مرجوعی" : "Create return");
        if (!valid) {
          failures.push("Invalid New return dialog composition");
          continue;
        }
        for (const control of dialog.querySelectorAll(
          "button.ui-button.button:not(.ui-icon-button)",
        )) {
          if (
            control.getAttribute("role") !== "combobox" &&
            !control.closest(".ui-select-popup")
          )
            newReturnControls.add(control);
        }
        for (const control of grid.querySelectorAll(
          'input:not([type="file"]),[role="combobox"]',
        )) {
          if (
            visible(control) &&
            Math.abs(control.getBoundingClientRect().height - 44) > 1
          )
            failures.push(
              `New return field height: ${control.id || tidy(control.getAttribute("aria-label"))}`,
            );
        }
      }
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
        if (
          element.matches(".invoice-entry-choice-tile") &&
          !invoiceSourceTiles.has(element)
        )
          failures.push(
            `Invoice source tile outside the validated four-choice composition: ${label}`,
          );
        const r2cControl =
          r2cRoots.has(element.closest(".r2c-screen")) &&
          r2cOrdinaryButton(element);
        if (r2cControl && Math.abs(rect.height - 44) > 1)
          failures.push(
            `R2c control height: ${label} (${round(rect.height)}px)`,
          );
        const newReturnControl = newReturnControls.has(element);
        if (newReturnControl && Math.abs(rect.height - 44) > 1)
          failures.push(
            `New return control height: ${label} (${round(rect.height)}px)`,
          );
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
        let labelAction = false;
        if (element.getAttribute("data-control-kind") === "label-action") {
          const actions = element.parentElement;
          const labelRow = actions?.parentElement;
          const field = labelRow?.parentElement;
          const fieldLabel = labelRow?.querySelector(":scope > label");
          const fieldControl = fieldLabel?.htmlFor
            ? Array.from(field?.querySelectorAll("[id]") ?? []).find(
                (control) => control.id === fieldLabel.htmlFor,
              )
            : null;
          const marker = actions?.querySelector(
            ':scope > .reading-check-marker[role="img"][tabindex="0"]',
          );
          const caption = tidy(element.textContent);
          const expectedCaption = document.documentElement.lang.startsWith("fa")
            ? "در فاکتور نیست"
            : "Not on the invoice";
          labelAction = Boolean(
            element.matches(
              "button.ui-button.button.button-secondary.button-label-action",
            ) &&
            actions?.matches(".reading-check-label-actions") &&
            labelRow?.matches(".ui-field-label-row") &&
            field?.matches(".field") &&
            fieldLabel &&
            fieldControl &&
            caption === expectedCaption &&
            label === `${expectedCaption}: ${tidy(fieldLabel.textContent)}` &&
            (element.disabled ||
              tidy(
                marker?.querySelector(':scope > [aria-hidden="true"]')
                  ?.textContent,
              ) === "!"),
          );
          if (!labelAction)
            failures.push(`Invalid field label action declaration: ${label}`);
          else if (
            Math.abs(parseFloat(style.fontSize) - 13) > 0.01 ||
            Number(style.fontWeight) !== 600 ||
            Math.abs(parseFloat(style.paddingLeft) - 8) > 0.01 ||
            Math.abs(parseFloat(style.paddingRight) - 8) > 0.01 ||
            ["Top", "Right", "Bottom", "Left"].some(
              (side) => parseFloat(style[`border${side}Width`]) > 0.01,
            )
          )
            failures.push(`Field label action typography or spacing: ${label}`);
        }
        const nearestRow = element.closest("tbody tr");
        const dialog = element.closest("dialog");
        const receivingForm = element.closest(
          ".receiving-editor-row > td > .receiving-line-editor",
        );
        const row =
          nearestRow &&
          !receivingForm &&
          (!dialog || !nearestRow.contains(dialog))
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
          const small =
            labelAction ||
            element.classList.contains("button-sm") ||
            element.closest(".table-actions, .catalog-row-actions");
          const expectedRadius = small ? "10px" : "12px";
          // C8 requires field-aligned Add controls to be 44px at every width.
          const fieldAlignedAdd = element.matches(
            ".date-quick-actions > button[type='submit'], .product-editor-date-add > button",
          );
          const structuredFooter = element.matches(
            "dialog.ui-dialog-structured > .ui-dialog-footer > .ui-button.button",
          );
          const structuredSecondary =
            structuredFooter &&
            variantClass === "secondary" &&
            !element.disabled;
          const dashboardAction = dashboardRoots.has(
            element.closest(".r2c-dashboard"),
          );
          const expectedHeight = labelAction
            ? 32
            : newReturnControl ||
                r2cControl ||
                dashboardAction ||
                structuredFooter ||
                approvalDecisionButtons.has(element) ||
                approvalEditorFooters.has(element) ||
                notificationHeaderActions.has(element)
              ? 44
              : element.closest(".c9-filter-toolbar")
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
          if (structuredSecondary) {
            const tokenBorder = canonicalColor(
              style.getPropertyValue("--field-border").trim(),
            );
            if (
              ["Top", "Right", "Bottom", "Left"].some(
                (side) =>
                  Math.abs(parseFloat(style[`border${side}Width`]) - 1) >
                    0.01 ||
                  style[`border${side}Style`] !== "solid" ||
                  canonicalColor(style[`border${side}Color`]) !== tokenBorder,
              )
            )
              failures.push(
                `Structured dialog secondary needs its 1px field-token border: ${label}`,
              );
          }
          if (
            kind === "action" &&
            !structuredSecondary &&
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
          if (
            !phoneReceivingWidths.has(element) &&
            !dashboardWideActions.has(element) &&
            rect.width > Math.max(40, intrinsicWidth) + 5
          )
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
          const importContentRow = row.matches(
            ".invoice-readings-table tr.phone-list-row[data-import-id]",
          );
          const chargesContentRow = row.matches(
            ".invoice-other-charges tr.phone-list-row",
          );
          const dashboardApprovalRow =
            dashboardRoots.has(row.closest(".r2c-dashboard")) &&
            row.matches(".dashboard-approval-table tr[data-approval-id]") &&
            row.querySelector(".phone-list-name a.entity-link") &&
            row.querySelector(
              ".phone-list-secondary .dashboard-inline-actions button.ui-button",
            ) &&
            row.querySelector(".phone-list-secondary .ui-badge");
          const contentRow =
            importContentRow || chargesContentRow || dashboardApprovalRow;
          if (contentRow) {
            const selection = row.querySelectorAll(
              ":scope > .phone-list-selection [role='checkbox']",
            );
            const name = row.querySelector(":scope > .phone-list-name");
            const value = row.querySelector(":scope > .phone-list-value");
            const secondary = row.querySelector(
              ":scope > .phone-list-secondary",
            );
            const rowBounds = row.getBoundingClientRect();
            if (
              getComputedStyle(row).display !== "grid" ||
              rowNavigation.length !== 0 ||
              rowDisclosure.length !== 0 ||
              !name ||
              !tidy(name.textContent) ||
              !value ||
              !tidy(value.textContent) ||
              !secondary ||
              !tidy(secondary.textContent) ||
              cells.some((cell) => {
                const bounds = cell.getBoundingClientRect();
                return (
                  bounds.left < rowBounds.left - 1 ||
                  bounds.right > rowBounds.right + 1
                );
              })
            )
              failures.push(
                "Receiving phone content row loses contained fields",
              );
            if (
              importContentRow &&
              (selection.length !== 1 ||
                !selection[0].getAttribute("aria-label") ||
                !value?.querySelector(".ui-badge") ||
                secondary?.querySelectorAll("[role='combobox']").length !== 1 ||
                secondary?.querySelectorAll("img.invoice-reading-thumbnail")
                  .length !== 1)
            )
              failures.push(
                "Import preview phone row needs selection, Status and its secondary fields",
              );
            if (chargesContentRow) {
              const edits = name?.querySelectorAll(
                "a[data-control-kind='disclosure'][aria-expanded]",
              );
              const review = Boolean(row.closest(".receiving-review"));
              if (
                selection.length !== 0 ||
                edits?.length !== (review ? 1 : 0) ||
                !value?.querySelector("bdi[dir='ltr'], .value-empty") ||
                secondary?.querySelectorAll(":scope > span").length !== 1
              )
                failures.push(
                  "Other charges phone row needs its amount, tax and permitted inline edit",
                );
            }
          } else if (
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
            // A composed receiving editor is a full form inside an expanded
            // row. Its exact footer set/grid is measured above; each ordinary
            // action still passes every independent size/style audit.
            .filter(
              (element) =>
                !element.closest(
                  ".receiving-editor-row > td > .receiving-line-editor",
                ),
            )
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
            const ellipsis = parent.closest(
              ".receiving-table .receiving-product-name",
            );
            const ellipsisStyle = ellipsis && getComputedStyle(ellipsis);
            const ellipsisBounds = ellipsis?.getBoundingClientRect();
            // Only the reference receiving name intentionally elides text.
            // Its full exact title remains available and its painted box must
            // stay wholly within this cell; no other clipped text is exempt.
            const receivingEllipsis =
              ellipsis &&
              ellipsis.closest("td") === cell &&
              ellipsisStyle.overflowX === "hidden" &&
              ellipsisStyle.textOverflow === "ellipsis" &&
              ellipsisStyle.whiteSpace === "nowrap" &&
              tidy(ellipsis.getAttribute("title")) ===
                tidy(ellipsis.textContent) &&
              tidy(ellipsis.textContent) &&
              ellipsisBounds.left >= bounds.left - 1 &&
              ellipsisBounds.right <= bounds.right + 1 &&
              ellipsisBounds.top >= bounds.top - 1 &&
              ellipsisBounds.bottom <= bounds.bottom + 1;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects())
              if (
                !receivingEllipsis &&
                (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
              )
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
