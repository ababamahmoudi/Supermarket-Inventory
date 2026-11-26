import { expect, it } from "vitest";
import { returnCreateFixture } from "./return-create-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  createReturn,
  returnCreateChoices,
  normalizeReturnQuantity,
  type ReturnQuantityUnit,
} from "./return-create";

function fixture(weight = false) {
  const state = returnCreateFixture();
  const line = state.invoices![0].lines[0];
  line.quantity_unit = "cases";
  line.units_per_case = 12;
  if (weight) {
    line.sold_by = "weight";
    line.case_weight = "10";
    line.case_weight_unit = "lb";
    line.unit_cost_before_tax = "2.5000";
    state.products.find((row) => row.code === line.product_code)!.sold_by =
      "weight";
  }
  const actor = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  const choice = returnCreateChoices(state, actor, "Branch 1").products[0];
  const save = (quantity: string, unit: ReturnQuantityUnit) =>
    createReturn(state, actor, {
      request_id: `fictional-${unit}-request`,
      branch: "Branch 1",
      supplier_id: choice.supplier_id,
      product_code: choice.product_code,
      source_fingerprint: choice.source_fingerprint,
      quantity,
      quantity_unit: unit,
      reason: "wrong_item",
      note: "Fictional return",
      photos: [],
    });
  return { state, actor, line, choice, save };
}
it("C8 uses actual retained case pack, received-unit default and canonical frozen source cost", () => {
  const { state, choice, save } = fixture();
  expect(choice.received_unit).toBe("cases");
  expect(choice.unit_multipliers).toEqual({ units: "1", cases: "12" });
  const id = save("2", "cases");
  expect(state.returns.find((row) => row.id === id)!.lines[0]).toMatchObject({
    qty: 24,
    quantity_unit: "units",
    entered_quantity: "2",
    entered_quantity_unit: "cases",
    unit_cost: "7.1250",
  });
});
it("C8 weight kg/cases use configured conversion at pickup precision and audit entered evidence", () => {
  const { state, choice, save } = fixture(true);
  expect(choice.unit_multipliers.kg).toBe(
    state.config.weighed_items!.conversion_factor,
  );
  expect(choice.unit_multipliers.cases).toBe("10");
  const id = save("2", "kg");
  expect(state.returns.find((row) => row.id === id)!.lines[0]).toMatchObject({
    qty: 4.409,
    quantity_unit: "lb",
    entered_quantity: "2",
    entered_quantity_unit: "kg",
    unit_cost: "2.5000",
  });
  expect(state.activity.at(-1)?.after).toMatchObject({
    entered_quantity: "2",
    entered_quantity_unit: "kg",
    quantity_unit: "lb",
  });
  const other = save("2", "cases");
  expect(state.returns.find((row) => row.id === other)!.lines[0]).toMatchObject(
    { qty: 20, quantity_unit: "lb", unit_cost: "2.5000" },
  );
});
it("C8 never offers guessed case packs and rechecks stale source conversion evidence", () => {
  const { state, actor, choice, save, line } = fixture();
  delete line.units_per_case;
  const current = returnCreateChoices(state, actor, "Branch 1").products[0];
  expect(current.unit_multipliers).toEqual({ units: "1" });
  expect(current.received_unit).toBe("units");
  expect(() => save("2", "cases")).toThrow("changed");
  expect(() =>
    normalizeReturnQuantity("2", "cases", "units", current.unit_multipliers),
  ).toThrow("unit");
  expect(choice.source_fingerprint).not.toBe(current.source_fingerprint);
});
it.each(["0", "-1", "1.5", "Infinity", "1.0001"])(
  "C8 rejects invalid whole case quantity %s",
  (value) => {
    expect(() =>
      normalizeReturnQuantity(value, "cases", "units", { cases: "12" }),
    ).toThrow();
  },
);
