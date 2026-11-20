import { expect, test } from "@playwright/test";
import { inspect, type C5Inspection } from "../scripts/c5-browser-proof.mjs";
import { openShellAction, setLanguage } from "./helpers";
import {
  fillReturnCreation,
  installReturnCreationFixture,
} from "./return-create-r2c-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const language of ["en", "fa"] as const) {
  test(`R2c7.1 new return controls retain the complete C5 contract in ${language}`, async ({
    page,
  }, info) => {
    await installReturnCreationFixture(page);
    await setLanguage(page, language);
    const phone = info.project.name === "phone";
    const theme = phone
      ? language === "en"
        ? "dark"
        : "light"
      : language === "en"
        ? "light"
        : "dark";
    if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
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
    await page.goto("/#returns");
    await expect(page.locator(".returns-overview")).toBeVisible();
    const before = await readCanonicalBusinessEvidence(page);
    const reports: C5Inspection[] = [];
    const audit = async (scene: string) => {
      const report = await inspect(
        page,
        scene,
        `${info.project.name}-${language}-${theme}`,
        "manager",
      );
      reports.push(report);
      return report;
    };
    expect((await audit("Returns New return action")).failures).toEqual([]);
    const newReturn = page.getByRole("button", {
      name: language === "en" ? "New return" : "مرجوعی جدید",
      exact: true,
    });
    expect(
      await newReturn.evaluate(
        (button) => button.getBoundingClientRect().height,
      ),
    ).toBe(44);
    const dialog = await fillReturnCreation(page, language === "fa");
    await dialog
      .getByLabel(
        language === "en" ? "Choose return photos" : "انتخاب عکس‌های مرجوعی",
        { exact: true },
      )
      .setInputFiles("tests/fixtures/r2c-fictional-return-condition.png");
    await expect(dialog.getByRole("status")).toHaveText(
      language === "en" ? "1 photo saved" : "1 عکس ذخیره شد",
    );
    expect(
      (await audit("Filled New return with retained photo")).failures,
    ).toEqual([]);
    if (language === "en") {
      const addPhotos = dialog.getByRole("button", {
        name: "Add photos",
        exact: true,
      });
      const original = await addPhotos.getAttribute("style");
      await addPhotos.evaluate((button) =>
        button.setAttribute(
          "style",
          "height:40px!important;min-height:40px!important;max-height:40px!important",
        ),
      );
      expect(
        (await audit("Wrong creation action height")).failures.some((failure) =>
          failure.startsWith("New return control height:"),
        ),
      ).toBe(true);
      await addPhotos.evaluate(
        (button, original) =>
          original === null
            ? button.removeAttribute("style")
            : button.setAttribute("style", original),
        original,
      );
      await addPhotos.evaluate((button) => (button.style.borderRadius = "4px"));
      expect(
        (await audit("Wrong creation action radius")).failures.some((failure) =>
          failure.startsWith("Text action radius:"),
        ),
      ).toBe(true);
      await addPhotos.evaluate(
        (button, original) =>
          original === null
            ? button.removeAttribute("style")
            : button.setAttribute("style", original),
        original,
      );
      const photos = await dialog.locator(".new-return-photos").elementHandle();
      await photos!.evaluate((section) => section.remove());
      expect((await audit("Missing photo section")).failures).toContain(
        "Invalid New return dialog composition",
      );
      await dialog
        .locator(".ui-dialog-body")
        .evaluate((body, photos) => body.appendChild(photos!), photos);
      await page.locator("main").evaluate((main) => {
        const fake = document.createElement("div");
        fake.id = "counterfeit-new-return";
        fake.className = "new-return-dialog";
        fake.innerHTML =
          '<button class="ui-button button button-neutral" type="button">Counterfeit creation action</button>';
        main.append(fake);
      });
      expect((await audit("Counterfeit creation class")).failures).toContain(
        "Invalid New return dialog composition",
      );
      await page
        .locator("#counterfeit-new-return")
        .evaluate((fake) => fake.remove());
      expect((await audit("Restored creation composition")).failures).toEqual(
        [],
      );
    }
    await dialog
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    await expect(dialog).toBeHidden();
    if (!phone && language === "en") {
      await page.setViewportSize({ width: 1000, height: 900 });
      expect((await audit("1000px New return action")).failures).toEqual([]);
      await newReturn.click();
      await expect(page.locator("dialog.new-return-dialog")).toBeVisible();
      expect((await audit("1000px empty creation dialog")).failures).toEqual(
        [],
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    }
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.returns).toEqual(before.returns);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    await info.attach("New return rendered control audit", {
      body: JSON.stringify(reports, null, 2),
      contentType: "application/json",
    });
  });
}
