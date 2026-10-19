/** Test-only pure business initialization, copied from the actual E1 bootstrap.
 * No authentication is invented here; each test must mint a real central actor.
 * Derived system jobs run only later through repository-minted witnesses.
 */
import { configSeed, demoSeed } from "./config";
import { hydrateDemoFixture } from "./demo-fixtures";
import { hydrateBState } from "./b-state";
import { hydrateCState } from "./c-state";
import { hydrateC2State } from "./c2-state";
import { hydrateC4State } from "./c4-state";
import { hydrateC6State } from "./c6-state";
import { hydrateSalesDemo } from "./sales";
import type { DemoState, Branch } from "./types";
export const branches = demoSeed.branches as Exclude<Branch, "all">[];

export function relativeDate(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: configSeed.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function initialState(): DemoState {
  const company_id = configSeed.company.seed_key;
  const products: DemoState["products"] = demoSeed.products.map((product) => ({
    ...product,
    status: "active",
    sold_by:
      "sold_by" in product && product.sold_by === "weight" ? "weight" : "each",
    company_id,
    branch_prices:
      product.code === demoSeed.cross_branch_price_conflict.product_code
        ? {
            "Branch 1": demoSeed.cross_branch_price_conflict.branch_1_price,
            "Branch 2": demoSeed.cross_branch_price_conflict.branch_2_price,
          }
        : ({} as Record<string, string>),
    pending_price:
      product.code === "0006"
        ? demoSeed.demo_invoice.lines.find(
            (line) => line.product_code === product.code,
          )?.calculated_selling_price
        : null,
    pending_branch: "Branch 1",
  }));
  const newLine = demoSeed.demo_invoice.lines.find(
    (line) => line.product_code === "NEW",
  )!;
  products.push({
    company_id,
    code: "0015",
    name_en: newLine.description,
    name_fa: "زرشک خشک ۱۰۰ گرمی",
    pricing_category: configSeed.pricing_categories.find(
      (category) => category.key === "grocery",
    )!.key,
    unit_size: "100 g",
    last_cost_before_tax: newLine.unit_cost_before_tax,
    selling_price: "",
    pending_price: newLine.calculated_selling_price,
    pending_branch: "Branch 1",
    branch_prices: {},
    offer: null,
    taxable: newLine.taxable,
    date_tracking: true,
    main_supplier: demoSeed.demo_invoice.supplier,
    ai_category: "Dried fruits & spices",
    barcode: "DEMO-NEW-0015",
    status: "pending_approval",
    tax_profile: newLine.tax_profile,
  });
  const state = hydrateC4State(
    hydrateC2State(
      hydrateCState(
        hydrateBState(
          hydrateDemoFixture(
            structuredClone({
              version: 1,
              supplier_balance_snapshot_date: relativeDate(0),
              supplier_balance_snapshot_currency: configSeed.company.currency,
              pricing_minimum_margin_schema: 2,
              config: configSeed,
              products,
              approvals: [
                {
                  id: "demo-lavash-price",
                  company_id,
                  branch: "Branch 1",
                  type: "price_change",
                  product_code: "0006",
                  status: "pending",
                  proposed_price: "2.99",
                  current_price: "1.99",
                },
                {
                  id: "demo-barberries-product",
                  company_id,
                  branch: "Branch 1",
                  type: "new_product",
                  product_code: "0015",
                  status: "pending",
                  proposed_price: newLine.calculated_selling_price,
                  current_price: null,
                },
              ],
              alerts: [
                {
                  id: "demo-tea-conflict",
                  company_id,
                  branch: "all",
                  type: "price_conflict",
                  product_code:
                    demoSeed.cross_branch_price_conflict.product_code,
                  status: "pending",
                  branch_prices: {
                    "Branch 1":
                      demoSeed.cross_branch_price_conflict.branch_1_price,
                    "Branch 2":
                      demoSeed.cross_branch_price_conflict.branch_2_price,
                  },
                },
              ],
              invoice: {
                ...demoSeed.demo_invoice,
                id: "demo-fv-20417",
                company_id,
                branch: "Branch 1",
                status: "empty",
                lines: demoSeed.demo_invoice.lines.map((line) => ({
                  ...line,
                  company_id,
                  sold_by: line.sold_by === "weight" ? "weight" : "each",
                  quantity_unit:
                    line.quantity_unit === "cases" ? "cases" : "units",
                })),
                invoice_date: relativeDate(0),
                received_at: new Date().toISOString(),
                receiving_employee: demoSeed.demo_users.find(
                  (user) => user.role === "floor_worker",
                )!.name,
                due_date: relativeDate(14),
                supplier_confirmed: true,
              },
              invoices: [],
              offers: products
                .filter((product) => product.offer)
                .map((product) => {
                  const mapping = configSeed.promotions.price_to_offer.find(
                    (offer) => offer.price === product.selling_price,
                  )!;
                  return {
                    id: `demo-offer-${product.code}`,
                    company_id,
                    branch: "all",
                    product_code: product.code,
                    label: product.offer!,
                    price: product.selling_price,
                    pool: mapping.mix_and_match_pool,
                    mix_and_match: true,
                    status: "active",
                    scope: "all",
                    currency: configSeed.company.currency,
                  };
                }),
              templates: [],
              returns: demoSeed.open_returns.map((record, index) => ({
                ...record,
                company_id,
                branch: record.branch as Branch,
                id: `demo-return-${index + 1}`,
                status: record.status as "open" | "partially_resolved",
              })),
              expiry: demoSeed.expiring_soon_examples.map((record, index) => ({
                ...record,
                company_id,
                branch: record.branch as Branch,
                id: `demo-expiry-${index + 1}`,
                date: relativeDate(record.expires_in_days),
                status: "active",
              })),
              notes: demoSeed.notes.map((record, index) => ({
                ...record,
                company_id,
                branch: "Branch 1",
                id: `demo-note-${index + 1}`,
                type: record.type as
                  "to_order" | "store_use" | "note_to_supervisor",
                status: "open",
                created_at: new Date().toISOString(),
              })),
              ledger: [],
              stock: Object.fromEntries(
                products.flatMap((product) =>
                  branches.map((branch) => [
                    `${branch}:${product.code}`,
                    demoSeed.open_returns.reduce(
                      (count, record) =>
                        count +
                        (record.branch === branch &&
                        record.replacement_received?.product_code ===
                          product.code
                          ? record.replacement_received.qty
                          : 0),
                      0,
                    ),
                  ]),
                ),
              ),
              activity: [],
            } satisfies DemoState),
          ),
        ),
      ),
    ),
    true,
  );
  hydrateC6State(state);
  hydrateSalesDemo(state);
  return state;
}
