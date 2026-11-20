import { File as NodeFile } from "node:buffer";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  createPickedInvoice,
  invoiceEntryOrigin,
  InvoiceSelectionError,
  type InvoiceIntakeCommand,
  type InvoiceSourceChoice,
} from "./invoice-intake";
import type { ProtectedInvoiceQuery } from "./invoice-file-access";
import type { RoleId } from "./authority-types";
import { invoiceView } from "./invoice-projections";
const sources = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(async (file: File, company: string) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha = createHash("sha256").update(bytes).digest("hex");
    const reference = `idb-file:v1:${company}:${sha}`;
    sources.set(reference, bytes);
    return { reference, name: file.name, type: file.type, size: file.size };
  }),
}));
beforeEach(() => {
  sources.clear();
});
function file(
  name = "fictional-original.png",
  type = "image/png",
  bytes = "Fictional untouched bytes",
) {
  return new NodeFile([bytes], name, { type }) as unknown as File;
}
function environment(role: RoleId = "manager") {
  const state = initialState();
  let actor = authenticatedTestActor(state, role, {
    selection: { kind: "location", location_id: "Branch 1" },
  });
  state.invoices = [];
  state.activity = [];
  const calls: string[] = [];
  const command: InvoiceIntakeCommand = async (capability, _scope, mutate) => {
    calls.push(capability);
    return mutate(state, actor);
  };
  const query: ProtectedInvoiceQuery = async (_capability, _scope, project) =>
    project(state, actor);
  return {
    state,
    get actor() {
      return actor;
    },
    calls,
    ports: { command, query },
    replaceActor() {
      actor = authenticatedTestActor(state, "owner", {
        selection: { kind: "location", location_id: "Branch 1" },
      });
    },
  };
}
function selected(
  data: ReturnType<typeof environment>,
  files = [file()],
  source: InvoiceSourceChoice = "photo",
) {
  return { source, files, origin: invoiceEntryOrigin(data.actor) };
}

describe("R3c F3 picker-before-draft intake", () => {
  it.each([
    ["empty selection", [], "photo"],
    ["empty file", [file("fictional-empty.pdf", "application/pdf", "")], "pdf"],
    ["wrong photo type", [file("fictional.txt", "text/plain")], "photo"],
    [
      "multiple PDFs",
      [
        file("fictional1.pdf", "application/pdf"),
        file("fictional2.pdf", "application/pdf"),
      ],
      "pdf",
    ],
    ["photo through PDF", [file()], "pdf"],
  ] as const)(
    "rejects %s before allocating records, audit or blobs",
    async (_label, files, source) => {
      const data = environment();
      const before = JSON.stringify(data.state);
      await expect(
        createPickedInvoice(
          data.ports,
          data.actor,
          { source, files, origin: invoiceEntryOrigin(data.actor) },
          vi.fn(),
        ),
      ).rejects.toBeInstanceOf(InvoiceSelectionError);
      expect(data.calls).toEqual([]);
      expect(JSON.stringify(data.state)).toBe(before);
      expect(sources.size).toBe(0);
    },
  );
  it("saves ordered live photos on one actual floor-owned target and preserves the old workspace and finance", async () => {
    const data = environment("floor_worker");
    data.state.config.receiving.ai_reading_mode = "live";
    const previous = structuredClone(data.state.invoice);
    const finance = structuredClone({
      ledger: data.state.ledger,
      products: data.state.products,
      approvals: data.state.approvals,
      movements: data.state.stock_movements,
    });
    const photos = [
      file("fictional-first.png", "image/png", "Fictional first"),
      file("fictional-second.png", "image/png", "Fictional second"),
    ];
    const created = vi.fn();
    const id = await createPickedInvoice(
      data.ports,
      data.actor,
      selected(data, photos),
      created,
    );
    expect(created).toHaveBeenCalledExactlyOnceWith(id);
    expect(id).not.toBe(previous.id);
    expect(data.state.invoice).toMatchObject({
      id,
      status: "reading",
      created_by_user_id: data.actor.user_id,
      live_reading: { phase: "ready" },
    });
    expect(data.state.invoice.lines).toEqual([]);
    expect(
      data.state.invoice.original_pages?.map((page) => page.file_name),
    ).toEqual(photos.map((photo) => photo.name));
    expect(
      data.state.invoices!.find((invoice) => invoice.id === previous.id),
    ).toEqual(previous);
    for (let index = 0; index < photos.length; index++)
      expect(
        Buffer.from(
          sources.get(data.state.invoice.original_pages![index].file_data)!,
        ),
      ).toEqual(Buffer.from(await photos[index].arrayBuffer()));
    expect(data.state.activity).toHaveLength(1);
    expect(data.state.activity[0]).toMatchObject({
      action: "Create invoice draft",
      actor_user_id: data.actor.user_id,
      entity_id: id,
    });
    expect({
      ledger: data.state.ledger,
      products: data.state.products,
      approvals: data.state.approvals,
      movements: data.state.stock_movements,
    }).toEqual(finance);
  });
  it.each(["live", "simulated"] as const)(
    "retains one selected PDF without reading or posting in %s mode",
    async (mode) => {
      const data = environment();
      data.state.config.receiving.ai_reading_mode = mode;
      const original = file(
        "fictional-original.pdf",
        "application/pdf",
        "%PDF fictional untouched original",
      );
      const id = await createPickedInvoice(
        data.ports,
        data.actor,
        selected(data, [original], "pdf"),
        vi.fn(),
      );
      expect(data.state.invoice.id).toBe(id);
      expect(data.state.invoice.status).toBe("reading");
      expect(data.state.invoice.file_name).toBe(original.name);
      expect(data.state.invoice.original_pages).toHaveLength(1);
      expect(Buffer.from(sources.get(data.state.invoice.file_data!)!)).toEqual(
        Buffer.from(await original.arrayBuffer()),
      );
      if (mode === "live")
        expect(data.state.invoice.live_reading?.phase).toBe("ready");
      else expect(data.state.invoice.live_reading).toBeUndefined();
    },
  );
  it("does not adopt a different authorized person while asynchronous source validation is pending", async () => {
    const data = environment();
    data.state.config.receiving.ai_reading_mode = "live";
    const original = file(
      "fictional-validation.svg",
      "image/svg+xml",
      "<svg>Fictional</svg>",
    );
    let release!: () => void;
    const pending = new Promise<ArrayBuffer>((resolve) => {
      release = () =>
        resolve(new TextEncoder().encode("<svg>Fictional</svg>").buffer);
    });
    vi.spyOn(original, "arrayBuffer").mockReturnValue(pending);
    const prior = structuredClone(data.state.invoice);
    const request = createPickedInvoice(
      data.ports,
      data.actor,
      selected(data, [original]),
      vi.fn(),
    );
    data.replaceActor();
    release();
    await expect(request).rejects.toThrow(
      "person or receiving location changed",
    );
    expect(data.state.invoice).toEqual(prior);
    expect(data.state.invoices).toEqual([]);
    expect(data.state.activity).toEqual([]);
    expect(sources.size).toBe(0);
  });
  it("does not allocate a draft when the selected route leaves during asynchronous validation", async () => {
    const data = environment();
    const original = file(
      "fictional-validation.svg",
      "image/svg+xml",
      "<svg>Fictional</svg>",
    );
    let release!: () => void;
    const pending = new Promise<ArrayBuffer>((resolve) => {
      release = () =>
        resolve(new TextEncoder().encode("<svg>Fictional</svg>").buffer);
    });
    vi.spyOn(original, "arrayBuffer").mockReturnValue(pending);
    let current = true;
    const before = structuredClone(data.state);
    const created = vi.fn();
    const request = createPickedInvoice(
      data.ports,
      data.actor,
      {
        ...selected(data, [original]),
        isCurrent: () => current,
      },
      created,
    );
    current = false;
    release();
    await expect(request).rejects.toThrow("entry view changed");
    expect(data.calls).toEqual([]);
    expect(data.state).toEqual(before);
    expect(created).not.toHaveBeenCalled();
    expect(sources.size).toBe(0);
  });
  it("does not give the next authorized person the chosen bytes after the target has been created", async () => {
    const data = environment();
    data.state.config.receiving.ai_reading_mode = "live";
    const sourceActor = data.actor.user_id;
    const onCreated = vi.fn(() => data.replaceActor());
    await expect(
      createPickedInvoice(data.ports, data.actor, selected(data), onCreated),
    ).rejects.toThrow("person or receiving location changed");
    expect(onCreated).toHaveBeenCalledOnce();
    expect(data.state.invoice.created_by_user_id).toBe(sourceActor);
    expect(data.state.invoice.file_data).toBeUndefined();
    expect(data.state.invoice.lines).toEqual([]);
    expect(data.state.activity).toHaveLength(1);
    expect(sources.size).toBe(0);
  });
});

it("retains genuine simulated intake provenance after switching to Live without mislabelling a live original", async () => {
  const data = environment();
  data.state.config.receiving.ai_reading_mode = "simulated";
  const original = file();
  const id = await createPickedInvoice(
    data.ports,
    data.actor,
    selected(data, [original]),
    vi.fn(),
  );
  const simulated = structuredClone(data.state.invoice);
  expect(simulated.simulated_reading).toBe(true);
  expect(Buffer.from(sources.get(simulated.file_data!)!)).toEqual(
    Buffer.from(await original.arrayBuffer()),
  );
  data.state.config.receiving.ai_reading_mode = "live";
  expect(data.state.invoice).toEqual(simulated);
  expect(invoiceView(data.state, data.actor, id).simulated_reading).toBe(true);
  await createPickedInvoice(data.ports, data.actor, selected(data), vi.fn());
  expect(data.state.invoice.id).not.toBe(id);
  expect(data.state.invoice.simulated_reading).toBeUndefined();
  expect(data.state.invoice.lines).toEqual([]);
  expect(data.state.invoices!.find((invoice) => invoice.id === id)).toEqual(
    simulated,
  );
});
