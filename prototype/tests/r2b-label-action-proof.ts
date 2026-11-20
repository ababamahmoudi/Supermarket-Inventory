import { expect, type Locator, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";

/** Audit the real shared field action, including two deliberate broken controls. */
export async function expectLabelActionContract(page: Page, action: Locator) {
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute("data-control-kind", "label-action");
  const measure = () => inspect(page, "r2b-label-action", "current", "owner");
  expect((await measure()).failures).toEqual([]);

  const originalStyle = await action.getAttribute("style");
  try {
    await action.evaluate((element) => {
      const button = element as HTMLButtonElement;
      for (const property of ["block-size", "min-block-size", "max-block-size"])
        button.style.setProperty(property, "24px", "important");
    });
    expect(
      (await measure()).failures.some((failure) =>
        failure.startsWith("Text action height:"),
      ),
    ).toBe(true);
  } finally {
    await action.evaluate((element, style) => {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    }, originalStyle);
  }
  expect((await measure()).failures).toEqual([]);

  try {
    await action.evaluate((element) => {
      const copy = element.cloneNode(true) as HTMLButtonElement;
      copy.removeAttribute("id");
      copy.disabled = false;
      copy.dataset.r2bInvalidLabelAction = "";
      Object.assign(copy.style, { position: "fixed", top: "4px", left: "4px" });
      document.body.append(copy);
    });
    expect(
      (await measure()).failures.some((failure) =>
        failure.startsWith("Invalid field label action declaration:"),
      ),
    ).toBe(true);
  } finally {
    await page
      .locator("[data-r2b-invalid-label-action]")
      .evaluateAll((copies) => {
        for (const copy of copies) copy.remove();
      });
  }
  expect((await measure()).failures).toEqual([]);
}
