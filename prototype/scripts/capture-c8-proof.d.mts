import type { Locator, Page } from "@playwright/test";
import type { DemoState } from "../src/types";
import type { inspectResponsiveLayout } from "./c6-layout-proof.mjs";

export const C8_SCENES: readonly string[];
export const C8_VARIANTS: readonly string[];
export function readC8State(page: Page): Promise<DemoState>;
export function waitForC8BusinessEvidence(
  page: Page,
  invoiceStatus?: string,
): Promise<void>;
export function visitC8(page: Page, route: string): Promise<void>;
export function chooseC8Date(
  page: Page,
  control: Locator,
  date?: string,
): Promise<void>;
export function openC8ProductEditor(page: Page, code: string): Promise<Locator>;
export function prepareC8NewOrder(page: Page): Promise<Locator>;
export function prepareC8ManualInvoice(page: Page): Promise<void>;
export function openC8PriceDialog(page: Page, code: string): Promise<Locator>;
export function readC8OriginalSHA(
  page: Page,
  reference: string,
): Promise<string>;
export function postC8SaleCostInvoice(
  page: Page,
  originalPath: string,
): Promise<{
  invoice_id: string;
  sale_id: string;
  alert_id: string;
  originalSHA256: string;
  line: DemoState["invoice"]["lines"][number];
  subtotal: string;
  tax: string;
  final_total: string;
}>;
export type C8Containment = {
  tableCount: number;
  rowCount: number;
  tables: {
    className: string;
    cardClassName: string;
    card: { left: number; right: number; top: number; bottom: number };
    rows: {
      text: string;
      expanded: boolean;
      row: { left: number; right: number; top: number; bottom: number };
      contained: boolean;
    }[];
  }[];
  failures: string[];
};
export function inspectC8Containment(page: Page): Promise<C8Containment>;
export function inspectC8Layout(
  page: Page,
  scene: string,
  language: string,
  width: number,
): Promise<
  Awaited<ReturnType<typeof inspectResponsiveLayout>> & {
    containment: C8Containment;
  }
>;
