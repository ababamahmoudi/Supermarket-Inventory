import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, STORAGE_KEY, initialState } from "../store";
import { SESSION_KEY } from "../auth";
import i18n from "../i18n";
import { createOrder } from "../orders";
import { OrderPrintDocument } from "../order-print";
import Orders from "./Orders";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#orders";
  void i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("C4 New item order presentation", () => {
  it("keeps New item errors next to fields, clears only the edited field, and places an unknown estimate", async () => {
    render(
      <DemoProvider>
        <Orders />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "New order" }));
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
    expect(
      screen.getByText(
        "Estimate incomplete: some packs or expected costs are not known.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY)!).orders?.at(-1)?.status,
      ).toBe("ordered"),
    );
    const order = JSON.parse(localStorage.getItem(STORAGE_KEY)!).orders.at(-1);
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
    expect(
      screen
        .getByRole("dialog", { name: "Print order" })
        .querySelector(".order-print-new-item"),
    ).toHaveTextContent("New item");
  });

  it.each(["en", "fa"] as const)(
    "prints aligned bilingual headers and explicit missing estimates in %s",
    (language) => {
      const state = initialState();
      const order = createOrder(
        state,
        {
          company_id: state.config.company.seed_key,
          branch: "all",
          role: "supervisor",
          actor: "Print reviewer",
        },
        {
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
        },
      );
      const { container } = render(
        <OrderPrintDocument
          order={order}
          config={state.config}
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
