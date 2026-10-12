import { configSeed } from "./config";
import type { DemoState } from "./types";

const previousDefaultBranding: typeof configSeed.company.branding = {
  primary_color: "#2B59C3",
  primary_hover_color: "#234AA8",
  primary_soft_color: "#E6EDFA",
  dark_primary_color: "#5B86E5",
  dark_primary_hover_color: "#7398EA",
  dark_primary_soft_color: "rgba(91,134,229,.18)",
  kpi_accent_end_color: "#3D68D4",
};

/** Add presentation defaults without altering any company's custom branding. */
export function hydrateC6State(state: DemoState): DemoState {
  if (state.prototype_c6_schema === 1) return state;
  const saved = (state.config.company.branding ??= structuredClone(
    configSeed.company.branding,
  ));
  for (const key of Object.keys(
    previousDefaultBranding,
  ) as (keyof typeof saved)[]) {
    if (saved[key] === previousDefaultBranding[key])
      saved[key] = configSeed.company.branding[key];
  }
  state.config.supplier_documents ??= {
    return_memo: "en",
    supplier_order: "en",
  };
  state.prototype_c6_schema = 1;
  return state;
}
