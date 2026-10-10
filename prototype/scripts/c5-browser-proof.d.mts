import type { Locator, Page } from "@playwright/test";

export type C5Variant = "en-light" | "en-dark" | "fa-light" | "phone";
export type C5Button = {
  screen: string;
  variant: string;
  role: string;
  label: string;
  kind: string;
  style: string;
  radius: string;
  radii: string[];
  height: number;
  width: number;
  textWidth: number;
  intrinsicWidth: number;
  inTable: boolean;
  disabled: boolean;
  border: string;
  glow: string;
  className: string;
};
export type C5Inspection = {
  screen: string;
  variant: string;
  role: string;
  route: string;
  viewport: {
    width: number;
    height: number;
    innerWidth: number;
    scrollWidth: number;
    visualWidth: number | null;
  };
  buttons: C5Button[];
  topbar: {
    label: string;
    height: number;
    radius: string;
    borderWidth: string;
    borderColor: string;
    borderStyle: string;
    glow: string;
  }[];
  statuses: {
    label: string;
    color: string;
    background: string;
    classes: string;
    returnStatus: string | null;
    outcome: string | null;
  }[];
  failures: string[];
};
export function exact(en: string, fa?: string): RegExp;
export function button(scope: Page | Locator, en: string, fa?: string): Locator;
export function field(scope: Page | Locator, en: string, fa?: string): Locator;
export function settled(page: Page): Promise<void>;
export function appearance(page: Page, variant: C5Variant): Promise<void>;
export function choose(
  page: Page,
  control: Locator,
  name: string | RegExp,
): Promise<void>;
export function today(page: Page, scope?: Page | Locator): Promise<void>;
export function inspect(
  page: Page,
  screen: string,
  variant: string,
  role?: string,
): Promise<C5Inspection>;
export function fieldContrast(
  page: Page,
  scope?: string,
): Promise<
  {
    label: string;
    border: string;
    borderWidth: string;
    interiorContrast: number;
    adjacentContrast: number;
    glow: string;
  }[]
>;
