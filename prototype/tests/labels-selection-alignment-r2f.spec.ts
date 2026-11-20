import { expect, test } from "@playwright/test";
import { inspectTableAlignment } from "./alignment-a2-proof";
import { setLanguage, signIn } from "./helpers";
import { installLocationReturnScene } from "./r2f-location-return-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const language of ["en", "fa"] as const) {
  test(`Labels selection header and phone rows align (${language})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "Supervisor");
    await expect(page.locator(".mobile-more-menu")).toBeVisible();
    await setLanguage(page, language);
    await page.goto("/#labels");
    const table = page.locator(
      ".labels-products-card .r2e-labels-products.is-phone-list",
    );
    const rows = table.locator(".phone-list-row");
    await expect(rows.first()).toBeVisible();
    const metrics = await inspectTableAlignment(page);
    expect(metrics.failures).toEqual([]);
    expect(metrics.maxError).toBeLessThanOrEqual(2);
    expect(metrics.selectionHeaderCards).toBe(await rows.count());
    expect(metrics.selectionHeaderCards).toBeGreaterThan(0);
    const all = table.locator('thead [role="checkbox"]');
    await expect(all).toBeVisible();
    await all.click();
    const eligible = table.locator('tbody [role="checkbox"]:not(:disabled)');
    expect(await eligible.count()).toBeGreaterThan(0);
    for (const checkbox of await eligible.all())
      await expect(checkbox).toBeChecked();
    await all.click();
    for (const checkbox of await eligible.all())
      await expect(checkbox).not.toBeChecked();
    await page.screenshot({
      path: info.outputPath(`Labels-selection-${language}.png`),
      fullPage: true,
    });
    await all.evaluate((node) => {
      (node as HTMLElement).style.transform = "translateX(4px)";
    });
    expect(
      (await inspectTableAlignment(page)).failures.some((failure) =>
        failure.includes("Labels selection"),
      ),
    ).toBe(true);
    await all.evaluate((node) => {
      (node as HTMLElement).style.removeProperty("transform");
      (node as HTMLElement).style.visibility = "hidden";
    });
    expect((await inspectTableAlignment(page)).failures.length).toBeGreaterThan(
      0,
    );
    await all.evaluate((node) =>
      (node as HTMLElement).style.removeProperty("visibility"),
    );
    const code = await rows.first().getAttribute("data-row-href");
    await rows
      .first()
      .evaluate((node) =>
        node.setAttribute("data-row-href", "#product?code=not-a-product"),
      );
    expect(
      (await inspectTableAlignment(page)).failures.some((failure) =>
        failure.includes("invalid Labels product selection"),
      ),
    ).toBe(true);
    await rows
      .first()
      .evaluate(
        (node, href) => node.setAttribute("data-row-href", href!),
        code,
      );
    await table.evaluate((node) => {
      const fake = document.createElement("section");
      fake.id = "copied-labels-oracle-contract";
      fake.className = "labels-products-card";
      const wrapper = node.cloneNode(true) as HTMLElement;
      wrapper
        .querySelectorAll("tbody tr:not(:first-child)")
        .forEach((row) => row.remove());
      fake.append(wrapper);
      document.querySelector("main")!.append(fake);
    });
    expect((await inspectTableAlignment(page)).failures.length).toBeGreaterThan(
      0,
    );
    await page
      .locator("#copied-labels-oracle-contract")
      .evaluate((node) => node.remove());
    expect((await inspectTableAlignment(page)).failures).toEqual([]);
  });

  for (const role of ["Manager", "Cashier"] as const)
    test(`Returns rich phone oracle binds three genuine records and private credit (${language}, ${role})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const scene = await installLocationReturnScene(page);
      if (role === "Cashier") await signIn(page, role);
      await expect(page.locator(".mobile-more-menu")).toBeVisible();
      await setLanguage(page, language);
      await page.goto("/#returns");
      const table = page.locator(".returns-overview-table");
      await expect(table.locator("tbody tr")).toHaveCount(3);
      const clean = await inspectTableAlignment(page);
      expect(clean.failures).toEqual([]);
      expect(clean.returnCards).toBe(3);
      expect(clean.cells).toBe(12);
      expect(clean.maxError).toBeLessThanOrEqual(2);
      const first = table.locator("tbody tr").first();
      const credit = first.locator(".return-phone-meta > :last-child");
      if (role === "Cashier") {
        await expect(table.locator('th[data-column-key="credit"]')).toHaveCount(
          0,
        );
        await expect(credit).toHaveText("");
        await credit.evaluate((node) => {
          node.textContent = "$999.00";
        });
        expect(
          (await inspectTableAlignment(page)).failures.some((failure) =>
            failure.includes("invalid retained Returns card"),
          ),
        ).toBe(true);
        await credit.evaluate((node) => {
          node.textContent = "";
        });
      } else {
        await expect(credit).toContainText("$11.00");
        await credit.evaluate((node) => {
          (node as HTMLElement).style.transform = "translateX(4px)";
        });
        const shifted = await inspectTableAlignment(page);
        expect(
          shifted.failures.some((failure) => failure.includes("logical edges")),
        ).toBe(true);
        expect(shifted.maxError).toBeGreaterThan(2);
        await credit.evaluate((node) =>
          (node as HTMLElement).style.removeProperty("transform"),
        );
      }
      const chevron = first.locator(".return-phone-next .table-row-link");
      const href = await chevron.getAttribute("href");
      expect(href).toBe(`#return?id=${scene.records[0].id}`);
      await chevron.evaluate((node) =>
        node.setAttribute("href", "#return?id=not-a-return"),
      );
      expect(
        (await inspectTableAlignment(page)).failures.some((failure) =>
          failure.includes("invalid retained Returns card"),
        ),
      ).toBe(true);
      await chevron.evaluate(
        (node, value) => node.setAttribute("href", value!),
        href,
      );
      await table.evaluate((node) => {
        const fake = document.createElement("section");
        fake.id = "copied-return-oracle-contract";
        fake.className = "returns-overview";
        const wrapper = node.cloneNode(true) as HTMLElement;
        wrapper
          .querySelectorAll("tbody tr:not(:first-child)")
          .forEach((row) => row.remove());
        fake.append(wrapper);
        document.querySelector("main")!.append(fake);
      });
      expect(
        (await inspectTableAlignment(page)).failures.length,
      ).toBeGreaterThan(0);
      await page
        .locator("#copied-return-oracle-contract")
        .evaluate((node) => node.remove());
      expect((await inspectTableAlignment(page)).failures).toEqual([]);
      const before = await readCanonicalBusinessEvidence(page);
      await chevron.click();
      await expect(page).toHaveURL((url) => url.hash === href);
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.returns).toEqual(before.returns);
      expect(after.ledger).toEqual(before.ledger);
    });
}
