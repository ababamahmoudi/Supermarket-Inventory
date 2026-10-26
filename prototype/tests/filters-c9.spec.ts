import { expect, test, type Locator } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

const lists = [
  "price-updates",
  "expiry",
  "products",
  "labels",
  "received",
  "returns",
  "suppliers",
  "orders",
  "payables",
  "offers",
  "requests",
  "history",
];

async function checkToolbar(toolbar: Locator, route: string) {
  await expect(toolbar).toBeVisible();
  const geometry = await toolbar.evaluate((element) => {
    const bar = element.getBoundingClientRect();
    const card = element.closest(".ui-card")!.getBoundingClientRect();
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".filter-search-pill, .ui-segments, .ui-select, .ui-button, .ui-checked-control",
      ),
    )
      .filter(
        (control) =>
          (!control.closest("dialog") && !control.closest(".ui-segments")) ||
          control.matches(".ui-segments"),
      )
      .map((control) => ({ control, rect: control.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .map(({ control, rect }) => ({
        name:
          control.getAttribute("aria-label") ??
          control.textContent ??
          control.className,
        x: rect.x,
        top: rect.top,
        right: rect.right,
        height: rect.height,
        center: rect.top + rect.height / 2,
        kind: control.matches(".filter-search-pill")
          ? "search-container"
          : control.matches(".ui-segments")
            ? "segment-track"
            : control.matches(".ui-icon-button")
              ? "icon"
              : "ordinary",
      }));
    const trailing = element
      .querySelector(".filter-toolbar-trailing")
      ?.getBoundingClientRect();
    return {
      bar: { left: bar.left, right: bar.right },
      card: { left: card.left, right: card.right },
      controls,
      trailing: trailing
        ? { left: trailing.left, right: trailing.right }
        : null,
      direction: getComputedStyle(element).direction,
      gap: getComputedStyle(element).gap,
      searchInputs: [
        ...element.querySelectorAll<HTMLInputElement>(
          ".filter-search-pill input",
        ),
      ]
        .filter((input) => input.getBoundingClientRect().height > 0)
        .map((input) => ({
          name: input.getAttribute("aria-label"),
          height: input.getBoundingClientRect().height,
        })),
    };
  });
  expect(geometry.controls.length, route).toBeGreaterThan(1);
  expect(geometry.gap, `${route}: wrap gap`).toBe("12px");
  expect(
    geometry.bar.left - geometry.card.left,
    `${route} start inset`,
  ).toBeCloseTo(20, 0);
  expect(
    geometry.card.right - geometry.bar.right,
    `${route} end inset`,
  ).toBeCloseTo(20, 0);
  const rows: (typeof geometry.controls)[] = [];
  const r2cScreen = ["suppliers", "payables", "offers"].includes(route);
  if (r2cScreen)
    await expect(
      toolbar.locator(`xpath=ancestor::*[@data-r2c-screen="${route}"]`),
      `${route}: the actual R2c screen owns its control size`,
    ).toHaveCount(1);
  for (const control of geometry.controls) {
    // The search wrapper keeps C9's 40px frame; R2c ordinary inputs/buttons
    // grow to 44px inside it. A segmented track reserves its 8px inner inset.
    const expectedHeight =
      r2cScreen && control.kind === "segment-track"
        ? 52
        : r2cScreen && control.kind === "ordinary"
          ? 44
          : 40;
    expect(control.height, `${route}: ${control.name}`).toBeCloseTo(
      expectedHeight,
      0,
    );
    expect(control.x, `${route}: start overflow`).toBeGreaterThanOrEqual(
      geometry.bar.left - 1,
    );
    expect(control.right, `${route}: end overflow`).toBeLessThanOrEqual(
      geometry.bar.right + 1,
    );
    const row = rows.find((items) => Math.abs(items[0].top - control.top) < 20);
    if (row) row.push(control);
    else rows.push([control]);
  }
  for (const input of geometry.searchInputs)
    expect(input.height, `${route}: ${input.name}`).toBeCloseTo(
      r2cScreen ? 44 : 40,
      0,
    );
  for (const row of rows) {
    expect(
      Math.max(...row.map((item) => item.center)) -
        Math.min(...row.map((item) => item.center)),
      `${route}: controls share a centre on each wrapped row: ${JSON.stringify(row)}`,
    ).toBeLessThanOrEqual(1);
  }
  expect(geometry.trailing, `${route}: count/actions end group`).not.toBeNull();
  if (geometry.trailing)
    expect(
      geometry.direction === "rtl"
        ? geometry.trailing.left - geometry.bar.left
        : geometry.bar.right - geometry.trailing.right,
      `${route}: trailing alignment`,
    ).toBeLessThanOrEqual(1);
}

for (const width of [1440, 900, 390]) {
  for (const language of ["en", "fa"] as const) {
    test(`C9 list filter geometry ${width}px ${language}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "The test sets its own required widths.",
      );
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      for (const route of lists) {
        await page.goto(`/#${route}`);
        await checkToolbar(
          page.locator(".main-content .c9-filter-toolbar").first(),
          route,
        );
        if (width === 390) {
          for (const action of await page
            .locator(
              ".main-content .page-header .ui-button.button:not(.ui-icon-button)",
            )
            .all()) {
            if (await action.isVisible())
              expect(
                (await action.boundingBox())?.height,
                `${route}: phone actions outside filters remain 44px`,
              ).toBeCloseTo(44, 0);
          }
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          `${route}: page overflow`,
        ).toBeTruthy();
      }
    });
  }
}
