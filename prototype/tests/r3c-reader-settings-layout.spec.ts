import { expect, test, type Locator } from "@playwright/test";
import { chooseOption, openShellAction, setLanguage, signIn } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { t } from "./r3-live-reading-helpers";

async function containedReaderControls(card: Locator) {
  const geometry = await card.evaluate((element) => {
    const cardBounds = element.getBoundingClientRect();
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        "input, button, label, .helper, .settings-reader-status p",
      ),
    ).map((control) => {
      const bounds = control.getBoundingClientRect();
      return {
        text: control.getAttribute("aria-label") ?? control.textContent,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        height: bounds.height,
        clipped:
          !(control instanceof HTMLInputElement) &&
          control.scrollWidth > control.clientWidth + 2,
      };
    });
    return {
      card: {
        left: cardBounds.left,
        right: cardBounds.right,
        top: cardBounds.top,
        bottom: cardBounds.bottom,
      },
      controls,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      outside: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((node) => {
          const bounds = node.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            (bounds.left < -2 || bounds.right > innerWidth + 2)
          );
        })
        .map((node) => ({
          tag: node.tagName,
          className: node.className,
          bounds: node.getBoundingClientRect().toJSON(),
        }))
        .slice(0, 20),
    };
  });
  expect(
    geometry.overflow,
    `page horizontal overflow: ${JSON.stringify(geometry.outside)}`,
  ).toBeLessThanOrEqual(2);
  for (const control of geometry.controls) {
    expect(control.left, `${control.text}: left`).toBeGreaterThanOrEqual(
      geometry.card.left - 2,
    );
    expect(control.right, `${control.text}: right`).toBeLessThanOrEqual(
      geometry.card.right + 2,
    );
    expect(control.top, `${control.text}: top`).toBeGreaterThanOrEqual(
      geometry.card.top - 2,
    );
    expect(control.bottom, `${control.text}: bottom`).toBeLessThanOrEqual(
      geometry.card.bottom + 2,
    );
    expect(control.clipped, `${control.text}: clipped`).toBe(false);
  }
}

for (const [language, theme] of [
  ["en", "light"],
  ["en", "dark"],
  ["fa", "light"],
  ["fa", "dark"],
] as const) {
  for (const width of [360, 390, 509, 760, 1440]) {
    test(`R3c F10 actual reader settings fit ${width}px (${language}/${theme})`, async ({
      page,
    }, info) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setViewportSize({ width, height: 800 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await (
          await openShellAction(
            page,
            t(
              language,
              `Switch to ${theme} theme`,
              theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
            ),
          )
        ).click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.goto("/#settings?group=receiving");
      const card = page.getByTestId("reader-settings-card");
      await expect(card).toBeVisible();
      const planned = page
        .locator(".settings-group-content > .settings-form-card")
        .filter({ has: page.locator(".settings-planned-list") });
      await expect(planned).toBeVisible();
      const plannedBefore = await planned.boundingBox();
      const plannedText = await planned.innerText();
      const address = card.getByRole("textbox", {
        name: t(language, "Reader address", "نشانی خواننده"),
        exact: true,
      });
      await expect(address).toHaveValue("http://localhost:5191");
      await expect(address).toHaveAttribute("dir", "ltr");
      await expect(address).toHaveAccessibleDescription(/localhost/);
      await expect(card.locator(":scope > h2")).toHaveCSS(
        "margin-bottom",
        "0px",
      );
      await expect(card.locator(".settings-reader-actions")).toHaveCSS(
        "margin-top",
        "0px",
      );
      await containedReaderControls(card);

      const reset = card.getByRole("button", {
        name: t(language, "Reset reader address", "بازنشانی نشانی خواننده"),
        exact: true,
      });
      const connection = card.getByRole("button", {
        name: t(language, "Test connection", "آزمایش اتصال"),
        exact: true,
      });
      const resetBounds = (await reset.boundingBox())!;
      const connectionBounds = (await connection.boundingBox())!;
      expect(Math.abs(resetBounds.y - connectionBounds.y)).toBeLessThanOrEqual(
        2,
      );
      for (const control of [resetBounds, connectionBounds])
        expect(control.height).toBeGreaterThanOrEqual(width <= 760 ? 44 : 40);

      await chooseOption(
        page,
        card.getByRole("combobox", {
          name: t(language, "Reading mode", "حالت خواندن"),
          exact: true,
        }),
        "live",
        t(language, "Live", "زنده"),
      );
      const custom = "http://fictional-reader.test:5191/base";
      await address.fill(custom);
      const cancel = card.getByRole("button", {
        name: t(language, "Cancel", "لغو"),
        exact: true,
      });
      const save = card.getByRole("button", {
        name: t(language, "Save changes", "ذخیره تغییرات"),
        exact: true,
      });
      await expect(cancel).toBeVisible();
      await expect(save).toBeVisible();
      await containedReaderControls(card);
      await cancel.click();
      await expect(address).toHaveValue("http://localhost:5191");
      await expect(save).toHaveCount(0);
      await address.fill(custom);
      await save.click();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).config.receiving
              .ai_reader_address,
        )
        .toBe(custom);
      await expect(address).toHaveValue(custom);
      await expect(save).toHaveCount(0);

      let healthCalls = 0;
      await page.route(
        "http://fictional-reader.test:5191/base/health",
        async (route) => {
          healthCalls += 1;
          await route.fulfill({
            status: 503,
            headers: { "access-control-allow-origin": "*" },
            body: "Fictional unavailable reader",
          });
        },
      );
      await connection.click();
      await expect(card.locator(".settings-reader-status")).toContainText(
        "HTTP 503",
      );
      await containedReaderControls(card);
      expect(healthCalls).toBe(1);
      const plannedAfter = (await planned.boundingBox())!;
      expect(plannedAfter.width).toBe(plannedBefore!.width);
      expect(plannedAfter.height).toBe(plannedBefore!.height);
      expect(await planned.innerText()).toBe(plannedText);
      expect(pageErrors).toEqual([]);
      await card.screenshot({
        path: info.outputPath(`f10-settings-${width}-${language}-${theme}.png`),
      });
    });
  }
}
