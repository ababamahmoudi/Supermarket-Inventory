import { browserShellOptions } from "./browser-shell-options";
import { completeReadModelProjectors } from "./e1-projectors";
import type { ProviderOptions } from "./store";

/** One production assembly; tests may replace storage, never actors or projections. */
export function createBrowserProviderOptions(): ProviderOptions {
  return browserShellOptions(completeReadModelProjectors());
}
