import { expect, test, type Page } from "@playwright/test";

/** The shared polish must remain free of browser and application errors. */
export function guardR2gBrowserErrors(): void {
  const errors = new WeakMap<Page, string[]>();
  test.beforeEach(({ page }) => {
    const found: string[] = [];
    errors.set(page, found);
    page.on("pageerror", (error) => found.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") found.push(message.text());
    });
  });
  test.afterEach(({ page }) => {
    expect(errors.get(page) ?? [], "browser/application errors").toEqual([]);
  });
}
