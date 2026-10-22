import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import i18n from "../i18n";
import Settings from "./Settings";
import sample from "../../tests/fixtures/fictional-readings-export.json";
import { parseInvoiceReadings } from "../invoice-readings";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";

class ImportWorker {
  static current: ImportWorker;
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    ImportWorker.current = this;
  }
}
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
let current: ReturnType<typeof useDemo>;
function ActualSettings() {
  const context = useDemo();
  useLayoutEffect(() => {
    current = context;
  }, [context]);
  return context.actor && context.authStage === "complete" ? (
    <Settings />
  ) : null;
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/#settings?group=data");
  await i18n.changeLanguage("en");
  vi.stubGlobal("Worker", ImportWorker);
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
});
async function openData() {
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
  });
  render(
    <DemoProvider options={fixture.options}>
      <ActualSettings />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("button", { name: "Choose file…" })),
  );
}

it("replaces the planned Data list and keeps visible feedback while the file is parsed", async () => {
  await openData();
  expect(screen.queryByText("CSV import")).not.toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Choose file…" });
  const file = new File(["{}"], "wrong.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Choose file…"), {
    target: { files: [file] },
  });
  expect(screen.getByRole("status")).toHaveTextContent("Reading file…");
  expect(button).toBeDisabled();
  expect(ImportWorker.current.postMessage).toHaveBeenCalledWith(file);
  await act(async () =>
    ImportWorker.current.onmessage?.({
      data: { ok: false, code: "version", message: "Version 1 is required." },
    } as MessageEvent),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "unsupported version",
  );
  expect(button).toBeEnabled();
  expect(
    screen.queryByRole("dialog", { name: "Import invoice readings" }),
  ).not.toBeInTheDocument();
});

it("shows a duplicate as unticked and disabled and explains its reason in the summary", async () => {
  await openData();
  fireEvent.change(screen.getByLabelText("Choose file…"), {
    target: { files: [new File(["{}"], "fictional.json")] },
  });
  await act(async () =>
    ImportWorker.current.onmessage?.({
      data: {
        ok: true,
        exported: parseInvoiceReadings(JSON.stringify(sample)),
      },
    } as MessageEvent),
  );
  const preview = await screen.findByRole("dialog", {
    name: "Import invoice readings",
  });
  await waitFor(() =>
    expect(
      within(preview).getByRole("checkbox", { name: "Import FV-20417" }),
    ).toBeDisabled(),
  );
  expect(
    within(preview).getByRole("checkbox", { name: "Import FV-20417" }),
  ).toHaveAttribute("aria-checked", "false");
  expect(within(preview).getByText("Already in the app")).toBeInTheDocument();
  fireEvent.click(
    within(preview).getByRole("button", { name: "Import 0 invoices" }),
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("dialog", { name: "Import complete" })),
  );
  const summary = screen.getByRole("dialog", { name: "Import complete" });
  expect(
    within(summary).getByText(/already has that invoice number/),
  ).toBeInTheDocument();
  const canonical = await fixture.readCanonical();
  expect(
    canonical.activity.filter(
      (entry) => entry.entity_type === "invoice_import",
    ),
  ).toHaveLength(1);
  fireEvent.click(
    within(summary).getByRole("button", { name: "Open Needs review" }),
  );
  await waitFor(() =>
    expect(window.location.hash).toBe("#invoices?tab=needs_review"),
  );
});

it("cancelling empty-store confirmation preserves business data, confirming keeps settings", async () => {
  await openData();
  const before = await fixture.readCanonical();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove fictional data…" }),
  );
  let confirmation = screen.getByRole("dialog", {
    name: "Start with an empty store",
  });
  expect(
    within(confirmation).getByText(/Keep company settings/),
  ).toBeInTheDocument();
  fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
  expect((await fixture.readCanonical()).products).toEqual(before.products);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove fictional data…" }),
  );
  confirmation = screen.getByRole("dialog", {
    name: "Start with an empty store",
  });
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "Remove fictional data" }),
  );
  await renderedUiReady(() =>
    Boolean(
      screen
        .queryByRole("status")
        ?.textContent?.includes("Fictional business data removed"),
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Fictional business data removed",
  );
  const after = await fixture.readCanonical();
  expect(after.products).toHaveLength(0);
  expect(after.config).toEqual(before.config);
  expect(current.actor?.role).toBe("manager");
});
