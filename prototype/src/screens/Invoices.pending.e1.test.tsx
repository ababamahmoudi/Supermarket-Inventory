import { File as NodeFile } from "node:buffer";
import { readFileSync } from "node:fs";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "../store";
import { shellProviderFixture } from "../shell-provider-test-fixture";
import { installMissingInvoiceImageDecoder } from "../invoice-ui-image-test-platform";
import { readStoredFile, INCLUDED_COST_INVOICE_SHA256 } from "../file-database";
import { demoSeed } from "../config";
import i18n from "../i18n";
import LocationPicker from "../LocationPicker.e1";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";
import Invoices from "./Invoices";

const fixtures: ReturnType<typeof shellProviderFixture>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#invoices";
  installMissingInvoiceImageDecoder();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
function SignedInInvoices() {
  const demo = useDemo();
  const [error, setError] = useState("");
  return (
    <>
      <output data-testid="stage">{demo.authStage}</output>
      <output data-testid="selection">
        {JSON.stringify(demo.locationSelection)}
      </output>
      <output data-testid="sign-in-error">{error}</output>
      <button
        onClick={async () => {
          const first = await demo.signIn("manager", "demo1234");
          if (first) {
            setError(first);
            return;
          }
          const second = await demo.completeSecondStep("simulated-passkey");
          if (second) setError(second);
        }}
      >
        Sign in actual Manager
      </button>
      {demo.actor && demo.authStage === "complete" && (
        <>
          <LocationPicker />
          <Invoices />
        </>
      )}
    </>
  );
}
async function show() {
  const fixture = shellProviderFixture(initialState());
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <SignedInInvoices />
    </DemoProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("stage")).not.toHaveTextContent("loading"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Sign in actual Manager" }),
  );
  await waitFor(
    () => expect(screen.getByTestId("stage")).toHaveTextContent("complete"),
    { timeout: 10000 },
  );
  expect(screen.getByTestId("sign-in-error")).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
  fireEvent.click(await screen.findByRole("option", { name: "North York" }));
  // Publishing the accepted location precedes LocationPicker's own finally.
  // Exercise invoices only once the actual control and protected workspace settle.
  await renderedUiReady(() => {
    const picker = screen.queryByRole("combobox", { name: "Location" });
    return (
      picker instanceof HTMLButtonElement &&
      !picker.disabled &&
      picker.textContent!.includes("North York") &&
      screen
        .getByTestId("selection")
        .textContent!.includes('"kind":"location","location_id":"Branch 1"')
    );
  });
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Location" }),
    ).toHaveTextContent("North York"),
  );
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: "Location" })).toBeEnabled();
    expect(screen.getByTestId("selection")).toHaveTextContent(
      '"kind":"location","location_id":"Branch 1"',
    );
  });
  await renderedUiReady(
    () => screen.queryByLabelText("Invoice views") !== null && entryIsReady(),
  );
  await screen.findByRole("button", { name: "New invoice" });
  const read = async () =>
    (
      await fixture.repository.loadBusiness<ReturnType<typeof initialState>>(
        fixture.options.companyId,
      )
    ).state;
  return { fixture, read };
}
async function accepted(
  read: () => Promise<ReturnType<typeof initialState>>,
  previousId: string,
  mode: "manual" | "upload",
) {
  let id = "";
  await waitFor(
    async () => {
      const state = await read();
      id = state.invoice.id;
      expect(id).not.toBe(previousId);
      expect(state.invoice.entry_mode).toBe(mode);
      expect(window.location.hash).toBe(
        `#invoices?id=${encodeURIComponent(id)}`,
      );
      expect(screen.getByRole("button", { name: "New invoice" })).toBeEnabled();
      expect(document.querySelector('[aria-busy="true"][inert]')).toBeNull();
    },
    { timeout: 10000 },
  );
  return id;
}
function begins(buttonName: string) {
  const button = screen.getByRole("button", { name: buttonName });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(button.closest('[aria-busy="true"][inert]')).not.toBeNull();
  // The original control and command are used twice in the same native turn.
  // A second click must not allocate a second invoice.
  fireEvent.click(button);
}
async function entryReady() {
  // A retained original is committed before the real controller finishes its
  // derived reconciliation. Wait for the same public entry readiness used by
  // New/Manual, then keep the canonical file/hash assertions independent below.
  await renderedUiReady(entryIsReady);
  await waitFor(
    () => {
      expect(screen.getByRole("button", { name: "New invoice" })).toBeEnabled();
      expect(document.querySelector('[aria-busy="true"][inert]')).toBeNull();
    },
    { timeout: 10000 },
  );
}
function entryIsReady() {
  const button = screen.queryByRole("button", { name: "New invoice" });
  return (
    button instanceof HTMLButtonElement &&
    !button.disabled &&
    document.querySelector('[aria-busy="true"][inert]') === null
  );
}
async function manual(read: () => Promise<ReturnType<typeof initialState>>) {
  if (!screen.queryByRole("button", { name: "Manual entry" })) {
    const previous = (await read()).invoice.id;
    begins("New invoice");
    await accepted(read, previous, "upload");
    await screen.findByRole("button", { name: "Manual entry" });
  }
  const previous = (await read()).invoice.id;
  begins("Manual entry");
  const id = await accepted(read, previous, "manual");
  await screen.findByLabelText("Supplier invoice number (optional)");
  return id;
}
it("keeps old fields inert through genuine New/Manual commands and enables only the accepted draft, preserving the prior manual details", async () => {
  const { read } = await show();
  const firstId = await manual(read);
  const number = screen.getByLabelText("Supplier invoice number (optional)");
  fireEvent.change(number, { target: { value: "RETAINED-MANUAL-DETAILS" } });
  await waitFor(async () =>
    expect((await read()).invoice.supplier_invoice_number).toBe(
      "RETAINED-MANUAL-DETAILS",
    ),
  );
  const before = await read();
  const ids = new Set([
    before.invoice.id,
    ...before.invoices!.map((row) => row.id),
  ]);
  begins("New invoice");
  expect(number.closest("[inert]")).not.toBeNull();
  const uploadId = await accepted(read, firstId, "upload");
  let current = await read();
  expect(
    current.invoices!.find((row) => row.id === firstId)
      ?.supplier_invoice_number,
  ).toBe("RETAINED-MANUAL-DETAILS");
  expect(
    new Set([current.invoice.id, ...current.invoices!.map((row) => row.id)])
      .size,
  ).toBe(ids.size + 1);
  begins("Manual entry");
  const finalId = await accepted(read, uploadId, "manual");
  current = await read();
  expect(current.invoice.lines).toEqual([]);
  expect(current.invoice.created_by_user_id).toBe("demo-person-manager");
  expect(
    new Set([current.invoice.id, ...current.invoices!.map((row) => row.id)])
      .size,
  ).toBe(ids.size + 2);
  fireEvent.change(
    await screen.findByLabelText("Supplier invoice number (optional)"),
    { target: { value: "ACCEPTED-MANUAL-DETAILS" } },
  );
  await waitFor(async () => {
    const latest = await read();
    expect(latest.invoice.id).toBe(finalId);
    expect(latest.invoice.supplier_invoice_number).toBe(
      "ACCEPTED-MANUAL-DETAILS",
    );
  });
});
it("protects the actual source snapshot while a same-ID manual original is retained and verifies its original bytes", async () => {
  const { read } = await show();
  const id = await manual(read);
  const content =
    "%PDF-1.7\nFictional pending-original regression evidence\n%%EOF";
  const original = new NodeFile([content], "fictional-pending-original.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(screen.getByLabelText("Upload a PDF or photo"), {
    target: { files: [original] },
  });
  expect(screen.getByRole("button", { name: "New invoice" })).toBeDisabled();
  expect(
    screen
      .getByLabelText("Supplier invoice number (optional)")
      .closest("[inert]"),
  ).not.toBeNull();
  await entryReady();
  await waitFor(async () => {
    const current = await read();
    expect(current.invoice.id).toBe(id);
    expect(current.invoice.file_name).toBe(original.name);
    expect(current.invoice.file_data).toMatch(/^idb-file:v1:/);
    expect(screen.getByRole("button", { name: "New invoice" })).toBeEnabled();
  });
  const state = await read();
  const stored = await readStoredFile(
    state.invoice.file_data!,
    state.invoice.company_id,
  );
  expect(await stored.source.text()).toBe(content);
  expect(stored.source_size).toBe(original.size);
  expect(state.invoice.lines).toEqual([]);
  expect(window.location.hash).toBe(`#invoices?id=${encodeURIComponent(id)}`);
});
it("holds the old upload route until the real recognized original's canonical invoice and protected workspace agree", async () => {
  const { read } = await show();
  const before = (await read()).invoice.id;
  begins("New invoice");
  const uploadId = await accepted(read, before, "upload");
  const bytes = readFileSync(
    `${process.cwd()}/public/demo-originals/fictional-hw-5012.svg`,
  );
  const original = new NodeFile([bytes], "fictional-hw-5012.svg", {
    type: "image/svg+xml",
  });
  fireEvent.change(screen.getByLabelText("Upload a PDF or photo"), {
    target: { files: [original] },
  });
  expect(screen.getByRole("button", { name: "New invoice" })).toBeDisabled();
  const targetId = demoSeed.sales_demo.cost_increase_invoice.id;
  await entryReady();
  await waitFor(async () => {
    const current = await read();
    expect(current.invoice.id).toBe(targetId);
    expect(current.invoice.file_data).toMatch(
      new RegExp(`:${INCLUDED_COST_INVOICE_SHA256}$`),
    );
    expect(window.location.hash).toBe(
      `#invoices?id=${encodeURIComponent(targetId)}`,
    );
    expect(screen.getByRole("button", { name: "New invoice" })).toBeEnabled();
  });
  expect((await read()).invoices!.some((row) => row.id === uploadId)).toBe(
    true,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect((await read()).invoice.id).toBe(targetId);
  expect(window.location.hash).toBe(
    `#invoices?id=${encodeURIComponent(targetId)}`,
  );
});
it.each([
  [
    "invalid type",
    () =>
      new NodeFile(["inert text"], "not-an-invoice.txt", {
        type: "text/plain",
      }),
    "Choose a PDF, PNG, JPEG, WebP, or GIF file.",
  ],
  [
    "empty PDF",
    () => new NodeFile([], "empty.pdf", { type: "application/pdf" }),
    "The original could not be saved. Allow browser storage and try again.",
  ],
])(
  "releases pending protection after genuine %s validation/storage rejection without changing the draft",
  async (_description, makeFile, error) => {
    const { read } = await show();
    await manual(read);
    const before = (await read()).invoice;
    fireEvent.change(screen.getByLabelText("Upload a PDF or photo"), {
      target: { files: [makeFile()] },
    });
    await screen.findByText(error);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "New invoice" })).toBeEnabled(),
    );
    expect(document.querySelector('[aria-busy="true"][inert]')).toBeNull();
    expect((await read()).invoice).toEqual(before);
  },
);
