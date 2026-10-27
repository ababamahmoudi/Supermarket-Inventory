import { expect, test } from "@playwright/test";
import { openShellAction, setLanguage, signIn } from "./helpers";

for (const language of ["en", "fa"] as const)
  for (const theme of ["light", "dark"] as const)
    for (const width of [1440, 1000, 390])
      test(`R2e E store chrome, About and lock attribution ${width} ${language} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1000 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/");
        await expect(page.locator(".maker-powered")).toHaveText(
          /Powered by Klead/,
        );
        await expect(page).toHaveTitle("Super Arzon · Klead");
        await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
          "href",
          /brand\/klead\/klead-icon-32.svg$/,
        );
        await expect(
          page.locator('link[rel="apple-touch-icon"]'),
        ).toHaveAttribute("href", /brand\/klead\/klead-icon-192.png$/);
        const manifest = await page.request.get("/manifest.webmanifest");
        expect(manifest.ok()).toBe(true);
        expect(
          (await manifest.json()).icons.map(
            (icon: { src: string }) => icon.src,
          ),
        ).toEqual([
          "brand/klead/klead-icon-192.png",
          "brand/klead/klead-icon-512.png",
        ]);
        await signIn(page, "manager");
        await setLanguage(page, language);
        if (theme === "dark")
          await (
            await openShellAction(
              page,
              language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
            )
          ).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page).toHaveTitle(
          language === "en" ? "Super Arzon · Klead" : "سوپر ارزان · Klead",
        );
        await page.evaluate(() => {
          location.hash = "settings?group=about";
        });
        const about = page.locator(".maker-about");
        await expect(about).toBeVisible();
        await expect(about).toContainText(
          language === "en" ? "Made by Klead" : "ساخته‌شده توسط Klead",
        );
        await expect(about).toContainText("0.2.0");
        await expect(about.locator(".maker-support")).toHaveCount(0);
        const groups = page.getByRole("navigation", {
          name: language === "en" ? "Settings groups" : "گروه‌های تنظیمات",
        });
        await expect(groups.getByRole("button").last()).toHaveText(
          language === "en" ? "About" : "درباره",
        );
        const visibleLogo = about.locator(
          theme === "dark" ? ".maker-logo-dark" : ".maker-logo-light",
        );
        await expect(visibleLogo).toBeVisible();
        await expect(visibleLogo).toHaveJSProperty("naturalWidth", 558);
        await expect(visibleLogo).toHaveAttribute(
          "src",
          theme === "dark" ? /klead-logo-white.svg$/ : /klead-logo.svg$/,
        );
        const geometry = await visibleLogo.evaluate((image) => {
          const box = image.getBoundingClientRect();
          const parent = image.parentElement!.getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            padding: (parent.width - box.width) / 2,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        expect(geometry.width).toBe(104);
        expect(geometry.height).toBe(32);
        expect(geometry.padding).toBeGreaterThanOrEqual(12);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        await page
          .getByRole("button", {
            name: language === "en" ? "User menu" : "منوی کاربر",
            exact: true,
          })
          .click();
        await page
          .getByRole("menuitem", {
            name: language === "en" ? "Lock" : "قفل",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: language === "en" ? "Screen locked" : "صفحه قفل شده است",
          }),
        ).toBeVisible();
        const powered = page.locator(".maker-powered");
        await expect(powered).toContainText(
          language === "en" ? "Powered by Klead" : "با پشتیبانی Klead",
        );
        const lockLogo = powered.locator(
          theme === "dark" ? ".maker-logo-dark" : ".maker-logo-light",
        );
        await expect(lockLogo).toBeVisible();
        await expect(lockLogo).toHaveAttribute(
          "src",
          theme === "dark" ? /klead-logo-white.svg$/ : /klead-mark.svg$/,
        );
        expect(errors).toEqual([]);
      });
