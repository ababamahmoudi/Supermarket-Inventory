import { expect } from "@playwright/test";
import { button, exact, field } from "./c5-browser-proof.mjs";
import {
  chooseC8Date,
  openC8PriceDialog,
  openC8ProductEditor,
  postC8SaleCostInvoice,
  prepareC8NewOrder,
  readC8State,
  visitC8,
} from "./capture-c8-proof.mjs";

export const c8SceneRole = (scene) =>
  [
    "request-sale-dialog",
    "requested-sale-products",
    "requested-sale-lookup",
  ].includes(scene)
    ? "floor_worker"
    : "supervisor";

async function lookup(page, code) {
  await visitC8(page, "lookup");
  const search = page.locator(".lookup-page").getByRole("combobox", {
    name: /^(Search products|جست‌وجوی محصولات|جستجوی کالاها)$/,
  });
  await search.fill(code);
  await search.press("Enter");
  await expect(page.locator(".lookup-detail")).toBeVisible();
}

async function priceDialog(page, code, mode) {
  const dialog = await openC8PriceDialog(page, code);
  if (mode === "regular")
    await dialog
      .getByRole("radio", { name: /^(New regular price|قیمت عادی جدید)/ })
      .check();
  await dialog
    .locator(".change-price-amount-field input")
    .fill(mode === "regular" ? "2.29" : "1.19");
  await expect(dialog.locator(".change-price-summary")).toContainText(
    mode === "regular" ? "$2.29" : "$1.19",
  );
  return dialog;
}

/** Fresh approved fixtures and real UI actions only. Dialogs open after appearance. */
export async function setupC8Scene(page, scene, { costOriginal } = {}) {
  const current = await readC8State(page);
  if (scene === "edit-product-dates") {
    await visitC8(page, "expiry");
    const form = page.locator(".date-quick-add");
    await field(form, "Product", "محصول").fill("0006");
    await form.getByRole("option", { name: /0006$/ }).click();
    await chooseC8Date(page, field(form, "Date", "تاریخ"));
    await button(form, "More", "بیشتر").click();
    await field(form, "Quantity (optional)", "مقدار (اختیاری)").fill("20");
    await field(form, "Lot (optional)", "سری ساخت (اختیاری)").fill(
      "C8-SHELF-06",
    );
    await button(form, "Add", "افزودن").click();
    await expect
      .poll(async () =>
        (await readC8State(page)).expiry.some(
          (entry) =>
            entry.lot_number === "C8-SHELF-06" && entry.status !== "removed",
        ),
      )
      .toBe(true);
    const entry = (await readC8State(page)).expiry.find(
      (date) => date.lot_number === "C8-SHELF-06",
    );
    await visitC8(page, "product?code=0006");
    return {
      selector: ".product-editor-dialog",
      capture: "viewport",
      evidence: {
        source:
          "Real date quick-add and full Edit product dialog; the dates section is scrolled into view",
        expiry_id: entry.id,
        date: entry.date,
        quantity: entry.quantity,
        lot_number: entry.lot_number,
      },
      afterAppearance: async () => {
        const dialog = await openC8ProductEditor(page, "0006");
        await dialog.locator(".product-date-editor").scrollIntoViewIfNeeded();
        await expect(
          dialog
            .locator(".product-editor-date-row")
            .filter({ hasText: "C8-SHELF-06" }),
        ).toHaveCount(1);
      },
    };
  }
  if (scene === "edit-product-missing-date") {
    expect(
      current.expiry.filter(
        (entry) =>
          entry.company_id === current.config.company.seed_key &&
          entry.product_code === "0004" &&
          entry.status !== "removed",
      ),
    ).toHaveLength(0);
    await visitC8(page, "product?code=0004");
    return {
      selector: ".product-editor-dialog",
      capture: "viewport",
      evidence: {
        source:
          "Actual blocked Save, Black Tea 0004, tracking Yes and no open company date",
      },
      afterAppearance: async () => {
        const dialog = await openC8ProductEditor(page, "0004");
        const tracking = dialog.getByRole("switch", {
          name: exact("Date tracking", "پیگیری تاریخ"),
        });
        if ((await tracking.getAttribute("aria-checked")) !== "true")
          await tracking.click();
        await button(dialog, "Save product", "ذخیرهٔ محصول").click();
        const missing = dialog.getByRole("alert", {
          name: exact("What's missing", "چه چیزی کم است"),
        });
        await expect(missing).toBeVisible();
        await expect(
          missing.getByRole("link", {
            name: exact(
              "Add an expiry date, or turn off date tracking",
              "یک تاریخ انقضا اضافه کنید، یا پیگیری تاریخ را خاموش کنید",
            ),
          }),
        ).toBeVisible();
        const after = await readC8State(page);
        expect(after.products).toEqual(current.products);
        expect(after.expiry).toEqual(current.expiry);
        expect(after.ledger).toEqual(current.ledger);
      },
    };
  }
  if (scene === "labels-products") {
    await visitC8(page, "labels");
    // The public Labels list includes pending products; only selection requires
    // an active product with an approved price. Measure the full visible list.
    const listed = current.products.filter(
      (product) =>
        product.company_id === current.config.company.seed_key &&
        product.status !== "archived",
    );
    const rows = page.locator(".labels-product-table tbody tr");
    await expect(rows).toHaveCount(listed.length);
    // The code cell can move into disclosure details at narrow widths. The
    // actual selection control retains its accessible product identifier.
    const names = await rows
      .getByRole("checkbox")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label") ?? ""),
      );
    const codes = names.map((value) =>
      value.replace(/^(?:Select product|انتخاب کالای) /, ""),
    );
    expect(codes.sort()).toEqual(listed.map((product) => product.code).sort());
    for (const product of listed.filter((entry) => entry.status !== "active"))
      await expect(
        rows.getByRole("checkbox", {
          name: exact(
            "Select product " + product.code,
            "انتخاب کالای " + product.code,
          ),
        }),
      ).toBeDisabled();
    return {
      selector: ".labels-product-table",
      capture: "page",
      evidence: {
        source:
          "Full uncapped nonarchived product list, with pending selections disabled; every table row measured against its card",
      },
    };
  }
  if (scene === "new-order") {
    await prepareC8NewOrder(page);
    return {
      selector: ".order-form-card",
      capture: "page",
      evidence: {
        source:
          "Real New order, Golden Grain, 12 cases = 48 units; second row 2 cases",
        product_code: "0001",
        cases: "12",
        units: "48",
      },
    };
  }
  if (scene === "product-detail") {
    await visitC8(page, "product?code=0016");
    await expect(page.locator(".product-page h1")).toContainText(
      "Bulk Almonds",
    );
    return {
      selector: ".product-page",
      capture: "page",
      evidence: {
        source:
          "Actual Bulk Almonds 0016 detail route, summary and titled sections",
      },
    };
  }
  if (scene === "change-price-sale" || scene === "change-price-regular") {
    await visitC8(page, "product?code=0002");
    return {
      selector: ".change-price-dialog",
      capture: "viewport",
      evidence: {
        source: "Actual Change price form for approved 0002; unsaved preview",
        mode: scene === "change-price-sale" ? "sale" : "regular",
        price: scene === "change-price-sale" ? "1.19" : "2.29",
      },
      afterAppearance: async () => {
        await priceDialog(
          page,
          "0002",
          scene === "change-price-sale" ? "sale" : "regular",
        );
      },
    };
  }
  if (scene === "request-sale-dialog") {
    await visitC8(page, "product?code=0002");
    return {
      selector: ".change-price-dialog",
      capture: "viewport",
      evidence: {
        source:
          "Actual Floor Worker sale request, optional Why, no private cost or margin",
      },
      afterAppearance: async () => {
        const dialog = await priceDialog(page, "0002", "sale");
        await field(dialog, "Why? (optional)", "چرا؟ (اختیاری)").fill(
          "slow seller",
        );
        await expect(dialog).not.toContainText(
          /Margin at this price|Cost before tax|حاشیه سود در این قیمت|هزینه پیش از مالیات/,
        );
      },
    };
  }
  if (
    scene === "requested-sale-products" ||
    scene === "requested-sale-lookup"
  ) {
    const request = current.sale_requests?.find(
      (entry) => entry.id === "demo-c8-oil-request",
    );
    expect(request).toMatchObject({
      product_code: "0008",
      branch: "Branch 1",
      requested_price: "7.99",
      status: "pending",
    });
    if (scene === "requested-sale-products") {
      await visitC8(page, "products");
      await page
        .locator("#main-content")
        .getByRole("searchbox", { name: "Search products", exact: true })
        .fill("0008");
    } else await lookup(page, "0008");
    const pendingScope = page.locator(
      scene === "requested-sale-products"
        ? ".c8-products-list-card"
        : ".lookup-detail",
    );
    await expect(pendingScope.locator(".sale-request-pill")).toBeVisible();
    await expect(pendingScope.locator(".sale-request-pill")).toContainText(
      "$7.99",
    );
    await expect(pendingScope).toContainText("$9.49");
    return {
      selector:
        scene === "requested-sale-products" ? "#main-content" : ".lookup-page",
      capture: "page",
      evidence: {
        source:
          "Approved fictional pending worker request remains pending; actual regular price still charged",
        request_id: request.id,
        requested_price: request.requested_price,
        starts_on: request.starts_on,
        last_day: request.last_day,
      },
    };
  }
  if (scene === "sale-request-approval") {
    await visitC8(page, "approvals");
    await expect(
      page.locator('[data-sale-request-id="demo-c8-oil-request"]'),
    ).toBeVisible();
    return {
      selector: '[data-sale-request-id="demo-c8-oil-request"]',
      capture: "page",
      evidence: {
        source:
          "Supervisor reviews actual pending $7.99 worker request; preview costs/margin and real approval controls",
      },
    };
  }
  if (scene === "sale-lookup") {
    await lookup(page, "0012");
    await expect(page.locator(".lookup-detail .sale-price")).toContainText(
      "$16.99",
    );
    await expect(
      page.locator(".lookup-detail .sale-regular-price"),
    ).toContainText("$20.99");
    return {
      selector: ".lookup-page",
      capture: "page",
      evidence: {
        source:
          "Actual active configured sale; unchanged regular price and end date",
        sale_id: "demo-c8-pot-sale",
        regular_price: "20.99",
        sale_price: "16.99",
      },
    };
  }
  if (scene === "sales-offers") {
    await visitC8(page, "offers");
    await expect(page.locator("main")).toContainText("16.99");
    return {
      selector: "#main-content",
      capture: "page",
      evidence: {
        source:
          "Actual combined Offers list including configured sale; no replacement of combo/clearance records",
        sale_id: "demo-c8-pot-sale",
      },
    };
  }
  if (scene === "sale-cost-increase") {
    if (!costOriginal)
      throw new Error(
        "The cost-rise scene requires the exact included invoice source path.",
      );
    const evidence = await postC8SaleCostInvoice(page, costOriginal);
    return {
      selector: `[data-sale-alert-id="${evidence.alert_id}"]`,
      capture: "page",
      evidence: {
        source:
          "Exact-source real upload/read/review/post created this alert; unsaved invoices emit no sale-cost alert",
        ...evidence,
      },
    };
  }
  if (scene === "sale-promo-label") {
    const queued = current.label_waitlist?.find(
      (entry) => entry.product_code === "0012" && entry.branch === "Branch 1",
    );
    expect(queued).toMatchObject({
      preferred_template: "promo",
      source_reason: "sale_started",
    });
    expect(queued.source_event_id).toContain("demo-c8-pot-sale");
    await visitC8(page, "labels");
    await page.getByRole("tab", { name: /^Waitlist(?:\s|$)/ }).click();
    const group = page.getByRole("tablist", {
      name: "Label styles",
      exact: true,
    });
    if (await group.count())
      await group.getByRole("tab", { name: /^Promo(?:\s|$)/ }).click();
    await expect(
      field(
        page.locator(".labels-print-card"),
        "Saved template",
        "قالب ذخیره‌شده",
      ),
    ).toHaveText("Promo");
    await expect(page.locator(".promo-shelf-label").first()).toContainText(
      "16.99",
    );
    await expect(page.locator(".promo-shelf-label").first()).toContainText(
      "20.99",
    );
    return {
      selector: ".labels-print-card",
      capture: "page",
      evidence: {
        source:
          "Actual Sale-start automatic Promo group and matching auto-selected template; A4 and grayscale preview with retained source identity",
        sale_id: "demo-c8-pot-sale",
        waitlist_id: queued.id,
        source_event_id: queued.source_event_id,
        source_reason: queued.source_reason,
        sale_price: "16.99",
        regular_price: "20.99",
        output: "Live preview, no simulated print confirmation",
      },
    };
  }
  throw new Error("Unknown C8 capture scene: " + scene);
}
