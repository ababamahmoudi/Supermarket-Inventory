import { expect, test } from "@playwright/test";
import { auditR2fAlignment } from "./r2f-alignment";

for (const direction of ["ltr", "rtl"] as const) {
  test(`R0.7 rejects shifted controls, glyphs, baselines and two-line icons (${direction})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent(`<!doctype html><html dir="${direction}"><head><style>
      *{box-sizing:border-box}body{font:16px/1.5 sans-serif}main{max-width:1000px;margin:auto}
      .peer-row{display:flex;align-items:center;gap:12px}button{height:44px;padding:0 16px;border:0}
      table{width:100%;table-layout:fixed;border-collapse:collapse}th,td{padding:12px;text-align:start}.numeric{text-align:end}
      .ui-number-group{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto auto}.ui-number-stat{display:contents}.ui-number-label{grid-row:1}.ui-number-value{grid-row:2;align-self:baseline;font-size:17px;line-height:1.2}.ui-number-note{grid-row:3}.price{font-size:26px}
      .ui-card-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{height:120px}.ui-card-header{display:flex;align-items:center;height:44px}.ui-card-header h2{margin:0;font:600 16px/24px sans-serif}
      .ui-icon-text{display:inline-flex;align-items:center;gap:12px}[data-icon-text-icon]{display:block;width:32px;height:32px;background:#eef0f3}[data-icon-text-copy]{display:grid;font-size:14px;line-height:20px}
      </style></head><body><main>
      <div class="peer-row"><button id="first">Print</button><button id="second">Export CSV</button></div>
      <table><thead><tr><th id="name-heading">Product</th><th class="numeric" id="price-heading">Price</th></tr></thead><tbody><tr><td>Fictional Bay Herb</td><td class="numeric">$4.49</td></tr><tr><td>Fictional Orchard Mix</td><td class="numeric">$12.99</td></tr></tbody></table>
      <div class="ui-number-group"><div class="ui-number-stat"><span class="ui-number-label">Cost</span><strong class="ui-number-value" data-number-baseline>$2.50</strong><small class="ui-number-note">per lb</small></div><div class="ui-number-stat"><span class="ui-number-label">Price</span><strong id="large-price" class="ui-number-value price" data-number-baseline>$4.49</strong><small class="ui-number-note">first price</small></div><div class="ui-number-stat"><span class="ui-number-label">Margin</span><strong class="ui-number-value" data-number-baseline>44%</strong><small class="ui-number-note">25% minimum</small></div></div>
      <span class="ui-icon-text"><span id="add-icon" data-icon-text-icon aria-hidden="true">+</span><span data-icon-text-copy><strong>Add a fictional item</strong><small>For goods outside this catalog</small></span></span>
      <div class="ui-card-row"><section class="card" id="first-card"><header class="ui-card-header" id="first-card-header"><h2>Purchases by supplier</h2></header></section><section class="card"><header class="ui-card-header"><h2>Purchases by week</h2></header></section></div>
      <span class="ui-column-value" id="expiry-value">Oct 30</span>
      </main></body></html>`);
    const audit = () =>
      auditR2fAlignment(page, { scene: "D7", exceptionIds: [] });
    const clean = await audit();
    expect(clean.failures).toEqual([]);
    expect(clean.pairs).toBeGreaterThan(0);
    expect(clean.columns).toBe(2);
    expect(clean.numberGroups).toBe(1);
    expect(clean.icons).toBe(1);
    expect(clean.cardHeaders).toBe(2);
    expect(clean.cardPairs).toBe(1);
    expect(clean.plainValues).toBe(1);
    await page
      .locator("#second")
      .evaluate(
        (el) => ((el as HTMLElement).style.transform = "translateY(2px)"),
      );
    expect(
      (await audit()).failures.some((value) => value.startsWith("row:")),
    ).toBe(true);
    await page.locator("#second").evaluate((el) => {
      (el as HTMLElement).style.transform = "";
      (el as HTMLElement).style.height = "41px";
    });
    expect(
      (await audit()).failures.some((value) => value.startsWith("row:")),
    ).toBe(true);
    await page
      .locator("#second")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    await page
      .locator("#price-heading")
      .evaluate((el) => ((el as HTMLElement).style.paddingInlineEnd = "16px"));
    expect(
      (await audit()).failures.some((value) => value.startsWith("col ")),
    ).toBe(true);
    await page
      .locator("#price-heading")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    await page
      .locator("#name-heading")
      .evaluate(
        (el, direction) =>
          ((el as HTMLElement).style.textAlign =
            direction === "rtl" ? "left" : "right"),
        direction,
      );
    expect(
      (await audit()).failures.some((value) => value.startsWith("col ")),
    ).toBe(true);
    await page
      .locator("#name-heading")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    await page
      .locator("#large-price")
      .evaluate(
        (el) => ((el as HTMLElement).style.transform = "translateY(2px)"),
      );
    expect(
      (await audit()).failures.some((value) =>
        value.startsWith("number baseline:"),
      ),
    ).toBe(true);
    await page
      .locator("#large-price")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    await page
      .locator("#add-icon")
      .evaluate(
        (el) => ((el as HTMLElement).style.transform = "translateY(2px)"),
      );
    expect(
      (await audit()).failures.some((value) =>
        value.startsWith("icon/text centre:"),
      ),
    ).toBe(true);
    await page
      .locator("#add-icon")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    expect((await audit()).failures).toEqual([]);
    await page
      .locator("#first-card-header")
      .evaluate((el) => ((el as HTMLElement).style.height = "40px"));
    expect(
      (await audit()).failures.some((value) =>
        value.startsWith("card header below 44px:"),
      ),
    ).toBe(true);
    await page
      .locator("#first-card-header")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    await page
      .locator("#first-card")
      .evaluate((el) => ((el as HTMLElement).style.height = "123px"));
    expect(
      (await audit()).failures.some((value) =>
        value.startsWith("paired card heights:"),
      ),
    ).toBe(true);
    await page
      .locator("#first-card")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    await page
      .locator("#expiry-value")
      .evaluate((el) => ((el as HTMLElement).style.paddingInlineStart = "4px"));
    expect(
      (await audit()).failures.some((value) =>
        value.startsWith("column value is a padded pill:"),
      ),
    ).toBe(true);
    await page
      .locator("#expiry-value")
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    expect((await audit()).failures).toEqual([]);
    await expect(
      auditR2fAlignment(page, {
        scene: "D7",
        exceptionIds: ["unregistered-page-bypass"],
      }),
    ).rejects.toThrow("Unregistered D7 alignment exception");
  });
}
