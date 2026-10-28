import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { word } from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const language of ["en", "fa"] as const) {
  test(`R2f D9 original header, toolbar and original bytes in ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await page.goto("/#invoices");
    await page
      .locator(".invoice-saved-table tbody tr")
      .first()
      .locator("td")
      .first()
      .getByRole("link")
      .click();
    await page
      .getByRole("button", { name: "Read invoice", exact: true })
      .click();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    const before = (await readCanonicalBusinessEvidence(page)).invoice;
    await setLanguage(page, language);
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"] as const) {
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
        let scope = page.locator(".original-viewer");
        if (width === 390) {
          await scope.locator(".original-viewer-phone-trigger").click();
          scope = page.getByRole("dialog", {
            name: word(language, "Original invoice", "فاکتور اصلی"),
            exact: true,
          });
        } else {
          const header = scope.locator(".original-viewer-header");
          await expect(
            header.getByRole("heading", {
              name: word(language, "Original invoice", "فاکتور اصلی"),
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            header.locator(".original-viewer-file-name"),
          ).toHaveAttribute("title", before.file_name!);
          const actions = header.locator(
            ".original-viewer-header-actions > button",
          );
          await expect(actions).toHaveCount(2);
          for (const button of await actions.all())
            await expect(button).toHaveClass(/button-plain/);
        }
        const toolbar = scope.getByRole("toolbar", {
          name: word(language, "Original invoice", "فاکتور اصلی"),
          exact: true,
        });
        await expect(toolbar).toBeVisible();
        await expect(toolbar).toHaveCSS("height", "44px");
        expect(
          await toolbar.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        ).toBeLessThanOrEqual(1);
        await expect(
          toolbar.locator(":scope > .invoice-original-control-group"),
        ).toHaveCount(4);
        const previous = toolbar.getByRole("button", {
          name: word(language, "Previous page", "صفحه قبل"),
          exact: true,
        });
        const next = toolbar.getByRole("button", {
          name: word(language, "Next page", "صفحه بعد"),
          exact: true,
        });
        await expect(previous).toBeDisabled();
        await expect(next).toBeDisabled();
        const media = scope.locator(".invoice-original-media");
        await toolbar
          .getByRole("button", {
            name: word(language, "Fit width", "اندازه عرض"),
            exact: true,
          })
          .click();
        while ((await media.getAttribute("data-rotation")) !== "0")
          await toolbar
            .getByRole("button", {
              name: word(language, "Rotate", "چرخش"),
              exact: true,
            })
            .click();
        await toolbar
          .getByRole("button", {
            name: word(language, "Zoom in", "بزرگ‌نمایی"),
            exact: true,
          })
          .click();
        await expect(media).toHaveAttribute("data-zoom", "1.25");
        await toolbar
          .getByRole("button", {
            name: word(language, "Rotate", "چرخش"),
            exact: true,
          })
          .click();
        await expect(media).toHaveAttribute("data-rotation", "90");
        await toolbar
          .getByRole("button", {
            name: word(language, "Fit width", "اندازه عرض"),
            exact: true,
          })
          .click();
        await expect(media).toHaveAttribute("data-zoom", "1");
        await expect(media).toHaveAttribute("data-fit", "width");
        await toolbar
          .getByRole("button", {
            name: word(language, "More", "بیشتر"),
            exact: true,
          })
          .click();
        await page
          .getByRole("menuitem", {
            name: word(language, "Fit page", "اندازه صفحه"),
            exact: true,
          })
          .click();
        await expect(media).toHaveAttribute("data-fit", "page");
        const boxes = await toolbar
          .locator("button")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getBoundingClientRect().toJSON()),
          );
        expect(
          Math.max(...boxes.map((b) => b.y + b.height / 2)) -
            Math.min(...boxes.map((b) => b.y + b.height / 2)),
        ).toBeLessThanOrEqual(1.5);
        expect(boxes.every((b) => Math.abs(b.height - 44) <= 1)).toBe(true);
        await toolbar
          .getByRole("button", {
            name: word(language, "Fit width", "اندازه عرض"),
            exact: true,
          })
          .click();
        while ((await media.getAttribute("data-rotation")) !== "0")
          await toolbar
            .getByRole("button", {
              name: word(language, "Rotate", "چرخش"),
              exact: true,
            })
            .click();
        if (width === 390) {
          const box = await media.boundingBox();
          expect(box!.y + box!.height).toBeLessThanOrEqual(1001);
          await scope
            .getByRole("button", {
              name: word(language, "Close dialog", "بستن پنجره"),
              exact: true,
            })
            .click();
        } else {
          await scope
            .getByRole("button", {
              name: word(language, "Hide original", "پنهان کردن اصل"),
              exact: true,
            })
            .click();
          await expect(scope.locator(".original-viewer-panel")).toBeHidden();
          await scope
            .getByRole("button", {
              name: word(language, "Show original", "نمایش اصل"),
              exact: true,
            })
            .click();
          await expect(scope.locator(".original-viewer-panel")).toBeVisible();
          if (
            width === 1440 &&
            ((language === "en" && theme === "light") ||
              (language === "fa" && theme === "dark"))
          )
            await page.screenshot({
              path: info.outputPath(
                `original-viewer-${width}-${theme}-${language}.png`,
              ),
              fullPage: true,
            });
        }
      }
    }
    // Re-open the genuine original and download through its protected source gate.
    if (info.project.name === "phone")
      await page.locator(".original-viewer-phone-trigger").click();
    const scope =
      info.project.name === "phone"
        ? page.getByRole("dialog", {
            name: word(language, "Original invoice", "فاکتور اصلی"),
            exact: true,
          })
        : page.locator(".original-viewer");
    await scope
      .getByRole("button", {
        name: word(language, "More", "بیشتر"),
        exact: true,
      })
      .click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("menuitem", {
        name: word(language, "Download", "دانلود"),
        exact: true,
      })
      .click();
    const saved = await download;
    const bytes = await readFile((await saved.path())!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      before.file_data!.split(":").at(-1),
    );
    const after = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(after.file_data).toBe(before.file_data);
    expect(after.final_total).toBe(before.final_total);
    expect(after.lines).toEqual(before.lines);
    expect(errors).toEqual([]);
  });
}
