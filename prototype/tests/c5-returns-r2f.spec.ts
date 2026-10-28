import { expect, test } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { setLanguage, signIn } from "./helpers";
import { installLocationReturnScene } from "./r2f-location-return-fixture";

for (const language of ["en", "fa"] as const)
  for (const role of ["Manager", "Cashier"] as const)
    test(`C5 genuine Returns cards and separated count retain source guards ${language} ${role}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const scene = await installLocationReturnScene(page);
      if (role === "Cashier") await signIn(page, role);
      await expect(page.locator(".mobile-more-menu")).toBeVisible();
      await setLanguage(page, language);
      await page.goto("/#returns");
      const root = page.locator("main > .returns-overview");
      const rows = root.locator(".returns-overview-table tbody > tr");
      await expect(rows).toHaveCount(3);
      const audit = () => inspect(page, "D8 genuine Returns", language, role);
      const valid = await audit();
      expect(valid.failures).toEqual([]);
      expect(valid.toolbarGroups).toHaveLength(1);
      expect(valid.toolbarGroups[0].gap).toBeGreaterThan(16.5);
      expect(valid.toolbarGroups[0].centerDifference).toBeLessThanOrEqual(1);
      const first = rows.first();
      const supplier = first.locator(".return-phone-supplier > a > bdi");
      const retainedSupplier = await supplier.textContent();
      await supplier.evaluate(
        (node) => (node.textContent = "Not the retained supplier"),
      );
      expect((await audit()).failures).toContain(
        "Invalid retained Returns phone composition",
      );
      await supplier.evaluate(
        (node, name) => (node.textContent = name),
        retainedSupplier,
      );
      const link = first.locator(".return-phone-next .table-row-link");
      const href = `#return?id=${scene.records[0].id}`;
      await expect(link).toHaveAttribute("href", href);
      await link.evaluate((node) =>
        node.setAttribute("href", "#return?id=forged"),
      );
      expect((await audit()).failures).toContain(
        "Invalid retained Returns phone composition",
      );
      await link.evaluate(
        (node, href) => node.setAttribute("href", href),
        href,
      );
      await link.evaluate(
        (node) => ((node as HTMLElement).style.transform = "translateX(4px)"),
      );
      expect((await audit()).failures).toContain(
        "Compact phone navigation is not at the visual row end",
      );
      await link.evaluate((node) =>
        (node as HTMLElement).style.removeProperty("transform"),
      );
      const credit = first.locator(".return-phone-meta > :last-child");
      if (role === "Cashier") {
        await expect(credit).toHaveText("");
        await credit.evaluate((node) => (node.textContent = "$999.00"));
        expect((await audit()).failures).toContain(
          "Invalid retained Returns phone composition",
        );
        await credit.evaluate((node) => (node.textContent = ""));
      }
      const count = root.locator(
        ".returns-toolbar-end > span[aria-live] > bdi",
      );
      const retainedCount = await count.textContent();
      await count.evaluate((node) => (node.textContent = "99"));
      expect(
        (await audit()).failures.some((failure) =>
          failure.startsWith("Columns separated from result count:"),
        ),
      ).toBe(true);
      await count.evaluate(
        (node, value) => (node.textContent = value),
        retainedCount,
      );
      const columns = root.locator(".returns-toolbar-end > button");
      for (const shift of ["translateX(4px)", "translateY(4px)"]) {
        await columns.evaluate(
          (node, shift) => ((node as HTMLElement).style.transform = shift),
          shift,
        );
        expect(
          (await audit()).failures.some((failure) =>
            failure.startsWith("Columns separated from result count:"),
          ),
        ).toBe(true);
      }
      await columns.evaluate((node) =>
        (node as HTMLElement).style.removeProperty("transform"),
      );
      await root.evaluate((node) => {
        const copy = node.cloneNode(true) as HTMLElement;
        copy.id = "forged-returns-composition";
        node.parentElement!.append(copy);
      });
      expect((await audit()).failures).toContain(
        "Invalid retained Returns phone composition",
      );
      await page
        .locator("#forged-returns-composition")
        .evaluate((node) => node.remove());
      expect((await audit()).failures).toEqual([]);
      await root
        .getByRole("textbox", {
          name: language === "en" ? "Search returns" : "جستجوی مرجوعی‌ها",
          exact: true,
        })
        .fill("No fictional supplier matches this filter");
      await expect(rows).toHaveCount(0);
      const empty = await audit();
      expect(empty.failures).toEqual([]);
      expect(empty.toolbarGroups).toHaveLength(1);
      expect(empty.toolbarGroups[0].count).toMatch(/^0 /);
      expect(empty.toolbarGroups[0].gap).toBeGreaterThan(16.5);
    });
