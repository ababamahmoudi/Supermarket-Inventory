import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { BrowserAuthorityRepository } from "./authority-repository";
import { authoritySnapshot } from "./authority";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { returnFixture } from "./return-test-fixture";
import {
  recordPickup,
  receiveReplacement,
  type OperationalReturn,
} from "./operations";
import {
  loadReturnPhoto,
  uploadReturnPhoto,
  type ProtectedReturnQuery,
  type ReturnPhotoAttachment,
} from "./return-file-access";
import type { DemoState } from "./types";
import type { LocationSelection, RoleId } from "./authority-types";
import { readStoredFile, storeUploadedFile } from "./file-database";

// Only storage IO is stubbed; authority uses the actual repository/Person/session paths.
const storage = vi.hoisted(() => ({
  duringSave: null as null | (() => Promise<void>),
  duringRead: null as null | (() => Promise<void>),
  reference: "idb-file:v1:super-arzon:" + "a".repeat(64),
}));
vi.mock("./file-database", async () => ({
  ...(await vi.importActual<typeof import("./file-database")>(
    "./file-database",
  )),
  readStoredFile: vi.fn(async (reference: string, company_id: string) => {
    await storage.duringRead?.();
    const source = new Blob(["fictional photo"], { type: "image/png" });
    return {
      reference,
      company_id,
      name: "fictional-photo.png",
      type: "image/png",
      source_size: source.size,
      sha256: "a".repeat(64),
      source,
      preview: source,
      saved_at: new Date().toISOString(),
    };
  }),
  storeUploadedFile: vi.fn(async (file: File) => {
    await storage.duringSave?.();
    return {
      reference: storage.reference,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }),
}));
const pickup = {
  quantities: { "0003": 3 },
  representative: "Fictional driver",
  slip: "SIGNED-PHOTO-TEST",
};
async function fixture(
  options: {
    state?: DemoState;
    role?: RoleId;
    selection?: LocationSelection;
    prepare?: (state: DemoState) => void;
  } = {},
) {
  const state = options.state ?? returnFixture();
  options.prepare?.(state);
  const worker = authenticatedTestFixture(
    state,
    options.role ?? "floor_worker",
    {
      locations: ["Branch 1"],
      selection: options.selection,
    },
  );
  const other = authenticatedTestFixture(state, "floor_worker", {
    user_id: "photo-other-worker",
    username: "photo-other",
    locations: ["Branch 1"],
  });
  const snapshot = authoritySnapshot(state);
  const repository = new BrowserAuthorityRepository(new IDBFactory());
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
  let identity = worker.identity;
  const query: ProtectedReturnQuery = async (capability, scope, project) =>
    (
      await repository.queryBusiness(identity, project, {
        capability,
        resource: scope,
      })
    ).value;
  return {
    repository,
    query,
    worker,
    other,
    setIdentity: (next: typeof identity) => {
      identity = next;
    },
  };
}
const file = () =>
  new File(["fictional photo"], "fictional-photo.png", { type: "image/png" });
beforeEach(() => {
  storage.duringSave = null;
  storage.duringRead = null;
});
describe("E1 return photo attachments", () => {
  it("accepts only the real upload handle for the same actual canonical pickup", async () => {
    const { repository, query, worker } = await fixture();
    const attachment = await uploadReturnPhoto(query, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const result = await repository.runBusinessCommand<DemoState, void>(
      worker.identity,
      (draft, actor) => {
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        });
      },
    );
    expect(
      (result.business.state.returns[0] as OperationalReturn).evidence?.[0]
        .photo,
    ).toBe(storage.reference);
    expect(
      (result.business.state.returns[0] as OperationalReturn).evidence?.[0]
        .actor_user_id,
    ).toBe(worker.actor.user_id);
  });
  it("rejects caller-supplied invoice references and structurally copied attachment claims atomically", async () => {
    const { repository, worker } = await fixture();
    const before = await repository.queryBusiness<DemoState, DemoState>(
      worker.identity,
      (state) => structuredClone(state),
    );
    for (const forged of [storage.reference, { name: "fictional-photo.png" }])
      await expect(
        repository.runBusinessCommand<DemoState, void>(
          worker.identity,
          (draft, actor) => {
            recordPickup(draft, actor, "c4-return", {
              ...pickup,
              photo: forged as unknown as ReturnPhotoAttachment,
            });
          },
        ),
      ).rejects.toThrow();
    const after = await repository.queryBusiness<DemoState, DemoState>(
      worker.identity,
      (state) => structuredClone(state),
    );
    expect(after.value).toEqual(before.value);
    expect(after.business_revision).toBe(before.business_revision);
  });
  it("rechecks the actual session after asynchronous storage before issuing a handle", async () => {
    const { query, worker, other, setIdentity } = await fixture();
    storage.duringSave = async () => {
      setIdentity(other.identity);
    };
    await expect(
      uploadReturnPhoto(query, {
        company_id: worker.actor.company_id,
        return_id: "c4-return",
        capability: "returns.pickup_record",
        file: file(),
      }),
    ).rejects.toThrow("Return evidence changed");
  });
  it("rejects stale canonical return evidence changed during upload", async () => {
    const { repository, query, worker } = await fixture();
    storage.duringSave = async () => {
      await repository.runBusinessCommand<DemoState, void>(
        worker.identity,
        (draft, actor) => {
          recordPickup(draft, actor, "c4-return", pickup);
        },
      );
    };
    await expect(
      uploadReturnPhoto(query, {
        company_id: worker.actor.company_id,
        return_id: "c4-return",
        capability: "returns.pickup_record",
        file: file(),
      }),
    ).rejects.toThrow("Return evidence changed");
  });
  it("a valid pickup handle cannot be reused for replacement evidence or a different signed-in person", async () => {
    const { repository, query, worker, other } = await fixture();
    const attachment = await uploadReturnPhoto(query, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    await expect(
      repository.runBusinessCommand<DemoState, void>(
        other.identity,
        (draft, actor) => {
          recordPickup(draft, actor, "c4-return", {
            ...pickup,
            photo: attachment,
          });
        },
      ),
    ).rejects.toThrow("Return evidence changed");
    await repository.runBusinessCommand<DemoState, void>(
      worker.identity,
      (draft, actor) => {
        recordPickup(draft, actor, "c4-return", pickup);
      },
    );
    const before = await repository.queryBusiness<DemoState, DemoState>(
      worker.identity,
      (state) => structuredClone(state),
    );
    await expect(
      repository.runBusinessCommand<DemoState, void>(
        worker.identity,
        (draft, actor) => {
          receiveReplacement(draft, actor, "c4-return", {
            product_code: "0003",
            qty: 1,
            covers: { "0003": 1 },
            date: "2026-10-13",
            representative: "Fictional driver",
            receipt: "REPLACEMENT-PHOTO",
            photo: attachment,
          });
        },
      ),
    ).rejects.toThrow();
    expect(
      (
        await repository.queryBusiness<DemoState, DemoState>(
          worker.identity,
          (state) => structuredClone(state),
        )
      ).value,
    ).toEqual(before.value);
  });
  it("photo loading carries an opaque query handle and resolves only the actual retained event", async () => {
    const { repository, query, worker } = await fixture();
    const attachment = await uploadReturnPhoto(query, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const saved = await repository.runBusinessCommand<DemoState, void>(
      worker.identity,
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        }),
    );
    const event = (saved.business.state.returns[0] as OperationalReturn)
      .evidence![0];
    const reads: unknown[] = [];
    const observedQuery: ProtectedReturnQuery = async (
      capability,
      scope,
      project,
    ) => {
      const result = await query(capability, scope, project);
      reads.push(result);
      return result;
    };
    const loaded = await loadReturnPhoto(observedQuery, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      event_id: event.id,
    });
    expect(loaded.reference).toBe(storage.reference);
    expect(reads).toEqual([{ available: true }, undefined]);
    expect(JSON.stringify(reads)).not.toContain(worker.identity.session_id);
    expect(JSON.stringify(reads)).not.toContain(storage.reference);
    await expect(
      loadReturnPhoto(query, {
        company_id: worker.actor.company_id,
        return_id: "c4-return",
        event_id: "unrelated-event",
      }),
    ).rejects.toThrow();
  });
  it("never returns photo bytes after another genuine person becomes current during storage IO", async () => {
    const { repository, query, worker, other, setIdentity } = await fixture();
    const attachment = await uploadReturnPhoto(query, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const saved = await repository.runBusinessCommand<DemoState, void>(
      worker.identity,
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        }),
    );
    const event = (saved.business.state.returns[0] as OperationalReturn)
      .evidence![0];
    storage.duringRead = async () => {
      setIdentity(other.identity);
    };
    await expect(
      loadReturnPhoto(query, {
        company_id: worker.actor.company_id,
        return_id: "c4-return",
        event_id: event.id,
      }),
    ).rejects.toThrow("Return evidence changed");
  });

  it("uploads and reads the actual North York worker return behind foreign-company and other-location same-ID records", async () => {
    const { repository, query, worker } = await fixture({
      prepare(state) {
        const own = state.returns[0];
        state.returns = [
          { ...structuredClone(own), company_id: "foreign-company" },
          { ...structuredClone(own), branch: "Branch 2" },
          own,
        ];
      },
    });
    const attachment = await uploadReturnPhoto(query, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const saved = await repository.runBusinessCommand<DemoState, void>(
      worker.identity,
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        }),
    );
    const own = saved.business.state.returns.find(
      (row) =>
        row.company_id === worker.actor.company_id && row.branch === "Branch 1",
    ) as OperationalReturn;
    const event = own.evidence![0];
    const loaded = await loadReturnPhoto(query, {
      company_id: worker.actor.company_id,
      return_id: "c4-return",
      event_id: event.id,
    });
    expect(event.actor_user_id).toBe(worker.actor.user_id);
    expect(event.photo).toBe(storage.reference);
    expect(loaded.reference).toBe(storage.reference);
    expect(saved.business.state.returns[0]).not.toHaveProperty("evidence");
    expect(saved.business.state.returns[1]).not.toHaveProperty("evidence");
  });
  it("rejects an other-location-only return before either upload or photo-read storage IO", async () => {
    const source = await fixture();
    const attachment = await uploadReturnPhoto(source.query, {
      company_id: source.worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const saved = await source.repository.runBusinessCommand<DemoState, void>(
      source.worker.identity,
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        }),
    );
    const state = structuredClone(saved.business.state);
    const event = (state.returns[0] as OperationalReturn).evidence![0];
    state.returns[0].branch = "Branch 2";
    const target = await fixture({ state });
    vi.mocked(storeUploadedFile).mockClear();
    vi.mocked(readStoredFile).mockClear();
    await expect(
      uploadReturnPhoto(target.query, {
        company_id: target.worker.actor.company_id,
        return_id: "c4-return",
        capability: "returns.pickup_record",
        file: file(),
      }),
    ).rejects.toThrow();
    await expect(
      loadReturnPhoto(target.query, {
        company_id: target.worker.actor.company_id,
        return_id: "c4-return",
        event_id: event.id,
      }),
    ).rejects.toThrow();
    expect(storeUploadedFile).not.toHaveBeenCalled();
    expect(readStoredFile).not.toHaveBeenCalled();
  });
  it("rejects two same-company same-ID returns authorized to an actual aggregate Manager before storage IO", async () => {
    const source = await fixture();
    const attachment = await uploadReturnPhoto(source.query, {
      company_id: source.worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const saved = await source.repository.runBusinessCommand<DemoState, void>(
      source.worker.identity,
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        }),
    );
    const state = structuredClone(saved.business.state);
    const event = (state.returns[0] as OperationalReturn).evidence![0];
    state.returns.push({
      ...structuredClone(state.returns[0]),
      branch: "Branch 2",
    });
    const target = await fixture({
      state,
      role: "manager",
      selection: { kind: "all_locations" },
    });
    vi.mocked(storeUploadedFile).mockClear();
    vi.mocked(readStoredFile).mockClear();
    await expect(
      uploadReturnPhoto(target.query, {
        company_id: target.worker.actor.company_id,
        return_id: "c4-return",
        capability: "returns.pickup_record",
        file: file(),
      }),
    ).rejects.toThrow();
    await expect(
      loadReturnPhoto(target.query, {
        company_id: target.worker.actor.company_id,
        return_id: "c4-return",
        event_id: event.id,
      }),
    ).rejects.toThrow();
    expect(target.worker.actor.selection).toEqual({ kind: "all_locations" });
    expect(storeUploadedFile).not.toHaveBeenCalled();
    expect(readStoredFile).not.toHaveBeenCalled();
  });

  it("rejects duplicate same-company same-ID records in the actual worker's selected location before storage IO", async () => {
    const source = await fixture();
    const attachment = await uploadReturnPhoto(source.query, {
      company_id: source.worker.actor.company_id,
      return_id: "c4-return",
      capability: "returns.pickup_record",
      file: file(),
    });
    const saved = await source.repository.runBusinessCommand<DemoState, void>(
      source.worker.identity,
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          ...pickup,
          photo: attachment,
        }),
    );
    const state = structuredClone(saved.business.state);
    const event = (state.returns[0] as OperationalReturn).evidence![0];
    state.returns.push(structuredClone(state.returns[0]));
    const target = await fixture({ state });
    vi.mocked(storeUploadedFile).mockClear();
    vi.mocked(readStoredFile).mockClear();
    await expect(
      uploadReturnPhoto(target.query, {
        company_id: target.worker.actor.company_id,
        return_id: "c4-return",
        capability: "returns.pickup_record",
        file: file(),
      }),
    ).rejects.toThrow();
    await expect(
      loadReturnPhoto(target.query, {
        company_id: target.worker.actor.company_id,
        return_id: "c4-return",
        event_id: event.id,
      }),
    ).rejects.toThrow();
    expect(target.worker.actor.selection).toEqual({
      kind: "location",
      location_id: "Branch 1",
    });
    expect(storeUploadedFile).not.toHaveBeenCalled();
    expect(readStoredFile).not.toHaveBeenCalled();
  });
});
