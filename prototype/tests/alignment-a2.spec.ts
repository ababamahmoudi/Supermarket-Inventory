import { expect, test } from "@playwright/test";
import { inspectTableAlignment } from "./alignment-a2-proof";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage, signIn, uploadInvoice } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`table columns align and phone cards retain labelled contained values (${language})`, async ({
    page,
  }, testInfo) => {
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    const report: {
      route: string;
      tables: number;
      cells: number;
      maxError: number;
      cards: number;
    }[] = [];
    for (const route of [
      "products",
      "alerts",
      "product?code=0009",
      "returns",
      "return?id=demo-return-1",
      "suppliers",
      "suppliers?name=Fresh%20Valley%20Foods",
      "suppliers?name=Fresh%20Valley%20Foods|Invoices|فاکتورها",
      "suppliers?name=Fresh%20Valley%20Foods|Supplier items|کالاهای تأمین‌کننده",
      "suppliers?name=Fresh%20Valley%20Foods|Returns and credits|مرجوعی‌ها و اعتبارها",
      "suppliers?name=Fresh%20Valley%20Foods|Payments|پرداخت‌ها",
      "expiry",
      "offers",
      "payables",
      "settings",
      "dashboard",
      "labels",
      "invoices",
    ]) {
      const [path, englishTab, persianTab] = route.split("|");
      await page.goto(`/#${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      if (path === "invoices") {
        await setLanguage(page, "en");
        await uploadInvoice(page);
        await setLanguage(page, language);
        await expect(page.locator(".invoice-line")).toHaveCount(6);
      }
      if (englishTab) {
        await page
          .getByRole("tab", {
            name: language === "en" ? englishTab : persianTab,
            exact: true,
          })
          .click();
        await expect(
          page.locator(".supplier-tab-card .ui-data-table tbody tr").first(),
        ).toBeVisible();
      }
      const metrics = await inspectTableAlignment(page);
      expect(metrics.failures, `${route} (${language})`).toEqual([]);
      expect(metrics.maxError).toBeLessThanOrEqual(2);
      if (path === "invoices") {
        if ((page.viewportSize()?.width ?? 1280) <= 760) {
          const rows = page.locator(".receiving-table .invoice-line-summary");
          await expect(rows).toHaveCount(6);
          for (const row of await rows.all()) {
            await expect(row.locator(":scope > td:visible")).toHaveCount(3);
            for (const cell of ["status", "product", "total"])
              await expect(
                row.locator(`.receiving-${cell}-cell`),
              ).toBeVisible();
            await expect(row.locator(".receiving-status-icon")).toBeVisible();
            await expect(row.locator(".receiving-phone-chevron")).toHaveCount(
              0,
            );
            await expect(row.locator(".invoice-line-toggle")).toBeVisible();
            await expect(row).toHaveAttribute(
              "data-control-kind",
              "disclosure",
            );
          }
          expect(metrics.receivingCards).toBe(6);
          expect(metrics.cards).toBe(6);
          expect(metrics.cells).toBe(18);
          const before = await readCanonicalBusinessEvidence(page);
          const first = rows.first();
          const editor = page.locator("#invoice-line-0-detail");
          const close = () =>
            editor
              .getByRole("button", {
                name: language === "en" ? "Close" : "بستن",
                exact: true,
              })
              .click();
          await first.locator(".invoice-line-toggle").click();
          await expect(editor).toBeVisible();
          const supplierCode = editor.locator("#invoice-line-0-supplier-code");
          await expect(supplierCode).toBeVisible();
          await expect(supplierCode).toHaveValue(
            before.invoice.lines[0].supplier_item_code ?? "",
          );
          await expect(first).toHaveAttribute("aria-expanded", "true");
          await close();
          for (const key of ["Enter", "Space"]) {
            await first.focus();
            await first.press(key);
            await expect(editor).toBeVisible();
            await expect(first.locator(".invoice-line-toggle")).toHaveAttribute(
              "aria-expanded",
              "true",
            );
            await close();
            await expect(first).toHaveAttribute("aria-expanded", "false");
          }
          await first.click({ position: { x: 4, y: 4 } });
          await expect(editor).toBeVisible();
          await close();
          expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
            before.invoice,
          );
        } else expect(metrics.cells).toBeGreaterThanOrEqual(30);
      }
      report.push({
        route,
        tables: metrics.tables,
        cells: metrics.cells,
        maxError: metrics.maxError,
        cards: metrics.cards,
      });
    }
    expect(report.reduce((sum, item) => sum + item.cells, 0)).toBeGreaterThan(
      100,
    );
    if (page.viewportSize()!.width < 760)
      expect(report.reduce((sum, item) => sum + item.cards, 0)).toBeGreaterThan(
        0,
      );
    await testInfo.attach(`alignment-${language}.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
  });
}

for (const language of ["en", "fa"] as const)
  test(`B4 receiving line cards retain real disclosure and source values, rejecting copied or shifted contracts (${language})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 509, height: 1000 });
    await signIn(page, "Supervisor");
    await page.goto("/#invoices");
    await uploadInvoice(page);
    await setLanguage(page, language);
    const rows = page.locator(".receiving-table .invoice-line-summary");
    await expect(rows).toHaveCount(6);
    const clean = await inspectTableAlignment(page);
    expect(clean.failures).toEqual([]);
    expect(clean.receivingCards).toBe(6);
    const before = await readCanonicalBusinessEvidence(page);
    const first = rows.first();
    const failures: { scene: string; failures: string[]; maxError: number }[] =
      [];
    const rejects = async (
      scene: string,
      mutate: () => Promise<unknown>,
      restore: () => Promise<unknown>,
      geometry = false,
    ) => {
      await mutate();
      try {
        const broken = await inspectTableAlignment(page);
        expect(
          broken.failures.some((failure) =>
            failure.includes(
              geometry ? "line total end" : "invalid B4 line disclosure",
            ),
          ),
          scene,
        ).toBe(true);
        if (geometry) expect(broken.maxError).toBeGreaterThan(2);
        failures.push({
          scene,
          failures: broken.failures,
          maxError: broken.maxError,
        });
      } finally {
        await restore();
      }
    };
    await rejects(
      "copied display-only row kind",
      () =>
        first.evaluate((row) => row.setAttribute("data-control-kind", "copy")),
      () =>
        first.evaluate((row) =>
          row.setAttribute("data-control-kind", "disclosure"),
        ),
    );
    const toggle = first.locator(".invoice-line-toggle");
    await rejects(
      "unrelated editor destination",
      () => toggle.evaluate((link) => link.setAttribute("href", "#products")),
      () =>
        toggle.evaluate((link) =>
          link.setAttribute("href", "#invoice-line-editor"),
        ),
    );
    for (const [scene, selector] of [
      ["wrong original source cost", ".receiving-phone-cost > bdi:first-child"],
      ["wrong source quantity", ".receiving-phone-quantity .quantity-number"],
      ["wrong line total", ".receiving-total-cell > bdi"],
      [
        "wrong canonical category",
        ".receiving-product-meta > span:not([aria-hidden])",
      ],
    ]) {
      const fact = first.locator(selector);
      const original = await fact.textContent();
      await rejects(
        scene,
        () =>
          fact.evaluate((node) => {
            node.textContent = "$999.9999";
          }),
        () =>
          fact.evaluate((node, text) => {
            node.textContent = text;
          }, original),
      );
    }
    const checks = page.locator(".receiving-line-check-count").first();
    await expect(checks).toBeVisible();
    const originalChecks = await checks.textContent();
    await rejects(
      "wrong canonical check count",
      () =>
        checks.evaluate((node) => {
          node.textContent = "99 to check";
        }),
      () =>
        checks.evaluate((node, text) => {
          node.textContent = text;
        }, originalChecks),
    );
    await rejects(
      "counterfeit duplicate line card",
      () =>
        first.evaluate((row) => {
          const copy = row.cloneNode(true) as HTMLElement;
          copy.dataset.counterfeitLine = "true";
          row.parentElement!.append(copy);
        }),
      () =>
        page.locator("[data-counterfeit-line]").evaluate((row) => row.remove()),
    );
    const total = first.locator(".receiving-total-cell");
    const originalStyle = await total.getAttribute("style");
    await rejects(
      "actual line total shifted by four pixels",
      () =>
        total.evaluate((node) => {
          node.style.transform = "translateX(4px)";
        }),
      () =>
        total.evaluate((node, style) => {
          if (style === null) node.removeAttribute("style");
          else node.setAttribute("style", style);
        }, originalStyle),
      true,
    );
    const restored = await inspectTableAlignment(page);
    expect(restored.failures).toEqual([]);
    expect(restored.receivingCards).toBe(6);
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      before.invoice,
    );

    // Ordinary record lists retain their existing separate record chevron;
    // qualifying B4's editor disclosure must not waive their old contract.
    await page.goto("/#products");
    const chevron = page.locator(".phone-list-chevron .table-row-link").first();
    await expect(chevron).toBeVisible();
    const parent = page.locator(".phone-list-chevron").first();
    const html = await parent.innerHTML();
    await chevron.evaluate((node) => node.remove());
    expect(
      (await inspectTableAlignment(page)).failures.some((failure) =>
        failure.includes("expected one record chevron"),
      ),
    ).toBe(true);
    await parent.evaluate((node, original) => {
      node.innerHTML = original;
    }, html);
    expect((await inspectTableAlignment(page)).failures).toEqual([]);
    await info.attach(`receiving-card-contract-${language}.json`, {
      body: JSON.stringify({ clean, failures, restored }, null, 2),
      contentType: "application/json",
    });
  });

for (const language of ["en", "fa"] as const)
  test(`qualified Dashboard decisions retain genuine destinations and reject copied contracts (${language})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    const rows = page.locator(".dashboard-approval-table .dashboard-queue-row");
    await expect(rows.first()).toBeVisible();
    const clean = await inspectTableAlignment(page);
    expect(clean.failures).toEqual([]);
    expect(clean.decisionCards).toBeGreaterThan(0);
    expect(clean.maxError).toBeLessThanOrEqual(2);

    const first = rows.first();
    const product = first.locator(".phone-list-name a.entity-link");
    const productHref = await product.getAttribute("href");
    const approvalId = await first.getAttribute("data-approval-id");
    expect(productHref).toMatch(/^#product\?code=.+/);
    expect(approvalId).toBeTruthy();
    await product.click();
    await expect(page).toHaveURL((url) => url.hash === productHref);
    await page.goto("/#dashboard");
    await first
      .getByRole("button", {
        name: language === "en" ? "More" : "بیشتر",
        exact: true,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: language === "en" ? "View approval" : "مشاهده تأیید",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      (url) => url.hash === `#approvals?id=${encodeURIComponent(approvalId!)}`,
    );
    await page.goto("/#dashboard");
    const approve = rows
      .getByRole("button", {
        name: language === "en" ? "Approve" : "تأیید",
        exact: true,
      })
      .first();
    const before = await readCanonicalBusinessEvidence(page);
    await approve.click();
    const review = page.getByRole("dialog", {
      name: language === "en" ? "Review approval" : "بررسی تأیید",
      exact: true,
    });
    await expect(review).toBeVisible();
    await review
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    const after = await readCanonicalBusinessEvidence(page);
    for (const key of [
      "products",
      "approvals",
      "sale_requests",
      "ledger",
      "stock_movements",
    ] as const)
      expect(after[key]).toEqual(before[key]);

    const failures: { scene: string; failures: string[] }[] = [];
    const rejects = async (
      scene: string,
      mutate: () => Promise<unknown>,
      restore: () => Promise<unknown>,
    ) => {
      await mutate();
      try {
        const broken = await inspectTableAlignment(page);
        expect(
          broken.failures.some((failure) =>
            failure.includes("invalid Dashboard approval decision card"),
          ),
          scene,
        ).toBe(true);
        failures.push({ scene, failures: broken.failures });
      } finally {
        await restore();
      }
    };
    const decision = first.locator(
      ".dashboard-inline-actions > button:not(.ui-menu-trigger)",
    );
    const originalAction = await decision.innerHTML();
    await rejects(
      "wrong decision caption",
      () =>
        decision.evaluate((element) => {
          element.textContent = "Unrelated action";
        }),
      () =>
        decision.evaluate((element, html) => {
          element.innerHTML = html;
        }, originalAction),
    );
    await rejects(
      "wrong product destination",
      () =>
        product.evaluate((element) =>
          element.setAttribute("href", "#product?code=unrelated"),
        ),
      () =>
        product.evaluate(
          (element, href) => element.setAttribute("href", href!),
          productHref,
        ),
    );
    const originalStyle = await decision.getAttribute("style");
    await rejects(
      "short decision action",
      () =>
        decision.evaluate((element) => {
          for (const property of [
            "block-size",
            "min-block-size",
            "max-block-size",
          ])
            element.style.setProperty(property, "32px", "important");
        }),
      () =>
        decision.evaluate((element, style) => {
          if (style === null) element.removeAttribute("style");
          else element.setAttribute("style", style);
        }, originalStyle),
    );
    await rejects(
      "extra record control",
      () =>
        first.evaluate((row) => {
          const link = document.createElement("a");
          link.className = "table-row-link";
          link.href = "#approvals";
          link.textContent = ">";
          link.dataset.alignmentNegative = "record";
          row.querySelector(".phone-list-chevron")!.append(link);
        }),
      () =>
        page
          .locator('[data-alignment-negative="record"]')
          .evaluate((element) => element.remove()),
    );
    await rejects(
      "copied Dashboard classes",
      () =>
        first.evaluate((row) => {
          const fake = document.createElement("section");
          fake.className = "r2c-dashboard";
          fake.dataset.alignmentNegative = "copy";
          fake.innerHTML =
            '<div class="ui-data-table is-responsive is-mobile is-phone-list dashboard-approval-table"><table><tbody></tbody></table></div>';
          fake.querySelector("tbody")!.append(row.cloneNode(true));
          document.querySelector("main")!.append(fake);
        }),
      () =>
        page
          .locator('[data-alignment-negative="copy"]')
          .evaluate((element) => element.remove()),
    );
    const restored = await inspectTableAlignment(page);
    expect(restored.failures).toEqual([]);
    expect(restored.decisionCards).toBe(clean.decisionCards);
    expect(restored.maxError).toBeLessThanOrEqual(2);
    await info.attach(`dashboard-decision-contract-${language}.json`, {
      body: JSON.stringify({ clean, failures, restored }, null, 2),
      contentType: "application/json",
    });
  });

test("product editor is centered with focus trapped, Escape and backdrop restore focus", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#product?code=0009");
  const trigger = page.getByRole("button", {
    name: "Edit Potato Chips 150 g",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const metrics = await dialog.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return {
      x: Math.abs(r.x + r.width / 2 - innerWidth / 2),
      y: Math.abs(r.y + r.height / 2 - innerHeight / 2),
      focused: node.contains(document.activeElement),
    };
  });
  expect(metrics.x).toBeLessThanOrEqual(2);
  expect(metrics.y).toBeLessThanOrEqual(2);
  expect(metrics.focused).toBe(true);
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const frame = () =>
    dialog.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const strips = [
        box.left > 2 ? { x: box.left / 2, y: innerHeight / 2 } : null,
        box.right < innerWidth - 2
          ? { x: (box.right + innerWidth) / 2, y: innerHeight / 2 }
          : null,
        box.top > 2 ? { x: innerWidth / 2, y: box.top / 2 } : null,
        box.bottom < innerHeight - 2
          ? { x: innerWidth / 2, y: (box.bottom + innerHeight) / 2 }
          : null,
      ];
      return {
        outside: strips.find((point) => point !== null),
        phone: innerWidth <= 760,
        width: Math.abs(box.width - innerWidth),
        start: Math.abs(box.left),
        end: Math.abs(box.right - innerWidth),
        top: Math.abs(box.top),
        bottom: Math.abs(box.bottom - innerHeight),
        corners: [
          Math.abs(
            parseFloat(style.borderTopLeftRadius) -
              parseFloat(style.getPropertyValue("--radius-dialog")),
          ),
          Math.abs(
            parseFloat(style.borderTopRightRadius) -
              parseFloat(style.getPropertyValue("--radius-dialog")),
          ),
          parseFloat(style.borderBottomLeftRadius),
          parseFloat(style.borderBottomRightRadius),
        ],
      };
    });
  const actual = await frame();
  if (actual.outside)
    await page.mouse.click(actual.outside.x, actual.outside.y);
  else {
    expect(actual.phone).toBe(true);
    for (const error of [
      actual.width,
      actual.start,
      actual.end,
      actual.top,
      actual.bottom,
      ...actual.corners,
    ])
      expect(error).toBeLessThanOrEqual(2);
    // An actual fullscreen sheet has no backdrop hit area. A narrower sheet
    // must fail the very same width contract before its native Close is used.
    const original = await dialog.getAttribute("style");
    await dialog.evaluate((node) => {
      for (const property of [
        "inline-size",
        "min-inline-size",
        "max-inline-size",
      ])
        node.style.setProperty(property, "calc(100dvw - 4px)", "important");
    });
    expect((await frame()).width).toBeGreaterThan(2);
    await dialog.evaluate((node, style) => {
      if (style === null) node.removeAttribute("style");
      else node.setAttribute("style", style);
    }, original);
    expect((await frame()).width).toBeLessThanOrEqual(2);
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
