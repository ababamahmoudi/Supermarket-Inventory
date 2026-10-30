import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  signIn,
  setBranch,
  setLanguage,
  openShellAction,
  chooseOption,
} from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { auditR2fAlignment } from "./r2f-alignment";

async function fixture(page: Page) {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await runCanonicalBusinessFixture(
    page,
    (draft) => {
      const parent = draft.products.find((product) => product.code === "0016")!;
      Object.assign(parent, { unit_size: "", date_tracking: false });
    },
    null,
  );
  await page.reload();
}
async function openEditor(page: Page, language: "en" | "fa") {
  await page.goto("/#products");
  await page.locator(".catalog-filter-toolbar input").first().fill("0016");
  const phone = (await page.evaluate(() => innerWidth)) <= 760;
  if (phone) {
    await page
      .locator('.catalog-products-table a[href="#product?code=0016"]')
      .first()
      .click();
  }
  const edit = page
    .locator(phone ? ".product-header-actions" : ".catalog-products-table")
    .getByRole("button", { name: /^(Edit |ویرایش )/ })
    .first();
  await expect(edit).toBeVisible();
  await edit.click();
  const dialog = page.getByRole("dialog", {
    name: language === "en" ? "Edit product" : "ویرایش محصول",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: language === "en" ? "Save product" : "ذخیرهٔ محصول",
      exact: true,
    }),
  ).toBeEnabled();
  return dialog;
}
async function stable(control: Locator, action: () => Promise<void>) {
  await control.scrollIntoViewIfNeeded();
  const before = await control.boundingBox();
  expect(before).not.toBeNull();
  const scrollBefore = await control.evaluate((element) => {
    const body = element.closest(".product-editor-body")!;
    const content = body.querySelector<HTMLElement>(".weight-product-content")!;
    return {
      scrollTop: body.scrollTop,
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      contentHeight: content.getBoundingClientRect().height,
      floor: content.style.minBlockSize,
    };
  });
  await action();
  const movement = await control.evaluate(async (element, original) => {
    let maximum = 0;
    const frames = [];
    for (let frame = 0; frame < 6; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const current = element.getBoundingClientRect();
      maximum = Math.max(
        maximum,
        Math.abs(original!.x - current.x),
        Math.abs(original!.y - current.y),
      );
      const body = element.closest(".product-editor-body")!;
      const content = body.querySelector<HTMLElement>(
        ".weight-product-content",
      )!;
      frames.push({
        x: current.x,
        y: current.y,
        scrollTop: body.scrollTop,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
        contentHeight: content.getBoundingClientRect().height,
        floor: content.style.minBlockSize,
      });
    }
    return { maximum, frames };
  }, before);
  expect(
    movement.maximum,
    JSON.stringify({ before, scrollBefore, movement }, null, 2),
  ).toBeLessThanOrEqual(2);
}

for (const width of [360, 390, 509, 760, 1440]) {
  for (const [language, theme] of [
    ["en", "light"],
    ["fa", "dark"],
  ] as const) {
    test(`R2g C1 weight editor ${width} ${language} ${theme}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await fixture(page);
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await (
          await openShellAction(
            page,
            language === "en" ? `Switch to ${theme} theme` : "تغییر به تم تیره",
          )
        ).click();
      }
      const before = await readCanonicalBusinessEvidence(page);
      const dialog = await openEditor(page, language);
      await page.evaluate(() => document.fonts.ready);
      const titleGeometry = await dialog.evaluate((element) => {
        const caption = element.querySelector(".product-editor-caption")!;
        const title = element.querySelector(".product-editor-section-title")!;
        const field = element.querySelector(".field")!;
        return {
          align: getComputedStyle(element).textAlign,
          titleAlign: getComputedStyle(title).textAlign,
          fieldAlign: getComputedStyle(field).textAlign,
          captionBottom: caption.getBoundingClientRect().bottom,
          titleTop: title.getBoundingClientRect().top,
          viewportOverflow: document.documentElement.scrollWidth - innerWidth,
          dialogWidth: element.getBoundingClientRect().width,
        };
      });
      expect(titleGeometry.align).toBe("start");
      expect(titleGeometry.titleAlign).toBe("start");
      expect(titleGeometry.fieldAlign).toBe("start");
      expect(titleGeometry.titleTop).toBeGreaterThanOrEqual(
        titleGeometry.captionBottom,
      );
      expect(titleGeometry.viewportOverflow).toBeLessThanOrEqual(1);
      expect(titleGeometry.dialogWidth).toBeLessThanOrEqual(width);
      const englishName = dialog.getByRole("textbox", {
        name: language === "en" ? "English name" : "نام انگلیسی",
        exact: true,
      });
      await stable(englishName, () =>
        englishName.fill(
          "Fictional Orchard Roasted Kernels With Sea Salt and a Long English Product Name",
        ),
      );
      const empty = dialog.locator(".weight-package-empty");
      expect(
        await empty.evaluate((element) => getComputedStyle(element).textAlign),
      ).toBe("start");
      const cost = dialog.getByRole("textbox", {
        name: language === "en" ? "Cost before tax" : "هزینه پیش از مالیات",
        exact: true,
      });
      await stable(cost, () => cost.fill("4.7312"));
      await expect(
        dialog.locator(".weight-product-cost + .weight-product-price-preview"),
      ).toHaveText(
        language === "en" ? "= $10.43 per kg" : "= $10.43 هر کیلوگرم",
      );
      const newSize = dialog.getByRole("textbox", {
        name: language === "en" ? "New size" : "اندازه جدید",
        exact: true,
      });
      await stable(newSize, () => newSize.fill("250"));
      await chooseOption(
        page,
        dialog.getByRole("combobox", {
          name: language === "en" ? "Package unit" : "واحد بسته",
          exact: true,
        }),
        "g",
      );
      const add = dialog.getByRole("button", {
        name: language === "en" ? "Add size" : "افزودن اندازه",
        exact: true,
      });
      await stable(add, () => add.click());
      const tags = dialog.locator(
        '[data-package-code="staged"] .weight-package-new',
      );
      await expect(tags).toHaveText(
        language === "en" ? ["New", "New"] : ["جدید", "جدید"],
      );
      for (const tag of await tags.all()) {
        const geometry = await tag.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(element).lineHeight),
          whiteSpace: getComputedStyle(element).whiteSpace,
        }));
        expect(geometry.whiteSpace).toBe("nowrap");
        expect(geometry.height).toBeLessThanOrEqual(geometry.line + 12);
      }
      await dialog
        .locator(".weight-product-optional-details > summary")
        .click();
      await expect(
        dialog.getByRole("textbox", { name: /^(Unit size|اندازهٔ واحد)$/ }),
      ).toHaveCount(0);
      const gap = await dialog.evaluate((element) => {
        const descriptions = element.querySelector(
          ".weight-product-optional-details .product-editor-description-row",
        )!;
        const dates = element.querySelector(
          ".weight-product-optional-details .product-date-editor",
        )!;
        return (
          dates.getBoundingClientRect().top -
          descriptions.getBoundingClientRect().bottom
        );
      });
      expect(gap).toBeGreaterThanOrEqual(15);
      expect(gap).toBeLessThanOrEqual(17);
      const alignment = await auditR2fAlignment(page, { scene: "D3" });
      await info.attach("r2g-c1-geometry", {
        body: JSON.stringify({ titleGeometry, gap, alignment }, null, 2),
        contentType: "application/json",
      });
      expect(alignment.failures).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`r2g-c1-${width}-${language}-${theme}.png`),
      });
      await dialog
        .getByRole("button", {
          name: language === "en" ? "Cancel" : "انصراف",
          exact: true,
        })
        .click();
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.products).toEqual(before.products);
      expect(after.approvals).toEqual(before.approvals);
      expect(after.product_code_high_water).toBe(
        before.product_code_high_water,
      );
      expect(errors).toEqual([]);
    });
  }
}

test("R2g C1 saving a real weight draft does not demand hidden Unit size", async ({
  page,
}) => {
  await fixture(page);
  const before = await readCanonicalBusinessEvidence(page);
  const dialog = await openEditor(page, "en");
  await dialog
    .getByRole("textbox", { name: "English name", exact: true })
    .fill("Fictional renamed kernels");
  await dialog
    .getByRole("textbox", { name: "New size", exact: true })
    .fill("250");
  await dialog.getByRole("button", { name: "Add size", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const saved = await readCanonicalBusinessEvidence(page);
  const parent = saved.products.find((product) => product.code === "0016")!;
  expect(parent.unit_size).toBe("");
  expect(parent.name_en).toBe("Fictional renamed kernels");
  const child = saved.products.find(
    (product) => product.package_of_product_id === parent.code,
  )!;
  expect(child.package_size).toBe("250");
  expect(child.code).not.toBe("staged");
  expect(child.barcode).toMatch(/^20\d{11}$/);
  expect(saved.invoices).toEqual(before.invoices);
  expect(saved.ledger).toEqual(before.ledger);
});

test("R2g C1 keeps real visible field peers strict beside a clipped dialog footer @r2g-509", async ({
  page,
}) => {
  await page.setViewportSize({ width: 509, height: 1000 });
  await fixture(page);
  const dialog = await openEditor(page, "en");
  await dialog.locator(".weight-product-optional-details > summary").click();
  const audit = () => auditR2fAlignment(page, { scene: "D3" });
  expect((await audit()).failures).toEqual([]);
  await dialog
    .getByRole("region", { name: "Names", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  const peer = dialog.getByRole("textbox", {
    name: "Persian name (optional)",
    exact: true,
  });
  await expect(peer).toBeInViewport({ ratio: 1 });
  expect((await audit()).failures).toEqual([]);
  await peer.evaluate(
    (element) => (element.style.transform = "translateY(4px)"),
  );
  expect(
    (await audit()).failures.some(
      (failure) =>
        failure.startsWith("row:") && failure.includes("centre Δ4.00"),
    ),
  ).toBe(true);
  await peer.evaluate((element) => element.style.removeProperty("transform"));
  expect((await audit()).failures).toEqual([]);
});

test("R2g C1 rebases repeated package frames and releases them for real user scrolling and reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await fixture(page);
  await setLanguage(page, "fa");
  const before = await readCanonicalBusinessEvidence(page);
  let dialog = await openEditor(page, "fa");
  for (const size of ["250", "500"]) {
    const input = dialog.getByRole("textbox", {
      name: "اندازه جدید",
      exact: true,
    });
    await stable(input, () => input.fill(size));
    const add = dialog.getByRole("button", {
      name: "افزودن اندازه",
      exact: true,
    });
    await stable(add, () => add.click());
  }
  await expect(dialog.locator('[data-package-code="staged"]')).toHaveCount(2);
  const each = dialog
    .getByRole("group", { name: "روش فروش", exact: true })
    .getByRole("button", { name: "عددی", exact: true });
  await stable(each, () => each.click());
  await expect(dialog.locator(".weight-package-section")).toHaveCount(0);
  const body = dialog.locator(".product-editor-body");
  const content = dialog.locator(".weight-product-content");
  const box = await body.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 50);
  await page.mouse.wheel(0, -80);
  await expect
    .poll(() => content.evaluate((element) => element.style.minBlockSize))
    .toBe("");
  await expect
    .poll(() => dialog.evaluate((element) => element.style.blockSize))
    .toBe("");
  const trailing = await content.evaluate((element) => {
    const last = [...element.children]
      .filter((child) => child.getBoundingClientRect().height > 0)
      .at(-1)!;
    return (
      element.getBoundingClientRect().bottom -
      last.getBoundingClientRect().bottom
    );
  });
  expect(Math.abs(trailing)).toBeLessThanOrEqual(1);
  await dialog.getByRole("button", { name: "انصراف", exact: true }).click();
  expect((await readCanonicalBusinessEvidence(page)).products).toEqual(
    before.products,
  );
  dialog = await openEditor(page, "fa");
  expect(
    await dialog
      .locator(".weight-product-content")
      .evaluate((element) => element.style.minBlockSize),
  ).toBe("");
  expect(await dialog.evaluate((element) => element.style.blockSize)).toBe("");
});

for (const width of [360, 390, 509, 760, 1440])
  test(`R2g C1 retains viewport scroll capacity through repeated sold-by round trips at ${width}${width === 509 ? " @r2g-509" : ""}`, async ({
    page,
  }, info) => {
    const language = width === 1440 ? "en" : "fa";
    await page.setViewportSize({ width, height: width === 1440 ? 1500 : 1700 });
    await fixture(page);
    await setLanguage(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    const dialog = await openEditor(page, language);
    for (const size of ["250", "500", "750"]) {
      const input = dialog.getByRole("textbox", {
        name: language === "en" ? "New size" : "اندازه جدید",
        exact: true,
      });
      await stable(input, () => input.fill(size));
      const add = dialog.getByRole("button", {
        name: language === "en" ? "Add size" : "افزودن اندازه",
        exact: true,
      });
      await stable(add, () => add.click());
    }
    const frames = [];
    for (let round = 0; round < 2; round++) {
      await dialog
        .locator(".weight-product-optional-details > summary")
        .click();
      const soldBy = dialog.getByRole("group", {
        name: language === "en" ? "Sold by" : "روش فروش",
        exact: true,
      });
      const each = soldBy.getByRole("button", {
        name: language === "en" ? "Each" : "عددی",
        exact: true,
      });
      await stable(each, () => each.click());
      const body = dialog.locator(".product-editor-body");
      const weight = soldBy.getByRole("button", {
        name: language === "en" ? "By weight" : "وزنی",
        exact: true,
      });
      // Reproduce a partial field-navigation scroll in the held Each frame.
      // The next pointer action must preserve this real viewport capacity.
      const held = await weight.evaluate((element) => {
        const parent = element.closest<HTMLElement>(".product-editor-body")!;
        const available = parent.scrollHeight - parent.clientHeight;
        const visibleRoom =
          element.getBoundingClientRect().top -
          parent.getBoundingClientRect().top +
          parent.scrollTop -
          parseFloat(getComputedStyle(parent).paddingTop);
        const target = Math.min(
          parent.clientHeight / 10,
          available,
          visibleRoom,
        );
        parent.scrollTop = target;
        return {
          available,
          scrollTop: parent.scrollTop,
          viewport: parent.clientHeight,
        };
      });
      expect(held.scrollTop).toBeGreaterThan(0);
      await stable(weight, () => weight.click());
      const afterScroll = await body.evaluate((element) => element.scrollTop);
      expect(Math.abs(afterScroll - held.scrollTop)).toBeLessThanOrEqual(2);
      await expect(weight).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.locator('[data-package-code="staged"]')).toHaveCount(
        3,
      );
      frames.push({ round, ...held, afterScroll });
    }
    await info.attach("viewport-capacity-round-trips", {
      body: JSON.stringify(frames, null, 2),
      contentType: "application/json",
    });
    await dialog
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.products).toEqual(before.products);
    expect(after.product_code_high_water).toBe(before.product_code_high_water);
  });
