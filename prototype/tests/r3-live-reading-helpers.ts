import { createHash } from "node:crypto";
import { expect, type Page, type Route } from "@playwright/test";
import { FILE_DATABASE_NAME } from "../src/file-database";
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1";
import type { DemoInvoice, DemoState } from "../src/types";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { chooseOption, setBranch, signIn, type DemoRole } from "./helpers";

export interface FictionalOriginal {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export const readerAddress = "http://fictional-reader.test:5191";
export const failureMessage =
  "The AI reading didn't finish. Your original is saved.";
export const liveModels = ["Fictional Vision A", "Fictional Vision B"];
export const t = (language: "en" | "fa", en: string, fa: string) =>
  language === "fa" ? fa : en;

/** Independent fictional kit response, never derived from an uploaded invoice. */
export function fictionalResponse(number = "R3-FICTIONAL-001") {
  return {
    reading: {
      schema_version: "invoice-reading-v2",
      supplier_name: "R3 Fictional Orchard Ltd.",
      supplier_address: "25 Invented Test Road, Toronto, ON",
      supplier_tax_number: "R3-FICTIONAL-TAX",
      supplier_invoice_number: number,
      invoice_date: "2026-10-28",
      invoice_date_as_printed: "2026-10-28",
      due_date: null,
      payment_terms: "Net 14",
      bill_to: "North York",
      ship_to: "North York",
      branch_hint: "North York",
      order_reference: "R3-FICTIONAL-ORDER",
      currency: "CAD",
      subtotal: "24.69",
      tax: "0.00",
      final_total: "24.69",
      handwritten_notes: [],
      warnings: [],
      lines: [
        {
          line_no: 1,
          line_type: "item",
          supplier_sku: "R3-FICTIONAL-OATS",
          barcode: null,
          description: "R3 Fictional Oats 750 g",
          pack_size: null,
          lot_number: null,
          expiry_as_printed: null,
          quantity: "20",
          unit: "each",
          units_per_case: null,
          unit_cost_before_tax: "1.2345",
          cost_basis: "each",
          line_total: "24.69",
          taxable: false,
          handwritten_note: null,
          unclear_fields: ["unit_cost_before_tax"],
          units_received: "20",
          cost_per_unit_before_tax: "1.2345",
          cost_per_case_before_tax: null,
        },
      ],
    },
    statuses: { "lines[0].unit_cost_before_tax": "check" },
    alternatives: {},
    checksPassed: true,
    models: [...liveModels],
    costUSD: 0.11,
    seconds: 84,
  };
}
type FictionalReaderResponse = Omit<
  ReturnType<typeof fictionalResponse>,
  "models"
> & {
  models: (
    | string
    | { id: string; ok: boolean; seconds: number; costUSD: number; error: null }
  )[];
  checkFailures?: unknown[];
};
export type ReaderOutcome =
  | { kind: "success"; response?: FictionalReaderResponse }
  | { kind: "http" }
  | { kind: "network" }
  | { kind: "invalid-json" }
  | {
      kind: "held";
      wait: Promise<void>;
      response?: FictionalReaderResponse;
    };
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
export async function mockReader(
  page: Page,
  outcomes: ReaderOutcome[],
  health: { ok: boolean } = { ok: true },
) {
  const requests: { images: { mime: string; data: string }[] }[] = [];
  let finished = 0;
  let healthCalls = 0;
  const cors = () => ({
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  await page.route("**/health", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors() });
      return;
    }
    expect(route.request().method()).toBe("GET");
    healthCalls++;
    if (!health.ok) await route.abort("failed");
    else
      await route.fulfill({
        status: 200,
        headers: cors(),
        json: { status: "ok" },
      });
  });
  await page.route("**/api/v1/invoice-readings", async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors() });
      return;
    }
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers().authorization).toBeUndefined();
    expect(request.headers().cookie).toBeUndefined();
    const body = request.postDataJSON();
    expect(Object.keys(body)).toEqual(["images"]);
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images.length).toBeGreaterThan(0);
    for (const image of body.images) {
      expect(Object.keys(image).sort()).toEqual(["data", "mime"]);
      expect(image.mime).toBe("image/jpeg");
      expect(typeof image.data).toBe("string");
      expect(Buffer.from(image.data, "base64").subarray(0, 2)).toEqual(
        Buffer.from([0xff, 0xd8]),
      );
    }
    const index = requests.push(body) - 1;
    const outcome = outcomes[index];
    // An extra automatic request is an error, not another success fixture.
    expect(outcome, "One request per explicit press").toBeDefined();
    try {
      if (outcome.kind === "network") await route.abort("failed");
      else if (outcome.kind === "http")
        await route.fulfill({
          status: 500,
          headers: cors(),
          json: { message: "Fictional reader failure" },
        });
      else if (outcome.kind === "invalid-json")
        await route.fulfill({
          status: 200,
          headers: { ...cors(), "content-type": "application/json" },
          body: "{fictional-invalid-json",
        });
      else {
        if (outcome.kind === "held") await outcome.wait;
        try {
          await route.fulfill({
            status: 200,
            headers: cors(),
            json: outcome.response ?? fictionalResponse(),
          });
        } catch (cause) {
          if (!page.isClosed() && !request.failure()) throw cause;
        }
      }
    } finally {
      finished++;
    }
  });
  return {
    requests,
    get finished() {
      return finished;
    },
    get healthCalls() {
      return healthCalls;
    },
  };
}

export async function openReceiving(page: Page) {
  await page.goto("/#settings?group=receiving");
  await expect(
    page.getByRole("navigation", { name: "Settings groups", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Receiving", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI reading", exact: true }),
  ).toBeVisible();
}
export async function configureLive(page: Page) {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await openReceiving(page);
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Reading mode", exact: true }),
    "live",
    "Live",
  );
  await page
    .getByRole("textbox", { name: "Reader address", exact: true })
    .fill(readerAddress);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(async () => {
      const receiving = (await readCanonicalBusinessEvidence(page)).config
        .receiving;
      return {
        mode: receiving.ai_reading_mode,
        address: receiving.ai_reader_address,
      };
    })
    .toEqual({ mode: "live", address: readerAddress });
}

/** Observe a genuine new Demo SID; never mint or write an identity for tests. */
export async function renewDemoSession(page: Page, person: DemoRole) {
  const route = page.url();
  const session = () =>
    page.evaluate((key) => {
      const saved = sessionStorage.getItem(key);
      return saved
        ? (JSON.parse(saved) as { session_id: string }).session_id
        : null;
    }, AUTH_IDENTITY_KEY);
  const previous = await session();
  expect(previous).toBeTruthy();
  await signIn(page, person);
  await expect
    .poll(async () => {
      const current = await session();
      return !!current && current !== previous;
    })
    .toBe(true);
  await page.goto(route);
}

export async function fictionalPhoto(
  page: Page,
  name: string,
  color = "#d41414",
): Promise<FictionalOriginal> {
  const data = await page.evaluate(
    ({ color, name }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 240;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.font = "12px sans-serif";
      context.fillText("FICTIONAL R3", 10, 30);
      context.fillText(name, 10, 50);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { color, name },
  );
  return { name, mimeType: "image/png", buffer: Buffer.from(data, "base64") };
}
export async function newLiveOriginal(
  page: Page,
  files: FictionalOriginal | FictionalOriginal[] | string,
  source: "photo" | "pdf" = "photo",
  language: "en" | "fa" = "en",
) {
  await page.goto("/#invoices");
  await expect(
    page.locator(".topbar .branch-pill[role=combobox]"),
  ).toBeEnabled();
  const beforeEntry = await readCanonicalBusinessEvidence(page);
  await page
    .getByRole("button", {
      name: t(language, "New invoice", "فاکتور جدید"),
      exact: true,
    })
    .click();
  const chooser = page.getByRole("dialog", {
    name: t(language, "New invoice", "فاکتور جدید"),
    exact: true,
  });
  await expect(
    chooser.getByText("AI reading is simulated in this demo", { exact: true }),
  ).toHaveCount(0);
  const nativePicker = page.waitForEvent("filechooser");
  await chooser
    .getByRole("button", {
      name:
        source === "pdf"
          ? t(language, "PDF (AI reading)", "PDF (خوانش هوش مصنوعی)")
          : t(language, "Photo (AI reading)", "عکس (خوانش هوش مصنوعی)"),
      exact: true,
    })
    .click();
  const selected = await nativePicker;
  expect(await selected.element().getAttribute("data-testid")).toBe(
    "invoice-entry-original",
  );
  await expect(chooser).toHaveCount(0);
  const input = page.getByTestId("invoice-entry-original");
  await expect(input).toBeAttached();
  // Opening or cancelling the native picker must not create an empty draft.
  expect(await readCanonicalBusinessEvidence(page)).toEqual(beforeEntry);
  expect(selected.isMultiple()).toBe(source === "photo");
  await selected.setFiles(files);
  await expect
    .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice)
    .toMatchObject({
      status: "reading",
      live_reading: { phase: "ready" },
    });
  const afterAttach = await readCanonicalBusinessEvidence(page);
  const invoice = afterAttach.invoice;
  expect(invoice.id).not.toBe(beforeEntry.invoice.id);
  expect(invoice.file_data).toMatch(/^idb-file:v1:/);
  expect(invoice.lines).toEqual([]);
  expect(invoice.short_lines).toEqual([]);
  expect(invoice.supplier).toBe("");
  expect(invoice.supplier_invoice_number).toBe("");
  expect(afterAttach.supplier_items).toEqual(beforeEntry.supplier_items);
  return invoice;
}
export async function pressRead(page: Page, language: "en" | "fa" = "en") {
  await page
    .getByRole("button", {
      name: t(language, "Read invoice", "خواندن فاکتور"),
      exact: true,
    })
    .click();
}
export async function expectReview(
  page: Page,
  invoiceId: string,
  language: "en" | "fa" = "en",
) {
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: t(language, "Invoice lines", "ردیف‌های فاکتور"),
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice)
    .toMatchObject({ id: invoiceId, status: "review" });
  return (await readCanonicalBusinessEvidence(page)).invoice;
}
export function expectNoPosting(before: DemoState, after: DemoState) {
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  expect(after.approvals).toEqual(before.approvals);
  expect(after.sales).toEqual(before.sales);
  for (const product of before.products)
    expect(
      after.products.find(
        (item) =>
          item.code === product.code && item.company_id === product.company_id,
      ),
    ).toEqual(product);
}
export function originalReferences(invoice: DemoInvoice) {
  return [
    ...new Set(
      [
        invoice.file_data,
        ...(invoice.original_pages ?? []).map((p) => p.file_data),
      ].filter((value): value is string => !!value),
    ),
  ];
}
export async function retainedSourceHashes(page: Page, invoice: DemoInvoice) {
  const references = originalReferences(invoice);
  expect(references.length).toBeGreaterThan(0);
  return page.evaluate(
    async ({ references, databaseName, companyId }) => {
      const open = indexedDB.open(databaseName);
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onupgradeneeded = () => {
          open.transaction!.abort();
          reject(new Error("Evidence must not create the source database."));
        };
        open.onerror = open.onblocked = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      try {
        const transaction = database.transaction("files", "readonly");
        const records = await Promise.all(
          references.map(
            (id) =>
              new Promise<{
                company_id: string;
                source: Blob | ArrayBuffer;
                sha256: string;
              }>((resolve, reject) => {
                const read = transaction.objectStore("files").get(id);
                read.onsuccess = () => resolve(read.result);
                read.onerror = () => reject(read.error);
              }),
          ),
        );
        return await Promise.all(
          records.map(async (record) => {
            if (record.company_id !== companyId)
              throw new Error("Original company differs.");
            const bytes =
              record.source instanceof Blob
                ? await record.source.arrayBuffer()
                : record.source;
            if (!(bytes instanceof ArrayBuffer))
              throw new Error("Unknown retained source encoding.");
            const hash = [
              ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            ]
              .map((value) => value.toString(16).padStart(2, "0"))
              .join("");
            if (hash !== record.sha256)
              throw new Error("Original source bytes changed.");
            return hash;
          }),
        );
      } finally {
        database.close();
      }
    },
    {
      references,
      databaseName: FILE_DATABASE_NAME,
      companyId: invoice.company_id,
    },
  );
}
export function sourceHash(file: FictionalOriginal) {
  return createHash("sha256").update(file.buffer).digest("hex");
}
export async function jpegFacts(
  page: Page,
  images: { mime: string; data: string }[],
) {
  return page.evaluate(async (images) => {
    return Promise.all(
      images.map(async (image) => {
        const blob = await (
          await fetch(`data:${image.mime};base64,${image.data}`)
        ).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const pixel = Array.from(context.getImageData(0, 0, 1, 1).data);
        bitmap.close();
        return { width: canvas.width, height: canvas.height, pixel };
      }),
    );
  }, images);
}
