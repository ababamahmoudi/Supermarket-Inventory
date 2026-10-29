import { expect, test, type Locator } from "@playwright/test";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import {
  openC8PriceDialog,
  readC8State,
} from "../scripts/capture-c8-proof.mjs";

async function top(control: Locator) {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  return box!.y;
}
async function stableClick(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  const before = await top(control);
  await control.click();
  await expect
    .poll(async () => Math.abs((await top(control)) - before))
    .toBeLessThanOrEqual(2);
  const after = await top(control);
  return { before, after, delta: after - before };
}

for (const width of [360, 390, 509, 760, 1440]) {
  for (const lang of ["en", "fa"] as const) {
    test(`R2g B2 price composition, real warning and stable controls ${width} ${lang}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1100 : 900,
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await signIn(page, "Manager");
      await setBranch(page, "Branch 1");
      await setLanguage(page, lang);
      const theme = lang === "fa" ? "dark" : "light";
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        const toggle = await openShellAction(
          page,
          lang === "fa" ? "تغییر به تم تیره" : "Switch to light theme",
        );
        await toggle.click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const before = await readC8State(page);
      const dialog = await openC8PriceDialog(page, "0002");
      const price = dialog.locator(".change-price-amount-field input");
      await expect(price).toHaveValue("");
      await expect(dialog.locator(".dialog-description")).toContainText(
        lang === "en" ? "now" : "اکنون",
      );
      await expect(dialog.locator(".change-price-facts")).toHaveCount(0);
      await expect(dialog.locator(".change-price-summary p")).toHaveCount(0);
      const choices = dialog.locator(".change-price-choices > [role=radio]");
      await expect(choices).toHaveCount(2);
      const choiceBoxes = await choices.evaluateAll((elements) =>
        elements.map((element) => ({
          x: element.getBoundingClientRect().x,
          y: element.getBoundingClientRect().y,
          width: element.getBoundingClientRect().width,
        })),
      );
      expect(Math.abs(choiceBoxes[0].y - choiceBoxes[1].y)).toBeLessThanOrEqual(
        1.5,
      );
      expect(
        Math.abs(choiceBoxes[0].width - choiceBoxes[1].width),
      ).toBeLessThanOrEqual(1.5);
      const height = await price.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(Math.abs(height - 52)).toBeLessThanOrEqual(1.5);
      const currencyGeometry = await price.evaluate((input) => {
        const symbol = input
          .parentElement!.querySelector(":scope > span")!
          .getBoundingClientRect();
        const style = getComputedStyle(input);
        return {
          direction: style.direction,
          gap:
            input.getBoundingClientRect().left +
            parseFloat(style.paddingLeft) +
            parseFloat(style.borderLeftWidth) -
            symbol.right,
        };
      });
      expect(currencyGeometry.direction).toBe("ltr");
      expect(currencyGeometry.gap).toBeGreaterThanOrEqual(2);
      const picks = dialog.locator(".change-price-quick-picks > button");
      await expect(picks).toHaveCount(4);
      const pickBoxes = await picks.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().toJSON()),
      );
      for (const box of pickBoxes) {
        expect(Math.abs(box.y - pickBoxes[0].y)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(box.height - 52)).toBeLessThanOrEqual(1.5);
      }
      const emptyPriceTop = await top(price);
      await price.fill("1.39");
      await expect(dialog.locator(".change-price-facts")).toBeVisible();
      await expect(dialog.locator(".change-price-warning")).toHaveCount(0);
      if (width === 1440) {
        const normalBody = await dialog
          .locator(".change-price-body")
          .evaluate((element) => ({
            content: element.scrollHeight,
            visible: element.clientHeight,
          }));
        expect(normalBody.content - normalBody.visible).toBeLessThanOrEqual(1);
      }
      await dialog.screenshot({
        path: testInfo.outputPath(
          `change-price-normal-${width}-${theme}-${lang}.png`,
        ),
      });
      const originalTop = await top(price);
      expect(Math.abs(originalTop - emptyPriceTop)).toBeLessThanOrEqual(2);
      await price.fill("0.89");
      const warning = dialog.locator(".change-price-warning");
      await expect(warning).toHaveCount(1);
      await expect(warning).toHaveClass(/change-price-margin-warning/);
      await expect(warning).toHaveClass(/change-price-cost-warning/);
      await expect
        .poll(async () => Math.abs((await top(price)) - originalTop))
        .toBeLessThanOrEqual(2);
      const reason = warning.locator("input");
      await expect(reason).toHaveCount(1);
      const reasonGeometry = await reason.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const warning = element.closest(".change-price-warning")!;
        const outer = warning.getBoundingClientRect();
        const style = getComputedStyle(warning);
        return {
          start: box.left - outer.left - parseFloat(style.paddingLeft),
          end: outer.right - box.right - parseFloat(style.paddingRight),
        };
      });
      expect(Math.abs(reasonGeometry.start)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(reasonGeometry.end)).toBeLessThanOrEqual(1.5);
      await reason.scrollIntoViewIfNeeded();
      await reason.click();
      const reasonTop = await top(reason);
      await reason.pressSequentially(
        "Fictional clearance reviewed before Friday",
        { delay: 1 },
      );
      await expect(reason).toHaveValue(
        "Fictional clearance reviewed before Friday",
      );
      await expect(reason).toBeFocused();
      await expect
        .poll(async () => Math.abs((await top(reason)) - reasonTop))
        .toBeLessThanOrEqual(2);
      const acknowledgement = warning.getByRole("checkbox");
      const acknowledgementStability = await stableClick(acknowledgement);
      await expect(acknowledgement).toBeChecked();
      await expect(warning).toHaveCount(1);
      const ends = dialog.getByRole("group", {
        name: lang === "en" ? "Ends" : "پایان",
        exact: true,
      });
      await expect(ends.getByRole("button")).toHaveCount(5);
      await expect(
        ends.getByRole("button", {
          name: lang === "en" ? "2 weeks" : "۲ هفته",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      const starts = dialog.getByRole("group", {
        name: lang === "en" ? "Starts" : "شروع",
        exact: true,
      });
      const startChangeStability = await stableClick(
        starts.getByRole("button", {
          name: lang === "en" ? "Tomorrow" : "فردا",
          exact: true,
        }),
      );
      await expect(
        ends.getByRole("button", {
          name: lang === "en" ? "2 weeks" : "۲ هفته",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        dialog.getByRole("button", {
          name: lang === "en" ? "Last day" : "آخرین روز",
          exact: true,
        }),
      ).toHaveCount(0);
      const dateRevealStability = await stableClick(
        ends.getByRole("button", {
          name: lang === "en" ? "Date…" : "تاریخ…",
          exact: true,
        }),
      );
      await expect(
        dialog.getByRole("button", {
          name: lang === "en" ? "Last day" : "آخرین روز",
          exact: true,
        }),
      ).toBeVisible();
      const noEndStability = await stableClick(
        ends.getByRole("button", {
          name: lang === "en" ? "No end" : "بدون پایان",
          exact: true,
        }),
      );
      await expect(dialog.locator(".change-price-until")).toHaveCount(0);
      const geometry = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const body = element.querySelector(".change-price-body")!;
        const footer = element.querySelector(".ui-dialog-actions")!;
        const buttons = Array.from(footer.querySelectorAll("button")).map(
          (button) => button.getBoundingClientRect().toJSON(),
        );
        return {
          x: box.x,
          right: box.right,
          y: box.y,
          bottom: box.bottom,
          width: box.width,
          bodyScrollbar: getComputedStyle(body).scrollbarWidth,
          buttons,
          overflow: element.scrollWidth > element.clientWidth + 1,
        };
      });
      expect(geometry.x).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.y).toBeGreaterThanOrEqual(-1);
      expect(geometry.bottom).toBeLessThanOrEqual(
        (width === 1440 ? 1100 : 900) + 1,
      );
      expect(geometry.bodyScrollbar).toBe("none");
      expect(geometry.overflow).toBe(false);
      if (width <= 760) {
        for (const button of geometry.buttons)
          expect(Math.abs(button.height - 44)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(geometry.width - width)).toBeLessThanOrEqual(1.5);
        expect(
          Math.abs(geometry.buttons[0].width - geometry.buttons[1].width),
        ).toBeLessThanOrEqual(1.5);
        expect(
          Math.abs(geometry.buttons[0].y - geometry.buttons[1].y),
        ).toBeLessThanOrEqual(1.5);
      } else expect(Math.abs(geometry.width - 720)).toBeLessThanOrEqual(1.5);
      await dialog.locator(".change-price-body").evaluate((element) => {
        element.scrollTop = 0;
      });
      await dialog.screenshot({
        path: testInfo.outputPath(
          `change-price-warning-${width}-${theme}-${lang}.png`,
        ),
      });
      await testInfo.attach("stability", {
        body: JSON.stringify(
          {
            currencyGeometry,
            emptyPriceTop,
            normalPriceTop: originalTop,
            reasonBefore: reasonTop,
            acknowledgementStability,
            startChangeStability,
            dateRevealStability,
            noEndStability,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
      await testInfo.attach("geometry", {
        body: JSON.stringify(geometry, null, 2),
        contentType: "application/json",
      });
      await dialog
        .getByRole("button", {
          name: lang === "en" ? "Cancel" : "انصراف",
          exact: true,
        })
        .click();
      await expect(dialog).toBeHidden();
      const after = await readC8State(page);
      expect({
        invoices: after.invoices,
        invoice: after.invoice,
        stock: after.stock,
        ledger: after.ledger,
        sales: after.sales,
        products: after.products,
      }).toEqual({
        invoices: before.invoices,
        invoice: before.invoice,
        stock: before.stock,
        ledger: before.ledger,
        sales: before.sales,
        products: before.products,
      });
      expect(errors).toEqual([]);
    });
  }
}

for (const lang of ["en", "fa"] as const) {
  test(`R2g B2 validated 52px price composition rejects counterfeit and shifted geometry ${lang} @r2g-509`, async ({
    page,
  }) => {
    const { inspect } = await import("../scripts/c5-browser-proof.mjs");
    await page.setViewportSize({ width: 509, height: 900 });
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, lang);
    const dialog = await openC8PriceDialog(page, "0002");
    const pick = dialog.locator(".change-price-quick-picks > button").first();
    const price = dialog.locator(".change-price-amount-field input");
    const audit = async () =>
      (
        await inspect(
          page,
          "R2g B2 approved price composition",
          lang,
          "manager",
        )
      ).failures;
    expect(await audit()).toEqual([]);
    await pick.evaluate((element) => {
      element.style.setProperty("block-size", "48px");
      element.style.setProperty("min-block-size", "48px");
    });
    expect(
      (await audit()).some(
        (failure: string) =>
          failure.startsWith("Text action height:") && failure.includes("48px"),
      ),
    ).toBe(true);
    await pick.evaluate((element) => element.removeAttribute("style"));
    await price.evaluate((element) => {
      element.style.paddingInlineStart = "0px";
    });
    expect(await audit()).toContain(
      "R2g currency adornment must not overlap price text",
    );
    await price.evaluate((element) => element.removeAttribute("style"));
    await price.evaluate((element) => {
      element.dataset.savedLabel = element.getAttribute("aria-labelledby")!;
      element.removeAttribute("aria-labelledby");
    });
    expect(await audit()).toContain("Invalid R2g price-change composition");
    expect(await audit()).toContain(
      "R2g price quick pick outside the validated form",
    );
    await price.evaluate((element) => {
      element.setAttribute("aria-labelledby", element.dataset.savedLabel!);
      delete element.dataset.savedLabel;
    });
    await dialog.locator(".change-price-content").evaluate((content) => {
      const copy = content
        .querySelector(".change-price-quick-picks")!
        .cloneNode(true) as HTMLElement;
      copy.dataset.counterfeitPricePicks = "";
      content.append(copy);
    });
    expect(await audit()).toContain(
      "R2g price quick pick outside the validated form",
    );
    await dialog
      .locator("[data-counterfeit-price-picks]")
      .evaluate((element) => element.remove());
    await pick.evaluate((element) => {
      element.style.transform = "translateY(4px)";
    });
    expect(await audit()).toContain(
      "R2g price quick picks must share one level equal-width row",
    );
    await pick.evaluate((element) => element.removeAttribute("style"));
    await price.evaluate((element) => {
      element.style.setProperty("block-size", "48px");
      element.style.setProperty("min-block-size", "48px");
    });
    expect(await audit()).toContain("R2g price entry must be 52px");
    await price.evaluate((element) => element.removeAttribute("style"));
    expect(await audit()).toEqual([]);
  });
}
