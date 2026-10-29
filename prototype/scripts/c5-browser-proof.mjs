/* global document, window, getComputedStyle, NodeFilter, requestAnimationFrame, indexedDB */
import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

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
  const language = ["fa-light", "fa-dark"].includes(variant) ? "fa" : "en";
  const theme = ["en-dark", "fa-dark"].includes(variant) ? "dark" : "light";
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

/** Read only the real configured company record; never initialize a proof database. */
async function retainedReturnEvidence(page) {
  if (!(await page.locator(".returns-overview").count())) return [];
  const [authoritySource, sourceConfig, retainedConfig] = await Promise.all([
    readFile(
      new URL("../src/authority-repository.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../seed/arzon-config.json", import.meta.url), "utf8"),
    readFile(
      new URL("../src/compat/configuration.json", import.meta.url),
      "utf8",
    ),
  ]);
  const databaseName = authoritySource.match(
    /AUTHORITY_DATABASE_NAME\s*=\s*"([^"]+)"/,
  )?.[1];
  const companyId = {
    ...JSON.parse(retainedConfig).company,
    ...JSON.parse(sourceConfig).company,
  }.seed_key;
  if (!databaseName || !companyId)
    throw new Error("Missing canonical Returns proof configuration");
  return page.evaluate(
    ({ databaseName, companyId }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(databaseName);
        open.onupgradeneeded = () => {
          open.transaction.abort();
          reject(new Error("Returns proof cannot create a database"));
        };
        open.onerror = open.onblocked = () =>
          reject(new Error("Cannot open canonical Returns evidence"));
        open.onsuccess = () => {
          const database = open.result;
          database.onversionchange = () => database.close();
          if (!database.objectStoreNames.contains("business")) {
            database.close();
            reject(new Error("Missing canonical business store"));
            return;
          }
          const transaction = database.transaction("business", "readonly");
          const request = transaction.objectStore("business").get(companyId);
          let records;
          request.onsuccess = () => {
            const record = request.result;
            if (
              record?.company_id !== companyId ||
              record.state?.config?.company?.seed_key !== companyId ||
              !Number.isSafeInteger(record.revision)
            ) {
              transaction.abort();
              return;
            }
            const state = record.state;
            records = state.returns
              .filter((item) => item.company_id === companyId)
              .map((item, index) => ({
                id: item.id,
                number: index + 1,
                supplier: item.supplier,
                remaining: Math.max(0, item.lines.length - 2),
                items: item.lines.slice(0, 2).map((line) => {
                  const product = state.products.find(
                    (product) =>
                      product.company_id === companyId &&
                      product.code === line.product_code,
                  );
                  return {
                    en: product?.name_en || line.product_code,
                    fa:
                      product?.name_fa || product?.name_en || line.product_code,
                    qty: line.qty,
                  };
                }),
              }));
          };
          transaction.oncomplete = () => {
            database.close();
            if (records) resolve(records);
            else reject(new Error("Missing canonical Returns evidence"));
          };
          transaction.onerror = transaction.onabort = () => {
            database.close();
            reject(new Error("Cannot read canonical Returns evidence"));
          };
        };
      }),
    { databaseName, companyId },
  );
}

/** Measures every visible real control, including semantic widget exceptions. */
export async function inspect(page, screen, variant, role = "supervisor") {
  await settled(page);
  const expectedReturns = await retainedReturnEvidence(page);
  return page.evaluate(
    ({ screen, variant, role, expectedReturns }) => {
      const visible = (element) => {
        if (
          typeof element.checkVisibility === "function" &&
          !element.checkVisibility({
            contentVisibilityAuto: true,
            visibilityProperty: true,
          })
        )
          return false;
        for (
          let closed = element.closest("details:not([open])");
          closed;
          closed = closed.parentElement?.closest("details:not([open])")
        )
          if (!closed.querySelector(":scope > summary")?.contains(element))
            return false;
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
      const receivingOriginalOpeners = new Set();
      const notificationHeaderActions = new Set();
      const kindOf = (element) => {
        if (invoiceSourceTiles.has(element)) return "source-tile";
        if (element.matches(".original-viewer-phone-trigger"))
          return receivingOriginalOpeners.has(element)
            ? "disclosure"
            : "action";
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
      const phone = document.documentElement.clientWidth <= 760;
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
      // R2g B1's approved authentication action is 48px and exactly fills its
      // real form. A copied class cannot opt an unrelated action into it.
      const authenticationShapes = new Map();
      const authenticationCards = [
        ...document.querySelectorAll(
          "#root > .signin-page > .signin-wrap > .signin-card.ui-card.card",
        ),
      ];
      const authenticationCard =
        authenticationCards.length === 1 ? authenticationCards[0] : null;
      const authenticationForm = authenticationCard?.querySelector("form");
      const authenticationSubmit = authenticationForm?.querySelector(
        ":scope > button.signin-submit.ui-button.button-primary[type='submit']",
      );
      const authenticationHeading = tidy(
        authenticationCard?.querySelector("h1")?.textContent,
      );
      const passwordControls = [
        ...(authenticationForm?.querySelectorAll(
          "input[autocomplete='current-password'], input[autocomplete='new-password']",
        ) ?? []),
      ];
      const passwordLabelsValid = passwordControls.every(
        (control) =>
          control.id &&
          [...authenticationForm.querySelectorAll("label")].some(
            (label) => label.htmlFor === control.id && tidy(label.textContent),
          ),
      );
      const authenticationSecondStep = authenticationCard?.querySelector(
        ":scope > .auth-second-step > form",
      );
      const genuineAuthentication = Boolean(
        authenticationCard &&
        authenticationForm &&
        authenticationSubmit &&
        authenticationCard.querySelectorAll("form").length === 1 &&
        authenticationForm.querySelectorAll("button[type='submit']").length ===
          1 &&
        [
          "Sign in",
          "ورود",
          "Locked",
          "قفل شده",
          "Choose a new password",
          "انتخاب گذرواژهٔ جدید",
          "Confirm it's you",
          "تأیید هویت",
          "Choose a second sign-in step",
          "انتخاب مرحلهٔ دوم ورود",
        ].includes(authenticationHeading) &&
        [
          "Sign in",
          "ورود",
          "Unlock",
          "باز کردن قفل",
          "Save password",
          "ذخیرهٔ گذرواژه",
          "Continue",
          "ادامه",
          "Continue with passkey",
          "ادامه با کلید ورود",
        ].includes(tidy(authenticationSubmit.textContent)) &&
        ((passwordControls.length > 0 && passwordLabelsValid) ||
          (authenticationSecondStep === authenticationForm &&
            authenticationForm.querySelector(
              ":scope > .auth-step-explanation",
            ) &&
            authenticationForm.querySelector(":scope > .auth-simulated-note"))),
      );
      if (genuineAuthentication) {
        const cardBox = authenticationCard.getBoundingClientRect();
        const formBox = authenticationForm.getBoundingClientRect();
        const submitBox = authenticationSubmit.getBoundingClientRect();
        if (
          Math.abs(cardBox.width - Math.min(400, window.innerWidth - 32)) > 1 ||
          Math.abs(submitBox.width - formBox.width) > 1 ||
          Math.abs(submitBox.left - formBox.left) > 1 ||
          Math.abs(submitBox.right - formBox.right) > 1
        )
          failures.push(
            "Authentication primary does not fill the approved bounded form",
          );
        authenticationShapes.set(authenticationSubmit, {
          height: 48,
          fullWidth: true,
        });
        const help = authenticationForm.querySelector(
          ".auth-label-row > button.auth-help-link.ui-button.button-plain",
        );
        if (help) {
          const label = help.parentElement.querySelector(":scope > label");
          const linkedPassword = passwordControls.find(
            (control) => control.id === label?.htmlFor,
          );
          if (
            linkedPassword &&
            ["Forgot password?", "رمز را فراموش کرده‌اید؟"].includes(
              tidy(help.textContent),
            )
          )
            authenticationShapes.set(help, {
              height: 20,
              radii: ["0px", "0px", "0px", "0px"],
            });
          else
            failures.push(
              "Authentication password help is not linked to its password field",
            );
        }
      }
      for (const control of document.querySelectorAll(
        "button.signin-submit, button.auth-help-link",
      )) {
        if (visible(control) && !authenticationShapes.has(control))
          failures.push(
            `Authentication action outside its validated form: ${tidy(control.textContent)}`,
          );
      }

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
      // D9 retains the approved compact plain header and field-height Add line row.
      const r2fOriginalHeaderActions = new Set();
      for (const group of document.querySelectorAll(
        ".original-viewer > .original-viewer-header > .original-viewer-header-actions",
      )) {
        if (!visible(group)) continue;
        const viewer = group.closest(".original-viewer");
        const controls = [...group.querySelectorAll(":scope > button")].filter(
          visible,
        );
        const boxes = controls.map((control) =>
          control.getBoundingClientRect(),
        );
        const valid =
          viewer?.id === "invoice-original-field" &&
          viewer.querySelector(":scope > .original-viewer-panel") &&
          viewer.querySelector(":scope > .original-viewer-phone-trigger") &&
          group.parentElement.querySelector(
            ":scope > .original-viewer-title > h2",
          ) &&
          controls.length === 2 &&
          controls.every((control) =>
            control.classList.contains("button-plain"),
          ) &&
          /^(Expand|بزرگ کردن)$/.test(tidy(controls[0].textContent)) &&
          /^(Hide|Show original|پنهان|نمایش اصل)$/.test(
            tidy(controls[1].textContent),
          ) &&
          boxes.every(
            (box) =>
              Math.abs(box.height - 32) <= 1 &&
              Math.abs(
                box.top + box.height / 2 - boxes[0].top - boxes[0].height / 2,
              ) <= 1.5,
          );
        if (!valid)
          failures.push(
            "Original invoice header actions need their exact plain, aligned controls",
          );
        else
          controls.forEach((control) => r2fOriginalHeaderActions.add(control));
      }
      // R2g B4: only the genuine receiving footer earns its full-width/select
      // and two half-width action slots. A copied class remains intrinsic.
      const r2fAddLineControls = new Set();
      for (const footer of document.querySelectorAll(
        '.receiving-review[data-testid="invoice-review"] .receiving-lines > .receiving-add-line',
      )) {
        if (!visible(footer)) continue;
        const group = footer.querySelector(
          ":scope > .actions.ui-control-row[data-control-row]",
        );
        const select = group?.querySelector(
          ':scope > #invoice-add-product[role="combobox"]',
        );
        const controls = [
          ...(group?.querySelectorAll(":scope > .ui-button.button") ?? []),
          ...footer.querySelectorAll(":scope > .ui-button.button"),
        ].filter(visible);
        const boxes = [select, ...controls]
          .filter(Boolean)
          .map((control) => control.getBoundingClientRect());
        const semantic =
          select &&
          controls.length === 3 &&
          footer.parentElement.querySelector(
            ":scope > .receiving-lines-table > .receiving-table",
          ) &&
          /^(Add line|افزودن ردیف)$/.test(tidy(controls[0].textContent)) &&
          /^(\+ Add new product|\+ افزودن کالای جدید)$/.test(
            tidy(controls[1].textContent),
          ) &&
          /^(\+ Add charge or credit|\+ افزودن هزینه یا اعتبار)$/.test(
            tidy(controls[2].textContent),
          ) &&
          controls[0].classList.contains("button-secondary") &&
          controls[1].classList.contains("button-plain") &&
          controls[2].matches(".receiving-add-charge.button-plain");
        const peers = boxes.every(
          (box) =>
            Math.abs(box.height - 44) <= 1 &&
            boxes.every(
              (peer) =>
                Math.abs(
                  box.top + box.height / 2 - peer.top - peer.height / 2,
                ) <= 1.5 ||
                box.bottom + 7 <= peer.top ||
                peer.bottom + 7 <= box.top,
            ),
        );
        if (!semantic || !peers) {
          failures.push(
            "Add line needs its exact field-aligned Select and three actions",
          );
          continue;
        }
        controls.forEach((control) => r2fAddLineControls.add(control));
        if (phone) {
          const style = getComputedStyle(footer);
          const bounds = contentBounds(footer);
          const half = (bounds.width - 8) / 2;
          const full = [select, controls[0]];
          const halves = controls
            .slice(1)
            .map((control) => ({
              control,
              box: control.getBoundingClientRect(),
            }))
            .sort((a, b) => a.box.left - b.box.left);
          let correct =
            style.display === "grid" &&
            style.gridTemplateColumns.split(/\s+/).length === 2 &&
            Math.abs(parseFloat(style.columnGap) - 8) <= 0.1 &&
            Math.abs(parseFloat(style.rowGap) - 8) <= 0.1;
          for (const control of full) {
            const box = control.getBoundingClientRect();
            if (control !== select)
              phoneReceivingWidths.set(control, bounds.width);
            correct &&=
              Math.abs(box.left - bounds.left) <= 1 &&
              Math.abs(box.right - bounds.right) <= 1;
          }
          correct &&=
            Math.abs(
              full[1].getBoundingClientRect().top -
                full[0].getBoundingClientRect().bottom -
                8,
            ) <= 1;
          halves.forEach(({ control, box }, index) => {
            phoneReceivingWidths.set(control, half);
            correct &&=
              Math.abs(box.width - half) <= 1 &&
              Math.abs(box.left - bounds.left - index * (half + 8)) <= 1 &&
              Math.abs(box.top - full[1].getBoundingClientRect().bottom - 8) <=
                1;
          });
          if (!correct)
            failures.push(
              "Receiving phone add footer must fill its full and half-width slots",
            );
        }
      }
      // The original opens evidence; its thumbnail is contained inside the
      // approved 64px-minimum full-width card, rather than a stretched action.
      if (phone)
        for (const opener of document.querySelectorAll(
          ".original-viewer-phone-trigger",
        )) {
          if (!visible(opener)) continue;
          const viewer = opener.parentElement;
          const review = viewer?.closest(".receiving-review");
          const thumb = opener.querySelector(
            ":scope > .original-viewer-thumbnail",
          );
          const copy = opener.querySelector(
            ":scope > .original-viewer-phone-text",
          );
          const icon = opener.querySelector(
            ":scope > .original-viewer-phone-chevron",
          );
          const bounds = opener.getBoundingClientRect();
          const outer = viewer?.getBoundingClientRect();
          const thumbnail = thumb?.getBoundingClientRect();
          const style = getComputedStyle(opener);
          const semantic =
            /^#invoices(?:[?]|$)/.test(window.location.hash) &&
            viewer?.matches("aside.original-viewer#invoice-original-field") &&
            review?.querySelector(":scope > .receiving-header h1") &&
            viewer.querySelector(":scope > .original-viewer-panel") &&
            opener.matches(
              'button.ui-button.button.button-secondary[data-control-kind="disclosure"]',
            ) &&
            /^(View original|Attach original|مشاهده اصل|پیوست اصل فاکتور)$/.test(
              tidy(copy?.querySelector(":scope > strong")?.textContent),
            ) &&
            thumb &&
            copy &&
            icon;
          const contained =
            semantic &&
            outer &&
            thumbnail &&
            style.display === "grid" &&
            style.gridTemplateColumns.split(/\s+/).length === 3 &&
            Math.abs(bounds.left - outer.left) <= 1 &&
            Math.abs(bounds.right - outer.right) <= 1 &&
            Math.abs(thumbnail.width - 48) <= 1 &&
            Math.abs(thumbnail.height - 48) <= 1 &&
            getComputedStyle(thumb).overflow === "hidden" &&
            style.overflow === "hidden" &&
            thumbnail.left >= bounds.left &&
            thumbnail.right <= bounds.right &&
            thumbnail.top >= bounds.top &&
            thumbnail.bottom <= bounds.bottom &&
            Math.abs(parseFloat(style.minHeight) - 64) <= 1 &&
            Math.abs(
              bounds.height -
                Math.max(64, copy.getBoundingClientRect().height + 16),
            ) <= 2 &&
            [
              style.borderTopLeftRadius,
              style.borderTopRightRadius,
              style.borderBottomRightRadius,
              style.borderBottomLeftRadius,
            ].every(
              (radius) =>
                radius === style.getPropertyValue("--radius-menu").trim(),
            );
          if (!semantic || !contained)
            failures.push(
              "Receiving original opener must retain its genuine full-width card and clipped thumbnail",
            );
          else receivingOriginalOpeners.add(opener);
        }
      // R2f D6 keeps the previous direct-row contract below and adds its exact
      // approved footer composition. Only a fully validated composition earns
      // the 40px desktop / 44px phone controls and two-row phone action slots.
      const r2fApprovalActions = new Set();
      const r2fApprovalWidths = new Map();
      for (const group of document.querySelectorAll(
        ".approval-detail-row > .approval-card-footer > .approval-decision-actions, .approval-detail-row > .approval-card-footer > .sale-request-actions",
      )) {
        if (!visible(group)) continue;
        const footer = group.parentElement;
        const card = footer?.parentElement;
        const controls = [...group.querySelectorAll(":scope > button")].filter(
          visible,
        );
        const sale = Boolean(card?.dataset.saleRequestId);
        const barcode = card?.dataset.approvalType === "barcode_conflict";
        const expectedCount = barcode ? 2 : 3;
        const validIdentity = sale
          ? card?.classList.contains("sale-request-card") &&
            card.querySelector(
              ".approval-row-heading h3 a[href^='#product?code=']",
            )
          : card?.dataset.approvalId &&
            card.dataset.approvalStatus === "pending" &&
            [
              "new_product",
              "price_change",
              "tax_profile",
              "barcode_conflict",
            ].includes(card.dataset.approvalType) &&
            card.querySelector(
              ".approval-row-heading h2 a[href^='#product?code=']",
            );
        const validNumbers =
          barcode ||
          card?.querySelector(
            ".approval-numbers > .ui-number-stat.approval-number-price > .ui-number-value",
          );
        const valid =
          validIdentity &&
          validNumbers &&
          footer.querySelector(":scope > .approval-meta") &&
          controls.length === expectedCount &&
          (barcode || controls[0].classList.contains("button-secondary")) &&
          controls.at(-2).classList.contains("button-danger") &&
          controls.at(-1).classList.contains("button-primary") &&
          /^(Approve|تأیید)$/.test(tidy(controls.at(-1).textContent)) &&
          /^(Reject|رد کردن)$/.test(tidy(controls.at(-2).textContent));
        const boxes = controls.map((control) =>
          control.getBoundingClientRect(),
        );
        const layout = getComputedStyle(group);
        const expectedHeight = phone ? 44 : 40;
        let geometry =
          boxes.every((box) => Math.abs(box.height - expectedHeight) <= 1) &&
          Math.abs(parseFloat(layout.columnGap) - 8) <= 0.1;
        if (phone) {
          const bounds = contentBounds(group);
          const primary = boxes.at(-1);
          const half = (bounds.width - 8) / 2;
          geometry &&=
            layout.display === "grid" &&
            Math.abs(primary.width - bounds.width) <= 1 &&
            primary.bottom <= boxes[0].top + 1 &&
            boxes
              .slice(0, -1)
              .every((box) => Math.abs(box.width - half) <= 1) &&
            (barcode || Math.abs(boxes[0].top - boxes[1].top) <= 1.5);
          if (valid && geometry)
            controls.forEach((control, index) =>
              r2fApprovalWidths.set(
                control,
                index === controls.length - 1 ? bounds.width : half,
              ),
            );
        } else
          geometry &&=
            layout.display === "flex" &&
            boxes.every(
              (box) =>
                Math.abs(
                  box.top + box.height / 2 - boxes[0].top - boxes[0].height / 2,
                ) <= 1.5,
            );
        if (!valid || !geometry) {
          failures.push(
            "Approval decision row needs its exact ordered, aligned actions",
          );
          continue;
        }
        controls.forEach((control) => r2fApprovalActions.add(control));
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
        const quantityRow = grid?.querySelector(
          ":scope > .new-return-quantity-row",
        );
        const quantityInput = quantityRow?.querySelector(
          "#new-return-quantity",
        );
        const unitSelect = quantityRow?.querySelector("#new-return-unit");
        const fields = [
          "location",
          "supplier",
          "product",
          "quantity",
          "unit",
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
          grid?.querySelectorAll(":scope > .field").length === 5 &&
          grid?.querySelectorAll(".field").length === 7 &&
          quantityRow?.querySelectorAll(":scope > .field").length === 2 &&
          quantityInput?.matches("input.ui-input") &&
          unitSelect?.matches('button.ui-select[role="combobox"]') &&
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
        if (visible(quantityInput) && visible(unitSelect)) {
          const quantityBounds = quantityInput.getBoundingClientRect();
          const unitBounds = unitSelect.getBoundingClientRect();
          if (
            Math.abs(
              quantityBounds.top +
                quantityBounds.height / 2 -
                unitBounds.top -
                unitBounds.height / 2,
            ) > 1.5 ||
            Math.abs(quantityBounds.height - unitBounds.height) > 2
          )
            failures.push("New return quantity/unit alignment");
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
      // R2f D10: qualify only the real request form and its owned search popup.
      // These composed controls retain action semantics; unrelated buttons keep C5's contract.
      const requestActionShapes = new Map();
      const requestForm = document.querySelector(
        "main .request-form[data-r2f-scene='D10']",
      );
      const requestFa = document.documentElement.lang.startsWith("fa");
      const requestTitle = tidy(
        requestForm?.parentElement?.querySelector(":scope > .page-header h1")
          ?.textContent,
      );
      const genuineRequestForm = Boolean(
        window.location.hash.split("?")[0] === "#requests" &&
        requestForm &&
        visible(requestForm) &&
        [
          "New request",
          "Edit draft",
          "درخواست جدید",
          "ویرایش پیش‌نویس",
        ].includes(requestTitle) &&
        requestForm.parentElement?.querySelector(
          "a.request-form-back[href='#requests']",
        ) &&
        requestForm.querySelector(
          "#request-source.ui-select[role='combobox']",
        ) &&
        requestForm.querySelector(
          "#request-destination.ui-select[role='combobox']",
        ) &&
        requestForm.querySelector("ul.request-draft-lines") &&
        requestForm.querySelector("#request-products"),
      );
      if (genuineRequestForm) {
        const footer = requestForm.querySelector(
          ":scope > .request-form-actions.ui-control-row[data-ui-control-size='page']",
        );
        const actions = [
          ...(footer?.querySelectorAll(":scope > button") ?? []),
        ];
        const captions = requestFa
          ? ["انصراف", "ذخیره پیش‌نویس", "ارسال درخواست"]
          : ["Cancel", "Save as draft", "Send request"];
        const validFooter =
          actions.length === 3 &&
          actions.every(
            (action, index) =>
              action.matches(
                "button.ui-button.button[data-control-kind='action']",
              ) && tidy(action.textContent) === captions[index],
          );
        if (!validFooter)
          failures.push("Invalid R2f D10 request footer composition");
        else {
          const phoneGrid =
            phone && getComputedStyle(footer).display === "grid";
          if (phoneGrid) {
            const bounds = footer.getBoundingClientRect();
            const widths = actions.map(
              (action) => action.getBoundingClientRect().width,
            );
            if (
              Math.abs(widths[2] - bounds.width) > 1.5 ||
              Math.abs(widths[0] - widths[1]) > 1.5
            )
              failures.push(
                "R2f D10 phone footer actions must fill their grid cells",
              );
          }
          for (const action of actions)
            requestActionShapes.set(action, {
              height: 44,
              fullWidth: phoneGrid,
            });
        }
        for (const editor of requestForm.querySelectorAll(
          ".request-line-name > .request-line-note-editor",
        )) {
          const done = editor.querySelector(
            ":scope > .request-line-note-actions.ui-control-row[data-ui-control-size='small'] > button",
          );
          const valid =
            editor.querySelector(".field > textarea.ui-auto-textarea") &&
            done?.matches(
              "button.ui-button.button.button-sm[data-control-kind='action']",
            ) &&
            tidy(done.textContent) === (requestFa ? "انجام شد" : "Done");
          if (valid) requestActionShapes.set(done, { height: 40 });
          else failures.push("Invalid R2f D10 inline note editor composition");
        }
        const search = requestForm.querySelector("#request-products");
        const popup = document.getElementById(
          search.getAttribute("aria-controls") || "",
        );
        const query = search.value.trim();
        if (popup && visible(popup)) {
          const genuinePopup = Boolean(
            query &&
            popup.matches(
              ".request-search-results.ui-popover[data-r2f-scene='D10'][role='region']",
            ) &&
            search.closest(".request-search-pill") &&
            popup.id === "request-product-results",
          );
          if (!genuinePopup)
            failures.push("Invalid R2f D10 owned product search popup");
          else {
            for (const option of popup.querySelectorAll(
              ":scope > .request-search-option[data-product-code]",
            )) {
              const action = option.querySelector(":scope > button");
              const code = option.dataset.productCode;
              const added = [
                ...requestForm.querySelectorAll(
                  ".request-draft-line[data-product-code]",
                ),
              ].some((line) => line.dataset.productCode === code);
              const expectedCaption = added
                ? requestFa
                  ? "اضافه شد"
                  : "Added"
                : requestFa
                  ? "افزودن"
                  : "Add";
              const valid =
                code &&
                option.matches(
                  ".ui-control-row[data-ui-control-size='small']",
                ) &&
                tidy(
                  option.querySelector(".request-search-option-name > strong")
                    ?.textContent,
                ) &&
                tidy(
                  option.querySelector(".request-search-option-name > .muted")
                    ?.textContent,
                ).includes(code) &&
                action?.matches(
                  "button.ui-button.button.button-sm[data-control-kind='action']",
                ) &&
                tidy(action.textContent) === expectedCaption &&
                action.disabled === added &&
                action.querySelector(
                  added ? "svg.lucide-check" : "svg.lucide-plus",
                );
              if (valid) requestActionShapes.set(action, { height: 40 });
              else
                failures.push(
                  "Invalid R2f D10 Add/Added search option composition",
                );
            }
            const action = popup.querySelector(
              ":scope > button.request-search-new",
            );
            const circle = action?.querySelector(
              ":scope > .request-search-new-icon[data-icon-text-icon]",
            );
            const copy = action?.querySelector(
              ":scope > .request-search-new-text[data-icon-text-copy]",
            );
            const expectedTitle = requestFa
              ? `افزودن «${query}» به عنوان قلم جدید`
              : `Add “${query}” as a new item`;
            const expectedHint = requestFa
              ? "برای چیزهایی که در فهرست کالا نیستند"
              : "For things that aren't in the catalog";
            let valid = Boolean(
              action?.matches(
                "button.ui-button.button.button-plain.ui-icon-text[data-control-kind='action']",
              ) &&
              circle?.querySelector(":scope > svg.lucide-plus") &&
              copy?.children.length === 2 &&
              tidy(copy.querySelector(":scope > strong")?.textContent) ===
                expectedTitle &&
              tidy(
                copy.querySelector(":scope > .muted#request-new-item-hint")
                  ?.textContent,
              ) === expectedHint &&
              action.getAttribute("aria-label") ===
                `${requestFa ? "افزودن مورد" : "Add item"}: ${query}` &&
              action.getAttribute("aria-describedby") ===
                "request-new-item-hint",
            );
            if (valid) {
              const actionStyle = getComputedStyle(action),
                popupStyle = getComputedStyle(popup);
              const bounds = action.getBoundingClientRect(),
                circleBounds = circle.getBoundingClientRect(),
                copyBounds = copy.getBoundingClientRect(),
                popupBounds = popup.getBoundingClientRect();
              const innerLeft =
                popupBounds.left +
                parseFloat(popupStyle.borderLeftWidth) +
                parseFloat(popupStyle.paddingLeft);
              const innerRight =
                popupBounds.right -
                parseFloat(popupStyle.borderRightWidth) -
                parseFloat(popupStyle.paddingRight);
              const intrinsicHeight = Math.max(
                56,
                Math.max(circleBounds.height, copyBounds.height) +
                  parseFloat(actionStyle.paddingTop) +
                  parseFloat(actionStyle.paddingBottom) +
                  parseFloat(actionStyle.borderTopWidth) +
                  parseFloat(actionStyle.borderBottomWidth),
              );
              valid =
                Math.abs(circleBounds.width - 32) <= 1 &&
                Math.abs(circleBounds.height - 32) <= 1 &&
                Math.abs(
                  (circleBounds.top +
                    circleBounds.bottom -
                    copyBounds.top -
                    copyBounds.bottom) /
                    2,
                ) <= 1.5 &&
                Math.abs(bounds.left - innerLeft) <= 1.5 &&
                Math.abs(bounds.right - innerRight) <= 1.5 &&
                Math.abs(parseFloat(actionStyle.paddingLeft) - 12) <= 0.5 &&
                Math.abs(parseFloat(actionStyle.paddingRight) - 12) <= 0.5 &&
                Math.abs(parseFloat(actionStyle.paddingTop) - 8) <= 0.5 &&
                Math.abs(parseFloat(actionStyle.paddingBottom) - 8) <= 0.5 &&
                Math.abs(bounds.height - intrinsicHeight) <= 1.5 &&
                copy.scrollWidth - copy.clientWidth <= 1;
              if (valid)
                requestActionShapes.set(action, {
                  height: intrinsicHeight,
                  fullWidth: true,
                  radii: ["0px", "0px", "10px", "10px"],
                });
            }
            if (!valid)
              failures.push(
                "Invalid R2f D10 two-line new-item action composition",
              );
          }
        }
      }
      for (const action of document.querySelectorAll(
        "button.request-search-new",
      ))
        if (visible(action) && !requestActionShapes.has(action))
          failures.push(
            "R2f D10 new-item action outside validated request composition",
          );

      // R0's 44px Lookup rows belong to the real search/detail composition.
      // A copied row class or a button with a different product name cannot
      // obtain this contract on another page or in an unrelated fragment.
      const lookupRowControls = new Set();
      const lookupWideActions = new Set();
      const lookupCompactActions = new Set();
      const lookupRoots = [
        ...document.querySelectorAll("main#main-content > .lookup-page"),
      ];
      const lookupRoot = lookupRoots.length === 1 ? lookupRoots[0] : null;
      const lookupHero = lookupRoot?.querySelector(":scope > .lookup-hero");
      const lookupSearch = lookupHero?.querySelector(
        ":scope > .lookup-search-pill > input.lookup-search[type='search'][role='combobox'][aria-autocomplete='list']",
      );
      const lookupResults = lookupSearch?.getAttribute("aria-controls");
      const lookupHint = lookupSearch?.getAttribute("aria-describedby");
      const lookupPricing = lookupHero?.querySelector(
        ":scope > .lookup-filterbar > .lookup-filters-row > .lookup-pricing-filters",
      );
      const lookupChips = [
        ...(lookupPricing?.querySelectorAll(
          ":scope > button.filter-chip[data-ui-component='filter-chip'][aria-pressed]",
        ) ?? []),
      ];
      const lookupFilterTrigger = lookupHero?.querySelector(
        ":scope > .lookup-filterbar > .lookup-filters-row > button.lookup-filters-trigger[aria-haspopup='dialog'][aria-controls][aria-expanded]",
      );
      const genuineLookup = Boolean(
        window.location.hash.split("?")[0] === "#lookup" &&
        ["Cashier lookup", "جست‌وجوی صندوق‌دار"].includes(
          tidy(
            lookupRoot?.querySelector(":scope > .page-header h1")?.textContent,
          ),
        ) &&
        lookupSearch?.id &&
        lookupHero?.querySelector(`label[for='${lookupSearch.id}']`) &&
        lookupResults &&
        (lookupSearch.getAttribute("aria-expanded") === "false" ||
          lookupRoot?.querySelector(
            `.lookup-results-card > .lookup-results-list[role='listbox'][id='${lookupResults}']`,
          )) &&
        lookupHint &&
        lookupHero?.querySelector(
          `.lookup-keyboard-hint[id='${lookupHint}']`,
        ) &&
        lookupFilterTrigger &&
        ["Filters", "فیلترها"].includes(
          lookupFilterTrigger.getAttribute("aria-label"),
        ) &&
        lookupFilterTrigger.querySelector(
          ":scope > svg.lucide-sliders-horizontal",
        ) &&
        lookupFilterTrigger.querySelector(":scope > .lookup-filters-label") &&
        lookupChips.length === 6 &&
        lookupChips.every(
          (chip) =>
            chip.matches("[data-ui-component='filter-chip'][aria-pressed]") &&
            tidy(chip.textContent) &&
            !chip.querySelector("svg, .filter-chip-check"),
        ),
      );
      if (genuineLookup) {
        lookupRowControls.add(lookupFilterTrigger);
        const activeLine = lookupHero.querySelector(
          ":scope > .lookup-filterbar > .lookup-active-filters[aria-live='polite']",
        );
        const clear = activeLine?.querySelector(
          ":scope > button.ui-button.button-plain",
        );
        if (
          clear &&
          ["Clear filters", "پاک کردن فیلترها"].includes(
            tidy(clear.textContent),
          ) &&
          !clear.querySelector("svg") &&
          activeLine.children.length <= 2
        )
          lookupCompactActions.add(clear);

        const detail = lookupRoot.querySelector(":scope > .lookup-detail");
        const heading = detail?.querySelector(":scope > .lookup-detail-header");
        const actions = heading?.querySelector(
          ":scope > .product-header-actions.ui-control-row",
        );
        const names = [
          ...(heading?.querySelectorAll(
            ":scope > div:first-child > h2, :scope > div:first-child > p[lang]",
          ) ?? []),
        ];
        const normalizeName = (value) =>
          tidy(value)
            .replace(/کیلوگرم/g, "kg")
            .replace(/گرم/g, "g")
            .replace(/پوند/g, "lb")
            .replace(/اونس/g, "oz")
            .replace(/\s+/g, "")
            .toLowerCase();
        const code = tidy(
          heading?.querySelector(".lookup-product-meta > span:first-child bdi")
            ?.textContent,
        );
        const actionButtons = [
          ...(actions?.querySelectorAll(
            ":scope > button:not(.ui-icon-button)",
          ) ?? []),
        ];
        const captions = actionButtons.map((action) =>
          tidy(action.textContent),
        );
        const validAction = (action) => {
          const text = tidy(action.textContent);
          if (["Edit", "ویرایش"].includes(text)) {
            const editName = action
              .getAttribute("aria-label")
              ?.replace(/^(Edit |ویرایش )/, "");
            return (
              editName &&
              names.some(
                (name) =>
                  normalizeName(name.textContent) === normalizeName(editName),
              )
            );
          }
          return [
            "Change price",
            "تغییر قیمت",
            "Change sale",
            "تغییر حراج",
            "Request a sale",
            "درخواست حراج",
            "Package sizes",
            "اندازه بسته‌ها",
          ].includes(text);
        };
        if (
          actions &&
          code &&
          names.length &&
          actionButtons.length <= 3 &&
          new Set(captions).size === captions.length &&
          actionButtons.every(validAction)
        ) {
          for (const control of actionButtons) lookupRowControls.add(control);
          if (document.documentElement.clientWidth <= 760) {
            const menus = actions.querySelectorAll(
              ":scope > button.ui-icon-button[aria-haspopup='menu']",
            );
            const menu = menus.length === 1 ? menus[0] : null;
            const menuBox = menu?.getBoundingClientRect();
            const rowBox = actions.getBoundingClientRect();
            const rowStyle = getComputedStyle(actions);
            const rtl = rowStyle.direction === "rtl";
            const direction = rtl ? -1 : 1;
            const start = rtl
              ? rowBox.right -
                parseFloat(rowStyle.paddingRight) -
                parseFloat(rowStyle.borderRightWidth)
              : rowBox.left +
                parseFloat(rowStyle.paddingLeft) +
                parseFloat(rowStyle.borderLeftWidth);
            const end = rtl
              ? rowBox.left +
                parseFloat(rowStyle.paddingLeft) +
                parseFloat(rowStyle.borderLeftWidth)
              : rowBox.right -
                parseFloat(rowStyle.paddingRight) -
                parseFloat(rowStyle.borderRightWidth);
            const rowGap = parseFloat(rowStyle.columnGap) || 0;
            const centre = (rowBox.top + rowBox.bottom) / 2;
            const validMore = Boolean(
              menuBox &&
              ["Product actions", "اقدامات کالا"].includes(
                menu.getAttribute("aria-label"),
              ) &&
              Math.abs(menuBox.width - 44) <= 1 &&
              Math.abs(menuBox.height - 44) <= 1 &&
              Math.abs((rtl ? menuBox.left : menuBox.right) - end) <= 1.5 &&
              Math.abs((menuBox.top + menuBox.bottom) / 2 - centre) <= 1.5,
            );
            // No text action is a real Cashier composition. Its More control
            // still has an exact size/end edge; empty space need not be filled.
            const expectedWidth = actionButtons.length
              ? (Math.abs(end - start) - 44 - rowGap * actionButtons.length) /
                actionButtons.length
              : null;
            const validTextActions =
              actionButtons.length <= 2 &&
              (actionButtons.length === 0 ||
                (Math.abs(rowGap - 8) <= 1 &&
                  expectedWidth > 0 &&
                  actionButtons.every((control, index) => {
                    const box = control.getBoundingClientRect();
                    return (
                      Math.abs(box.width - expectedWidth) <= 1.5 &&
                      Math.abs(box.height - 44) <= 1 &&
                      Math.abs(
                        (rtl ? box.right : box.left) -
                          (start +
                            direction * index * (expectedWidth + rowGap)),
                      ) <= 1.5 &&
                      Math.abs((box.top + box.bottom) / 2 - centre) <= 1.5
                    );
                  })));
            if (!validMore || !validTextActions)
              failures.push(
                `Lookup phone action row: ${actionButtons.length === 0 ? "More must be 44px at the inner end edge" : "real actions must equally fill the row beside a 44px More control"}`,
              );
            else
              for (const control of actionButtons)
                lookupWideActions.add(control);
          }
        }
      }
      for (const control of document.querySelectorAll(
        ".lookup-category-chips.ui-control-row > button, .product-header-actions.ui-control-row > button:not(.ui-icon-button)",
      ))
        if (visible(control) && !lookupRowControls.has(control))
          failures.push(
            `Lookup 44px row outside validated search/product composition: ${tidy(control.getAttribute("aria-label") || control.textContent)}`,
          );

      // R2g B2 grants the approved 52px two-line tiles only inside the actual
      // price-change form. A copied class, missing price label or extra tile
      // never gains a control-shape exemption.
      const r2gPriceShapes = new Map();
      const priceDialogs = [
        ...document.querySelectorAll("dialog.change-price-dialog[open]"),
      ];
      if (priceDialogs.length === 1) {
        const dialog = priceDialogs[0];
        const form = dialog.querySelector(
          ":scope > form.change-price-form[novalidate]",
        );
        const content = form?.querySelector(
          ":scope > .change-price-body > .change-price-content",
        );
        const pricing = content?.querySelector(
          ":scope > .change-price-pricing",
        );
        const input = pricing?.querySelector(
          ".change-price-price-row > .change-price-amount-field > .change-price-money > input.ui-input.ui-number[type='text'][inputmode='decimal']",
        );
        const label = pricing?.querySelector(
          ".change-price-amount-field > label",
        );
        const picks = pricing?.querySelector(
          ".change-price-price-row > .change-price-quick-picks[role='group']",
        );
        const tiles = [...(picks?.querySelectorAll(":scope > button") ?? [])];
        const footer = form?.querySelector(":scope > .ui-dialog-actions");
        const footerButtons = [
          ...(footer?.querySelectorAll(":scope > button") ?? []),
        ];
        const fa = document.documentElement.lang.startsWith("fa");
        const title = tidy(
          dialog.querySelector(":scope > .ui-dialog-header h2")?.textContent,
        );
        const knownTitles = fa
          ? ["تغییر قیمت", "تغییر حراج", "درخواست حراج"]
          : ["Change price", "Change sale", "Request a sale"];
        const genuine = Boolean(
          form &&
          content &&
          input?.id &&
          label?.htmlFor === input.id &&
          input.getAttribute("aria-labelledby") === label.id &&
          knownTitles.includes(title) &&
          dialog.querySelector(
            ":scope > .dialog-description .selling-price-current",
          ) &&
          picks?.getAttribute("aria-label") ===
            (fa ? "انتخاب سریع" : "Quick picks") &&
          footerButtons.length === 2 &&
          footerButtons[0].type === "button" &&
          tidy(footerButtons[0].textContent) === (fa ? "انصراف" : "Cancel") &&
          footerButtons[1].type === "submit" &&
          input.closest("dialog") === dialog &&
          picks.closest("dialog") === dialog &&
          tiles.every((tile) => {
            const caption = tile.getAttribute("aria-label") || "";
            const match = caption.match(/^(\d+(?:\.\d+)?)% (?:off|تخفیف)$/);
            return Boolean(
              match &&
              tile.matches(
                "button.ui-button.button.button-neutral.button-sm[data-control-kind='action'][aria-pressed]",
              ) &&
              tile.type === "button" &&
              tidy(tile.textContent).startsWith(`${match[1]}%`) &&
              ((tile.querySelector(":scope > bdi[dir='ltr']") &&
                /\d/.test(
                  tile.querySelector(":scope > bdi[dir='ltr']").textContent,
                )) ||
                (tile.disabled &&
                  tile.title ===
                    (fa
                      ? "با رقم‌های پایانی تنظیم‌شده، قیمت پایین‌تری موجود نیست."
                      : "No lower price is available with the configured price endings."))) &&
              !tile.querySelector("button,a,input"),
            );
          }),
        );
        if (genuine) {
          if (Math.abs(input.getBoundingClientRect().height - 52) > 1)
            failures.push("R2g price entry must be 52px");
          const currency = input.parentElement.querySelector(
            ":scope > span[aria-hidden='true']",
          );
          const inputStyle = getComputedStyle(input);
          const textStart =
            input.getBoundingClientRect().left +
            parseFloat(inputStyle.borderLeftWidth) +
            parseFloat(inputStyle.paddingLeft);
          if (
            !currency ||
            inputStyle.direction !== "ltr" ||
            textStart < currency.getBoundingClientRect().right + 2
          )
            failures.push("R2g currency adornment must not overlap price text");
          const boxes = tiles.map((tile) => tile.getBoundingClientRect());
          for (const [index, tile] of tiles.entries()) {
            const rect = boxes[index];
            if (
              Math.abs(rect.top - boxes[0].top) > 1.5 ||
              Math.abs(rect.width - boxes[0].width) > 1.5
            )
              failures.push(
                "R2g price quick picks must share one level equal-width row",
              );
            const style = getComputedStyle(tile);
            const selected = tile.getAttribute("aria-pressed") === "true";
            const border = canonicalColor(
              style
                .getPropertyValue(
                  selected ? "--klead-accent" : "--klead-field-border",
                )
                .trim(),
            );
            if (
              ["Top", "Right", "Bottom", "Left"].some(
                (side) =>
                  Math.abs(parseFloat(style[`border${side}Width`]) - 1) >
                    0.01 ||
                  style[`border${side}Style`] !== "solid" ||
                  canonicalColor(style[`border${side}Color`]) !== border,
              )
            )
              failures.push(
                "R2g price quick picks need their 1px field/accent border",
              );
            r2gPriceShapes.set(tile, {
              height: 52,
              radii: ["12px", "12px", "12px", "12px"],
              fullWidth: true,
            });
          }
          for (const segments of content.querySelectorAll(
            ".change-price-when .ui-segments",
          )) {
            if (Math.abs(segments.getBoundingClientRect().height - 44) > 1)
              failures.push("R2g price date/store segments must be 44px");
          }
        } else failures.push("Invalid R2g price-change composition");
      }
      for (const tile of document.querySelectorAll(
        ".change-price-quick-picks > button",
      ))
        if (visible(tile) && !r2gPriceShapes.has(tile))
          failures.push("R2g price quick pick outside the validated form");

      // R2g A7: only an actual named page header owns this full-row slot.
      // Its parent row must fill the header too, catching the original 3/4 gap.
      const phonePagePrimaryWidths = new Map();
      if (phone) {
        for (const header of document.querySelectorAll(
          "main#main-content [data-ui-component='page-header']",
        )) {
          if (!visible(header) || header.closest("dialog, .ui-card")) continue;
          const heading = header.querySelector(":scope > div > h1");
          const actions = header.querySelector(":scope > .actions");
          const primary = actions?.querySelectorAll(
            ":scope > .ui-button.button-primary[data-control-kind='action']",
          );
          if (!tidy(heading?.textContent) || !actions || primary?.length !== 1)
            continue;
          const control = primary[0];
          const expected = contentBounds(header).width;
          const controlBounds = control.getBoundingClientRect();
          const actionBounds = actions.getBoundingClientRect();
          phonePagePrimaryWidths.set(control, expected);
          if (
            Math.abs(actionBounds.width - expected) > 1.5 ||
            Math.abs(controlBounds.width - expected) > 1.5 ||
            Math.abs(controlBounds.left - actionBounds.left) > 1.5 ||
            Math.abs(controlBounds.right - actionBounds.right) > 1.5
          )
            failures.push(
              `Phone page primary must fill its complete row: ${tidy(control.textContent)}`,
            );
        }
      }

      // R2g A5: only a real managed, named native dialog footer receives
      // the phone fill contract. Its slot edges are measured, not waived.
      const phoneDialogFooterWidths = new Map();
      if (phone) {
        for (const dialog of document.querySelectorAll(
          "dialog[open].ui-dialog[data-dialog-feedback-scope]",
        )) {
          if (!visible(dialog)) continue;
          const header = dialog.querySelector(":scope > .ui-dialog-header");
          const title = header?.querySelector("h2");
          const titleId = dialog.getAttribute("aria-labelledby");
          const named = Boolean(
            title &&
            tidy(title.textContent) &&
            (tidy(dialog.getAttribute("aria-label")) ||
              (titleId && document.getElementById(titleId) === title)),
          );
          const close = header?.querySelector(
            "button.ui-icon-button[data-control-kind='icon']",
          );
          // These retained read-only dialogs put their actual final action
          // footer inside one direct body wrapper. Qualify each complete
          // composition; a copied footer class or arbitrary body action is
          // still subject to the ordinary intrinsic-width contract.
          const historyDialog = dialog.matches(".supplier-item-history-dialog");
          const policyDialog = dialog.matches(".return-policy-dialog");
          const nestedBody = dialog.querySelector(
            historyDialog
              ? ":scope > .stack"
              : ":scope > .return-policy-content",
          );
          const nestedFooter = nestedBody?.querySelector(
            ":scope > .ui-dialog-actions:last-child",
          );
          const nestedActions = [
            ...(nestedFooter?.querySelectorAll(":scope > button") ?? []),
          ];
          const exactNestedAction = (button, caption, variant) =>
            button?.matches(
              `button.ui-button.button.button-${variant}[data-control-kind='action'][type='button']`,
            ) && caption.includes(tidy(button.textContent));
          const validNestedFooter = Boolean(
            nestedBody &&
            nestedFooter &&
            !nestedBody.querySelector(
              "input,textarea,select,[role='combobox'],form",
            ) &&
            nestedBody.querySelectorAll(".ui-dialog-actions").length === 1 &&
            (historyDialog
              ? ["Price history", "تاریخچه قیمت"].includes(
                  tidy(title?.textContent),
                ) &&
                nestedActions.length === 1 &&
                exactNestedAction(
                  nestedActions[0],
                  ["Close", "بستن"],
                  "neutral",
                ) &&
                ["Before tax", "پیش از مالیات"].includes(
                  tidy(
                    nestedBody.querySelector(":scope > p.muted")?.textContent,
                  ),
                ) &&
                nestedBody.querySelector(
                  ".supplier-item-price-history table, .empty-state",
                )
              : policyDialog &&
                ["Return policy", "سیاست مرجوعی"].includes(
                  tidy(title?.textContent),
                ) &&
                nestedActions.length === 2 &&
                exactNestedAction(
                  nestedActions[0],
                  ["Close", "بستن"],
                  "neutral",
                ) &&
                exactNestedAction(
                  nestedActions[1],
                  ["Download full policy", "دانلود سیاست کامل"],
                  "tinted",
                ) &&
                nestedBody.querySelectorAll(":scope > ol > li").length === 5 &&
                [...nestedBody.querySelectorAll(":scope > ol > li")].every(
                  (item) =>
                    item.querySelector(":scope > strong") &&
                    item.querySelector(":scope > p"),
                )),
          );
          if ((historyDialog || policyDialog) && !validNestedFooter)
            failures.push(
              "Invalid retained read-only dialog footer composition",
            );
          const footer =
            [
              ...dialog.querySelectorAll(
                ".ui-dialog-actions, .dialog-actions, .c3-dialog-actions, .product-editor-actions",
              ),
            ].find(
              (node) =>
                node.closest("dialog") === dialog &&
                (node.parentElement === dialog ||
                  node.parentElement?.matches("form")),
            ) ?? (validNestedFooter ? nestedFooter : null);
          const actions = [
            ...(footer?.querySelectorAll(
              ":scope > button.ui-button.button:not(.ui-icon-button)",
            ) ?? []),
          ].filter(visible);
          const valid =
            named &&
            close &&
            ["Close dialog", "بستن پنجره"].includes(
              tidy(close.getAttribute("aria-label")),
            ) &&
            close.querySelector("svg.lucide-x") &&
            footer &&
            actions.length > 0 &&
            actions.every(
              (button) =>
                button.getAttribute("data-control-kind") === "action" &&
                tidy(button.textContent),
            );
          if (!valid) continue;
          const bounds = dialog.getBoundingClientRect();
          if (
            Math.abs(bounds.width - document.documentElement.clientWidth) >
              1.5 ||
            Math.abs(bounds.bottom - window.innerHeight) > 1.5
          )
            failures.push(
              "Phone dialog must fill the viewport edge as a bottom sheet",
            );
          const content = contentBounds(footer);
          const gap = parseFloat(getComputedStyle(footer).columnGap) || 0;
          const feedback = footer.querySelector(
            ":scope > [data-dialog-feedback-host]",
          );
          const ownedFeedback = Boolean(feedback?.childElementCount);
          if (
            ownedFeedback &&
            Math.abs(feedback.getBoundingClientRect().width - content.width) >
              1.5
          )
            failures.push("Owned dialog feedback must span its own full row");
          const expected =
            (content.width - gap * (actions.length - 1)) / actions.length;
          for (const action of actions) {
            phoneDialogFooterWidths.set(action, expected);
            if (Math.abs(action.getBoundingClientRect().width - expected) > 1.5)
              failures.push(
                `Phone dialog footer must fill its action slot: ${tidy(action.textContent)}`,
              );
          }
          const boxes = actions.map((action) => action.getBoundingClientRect());
          if (
            Math.max(...boxes.map((box) => box.y + box.height / 2)) -
              Math.min(...boxes.map((box) => box.y + box.height / 2)) >
            1.5
          )
            failures.push("Phone dialog footer actions must share one row");
          const left = Math.min(...boxes.map((box) => box.left));
          const right = Math.max(...boxes.map((box) => box.right));
          if (
            Math.abs(left - content.left) > 1.5 ||
            Math.abs(right - content.right) > 1.5
          )
            failures.push(
              "Phone dialog footer actions must meet the inner edges",
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
        let intrinsicWidth =
          textWidth +
          icons +
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth) +
          gaps;
        if (genuineLookup && element === lookupFilterTrigger) {
          const badge = element.querySelector(":scope > .tab-count");
          const badgeBox = badge?.getBoundingClientRect();
          const hiddenBadge =
            badge && getComputedStyle(badge).visibility === "hidden";
          if (
            !badge ||
            !badgeBox ||
            Math.abs(badgeBox.width - 20) > 1 ||
            Math.abs(badgeBox.height - 20) > 1 ||
            !/^[012]$/.test(tidy(badge.textContent)) ||
            hiddenBadge !== (tidy(badge.textContent) === "0")
          )
            failures.push(
              "Lookup filter count must retain its real 20px active-count slot",
            );
          if (badge && badgeBox) {
            const text = document.createRange();
            text.selectNodeContents(badge);
            const painted = hiddenBadge
              ? 0
              : text.getBoundingClientRect().width;
            intrinsicWidth +=
              Math.min(20, badgeBox.width) -
              painted +
              (hiddenBadge ? parseFloat(style.columnGap) || 0 : 0);
          }
        }
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
          const requestShape = requestActionShapes.get(element);
          const authenticationShape = authenticationShapes.get(element);
          const r2gPriceShape = r2gPriceShapes.get(element);
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
          const sharedFilterChip = Boolean(
            element.matches(
              "button.filter-chip[data-ui-component='filter-chip'][aria-pressed]",
            ) &&
            tidy(element.textContent) &&
            !element.querySelector("svg, .filter-chip-check"),
          );
          const toolbar = element.closest(
            ".filter-toolbar.c9-filter-toolbar[data-ui-component='filter-toolbar']",
          );
          const genuineFilterToolbar = Boolean(
            toolbar &&
            toolbar.firstElementChild?.matches(".filter-toolbar-controls") &&
            toolbar.children.length <= 2 &&
            (toolbar.children.length === 1 ||
              toolbar.lastElementChild?.matches(".filter-toolbar-trailing")) &&
            element.closest("dialog") === toolbar.closest("dialog"),
          );
          const modalFooterFeedback = Boolean(
            element.matches(
              "dialog[open] .ui-dialog-actions > .dialog-action-feedback-host > .dialog-action-feedback[role='status'] > .dialog-action-status > button.dialog-action-undo",
            ) &&
            ["Undo", "واگرد"].includes(tidy(element.textContent)) &&
            element.parentElement?.querySelectorAll(":scope > button")
              .length === 1,
          );
          const expectedHeight =
            authenticationShape?.height ??
            r2gPriceShape?.height ??
            requestShape?.height ??
            (lookupCompactActions.has(element)
              ? 22
              : labelAction
                ? 32
                : r2fOriginalHeaderActions.has(element)
                  ? 32
                  : r2fApprovalActions.has(element)
                    ? phone
                      ? 44
                      : 40
                    : newReturnControl ||
                        r2fAddLineControls.has(element) ||
                        r2cControl ||
                        dashboardAction ||
                        structuredFooter ||
                        approvalDecisionButtons.has(element) ||
                        approvalEditorFooters.has(element) ||
                        notificationHeaderActions.has(element) ||
                        modalFooterFeedback ||
                        lookupRowControls.has(element) ||
                        sharedFilterChip
                      ? 44
                      : genuineFilterToolbar
                        ? element.closest(".ui-segments")
                          ? 36
                          : 44
                        : phone || fieldAlignedAdd
                          ? 44
                          : small
                            ? 32
                            : 40);
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
          } else if (
            entry.radii.some(
              (radius, index) =>
                radius !==
                (authenticationShape?.radii?.[index] ??
                  r2gPriceShape?.radii?.[index] ??
                  requestShape?.radii?.[index] ??
                  expectedRadius),
            )
          )
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
            !r2gPriceShape &&
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
            !lookupWideActions.has(element) &&
            !phoneReceivingWidths.has(element) &&
            !phoneDialogFooterWidths.has(element) &&
            !phonePagePrimaryWidths.has(element) &&
            !r2fApprovalWidths.has(element) &&
            !dashboardWideActions.has(element) &&
            !authenticationShape?.fullWidth &&
            !requestShape?.fullWidth &&
            !r2gPriceShape?.fullWidth &&
            rect.width > Math.max(40, intrinsicWidth) + 5
          )
            failures.push(
              `${row ? "Table action" : "Text action"} stretched: ${label} (${round(rect.width)} > ${round(intrinsicWidth)})`,
            );
        }
      }
      // D8 uses four genuine retained-record regions, with its one record
      // chevron in the final region. Bind the source slots and public links to
      // canonical record provenance; copied classes cannot obtain this contract.
      const returnsRoots = [
        ...document.querySelectorAll("main#main-content > .returns-overview"),
      ];
      const returnsRoot = returnsRoots.length === 1 ? returnsRoots[0] : null;
      const returnsTable = returnsRoot?.querySelector(
        ":scope > .returns-overview-table > table",
      );
      const returnsToolbar = returnsRoot?.querySelector(
        ":scope > .returns-toolbar[data-ui-component='filter-toolbar']",
      );
      const faReturns = document.documentElement.lang.startsWith("fa");
      const genuineReturns = Boolean(
        window.location.hash.split("?")[0] === "#returns" &&
        returnsRoot &&
        returnsTable &&
        returnsToolbar &&
        tidy(
          document.querySelector("main#main-content > .page-header h1")
            ?.textContent,
        ) === (faReturns ? "مرجوعی‌ها" : "Returns") &&
        returnsToolbar.getAttribute("aria-label") ===
          (faReturns ? "فیلتر مرجوعی‌ها" : "Filter returns") &&
        returnsToolbar.querySelector(
          `:scope > .filter-toolbar-controls > .filter-search-pill > input[aria-label='${faReturns ? "جستجوی مرجوعی‌ها" : "Search returns"}']`,
        ) &&
        returnsToolbar.querySelector(
          `:scope > .filter-toolbar-controls > .ui-segments.ui-tabs[role='tablist'][aria-label='${faReturns ? "نمایش مرجوعی‌ها" : "Returns view"}']`,
        ) &&
        returnsToolbar.querySelector(
          `:scope > .filter-toolbar-controls > .ui-select[aria-label='${faReturns ? "تأمین‌کننده" : "Supplier"}']`,
        ) &&
        returnsToolbar.querySelector(
          `:scope > .filter-toolbar-controls > .ui-select[aria-label='${faReturns ? "وضعیت" : "Status"}']`,
        ) &&
        returnsTable.querySelector('thead th[data-column-key="reference"]') &&
        returnsTable.querySelector('thead th[data-column-key="items"]'),
      );
      const richReturn = (row) => {
        const expected = expectedReturns.find(
          (item) =>
            row.getAttribute("data-row-href") ===
            `#return?id=${encodeURIComponent(item.id)}`,
        );
        const slots = [
          "return-phone-header",
          "return-phone-items",
          "return-phone-meta",
          "return-phone-next",
        ];
        if (
          !genuineReturns ||
          row.closest("table") !== returnsTable ||
          !expected ||
          !row.matches(".returns-clickable-row.phone-list-row") ||
          row.children.length !== 4 ||
          !slots.every(
            (slot, index) =>
              row.children[index].matches(`td.${slot}`) &&
              visible(row.children[index]),
          )
        )
          return false;
        const href = row.getAttribute("data-row-href");
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
        const meta = row.querySelector(".return-phone-meta");
        const next = row.querySelector(".return-phone-next");
        const links = [...next.querySelectorAll(".table-row-link")];
        const credit = returnsTable.querySelector(
          'thead th[data-column-key="credit"]',
        );
        return Boolean(
          reference &&
          supplier &&
          visible(reference) &&
          visible(supplier) &&
          reference.getAttribute("href") === href &&
          supplier.getAttribute("href") === href &&
          tidy(reference.textContent) === `#${expected.number}` &&
          tidy(supplier.textContent) === tidy(expected.supplier) &&
          tidy(
            row.querySelector(".return-phone-status .ui-badge")?.textContent,
          ) &&
          names.length === expected.items.length &&
          names.every((name, index) => {
            const sourceName = tidy(
              faReturns ? expected.items[index].fa : expected.items[index].en,
            );
            const metadata = `× ${expected.items[index].qty}${index === 1 && expected.remaining > 0 ? ` · +${expected.remaining} ${faReturns ? "قلم دیگر" : "more"}` : ""}`;
            const fitted = name.querySelector(
              ":scope > .return-list-item-name.ui-fit-text-intrinsic[title]",
            );
            const quantity = name.querySelector(
              ":scope > .return-list-item-quantity",
            );
            if (
              !fitted ||
              !quantity ||
              name.children.length !== 2 ||
              !visible(fitted) ||
              !visible(quantity) ||
              tidy(fitted.getAttribute("title")) !== sourceName ||
              tidy(quantity.textContent) !== metadata
            )
              return false;
            const shown = tidy(fitted.textContent);
            const truncated = shown.endsWith("…");
            const prefix = shown.replace(/…$/, "").trim();
            if (
              !prefix ||
              (truncated
                ? !sourceName.startsWith(prefix)
                : shown !== sourceName)
            )
              return false;
            const glyphs = (element) => {
              const rects = [];
              const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
              );
              for (
                let node = walker.nextNode();
                node;
                node = walker.nextNode()
              ) {
                if (
                  !node.textContent?.trim() ||
                  !node.parentElement ||
                  !visible(node.parentElement)
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
            const baseline = (element) => {
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
              element.append(marker);
              const y = marker.getBoundingClientRect().top;
              marker.remove();
              return y;
            };
            const titleGlyphs = glyphs(fitted),
              quantityGlyphs = glyphs(quantity);
            if (!titleGlyphs || !quantityGlyphs) return false;
            const nameBox = name.getBoundingClientRect(),
              fittedBox = fitted.getBoundingClientRect(),
              quantityBox = quantity.getBoundingClientRect();
            const rtl = getComputedStyle(name).direction === "rtl";
            const elementGap = rtl
              ? fittedBox.left - quantityBox.right
              : quantityBox.left - fittedBox.right;
            const glyphGap = rtl
              ? titleGlyphs.left - quantityGlyphs.right
              : quantityGlyphs.left - titleGlyphs.right;
            // The reference has one ~4px glyph space. Intrinsic FitText reserves
            // that space internally, so its actual element edge touches quantity.
            // A fitted prefix can leave at most its next character's advance.
            let maximumGlyphGap = 5.5;
            if (truncated) {
              const style = getComputedStyle(fitted),
                context = document.createElement("canvas").getContext("2d");
              if (!context) return false;
              context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
              context.letterSpacing = style.letterSpacing;
              const next =
                sourceName.slice(prefix.length).match(/^\s*\S/u)?.[0] || "";
              maximumGlyphGap += context.measureText(next).width;
            }
            return (
              Math.abs(elementGap) <= 1.5 &&
              glyphGap >= -0.5 &&
              glyphGap <= maximumGlyphGap &&
              (truncated || Math.abs(glyphGap - 4) <= 1.5) &&
              Math.abs(baseline(fitted) - baseline(quantity)) <= 1.5 &&
              [titleGlyphs, quantityGlyphs].every(
                (bounds) =>
                  bounds.left >= nameBox.left - 1 &&
                  bounds.right <= nameBox.right + 1,
              ) &&
              // Range includes the font's ascent/descent beyond its CSS line
              // box. Use actual line boxes for vertical containment; the real
              // inline baseline markers above still reject a moved quantity.
              [fittedBox, quantityBox].every(
                (bounds) =>
                  bounds.top >= nameBox.top - 1 &&
                  bounds.bottom <= nameBox.bottom + 1,
              )
            );
          }) &&
          tidy(
            row.querySelector(".return-phone-items .return-list-items > small")
              ?.textContent,
          ) &&
          meta.children.length === 2 &&
          tidy(meta.children[0].querySelector(".date-text")?.textContent) &&
          (credit
            ? Boolean(tidy(meta.children[1].textContent))
            : !tidy(meta.children[1].textContent)) &&
          tidy(
            next.querySelector(".actions > [data-action-fact]")?.textContent,
          ) &&
          links.length === 1 &&
          visible(links[0]) &&
          links[0].getAttribute("href") === href &&
          !row.querySelector(".table-details-toggle"),
        );
      };
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
          const returnCandidate = Boolean(
            row.closest(".returns-overview-table"),
          );
          const returnCard = returnCandidate && richReturn(row);
          if (returnCandidate && !returnCard)
            failures.push("Invalid retained Returns phone composition");
          const chevronCells = cells.filter((cell) =>
            cell.matches(
              returnCard ? ".return-phone-next" : ".phone-list-chevron",
            ),
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
            const returnAction = returnCard
              ? chevronCell
                  .querySelector("[data-action-fact]")
                  ?.getBoundingClientRect()
              : null;
            const returnOverlap =
              returnCard &&
              (cells.some((cell) => {
                const box = cell.getBoundingClientRect();
                return (
                  box.left < bounds.left - 1 || box.right > bounds.right + 1
                );
              }) ||
                !returnAction ||
                (rtl
                  ? returnAction.left < rect.right - 1
                  : returnAction.right > rect.left + 1));
            if (
              returnOverlap ||
              control.closest("td") !== chevronCell ||
              control.querySelectorAll("svg").length !== 1 ||
              Math.abs((rtl ? rect.left : rect.right) - end) > 2 ||
              rect.top < bounds.top - 1 ||
              rect.bottom > bounds.bottom + 1 ||
              cells.some((cell) => {
                if (cell === chevronCell || returnCard) return false;
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
        const returnsCount =
          genuineReturns &&
          document.documentElement.clientWidth < 760 &&
          wrapper ===
            returnsToolbar.querySelector(
              ":scope > .filter-toolbar-trailing > .filter-count",
            ) &&
          group ===
            wrapper.querySelector(
              ":scope > .returns-toolbar-end.filter-toolbar-end",
            ) &&
          group.children.length === 3 &&
          count.matches("span[aria-live='polite']") &&
          group.children[1] === columns &&
          group.children[2].matches("dialog.ui-dialog.c3-column-dialog") &&
          group.children[2].querySelector(
            ".c3-column-options [role='checkbox']",
          ) &&
          columns.matches("button.ui-button.button-neutral") &&
          columns.querySelector(
            ":scope > svg.lucide-columns-3[aria-hidden='true']",
          ) &&
          /^\d+ (results?|نتیجه)$/.test(tidy(count.textContent)) &&
          Number(tidy(count.textContent).split(" ")[0]) ===
            returnsTable.querySelectorAll("tbody > tr:not(.table-expanded-row)")
              .length;
        const groupBox = group.getBoundingClientRect();
        const toolbarBox = returnsToolbar?.getBoundingClientRect();
        const edgeError = returnsCount
          ? Math.max(
              Math.abs(
                (direction === "rtl" ? text.right : text.left) -
                  (direction === "rtl" ? groupBox.right : groupBox.left),
              ),
              Math.abs(
                (direction === "rtl" ? control.left : control.right) -
                  (direction === "rtl" ? groupBox.left : groupBox.right),
              ),
              Math.abs(groupBox.left - toolbarBox.left),
              Math.abs(groupBox.right - toolbarBox.right),
            )
          : 0;
        if (
          gap < -0.5 ||
          (!returnsCount && gap > 16.5) ||
          centerDifference > 1 ||
          edgeError > 2
        )
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
          // The approved Dashboard Type chips describe the approval kind,
          // not its status. Require the real column and composed screen;
          // copied classes or a badge placed in another cell retain the
          // ordinary desktop Status dot/fill contract.
          const typeCell = element.closest('td[data-column-key="type"]');
          const typeTable = typeCell?.closest(".dashboard-approval-table");
          const dashboardType = Boolean(
            typeCell?.parentElement?.matches(".dashboard-queue-row") &&
            typeTable &&
            dashboardRoots.has(typeTable.closest(".r2c-dashboard")) &&
            ["Type", "نوع"].includes(
              tidy(
                typeTable.querySelector(
                  ':scope > table > thead > tr > th[data-column-key="type"]',
                )?.textContent,
              ),
            ) &&
            typeCell.dataset.columnLabel ===
              tidy(
                typeTable.querySelector(
                  ':scope > table > thead > tr > th[data-column-key="type"]',
                )?.textContent,
              ),
          );
          const tableStatus = Boolean(
            element.closest(".ui-data-table:not(.is-mobile)") && !dashboardType,
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
        for (const name of area.querySelectorAll(
          ".receiving-table .invoice-line-toggle > .receiving-product-name",
        )) {
          if (!visible(name)) continue;
          const title = tidy(name.getAttribute("title"));
          const prefix = tidy(name.textContent);
          const toggle = name.parentElement;
          const count = tidy(
            name
              .closest(".receiving-product-cell")
              ?.querySelector(".receiving-line-check-count")?.textContent,
          );
          if (
            !title ||
            !prefix ||
            prefix !== title ||
            tidy(toggle.getAttribute("aria-label")) !==
              [title, count].filter(Boolean).join(" ")
          )
            failures.push(
              `Receiving full product title is missing or inconsistent: ${prefix}`,
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
    { screen, variant, role, expectedReturns },
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
