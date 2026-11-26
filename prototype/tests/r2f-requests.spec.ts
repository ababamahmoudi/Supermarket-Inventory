import { auditR2fAlignment } from "./r2f-alignment";
import { expectReceivingStable } from "./r2-receiving-helpers";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  chooseOption,
  openShellAction,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { inspect } from "../scripts/c5-browser-proof.mjs";
const variants = [
  { language: "en", theme: "light" },
  { language: "fa", theme: "dark" },
] as const;
async function appearance(
  page: Page,
  language: "en" | "fa",
  theme: "light" | "dark",
) {
  await setLanguage(page, language);
  if ((await page.locator("html").getAttribute("data-theme")) !== theme)
    await (
      await openShellAction(
        page,
        language === "en"
          ? `Switch to ${theme} theme`
          : theme === "dark"
            ? "تغییر به تم تیره"
            : "تغییر به تم روشن",
      )
    ).click();
}
async function addNote(
  page: Page,
  line: Locator,
  note: string,
  language: "en" | "fa",
) {
  await line
    .getByRole("button", {
      name: language === "en" ? "Add note" : "افزودن یادداشت",
      exact: true,
    })
    .click();
  await line
    .getByLabel(language === "en" ? "Note (optional)" : "یادداشت (اختیاری)", {
      exact: true,
    })
    .fill(note);
  expect(
    (
      await inspect(
        page,
        "R2f D10 open note editor",
        language === "fa" ? "fa-dark" : "en-light",
        "owner",
      )
    ).failures,
  ).toEqual([]);
  await line
    .getByRole("button", {
      name: language === "en" ? "Done" : "انجام شد",
      exact: true,
    })
    .click();
  const noteCentres = await line
    .locator(".request-line-note-summary")
    .evaluate((row) => {
      const copy = row.querySelector("span")!.getBoundingClientRect();
      const edit = row.querySelector("button")!.getBoundingClientRect();
      const icon = row.querySelector("svg")!.getBoundingClientRect();
      return [edit, icon].map((rect) =>
        Math.abs(rect.top + rect.height / 2 - copy.top - copy.height / 2),
      );
    });
  for (const difference of noteCentres)
    expect(difference).toBeLessThanOrEqual(1.5);
}
async function rowGeometry(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.locator(".request-form").evaluate((form) => {
    const row = form.querySelector<HTMLElement>(".request-draft-line")!;
    const name = row.querySelector<HTMLElement>(".request-line-name")!;
    const controls = [
      row.querySelector<HTMLElement>(".request-line-quantity input")!,
      row.querySelector<HTMLElement>(".request-line-unit .ui-select")!,
      row.querySelector<HTMLElement>(".request-line-remove")!,
    ].map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
        center: rect.top + rect.height / 2,
      };
    });
    const title = form
      .querySelector<HTMLElement>(".request-items-title")!
      .getBoundingClientRect();
    const direction = getComputedStyle(form).direction;
    const nameRect = name.getBoundingClientRect();
    const caption = form
      .querySelector<HTMLElement>(".request-items-column-head > :nth-child(2)")
      ?.getBoundingClientRect();
    const number = row
      .querySelector<HTMLElement>(".request-line-quantity input")!
      .getBoundingClientRect();
    return {
      controls,
      nameEdge: direction === "rtl" ? nameRect.right : nameRect.left,
      titleEdge: direction === "rtl" ? title.right : title.left,
      captionCenter: caption ? caption.left + caption.width / 2 : null,
      numberCenter: number.left + number.width / 2,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.nameEdge - geometry.titleEdge)).toBeLessThanOrEqual(
    1.5,
  );
  expect(geometry.controls[0].width).toBe(width < 640 ? 72 : 88);
  if (width >= 640) {
    expect(geometry.controls[1].width).toBe(132);
    expect(
      Math.abs(geometry.captionCenter! - geometry.numberCenter),
    ).toBeLessThanOrEqual(1.5);
  }
  if (width < 640) {
    await expect(page.locator(".request-items-column-head")).toBeHidden();
    const footer = await page
      .locator(".request-form-actions")
      .evaluate((row) => {
        const rect = row.getBoundingClientRect();
        return {
          width: rect.width,
          controls: [...row.querySelectorAll("button")].map(
            (control) => control.getBoundingClientRect().width,
          ),
        };
      });
    expect(Math.abs(footer.controls[2] - footer.width)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(footer.controls[0] - footer.controls[1]),
    ).toBeLessThanOrEqual(1);
  }
  expect(geometry.controls[2].width).toBe(44);
  for (const control of geometry.controls) {
    expect(Math.abs(control.height - 44)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(control.center - geometry.controls[0].center),
    ).toBeLessThanOrEqual(1.5);
  }
}
for (const { language, theme } of variants) {
  test(`R2f D10 real draft, Added state, notes and send in ${language} ${theme}`, async ({
    page,
  }, info) => {
    const t = (en: string, fa: string) => (language === "en" ? en : fa);
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await appearance(page, language, theme);
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#requests");
      const before = await readCanonicalBusinessEvidence(page);
      await page
        .getByRole("button", {
          name: t("New request", "درخواست جدید"),
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t("New request", "درخواست جدید"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".request-form-back")).toHaveText(
        t("Branch requests", "درخواست‌های شعب"),
      );
      await chooseOption(
        page,
        page.locator("#request-destination"),
        "Branch 2",
        t("Richmond Hill", "ریچموند هیل"),
      );
      const search = page.locator("#request-products");
      await search.fill("0001");
      const popup = page.locator(".request-search-results");
      await popup
        .getByRole("button", { name: t("Add", "افزودن"), exact: true })
        .click();
      await expect(
        popup.getByRole("button", {
          name: t("Added", "اضافه شد"),
          exact: true,
        }),
      ).toBeDisabled();
      await expect(page.locator(".request-draft-line")).toHaveCount(1);
      const catalog = page.locator(".request-draft-line").first();
      await catalog
        .getByLabel(t("Quantity", "تعداد"), { exact: true })
        .fill("2");
      await chooseOption(
        page,
        catalog.getByLabel(t("Units / Cases", "واحد / کارتن"), { exact: true }),
        "cases",
        t("Cases", "کارتن"),
      );
      await catalog.locator(".request-line-pack-action").click();
      await catalog
        .getByLabel(t("Units per case", "تعداد در کارتن"), { exact: true })
        .fill("12");
      await catalog.locator(".request-line-pack-action").click();
      await search.fill("Fictional bakery tray");
      await expect(
        popup.locator(".request-search-new-text strong"),
      ).toContainText("Fictional bakery tray");
      await expect(popup.locator(".request-search-new-text .muted")).toHaveText(
        t(
          "For things that aren't in the catalog",
          "برای چیزهایی که در فهرست کالا نیستند",
        ),
      );
      await popup
        .getByRole("button", { name: /Fictional bakery tray/ })
        .click();
      const free = page.locator(".request-draft-line").nth(1);
      await free.getByLabel(t("Quantity", "تعداد"), { exact: true }).fill("10");
      await addNote(
        page,
        free,
        t("From the prepared shelf", "از قفسه آماده‌سازی"),
        language,
      );
      await expect(free.locator(".request-line-note-summary")).toContainText(
        t("From the prepared shelf", "از قفسه آماده‌سازی"),
      );
      await rowGeometry(page, width);
      await search.fill("");
      await expectReceivingStable(page, search, async () => {
        await search.pressSequentially(language === "en" ? "Rice" : "برنج");
      });
      await expect(
        popup
          .locator(".request-search-option[data-product-code='0001']")
          .getByRole("button"),
      ).toBeDisabled();
      await expect(popup.locator(".request-search-new")).toBeVisible();
      const focusedInput = await search.evaluate((input) => {
        const style = getComputedStyle(input);
        return {
          outline: style.outlineWidth,
          shadow: style.boxShadow,
          border: style.borderLeftWidth,
        };
      });
      expect(focusedInput).toEqual({
        outline: "0px",
        shadow: "none",
        border: "0px",
      });
      const plus = await popup
        .locator(".request-search-new")
        .evaluate((button) => {
          const icon = button
            .querySelector("[data-icon-text-icon]")!
            .getBoundingClientRect();
          const copy = button
            .querySelector("[data-icon-text-copy]")!
            .getBoundingClientRect();
          return {
            delta: Math.abs(
              icon.top + icon.height / 2 - copy.top - copy.height / 2,
            ),
            width: icon.width,
            height: icon.height,
          };
        });
      expect(plus.delta).toBeLessThanOrEqual(1.5);
      expect(plus.width).toBe(32);
      expect(plus.height).toBe(32);
      await page.screenshot({
        path: info.outputPath(
          `requests-${width}-${theme}-${language}-search.png`,
        ),
      });
      const report = await inspect(
        page,
        "R2f D10 request search",
        language === "fa" ? "fa-dark" : "en-light",
        "owner",
      );
      expect(report.failures).toEqual([]);
      const alignment = await auditR2fAlignment(page, {
        scene: "D10",
        portals: ["request-results"],
      });
      expect(alignment.failures).toEqual([]);

      await search.press("Escape");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`requests-${width}-${theme}-${language}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", {
          name: t("Save as draft", "ذخیره پیش‌نویس"),
          exact: true,
        })
        .dblclick();
      await expect(
        page.locator(".request-detail-heading .badge"),
      ).toContainText(t("Draft", "پیش‌نویس"));
      const saved = (
        await readCanonicalBusinessEvidence(page)
      ).branch_requests!.filter(
        (row) =>
          !(before.branch_requests ?? []).some((old) => old.id === row.id),
      );
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        status: "draft",
        from_branch: "Branch 1",
        to_branch: "Branch 2",
        items: [
          {
            product_code: "0001",
            quantity: "2",
            quantity_unit: "cases",
            units_per_case: 12,
            normalized_units: 24,
          },
          {
            free_text: "Fictional bakery tray",
            quantity: "10",
            quantity_unit: "units",
            note: t("From the prepared shelf", "از قفسه آماده‌سازی"),
          },
        ],
      });
      await page
        .getByRole("button", {
          name: t("Edit draft", "ویرایش پیش‌نویس"),
          exact: true,
        })
        .click();
      await page
        .locator(".request-draft-line")
        .first()
        .getByLabel(t("Quantity", "تعداد"), { exact: true })
        .fill("3");
      await page
        .getByRole("button", { name: t("Cancel", "انصراف"), exact: true })
        .click();
      await expect(
        page.locator(".request-detail-heading .badge"),
      ).toContainText(t("Draft", "پیش‌نویس"));
      expect(
        (await readCanonicalBusinessEvidence(page)).branch_requests!.find(
          (row) => row.id === saved[0].id,
        ),
      ).toEqual(saved[0]);
      await page
        .getByRole("button", {
          name: t("Edit draft", "ویرایش پیش‌نویس"),
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: t("Send request", "ارسال درخواست"),
          exact: true,
        })
        .dblclick();
      await expect(
        page.locator(".request-detail-heading .badge"),
      ).toContainText(t("Requested", "درخواست‌شده"));
      const after = await readCanonicalBusinessEvidence(page);
      expect(
        after.branch_requests!.filter((row) => row.id === saved[0].id),
      ).toHaveLength(1);
      expect(after.stock).toEqual(before.stock);
      expect(after.ledger).toEqual(before.ledger);
    }
  });
}

test("R2f D10 new-item composition audit rejects a shifted icon and forged title", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#requests");
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await page.locator("#request-products").fill("Fictional tray");
  const action = page.locator(".request-search-new");
  await expect(action).toBeVisible();
  expect(
    (await inspect(page, "R2f D10 valid new item", "en-light", "floor_worker"))
      .failures,
  ).toEqual([]);
  await action
    .locator("[data-icon-text-icon]")
    .evaluate(
      (icon) => ((icon as HTMLElement).style.transform = "translateY(4px)"),
    );
  expect(
    (
      await inspect(page, "R2f D10 shifted icon", "en-light", "floor_worker")
    ).failures.join(" "),
  ).toContain("Invalid R2f D10 two-line new-item action composition");
  await action
    .locator("[data-icon-text-icon]")
    .evaluate((icon) => ((icon as HTMLElement).style.transform = ""));
  const title = action.locator(".request-search-new-text > strong");
  const original = await title.innerText();
  await title.evaluate((element) => (element.textContent = "A forged command"));
  expect(
    (
      await inspect(page, "R2f D10 forged title", "en-light", "floor_worker")
    ).failures.join(" "),
  ).toContain("Invalid R2f D10 two-line new-item action composition");
  await title.evaluate(
    (element, text) => (element.textContent = text),
    original,
  );
  expect(
    (
      await inspect(
        page,
        "R2f D10 restored new item",
        "en-light",
        "floor_worker",
      )
    ).failures,
  ).toEqual([]);
});

test("R2f D10 Cashier cannot open the request editor", async ({ page }) => {
  await signIn(page, "Cashier");
  await page.goto("/#requests");
  await expect(page.locator(".request-form")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New request", exact: true }),
  ).toHaveCount(0);
});
