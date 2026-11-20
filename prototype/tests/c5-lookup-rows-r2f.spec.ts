import { expect, test } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const)
    test(`C5 genuine Lookup rows retain 44px and reject copied controls ${width} ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await setBranch(page, "Branch 1");
      await setLanguage(page, language);
      if (language === "fa")
        await (await openShellAction(page, "تغییر به تم تیره")).click();
      await page.goto("/#lookup?search=0001");
      const detail = page.locator(".lookup-detail");
      await expect(detail.locator(".lookup-product-meta")).toContainText(
        "0001",
      );
      const audit = () =>
        inspect(page, "genuine Lookup rows", `${language}-${width}`, "manager");
      const filters = page.getByRole("button", {
        name: language === "en" ? "Filters" : "فیلترها",
        exact: true,
      });
      await expect(filters).toHaveAttribute("aria-expanded", "false");
      const closed = await audit();
      expect(closed.failures).toEqual([]);
      expect(
        closed.buttons.some((entry) =>
          entry.className.includes("lookup-category-more"),
        ),
      ).toBe(false);
      await filters.click();
      await expect(filters).toHaveAttribute("aria-expanded", "true");
      const popup = page.getByRole("dialog", {
        name: language === "en" ? "Filters" : "فیلترها",
        exact: true,
      });
      for (const select of await popup.getByRole("combobox").all())
        expect((await select.boundingBox())!.height).toBe(44);
      await popup
        .getByRole("button", {
          name: language === "en" ? "Done" : "تمام",
          exact: true,
        })
        .click();
      const category = filters;
      const edit = detail
        .locator(".product-header-actions > button[aria-label]")
        .filter({ hasText: language === "en" ? "Edit" : "ویرایش" })
        .first();
      await expect(edit).toBeVisible();
      const valid = await audit();
      expect(valid.failures).toEqual([]);
      for (const control of [category, edit])
        expect((await control.boundingBox())!.height).toBe(44);

      // A real opted-in row still rejects an undersized44px peer.
      await category.evaluate((node) =>
        Object.assign((node as HTMLElement).style, {
          blockSize: "40px",
          minBlockSize: "40px",
          maxBlockSize: "40px",
        }),
      );
      expect(
        (await audit()).failures.some((failure) =>
          failure.startsWith("Text action height:"),
        ),
      ).toBe(true);
      await category.evaluate((node) =>
        (node as HTMLElement).removeAttribute("style"),
      );

      // A copied class outside the actual search/detail composition is no waiver.
      await page.locator("main").evaluate((main) => {
        const source = main.querySelector(
          ".product-header-actions > button[aria-label]",
        )!;
        const copy = document.createElement("div");
        copy.id = "forged-lookup-row";
        copy.className = "product-header-actions ui-control-row";
        copy.append(source.cloneNode(true));
        main.append(copy);
      });
      expect(
        (await audit()).failures.some((failure) =>
          failure.startsWith("Lookup 44px row outside"),
        ),
      ).toBe(true);
      await page
        .locator("#forged-lookup-row")
        .evaluate((node) => node.remove());

      // The edit action must name the product actually shown by this source row.
      const originalName = await edit.getAttribute("aria-label");
      await edit.evaluate(
        (node, name) => node.setAttribute("aria-label", name),
        language === "en"
          ? "Edit a different fictional product"
          : "ویرایش کالای خیالی دیگر",
      );
      expect(
        (await audit()).failures.some((failure) =>
          failure.startsWith("Lookup 44px row outside"),
        ),
      ).toBe(true);
      await edit.evaluate(
        (node, name) => node.setAttribute("aria-label", name!),
        originalName,
      );
      expect((await audit()).failures).toEqual([]);
    });
