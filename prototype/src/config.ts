import sourceConfig from "../../seed/arzon-config.json";
import sourceDemo from "../../seed/demo-data.json";
import retainedConfig from "./compat/configuration.json";
import retainedDemo from "./compat/operational-data.json";

// The owner's v2 uploads use the original seed schema. Keep the previously
// verified operational metadata while treating explicit current values as data.
const configured = (value: string, previous: string) =>
  value.includes("PLACEHOLDER") ? previous : value;

export const configSeed = {
  ...retainedConfig,
  ...sourceConfig,
  company: {
    ...retainedConfig.company,
    ...sourceConfig.company,
    name_en: sourceConfig.company.name,
    name_fa:
      sourceConfig.company.name === retainedConfig.company.name
        ? retainedConfig.company.name_fa
        : sourceConfig.company.name,
    currency: configured(
      sourceConfig.company.currency,
      retainedConfig.company.currency,
    ),
    timezone: configured(
      sourceConfig.company.timezone,
      retainedConfig.company.timezone,
    ),
  },
  branches: sourceConfig.branches.map((branch) => {
    const previous = retainedConfig.branches.find(
      (item) => item.code === branch.code,
    );
    return {
      ...previous,
      ...branch,
      name_en: branch.name,
      name_fa: previous?.name_fa ?? branch.name,
    };
  }),
  pricing_categories: sourceConfig.pricing_categories.map((category) => {
    const previous = retainedConfig.pricing_categories.find(
      (item) => item.key === category.key,
    )!;
    return {
      ...previous,
      ...category,
      apply_special_correction: category.apply_2_49_3_49_correction,
      minimum_margin:
        "minimum_margin" in category
          ? (category.minimum_margin as string | null)
          : (sourceConfig.approvals.minimum_margin.value as string | null),
    };
  }),
  rounding_bands: {
    ...retainedConfig.rounding_bands,
    ...sourceConfig.rounding_bands,
  },
  tax: {
    ...retainedConfig.tax,
    ...sourceConfig.tax,
    rate: configured(sourceConfig.tax.rate, retainedConfig.tax.rate),
  },
  promotions: { ...retainedConfig.promotions, ...sourceConfig.promotions },
  product_codes: {
    ...retainedConfig.product_codes,
    ...sourceConfig.product_codes,
  },
  invoices: { ...retainedConfig.invoices, ...sourceConfig.invoices },
  session: sourceConfig.session,
};

const products = sourceDemo.products.map((product) => ({
  ...retainedDemo.products.find((previous) => previous.code === product.code),
  ...product,
  tax_profile: configSeed.pricing_categories.find(
    (category) => category.key === product.pricing_category,
  )!.default_tax_profile,
}));

export const supplierDetails = sourceDemo.suppliers;
export const demoSeed = {
  ...retainedDemo,
  ...sourceDemo,
  products,
  suppliers: sourceDemo.suppliers.map((supplier) => supplier.name),
  demo_invoice: {
    ...retainedDemo.demo_invoice,
    ...sourceDemo.demo_invoice,
    lines: sourceDemo.demo_invoice.lines.map((line) => {
      const previous = retainedDemo.demo_invoice.lines.find(
        (item) => item.product_code === line.product_code,
      )!;
      return {
        ...previous,
        ...line,
        tax_profile: previous.tax_profile,
        qty_received_at_posting: previous.qty_received_at_posting,
      };
    }),
    short_lines: retainedDemo.demo_invoice.short_lines,
  },
  open_returns: sourceDemo.open_returns.map((record) => {
    const previous = retainedDemo.open_returns.find(
      (item) => item.supplier === record.supplier,
    )!;
    return {
      ...previous,
      ...record,
      // The uploaded "picked_up" example also specifies a partial replacement.
      // Keep its current product/quantity and the already recorded physical
      // receipt, expressed using the existing operational state vocabulary.
      status:
        record.status === "picked_up" &&
        "resolution" in record &&
        record.resolution?.includes("(partial)") &&
        "replacement_received" in previous
          ? "partially_resolved"
          : record.status,
    };
  }),
  same_supplier_lower_price_alert: {
    ...retainedDemo.same_supplier_lower_price_alert,
    ...sourceDemo.same_supplier_lower_price_alert,
  },
};
