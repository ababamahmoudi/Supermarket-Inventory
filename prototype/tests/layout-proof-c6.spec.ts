import { expect, test } from "@playwright/test";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";
import { setLanguage, signIn } from "./helpers";

for (const language of ["en", "fa"] as const)
  test(`rendered ${language} glyph proof distinguishes separate bilingual lines from real overlap`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    const product = page
      .locator(".dashboard-queue-product .product-name")
      .first();
    await expect(product.locator("strong")).toBeVisible();
    await expect(product.locator("small")).toBeVisible();
    const clean = await inspectResponsiveLayout(
      page,
      "dashboard",
      language,
      1440,
    );
    expect(clean.contentWords).toBeGreaterThan(50);
    expect(clean.failures).toEqual([]);

    // Move two existing product-name lines onto each other. This negative
    // control proves that using actual font ink still detects genuine
    // overlap; no business data or screenshot is changed.
    const saved = await product.evaluate((element) => {
      const secondary = element.querySelector("small")!;
      const original = {
        parent: element.getAttribute("style"),
        secondary: secondary.getAttribute("style"),
      };
      (element as HTMLElement).style.position = "relative";
      Object.assign(secondary.style, {
        position: "absolute",
        insetBlockStart: "0px",
        insetInlineStart: "0px",
      });
      return original;
    });
    let collision;
    try {
      collision = await inspectResponsiveLayout(
        page,
        "negative-control",
        language,
        1440,
      );
      expect(
        collision.failures.filter((value) =>
          value.includes("content words overlap"),
        ),
      ).not.toEqual([]);
    } finally {
      await product.evaluate((element, original) => {
        const secondary = element.querySelector("small")!;
        for (const [node, value] of [
          [element, original.parent],
          [secondary, original.secondary],
        ] as const)
          if (value === null) node.removeAttribute("style");
          else node.setAttribute("style", value);
      }, saved);
    }
    const restored = await inspectResponsiveLayout(
      page,
      "dashboard-restored",
      language,
      1440,
    );
    expect(restored.contentWords).toBeGreaterThan(50);
    expect(restored.failures).toEqual([]);
    await info.attach("Loaded-font collision negative control", {
      body: JSON.stringify({ clean, collision, restored }, null, 2),
      contentType: "application/json",
    });
  });
