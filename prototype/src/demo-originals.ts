import Decimal from "decimal.js";
import { branchLabel } from "./settings";
import type { CompanyConfig, DemoInvoice, InvoiceLine } from "./types";

const xml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const money = (value: string) => new Decimal(value).toFixed(2);
const decimal = (value: Decimal.Value) =>
  new Decimal(value).toFixed().replace(/\.0+$/, "");

function words(value: string, maximum: number): string[] {
  const result: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    for (let offset = 0; offset < word.length; offset += maximum) {
      const part = word.slice(offset, offset + maximum);
      if (current && `${current} ${part}`.length > maximum) {
        result.push(current);
        current = "";
      }
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current) result.push(current);
  return result.length ? result : [""];
}

function quantity(line: InvoiceLine): string[] {
  if (
    line.sold_by === "weight" &&
    line.source_quantity &&
    line.source_quantity_unit
  )
    return [`${decimal(line.source_quantity)} ${line.source_quantity_unit}`];
  const pack = line.units_per_case ?? 1;
  if (pack > 1) {
    const cases = new Decimal(line.qty_invoiced).div(pack);
    // A non-terminating fractional case must not imply a rounded physical quantity.
    if (cases.decimalPlaces() <= 3)
      return [
        `${decimal(cases)} ${cases.eq(1) ? "case" : "cases"}`,
        `(${decimal(line.qty_invoiced)} ${new Decimal(line.qty_invoiced).eq(1) ? "unit" : "units"})`,
      ];
  }
  return [
    `${decimal(line.qty_invoiced)} ${new Decimal(line.qty_invoiced).eq(1) ? "unit" : "units"}`,
  ];
}

/** Generate a fictional source document from this exact invoice snapshot once.
 * The returned image is stored with the invoice; it is never a live catalog view. */
export function demoOriginalSvg(
  invoice: DemoInvoice,
  config: CompanyConfig,
): string {
  const rows = invoice.lines.map((line) => ({
    line,
    description: words(line.description, 40),
    quantity: quantity(line),
  }));
  const heights = rows.map((row) =>
    Math.max(76, row.description.length * 22 + 24),
  );
  const rowBottom = 304 + heights.reduce((sum, height) => sum + height, 0);
  const height = rowBottom + 270;
  const text = (x: number, y: number, value: unknown, size = 15, extra = "") =>
    `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${xml(value)}</text>`;
  let y = 304;
  const body = rows
    .map(({ line, description, quantity: entered }, index) => {
      const top = y;
      y += heights[index];
      const pack =
        line.sold_by === "weight"
          ? line.case_weight
            ? `${line.case_weight} ${line.case_weight_unit ?? "kg"}`
            : "—"
          : String(line.units_per_case ?? 1);
      const unitCost =
        line.sold_by === "weight" && line.source_cost_before_tax
          ? `${line.source_cost_before_tax}/${line.source_cost_unit ?? "lb"}`
          : new Decimal(line.unit_cost_before_tax).toFixed(4);
      return `<rect x="52" y="${top}" width="896" height="${heights[index]}" fill="${index % 2 ? "#ffffff" : "#f6f7f9"}"/>
      ${text(66, top + 28, line.product_code, 14)}
      ${description.map((part, lineIndex) => text(142, top + 28 + lineIndex * 22, part, 15)).join("")}
      ${text(508, top + 28, pack, 14, 'text-anchor="end"')}
      ${entered.map((part, lineIndex) => text(636, top + 28 + lineIndex * 22, part, lineIndex ? 12 : 14, 'text-anchor="end"')).join("")}
      ${text(788, top + 28, unitCost, 14, 'text-anchor="end"')}
      ${text(932, top + 28, money(line.line_total), 15, 'text-anchor="end"')}`;
    })
    .join("");
  const number = invoice.supplier_invoice_number || invoice.id;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-label="${xml(`Fictional invoice ${number}`)}">
    <rect width="1000" height="${height}" fill="#ffffff"/>
    <g font-family="Arial, sans-serif" fill="#17202a">
      ${text(52, 78, invoice.supplier, 30, 'font-weight="700"')}
      ${text(52, 112, "Fictional supplier invoice · Demo only", 14, 'fill="#586575"')}
      ${text(948, 74, "INVOICE", 29, 'font-weight="700" text-anchor="end"')}
      ${text(948, 108, number, 18, 'font-weight="600" text-anchor="end"')}
      <line x1="52" y1="140" x2="948" y2="140" stroke="#cdd4de"/>
      ${text(52, 178, "BILL TO", 12, 'font-weight="700" fill="#586575"')}
      ${text(52, 204, config.company.name_en, 18, 'font-weight="600"')}
      ${text(52, 230, branchLabel(config, invoice.branch, "en"), 16)}
      ${text(948, 181, `Invoice date: ${invoice.invoice_date ?? "—"}`, 15, 'text-anchor="end"')}
      ${text(948, 207, `Terms: ${invoice.payment_terms ?? "—"}`, 15, 'text-anchor="end"')}
      ${text(948, 233, `Currency: ${config.company.currency}`, 15, 'text-anchor="end"')}
      <rect x="52" y="268" width="896" height="36" fill="#e9edf3"/>
      ${text(66, 292, "Code", 13, 'font-weight="700"')}
      ${text(142, 292, "Description", 13, 'font-weight="700"')}
      ${text(508, 292, "Case pack", 13, 'font-weight="700" text-anchor="end"')}
      ${text(636, 292, "Quantity", 13, 'font-weight="700" text-anchor="end"')}
      ${text(788, 292, "Unit cost", 13, 'font-weight="700" text-anchor="end"')}
      ${text(932, 292, "Line total", 13, 'font-weight="700" text-anchor="end"')}
      ${body}
      <line x1="52" y1="${rowBottom}" x2="948" y2="${rowBottom}" stroke="#cdd4de"/>
      ${text(738, rowBottom + 44, "Subtotal", 16)}
      ${text(932, rowBottom + 44, money(invoice.subtotal), 17, 'text-anchor="end"')}
      ${text(738, rowBottom + 78, "Tax", 16)}
      ${text(932, rowBottom + 78, money(invoice.tax), 17, 'text-anchor="end"')}
      <line x1="720" y1="${rowBottom + 96}" x2="948" y2="${rowBottom + 96}" stroke="#cdd4de"/>
      ${text(738, rowBottom + 132, "TOTAL", 20, 'font-weight="700"')}
      ${text(932, rowBottom + 132, money(invoice.final_total), 23, 'font-weight="700" text-anchor="end"')}
      ${text(52, rowBottom + 206, "Fictional document for the supermarket prototype. No real payment or delivery is requested.", 13, 'fill="#586575"')}
      ${text(52, rowBottom + 232, `Retained snapshot: ${invoice.id}`, 11, 'fill="#586575"')}
    </g>
  </svg>`;
}

export function retainDemoOriginal(
  invoice: DemoInvoice,
  config: CompanyConfig,
): void {
  if (
    invoice.demo_original_snapshot ||
    (invoice.file_data && !isGeneratedDemoTextOriginal(invoice))
  )
    return;
  if (invoice.file_data) {
    invoice.legacy_demo_original = {
      file_name: invoice.file_name,
      file_type: invoice.file_type,
      file_data: invoice.file_data,
    };
  }
  const number = (invoice.supplier_invoice_number || invoice.id)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  invoice.file_name = `fictional-${number}.svg`;
  invoice.file_type = "image/svg+xml";
  invoice.file_data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(demoOriginalSvg(invoice, config))}`;
  invoice.demo_original_snapshot = true;
}

/** Identity, MIME, filename and exact generated content must all match.
 * A user upload named like a demo invoice is still an original and stays intact. */
export function isGeneratedDemoTextOriginal(invoice: DemoInvoice): boolean {
  const number = invoice.supplier_invoice_number;
  if (
    invoice.id !== `a2-fixture:${number}` ||
    invoice.file_type !== "text/plain" ||
    invoice.file_name !== `${number}-fictional-demo.txt`
  )
    return false;
  const expected = `Fictional prototype invoice ${number}\n${invoice.supplier}\n${invoice.invoice_date}\n${invoice.lines.map((line) => `${line.description}: ${line.qty_invoiced} × ${line.unit_cost_before_tax}`).join("\n")}\nTotal ${invoice.final_total}`;
  return (
    invoice.file_data ===
    `data:text/plain;charset=utf-8,${encodeURIComponent(expected)}`
  );
}
