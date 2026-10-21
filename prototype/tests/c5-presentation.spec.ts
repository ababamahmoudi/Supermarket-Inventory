import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { openShellAction, setBranch, signIn } from "./helpers";
import {
  appearance,
  button,
  choose,
  field,
  fieldContrast,
  inspect,
  today,
  type C5Inspection,
} from "../scripts/c5-browser-proof.mjs";

test.setTimeout(180000);
test.use({ actionTimeout: 10000 });
const measurements = new WeakMap<Page, C5Inspection[]>();

test.afterEach(async ({ page }, info) => {
  const reports = measurements.get(page);
  if (!reports?.length) return;
  const path = info.outputPath("button-audit.json");
  await writeFile(path, JSON.stringify(reports, null, 2) + "\n");
  await info.attach("Rendered primary-screen button audit", {
    path,
    contentType: "application/json",
  });
});

async function assertContract(
  page: Page,
  scene: string,
  variant: string,
  role = "supervisor",
) {
  const proof = await inspect(
    page,
    scene,
    `${test.info().project.name}-${variant}`,
    role,
  );
  const reports = measurements.get(page) ?? [];
  reports.push(proof);
  measurements.set(page, reports);
  expect(
    proof.buttons.length,
    `${scene}: real controls measured`,
  ).toBeGreaterThan(2);
  if (proof.viewport.width < 760) {
    expect(
      proof.topbar.length,
      `${scene}: all five priority-bar controls measured`,
    ).toBe(5);
    expect(
      await page
        .locator(".topbar")
        .evaluate((element) => element.getBoundingClientRect().height),
      `${scene}: the phone priority bar stays on one 60px row`,
    ).toBeCloseTo(60, 0);
    for (const selector of [
      "#menu-toggle",
      ".branch-pill",
      ".notifications-menu",
      ".mobile-account-menu",
      ".mobile-more-menu",
    ])
      await expect(page.locator(`.topbar ${selector}`)).toBeVisible();
    expect(
      await page
        .locator(
          'button[aria-label="User menu"], button[aria-label="منوی کاربر"]',
        )
        .evaluateAll(
          (controls) =>
            controls.filter((control) => {
              const rect = control.getBoundingClientRect();
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                getComputedStyle(control).visibility !== "hidden"
              );
            }).length,
        ),
      `${scene}: exactly one account is visible, including behind a modal`,
    ).toBe(1);
    // The top bar is deliberately inert while a modal is open. Exercise the
    // collapsed controls in every ordinary screen instead of counting hidden
    // desktop buttons as phone controls.
    if (!(await page.locator("dialog[open]").count())) {
      const persian =
        (await page.locator("html").getAttribute("lang")) === "fa";
      const dark =
        (await page.locator("html").getAttribute("data-theme")) === "dark";
      const more = page.locator(".mobile-more-menu");
      if ((await more.getAttribute("aria-expanded")) !== "true")
        await more.click();
      for (const name of [
        persian ? "جست‌وجوی همهٔ محصولات" : "Search all products",
        persian ? "تغییر به انگلیسی" : "Switch to Persian",
        persian
          ? dark
            ? "تغییر به تم روشن"
            : "تغییر به تم تیره"
          : dark
            ? "Switch to light theme"
            : "Switch to dark theme",
        persian ? "اندازهٔ متن راحت" : "Comfortable text size",
        persian ? "دمو" : "Demo",
      ])
        await expect(
          page.getByRole("menuitem", { name, exact: true }),
        ).toBeVisible();
      const demo = page.getByRole("menuitem", {
        name: persian ? "دمو" : "Demo",
        exact: true,
      });
      await demo.click();
      await expect(
        page.getByRole("menuitem", {
          name: persian ? "بازنشانی دمو" : "Reset demo",
          exact: true,
        }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(demo).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(more).toBeFocused();
    }
  } else {
    expect(
      proof.topbar.length,
      `${scene}: all desktop topbar controls measured`,
    ).toBeGreaterThanOrEqual(7);
  }
  expect(proof.failures, scene).toEqual([]);
  return proof;
}

for (const variant of ["en-light", "en-dark", "fa-light"] as const) {
  test(`C5 Waiting for credit is amber for different retained return states (${variant})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await page.goto("/#return?id=demo-return-1");
    await button(page.locator(".return-header-card"), "Record pickup").click();
    const pickup = page.locator(".return-action-card");
    await assertContract(page, "Record return pickup form", "en-light");
    await pickup
      .getByLabel("Actual pickup quantity", { exact: true })
      .fill("3");
    await field(pickup, "Supplier representative name").fill("Demo Driver");
    await field(pickup, "Signed paper pickup slip reference").fill(
      "SIGNED-C5-COLOR-001",
    );
    await button(pickup, "Record pickup").click();
    // This existing status is published only after the actual command completes.
    await expect(page.getByRole("status")).toHaveText(
      "Recorded pickup and retained Return memo.",
    );
    await page.goto("/#returns");
    await expect(page.locator(".returns-overview-table")).toBeVisible();
    await appearance(page, variant);
    const proof = await assertContract(
      page,
      "Waiting for credit across return states",
      variant,
    );
    const credit = proof.statuses.filter(
      (status) => status.returnStatus === "waiting_for_credit",
    );
    expect(credit.length).toBeGreaterThanOrEqual(2);
    expect(
      credit.every((status) => status.classes.split(" ").includes("pending")),
    ).toBe(true);
    expect(
      new Set(credit.map((status) => `${status.color}/${status.background}`))
        .size,
    ).toBe(1);
  });

  test(`C5 Klead text actions, intrinsic table actions and uniform topbar (${variant})`, async ({
    page,
  }, info) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await appearance(page, variant);
    const proofs: C5Inspection[] = [];
    for (const route of [
      "invoices",
      "products",
      "alerts",
      "returns",
      "expiry",
      "offers",
      "approvals",
    ]) {
      await page.goto(`/#${route}`);
      proofs.push(await assertContract(page, route, variant));
      if (route === "products") {
        await field(
          page.getByRole("main"),
          "Search products",
          "جست‌وجوی محصولات",
        ).fill("0016");
        const row = page.locator(".catalog-products-table tbody tr").first();
        const compact = await row.evaluate((element) =>
          element.matches(".phone-list-row"),
        );
        let cost = page.locator(".catalog-products-table .weight-cost");
        const price = page.locator(".catalog-products-table .weight-price");
        if (compact) {
          // E3 keeps selling prices on the compact row; private cost remains
          // on this Manager's actual product page rather than an omitted cell.
          await expect(price.locator(".weight-price-main")).toHaveText(
            "$7.49/lb",
          );
          await expect(price.locator(".weight-price-secondary")).toHaveText(
            "$16.51/kg",
          );
          await row.locator(".phone-list-chevron .table-row-link").click();
          await expect(page).toHaveURL(/#product\?code=0016$/);
          cost = page.locator(".product-page-cost-card .weight-cost");
        } else {
          if ((await cost.count()) === 0)
            await button(row, "Show details", "نمایش جزئیات").click();
          await expect(price.locator(".weight-price-main")).toHaveText(
            "$7.49/lb",
          );
          await expect(price.locator(".weight-price-secondary")).toHaveText(
            "$16.51/kg",
          );
        }
        await expect(cost).toHaveText("$4.99/lb");
        await expect(cost).toHaveAttribute("dir", "ltr");
        proofs.push(
          await assertContract(page, "Products weighed item", variant),
        );
      }
      if (route === "expiry") {
        const product = field(
          page.locator(".date-quick-card"),
          "Product",
          "محصول",
        );
        await product.fill("0001");
        const iconClearance = await product.evaluate((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          const icon = element
            .closest(".date-product-picker")!
            .querySelector(".date-product-search-icon")!
            .getBoundingClientRect();
          return style.direction === "rtl"
            ? icon.left - (bounds.right - parseFloat(style.paddingRight))
            : bounds.left + parseFloat(style.paddingLeft) - icon.right;
        });
        expect(
          iconClearance,
          "Product text clears the search icon",
        ).toBeGreaterThanOrEqual(4);
        await product.fill("");
        await product.press("Escape");
      }
    }
    await info.attach(`c5-controls-${variant}.json`, {
      body: JSON.stringify(proofs, null, 2),
      contentType: "application/json",
    });
    const statuses = proofs.flatMap((proof) => proof.statuses);
    for (const label of [...new Set(statuses.map((status) => status.label))]) {
      const colors = statuses
        .filter((status) => status.label === label)
        .map((status) => status.color);
      expect(new Set(colors).size, `Same status foreground: ${label}`).toBe(1);
      const pillBackgrounds = statuses
        .filter(
          (status) =>
            status.label === label && status.background !== "rgba(0, 0, 0, 0)",
        )
        .map((status) => status.background);
      expect(
        new Set(pillBackgrounds).size,
        `Same filled status pill: ${label}`,
      ).toBeLessThanOrEqual(1);
    }
    const languageName =
      variant === "fa-light" ? "تغییر به انگلیسی" : "Switch to Persian";
    const language = await openShellAction(page, languageName);
    if (await page.locator(".mobile-more-menu").isVisible()) {
      await expect(language).toHaveText(languageName);
      await expect(page.locator(".topbar .language-toggle")).toHaveCount(0);
    } else {
      await expect(language).toHaveText(variant === "fa-light" ? "EN" : "فا");
      await expect(page.locator(".topbar .language-toggle")).toHaveCount(1);
    }
    await language.click();
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      variant === "fa-light" ? "en" : "fa",
    );
  });

  test(`C5 posted invoice, whole-page viewer, correction contrast and return policy (${variant})`, async ({
    page,
  }, info) => {
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    await appearance(page, variant);
    await page.goto("/#invoices?id=a2-fixture%3AFV-20390");
    const document = page.locator(".posted-invoice-document");
    await expect(document).toContainText("FV-20390");
    const displayedCosts = page.locator(
      ".posted-invoice-lines tbody tr > td:nth-child(3)",
    );
    await expect(displayedCosts.first()).toHaveText("$0.98");
    // This signed fictional document retains its exact six source costs.
    // All have cents; the separate weighed fixture above must retain 4.9895.
    await expect(displayedCosts).toHaveText([
      "$0.98",
      "$1.20",
      "$1.55",
      "$1.95",
      "$3.40",
      "$1.60",
    ]);
    const title = page.locator(".posted-invoice-title");
    expect(
      await title.evaluate((element) => {
        const heading = element.querySelector("h2")!.getBoundingClientRect();
        const badge = element.querySelector(".badge")!.getBoundingClientRect();
        return Math.abs(
          heading.top + heading.height / 2 - badge.top - badge.height / 2,
        );
      }),
    ).toBeLessThanOrEqual(2);
    const totals = page.locator(".posted-invoice-totals > div");
    await expect(totals).toHaveCount(5);
    await expect(totals.locator("dt")).toHaveText(
      variant === "fa-light"
        ? ["جمع پیش از مالیات", "مالیات", "جمع فاکتور", "کسورات", "قابل پرداخت"]
        : ["Subtotal", "Tax", "Invoice total", "Deductions", "Payable"],
    );
    await expect(totals.locator("dd")).toHaveText([
      "$178.72",
      "$2.50",
      "$181.22",
      "$0.00",
      "$181.22",
    ]);
    const totalRows = await totals.evaluateAll((rows) =>
      rows.map((row) => {
        const textBounds = (element: Element) => {
          const range = window.document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect();
        };
        const termElement = row.querySelector("dt")!;
        const amountElement = row.querySelector("dd")!;
        const term = textBounds(termElement);
        const amount = textBounds(amountElement);
        const termBox = termElement.getBoundingClientRect();
        const amountBox = amountElement.getBoundingClientRect();
        const bounds = row.getBoundingClientRect();
        const rowStyle = getComputedStyle(row);
        const column = rowStyle.flexDirection === "column";
        const rtl = rowStyle.direction === "rtl";
        // Phone Payable aligns different-size caption/value line boxes at the end.
        const alignmentError = column
          ? Math.abs(rtl ? term.left - amount.left : term.right - amount.right)
          : Math.abs(termBox.bottom - amountBox.bottom);
        const walker = window.document.createTreeWalker(
          amountElement,
          NodeFilter.SHOW_TEXT,
        );
        const moneyTops: number[] = [];
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          const range = window.document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects())
            if (rect.width > 0 && rect.height > 0) moneyTops.push(rect.top);
        }
        return {
          label: termElement.textContent,
          amount: amountElement.textContent,
          column,
          alignItems: rowStyle.alignItems,
          alignmentError,
          lineBoxes: {
            termTop: termBox.top,
            termBottom: termBox.bottom,
            amountTop: amountBox.top,
            amountBottom: amountBox.bottom,
          },
          contained: [term, amount].every(
            (rect) =>
              rect.left >= bounds.left - 2 &&
              rect.right <= bounds.right + 2 &&
              rect.top >= bounds.top - 2 &&
              rect.bottom <= bounds.bottom + 2,
          ),
          separated: column
            ? amount.top >= term.bottom - 2
            : Math.min(term.right, amount.right) -
                Math.max(term.left, amount.left) <=
              0,
          endAligned: alignmentError <= 2,
          moneyWhole:
            moneyTops.length > 0 &&
            Math.max(...moneyTops) - Math.min(...moneyTops) <= 2,
          bounds: {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
          },
        };
      }),
    );
    await info.attach(`posted-totals-${variant}.json`, {
      body: JSON.stringify(totalRows, null, 2),
      contentType: "application/json",
    });
    // Klead replaces the old label/value rows with adjacent end-aligned totals.
    // At phone width Payable becomes one full-width label/value row.
    for (const row of totalRows) {
      expect(
        row.contained,
        `${row.label}: label/value stay in their total`,
      ).toBe(true);
      expect(row.separated, `${row.label}: label/value do not overlap`).toBe(
        true,
      );
      if (!row.column)
        expect(
          row.alignItems,
          `${row.label}: row uses the same end alignment for both line boxes`,
        ).toBe("flex-end");
      expect(row.endAligned, `${row.label}: totals remain end-aligned`).toBe(
        true,
      );
      expect(row.moneyWhole, `${row.label}: money stays on one line`).toBe(
        true,
      );
    }
    for (let index = 0; index < totalRows.length; index++)
      for (const next of totalRows.slice(index + 1)) {
        const bounds = totalRows[index].bounds;
        const width =
          Math.min(bounds.right, next.bounds.right) -
          Math.max(bounds.left, next.bounds.left);
        const height =
          Math.min(bounds.bottom, next.bounds.bottom) -
          Math.max(bounds.top, next.bounds.top);
        expect(
          width > 1 && height > 1,
          `${totalRows[index].label}/${next.label}: total groups do not overlap`,
        ).toBe(false);
      }
    const media = page.locator(".invoice-original-media");
    const image = media.locator("img");
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(media).toHaveAttribute("data-fit", "page");
    const fits = () =>
      media.evaluate((element) => {
        const child = element
          .querySelector("img,canvas")!
          .getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return (
          child.width <= element.clientWidth + 2 &&
          child.height <= element.clientHeight + 2 &&
          child.left >= rect.left - 2 &&
          child.right <= rect.right + 2
        );
      });
    await expect.poll(fits).toBe(true);
    const toolbar = page.locator(".invoice-original-controls");
    await button(toolbar, "Fit width", "اندازه عرض").click();
    await expect(media).toHaveAttribute("data-fit", "width");
    await expect(media).toHaveAttribute("data-zoom", "1");
    const out = button(toolbar, "Zoom out", "کوچک‌نمایی");
    for (let count = 0; count < 3; count++) await out.click();
    await expect(media).toHaveAttribute("data-zoom", "0.25");
    await expect(out).toBeDisabled();
    const zoomIn = button(toolbar, "Zoom in", "بزرگ‌نمایی");
    for (let count = 0; count < 15; count++) await zoomIn.click();
    await expect(media).toHaveAttribute("data-zoom", "4");
    await expect(zoomIn).toBeDisabled();
    await button(toolbar, "Fit page", "اندازه صفحه").click();
    await expect(media).toHaveAttribute("data-fit", "page");
    await expect.poll(fits).toBe(true);
    const posted = await assertContract(page, "Posted invoice", variant);
    await button(page, "Move invoice", "انتقال فاکتور").click();
    await assertContract(page, "Move invoice dialog", variant);
    await page.keyboard.press("Escape");
    await button(page, "Correct invoice", "اصلاح فاکتور").click();
    const correction = page.locator(".invoice-correction-dialog");
    await expect(correction).toBeVisible();
    const contrast = await fieldContrast(page, ".invoice-correction-dialog");
    expect(contrast.length).toBeGreaterThan(5);
    for (const control of contrast) {
      expect(control.textContrast, control.label).toBeGreaterThanOrEqual(4.5);
      if (!control.focused) expect(control.glow, control.label).toBe("none");
    }
    await assertContract(page, "Correct invoice", variant);
    await page.keyboard.press("Escape");
    await page.goto("/#return?id=demo-return-1");
    await button(page, "Return policy", "سیاست مرجوعی").click();
    const policy = page.locator(".return-policy-dialog");
    await expect(policy).toBeVisible();
    await expect(policy.locator("ol > li")).toHaveCount(5);
    expect(
      await policy
        .locator("ol")
        .evaluate((element) => getComputedStyle(element).listStyleType),
    ).toBe("decimal");
    expect(
      await policy
        .locator("ol > li")
        .evaluateAll((elements) =>
          elements.every(
            (element) => getComputedStyle(element).display === "list-item",
          ),
        ),
    ).toBe(true);
    await expect(policy.locator(".card")).toHaveCount(0);
    if (info.project.name === "desktop")
      expect(
        await policy.evaluate(
          (element) => element.getBoundingClientRect().width,
        ),
      ).toBeGreaterThanOrEqual(620);
    await expect(
      button(policy, "Download full policy", "دانلود سیاست کامل"),
    ).toHaveClass(/button-tinted/);
    await expect(button(policy, "Close", "بستن")).toHaveClass(/button-neutral/);
    await expect(
      policy.locator(".ui-dialog-actions").getByRole("button"),
    ).toHaveText([
      variant === "fa-light" ? "بستن" : "Close",
      variant === "fa-light" ? "دانلود سیاست کامل" : "Download full policy",
    ]);
    const policyProof = await assertContract(page, "Return policy", variant);
    await info.attach(`c5-documents-${variant}.json`, {
      body: JSON.stringify({ posted, policy: policyProof, contrast }, null, 2),
      contentType: "application/json",
    });
  });
}

test("C6 shelf quick-add accepts Enter, resets focus, pins new row and Remove Undo preserves money", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#expiry");
  const quick = page.locator(".date-quick-card");
  const product = field(quick, "Product");
  await today(page, quick);
  await button(quick, "More").click();
  await field(quick, "Lot (optional)").fill("C5-SHELF-ENTER");
  await assertContract(page, "Date quick-add with More", "en-light");
  const before = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
  );
  await product.fill("0001");
  await product.press("Enter");
  await expect(product).toHaveValue("");
  await expect(product).toBeFocused();
  const first = page.locator(".expiry-table tbody tr").first();
  await expect(first).toHaveAttribute("data-new-date", "true");
  await expect(first).toContainText("C5-SHELF-ENTER");
  await assertContract(page, "New shelf date without an Add toast", "en-light");
  await expect(page.getByTestId("undo-toast")).toHaveCount(0);
  await expect(field(quick, "Lot (optional)")).toHaveValue("");
  const after = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
  );
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  await button(first, "Remove").click();
  const removal = page.getByRole("dialog", {
    name: "Remove date",
    exact: true,
  });
  await choose(page, field(removal, "Reason"), "Entered by mistake");
  await button(removal, "Remove").click();
  await expect(
    page
      .locator(".expiry-table tbody tr")
      .filter({ hasText: "C5-SHELF-ENTER" }),
  ).toHaveCount(0);
  const toast = page
    .getByTestId("undo-toast")
    .filter({ hasText: "Remove date" });
  await button(toast, "Undo").click();
  await expect(
    page
      .locator(".expiry-table tbody tr")
      .filter({ hasText: "C5-SHELF-ENTER" }),
  ).toHaveCount(1);
  const restored = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
  );
  expect(restored.ledger).toEqual(before.ledger);
  expect(restored.stock_movements).toEqual(before.stock_movements);
  expect(
    restored.expiry.find(
      (entry: { lot_number?: string }) => entry.lot_number === "C5-SHELF-ENTER",
    ),
  ).toMatchObject({ status: "active", branch: "Branch 1" });
  await expect(
    page.getByRole("dialog", { name: "Add date", exact: true }),
  ).toHaveCount(0);
});

for (const role of ["Supervisor", "Floor Worker"] as const) {
  test(`C6 Lookup dates are readonly; shelf addition enables tracking and local Remove Undo restores evidence (${role})`, async ({
    page,
  }) => {
    await signIn(page, role);
    if (role === "Supervisor") await setBranch(page, "Branch 1");
    const before = await readCanonicalBusinessEvidence(page).then(
      (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
    );
    await page.goto("/#lookup");
    await field(page.locator(".lookup-page"), "Search products").fill("0001");
    const dates = page.locator(".product-dates-section");
    await expect(dates).toBeVisible();
    await expect(dates.getByRole("switch")).toHaveCount(0);
    await expect(dates.getByRole("form")).toHaveCount(0);
    await expect(button(dates, "Add")).toHaveCount(0);
    await assertContract(
      page,
      "Readonly Lookup dates",
      "en-light",
      role === "Supervisor" ? "supervisor" : "floor_worker",
    );
    await page.goto("/#expiry?product=0001");
    const quick = page.locator(".date-quick-card");
    await expect(field(quick, "Product")).toHaveValue("Basmati Rice 4.5 kg");
    await today(page, quick);
    await button(quick, "More").click();
    const lot = `C6-READONLY-${role}`;
    await field(quick, "Lot (optional)").fill(lot);
    await button(quick, "Add").click();
    await expect(page.getByTestId("undo-toast")).toHaveCount(0);
    await expect(
      page.locator('.expiry-table tbody tr[data-new-date="true"]'),
    ).toContainText(lot);
    await expect
      .poll(async () =>
        readCanonicalBusinessEvidence(page).then((canonicalState) => {
          const canonicalEvidenceInput = lot;
          return JSON.parse(JSON.stringify(canonicalState)!).expiry.some(
            (entry: { lot_number?: string }) =>
              entry.lot_number === canonicalEvidenceInput,
          );
        }),
      )
      .toBe(true);
    const added = await readCanonicalBusinessEvidence(page).then(
      (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
    );
    const newDate = added.expiry.find(
      (entry: { lot_number?: string }) => entry.lot_number === lot,
    );
    expect(newDate).toMatchObject({
      branch: "Branch 1",
      product_code: "0001",
      status: "active",
    });
    expect(
      added.products.find(
        (product: { code: string }) => product.code === "0001",
      ).date_tracking,
    ).toBe(true);
    expect(added.ledger).toEqual(before.ledger);
    expect(added.stock_movements).toEqual(before.stock_movements);
    await page.goto("/#lookup");
    await field(page.locator(".lookup-page"), "Search products").fill("0001");
    await expect(dates).toContainText(`Expires ${newDate.date}`);
    await expect(dates).toContainText("North York");
    await expect(dates.getByRole("switch")).toHaveCount(0);
    await expect(dates.getByRole("form")).toHaveCount(0);
    await page.goto("/#expiry");
    const row = page.locator(".expiry-table tbody tr").filter({ hasText: lot });
    await button(row, "Remove").click();
    const removal = page.getByRole("dialog", {
      name: "Remove date",
      exact: true,
    });
    await choose(page, field(removal, "Reason"), "Entered by mistake");
    await button(removal, "Remove").click();
    await expect(row).toHaveCount(0);
    const toast = page
      .getByTestId("undo-toast")
      .filter({ hasText: "Remove date" });
    await button(toast, "Undo").click();
    await expect(row).toHaveCount(1);
    const restored = await readCanonicalBusinessEvidence(page).then(
      (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
    );
    expect(
      restored.expiry.find((entry: { id: string }) => entry.id === newDate.id),
    ).toMatchObject({
      status: "active",
      branch: "Branch 1",
      product_code: "0001",
      lot_number: lot,
    });
    expect(
      restored.products.find(
        (product: { code: string }) => product.code === "0001",
      ).date_tracking,
    ).toBe(true);
    expect(restored.ledger).toEqual(before.ledger);
    expect(restored.stock_movements).toEqual(before.stock_movements);
    await page.goto("/#lookup");
    await field(page.locator(".lookup-page"), "Search products").fill("0001");
    await expect(dates).toContainText(`Expires ${newDate.date}`);
    await expect(dates.getByRole("switch")).toHaveCount(0);
  });
}

test("C5 repeated current offer is idempotent, stop moves retained record to Past and Undo restores Current", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#offers");
  const existing = page.locator(
    '.current-offers-table tr[data-product-code="0003"]',
  );
  await expect(existing).toHaveCount(1);
  const before = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
  );
  await button(page, "Create offer").click();
  const dialog = page.getByRole("dialog", {
    name: "Create offer",
    exact: true,
  });
  await choose(page, field(dialog, "Product"), /Sour Cherry Juice 1 L.*0003/);
  await assertContract(page, "Create offer dialog", "en-light");
  await button(dialog, "Create offer").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "This offer already exists.",
  );
  const repeated = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
  );
  expect(repeated.offers).toEqual(before.offers);
  expect(repeated.activity).toEqual(before.activity);
  await existing.getByRole("button", { name: "More", exact: true }).click();
  const stopExisting = page.getByRole("menuitem", {
    name: "Stop offer · All branches",
    exact: true,
  });
  await expect(stopExisting).toBeVisible();
  await stopExisting.click();
  const stop = page.getByRole("dialog", { name: "Stop offer", exact: true });
  await assertContract(page, "Stop offer confirmation", "en-light");
  await button(stop, "Stop offer").click();
  await expect(existing).toHaveCount(0);
  await page.getByRole("tab", { name: "Past offers", exact: true }).click();
  const pastRow = page.locator(
    '.past-offers-table tr[data-product-code="0003"]',
  );
  await expect(pastRow).toHaveCount(1);
  let retainedStatus = await pastRow.innerText();
  const details = button(pastRow, "Show details");
  if (await details.count()) {
    const detailsId = await details.getAttribute("aria-controls");
    expect(detailsId).toBeTruthy();
    await details.click();
    const omitted = page.locator(`[id="${detailsId}"]`);
    await expect(omitted).toBeVisible();
    expect(await omitted.locator("dl > div > dd").count()).toBeGreaterThan(0);
    // C8 keeps Status in the phone row; only genuinely omitted values expand.
    retainedStatus += ` ${await omitted.innerText()}`;
  }
  expect(retainedStatus).toContain("Stopped");
  const toast = page
    .getByTestId("undo-toast")
    .filter({ hasText: "Stop offer" });
  await button(toast, "Undo").click();
  await expect(
    page.locator('.past-offers-table tr[data-product-code="0003"]'),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Current offers", exact: true }).click();
  await expect(existing).toHaveCount(1);
});

test("C5 return evidence, memo, cancellation and settlement forms retain compact actions for both roles", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#return?id=demo-return-1");
  await button(page, "Cancel return").click();
  await assertContract(
    page,
    "Return original-goods cancellation form",
    "en-light",
  );
  await button(page.locator(".return-action-card"), "Close").click();
  await button(page.locator(".return-header-card"), "Record pickup").click();
  const pickup = page.locator(".return-action-card");
  await pickup.getByLabel("Actual pickup quantity", { exact: true }).fill("3");
  await field(pickup, "Supplier representative name").fill("Demo Driver");
  await field(pickup, "Signed paper pickup slip reference").fill(
    "SIGNED-C5-FORMS-001",
  );
  await button(pickup, "Record pickup").click();
  await expect(page.locator(".return-detail-title")).toContainText(
    "Waiting for credit",
  );
  await page.locator(".return-memos-card").getByRole("button").first().click();
  await assertContract(page, "Retained return memo dialog", "en-light");
  await page.keyboard.press("Escape");
  for (const role of ["Supervisor", "Floor Worker"] as const) {
    if (role === "Floor Worker") {
      await signIn(page, role);
      await page.goto("/#return?id=demo-return-1");
    }
    await button(
      page.locator(".return-header-card"),
      "Record resolution",
    ).click();
    const card = page.locator(".return-action-card");
    for (const outcome of [
      "Replaced",
      "Credited",
      "Cash or other compensation",
      ...(role === "Supervisor" ? ["Written off"] : []),
    ]) {
      await choose(page, field(card, "Outcome"), outcome);
      await assertContract(
        page,
        `Return settlement form: ${outcome}`,
        "en-light",
        role === "Supervisor" ? "supervisor" : "floor_worker",
      );
      if (role === "Floor Worker")
        await expect(field(card, "Actual credit amount")).toHaveCount(0);
    }
    await button(card, "Close").click();
  }
});
