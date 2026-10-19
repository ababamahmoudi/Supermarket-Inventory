import { configSeed, demoSeed } from "./config";
import retainedConfig from "./compat/configuration.json";
import { hydrateDemoFixture, restoreDemoFixture } from "./demo-fixtures";
import { hydrateBState, restoreBState } from "./b-state";
import { hydrateCState, restoreCState } from "./c-state";
import { hydrateC2State, restoreC2State } from "./c2-state";
import { hydrateC4State, restoreC4State } from "./c4-state";
import { hydrateC6State } from "./c6-state";
import { hydrateSalesState, hydrateSalesDemo } from "./sales";
import { companyDate } from "./invoice";
import { decodeHistoryStorage, HistoryStorageError } from "./history-storage";
import {
  archiveFileStorageSnapshot,
  migrateInlineFiles,
  migrateLegacyFileBackups,
} from "./file-database";
import { migrateE1BusinessState } from "./e1-state-migration";
import type { DemoState, Branch } from "./types";
import {
  LEGACY_HISTORY_SOURCE_KEY,
  parseLegacyCompanySource,
  quarantineHistoryBusiness,
} from "./history-recovery.e1";
export const STORAGE_KEY = LEGACY_HISTORY_SOURCE_KEY;
export const branches = demoSeed.branches as Exclude<Branch, "all">[];

export function relativeDate(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return companyDate(configSeed, now);
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

function readLegacyState(): { state: DemoState; invalidHistoryRaw?: string } {
  let rawSaved = "null";
  try {
    const retained = localStorage.getItem(STORAGE_KEY);
    rawSaved = retained ?? "null";
    const saved =
      retained === null
        ? null
        : decodeHistoryStorage(
            parseLegacyCompanySource(retained, configSeed.company.seed_key),
          );
    if (
      saved &&
      typeof saved === "object" &&
      "version" in saved &&
      saved.version === 1 &&
      "config" in saved &&
      "products" in saved &&
      Array.isArray(saved.products)
    ) {
      const candidate = saved as DemoState;
      if (
        candidate.config?.company?.seed_key === configSeed.company.seed_key &&
        Array.isArray(candidate.approvals) &&
        Array.isArray(candidate.ledger) &&
        candidate.invoice &&
        Array.isArray(candidate.returns)
      ) {
        // Keep business edits from v1 while replacing the old PIN session policy.
        candidate.config.session = {
          ...configSeed.session,
          ...candidate.config.session,
          sign_in: configSeed.session.sign_in,
          pins: configSeed.session.pins,
        };
        candidate.supplier_balance_snapshot_date ??= relativeDate(0);
        candidate.supplier_balance_snapshot_currency ??=
          configSeed.company.currency;
        if (candidate.pricing_minimum_margin_schema !== 2) {
          // Earlier screens could edit divisors, but not minimum margins. Only
          // replace an unchanged retained default;
          // preserve explicit custom values and all other saved business data.
          for (const category of candidate.config.pricing_categories) {
            const previous = retainedConfig.pricing_categories.find(
              (item) => item.key === category.key,
            );
            const current = configSeed.pricing_categories.find(
              (item) => item.key === category.key,
            );
            if (
              previous &&
              current &&
              category.minimum_margin === previous.minimum_margin
            )
              category.minimum_margin = current.minimum_margin;
          }
          candidate.pricing_minimum_margin_schema = 2;
        }
        const migrated = restoreC4State(
          restoreC2State(
            restoreCState(
              restoreBState(
                restoreDemoFixture(candidate, localStorage),
                localStorage,
              ),
              localStorage,
            ),
            localStorage,
          ),
          localStorage,
          rawSaved,
        );
        hydrateC6State(migrated);
        hydrateSalesState(migrated);
        return { state: migrated };
      }
    }
  } catch (error) {
    if (error instanceof HistoryStorageError)
      return { state: initialState(), invalidHistoryRaw: rawSaved };
    // An unreadable retained state must not be replaced with a fresh database.
    throw error;
  }
  if (rawSaved !== "null") throw new Error("invalid_business_storage");
  return { state: initialState() };
}

/** A retained corrupt History never becomes a silently empty replacement database. */
export async function loadInitialBusiness(): Promise<DemoState> {
  const loaded = readLegacyState();
  if (loaded.invalidHistoryRaw !== undefined)
    return quarantineHistoryBusiness(
      migrateE1BusinessState(loaded.state),
      loaded.invalidHistoryRaw,
    );
  const state = migrateE1BusinessState(loaded.state),
    company = state.config.company.seed_key;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) await archiveFileStorageSnapshot(STORAGE_KEY, raw, company);
  await migrateLegacyFileBackups(localStorage, company);
  return (await migrateInlineFiles(state, company)).state;
}
