import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { ReturnEvidenceImage } from "./ReturnEvidenceImage";
import { DemoProvider, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { returnFixture } from "./return-test-fixture";
import { recordPickup, type OperationalReturn } from "./operations";
import { uploadReturnPhoto } from "./return-file-access";
import type { E1DemoContextValue } from "./e1-demo-context";

// Only file IO/browser blob URLs are controlled; all authority, identity changes,
// pickup writes and both protected source reads use the genuine Provider/SDK.
const io = vi.hoisted(() => ({
  readCount: 0,
  gate: null as Promise<void> | null,
  reference: "idb-file:v1:super-arzon:" + "a".repeat(64),
}));
vi.mock("./file-database", async () => ({
  ...(await vi.importActual<typeof import("./file-database")>(
    "./file-database",
  )),
  storeUploadedFile: vi.fn(async (file: File) => ({
    reference: io.reference,
    name: file.name,
    type: file.type,
    size: file.size,
  })),
  readStoredFile: vi.fn(async (reference: string, company_id: string) => {
    io.readCount++;
    await io.gate;
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
}));
let context: E1DemoContextValue | null = null;
function Probe() {
  const current = useDemo();
  useEffect(() => {
    context = current;
  }, [current]);
  return null;
}
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
let createUrl: Mock<typeof URL.createObjectURL>;
let revokeUrl: Mock<typeof URL.revokeObjectURL>;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  context = null;
  io.readCount = 0;
  io.gate = null;
  createUrl = vi.fn<typeof URL.createObjectURL>(
    () => "blob:verified-current-return-photo",
  );
  revokeUrl = vi.fn<typeof URL.revokeObjectURL>();
  const NativeUrl = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeUrl {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    },
  );
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
async function prepare() {
  const fixture = await authenticatedProviderFixture({
    state: returnFixture,
    role: "floor_worker",
    actorOptions: { locations: ["Branch 1"] },
  });
  fixtures.push(fixture);
  const view = render(
    <DemoProvider options={fixture.options}>
      <Probe />
    </DemoProvider>,
  );
  await waitFor(
    () => expect(context?.actor?.user_id).toBe(fixture.actor.user_id),
    { timeout: 10_000 },
  );
  if (!context) throw new Error("Actual Provider did not initialise.");
  const current: E1DemoContextValue = context;
  const attachment = await uploadReturnPhoto(current.query, {
    company_id: fixture.actor.company_id,
    return_id: "c4-return",
    capability: "returns.pickup_record",
    file: new File(["fictional photo"], "fictional-photo.png", {
      type: "image/png",
    }),
  });
  await act(async () => {
    await current.command(
      "returns.pickup_record",
      {
        company_id: fixture.actor.company_id,
        kind: "location_record",
        location_ids: ["Branch 1"],
        entity_id: "c4-return",
        mutation: true,
      },
      (draft, actor) =>
        recordPickup(draft, actor, "c4-return", {
          quantities: { "0003": 3 },
          representative: "Actual Driver",
          slip: "SIGNED-PRIVACY-PHOTO",
          photo: attachment,
        }),
    );
  });
  const canonical = await fixture.readCanonical();
  const record = canonical.returns.find(
    (item) =>
      item.id === "c4-return" &&
      item.company_id === fixture.actor.company_id &&
      item.branch === "Branch 1",
  ) as OperationalReturn;
  const event = record.evidence!.find((item) => item.photo === io.reference)!;
  const show = () =>
    view.rerender(
      <DemoProvider options={fixture.options}>
        <Probe />
        <ReturnEvidenceImage
          companyId={fixture.actor.company_id}
          returnId={record.id}
          eventId={event.id}
          alt="Return evidence"
        />
      </DemoProvider>,
    );
  return { fixture, view, show };
}

describe("Return image private-source invalidation", () => {
  it("removes and revokes a loaded source when the genuine current person loses that location", async () => {
    const { view, show } = await prepare();
    show();
    await waitFor(
      () =>
        expect(view.container.querySelector("img")).toHaveAttribute(
          "src",
          "blob:verified-current-return-photo",
        ),
      { timeout: 10_000 },
    );
    if (!context) throw new Error("Actual Provider did not initialise.");
    const current: E1DemoContextValue = context;
    await act(async () => {
      expect(await current.switchDemoUser("wh-floor")).toBeNull();
    });
    expect(view.container.querySelector("img")).not.toHaveAttribute("src");
    expect(revokeUrl).toHaveBeenCalledWith(
      "blob:verified-current-return-photo",
    );
  });

  it("never exposes a late photo URL after a genuine different person becomes current during IO", async () => {
    const { view, show } = await prepare();
    let release: (() => void) | undefined;
    io.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    show();
    await waitFor(() => expect(io.readCount).toBeGreaterThan(0), {
      timeout: 10_000,
    });
    if (!context) throw new Error("Actual Provider did not initialise.");
    const current: E1DemoContextValue = context;
    await act(async () => {
      expect(await current.switchDemoUser("wh-floor")).toBeNull();
    });
    await act(async () => {
      release?.();
      await io.gate;
    });
    expect(view.container.querySelector("img")).not.toHaveAttribute("src");
    expect(createUrl).not.toHaveBeenCalled();
  });
});
