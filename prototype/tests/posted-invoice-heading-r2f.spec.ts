import { expect, test } from "@playwright/test";
import { signIn, setLanguage, setBranch } from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { inspectC8Layout } from "../scripts/capture-c8-proof.mjs";

for (const language of ["en", "fa"] as const)
  test(`Posted invoice keeps its full heading and a bounded source number ${language}`, async ({
    page,
  }, info) => {
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    const reference = "C8-QA-SHORT-LAYOUT";
    const invoiceId = await runCanonicalBusinessFixture(
      page,
      (state, args) => {
        const invoice = state.invoices?.find(
          (invoice) =>
            invoice.status === "posted" && invoice.branch === "Branch 1",
        );
        if (!invoice)
          throw new Error("The fictional posted invoice is required.");
        invoice.supplier_invoice_number = args.reference;
        invoice.number_is_system_assigned = true;
        return invoice.id;
      },
      { reference },
    );
    await page.goto(`/#invoices?id=${encodeURIComponent(invoiceId)}`);
    const heading = page.getByRole("heading", { level: 1 });
    const number = page.locator(".posted-invoice-number");
    await expect(heading).toHaveAccessibleName(
      `${language === "en" ? "Invoice" : "فاکتور"} ${reference}`,
    );
    const before = await readCanonicalBusinessEvidence(page);
    const reports = [];
    for (const width of [390, 1000, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const proof = await inspectC8Layout(
        page,
        "posted-reference",
        language,
        width,
      );
      expect(proof.failures).toEqual([]);
      await expect(heading.locator(".invoice-title-reference")).toHaveText(
        reference,
      );
      await expect(number).toHaveAttribute("title", reference);
      await expect(number.locator("+ .muted")).toHaveText(
        language === "en" ? "System assigned" : "اختصاص‌یافته توسط سیستم",
      );
      expect((await number.locator("..").innerText()).trim()).not.toMatch(
        /\n\s*·/,
      );
      const shown = (await number.innerText()).trim();
      expect(shown.length).toBeGreaterThan(1);
      expect(
        shown === reference ||
          (shown.endsWith("…") && reference.startsWith(shown.slice(0, -1))),
      ).toBe(true);
      const geometry = await number.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter(
          (rect) => rect.width > 0 && rect.height > 0,
        );
        const field = element.parentElement!.getBoundingClientRect();
        const number = element.getBoundingClientRect();
        return {
          lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
          contained: rects.every(
            (rect) =>
              rect.left >= number.left - 1 && rect.right <= number.right + 1,
          ),
          fieldContained:
            number.left >= field.left - 1 && number.right <= field.right + 1,
        };
      });
      expect(geometry).toEqual({
        lines: 1,
        contained: true,
        fieldContained: true,
      });
      reports.push({ width, shown, geometry, proof });
      await page.screenshot({
        path: info.outputPath(`posted-reference-${width}-${language}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await inspectC8Layout(page, "posted-reference-phone", language, 390);
    const saved = await number.evaluate((element) => ({
      html: element.innerHTML,
      style: element.getAttribute("style"),
    }));
    await number.evaluate((element, reference) => {
      element.textContent = reference;
      element.setAttribute("style", "white-space: normal; inline-size: 80px");
    }, reference);
    const invalid = await inspectC8Layout(
      page,
      "posted-reference-negative",
      language,
      390,
    );
    expect(
      invalid.failures.some((failure: string) =>
        failure.includes("content word broken in middle: QA-SHORT-LAYOUT"),
      ),
    ).toBe(true);
    await number.evaluate((element, saved) => {
      element.innerHTML = saved.html;
      if (saved.style === null) element.removeAttribute("style");
      else element.setAttribute("style", saved.style);
    }, saved);
    expect(
      (await inspectC8Layout(page, "posted-reference-restored", language, 390))
        .failures,
    ).toEqual([]);
    await expect(heading).toHaveAccessibleName(
      `${language === "en" ? "Invoice" : "فاکتور"} ${reference}`,
    );
    await expect(page.locator(".posted-receiving .back-link")).toHaveAttribute(
      "href",
      "#invoices",
    );
    await expect(page).toHaveURL(
      (url) => url.hash === `#invoices?id=${encodeURIComponent(invoiceId)}`,
    );
    const after = await readCanonicalBusinessEvidence(page);
    for (const key of [
      "invoices",
      "invoice_content_corrections",
      "invoice_received_corrections",
      "invoice_location_corrections",
      "stock_movements",
      "ledger",
      "products",
    ] as const)
      expect(after[key]).toEqual(before[key]);
    await info.attach("Posted invoice reference positive and negative proof", {
      body: JSON.stringify({ reports, invalid }),
      contentType: "application/json",
    });
  });
