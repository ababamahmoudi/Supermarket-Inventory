import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { BrowserAuthorityRepository } from "./authority-repository";
import { authoritySnapshot } from "./authority";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { returnCreateFixture } from "./return-create-test-fixture";
import {
  createReturn,
  returnCreateChoices,
  returnCreateScope,
  type CreateReturnInput,
} from "./return-create";
import {
  uploadReturnCreationPhoto,
  type ReturnCreationPhoto,
} from "./return-create-files";
import {
  loadReturnPhoto,
  type ProtectedReturnQuery,
} from "./return-file-access";
import { readStoredFile, storeUploadedFile } from "./file-database";
import type { DemoState } from "./types";

const storage = vi.hoisted(() => ({
  duringSave: null as null | (() => Promise<void>),
  duringRead: null as null | (() => Promise<void>),
  fail: false,
  reference: "idb-file:v1:super-arzon:" + "b".repeat(64),
}));
vi.mock("./file-database", async () => ({
  ...(await vi.importActual<typeof import("./file-database")>(
    "./file-database",
  )),
  storeUploadedFile: vi.fn(async (file: File) => {
    await storage.duringSave?.();
    if (storage.fail) throw new Error("storage");
    return {
      reference: storage.reference,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }),
  readStoredFile: vi.fn(async (reference: string, company_id: string) => {
    await storage.duringRead?.();
    const source = new Blob(["Independent fictional return photo"], {
      type: "image/png",
    });
    return {
      reference,
      company_id,
      name: "fictional-condition.png",
      type: "image/png",
      source_size: source.size,
      source,
      preview: source,
      sha256: "b".repeat(64),
      saved_at: new Date().toISOString(),
    };
  }),
}));
async function fixture() {
  const state = returnCreateFixture();
  const user = authenticatedTestFixture(state, "manager", {
    locations: ["Branch 1"],
    selection: { kind: "location", location_id: "Branch 1" },
  });
  const other = authenticatedTestFixture(state, "cashier", {
    user_id: "other-return-author",
    username: "other-return-author",
    locations: ["Branch 1"],
  });
  const snapshot = authoritySnapshot(state),
    repository = new BrowserAuthorityRepository(new IDBFactory());
  await repository.initialize({
    ...structuredClone(snapshot),
    people: [...snapshot.people],
    sessions: [...snapshot.sessions],
    devices: [...snapshot.devices],
    credentials: [],
    setup_challenges: [],
    audit: [],
  });
  await repository.initializeBusiness(state);
  let identity = user.identity;
  const query: ProtectedReturnQuery = async (capability, resource, project) =>
    (
      await repository.queryBusiness(identity, project, {
        capability,
        resource,
      })
    ).value;
  const product = returnCreateChoices(state, user.actor, "Branch 1")
    .products[0];
  const input: CreateReturnInput = {
    request_id: "photo-return-request-123",
    branch: "Branch 1",
    supplier_id: product.supplier_id,
    product_code: product.product_code,
    source_fingerprint: product.source_fingerprint,
    quantity: "2",
    quantity_unit: "units",
    reason: "damaged",
    note: "Independent invented condition",
    photos: [],
  };
  return {
    state,
    repository,
    user,
    other,
    input,
    query,
    setIdentity: (next: typeof identity) => {
      identity = next;
    },
  };
}
const photo = () =>
  new File(["Independent fictional return photo"], "fictional-condition.png", {
    type: "image/png",
  });
beforeEach(() => {
  storage.duringSave = null;
  storage.duringRead = null;
  storage.fail = false;
  vi.clearAllMocks();
});
describe("R2c 7.1 creation-photo authority", () => {
  it("retains a real proof through durable readback, failed business transaction retry, creation/retry and protected evidence read", async () => {
    const f = await fixture();
    try {
      const handle = await uploadReturnCreationPhoto(f.query, {
        ...f.input,
        company_id: f.user.actor.company_id,
        file: photo(),
      });
      expect(Object.keys(handle)).toEqual(["name"]);
      expect(readStoredFile).toHaveBeenCalledWith(
        storage.reference,
        f.user.actor.company_id,
      );
      const commit = (
        draft: DemoState,
        actor: Parameters<typeof createReturn>[1],
      ) => createReturn(draft, actor, { ...f.input, photos: [handle] });
      await expect(
        f.repository.runBusinessCommand(
          f.user.identity,
          (draft: DemoState, actor) => {
            commit(draft, actor);
            throw new Error("outer-rollback");
          },
          {
            capability: "returns.create",
            resource: returnCreateScope(
              f.user.actor.company_id,
              "Branch 1",
              true,
            ),
          },
        ),
      ).rejects.toThrow("outer-rollback");
      expect(
        (await f.repository.loadBusiness<DemoState>(f.user.actor.company_id))
          .state.returns,
      ).toEqual([]);
      const first = await f.repository.runBusinessCommand(
        f.user.identity,
        commit,
        {
          capability: "returns.create",
          resource: returnCreateScope(
            f.user.actor.company_id,
            "Branch 1",
            true,
          ),
        },
      );
      const second = await f.repository.runBusinessCommand(
        f.user.identity,
        commit,
        {
          capability: "returns.create",
          resource: returnCreateScope(
            f.user.actor.company_id,
            "Branch 1",
            true,
          ),
        },
      );
      expect(second.value).toBe(first.value);
      const saved = (
        await f.repository.loadBusiness<DemoState>(f.user.actor.company_id)
      ).state;
      expect(saved.returns).toHaveLength(1);
      expect(saved.activity).toHaveLength(1);
      const event = (
        saved.returns[0] as import("./operations").OperationalReturn
      ).evidence!.find((event) => event.kind === "creation_photo")!;
      expect(event.photo).toBe(storage.reference);
      const loaded = await loadReturnPhoto(f.query, {
        company_id: f.user.actor.company_id,
        return_id: first.value,
        event_id: event.id,
      });
      expect(loaded.reference).toBe(storage.reference);
    } finally {
      f.repository.dispose();
    }
  });
  it("rejects copied/raw/wrong-request proofs and allows no partial write", async () => {
    const f = await fixture();
    try {
      const handle = await uploadReturnCreationPhoto(f.query, {
        ...f.input,
        company_id: f.user.actor.company_id,
        file: photo(),
      });
      for (const photos of [
        [{ ...handle }],
        [storage.reference as unknown as ReturnCreationPhoto],
      ]) {
        const before = await f.repository.loadBusiness<DemoState>(
          f.user.actor.company_id,
        );
        await expect(
          f.repository.runBusinessCommand(
            f.user.identity,
            (draft: DemoState, actor) =>
              createReturn(draft, actor, { ...f.input, photos }),
            {
              capability: "returns.create",
              resource: returnCreateScope(
                f.user.actor.company_id,
                "Branch 1",
                true,
              ),
            },
          ),
        ).rejects.toThrow();
        expect(
          await f.repository.loadBusiness<DemoState>(f.user.actor.company_id),
        ).toEqual(before);
      }
      await expect(
        f.repository.runBusinessCommand(
          f.user.identity,
          (draft: DemoState, actor) =>
            createReturn(draft, actor, {
              ...f.input,
              request_id: "different-photo-request",
              photos: [handle],
            }),
          {
            capability: "returns.create",
            resource: returnCreateScope(
              f.user.actor.company_id,
              "Branch 1",
              true,
            ),
          },
        ),
      ).rejects.toThrow();
    } finally {
      f.repository.dispose();
    }
  });
  it.each(["source", "location", "person-version", "session"] as const)(
    "rejects %s changes during asynchronous file storage",
    async (kind) => {
      const f = await fixture();
      try {
        storage.duringSave = async () => {
          if (kind === "source")
            await f.repository.runBusinessCommand(
              f.user.identity,
              (draft: DemoState) => {
                draft.invoices![0].lines[0].unit_cost_before_tax = "9.0000";
              },
              {
                capability: "settings.manage",
                resource: {
                  company_id: f.user.actor.company_id,
                  kind: "company_shared",
                  mutation: true,
                },
              },
            );
          else if (kind === "session") f.setIdentity(f.other.identity);
          else
            await f.repository.transaction(
              f.user.actor.company_id,
              (document) => {
                if (kind === "location")
                  document.sessions.find(
                    (session) => session.id === f.user.identity.session_id,
                  )!.selected_location = {
                    kind: "location",
                    location_id: "Branch 2",
                  };
                else
                  document.people.find(
                    (person) => person.id === f.user.actor.user_id,
                  )!.version++;
              },
            );
        };
        await expect(
          uploadReturnCreationPhoto(f.query, {
            ...f.input,
            company_id: f.user.actor.company_id,
            file: photo(),
          }),
        ).rejects.toThrow();
        expect(
          (await f.repository.loadBusiness<DemoState>(f.user.actor.company_id))
            .state.returns,
        ).toEqual([]);
      } finally {
        f.repository.dispose();
      }
    },
  );
  it("revalidates authority again after hash readback and rejects storage failures", async () => {
    const f = await fixture();
    try {
      storage.duringRead = async () => f.setIdentity(f.other.identity);
      await expect(
        uploadReturnCreationPhoto(f.query, {
          ...f.input,
          company_id: f.user.actor.company_id,
          file: photo(),
        }),
      ).rejects.toThrow();
      storage.duringRead = null;
      f.setIdentity(f.user.identity);
      storage.fail = true;
      await expect(
        uploadReturnCreationPhoto(f.query, {
          ...f.input,
          company_id: f.user.actor.company_id,
          file: photo(),
        }),
      ).rejects.toThrow("storage");
      expect(
        (await f.repository.loadBusiness<DemoState>(f.user.actor.company_id))
          .state.returns,
      ).toEqual([]);
    } finally {
      f.repository.dispose();
    }
  });
  it("rejects foreign company before any file IO and rejects another person's valid proof", async () => {
    const f = await fixture();
    try {
      await expect(
        uploadReturnCreationPhoto(f.query, {
          ...f.input,
          company_id: "foreign",
          file: photo(),
        }),
      ).rejects.toThrow();
      expect(storeUploadedFile).not.toHaveBeenCalled();
      const handle = await uploadReturnCreationPhoto(f.query, {
        ...f.input,
        company_id: f.user.actor.company_id,
        file: photo(),
      });
      f.setIdentity(f.other.identity);
      await expect(
        f.repository.runBusinessCommand(
          f.other.identity,
          (draft: DemoState, actor) =>
            createReturn(draft, actor, { ...f.input, photos: [handle] }),
          {
            capability: "returns.create",
            resource: returnCreateScope(
              f.other.actor.company_id,
              "Branch 1",
              true,
            ),
          },
        ),
      ).rejects.toThrow();
      expect(
        (await f.repository.loadBusiness<DemoState>(f.user.actor.company_id))
          .state.returns,
      ).toEqual([]);
    } finally {
      f.repository.dispose();
    }
  });
});
