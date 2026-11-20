import Decimal from "decimal.js";
import type { Page } from "@playwright/test";
import type { OperationalReturn } from "../src/operations";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { signIn } from "./helpers";
/** Independent fictional retained records. No invoice uploads or private business values. */
export async function installLocationReturnScene(page: Page) {
  await signIn(page, "Manager");
  const records = [
    {
      id: "r2f-return-one",
      supplier: "Cedar Pantry Supply",
      reason: "wrong_item",
      rows: [
        ["0001", 2, "4.1250"],
        ["0003", 1, "2.7500"],
      ],
    },
    {
      id: "r2f-return-two",
      supplier: "Silver Meadow Foods",
      reason: "short_dated",
      rows: [
        ["0006", 2, "1.3750"],
        ["0009", 1, "2.2500"],
      ],
    },
    {
      id: "r2f-return-three",
      supplier: "Harbour Spring Drinks",
      reason: "wrong_item",
      rows: [
        ["0004", 3, "3.2500"],
        ["0005", 1, "1.5000"],
        ["0010", 1, "2.0000"],
        ["0012", 1, "2.5000"],
      ],
    },
  ].map((record, index) => ({
    id: record.id,
    company_id: "",
    branch: "Branch 1",
    supplier: record.supplier,
    currency: "CAD",
    status: "open",
    created_at: new Date(Date.UTC(2026, 9, 25 - index, 14)).toISOString(),
    created_by: "Fictional reviewer",
    original_units_recovered: 0,
    lines: record.rows.map(([code, qty, cost]) => ({
      product_code: String(code),
      qty: Number(qty),
      quantity_unit: "units",
      unit_cost: String(cost),
      reason: record.reason,
      location: "Branch 1",
    })),
  })) as OperationalReturn[];
  const amounts = records.map((record) =>
    record.lines
      .reduce(
        (total, line) =>
          total.plus(new Decimal(line.unit_cost!).times(line.qty)),
        new Decimal(0),
      )
      .toFixed(2),
  );
  await runCanonicalBusinessFixture(
    page,
    (state, { records }) => {
      const company = state.config.company.seed_key;
      state.returns = records.map((record) => ({
        ...record,
        company_id: company,
        currency: state.config.company.currency,
      }));
      const tea = state.products.find((product) => product.code === "0004")!;
      tea.branch_prices = {
        "Branch 1": "6.49",
        "Branch 2": "6.49",
        "Branch 3": "7.49",
      };
      tea.date_tracking = true;
      tea.date_reminder_days = 10;
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + 4);
      state.expiry.push({
        id: "r2f-open-tea-date",
        company_id: company,
        branch: "Branch 1",
        product_code: tea.code,
        date: date.toISOString().slice(0, 10),
        date_type: "expiry",
        expires_in_days: 4,
        status: "active",
      });
    },
    { records },
  );
  await page.reload();
  return { records, amounts };
}
