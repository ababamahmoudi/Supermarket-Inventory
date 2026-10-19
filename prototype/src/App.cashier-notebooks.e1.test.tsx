import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DemoProvider, initialState } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { authenticatedTestFixture } from "./authority-test-fixture";
import {
  addNotebookEntry,
  createNotebook,
  newNotebookInput,
} from "./notebooks";
import i18n from "./i18n";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>> | null =
  null;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "notes";
  void i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = null;
  vi.unstubAllGlobals();
});

describe("Cashier custom-notebook shell uses the actual protected ACL and location", () => {
  it.each([
    "permitted",
    "without read ACL",
    "other location",
    "other company",
  ] as const)(
    "%s does not grant built-in Notes, definition editing or private routes",
    async (scenario) => {
      const state = initialState();
      const source = scenario === "other company" ? initialState() : state;
      if (scenario === "other company")
        source.config.company.seed_key = "foreign-notebook-company";
      const location = scenario === "other location" ? "Branch 2" : "Branch 1";
      const manager = authenticatedTestFixture(source, "manager", {
        selection: { kind: "location", location_id: location },
      });
      const notebook = createNotebook(source, manager.actor, {
        ...newNotebookInput(),
        name_en: "Cashier reading notebook",
        branch: location,
        read_roles:
          scenario === "without read ACL"
            ? ["manager"]
            : ["manager", "cashier"],
        add_roles: ["manager"],
      });
      const entry = addNotebookEntry(source, manager.actor, notebook.id, {
        text: "Permitted notebook record",
      });
      if (source !== state) {
        state.notebooks = [
          ...(state.notebooks ?? []),
          structuredClone(notebook),
        ];
        state.notebook_entries = [
          ...(state.notebook_entries ?? []),
          structuredClone(entry),
        ];
      }
      fixture = await authenticatedProviderFixture({
        state,
        role: "cashier",
        actorOptions: {
          locations: ["Branch 1"],
          selection: { kind: "location", location_id: "Branch 1" },
        },
      });
      render(
        <DemoProvider options={fixture.options}>
          <App />
        </DemoProvider>,
      );
      if (scenario === "permitted") {
        expect(
          await screen.findByRole(
            "heading",
            { name: "Notes" },
            { timeout: 10000 },
          ),
        ).toBeVisible();
        expect(
          screen.getByRole("tab", { name: /^Cashier reading notebook/ }),
        ).toBeVisible();
        expect(
          screen.getByText("Permitted notebook record", { exact: true }),
        ).toBeVisible();
        expect(
          within(screen.getByRole("navigation", { name: "Pages" })).getByRole(
            "link",
            { name: "Notes" },
          ),
        ).toBeVisible();
      } else {
        expect(
          await screen.findByRole(
            "heading",
            { name: "Cashier lookup" },
            { timeout: 10000 },
          ),
        ).toBeVisible();
        expect(
          screen.queryByRole("tab", { name: /^Cashier reading notebook/ }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("Permitted notebook record", { exact: true }),
        ).not.toBeInTheDocument();
        expect(
          within(screen.getByRole("navigation", { name: "Pages" })).queryByRole(
            "link",
            { name: "Notes" },
          ),
        ).not.toBeInTheDocument();
      }
      expect(
        screen.queryByRole("tab", {
          name: /^(To order|Store use|For managers|Deli temperatures)/,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /^(Add note|Save note|New notebook|Edit notebook|Archive notebook|Mark done)$/,
        }),
      ).not.toBeInTheDocument();
      const navigation = within(
        screen.getByRole("navigation", { name: "Pages" }),
      );
      for (const name of ["History", "Settings", "Invoices", "Payables"])
        expect(
          navigation.queryByRole("link", { name }),
        ).not.toBeInTheDocument();
      expect(
        (await fixture.readCanonical()).notebook_entries?.find(
          (item) => item.id === entry.id,
        ),
      ).toEqual(entry);
    },
  );
});
