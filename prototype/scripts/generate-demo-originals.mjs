/* global process, console, structuredClone */
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// These are source-document fixtures, not edited screenshots of the app.
// Live originals use the identical SVG renderer with each retained invoice date.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "public/demo-originals");
const anchor = "2026-10-09T16:00:00.000Z";
const NativeDate = globalThis.Date;
globalThis.Date = new Proxy(NativeDate, {
  construct(target, argumentsList) {
    return Reflect.construct(
      target,
      argumentsList.length ? argumentsList : [anchor],
    );
  },
  get(target, property) {
    return property === "now"
      ? () => NativeDate.parse(anchor)
      : Reflect.get(target, property);
  },
});

const server = await createServer({ root, server: { middlewareMode: true } });
let browser;
try {
  const { initialState } = await server.ssrLoadModule("/src/store.tsx");
  const { demoOriginalSvg } = await server.ssrLoadModule(
    "/src/demo-originals.ts",
  );
  const { demoSeed } = await server.ssrLoadModule("/src/config.ts");
  const state = initialState();
  const example = demoSeed.weighed_invoice_example;
  const product = state.products.find(
    (entry) => entry.code === example.product_code,
  );
  const weighed = {
    ...structuredClone(state.invoice),
    id: "fictional-weighed-example",
    supplier: example.supplier,
    supplier_invoice_number: example.supplier_invoice_number,
    branch: example.branch,
    lines: [
      {
        ...structuredClone(state.invoice.lines[0]),
        description: product.name_en,
        product_code: product.code,
        sold_by: "weight",
        qty_invoiced: Number(example.canonical_lb_quantity),
        qty_received_at_posting: Number(example.canonical_lb_quantity),
        source_quantity: example.source_quantity,
        source_quantity_unit: example.source_quantity_unit,
        source_cost_before_tax: example.source_cost_before_tax,
        source_cost_unit: example.source_cost_unit,
        unit_cost_before_tax: example.unit_cost_before_tax,
        line_total: example.subtotal,
      },
    ],
    subtotal: example.subtotal,
    tax: example.tax,
    final_total: example.final_total,
  };
  await mkdir(destination, { recursive: true });
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1400 },
    deviceScaleFactor: 1,
  });
  const fixtures = [];
  for (const invoice of [...state.invoices, state.invoice, weighed]) {
    const svg = `${demoOriginalSvg(invoice, state.config)}\n`;
    const filename = `fictional-${invoice.supplier_invoice_number.toLowerCase()}`;
    await writeFile(resolve(destination, `${filename}.svg`), svg, "utf8");
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await page.setContent(
      `<html><body style="margin:0;background:white"><img style="display:block;width:1000px" src="${source}"/></body></html>`,
    );
    await page.locator("img").evaluate(async (image) => image.decode());
    await page
      .locator("img")
      .screenshot({ path: resolve(destination, `${filename}.png`) });
    fixtures.push({
      invoice_id: invoice.id,
      number: invoice.supplier_invoice_number,
      supplier: invoice.supplier,
      branch: invoice.branch,
      date: invoice.invoice_date,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.final_total,
      svg: `${filename}.svg`,
      png: `${filename}.png`,
      source_sha256: createHash("sha256").update(svg).digest("hex"),
      lines: invoice.lines.map((line) => ({
        product_code: line.product_code,
        description: line.description,
        qty_invoiced: line.qty_invoiced,
        units_per_case: line.units_per_case,
        unit_cost_before_tax: line.unit_cost_before_tax,
        line_total: line.line_total,
      })),
    });
  }
  await writeFile(
    resolve(destination, "manifest.json"),
    `${JSON.stringify({ anchor, description: "Fictional source-document review fixtures. PNGs are direct rasterizations of the corresponding SVG. Runtime originals retain actual invoice dates and immutable snapshots.", fixtures }, null, 2)}\n`,
  );
  console.log(
    `Generated ${fixtures.length} fictional SVG and PNG source documents in ${destination}.`,
  );
} finally {
  await browser?.close();
  await server.close();
  globalThis.Date = NativeDate;
}
