import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSeed } from "./config";
import i18n from "./i18n";
import {
  addLabelsToWaitlist,
  branchLabelWaitlist,
  confirmLabelsPrinted,
  prepareLabelPrint,
  type LabelActor,
} from "./label-workflow";
import { labelLayout } from "./labels";
import { dashboardPriceChanges } from "./dashboard-data";
import {
  activeSaleAt,
  changeSale,
  endSale,
  savePriceChange,
  type ChangePriceInput,
  type SalesContext,
} from "./sales";
import { Labels, ShelfLabel } from "./screens/Labels";
import { DemoProvider, initialState, useDemo } from "./store";
import type { DemoState } from "./types";

const now = new Date("2026-10-12T16:00:00Z");
const manager: SalesContext = {
  company_id: "super-arzon",
  role: "supervisor",
  actor: "Demo Supervisor",
  username: "supervisor",
  branch: "Branch 1",
  allowed_branches: ["Branch 1", "Branch 2", "Branch 3"],
};
const actor: LabelActor = {
  name: manager.actor,
  role: manager.role,
  branch: manager.branch,
};
const templateFor = (state: DemoState, style: "regular" | "promo") =>
  state.templates.find(
    (template) =>
      template.company_id === manager.company_id &&
      template.built_in === style &&
      !template.archived,
  )!;
const regularInput = (price = "22.99"): ChangePriceInput => ({
  product_code: "0012",
  mode: "regular",
  scope: "current",
  price,
  price_unit: "each",
  branches: ["Branch 1"],
  starts_on: "2026-10-12",
  last_day: null,
  accept_below_margin: false,
  below_cost_reason: "",
  add_labels: true,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#labels";
  await i18n.changeLanguage("en");
});
afterEach(() => vi.useRealTimers());

function TestControls() {
  const { state, signIn, update } = useDemo();
  const supervisor = demoSeed.demo_users.find(
    (user) => user.role === "supervisor",
  )!;
  return (
    <>
      <button
        onClick={() =>
          expect(signIn(supervisor.username, supervisor.password!)).toBeNull()
        }
      >
        Sign in for label test
      </button>
      <button
        onClick={() =>
          update((next) =>
            addLabelsToWaitlist(next, ["0003"], 3, "Branch 1", actor),
          )
        }
      >
        Add regular copies for label test
      </button>
      <output data-testid="waiting-evidence">
        {JSON.stringify(branchLabelWaitlist(state, "Branch 1"))}
      </output>
    </>
  );
}
function showLabels() {
  return render(
    <DemoProvider>
      <TestControls />
      <Labels />
    </DemoProvider>,
  );
}

describe("C8 label styles follow real sale lifecycle and scoped printing", () => {
  it.each(["end", "change"] as const)(
    "does not remove a newer %s-sale label intent when an earlier Promo sheet is confirmed",
    (transition) => {
      const state = initialState();
      const printed = branchLabelWaitlist(state, "Branch 1")[0];
      const snapshot = prepareLabelPrint(
        state,
        "Branch 1",
        templateFor(state, "promo"),
        1,
        actor,
        [printed.id],
      );
      const sale = activeSaleAt(state, "0012", "Branch 1", now)!;
      if (transition === "end")
        endSale(
          state,
          manager,
          sale.id,
          { expected_revision: sale.revision },
          now,
        );
      else
        changeSale(
          state,
          manager,
          sale.id,
          {
            ...regularInput("17.49"),
            mode: "sale",
            starts_on: sale.starts_on,
            last_day: sale.last_day,
            expected_revision: sale.revision,
          },
          now,
        );
      const newer = structuredClone(branchLabelWaitlist(state, "Branch 1")[0]);
      expect(newer.id).toBe(printed.id);
      expect(newer.source_event_id).not.toBe(
        snapshot.entries[0].source_event_id,
      );
      expect(newer.preferred_template).toBe(
        transition === "end" ? "regular" : "promo",
      );
      confirmLabelsPrinted(state, snapshot, actor);
      confirmLabelsPrinted(state, snapshot, actor);
      expect(branchLabelWaitlist(state, "Branch 1")).toEqual([newer]);
      const audit = state.activity.filter(
        (item) => item.action === "Print labels",
      );
      expect(audit).toHaveLength(1);
      expect(audit[0].after).toMatchObject({
        template_id: snapshot.template.id,
        copies: 1,
        items: [
          {
            product_code: "0012",
            copies: 1,
            preferred_template: "promo",
            source_event_id: snapshot.entries[0].source_event_id,
            source_reason: "sale_started",
          },
        ],
      });
    },
  );

  it("keeps Products as the default and automatically selects Promo for a sale-start waitlist", async () => {
    const user = userEvent.setup();
    const { container } = showLabels();
    await user.click(
      screen.getByRole("button", { name: "Sign in for label test" }),
    );
    expect(screen.getByRole("tab", { name: "Products" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: /^Waitlist/ }));
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Promo");
    expect(container.querySelector(".promo-label-price")).toHaveTextContent(
      "$16.99",
    );
    expect(
      container.querySelector(".promo-label-regular-price"),
    ).toHaveTextContent("$20.99");
    const evidence = JSON.parse(
      screen.getByTestId("waiting-evidence").textContent!,
    );
    expect(evidence).toEqual([
      expect.objectContaining({
        product_code: "0012",
        preferred_template: "promo",
        source_reason: "sale_started",
        source_event_id: expect.any(String),
      }),
    ]);
  });

  it("separates mixed copies, auto-selects each style and retains explicit template/slot choices in its own group", async () => {
    const user = userEvent.setup();
    const { container } = showLabels();
    await user.click(
      screen.getByRole("button", { name: "Sign in for label test" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add regular copies for label test" }),
    );
    await user.click(screen.getByRole("tab", { name: /^Waitlist/ }));
    const styles = screen.getByRole("tablist", { name: "Label styles" });
    expect(
      within(styles).getByRole("tab", { name: /^Regular/ }),
    ).toHaveTextContent("3");
    expect(
      within(styles).getByRole("tab", { name: /^Promo/ }),
    ).toHaveTextContent("1");
    expect(container.querySelector(".labels-waitlist-table")).toHaveTextContent(
      "0012",
    );
    expect(
      container.querySelector(".labels-waitlist-table"),
    ).not.toHaveTextContent("0003");
    await user.click(screen.getByRole("combobox", { name: "Saved template" }));
    await user.click(screen.getByRole("option", { name: "Regular" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Starting slot" }), {
      target: { value: "5" },
    });
    await user.click(within(styles).getByRole("tab", { name: /^Regular/ }));
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Regular");
    expect(screen.getByRole("textbox", { name: "Starting slot" })).toHaveValue(
      "1",
    );
    expect(container.querySelector(".labels-waitlist-table")).toHaveTextContent(
      "0003",
    );
    expect(
      container.querySelector(".labels-waitlist-table"),
    ).not.toHaveTextContent("0012");
    await user.click(screen.getByRole("combobox", { name: "Saved template" }));
    await user.click(screen.getByRole("option", { name: "Promo" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Starting slot" }), {
      target: { value: "2" },
    });
    await user.click(within(styles).getByRole("tab", { name: /^Promo/ }));
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Regular");
    expect(screen.getByRole("textbox", { name: "Starting slot" })).toHaveValue(
      "5",
    );
    await user.click(within(styles).getByRole("tab", { name: /^Regular/ }));
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Promo");
    expect(screen.getByRole("textbox", { name: "Starting slot" })).toHaveValue(
      "2",
    );
  });

  it("previews and prints only the selected group, then keeps the other group and its copies waiting", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { container } = showLabels();
    await user.click(
      screen.getByRole("button", { name: "Sign in for label test" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add regular copies for label test" }),
    );
    await user.click(screen.getByRole("tab", { name: /^Waitlist/ }));
    expect(
      container.querySelector(".label-bilingual-preview"),
    ).toHaveTextContent("0012");
    expect(
      container.querySelector(".label-bilingual-preview"),
    ).not.toHaveTextContent("0003");
    await user.click(screen.getByRole("button", { name: "Print labels" }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.querySelector(".label-print-output")).toHaveTextContent(
      "0012",
    );
    expect(document.querySelector(".label-print-output")).not.toHaveTextContent(
      "0003",
    );
    const confirmation = screen.getByRole("dialog", {
      name: "Did the labels print correctly?",
    });
    await user.click(within(confirmation).getByRole("button", { name: "Yes" }));
    expect(
      JSON.parse(screen.getByTestId("waiting-evidence").textContent!),
    ).toEqual([expect.objectContaining({ product_code: "0003", copies: 3 })]);
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Regular");
    expect(container.querySelector(".labels-waitlist-table")).toHaveTextContent(
      "0003",
    );
  });

  it("freezes the printed sale and regular prices even after the real regular price changes and the sale ends", () => {
    const state = initialState();
    const entry = branchLabelWaitlist(state, "Branch 1").find(
      (item) => item.preferred_template === "promo",
    )!;
    const snapshot = prepareLabelPrint(
      state,
      "Branch 1",
      templateFor(state, "promo"),
      1,
      actor,
      [entry.id],
    );
    expect(snapshot.products[0].label_sale?.sale_price).toBe("16.99");
    expect(snapshot.products[0].label_regular_price).toBe("20.99");
    savePriceChange(state, manager, regularInput(), now);
    const sale = activeSaleAt(state, "0012", "Branch 1", now)!;
    endSale(state, manager, sale.id, { expected_revision: sale.revision }, now);
    expect(branchLabelWaitlist(state, "Branch 1")[0].preferred_template).toBe(
      "regular",
    );
    const { container } = render(
      <DemoProvider>
        <ShelfLabel
          product={snapshot.products[0]}
          state={state}
          branch="Branch 1"
          template={snapshot.template}
        />
      </DemoProvider>,
    );
    expect(container.querySelector(".promo-label-price")).toHaveTextContent(
      "$16.99",
    );
    expect(
      container.querySelector(".promo-label-regular-price"),
    ).toHaveTextContent("$20.99");
    expect(container).not.toHaveTextContent("$22.99");
    expect(snapshot.template).toMatchObject({ width: 210, height: 148.5 });
    expect(labelLayout(snapshot.template).capacity).toBe(2);
  });

  it("keeps manual Promo overrides and exact Regular geometry while confirmation removes only the scoped snapshot", () => {
    const state = initialState();
    addLabelsToWaitlist(state, ["0003"], 3, "Branch 1", actor);
    addLabelsToWaitlist(state, ["0003"], 2, "Branch 2", {
      ...actor,
      branch: "Branch 2",
    });
    const regularEntry = branchLabelWaitlist(state, "Branch 1").find(
      (item) => item.product_code === "0003",
    )!;
    const promoEntry = branchLabelWaitlist(state, "Branch 1").find(
      (item) => item.preferred_template === "promo",
    )!;
    const snapshot = prepareLabelPrint(
      state,
      "Branch 1",
      templateFor(state, "promo"),
      1,
      actor,
      [regularEntry.id],
    );
    expect(snapshot.products).toHaveLength(3);
    expect(snapshot.products.every((product) => product.code === "0003")).toBe(
      true,
    );
    expect(snapshot.pages).toHaveLength(2);
    const foreignEntry = branchLabelWaitlist(state, "Branch 2")[0];
    expect(() =>
      prepareLabelPrint(
        state,
        "Branch 1",
        templateFor(state, "promo"),
        1,
        actor,
        [foreignEntry.id],
      ),
    ).toThrow("permission");
    addLabelsToWaitlist(state, ["0003"], 2, "Branch 1", actor);
    confirmLabelsPrinted(state, snapshot, actor);
    confirmLabelsPrinted(state, snapshot, actor);
    expect(branchLabelWaitlist(state, "Branch 1")).toEqual([
      expect.objectContaining({ id: promoEntry.id, copies: 1 }),
      expect.objectContaining({ id: regularEntry.id, copies: 2 }),
    ]);
    expect(branchLabelWaitlist(state, "Branch 2")[0].copies).toBe(2);
    const regularTemplate = templateFor(state, "regular");
    expect(regularTemplate).toMatchObject({
      width: 60,
      height: 40,
      gap_x: 4,
      gap_y: 4,
    });
    expect(labelLayout(regularTemplate).capacity).toBe(18);
  });

  it("counts the actual Set regular price action in this week's dashboard changes", () => {
    const state = initialState();
    savePriceChange(state, manager, regularInput(), now);
    expect(dashboardPriceChanges(state, manager, "2026-10-12")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "Set regular price",
          product_code: "0012",
        }),
      ]),
    );
    expect(() =>
      dashboardPriceChanges(
        state,
        {
          ...manager,
          company_id: "other-company",
        },
        "2026-10-12",
      ),
    ).toThrow();
  });
});
