import { expect, test, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import {
  resetDemo,
  setBranch,
  setLanguage,
  signIn,
  type DemoRole,
} from "./helpers";

test.setTimeout(120000);
const words = (language: "en" | "fa", en: string, fa: string) =>
  language === "fa" ? fa : en;
async function signOut(page: Page, language: "en" | "fa") {
  await page
    .getByRole("button", {
      name: words(language, "User menu", "منوی کاربر"),
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", {
      name: words(language, "Sign out", "خروج"),
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: words(language, "Sign in", "ورود"),
      exact: true,
    }),
  ).toBeVisible();
}
const people: { role: DemoRole; username: string; alternative?: string }[] = [
  { role: "Owner", username: "owner", alternative: "Branch 2" },
  { role: "Manager", username: "manager", alternative: "Branch 3" },
  {
    role: "Branch Supervisor",
    username: "rh-supervisor",
    alternative: "Branch 3",
  },
  { role: "ny-floor", username: "ny-floor" },
  { role: "wh-floor", username: "wh-floor" },
  { role: "Cashier", username: "cashier", alternative: "Branch 2" },
];
for (const language of ["en", "fa"] as const) {
  test(`E1 normal sign-in and permitted Reset preserve all six people and locations (${language})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /^(Sign in|ورود)$/ }),
    ).toBeVisible();
    await setLanguage(page, language);
    for (const person of people) {
      const fixture = demoSeed.demo_users.find(
        (row) => row.username === person.username,
      )!;
      await signIn(page, person.role);
      const name = words(language, fixture.name_en, fixture.name_fa);
      await expect(page.locator(".user-chip-copy strong")).toHaveText(name);
      const location = page.locator(".topbar").getByRole("combobox", {
        name: words(language, "Location", "مکان"),
        exact: true,
      });
      if (person.alternative) await setBranch(page, person.alternative);
      const before = (await location.locator("bdi").innerText()).trim();
      await resetDemo(page);
      await expect(page.locator(".user-chip-copy strong")).toHaveText(name);
      await expect(location.locator("bdi")).toHaveText(before);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(
        page.getByRole("status").filter({
          hasText: words(
            language,
            "Browser storage could not be read or updated.",
            "فضای ذخیره‌سازی مرورگر قابل خواندن یا به‌روزرسانی نیست.",
          ),
        }),
      ).toHaveCount(0);
      if (person.username === "cashier") {
        await expect(
          page
            .getByRole("navigation", {
              name: words(language, "Pages", "صفحه‌ها"),
              exact: true,
              includeHidden: true,
            })
            .getByRole("link", { includeHidden: true }),
        ).toHaveText(
          // S1 (Ali's rule): everyone, including the Cashier, adds dates.
          language === "fa"
            ? ["جست‌وجو", "پیگیری تاریخ"]
            : ["Lookup", "Date tracking"],
        );
      }
      await signOut(page, language);
    }
    expect(errors).toEqual([]);
  });

  test(`E1 Owner invitation creates real resumable first-sign-in password setup (${language})`, async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /^(Sign in|ورود)$/ }),
    ).toBeVisible();
    await setLanguage(page, language);
    await signIn(page, "Owner");
    await page.goto("/#settings?group=people");
    await page
      .getByRole("button", {
        name: words(language, "Add person", "افزودن شخص"),
        exact: true,
      })
      .click();
    const editor = page.getByRole("dialog", {
      name: words(language, "Add person", "افزودن شخص"),
      exact: true,
    });
    await editor
      .getByLabel(words(language, "English name", "نام انگلیسی"), {
        exact: true,
      })
      .fill("E1 setup smoke employee");
    await editor
      .getByLabel(words(language, "Username", "نام کاربری"), { exact: true })
      .fill("e1-smoke-employee");
    await editor
      .getByLabel(words(language, "Email", "ایمیل"), { exact: true })
      .fill("e1-smoke-employee@example.test");
    await editor
      .getByRole("checkbox", {
        name: words(language, "North York", "نورث یورک"),
        exact: true,
      })
      .check();
    await editor
      .getByRole("button", {
        name: words(language, "Save", "ذخیره"),
        exact: true,
      })
      .click();
    const codeDialog = page.getByRole("dialog", {
      name: words(language, "One-time setup code", "کد یک‌بارمصرف راه‌اندازی"),
      exact: true,
    });
    await expect(codeDialog).toBeVisible();
    const code = (
      await codeDialog.locator(".one-time-setup-code").innerText()
    ).trim();
    expect(code).not.toBe("");
    await codeDialog
      .getByRole("button", {
        name: words(language, "Close", "بستن"),
        exact: true,
      })
      .click();
    await signOut(page, language);
    await page
      .getByLabel(words(language, "Username", "نام کاربری"), { exact: true })
      .fill("e1-smoke-employee");
    await page
      .getByLabel(words(language, "Password", "گذرواژه"), { exact: true })
      .fill(code);
    await page
      .getByRole("button", {
        name: words(language, "Sign in", "ورود"),
        exact: true,
      })
      .click();
    const choose = page.getByRole("heading", {
      name: words(language, "Choose a new password", "انتخاب گذرواژهٔ جدید"),
      exact: true,
    });
    await expect(choose).toBeVisible();
    await page.goto("/#lookup");
    await expect(choose).toBeVisible();
    await expect(
      page.getByRole("navigation", {
        name: words(language, "Pages", "صفحه‌ها"),
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("combobox", {
        name: words(language, "Location", "مکان"),
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByLabel(words(language, "New password", "گذرواژهٔ جدید"), {
        exact: true,
      })
      .fill("orchard bamboo garden");
    await page
      .getByLabel(words(language, "Confirm password", "تأیید گذرواژه"), {
        exact: true,
      })
      .fill("orchard bamboo garden");
    await page
      .getByRole("button", {
        name: words(language, "Save password", "ذخیرهٔ گذرواژه"),
        exact: true,
      })
      .click();
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".user-chip-copy strong")).toHaveText(
      "E1 setup smoke employee",
    );
    await expect(
      page.getByRole("heading", {
        name: words(language, "Cashier lookup", "جست‌وجوی صندوق‌دار"),
        exact: true,
      }),
    ).toBeVisible();
  });

  test(`E1 deactivation removes another tab's access and reactivation needs a fresh sign-in (${language})`, async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /^(Sign in|ورود)$/ }),
    ).toBeVisible();
    await setLanguage(page, language);
    await signIn(page, "Owner");
    const worker = await context.newPage();
    await signIn(worker, "ny-floor");
    await expect(worker.locator(".topbar")).toBeVisible();
    await page.goto("/#settings?group=people");
    const row = page.getByRole("row").filter({ hasText: "ny-floor" });
    await row
      .getByRole("button", {
        name: words(language, "More actions", "کارهای بیشتر"),
        exact: true,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: words(language, "Deactivate", "غیرفعال کردن"),
        exact: true,
      })
      .click();
    const deactivate = page.getByRole("dialog", {
      name: words(language, "Deactivate", "غیرفعال کردن"),
      exact: true,
    });
    await deactivate
      .getByLabel(words(language, "Reason", "دلیل"), { exact: true })
      .fill("Browser smoke session revocation");
    await deactivate
      .getByRole("button", {
        name: words(language, "Confirm", "تأیید"),
        exact: true,
      })
      .click();
    const signInHeading = worker.getByRole("heading", {
      name: words(language, "Sign in", "ورود"),
      exact: true,
    });
    await expect(signInHeading).toBeVisible();
    await expect(
      worker.getByRole("navigation", {
        name: words(language, "Pages", "صفحه‌ها"),
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(worker.locator(".topbar")).toHaveCount(0);
    await worker
      .getByLabel(words(language, "Username", "نام کاربری"), { exact: true })
      .fill("ny-floor");
    await worker
      .getByLabel(words(language, "Password", "گذرواژه"), { exact: true })
      .fill("demo1234");
    await worker
      .getByRole("button", {
        name: words(language, "Sign in", "ورود"),
        exact: true,
      })
      .click();
    await expect(worker.getByRole("alert")).toBeVisible();
    await expect(worker.locator(".topbar")).toHaveCount(0);
    await row
      .getByRole("button", {
        name: words(language, "More actions", "کارهای بیشتر"),
        exact: true,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: words(language, "Reactivate", "فعال‌سازی دوباره"),
        exact: true,
      })
      .click();
    const reactivate = page.getByRole("dialog", {
      name: words(language, "Reactivate", "فعال‌سازی دوباره"),
      exact: true,
    });
    await reactivate
      .getByLabel(words(language, "Reason", "دلیل"), { exact: true })
      .fill("Browser smoke fresh sign-in");
    await reactivate
      .getByRole("button", {
        name: words(language, "Confirm", "تأیید"),
        exact: true,
      })
      .click();
    // Confirm closes only after the real reactivation transaction completes.
    // The private directory projection may then briefly remove its old rows.
    await expect(reactivate).not.toBeVisible();
    await expect(row).toHaveCount(1);
    const active = words(language, "Active", "فعال");
    const statusCell = row.locator('[data-column-key="status"]');
    if (!(await statusCell.count())) {
      const details = row.getByRole("button", {
        name: words(language, "Show details", "نمایش جزئیات"),
        exact: true,
      });
      const id = await details.getAttribute("aria-controls");
      await details.click();
      await expect(
        page.locator(`[id="${id}"]`).getByText(active, { exact: true }),
      ).toBeVisible();
    } else {
      await expect(statusCell.getByText(active, { exact: true })).toBeVisible();
    }
    await expect(signInHeading).toBeVisible();
    await expect(worker.locator(".topbar")).toHaveCount(0);
    await signIn(worker, "ny-floor");
    await expect(worker.locator(".topbar")).toBeVisible();
    await worker.close();
  });
}
