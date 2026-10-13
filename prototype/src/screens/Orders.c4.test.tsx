import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState } from "../store";
import { authenticatedTestActor } from "../authority-test-fixture";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { orderPrintSnapshot } from "../orders-board";
import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";
import { createOrder } from "../orders";
import { OrderPrintDocument } from "../order-print";
import Orders from "./Orders";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#orders";
  await i18n.changeLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});

describe("C4 New item order presentation", () => {
  it("keeps New item errors next to fields, clears only the edited field, and places an unknown estimate", async () => {
    const fixture = await authenticatedProviderFixture({
      state: initialState(),
      role: "manager",
      actorOptions: { locations: ["Branch 1"] },
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <Orders />
      </DemoProvider>,
    );
    await renderedUiReady(() =>
      Boolean(screen.queryByRole("button", { name: "New order" })),
    );
    fireEvent.click(await screen.findByRole("button", { name: "New order" }));
    fireEvent.click(screen.getByLabelText("Supplier"));
    fireEvent.click(screen.getByRole("option", { name: "Fresh Valley Foods" }));
    fireEvent.click(screen.getByRole("button", { name: "New item" }));
    const dialog = screen.getByRole("dialog", { name: "New item" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add item" }));
    const name = within(dialog).getByLabelText("Name");
    const cases = within(dialog).getByLabelText("Cases");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(cases).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(name, { target: { value: "Fictional new order item" } });
    expect(name).not.toHaveAttribute("aria-invalid", "true");
    expect(cases).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(cases, { target: { value: "2" } });
    expect(cases).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add item" }));
    expect(dialog).not.toBeVisible();
    const row = screen.getByRole("row", { name: /Fictional new order item/ });
    expect(within(row).getByText("New item")).toBeVisible();
    expect(
      within(row).getByRole("textbox", {
        name: "Cases — Fictional new order item",
      }),
    ).toHaveValue("2");
    expect(
      within(row).getByRole("textbox", {
        name: "Expected unit cost — Fictional new order item",
      }),
    ).toHaveValue("");
    await renderedUiReady(() =>
      Boolean(
        screen.queryByText(
          "Estimate incomplete: some packs or expected costs are not known.",
        ),
      ),
    );
    expect(
      screen.getByText(
        "Estimate incomplete: some packs or expected costs are not known.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await renderedUiReady(() =>
      Boolean(screen.queryByRole("button", { name: "Print order" })),
    );
    await waitFor(async () =>
      expect((await fixture.readCanonical()).orders?.at(-1)?.status).toBe(
        "ordered",
      ),
    );
    const order = (await fixture.readCanonical()).orders!.at(-1)!;
    expect(order.lines[0]).toMatchObject({
      new_item: true,
      ordered_cases: "2",
      ordered_units: null,
      units_per_case: null,
      expected_unit_cost: null,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Print order" })).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Print order" }));
    await renderedUiReady(() =>
      Boolean(
        screen
          .queryByRole("dialog", { name: "Print order" })
          ?.querySelector(".order-print-new-item")
          ?.textContent?.includes("New item"),
      ),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("dialog", { name: "Print order" })
          .querySelector(".order-print-new-item"),
      ).toHaveTextContent("New item"),
    );
  });

  it.each(["en", "fa"] as const)(
    "prints aligned bilingual headers and explicit missing estimates in %s",
    (language) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, "manager", {
        locations: ["Branch 1"],
        name_en: "Print reviewer",
        selection: { kind: "all_locations" },
      });
      const order = createOrder(state, actor, {
        branch: "Branch 1",
        supplier: "Fresh Valley Foods",
        lines: [
          {
            new_item: {
              id: "new-print-item",
              name_en: "Fictional printed item",
            },
            cases: "2",
          },
        ],
      });
      const print = orderPrintSnapshot(state, actor, order.id, order.version);
      const { container } = render(
        <OrderPrintDocument
          order={print.order}
          config={{
            ...print.config,
            supplier_documents: {
              return_memo: "en",
              supplier_order: "bilingual",
            },
          }}
          language={language}
        />,
      );
      const headerPairs = Array.from(container.querySelectorAll("th")).map(
        (header) => [
          header.querySelector('[lang="en"]')?.textContent,
          header.querySelector('[lang="fa"]')?.textContent,
        ],
      );
      expect(headerPairs).toContainEqual(["Cases", "کارتن"]);
      expect(headerPairs).toContainEqual(["Units", "واحد"]);
      expect(headerPairs).toContainEqual(["Pack", "بسته"]);
      expect(
        container.querySelector(".operational-print-document"),
      ).toHaveAttribute("dir", language === "fa" ? "rtl" : "ltr");
      expect(
        container.querySelector(".order-print-new-item"),
      ).toHaveTextContent("New item");
      expect(
        container.querySelector(".order-print-new-item"),
      ).toHaveTextContent("کالای جدید");
      expect(container.querySelector(".order-print-total")).toHaveTextContent(
        "Estimate incomplete",
      );
      expect(container.querySelector("tbody tr")).toHaveTextContent("—");
    },
  );
});
