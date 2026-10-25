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
import receivingFixture from "../../tests/fixtures/r2-fictional-readings-export.json";
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
    within(summary).getByRole("heading", { name: "0 invoices imported" }),
  ).toBeInTheDocument();
  expect(summary.querySelectorAll(".invoice-import-stats > div")).toHaveLength(
    4,
  );
  expect(
    within(summary).getByRole("button", { name: "Close" }),
  ).toBeInTheDocument();
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

it("marks both in-file copies, preselects the complete one and lets a person switch exclusively", async () => {
  await openData();
  fireEvent.change(screen.getByLabelText("Choose file…"), {
    target: { files: [new File(["{}"], "fictional-r2.json")] },
  });
  await act(async () =>
    ImportWorker.current.onmessage?.({
      data: {
        ok: true,
        exported: parseInvoiceReadings(JSON.stringify(receivingFixture)),
      },
    } as MessageEvent),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Import invoice readings",
  });
  await waitFor(() =>
    expect(
      within(dialog).getAllByText("Same invoice twice in this file"),
    ).toHaveLength(2),
  );
  const choices = within(dialog).getAllByRole("checkbox", {
    name: "Import R2-FICTIONAL-025",
  });
  expect(choices[0]).toHaveAttribute("aria-checked", "false");
  expect(choices[1]).toHaveAttribute("aria-checked", "true");
  expect(choices.every((choice) => !choice.hasAttribute("disabled"))).toBe(
    true,
  );
  expect(
    within(dialog).queryByText("Already in the app"),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "Import 1 invoices" }),
  ).toBeEnabled();
  const mode = within(dialog).getByRole("group", { name: "Reading values" });
  expect(
    within(mode).getByRole("button", { name: "AI reading" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    within(mode).getByRole("button", { name: "My checked values" }),
  ).toBeInTheDocument();
  expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
  fireEvent.click(choices[0]);
  expect(choices[0]).toHaveAttribute("aria-checked", "true");
  expect(choices[1]).toHaveAttribute("aria-checked", "false");
  fireEvent.click(choices[1]);
  expect(choices[0]).toHaveAttribute("aria-checked", "false");
  expect(choices[1]).toHaveAttribute("aria-checked", "true");
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
  expect(confirmation.querySelector("label strong")).toHaveTextContent(
    "DELETE",
  );
  expect(
    within(confirmation).getByRole("heading", { name: "Keeps" }),
  ).toBeInTheDocument();
  expect(
    within(confirmation).getByText("Company settings"),
  ).toBeInTheDocument();
  expect(
    within(confirmation).getByRole("heading", { name: "Removes" }),
  ).toBeInTheDocument();
  expect(
    within(confirmation).getByText("Invoices, including imported ones"),
  ).toBeInTheDocument();
  fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
  expect((await fixture.readCanonical()).products).toEqual(before.products);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove fictional data…" }),
  );
  confirmation = screen.getByRole("dialog", {
    name: "Start with an empty store",
  });
  const removeButton = within(confirmation).getByRole("button", {
    name: "Remove fictional data",
  });
  expect(removeButton).toBeDisabled();
  for (const invalid of ["delete", "DELET", "Delete"]) {
    fireEvent.change(
      within(confirmation).getByLabelText("Type DELETE to confirm"),
      {
        target: { value: invalid },
      },
    );
    expect(removeButton).toBeDisabled();
  }
  fireEvent.change(
    within(confirmation).getByLabelText("Type DELETE to confirm"),
    { target: { value: "DELETE" } },
  );
  expect(removeButton).toBeEnabled();
  fireEvent.click(removeButton);
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
