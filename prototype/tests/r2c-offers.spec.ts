import { expect, test, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";

const word = (language: "en" | "fa", english: string, persian: string) =>
  language === "en" ? english : persian;

async function fixture(page: Page) {
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "Branch 1");
  await runCanonicalBusinessFixture(
    page,
    (draft) => {
      const product = draft.products.find(
        (row) =>
          row.code === "0009" &&
          row.company_id === draft.config.company.seed_key,
      )!;
      const mapping = draft.config.promotions.price_to_offer.find(
        (row) => row.price === "3.99",
      );
      if (!product || !mapping || mapping.offer !== "2 for $7")
        throw new Error(
          "The independent offer proof requires the configured 3.99 offer.",
        );
      product.status = "active";
      product.selling_price = "3.99";
      product.branch_prices = { ...product.branch_prices, "Branch 1": "3.99" };
      draft.offers.push({
        id: "r2c-fictional-suggestion",
        company_id: product.company_id,
        branch: "Branch 1",
        product_code: product.code,
        label: mapping.offer,
        price: "3.99",
        pool: mapping.mix_and_match_pool,
        currency: draft.config.company.currency,
        status: "suggested",
        mix_and_match: true,
        scope: "branch",
      });
    },
    undefined,
  );
  await page.goto("/#offers");
  await page.reload();
  await expect(
    page
      .locator(".offer-task")
      .filter({ has: page.locator('a[href="#product?code=0009"]') }),
  ).toHaveCount(1);
}

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const)
    for (const theme of ["light", "dark"] as const) {
      test(`R2c offer hierarchy and stable create form ${width} ${language} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await fixture(page);
        await setLanguage(page, language);
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              word(
                language,
                `Switch to ${theme} theme`,
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        const task = page
          .locator(".offer-task")
          .filter({ has: page.locator('a[href="#product?code=0009"]') });
        await expect(task).toHaveCount(1);
        await expect(task.locator(".r2c-offer-summary")).toContainText("$3.99");
        await expect(task.locator(".r2c-offer-summary")).toContainText("$0.98");
        const hierarchy = await task.evaluate((node) => {
          const name = node.querySelector("h3 .product-name strong")!;
          const linkProbe = document.createElement("span");
          linkProbe.style.color = "var(--link-text)";
          linkProbe.style.backgroundColor = "var(--surface)";
          node.append(linkProbe);
          const linkColor = getComputedStyle(linkProbe).color;
          const fieldSurface = getComputedStyle(linkProbe).backgroundColor;
          linkProbe.remove();
          const terms = node.querySelector(".r2c-offer-terms")!;
          return {
            nameSize: parseFloat(getComputedStyle(name).fontSize),
            termsSize: parseFloat(getComputedStyle(terms).fontSize),
            nameColor: getComputedStyle(name.closest("a")!).color,
            linkColor,
            fieldSurface,
            dateFields: [...node.querySelectorAll(".field .ui-date")].map(
              (field) => ({
                background: getComputedStyle(field).backgroundColor,
                height: field.getBoundingClientRect().height,
                widthGap: Math.abs(
                  field.getBoundingClientRect().width -
                    field.closest(".field")!.getBoundingClientRect().width,
                ),
              }),
            ),
            nameTop: name.getBoundingClientRect().top,
            termsTop: terms.getBoundingClientRect().top,
            actions: [
              ...node.querySelectorAll(".r2c-offer-actions button"),
            ].map((button) => button.getBoundingClientRect().height),
          };
        });
        expect(hierarchy.nameSize).toBe(16);
        expect(hierarchy.nameColor).toBe(hierarchy.linkColor);
        expect(hierarchy.dateFields).toHaveLength(2);
        expect(
          hierarchy.dateFields.filter(
            (field) =>
              field.background !== hierarchy.fieldSurface ||
              Math.abs(field.height - 44) > 1 ||
              field.widthGap > 2,
          ),
        ).toEqual([]);
        expect(
          (await inspect(page, "offers", `${language}-${theme}`, "manager"))
            .failures,
        ).toEqual([]);
        expect(hierarchy.termsSize).toBeGreaterThanOrEqual(24);
        expect(hierarchy.termsTop).toBeGreaterThan(hierarchy.nameTop);
        expect(hierarchy.actions).toEqual([44, 44]);
        await page.screenshot({
          path: test
            .info()
            .outputPath(`suggestion-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        const before = await readCanonicalBusinessEvidence(page);
        await page
          .getByRole("button", {
            name: word(language, "Create offer", "ایجاد پیشنهاد"),
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog", {
          name: word(language, "Create offer", "ایجاد پیشنهاد"),
          exact: true,
        });
        const product = dialog.getByRole("combobox", {
          name: word(language, "Product", "کالا"),
          exact: true,
        });
        const initial = await product.boundingBox();
        await product.click();
        const search = page.getByRole("textbox", {
          name: word(language, "Search options", "جستجوی گزینه‌ها"),
          exact: true,
        });
        await search.fill("0009");
        await expect(page.getByRole("option")).toHaveCount(2);
        await page
          .getByRole("option", { name: /0009[\u2066-\u2069]*$/ })
          .click();
        await expect(
          dialog.getByRole("textbox", {
            name: word(language, "Regular price", "قیمت عادی"),
            exact: true,
          }),
        ).toHaveValue("$3.99");
        await expect(
          dialog.getByRole("textbox", {
            name: word(language, "Offer quantity", "تعداد پیشنهاد"),
            exact: true,
          }),
        ).toHaveValue("2");
        await expect(
          dialog.getByRole("textbox", {
            name: word(language, "Offer total", "مبلغ پیشنهاد"),
            exact: true,
          }),
        ).toHaveValue("$7.00");
        const selected = await product.boundingBox();
        expect(Math.abs(selected!.y - initial!.y)).toBeLessThanOrEqual(2);
        const geometry = await dialog.evaluate((node) => {
          const visible = (el: Element) => el.getClientRects().length > 0;
          const controls = [
            ...node.querySelectorAll(
              ".ui-field input,.field input,.ui-field [role=combobox],.field [role=combobox],.field .ui-date",
            ),
          ].filter(visible);
          const grids = [...node.querySelectorAll(".grid-2")]
            .map((grid) => {
              const boxes = [...grid.querySelectorAll(":scope > .field")]
                .map((field) => ({
                  field: field.getBoundingClientRect(),
                  control: field
                    .querySelector("input,[role=combobox],.ui-date")
                    ?.getBoundingClientRect(),
                }))
                .filter((row) => row.control);
              return boxes.flatMap((row, index) =>
                boxes
                  .slice(index + 1)
                  .filter(
                    (other) => Math.abs(other.field.top - row.field.top) <= 1,
                  )
                  .map((other) =>
                    Math.abs(other.control!.top - row.control!.top),
                  ),
              );
            })
            .flat();
          return {
            controls: controls.map((el) => ({
              height: el.getBoundingClientRect().height,
              widthGap: Math.abs(
                el.getBoundingClientRect().width -
                  el.closest(".field")!.getBoundingClientRect().width,
              ),
              outside:
                el.getBoundingClientRect().left <
                  node.getBoundingClientRect().left ||
                el.getBoundingClientRect().right >
                  node.getBoundingClientRect().right,
            })),
            grids,
            overflow: document.documentElement.scrollWidth - innerWidth,
            columns: getComputedStyle(
              node.querySelector(".r2c-offer-fields")!,
            ).gridTemplateColumns.split(" ").length,
            footer: [
              ...node.querySelectorAll(":scope > .ui-dialog-footer button"),
            ].map((el) => el.getBoundingClientRect().height),
          };
        });
        expect(geometry.controls.length).toBe(8);
        expect(
          (
            await inspect(
              page,
              "offer-create",
              `${language}-${theme}`,
              "manager",
            )
          ).failures,
        ).toEqual([]);
        expect(
          geometry.controls.filter(
            (row) =>
              row.outside || Math.abs(row.height - 44) > 1 || row.widthGap > 2,
          ),
        ).toEqual([]);
        expect(geometry.grids.every((delta) => delta <= 2)).toBe(true);
        expect(geometry.columns).toBe(width < 760 ? 1 : 2);
        expect(geometry.footer).toEqual([44, 44]);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: test
            .info()
            .outputPath(`create-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        await dialog
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
        const after = await readCanonicalBusinessEvidence(page);
        expect(after.products).toEqual(before.products);
        expect(after.offers).toEqual(before.offers);
        expect(after.ledger).toEqual(before.ledger);
        expect(after.stock_movements).toEqual(before.stock_movements);
        expect(errors).toEqual([]);
      });
    }

test("R2c suggestion confirmation retains real audited offer actions", async ({
  page,
}) => {
  await fixture(page);
  const before = await readCanonicalBusinessEvidence(page);
  const task = page
    .locator(".offer-task")
    .filter({ has: page.locator('a[href="#product?code=0009"]') });
  await task
    .getByRole("button", { name: "Confirm offer: 2 for $7.00", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).offers.find(
          (row) => row.id === "r2c-fictional-suggestion",
        )?.status,
    )
    .toBe("active");
  const after = await readCanonicalBusinessEvidence(page);
  expect(
    after.products.find((row) => row.code === "0009")?.branch_prices?.[
      "Branch 1"
    ],
  ).toBe("3.99");
  expect(after.activity.slice(before.activity.length)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "Confirm offer",
        actor_user_id: "demo-person-manager",
      }),
    ]),
  );
});

test("R2c suggestion dismissal retains its real audit without changing prices", async ({
  page,
}) => {
  await fixture(page);
  const before = await readCanonicalBusinessEvidence(page);
  const task = page
    .locator(".offer-task")
    .filter({ has: page.locator('a[href="#product?code=0009"]') });
  await task.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).offers.find(
          (row) => row.id === "r2c-fictional-suggestion",
        )?.status,
    )
    .toBe("stopped");
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.products).toEqual(before.products);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  expect(after.activity.slice(before.activity.length)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "Dismiss",
        actor_user_id: "demo-person-manager",
      }),
    ]),
  );
});

test("R2c offer audit rejects short controls, missing composition and copied classes", async ({
  page,
}) => {
  await fixture(page);
  await page
    .locator(".r2c-offers-page > .page-header button")
    .evaluate((button) =>
      button.setAttribute(
        "style",
        "height:40px!important;min-height:40px!important;max-height:40px!important",
      ),
    );
  expect(
    (await inspect(page, "offers-short", "en-light", "manager")).failures.some(
      (failure) => failure.startsWith("R2c control height:"),
    ),
  ).toBe(true);
  await page.reload();
  await page
    .locator(".r2c-offers-page > .ui-segments")
    .evaluate((tabs) => tabs.remove());
  expect(
    (await inspect(page, "offers-missing", "en-light", "manager")).failures,
  ).toContain("Invalid R2c screen composition: offers");
  await page.reload();
  await expect(page.locator(".r2c-offers-page .offer-task")).toHaveCount(1);
  await page.locator("main").evaluate((main) => {
    const fake = document.createElement("div");
    fake.className = "r2c-screen";
    fake.dataset.r2cScreen = "offers";
    fake.innerHTML = '<button type="button">Copied opt-in</button>';
    main.append(fake);
  });
  expect(
    (await inspect(page, "offers-copied", "en-light", "manager")).failures,
  ).toContain("Invalid R2c screen composition: offers");
});
