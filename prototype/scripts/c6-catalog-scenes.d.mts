import type { Page } from "@playwright/test";
import type {
  button,
  field,
  exact,
  today,
  choose,
} from "./c5-browser-proof.mjs";

export type CatalogSceneHelpers = {
  button: typeof button;
  field: typeof field;
  exact: typeof exact;
  today: typeof today;
  choose: typeof choose;
};

export type CatalogScene =
  | "products"
  | "date-tracking"
  | "edit-product-dates"
  | "lookup-clearance-dates";

export type CatalogSceneResult = {
  selector: string;
  capture: "page" | "viewport";
  evidence: Record<string, unknown>;
  afterAppearance?: (page: Page) => Promise<void>;
};

export function setupCatalogScene(
  page: Page,
  scene: "edit-product-dates" | "date-tracking",
  helpers: CatalogSceneHelpers,
): Promise<
  CatalogSceneResult & { afterAppearance: (page: Page) => Promise<void> }
>;
export function setupCatalogScene(
  page: Page,
  scene: CatalogScene,
  helpers: CatalogSceneHelpers,
): Promise<CatalogSceneResult>;
