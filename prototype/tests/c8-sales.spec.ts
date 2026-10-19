import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { button, exact, field } from "../scripts/c5-browser-proof.mjs";
import {
  inspectC8Layout,
  openC8PriceDialog,
  postC8SaleCostInvoice,
  readC8OriginalSHA,
  readC8State,
  visitC8,
} from "../scripts/capture-c8-proof.mjs";
import { setBranch, setLanguage, signIn } from "./helpers";
import { configuredPersonExpectation } from "./configured-person-expectations";

async function prepare(
  page: Page,
  language: "en" | "fa",
  role: "Supervisor" | "Floor Worker" = "Supervisor",
) {
  await signIn(page, role);
  if (role === "Supervisor") await setBranch(page, "Branch 1");
  else
    await expect(page.locator(".topbar .branch-pill")).toContainText(
      "North York",
    );
  await setLanguage(page, language);
}
async function role(
  page: Page,
  language: "en" | "fa",
  next: "Supervisor" | "Floor Worker" | "Cashier",
) {
  await setLanguage(page, "en");
  await signIn(page, next);
  if (next === "Supervisor") await setBranch(page, "Branch 1");
  else
    await expect(page.locator(".topbar .branch-pill")).toContainText(
      "North York",
    );
  await setLanguage(page, language);
}
async function lookup(page: Page, code: string) {
  await visitC8(page, "lookup");
  const search = page
    .locator(".lookup-page")
    .getByRole("combobox", { name: /^(Search products|جست‌وجوی محصولات)$/ });
  await search.fill(code);
  await search.press("Enter");
  await expect(page.locator(".lookup-detail")).toBeVisible();
}
async function endSale(page: Page, code: string) {
  await visitC8(page, "product?code=" + code);
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: exact("Product actions", "اقدامات کالا") })
    .click();
  await page
    .getByRole("menuitem", { name: exact("End sale now", "پایان حراج اکنون") })
    .click();
  const dialog = page.getByRole("dialog", {
    name: exact("End sale now", "پایان حراج اکنون"),
  });
  await expect(dialog).toBeVisible();
  await button(dialog, "End sale now", "پایان حراج اکنون").click();
  await expect(dialog).toBeHidden();
}

/** Choose tomorrow's local noon using the configured IANA zone, not +24 hours. */
async function followingLocalNoon(page: Page, timeZone: string) {
  return page.evaluate((zone) => {
    const formatter = new Intl.DateTimeFormat("en-CA-u-nu-latn", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = (instant: number) =>
      Object.fromEntries(
        formatter
          .formatToParts(new Date(instant))
          .map((part) => [part.type, part.value]),
      );
    const current = parts(Date.now());
    const day = new Date(
      Date.UTC(
        Number(current.year),
        Number(current.month) - 1,
        Number(current.day) + 1,
        12,
      ),
    );
    const expectedDay = day.toISOString().slice(0, 10);
    const desired = day.getTime();
    let instant = desired;
    for (let turn = 0; turn < 4; turn++) {
      const local = parts(instant);
      const rendered = Date.UTC(
        Number(local.year),
        Number(local.month) - 1,
        Number(local.day),
        Number(local.hour),
        Number(local.minute),
        Number(local.second),
      );
      if (rendered === desired) break;
      instant += desired - rendered;
    }
    const result = parts(instant);
    if (
      `${result.year}-${result.month}-${result.day}` !== expectedDay ||
      result.hour !== "12"
    )
      throw new Error(
        "The controlled browser clock did not reach tomorrow's configured local noon.",
      );
    return { instant, expectedDay, timeZone: zone };
  }, timeZone);
}

for (const language of ["en", "fa"] as const) {
  test(`C8 sale defaults, lower-than-regular and below-cost acknowledgments are real Save gates (${language})`, async ({
    page,
  }) => {
    await prepare(page, language);
    const before = await readC8State(page);
    const product = before.products.find((entry) => entry.code === "0002")!;
    expect(product.branch_prices?.["Branch 1"] ?? product.selling_price).toBe(
      "1.49",
    );
    const dialog = await openC8PriceDialog(page, "0002");
    await expect(
      dialog.getByRole("radio", {
        name: /^(Sale, for a while|حراج، برای مدتی)/,
      }),
    ).toBeChecked();
    await expect(
      button(dialog, "All stores", "همهٔ فروشگاه‌ها"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(button(dialog, "Today", "امروز")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      button(
        dialog.getByRole("group", { name: exact("Ends", "پایان") }),
        "Last day",
        "آخرین روز",
      ),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("checkbox", {
        name: exact(
          "Add Promo labels to the label waitlist",
          "افزودن برچسب‌های حراج به فهرست انتظار برچسب‌ها",
        ),
      }),
    ).toBeChecked();
    const price = dialog.locator(".change-price-amount-field input");
    await price.fill("1.49");
    await button(dialog, "Start sale", "شروع حراج").click();
    await expect(
      dialog.getByRole("alert", {
        name: exact("What's missing", "موارد ناقص"),
      }),
    ).toContainText(language === "en" ? "must be lower" : "باید کمتر");
    expect((await readC8State(page)).sales).toEqual(before.sales);
    await price.fill("0.89");
    const acknowledgment = dialog.getByRole("checkbox", {
      name: exact(
        "Use this price anyway",
        "با این حال از این قیمت استفاده شود",
      ),
    });
    await expect(dialog.locator(".change-price-margin-warning")).toBeVisible();
    await expect(dialog.locator(".change-price-cost-warning")).toBeVisible();
    await button(dialog, "Start sale", "شروع حراج").click();
    await expect(field(dialog, "Reason", "دلیل")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect((await readC8State(page)).sales).toEqual(before.sales);
    await field(dialog, "Reason", "دلیل").fill(
      "C8 reviewed below-cost stock reduction",
    );
    await button(dialog, "Start sale", "شروع حراج").click();
    await expect(dialog).toBeVisible();
    expect((await readC8State(page)).sales).toEqual(before.sales);
    await acknowledgment.check();
    await button(dialog, "Start sale", "شروع حراج").click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await readC8State(page)).sales?.filter(
            (entry) =>
              entry.product_code === "0002" && entry.status === "active",
          ).length,
      )
      .toBe(3);
    const after = await readC8State(page);
    const created = (after.sales ?? []).filter(
      (entry) => entry.product_code === "0002",
    );
    expect(created.map((entry) => entry.branch).sort()).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
    ]);
    for (const sale of created)
      expect(sale).toMatchObject({
        sale_price: "0.89",
        minimum_margin_accepted: true,
        below_cost_reason: "C8 reviewed below-cost stock reduction",
        add_promo_labels: true,
      });
    expect(after.products).toEqual(before.products);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.invoice).toEqual(before.invoice);
    expect(
      after.label_waitlist
        ?.filter((entry) => entry.product_code === "0002")
        .map((entry) => entry.preferred_template),
    ).toEqual(created.map(() => "promo"));
    await lookup(page, "0002");
    await expect(page.locator(".lookup-detail .sale-price")).toContainText(
      "$0.89",
    );
    await expect(
      page.locator(".lookup-detail .sale-regular-price"),
    ).toContainText("$1.49");
    const proof = await inspectC8Layout(
      page,
      "sale-lookup",
      language,
      await page.evaluate(() => window.innerWidth),
    );
    expect(proof.failures).toEqual([]);
    await role(page, language, "Cashier");
    await lookup(page, "0002");
    await expect(page.locator(".lookup-detail .sale-price")).toContainText(
      "$0.89",
    );
    await expect(
      page.locator(".lookup-detail .product-header-actions"),
    ).toHaveCount(0);
    await expect(page.locator(".lookup-detail")).not.toContainText(
      /Store cost|Cost and margin|Margin %|هزینهٔ فروشگاه|هزینه و حاشیه|حاشیه سود %/,
    );
  });

  test(`C8 regular price saved during a sale preserves the overlay and defers regular labels until actual End (${language})`, async ({
    page,
  }) => {
    await prepare(page, language);
    const before = await readC8State(page);
    const sale = before.sales!.find(
      (entry) => entry.id === "demo-c8-pot-sale",
    )!;
    const queued = before.label_waitlist?.find(
      (entry) => entry.product_code === "0012" && entry.branch === "Branch 1",
    );
    expect(queued?.preferred_template).toBe("promo");
    const dialog = await openC8PriceDialog(page, "0012");
    await dialog
      .getByRole("radio", { name: /^(New regular price|قیمت عادی جدید)/ })
      .check();
    await expect(
      dialog.getByRole("checkbox", {
        name: exact(
          "Add regular labels to the label waitlist",
          "افزودن برچسب‌های عادی به فهرست انتظار برچسب‌ها",
        ),
      }),
    ).toBeChecked();
    await dialog.locator(".change-price-amount-field input").fill("22.99");
    await expect(dialog.locator(".change-price-summary")).toContainText(
      language === "en"
        ? /labels.*(?:sale ends|end of the sale)/i
        : /برچسب.*پایان.*حراج/,
    );
    await button(dialog, "Save new price", "ذخیرهٔ قیمت جدید").click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await readC8State(page)).products.find(
            (entry) => entry.code === "0012",
          )?.branch_prices?.["Branch 1"],
      )
      .toBe("22.99");
    const changed = await readC8State(page);
    expect(changed.sales!.find((entry) => entry.id === sale.id)).toEqual({
      ...sale,
      deferred_regular_labels: true,
    });
    expect(
      changed.label_waitlist?.find((entry) => entry.id === queued!.id),
    ).toEqual(queued);
    expect(changed.ledger).toEqual(before.ledger);
    await lookup(page, "0012");
    await expect(page.locator(".lookup-detail .sale-price")).toContainText(
      "$16.99",
    );
    await expect(
      page.locator(".lookup-detail .sale-regular-price"),
    ).toContainText("$22.99");
    await endSale(page, "0012");
    await expect
      .poll(
        async () =>
          (await readC8State(page)).sales!.find((entry) => entry.id === sale.id)
            ?.status,
      )
      .toBe("ended");
    const ended = await readC8State(page);
    expect(
      ended.products.find((entry) => entry.code === "0012")!.branch_prices?.[
        "Branch 1"
      ],
    ).toBe("22.99");
    expect(
      ended.label_waitlist?.find((entry) => entry.id === queued!.id)
        ?.preferred_template,
    ).toBe("regular");
    expect(ended.ledger).toEqual(before.ledger);
    await lookup(page, "0012");
    await expect(page.locator(".lookup-detail .sale-price")).toHaveCount(0);
    await expect(page.locator(".lookup-approved-price .price")).toHaveText(
      "$22.99",
    );
    await page.reload();
    expect(
      (await readC8State(page)).sales!.find((entry) => entry.id === sale.id)
        ?.status,
    ).toBe("ended");
    expect((await readC8State(page)).label_waitlist).toEqual(
      ended.label_waitlist,
    );
  });

  test(`C8 worker request keeps regular charge and privacy until Supervisor acknowledgment and approval (${language})`, async ({
    page,
  }) => {
    await prepare(page, language, "Floor Worker");
    const before = await readC8State(page);
    const dialog = await openC8PriceDialog(page, "0002");
    await expect(dialog.getByRole("radio")).toHaveCount(0);
    await expect(
      dialog.locator(".change-price-margin-warning,.change-price-cost-warning"),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("checkbox", {
        name: exact(
          "Use this price anyway",
          "با این حال از این قیمت استفاده شود",
        ),
      }),
    ).toHaveCount(0);
    await dialog.locator(".change-price-amount-field input").fill("1.19");
    await expect(
      field(dialog, "Why? (optional)", "چرا؟ (اختیاری)"),
    ).toHaveValue("");
    await expect(dialog).not.toContainText(
      /Margin at this price|Cost before tax|حاشیهٔ سود با این قیمت|هزینه پیش از مالیات/,
    );
    await button(dialog, "Send request", "ارسال درخواست").click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await readC8State(page)).sale_requests?.filter(
            (entry) =>
              entry.product_code === "0002" && entry.status === "pending",
          ).length,
      )
      .toBe(1);
    const pending = await readC8State(page);
    const request = pending.sale_requests!.find(
      (entry) => entry.product_code === "0002" && entry.status === "pending",
    )!;
    expect(request).toMatchObject({
      branch: "Branch 1",
      requested_price: "1.19",
      requester_username: configuredPersonExpectation("ny-floor").username,
    });
    expect(request.why ?? "").toBe("");
    expect(pending.products).toEqual(before.products);
    expect(pending.sales).toEqual(before.sales);
    expect(pending.ledger).toEqual(before.ledger);
    await visitC8(page, "products");
    const row = page
      .locator(".catalog-products-table tbody > tr")
      .filter({ hasText: "Canned Fava Beans" });
    await expect(row.locator(".sale-request-pill")).toContainText("$1.19");
    await expect(row.locator(".sale-request-pill")).toBeVisible();
    await expect(row).toContainText("$1.49");
    await lookup(page, "0002");
    await expect(
      page.locator(".lookup-detail .sale-request-pill"),
    ).toBeVisible();
    await expect(
      page.locator(".lookup-detail .sale-request-pill"),
    ).toContainText("$1.19");
    await expect(page.locator(".lookup-approved-price .price")).toHaveText(
      "$1.49",
    );
    await role(page, language, "Supervisor");
    await visitC8(page, "approvals");
    const card = page.locator(`[data-sale-request-id="${request.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(
      language === "en" ? "Margin at this price" : "حاشیه سود در این قیمت",
    );
    await button(card, "Approve", "تأیید").click();
    await expect(
      card.getByRole("alert", {
        name: exact("What's missing", "موارد ناقص"),
      }),
    ).toBeVisible();
    expect(
      (await readC8State(page)).sale_requests!.find(
        (entry) => entry.id === request.id,
      )?.status,
    ).toBe("pending");
    await card
      .getByRole("checkbox", {
        name: exact(
          "Use this price anyway",
          "با این حال از این قیمت استفاده شود",
        ),
      })
      .check();
    await button(card, "Approve", "تأیید").click();
    await expect(card).toBeHidden();
    await expect
      .poll(
        async () =>
          (await readC8State(page)).sale_requests!.find(
            (entry) => entry.id === request.id,
          )?.status,
      )
      .toBe("approved");
    const approved = await readC8State(page);
    expect(
      approved.sales!.filter((entry) => entry.product_code === "0002"),
    ).toEqual([
      expect.objectContaining({
        branch: "Branch 1",
        sale_price: "1.19",
        status: "active",
        minimum_margin_accepted: true,
      }),
    ]);
    expect(approved.products).toEqual(before.products);
    expect(approved.ledger).toEqual(before.ledger);
    expect(
      approved.notifications?.filter(
        (entry) =>
          entry.request_id === request.id &&
          entry.kind === "sale_request_approved",
      ),
    ).toEqual([
      expect.objectContaining({
        target_username: configuredPersonExpectation("ny-floor").username,
        branch: "Branch 1",
      }),
    ]);
    await role(page, language, "Floor Worker");
    await lookup(page, "0002");
    await expect(page.locator(".lookup-detail .sale-request-pill")).toHaveCount(
      0,
    );
    await expect(page.locator(".lookup-detail .sale-price")).toContainText(
      "$1.19",
    );
  });

  test(`C8 actual cost-up posting, Keep with delivery hold, and End preserve invoice money and source (${language})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await prepare(page, language);
    await page.clock.setFixedTime(
      new Date(await page.evaluate(() => Date.now())),
    );
    const before = await readC8State(page);
    const evidence = await postC8SaleCostInvoice(
      page,
      fileURLToPath(
        new URL(
          "../public/demo-originals/fictional-hw-5012.svg",
          import.meta.url,
        ),
      ),
    );
    const posted = await readC8State(page);
    expect(
      posted.ledger.filter((entry) => entry.invoice_id === evidence.invoice_id),
    ).toEqual([
      expect.objectContaining({
        type: "invoice",
        amount: "48.14",
        supplier: "HomeWare Imports",
        reference: "HW-5012",
      }),
    ]);
    expect(
      posted.ledger.filter((entry) => entry.invoice_id !== evidence.invoice_id),
    ).toEqual(before.ledger);
    const alert = posted.alerts.find(
      (entry) => entry.id === evidence.alert_id,
    )!;
    expect(alert).toMatchObject({
      previous_cost: "12.6000",
      new_cost: "14.2000",
      sale_price: "16.99",
      status: "pending",
    });
    expect(alert.proposed_regular_price).toMatch(/^\d+\.\d{2}$/);
    expect(
      posted.approvals.find((entry) => entry.id === alert.approval_id),
    ).toMatchObject({ product_code: "0012", status: "pending" });
    const card = page.locator(`[data-sale-alert-id="${alert.id}"]`);
    await expect(card).toContainText("$12.60");
    await expect(card).toContainText("$14.20");
    await expect(card).toContainText("$16.99");
    await card
      .getByRole("checkbox", {
        name: exact(
          "Keep this delivery in the back until the sale ends",
          "این تحویل را تا پایان حراج در انبار پشت فروشگاه نگه دارید",
        ),
      })
      .check();
    await button(
      card,
      "Keep the sale as it is",
      "حراج به همین صورت ادامه یابد",
    ).click();
    await expect
      .poll(
        async () =>
          (await readC8State(page)).alerts.find(
            (entry) => entry.id === alert.id,
          )?.status,
      )
      .toBe("resolved");
    const kept = await readC8State(page);
    expect(kept.sales!.find((entry) => entry.id === evidence.sale_id)).toEqual(
      posted.sales!.find((entry) => entry.id === evidence.sale_id),
    );
    expect(
      kept.sale_delivery_holds?.filter(
        (entry) => entry.invoice_id === evidence.invoice_id,
      ),
    ).toEqual([
      expect.objectContaining({
        product_code: "0012",
        sale_id: evidence.sale_id,
        branch: "Branch 1",
        invoice_number: "HW-5012",
      }),
    ]);
    const hold = kept.sale_delivery_holds!.find(
      (entry) => entry.invoice_id === evidence.invoice_id,
    )!;
    expect(kept.notes.find((entry) => entry.id === hold.note_id)).toBeDefined();
    expect(kept.ledger).toEqual(posted.ledger);
    await lookup(page, "0012");
    await expect(page.locator(".lookup-detail .sale-price")).toContainText(
      "$16.99",
    );
    await endSale(page, "0012");
    await expect
      .poll(
        async () =>
          (await readC8State(page)).sales!.find(
            (entry) => entry.id === evidence.sale_id,
          )?.status,
      )
      .toBe("ended");
    const immediatelyEnded = await readC8State(page);
    expect(
      immediatelyEnded.alerts.filter(
        (entry) =>
          entry.type === "sale_delivery_release" &&
          entry.invoice_id === evidence.invoice_id,
      ),
    ).toHaveLength(0);
    expect(
      immediatelyEnded.notifications?.filter(
        (entry) =>
          entry.kind === "sale_delivery_release" &&
          entry.invoice_id === evidence.invoice_id,
      ) ?? [],
    ).toHaveLength(0);
    expect(immediatelyEnded.ledger).toEqual(posted.ledger);
    await page.reload();
    expect(
      (await readC8State(page)).alerts.filter(
        (entry) =>
          entry.type === "sale_delivery_release" &&
          entry.invoice_id === evidence.invoice_id,
      ),
    ).toHaveLength(0);
    const timeZone =
      before.config.branches.find((entry) => entry.id === "Branch 1")
        ?.timezone ?? before.config.company.timezone;
    const tomorrow = await followingLocalNoon(page, timeZone);
    await page.clock.setFixedTime(new Date(tomorrow.instant));
    await page.reload();
    expect(
      await page.evaluate(
        (zone) =>
          new Intl.DateTimeFormat("en-CA-u-nu-latn", {
            timeZone: zone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
        timeZone,
      ),
    ).toBe(tomorrow.expectedDay);
    await expect
      .poll(
        async () =>
          (await readC8State(page)).alerts.filter(
            (entry) =>
              entry.type === "sale_delivery_release" &&
              entry.invoice_id === evidence.invoice_id,
          ).length,
      )
      .toBe(1);
    const ended = await readC8State(page);
    expect(ended.ledger).toEqual(posted.ledger);
    expect(
      ended.invoices!.find((entry) => entry.id === evidence.invoice_id),
    ).toEqual(kept.invoices!.find((entry) => entry.id === evidence.invoice_id));
    const original = kept.invoices!.find(
      (entry) => entry.id === evidence.invoice_id,
    )!.file_data!;
    expect(await readC8OriginalSHA(page, original)).toBe(
      evidence.originalSHA256,
    );
    await visitC8(page, "alerts");
    const release = ended.alerts.find(
      (entry) =>
        entry.type === "sale_delivery_release" &&
        entry.invoice_id === evidence.invoice_id,
    )!;
    await expect(
      page.locator(`[data-sale-alert-id="${release.id}"]`),
    ).toContainText(language === "en" ? "put the held" : "کالای نگه‌داشته‌شده");
    const proof = await inspectC8Layout(
      page,
      "sale-delivery-release",
      language,
      await page.evaluate(() => window.innerWidth),
    );
    expect(proof.failures).toEqual([]);
    await page.reload();
    const repeated = await readC8State(page);
    expect(
      repeated.alerts.filter(
        (entry) =>
          entry.type === "sale_delivery_release" &&
          entry.invoice_id === evidence.invoice_id,
      ),
    ).toEqual([release]);
    expect(
      repeated.notifications?.filter(
        (entry) =>
          entry.kind === "sale_delivery_release" &&
          entry.invoice_id === evidence.invoice_id,
      ),
    ).toEqual(
      ended.notifications?.filter(
        (entry) =>
          entry.kind === "sale_delivery_release" &&
          entry.invoice_id === evidence.invoice_id,
      ),
    );
    expect(repeated.ledger).toEqual(posted.ledger);
    expect(await readC8OriginalSHA(page, original)).toBe(
      evidence.originalSHA256,
    );
  });
}
