import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Locator, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import {
  chooseOption,
  setBranch,
  setLanguage,
  signIn,
  visitPage,
} from "./helpers";

test.setTimeout(60000);

async function snapshot(page: Page) {
  return readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
}

async function checkAlignment(table: Locator) {
  await table.page().evaluate(() => document.fonts.ready);
  const geometry = await table.evaluate((node) => {
    const headers = [...node.querySelectorAll<HTMLElement>("thead th")];
    const rows = [
      ...node.querySelectorAll<HTMLElement>(
        "tbody > tr:not(.table-expanded-row)",
      ),
    ];
    const wrapper = node.closest<HTMLElement>(".ui-data-table")!;
    const identity = (cell: HTMLElement) =>
      cell.dataset.columnKey
        ? `key:${cell.dataset.columnKey}`
        : `label:${cell.dataset.columnLabel}`;
    const headerMap = new Map(
      headers.map((header) => [identity(header), header]),
    );
    const cards = wrapper.classList.contains("is-mobile");
    const tableBox = node.getBoundingClientRect();
    const wrapperBox = wrapper.getBoundingClientRect();
    const contains = (outer: DOMRect, inner: DOMRect) =>
      inner.left >= outer.left - 2 &&
      inner.right <= outer.right + 2 &&
      inner.top >= outer.top - 2 &&
      inner.bottom <= outer.bottom + 2;
    const columns = [];
    const cardCells = [];
    for (const row of rows) {
      const rowBox = row.getBoundingClientRect();
      const cells = [
        ...row.querySelectorAll<HTMLElement>(":scope > td, :scope > th"),
      ];
      for (const [index, cell] of cells.entries()) {
        if (!cell.getClientRects().length) continue;
        const body = cell.getBoundingClientRect();
        const bodyStyle = getComputedStyle(cell);
        const header = headerMap.get(identity(cell));
        if (!cards) {
          if (!header?.getClientRects().length) {
            columns.push({ matched: false });
            continue;
          }
          const head = header.getBoundingClientRect();
          const style = getComputedStyle(header);
          columns.push({
            matched: true,
            left: Math.abs(head.left - body.left),
            right: Math.abs(head.right - body.right),
            headerPadding: [style.paddingInlineStart, style.paddingInlineEnd],
            bodyPadding: [
              bodyStyle.paddingInlineStart,
              bodyStyle.paddingInlineEnd,
            ],
            headerAlign: style.textAlign,
            bodyAlign: bodyStyle.textAlign,
          });
          continue;
        }
        const label = cell.dataset.columnLabel ?? "";
        const caption = getComputedStyle(cell, "::before");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        context.font = `${caption.fontWeight} ${caption.fontSize} ${caption.fontFamily}`;
        const widestLabelWord = Math.max(
          0,
          ...label.split(/\s+/).map((word) => context.measureText(word).width),
        );
        const fragments = [];
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        let text: Node | null;
        while ((text = walker.nextNode())) {
          const parent = text.parentElement;
          if (
            !text.textContent?.trim() ||
            !parent?.getClientRects().length ||
            parent.closest(".sr-only,[hidden],[aria-hidden=true]")
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(text);
          fragments.push(...range.getClientRects());
        }
        const controls = [
          ...cell.querySelectorAll<HTMLElement>(
            "button,a,input,[role=combobox],[role=checkbox]",
          ),
        ].filter((control) => control.getClientRects().length);
        // The separate Details cell intentionally renders an icon control.
        // Count its real visible accessible name, while keeping every text
        // fragment, caption and control containment check below.
        const labelledControls = controls.filter((control) => {
          const labelledBy = control.getAttribute("aria-labelledby");
          const name =
            control.getAttribute("aria-label")?.trim() ||
            labelledBy
              ?.split(/\s+/)
              .map(
                (id) => document.getElementById(id)?.textContent?.trim() ?? "",
              )
              .join(" ")
              .trim();
          return (
            Boolean(name) &&
            control.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            })
          );
        });
        const compact = row.matches(".phone-list-row");
        const compactRegion = ["name", "value", "secondary", "chevron"].find(
          (region) => cell.classList.contains(`phone-list-${region}`),
        );
        const chevron = row.querySelector<HTMLElement>(
          ".phone-list-chevron .table-row-link",
        );
        const rowStyle = getComputedStyle(row);
        const rtl = rowStyle.direction === "rtl";
        const visualEnd = rtl
          ? rowBox.left +
            parseFloat(rowStyle.borderLeftWidth || "0") +
            parseFloat(rowStyle.paddingLeft || "0")
          : rowBox.right -
            parseFloat(rowStyle.borderRightWidth || "0") -
            parseFloat(rowStyle.paddingRight || "0");
        cardCells.push({
          compact,
          compactRegion,
          compactRegionsComplete: [
            "name",
            "value",
            "secondary",
            "chevron",
          ].every(
            (region) =>
              row.querySelectorAll(`:scope > .phone-list-${region}`).length ===
              1,
          ),
          compactRegionValid:
            compactRegion !== undefined &&
            row.querySelectorAll(`:scope > .phone-list-${compactRegion}`)
              .length === 1,
          compactNoCaptions:
            label === "" && ["none", "normal"].includes(caption.content),
          compactGrid: rowStyle.display === "grid",
          compactChevronCount: row.querySelectorAll(
            ".phone-list-chevron .table-row-link",
          ).length,
          compactNoDisclosure:
            row.querySelector(".table-details-toggle") === null,
          compactChevronAtEnd:
            !!chevron &&
            Math.abs(
              (rtl
                ? chevron.getBoundingClientRect().left
                : chevron.getBoundingClientRect().right) - visualEnd,
            ) <= 2,
          label,
          className: cell.className,
          width: body.width,
          widestLabelWord,
          matched: Boolean(header),
          labelled:
            index === 0 ||
            (caption.content.replace(/^["']|["']$/g, "") === label &&
              label.length > 0),
          captionFits: index === 0 || widestLabelWord <= body.width + 2,
          captionBeforeValue:
            index === 0 ||
            [
              ...fragments,
              ...controls.map((control) => control.getBoundingClientRect()),
            ].every(
              (fragment) =>
                fragment.top >=
                body.top + Number.parseFloat(caption.fontSize) - 2,
            ),
          visibleValueFragments: fragments.length,
          visibleLabelledControlValues: labelledControls.length,
          rowContained: contains(tableBox, rowBox),
          cellContained: contains(rowBox, body),
          valuesContained: fragments.every((fragment) =>
            contains(body, fragment),
          ),
          controlsContained: controls.every((control) =>
            contains(body, control.getBoundingClientRect()),
          ),
          noCellOverflow: cell.scrollWidth <= cell.clientWidth + 2,
        });
      }
    }
    return {
      cards,
      visibleRows: rows.length,
      columns,
      cardCells,
      uniqueHeaderIdentities: headerMap.size === headers.length,
      tableContained:
        tableBox.left >= wrapperBox.left - 2 &&
        tableBox.right <= wrapperBox.right + 2,
      noTableOverflow: wrapper.scrollWidth <= wrapper.clientWidth + 2,
      noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 2,
    };
  });
  expect(geometry.visibleRows).toBeGreaterThan(0);
  expect(geometry.uniqueHeaderIdentities).toBe(true);
  expect(geometry.tableContained).toBe(true);
  expect(geometry.noTableOverflow).toBe(true);
  expect(geometry.noPageOverflow).toBe(true);
  if (geometry.cards) {
    expect(geometry.cardCells.length).toBeGreaterThan(0);
    for (const cell of geometry.cardCells) {
      if (cell.compact) {
        // E3's overview uses explicit name/value/secondary/chevron regions.
        // Keep every original visible-glyph/control/2 px containment guard.
        expect(cell.compactRegionsComplete).toBe(true);
        expect(cell.compactRegionValid).toBe(true);
        expect(cell.compactGrid).toBe(true);
        expect(cell.compactNoCaptions).toBe(true);
        expect(cell.compactNoDisclosure).toBe(true);
        expect(cell.compactChevronCount).toBe(1);
        expect(cell.compactChevronAtEnd).toBe(true);
      } else {
        expect(cell.matched).toBe(true);
        expect(cell.labelled).toBe(true);
        expect(cell.captionFits, JSON.stringify(cell)).toBe(true);
        expect(cell.captionBeforeValue).toBe(true);
      }
      expect(
        cell.visibleValueFragments + cell.visibleLabelledControlValues,
      ).toBeGreaterThan(0);
      expect(cell.rowContained).toBe(true);
      expect(cell.cellContained).toBe(true);
      expect(cell.valuesContained).toBe(true);
      expect(cell.controlsContained).toBe(true);
      expect(cell.noCellOverflow).toBe(true);
    }
  } else {
    expect(geometry.columns.length).toBeGreaterThan(0);
    for (const column of geometry.columns) {
      expect(column.matched).toBe(true);
      if (!column.matched) continue;
      expect(column.left).toBeLessThanOrEqual(2);
      expect(column.right).toBeLessThanOrEqual(2);
      expect(column.headerPadding).toEqual(column.bodyPadding);
      expect(column.headerAlign).toBe(column.bodyAlign);
    }
  }
}

test("Returns starts with all suppliers and Open records, and opens each return as its own page", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await visitPage(page, "Returns");
  await expect(page.getByLabel("Supplier", { exact: true })).toHaveText(
    "All suppliers",
  );
  await expect(page.getByLabel("Status", { exact: true })).toHaveText(
    "All statuses",
  );
  await expect(page.getByLabel("Return branch", { exact: true })).toHaveText(
    "All branches",
  );
  const count = await page.locator(".returns-overview-table tbody tr").count();
  expect(count).toBeGreaterThanOrEqual(2);
  await page.getByLabel("Search returns", { exact: true }).fill("Fresh Valley");
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".returns-overview-table tbody")).toContainText(
    "Fresh Valley Foods",
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(
    count,
  );
  await page.getByRole("link", { name: "#1", exact: true }).click();
  await expect(page).toHaveURL(/#return\?id=demo-return-1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Return #1");
  await expect(page.locator(".return-detail-subtitle")).toContainText(
    "created",
  );
  const returnAuthor = demoSeed.demo_users.find(
    (user) => user.id === "demo-person-ny-floor",
  );
  expect(returnAuthor, "The seeded North York worker must exist").toBeDefined();
  await expect(page.locator(".return-detail-subtitle")).toContainText(
    returnAuthor!.name_en,
  );
  await expect(page.locator(".return-detail-subtitle")).not.toContainText("—");
  await expect(
    page
      .locator(".return-header-card")
      .getByRole("button", { name: "Record pickup", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".return-lines-card")).toContainText(
    "Sour Cherry Juice 1 L",
  );
  await expect(
    page
      .locator(".return-evidence-card")
      .getByRole("heading", { name: "Evidence and history", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".returns-overview-table")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Back to Returns", exact: true })
    .click();
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(
    count,
  );
});

test("Return policy dialog centers, closes with Escape and backdrop, and restores trigger focus", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-1");
  const trigger = page.getByRole("button", {
    name: "Return policy",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Return policy",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const centered = await dialog.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      x: Math.abs(box.x + box.width / 2 - innerWidth / 2),
      y: Math.abs(box.y + box.height / 2 - innerHeight / 2),
      focusInside: node.contains(document.activeElement),
    };
  });
  expect(centered.x).toBeLessThanOrEqual(2);
  expect(centered.y).toBeLessThanOrEqual(2);
  expect(centered.focusInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("Returns desktop columns align within two pixels and phone card labels/values fit in English and Persian", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  for (const lang of ["en", "fa"] as const) {
    await setLanguage(page, lang);
    await page.goto("/#returns");
    await expect(
      page.locator(".returns-overview-table tbody tr").first(),
    ).toBeVisible();
    await checkAlignment(page.locator(".returns-overview-table table"));
    await page.goto("/#return?id=demo-return-1");
    await expect(
      page.locator(".return-lines-table tbody tr").first(),
    ).toBeVisible();
    await checkAlignment(page.locator(".return-lines-table table"));
  }
});

test("Overview and direct return links enforce company and worker branch scope", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      const original = state.returns.find(
        (record: { id: string }) => record.id === "demo-return-1",
      );
      if (!original)
        throw new Error("The scope fixture requires demo-return-1.");
      state.returns.push({
        ...original,
        id: "scope-other-company",
        company_id: "another-company",
        supplier: "Another Company Private Supplier",
      });
      state.returns.push({
        ...original,
        id: "scope-other-branch",
        branch: "Branch 2",
        supplier: "Branch Two Private Return",
      });
      state.returns.push({
        ...original,
        id: "scope-cancelled",
        status: "cancelled",
        supplier: "Cancelled Return Supplier",
      });
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "all");
  await page.goto("/#returns");
  await expect(page.locator(".returns-overview-table")).toContainText(
    "Branch Two Private Return",
  );
  await expect(page.locator(".returns-overview-table")).not.toContainText(
    "Another Company Private Supplier",
  );
  await expect(page.locator(".returns-overview-table")).not.toContainText(
    "Cancelled Return Supplier",
  );
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.locator(".returns-overview-table")).toContainText(
    "Cancelled Return Supplier",
  );
  await signIn(page, "Floor Worker");
  await visitPage(page, "Returns");
  await expect(page.locator(".returns-overview-table")).not.toContainText(
    "Branch Two Private Return",
  );
  await page.goto("/#return?id=scope-other-branch");
  await expect(
    page.getByText("This return is not available in your branch.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".return-detail")).toHaveCount(0);
  await page.goto("/#return?id=scope-other-company");
  await expect(
    page.getByText("This return is not available in your branch.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".return-detail")).toHaveCount(0);
});

test("Return detail pickup does not deduct stock twice and replacement increases actual stock without posting to the supplier ledger", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-1");
  const before = await snapshot(page);
  await page
    .locator(".return-header-card")
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await page.getByLabel("Actual pickup quantity", { exact: true }).fill("3");
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Fictional Representative");
  await page
    .getByLabel("Signed paper pickup slip reference", { exact: true })
    .fill("A2-SIGNED-001");
  await page
    .locator(".return-action-card")
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Recorded pickup");
  const pickup = await snapshot(page);
  expect(pickup.stock).toEqual(before.stock);
  expect(pickup.ledger).toEqual(before.ledger);
  await page
    .locator(".return-header-card")
    .getByRole("button", { name: "Record resolution", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Outcome", exact: true }),
    "replaced",
    "Replaced",
  );
  await page.getByLabel("Original quantity covered", { exact: true }).fill("1");
  await page.getByLabel("Remaining expected date", { exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByLabel("Actual replacement quantity", { exact: true })
    .fill("2");
  const replacement = pickup.products.find(
    (product: { code: string }) => product.code === "0002",
  );
  await chooseOption(
    page,
    page.getByLabel("Replacement product actually received", { exact: true }),
    "0002",
    replacement.name_en,
  );
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Fictional Representative");
  await page
    .getByLabel("Replacement receipt reference", { exact: true })
    .fill("A2-REPLACEMENT-001");
  await page
    .locator(".return-action-card")
    .getByRole("button", { name: "Record resolution", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Recorded item resolutions. Credit claims require Owner / Manager verification.",
  );
  const received = await snapshot(page);
  expect(received.ledger).toEqual(before.ledger);
  expect(received.stock["Branch 1:0002"]).toBe(
    before.stock["Branch 1:0002"] + 2,
  );
  await expect(page.locator(".return-evidence-card")).toContainText(
    "A2-SIGNED-001",
  );
  await expect(page.locator(".return-evidence-card")).toContainText(
    "A2-REPLACEMENT-001",
  );
});

test("Supplier-held cancellation keeps stock and compensation unchanged and requires Supervisor review", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-2");
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "Request cancellation", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByLabel("Actual disposition", { exact: true }),
    "supplier_held",
    "Supplier still holds originals — restore zero",
  );
  await page
    .getByLabel("Cancellation reason (required)", { exact: true })
    .fill("Supplier holds originals; keep the recorded replacement.");
  await page
    .getByRole("button", {
      name: "Record cancellation disposition",
      exact: true,
    })
    .click();
  await expect(page.locator(".return-review-card")).toContainText(
    "Owner / Manager review required.",
  );
  await expect(
    page.getByRole("button", { name: "Approve cancellation", exact: true }),
  ).toHaveCount(0);
  const waiting = await snapshot(page);
  expect(waiting.stock).toEqual(before.stock);
  expect(waiting.ledger).toEqual(before.ledger);
  expect(
    waiting.returns.find(
      (record: { id: string }) => record.id === "demo-return-2",
    ).status,
  ).toBe("cancellation_review");
  await signIn(page, "Supervisor");
  await page.goto("/#return?id=demo-return-2");
  await page
    .getByLabel("Settlement review and reason", { exact: true })
    .fill(
      "Reviewed the replacement receipt; retain compensation and restore no supplier-held originals.",
    );
  await page
    .getByRole("checkbox", {
      name: "I reviewed the history. Existing replacement or compensation is retained; no reversal is needed.",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Approve cancellation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Approved cancellation");
  const cancelled = await snapshot(page);
  expect(cancelled.stock).toEqual(before.stock);
  expect(cancelled.ledger).toEqual(before.ledger);
  expect(
    cancelled.returns.find(
      (record: { id: string }) => record.id === "demo-return-2",
    ).replacement_received,
  ).toEqual(
    before.returns.find(
      (record: { id: string }) => record.id === "demo-return-2",
    ).replacement_received,
  );
});
