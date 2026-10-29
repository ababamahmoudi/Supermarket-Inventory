import { expect, test } from "@playwright/test";
import { signIn, setLanguage, openShellAction } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { mountOwnedDialogProof } from "./r2g-owned-dialog-proof";

for (const [language, theme] of [
  ["en", "light"],
  ["fa", "dark"],
] as const) {
  for (const width of [360, 390, 509, 760]) {
    test(`R2g A5 unrelated page Undo stays out of the full-width dialog at ${width}px (${language}/${theme})${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
          )
        ).click();
      await page.goto("/#offers");
      const before = await readCanonicalBusinessEvidence(page);
      const row = page.locator(
        '.current-offers-table tr[data-product-code="0003"]',
      );
      const stopText = language === "en" ? "Stop offer" : "توقف پیشنهاد";
      await row.getByRole("button", { name: stopText, exact: true }).click();
      await page
        .getByRole("dialog", { name: stopText, exact: true })
        .getByRole("button", { name: stopText, exact: true })
        .click();
      const pageUndo = page.getByTestId("undo-toast");
      await expect(pageUndo).toBeVisible();
      const createText = language === "en" ? "Create offer" : "ایجاد پیشنهاد";
      await page.getByRole("button", { name: createText, exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: createText,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId("dialog-action-status")).toHaveCount(0);
      await expect(
        dialog.getByRole("button", {
          name: language === "en" ? "Undo" : "واگرد",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(pageUndo).toHaveCount(0);
      const geometry = await dialog.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const footer = node.querySelector(".ui-dialog-footer")!;
        const feedback = footer.querySelector("[data-dialog-feedback-host]")!;
        const actions = [...footer.querySelectorAll(":scope > button")].map(
          (button) => {
            const box = button.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          },
        );
        return {
          width: bounds.width,
          bottom: bounds.bottom,
          feedback: feedback.getBoundingClientRect().height,
          actions,
          viewport: innerHeight,
        };
      });
      expect(geometry.width).toBe(width);
      expect(Math.abs(geometry.bottom - geometry.viewport)).toBeLessThanOrEqual(
        1.5,
      );
      expect(geometry.feedback).toBe(0);
      expect(
        Math.abs(geometry.actions[0].width - geometry.actions[1].width),
      ).toBeLessThanOrEqual(1.5);
      expect(
        Math.abs(geometry.actions[0].y - geometry.actions[1].y),
      ).toBeLessThanOrEqual(1.5);
      const report = await inspect(
        page,
        "R2g A5 Create offer",
        `${width}-${language}-${theme}`,
        "manager",
      );
      expect(report.failures).toEqual([]);
      const submit = dialog.locator(".ui-dialog-footer > button").last();
      const oldStyle = await submit.getAttribute("style");
      await submit.evaluate((button) => {
        button.style.inlineSize = `${button.getBoundingClientRect().width - 4}px`;
        button.style.flex = "0 0 auto";
      });
      expect(
        (
          await inspect(
            page,
            "R2g A5 shrunken negative",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures.some((failure: string) =>
          failure.includes("Phone dialog footer"),
        ),
      ).toBe(true);
      if (oldStyle === null)
        await submit.evaluate((button) => button.removeAttribute("style"));
      else
        await submit.evaluate(
          (button, style) => button.setAttribute("style", style),
          oldStyle,
        );
      await submit.evaluate((button) => {
        button.style.transform = "translateY(4px)";
      });
      expect(
        (
          await inspect(
            page,
            "R2g A5 shifted negative",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures.some((failure: string) =>
          failure.includes("Phone dialog footer"),
        ),
      ).toBe(true);
      if (oldStyle === null)
        await submit.evaluate((button) => button.removeAttribute("style"));
      else
        await submit.evaluate(
          (button, style) => button.setAttribute("style", style),
          oldStyle,
        );
      await page.evaluate(() => {
        const copied = document.createElement("dialog");
        copied.className = "ui-dialog confirm-dialog";
        copied.setAttribute("open", "");
        copied.dataset.r2gCounterfeit = "";
        copied.innerHTML =
          '<div class="ui-dialog-actions"><button class="ui-button button button-primary" data-control-kind="action" style="width:320px;min-height:44px">Fictional copied action</button></div>';
        document.body.append(copied);
      });
      expect(
        (
          await inspect(
            page,
            "R2g A5 counterfeit negative",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures.some((failure: string) =>
          failure.includes("Text action stretched: Fictional copied action"),
        ),
      ).toBe(true);
      await page
        .locator("dialog[data-r2g-counterfeit]")
        .evaluate((node) => node.remove());
      expect(
        (
          await inspect(
            page,
            "R2g A5 restored",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`A5-${width}-${language}-${theme}.png`),
      });
      await dialog
        .getByRole("button", {
          name: language === "en" ? "Cancel" : "انصراف",
          exact: true,
        })
        .click();
      await expect(pageUndo).toBeVisible();
      await pageUndo
        .getByRole("button", {
          name: language === "en" ? "Undo" : "واگرد",
          exact: true,
        })
        .click();
      await expect(pageUndo).toHaveCount(0);
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.offers).toEqual(before.offers);
    });
  }
}

for (const language of ["en", "fa"] as const) {
  test(`R2g A5 body scroll fades track the real remaining content at 509px ${language} @r2g-509`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 509, height: 520 });
    await signIn(page, "Manager");
    await setLanguage(page, language);
    await page.goto("/#offers");
    const name = language === "en" ? "Create offer" : "ایجاد پیشنهاد";
    await page.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    const body = dialog.locator(":scope > .ui-dialog-body");
    await expect
      .poll(() =>
        body.evaluate((node) => node.scrollHeight > node.clientHeight),
      )
      .toBe(true);
    await expect(body).toHaveCSS("scrollbar-width", "none");
    if (
      await body.evaluate(() => CSS.supports("selector(::-webkit-scrollbar)"))
    )
      expect(
        await body.evaluate(
          (node) => getComputedStyle(node, "::-webkit-scrollbar").display,
        ),
      ).toBe("none");
    await body.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(body).toHaveAttribute("data-dialog-scroll-start", "false");
    await expect(body).toHaveAttribute("data-dialog-scroll-end", "true");
    await expect(body).toHaveCSS("mask-image", /linear-gradient/);
    await body.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(body).toHaveAttribute("data-dialog-scroll-end", "false");
    await expect(body).toHaveAttribute("data-dialog-scroll-start", "true");
    await expect(
      dialog.locator(".ui-dialog-footer > button").first(),
    ).toBeInViewport();
    await expect(
      dialog.locator(".ui-dialog-footer > button").last(),
    ).toBeInViewport();
  });
}

for (const language of ["en", "fa"] as const) {
  test(`R2g A5 real topbar Search footer fills its 509px sheet ${language} @r2g-509`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 509, height: 900 });
    await signIn(page, "Manager");
    await setLanguage(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    await (
      await openShellAction(
        page,
        language === "en" ? "Search all products" : "جست‌وجوی همهٔ محصولات",
      )
    ).click();
    const dialog = page.getByRole("dialog", {
      name: language === "en" ? "Search products" : "جست‌وجوی محصولات",
      exact: true,
    });
    const actions = dialog.locator(".ui-dialog-actions > button");
    await expect(actions).toHaveCount(2);
    const geometry = await actions.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    expect(Math.abs(geometry[0].width - geometry[1].width)).toBeLessThanOrEqual(
      1.5,
    );
    expect(Math.abs(geometry[0].y - geometry[1].y)).toBeLessThanOrEqual(1.5);
    expect(geometry.map((box) => box.height)).toEqual([44, 44]);
    expect((await dialog.boundingBox())!.width).toBe(509);
    const input = dialog.getByRole("textbox", {
      name: language === "en" ? "Search all products" : "جست‌وجوی همهٔ محصولات",
      exact: true,
    });
    await input.fill("Black Tea");
    const afterTyping = await actions.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    for (let index = 0; index < 2; index++)
      for (const key of ["x", "y", "width", "height"] as const)
        expect(
          Math.abs(afterTyping[index][key] - geometry[index][key]),
        ).toBeLessThanOrEqual(2);
    expect(
      (await inspect(page, "R2g A5 real Search", `509-${language}`, "manager"))
        .failures,
    ).toEqual([]);
    await dialog
      .getByRole("button", {
        name: language === "en" ? "Search" : "جست‌وجو",
        exact: true,
      })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/#lookup\?search=Black%20Tea/);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.products).toEqual(before.products);
    expect(after.invoices).toEqual(before.invoices);
  });
}

for (const [language, theme] of [
  ["en", "light"],
  ["fa", "dark"],
] as const) {
  for (const width of [1440, 509, 760]) {
    test(`R2g A5 owned feedback keeps its frame, body trigger and two footer actions fixed at ${width}px (${language}/${theme})${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
          )
        ).click();
      const proof = await mountOwnedDialogProof(page);
      try {
        await page.evaluate(() => document.fonts.ready);
        await expect(proof.record).toHaveText("ready");
        await expect(proof.trigger).toHaveCSS(
          "height",
          width <= 760 ? "44px" : "40px",
        );
        const controls = [
          proof.dialog,
          proof.trigger,
          proof.cancel,
          proof.done,
          proof.dialog.getByRole("textbox").first(),
        ];
        const capture = () =>
          Promise.all(controls.map((control) => control.boundingBox()));
        const before = await capture();
        await proof.trigger.click();
        await expect(proof.record).toHaveText("cleared");
        const feedback = proof.dialog.getByTestId("dialog-action-status");
        await expect(feedback).toBeVisible();
        const withStatus = await capture();
        await info.attach("owned-dialog-geometry", {
          body: JSON.stringify({ before, withStatus }),
          contentType: "application/json",
        });
        for (let index = 0; index < controls.length; index++)
          for (const key of ["x", "y", "width", "height"] as const)
            expect(
              Math.abs(withStatus[index]![key] - before[index]![key]),
              `owned status ${index}/${key}`,
            ).toBeLessThanOrEqual(2);
        await expect(proof.dialog).toHaveAttribute(
          "data-dialog-feedback-frame",
          "",
        );
        for (const control of controls.slice(1))
          await expect(control).toBeInViewport();
        expect(
          (
            await inspect(
              page,
              "R2g A5 owned feedback",
              `${width}-${language}-${theme}`,
              "manager",
            )
          ).failures,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`A5-owned-${width}-${language}-${theme}.png`),
        });
        await feedback
          .getByRole("button", {
            name: language === "en" ? "Undo" : "واگرد",
            exact: true,
          })
          .click();
        await expect(feedback).toHaveCount(0);
        await expect(proof.record).toHaveText("active");
        const afterUndo = await capture();
        for (let index = 0; index < controls.length; index++)
          for (const key of ["x", "y", "width", "height"] as const)
            expect(
              Math.abs(afterUndo[index]![key] - before[index]![key]),
              `after owned Undo ${index}/${key}`,
            ).toBeLessThanOrEqual(2);
        for (const control of controls.slice(1))
          await expect(control).toBeInViewport();
        const id = await proof.record.getAttribute("data-record-id");
        const canonical = await readCanonicalBusinessEvidence(page);
        expect(canonical.expiry.find((entry) => entry.id === id)?.status).toBe(
          "active",
        );
        expect(
          canonical.activity.some((entry) => entry.action === "Undone"),
        ).toBe(true);
        expect(JSON.stringify(canonical.activity)).not.toContain(
          "dialog_scope",
        );
        await proof.done.click();
        await expect(proof.dialog).toHaveCount(0);
        await expect(page.locator("[data-dialog-feedback-frame]")).toHaveCount(
          0,
        );
      } finally {
        await proof.dispose();
      }
    });
  }
}
