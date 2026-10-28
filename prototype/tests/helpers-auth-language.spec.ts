import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

for (const width of [390, 1440])
  test(`language helper uses the real auth form and ignores a copied form at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const auth = page.locator("#root > .signin-page");
    await expect(
      auth.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await auth.evaluate((node) => {
      const copy = node.cloneNode(true) as HTMLElement;
      copy.id = "copied-auth-language";
      // Keep the visible copy outside the genuine toggle's fixed position.
      const language = copy.querySelector<HTMLElement>(".signin-language")!;
      language.style.position = "static";
      language.style.inset = "auto";
      for (const element of copy.querySelectorAll("[id],[for]")) {
        element.removeAttribute("id");
        element.removeAttribute("for");
      }
      const toggle = copy.querySelector<HTMLButtonElement>(".language-toggle")!;
      toggle.dataset.used = "false";
      toggle.addEventListener("click", () => {
        toggle.dataset.used = "true";
      });
      document.body.append(copy);
    });
    await expect(
      page.locator("#copied-auth-language .language-toggle"),
    ).toBeVisible();
    await setLanguage(page, "fa");
    await expect(
      auth.getByRole("heading", { name: "ورود", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("#copied-auth-language .language-toggle"),
    ).toHaveAttribute("data-used", "false");
    await expect(page.locator(".topbar")).toHaveCount(0);
    await page
      .locator("#copied-auth-language")
      .evaluate((node) => node.remove());
    await page.reload({ waitUntil: "commit" });
    await setLanguage(page, "en");
    await expect(
      auth.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".topbar")).toHaveCount(0);
    await signIn(page, "Owner");
    await expect(page.locator(".user-chip-copy strong")).toHaveText(
      "Demo Owner",
    );
    await expect(
      page.locator(".topbar .branch-pill[role=combobox]"),
    ).toBeVisible();
  });
