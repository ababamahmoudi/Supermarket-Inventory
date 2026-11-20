import { expect, test, type Locator, type Page } from "@playwright/test";
import { AUTH_PREFERENCES_KEY, LANGUAGE_KEY } from "../src/auth-preferences.e1";
import { inspect } from "../scripts/c5-browser-proof.mjs";

async function frame(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  return page.locator(".signin-card").evaluate((card) => {
    const box = card.getBoundingClientRect();
    const primary = card.querySelector<HTMLElement>(".signin-submit")!;
    return {
      width: box.width,
      padding: parseFloat(getComputedStyle(card).paddingInlineStart),
      primaryWidth: primary.getBoundingClientRect().width,
      primaryHeight: primary.getBoundingClientRect().height,
      contentWidth:
        box.width -
        parseFloat(getComputedStyle(card).paddingInlineStart) -
        parseFloat(getComputedStyle(card).paddingInlineEnd),
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      inputWidths: [...card.querySelectorAll("input")].map(
        (field) => field.getBoundingClientRect().width,
      ),
    };
  });
}
async function authGeometry(page: Page, password: Locator, submit: Locator) {
  return Promise.all([
    password.boundingBox(),
    submit.boundingBox(),
    page.locator(".signin-card").boundingBox(),
    page.locator(".maker-powered-full").boundingBox(),
  ]);
}
function expectStationary(
  before: Awaited<ReturnType<typeof authGeometry>>,
  after: Awaited<ReturnType<typeof authGeometry>>,
) {
  for (let index = 0; index < before.length; index++) {
    expect(before[index]).not.toBeNull();
    expect(after[index]).not.toBeNull();
    for (const coordinate of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(after[index]![coordinate] - before[index]![coordinate]),
      ).toBeLessThanOrEqual(2);
    }
  }
}

for (const width of [360, 390, 509, 760, 1440]) {
  for (const appearance of ["en-light", "fa-dark"] as const) {
    test(`R2g B1 actual sign-in, passkey and privacy lock ${width} ${appearance}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, testInfo) => {
      const fa = appearance === "fa-dark";
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        ({ preferenceKey, languageKey, fa }) => {
          localStorage.setItem(languageKey, fa ? "fa" : "en");
          localStorage.setItem(
            preferenceKey,
            JSON.stringify({
              version: 3,
              by_user_id: {},
              recent_user_ids: [],
              device_preferences: {
                theme: fa ? "dark" : "light",
                comfortableText: false,
              },
            }),
          );
        },
        { preferenceKey: AUTH_PREFERENCES_KEY, languageKey: LANGUAGE_KEY, fa },
      );
      await page.goto("/");
      await expect(
        page.getByRole("heading", {
          name: fa ? "ورود" : "Sign in",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        fa ? "dark" : "light",
      );
      const username = page.getByLabel(fa ? "نام کاربری" : "Username", {
        exact: true,
      });
      const password = page.getByLabel(fa ? "رمز عبور" : "Password", {
        exact: true,
      });
      const submit = page.getByRole("button", {
        name: fa ? "ورود" : "Sign in",
        exact: true,
      });
      await username.fill("manager");
      await password.fill("demo1234");
      await password.blur();
      const signInFrame = await frame(page);
      expect(signInFrame.width).toBe(Math.min(400, width - 32));
      expect(signInFrame.padding).toBe(width <= 480 ? 20 : 24);
      expect(signInFrame.primaryHeight).toBe(48);
      expect(signInFrame.primaryWidth).toBe(signInFrame.contentWidth);
      for (const inputWidth of signInFrame.inputWidths)
        expect(inputWidth).toBe(signInFrame.contentWidth);
      expect(signInFrame.pageOverflow).toBeLessThanOrEqual(1);
      expect(
        (await inspect(page, "Sign in", appearance, "anonymous")).failures,
      ).toEqual([]);
      if (width === 1440 && !fa) {
        await submit.evaluate((button) => {
          button.style.transform = "translateX(4px)";
        });
        expect(
          (await inspect(page, "Shifted sign in", appearance, "anonymous"))
            .failures,
        ).toContain(
          "Authentication primary does not fill the approved bounded form",
        );
        await submit.evaluate((button) =>
          button.style.removeProperty("transform"),
        );
        await submit.evaluate((button) => {
          button.style.blockSize = "52px";
          button.style.minBlockSize = "52px";
        });
        expect((await submit.boundingBox())!.height).toBe(52);
        expect(
          (
            await inspect(page, "Wrong primary height", appearance, "anonymous")
          ).failures.some((failure) =>
            failure.startsWith("Text action height: Sign in"),
          ),
        ).toBe(true);
        await submit.evaluate((button) => {
          button.style.removeProperty("block-size");
          button.style.removeProperty("min-block-size");
        });
        await submit.evaluate((button) => {
          const counterfeit = button.cloneNode(true) as HTMLButtonElement;
          counterfeit.id = "counterfeit-auth-action";
          document.body.append(counterfeit);
        });
        expect(
          (
            await inspect(
              page,
              "Counterfeit auth action",
              appearance,
              "anonymous",
            )
          ).failures,
        ).toContain(
          "Authentication action outside its validated form: Sign in",
        );
        await page
          .locator("#counterfeit-auth-action")
          .evaluate((button) => button.remove());
        expect(
          (await inspect(page, "Restored sign in", appearance, "anonymous"))
            .failures,
        ).toEqual([]);
      }
      const maker = page.locator(
        `.maker-powered-full .maker-logo-${fa ? "dark" : "light"}`,
      );
      await expect(maker).toBeVisible();
      await expect(maker).toHaveAttribute(
        "src",
        fa ? /klead-logo-white.svg$/ : /klead-logo.svg$/,
      );
      expect(
        await maker.evaluate((image) => image.closest(".signin-card")),
      ).toBeNull();
      expect(
        await maker.evaluate((image) => image.getBoundingClientRect().height),
      ).toBe(18);
      await page.screenshot({ path: testInfo.outputPath("signin.png") });

      const forgot = page.getByRole("button", {
        name: fa ? "رمز را فراموش کرده‌اید؟" : "Forgot password?",
        exact: true,
      });
      await forgot.click();
      const help = page.getByRole("dialog", {
        name: fa ? "رمز را فراموش کرده‌اید؟" : "Forgot password?",
        exact: true,
      });
      await expect(help).toContainText(
        fa ? "از مسئول حساب‌ها" : "Ask a person who manages accounts",
      );
      await page.keyboard.press("Escape");
      await expect(help).not.toBeVisible();
      await expect(forgot).toBeFocused();
      await password.fill("wrong fictional password");
      const before = await authGeometry(page, password, submit);
      await submit.click();
      await expect(page.getByRole("alert")).toContainText(
        fa ? "درست نیست" : "incorrect",
      );
      await expect(password).toHaveValue("");
      await expect(password).toBeFocused();
      const after = await authGeometry(page, password, submit);
      expectStationary(before, after);
      const errorBox = await page.getByRole("alert").boundingBox();
      expect(errorBox!.height).toBeLessThanOrEqual(16);
      expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(after[1]!.y);
      await page.screenshot({ path: testInfo.outputPath("signin-error.png") });
      await password.fill("demo1234");
      await submit.click();

      await expect(
        page.getByRole("heading", {
          name: fa ? "تأیید هویت" : "Confirm it's you",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: /Pages|صفحه‌ها/ }),
      ).toHaveCount(0);
      await expect(page.locator(".auth-step-explanation")).toContainText(
        fa ? "اثر انگشت" : "fingerprint, face or PIN",
      );
      await expect(page.locator(".auth-simulated-note")).toContainText(
        fa ? "شبیه‌سازی" : "Simulated",
      );
      const passkeyFrame = await frame(page);
      expect(passkeyFrame.primaryHeight).toBe(48);
      expect(passkeyFrame.primaryWidth).toBe(passkeyFrame.contentWidth);
      expect(passkeyFrame.pageOverflow).toBeLessThanOrEqual(1);
      expect(
        (await inspect(page, "Passkey", appearance, "anonymous")).failures,
      ).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("passkey.png") });
      await page
        .getByRole("button", {
          name: fa ? "ادامه با کلید ورود" : "Continue with passkey",
          exact: true,
        })
        .click();
      await expect(page.locator(".topbar")).toBeVisible();
      const userMenu = page.getByRole("button", {
        name: fa ? "منوی کاربر" : "User menu",
        exact: true,
      });
      if (!(await userMenu.isVisible()))
        await page.locator("#menu-toggle").click();
      await page
        .getByRole("button", {
          name: fa ? "منوی کاربر" : "User menu",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitem", { name: fa ? "قفل" : "Lock", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: fa ? "قفل شده" : "Locked",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".auth-header > p")).toContainText(
        fa ? "نورث یورک" : "North York",
      );
      await expect(
        page.getByRole("navigation", { name: /Pages|صفحه‌ها/ }),
      ).toHaveCount(0);
      await expect(page.locator(".signin-card .signin-logo-tile")).toHaveCount(
        0,
      );
      expect(
        await page
          .locator(".auth-header .user-avatar")
          .evaluate((avatar) => avatar.getBoundingClientRect().width),
      ).toBe(72);
      const lockFrame = await frame(page);
      expect(lockFrame.primaryHeight).toBe(48);
      expect(lockFrame.primaryWidth).toBe(lockFrame.contentWidth);
      expect(lockFrame.pageOverflow).toBeLessThanOrEqual(1);
      expect(
        (await inspect(page, "Locked", appearance, "manager")).failures,
      ).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("lock.png") });
      const unlock = page.getByRole("button", {
        name: fa ? "باز کردن قفل" : "Unlock",
        exact: true,
      });
      const lockPassword = page.getByLabel(fa ? "رمز عبور" : "Password", {
        exact: true,
      });
      await lockPassword.fill("wrong fictional password");
      const lockedBefore = await authGeometry(page, lockPassword, unlock);
      await unlock.click();
      await expect(page.getByRole("alert")).toContainText(
        fa ? "درست نیست" : "incorrect",
      );
      await expect(lockPassword).toHaveValue("");
      await expect(lockPassword).toBeFocused();
      const lockedAfter = await authGeometry(page, lockPassword, unlock);
      expectStationary(lockedBefore, lockedAfter);
      const lockedError = await page.getByRole("alert").boundingBox();
      expect(lockedError!.height).toBeLessThanOrEqual(16);
      expect(lockedError!.y + lockedError!.height).toBeLessThanOrEqual(
        lockedAfter[1]!.y,
      );
      await page.screenshot({ path: testInfo.outputPath("lock-error.png") });
      await page
        .getByRole("button", {
          name: fa ? "ورود با حساب دیگر" : "Sign in as someone else",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: fa ? "ورود" : "Sign in",
          exact: true,
        }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
