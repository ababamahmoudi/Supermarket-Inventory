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
      <details id="hidden-controls"><summary>More optional fields</summary><div class="peer-row"><button style="height:41px">Hidden short action</button><button>Hidden ordinary action</button></div></details>
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
    await page.locator("#hidden-controls summary").click();
    expect(
      (await audit()).failures.some((value) => value.startsWith("row:")),
    ).toBe(true);
    await page.locator("#hidden-controls summary").click();
    expect((await audit()).failures).toEqual([]);
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

for (const scene of ["D1", "D7"] as const) {
  test(`R0.7 ${scene} independent wrappers never excuse a phone or same-column overlap`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const department = scene === "D1";
    await page.setContent(
      `<style>*{box-sizing:border-box}main{position:relative;min-height:200px}button{width:44px;height:44px;border:0}.timesheet-department,.card{width:120px;height:80px}.timesheet-department{position:absolute}.dashboard-layout{display:grid;grid-template-columns:120px 120px;gap:20px}.dashboard-main,.dashboard-aside{position:relative}.first-button{margin-inline-start:76px}.second-card{top:2px}.dashboard-aside{top:2px}</style><main class="${department ? "timesheets-page" : "r2c-dashboard"}">${department ? '<section class="timesheet-department" data-department-key="bakery"><button class="first-button">A</button></section><section class="timesheet-department second-card" data-department-key="cash" style="left:140px"><button>B</button></section>' : '<div class="dashboard-layout"><div class="dashboard-main"><section class="card"><button class="first-button">A</button></section></div><div class="dashboard-aside"><section class="card"><button>B</button></section></div></div>'}</main>`,
    );
    const distinct = await auditR2fAlignment(page, { scene });
    expect(distinct.failures).toEqual([]);
    expect(
      distinct.allowed.some(
        (item) =>
          item.id ===
          (department
            ? "D1-independent-departments"
            : "D7-independent-columns"),
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    if (department)
      await page.locator(".second-card").evaluate((el) => {
        (el as HTMLElement).style.left = "0px";
        (el.querySelector("button") as HTMLElement).style.marginInlineStart =
          "132px";
      });
    else
      await page.locator(".dashboard-layout").evaluate((el) => {
        (el as HTMLElement).style.display = "flex";
        const aside = el.querySelector(".dashboard-aside") as HTMLElement;
        aside.style.position = "absolute";
        aside.style.left = "0px";
        (aside.querySelector("button") as HTMLElement).style.marginInlineStart =
          "132px";
      });
    const sameColumn = await auditR2fAlignment(page, { scene });
    expect(sameColumn.failures.some((value) => value.startsWith("row:"))).toBe(
      true,
    );
    expect(
      sameColumn.allowed.some(
        (item) =>
          item.id ===
          (department
            ? "D1-independent-departments"
            : "D7-independent-columns"),
      ),
    ).toBe(false);
  });
}

for (const direction of ["ltr", "rtl"] as const)
  test(`R0.7 Dashboard decision groups measure actual control edges and reject a shifted group (${direction})`, async ({
    page,
  }) => {
    await page.setContent(
      `<html dir="${direction}"><style>*{box-sizing:border-box}table{width:600px;table-layout:fixed}th,td{padding:12px;text-align:start}td[data-column-key=actions]{text-align:end}.dashboard-inline-actions{display:flex;justify-content:flex-end;gap:8px;width:160px}button{width:84px;height:44px;border:0}button.more{width:44px}</style><main class="r2c-dashboard"><div class="dashboard-approval-table"><table><thead><tr><th>Product</th><th></th></tr></thead><tbody>${["Approve", "Review"].map((label, i) => `<tr><td>Fictional product ${i + 1}</td><td data-column-key="actions"><div class="dashboard-inline-actions"><button>${label}</button><button class="more" aria-label="More"><svg aria-hidden="true" width="16" height="16"><circle cx="8" cy="8" r="2"/></svg></button></div></td></tr>`).join("")}</tbody></table></div></main></html>`,
    );
    const plain = await auditR2fAlignment(page, {
      scene: "D7",
      exceptionIds: [],
    });
    expect(plain.failures.some((value) => value.startsWith("col "))).toBe(true);
    const clean = await auditR2fAlignment(page, { scene: "D7" });
    expect(clean.failures).toEqual([]);
    expect(
      clean.allowed.some((item) => item.id === "D7-decision-control-group"),
    ).toBe(true);
    await page
      .locator(".dashboard-inline-actions")
      .first()
      .evaluate(
        (el) => ((el as HTMLElement).style.transform = "translateX(4px)"),
      );
    expect(
      (await auditR2fAlignment(page, { scene: "D7" })).failures.some((value) =>
        value.startsWith("col "),
      ),
    ).toBe(true);
    await page
      .locator(".dashboard-inline-actions")
      .first()
      .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
    expect((await auditR2fAlignment(page, { scene: "D7" })).failures).toEqual(
      [],
    );
  });

test("R0.7 registered popup controls are measured within their render plane, with no peer waiver inside the popup", async ({
  page,
}) => {
  await page.setContent(
    `<style>*{box-sizing:border-box}main{height:600px}main button{position:absolute;top:400px;left:0;width:100px;height:44px}.request-search-results{position:absolute;top:402px;left:112px;width:224px;height:48px;display:flex;align-items:center;gap:12px}.request-search-results button{width:100px;height:40px;border:0}</style><main><button>Save as draft</button></main><div class="request-search-results" data-r2f-scene="D10" role="listbox"><button disabled>Added</button><button id="popup-action">Add</button></div>`,
  );
  const audit = () =>
    auditR2fAlignment(page, { scene: "D10", portals: ["request-results"] });
  const clean = await audit();
  expect(clean.failures).toEqual([]);
  expect(clean.separateOverlayPairs).toBeGreaterThan(0);
  await page
    .locator("#popup-action")
    .evaluate((el) => ((el as HTMLElement).style.height = "44px"));
  expect(
    (await audit()).failures.some((value) => value.startsWith("row:")),
  ).toBe(true);
  await page
    .locator("#popup-action")
    .evaluate((el) => (el as HTMLElement).removeAttribute("style"));
  expect((await audit()).failures).toEqual([]);
  await page
    .locator(".request-search-results")
    .evaluate((el) => ((el as HTMLElement).style.position = "static"));
  expect((await audit()).failures).toContain(
    "Expected an actual overlay plane: request-results",
  );
});

for (const direction of ["ltr", "rtl"] as const)
  test(`R0.7 linked app login measures its actual icon/value edge and rejects a shifted value (${direction})`, async ({
    page,
  }) => {
    await page.setContent(
      `<html dir="${direction}"><style>*{box-sizing:border-box}.timesheet-managed-person{display:grid;grid-template-columns:32px 160px 100px 160px 44px;gap:12px;align-items:center;height:64px}.timesheet-staff-login{display:inline-flex;align-items:center;gap:6px}button{height:36px;width:36px;border:0}</style><main><section class="timesheet-manage-staff"><ul class="timesheet-managed-list">${[false, true, false].map((linked, i) => `<li class="timesheet-managed-person" data-staff-id="fictional-${i}"><span aria-hidden="true"></span><strong>Fictional person ${i}</strong><span>Bakery</span><span class="timesheet-staff-login">${linked ? '<svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="4"/></svg><bdi dir="ltr">cashier</bdi>' : "No app login"}</span><button aria-label="Actions">⋯</button></li>`).join("")}</ul></section></main></html>`,
    );
    const audit = () => auditR2fAlignment(page, { scene: "D2" });
    expect(
      (
        await auditR2fAlignment(page, { scene: "D2", exceptionIds: [] })
      ).failures.some((item) => item.startsWith("col ")),
    ).toBe(true);
    const clean = await audit();
    expect(clean.failures).toEqual([]);
    expect(
      clean.allowed.find((entry) => entry.id === "D2-linked-login-icon")?.count,
    ).toBeGreaterThan(0);
    const value = page.locator(".timesheet-staff-login:has(svg)");
    await value.evaluate(
      (node) => ((node as HTMLElement).style.transform = "translateX(4px)"),
    );
    expect(
      (await audit()).failures.some((item) => item.startsWith("col ")),
    ).toBe(true);
    await value.evaluate((node) =>
      (node as HTMLElement).style.removeProperty("transform"),
    );
    expect((await audit()).failures).toEqual([]);
  });
