import { useReviewScrollAnchor } from "./screens/invoice-review/useReviewScrollAnchor";
import {
  WeightEditorError,
  type WeightPackageDraft,
} from "./weight-product-editor";
import type { ProductReadDTO } from "./catalog-read-model";
import type { CompanyConfig } from "./types";
import type { PricingConfig } from "./pricing";

const productScrollParent = (element: HTMLElement) =>
  element.closest<HTMLElement>(".product-editor-body") ??
  element
    .closest("dialog")
    ?.querySelector<HTMLElement>(".product-editor-body") ??
  null;
/** Reuse receiving's guarded anchor while keeping a dialog frame and shrinkable content stable. */
export function useWeightEditorScrollAnchor() {
  const { anchor } = useReviewScrollAnchor(productScrollParent);
  return (control: HTMLElement) => {
    const dialog = control.closest<HTMLDialogElement>(
      "dialog.weight-product-dialog",
    );
    if (dialog) {
      dialog.style.blockSize = `${dialog.getBoundingClientRect().height}px`;
      const content = dialog.querySelector<HTMLElement>(
        ".weight-product-content",
      );
      if (content)
        content.style.minBlockSize = `${Math.max(parseFloat(content.style.minBlockSize) || 0, content.getBoundingClientRect().height)}px`;
    }
    anchor(control);
  };
}
export const packageDraftsFromProducts = (
  products: readonly ProductReadDTO[],
): WeightPackageDraft[] =>
  products.map((product) => ({
    key: product.code,
    code: product.code,
    expected_version: product.package_version,
    size: product.package_size ?? "",
    unit: product.package_size_unit ?? "g",
    barcode: product.barcode,
    name_en: product.name_en,
    name_fa: product.name_fa,
    generated: product.package_barcode_generated,
  }));
export type WeightPricingConfig = PricingConfig &
  Pick<CompanyConfig, "weighed_items">;
export function weightEditorErrorText(
  error: unknown,
  t: (en: string, fa: string) => string,
): string {
  if (error instanceof WeightEditorError) {
    if (error.code === "pending_cost_review")
      return t(
        "Review the current pending price in Approvals before changing this cost.",
        "پیش از تغییر هزینه، قیمت در انتظار فعلی را در تأییدها بررسی کنید.",
      );
    if (error.code === "packages_active")
      return t(
        "Archive the active package sizes before changing this product to Each.",
        "پیش از تغییر فروش به عددی، اندازه‌های بسته فعال را بایگانی کنید.",
      );
  }
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "duplicate_size")
      return t(
        "This package size is already listed. Edit that row or choose another size.",
        "این اندازه بسته در فهرست است. همان ردیف را ویرایش کنید یا اندازه دیگری انتخاب کنید.",
      );
    if (error.code === "barcode_conflict")
      return t(
        "This barcode belongs to another product. Enter a different barcode.",
        "این بارکد متعلق به کالای دیگری است. بارکد دیگری وارد کنید.",
      );
  }
  return t(
    "This product or its pricing settings changed. Close and reopen it before saving.",
    "این کالا یا تنظیمات قیمت‌گذاری آن تغییر کرد. پیش از ذخیره ببندید و دوباره باز کنید.",
  );
}
