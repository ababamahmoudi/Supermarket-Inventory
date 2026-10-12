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

for (const language of ["en", "fa"] as const)
  test(`product-name size and unit stay together in ${language}, and a split is detected`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 900, height: 1080 });
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    const fragment = page
      .locator(".dashboard-queue-product .unit-fragment")
      .first();
    await expect(fragment).toBeVisible();
    const clean = await inspectResponsiveLayout(page, "units", language, 900);
    expect(clean.unitFragments.length).toBeGreaterThan(0);
    expect(clean.unitFragments.every((value) => value.lines === 1)).toBe(true);
    expect(clean.failures).toEqual([]);
    const saved = await fragment.evaluate((element) => {
      const parent = element.parentElement!;
      const original = {
        self: element.getAttribute("style"),
        parent: parent.getAttribute("style"),
      };
      Object.assign((element as HTMLElement).style, {
        display: "inline",
        whiteSpace: "normal",
      });
      Object.assign(parent.style, {
        display: "block",
        width: "18px",
        whiteSpace: "normal",
      });
      return original;
    });
    let broken;
    try {
      broken = await inspectResponsiveLayout(
        page,
        "unit-negative-control",
        language,
        900,
      );
      expect(
        broken.failures.some((value) =>
          value.includes("unit fragment broken across lines"),
        ),
      ).toBe(true);
    } finally {
      await fragment.evaluate((element, original) => {
        for (const [node, value] of [
          [element, original.self],
          [element.parentElement!, original.parent],
        ] as const)
          if (value === null) node.removeAttribute("style");
          else node.setAttribute("style", value);
      }, saved);
    }
    const restored = await inspectResponsiveLayout(
      page,
      "units-restored",
      language,
      900,
    );
    expect(restored.failures).toEqual([]);
    await info.attach("Real product-name unit wrapping negative control", {
      body: JSON.stringify({ clean, broken, restored }, null, 2),
      contentType: "application/json",
    });
  });

for (const language of ["en", "fa"] as const)
  test(`ordinary ${language} Activity sizes stay together and an unmarked split is detected`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    const text = page
      .locator(".dashboard-activity-list .unit-text")
      .filter({ has: page.locator(".unit-fragment") })
      .first();
    await expect(text).toBeVisible();
    // Removing .unit-fragment changes the filtered locator's first match.
    // Retain the exact DOM node so the negative control restores its own row.
    const textNode = await text.elementHandle();
    if (!textNode) throw new Error("Activity text node is unavailable");
    const clean = await inspectResponsiveLayout(
      page,
      "activity-units",
      language,
      1440,
    );
    expect(clean.failures).toEqual([]);
    const saved = await textNode.evaluate((element) => {
      const original = {
        html: element.innerHTML,
        style: element.getAttribute("style"),
        text: element.textContent,
      };
      element.replaceChildren(
        document.createTextNode(element.textContent ?? ""),
      );
      Object.assign((element as HTMLElement).style, {
        display: "block",
        width: "18px",
        whiteSpace: "normal",
      });
      return original;
    });
    let broken;
    try {
      broken = await inspectResponsiveLayout(
        page,
        "raw-activity-negative-control",
        language,
        1440,
      );
      expect(
        broken.failures.some((value) =>
          value.includes("plain-text unit fragment broken across lines"),
        ),
      ).toBe(true);
    } finally {
      await textNode.evaluate((element, original) => {
        element.innerHTML = original.html;
        if (original.style === null) element.removeAttribute("style");
        else element.setAttribute("style", original.style);
      }, saved);
    }
    await expect(text).toHaveText(saved.text ?? "");
    const restored = await inspectResponsiveLayout(
      page,
      "activity-restored",
      language,
      1440,
    );
    expect(restored.failures).toEqual([]);
    await info.attach("Unmarked real Activity size wrapping negative control", {
      body: JSON.stringify({ clean, broken, restored }, null, 2),
      contentType: "application/json",
    });
  });
