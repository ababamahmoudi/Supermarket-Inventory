import { expect, test, type Locator } from "@playwright/test";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { word } from "./r2-receiving-helpers";

/** Inspect actual text, so a shared baseline cannot hide a label in the wrong slot. */
async function approvalNumberAssociations(group: Locator, width: number) {
  return group.evaluate((element, width) => {
    const rtl = getComputedStyle(element).direction === "rtl";
    const failures: string[] = [];
    const box = (node: Element) => node.getBoundingClientRect();
    const edge = (node: Element) => {
      const ranges: DOMRect[] = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text: Node | null;
      while ((text = walker.nextNode())) {
        if (!text.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        ranges.push(
          ...[...range.getClientRects()].filter((rect) => rect.width > 0),
        );
      }
      if (!ranges.length) return rtl ? box(node).right : box(node).left;
      return rtl
        ? Math.max(...ranges.map((rect) => rect.right))
        : Math.min(...ranges.map((rect) => rect.left));
    };
    const stat = (name: string) => {
      const parent = element.querySelector(`.approval-number-${name}`);
      if (!parent) throw new Error(`Missing actual ${name} approval stat`);
      const slot = (kind: string) => {
        const node = parent.querySelector(`:scope > .ui-number-${kind}`);
        if (!node) throw new Error(`Missing actual ${name} ${kind}`);
        return { edge: edge(node), box: box(node).toJSON() };
      };
      return { label: slot("label"), value: slot("value"), note: slot("note") };
    };
    const cost = stat("leading"),
      price = stat("price"),
      margin = stat("margin");
    const same = (name: string, a: number, b: number) => {
      if (Math.abs(a - b) > 1.5)
        failures.push(`${name}: ${Math.abs(a - b).toFixed(2)}px`);
    };
    same("cost label/value", cost.label.edge, cost.value.edge);
    same("cost value/note", cost.value.edge, cost.note.edge);
    same("price label/value", price.label.edge, price.value.edge);
    same("price value/note", price.value.edge, price.note.edge);
    same("margin label/value", margin.label.edge, margin.value.edge);
    const forward = rtl
      ? cost.value.edge - price.value.edge
      : price.value.edge - cost.value.edge;
    if (forward <= 1.5)
      failures.push("cost and price need distinct ordered columns");
    same("cost/price label row", cost.label.box.top, price.label.box.top);
    if (width === 390) {
      same("phone margin/cost column", margin.value.edge, cost.value.edge);
      same(
        "phone margin note/price column",
        margin.note.edge,
        price.value.edge,
      );
      if (
        margin.label.box.top <
        Math.max(cost.note.box.bottom, price.note.box.bottom) - 1.5
      )
        failures.push("phone margin must follow the cost/price notes");
      if (margin.value.box.top < margin.label.box.bottom - 1.5)
        failures.push("phone margin value must sit below its label");
      const lower =
        Math.min(margin.value.box.bottom, margin.note.box.bottom) -
        Math.max(margin.value.box.top, margin.note.box.top);
      if (lower <= 0)
        failures.push(
          "phone margin value and minimum note need the same lower row",
        );
    } else {
      same("margin value/note", margin.value.edge, margin.note.edge);
      same("cost/margin label row", cost.label.box.top, margin.label.box.top);
      if (width === 1440) same("fixed panel width", box(element).width, 521);
    }
    return { failures, cost, price, margin, width: box(element).width };
  }, width);
}

async function approvalPhoneInsets(card: Locator) {
  return card.evaluate((element) => {
    const outer = element.getBoundingClientRect();
    const failures: string[] = [];
    for (const selector of [
      ".approval-row-heading",
      ".approval-numbers",
      ".approval-card-footer .button-primary",
    ]) {
      const node = element.querySelector(selector);
      if (!node)
        throw new Error(`Missing actual approval content: ${selector}`);
      const rect = node.getBoundingClientRect();
      for (const [side, inset] of [
        ["left", rect.left - outer.left],
        ["right", outer.right - rect.right],
      ] as const)
        if (Math.abs(inset - 20) > 1.5)
          failures.push(
            `phone ${selector} ${side} inset: ${inset.toFixed(2)}px`,
          );
    }
    return failures;
  });
}

async function misplacedNumberSlotsAreDetected(group: Locator, width: number) {
  const label = group.locator(
    width === 390
      ? ".approval-number-margin > .ui-number-label"
      : ".approval-number-price > .ui-number-label",
  );
  const original = await label.getAttribute("style");
  await label.evaluate(
    (node, column) => {
      (node as HTMLElement).style.gridColumn = column;
    },
    width === 390 ? "3" : "1",
  );
  try {
    expect(
      (await approvalNumberAssociations(group, width)).failures,
    ).toContainEqual(
      expect.stringMatching(
        width === 390 ? /^margin label\/value:/ : /^price label\/value:/,
      ),
    );
  } finally {
    await label.evaluate((node, original) => {
      if (original === null) node.removeAttribute("style");
      else node.setAttribute("style", original);
    }, original);
  }
  if (width === 1440) {
    const original = await group.getAttribute("style");
    await group.evaluate((node) => {
      (node as HTMLElement).style.inlineSize = "525px";
    });
    try {
      expect(
        (await approvalNumberAssociations(group, width)).failures,
      ).toContainEqual(expect.stringMatching(/^fixed panel width:/));
    } finally {
      await group.evaluate((node, original) => {
        if (original === null) node.removeAttribute("style");
        else node.setAttribute("style", original);
      }, original);
    }
  } else {
    const card = group.locator("..");
    const original = await card.getAttribute("style");
    await card.evaluate((node) => {
      (node as HTMLElement).style.paddingInline = "16px";
    });
    try {
      expect(await approvalPhoneInsets(card)).toContainEqual(
        expect.stringMatching(/^phone \.approval-numbers left inset: 16/),
      );
    } finally {
      await card.evaluate((node, original) => {
        if (original === null) node.removeAttribute("style");
        else node.setAttribute("style", original);
      }, original);
    }
    expect(await approvalPhoneInsets(card)).toEqual([]);
  }
  expect((await approvalNumberAssociations(group, width)).failures).toEqual([]);
}

for (const language of ["en", "fa"] as const) {
  test(`R2f D6 approval number groups and ordered actions in ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#approvals");
    await expect(page.locator(".approval-card").first()).toBeVisible();
    await expect(
      page.locator(".sale-request-card .approval-numbers"),
    ).toBeVisible();
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"] as const) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              word(
                language,
                `Switch to ${theme} theme`,
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        const cards = page.locator(".approval-detail-row");
        expect(await cards.count()).toBeGreaterThanOrEqual(3);
        for (const card of await cards.all()) {
          if (width === 390)
            expect(await approvalPhoneInsets(card)).toEqual([]);
          const group = card.locator(".approval-numbers");
          await expect(group).toBeVisible();
          const association = await approvalNumberAssociations(group, width);
          expect(association.failures, JSON.stringify(association)).toEqual([]);
          await expect(
            group.locator(".approval-number-price > .ui-number-value"),
          ).toHaveCSS("font-size", "26px");
          const geometry = await group.evaluate((element) => {
            const leading = element.querySelector<HTMLElement>(
              ".approval-number-leading > .ui-number-value",
            )!;
            const price = element.querySelector<HTMLElement>(
              ".approval-number-price > .ui-number-value",
            )!;
            const margin = element.querySelector<HTMLElement>(
              ".approval-number-margin > .ui-number-value",
            )!;
            const baseline = (node: HTMLElement) => {
              const probe = document.createElement("span");
              probe.style.display = "inline-block";
              probe.style.width = "0";
              probe.style.height = "0";
              node.append(probe);
              const result = probe.getBoundingClientRect().bottom;
              probe.remove();
              return result;
            };
            return {
              width: element.getBoundingClientRect().width,
              cost: baseline(leading),
              price: baseline(price),
              margin: baseline(margin),
              overflow: element.scrollWidth - element.clientWidth,
            };
          });
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.cost - geometry.price)).toBeLessThanOrEqual(
            1.5,
          );
          if (width === 1440) {
            expect(geometry.width).toBeCloseTo(521, 0);
            expect(
              Math.abs(geometry.margin - geometry.price),
            ).toBeLessThanOrEqual(1.5);
          }
          const actions = card.locator(
            ".approval-card-footer .actions > button",
          );
          await expect(actions).toHaveCount(3);
          const names = await actions.allTextContents();
          expect(names).toEqual([
            word(
              language,
              (await card.getAttribute("data-sale-request-id"))
                ? "Change and approve"
                : "Edit and approve",
              (await card.getAttribute("data-sale-request-id"))
                ? "تغییر و تأیید"
                : "ویرایش و تأیید",
            ),
            word(language, "Reject", "رد کردن"),
            word(language, "Approve", "تأیید"),
          ]);
          const boxes = await actions.evaluateAll((nodes) =>
            nodes.map((node) => node.getBoundingClientRect().toJSON()),
          );
          if (width === 390) {
            expect(boxes[2].y + boxes[2].height).toBeLessThanOrEqual(
              boxes[0].y + 1,
            );
            expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThanOrEqual(1.5);
          } else {
            expect(
              Math.max(...boxes.map((box) => box.y + box.height / 2)) -
                Math.min(...boxes.map((box) => box.y + box.height / 2)),
            ).toBeLessThanOrEqual(1.5);
          }
        }
        if (theme === "light" && (width === 1440 || width === 390))
          await misplacedNumberSlotsAreDetected(
            cards.first().locator(".approval-numbers"),
            width,
          );
        if (
          (width === 1440 &&
            ((language === "en" && theme === "light") ||
              (language === "fa" && theme === "dark"))) ||
          (width === 390 && language === "en" && theme === "light")
        )
          await page.screenshot({
            path: info.outputPath(
              `approvals-${width}-${theme}-${language}.png`,
            ),
            fullPage: true,
          });
      }
    }
    expect(errors).toEqual([]);
  });
}
