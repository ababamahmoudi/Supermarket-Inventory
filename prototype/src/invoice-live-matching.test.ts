import { File as NodeFile } from "node:buffer";
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import sample from "../tests/fixtures/fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { createInvoice } from "./invoice";
import { storeInvoiceUpload } from "./invoice-file-access";
import {
  attachLiveInvoiceOriginals,
  beginLiveInvoiceReading,
} from "./invoice-live-reading";
import { parseInvoiceReadings } from "./invoice-readings";
import { inspectLiveInvoiceMatching } from "./invoice-live-matching";
vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(async (file: File, company: string) => ({
    reference: `idb-file:v1:${company}:${createHash("sha256")
      .update(new Uint8Array(await file.arrayBuffer()))
      .digest("hex")}`,
    name: file.name,
    type: file.type,
    size: file.size,
  })),
}));
async function processing(role: "manager" | "floor_worker" = "manager") {
  const state = initialState();
  state.invoices = [];
  const actor = authenticatedTestActor(state, role);
  state.invoice = createInvoice(state, actor, "Branch 1", false, {
    empty: true,
  });
  const file = new NodeFile(
    ["fictional retained source"],
    "fictional-matching.png",
    { type: "image/png" },
  ) as unknown as File;
  const upload = await storeInvoiceUpload(
    async (_capability, _scope, project) => project(state, actor),
    file,
    { company_id: actor.company_id, invoice_id: state.invoice.id },
  );
  attachLiveInvoiceOriginals(state, actor, {
    invoice_id: state.invoice.id,
    uploads: [upload],
  });
  const attempt = beginLiveInvoiceReading(state, actor, state.invoice.id);
  const exported = parseInvoiceReadings(JSON.stringify(sample));
  exported.invoices = [exported.invoices[0]];
  const reading = exported.invoices[0].ai_reading!;
  reading.lines = [
    {
      description: state.products[0].name_en,
      barcode: state.products[0].barcode,
      line_type: "item",
      quantity: "1",
      unit: "each",
      unit_cost_before_tax: "1.2345",
      line_total: "1.23",
    },
  ];
  return { state, actor, input: { ...attempt, exported } };
}
it.each(["manager", "floor_worker"] as const)(
  "%s performs actual protected matching without Settings authority, changes or financial source data",
  async (role) => {
    const { state, actor, input } = await processing(role);
    const before = JSON.stringify(state);
    expect(inspectLiveInvoiceMatching(state, actor, input)).toEqual({
      lines: 1,
      matched: 1,
      new: 0,
    });
    expect(JSON.stringify(state)).toBe(before);
  },
);
it("rejects a superseded attempt without writing", async () => {
  const { state, actor, input } = await processing();
  beginLiveInvoiceReading(state, actor, state.invoice.id);
  const before = JSON.stringify(state);
  expect(() => inspectLiveInvoiceMatching(state, actor, input)).toThrow();
  expect(JSON.stringify(state)).toBe(before);
});
it("rejects changed originals independently of the screen or transport", async () => {
  const { state, actor, input } = await processing();
  state.invoice.original_pages![0].original_sha256 = "b".repeat(64);
  const before = JSON.stringify(state);
  expect(() => inspectLiveInvoiceMatching(state, actor, input)).toThrow();
  expect(JSON.stringify(state)).toBe(before);
});
it("cannot run the accepted person's matching under another real person", async () => {
  const { state, input } = await processing();
  const other = authenticatedTestActor(state, "floor_worker");
  const before = JSON.stringify(state);
  expect(() => inspectLiveInvoiceMatching(state, other, input)).toThrow();
  expect(JSON.stringify(state)).toBe(before);
});
it("keeps a malformed or empty result from advancing into prices", async () => {
  const { state, actor, input } = await processing();
  input.exported.invoices[0].ai_reading!.lines = [];
  const before = JSON.stringify(state);
  expect(() => inspectLiveInvoiceMatching(state, actor, input)).toThrow(
    "no usable lines",
  );
  expect(JSON.stringify(state)).toBe(before);
});

it("rejects another company's genuine actor without revealing a match count", async () => {
  const { state, input } = await processing();
  const foreign = initialState();
  foreign.config.company.seed_key = "fictional-other-company";
  const intruder = authenticatedTestActor(foreign, "manager");
  const before = JSON.stringify(state);
  expect(() => inspectLiveInvoiceMatching(state, intruder, input)).toThrow();
  expect(JSON.stringify(state)).toBe(before);
});
