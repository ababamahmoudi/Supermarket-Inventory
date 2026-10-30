import { useReviewScrollAnchor } from "./screens/invoice-review/useReviewScrollAnchor";
import {
  WeightEditorError,
  type WeightPackageDraft,
} from "./weight-product-editor";
import type { ProductReadDTO } from "./catalog-read-model";
import type { CompanyConfig } from "./types";
import type { PricingConfig } from "./pricing";
import { useCallback, useEffect, useRef } from "react";

const productScrollParent = (element: HTMLElement) =>
  element.closest<HTMLElement>(".product-editor-body") ??
  element
    .closest("dialog")
    ?.querySelector<HTMLElement>(".product-editor-body") ??
  null;
/** A later package quote must not shrink the frame and clamp a restored scroll. */
function holdWeightContentFrame(
  _control: HTMLElement,
  parent: HTMLElement | null,
) {
  const content = parent?.querySelector<HTMLElement>(".weight-product-content");
  if (content)
    content.style.minBlockSize = `${Math.max(parseFloat(content.style.minBlockSize) || 0, content.getBoundingClientRect().height)}px`;
}
/** Reuse receiving's guarded anchor while keeping a dialog frame and shrinkable content stable. */
export function useWeightEditorScrollAnchor() {
  const { anchor, clear } = useReviewScrollAnchor(
    productScrollParent,
    holdWeightContentFrame,
  );
  const held = useRef<{
    dialog: HTMLDialogElement;
    content: HTMLElement;
  } | null>(null);
  const release = useCallback(() => {
    const frame = held.current;
    frame?.content.style.removeProperty("min-block-size");
    frame?.dialog.style.removeProperty("block-size");
    held.current = null;
    clear();
  }, [clear]);
  useEffect(() => {
    const scrollIntent = (event: Event) => {
      if (
        event.target instanceof Node &&
        held.current?.dialog.contains(event.target)
      )
        release();
    };
    window.addEventListener("wheel", scrollIntent, {
      capture: true,
      passive: true,
    });
    window.addEventListener("touchmove", scrollIntent, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", release);
    return () => {
      window.removeEventListener("wheel", scrollIntent, true);
      window.removeEventListener("touchmove", scrollIntent, true);
      window.removeEventListener("resize", release);
    };
  }, [release]);
  return (control: HTMLElement) => {
    const dialog = control.closest<HTMLDialogElement>(
      "dialog.weight-product-dialog",
    );
    if (dialog) {
      dialog.style.blockSize = `${dialog.getBoundingClientRect().height}px`;
      const content = dialog.querySelector<HTMLElement>(
        ".weight-product-content",
      );
      if (content) {
        // Rebase the prior hold to natural content on each explicit action,
        // retaining only the tail needed to keep the current viewport in place.
        const parent = productScrollParent(control);
        const scrollTop = parent?.scrollTop ?? 0;
        const viewport = parent?.clientHeight ?? 0;
        const style = parent ? getComputedStyle(parent) : null;
        const padding = style
          ? (parseFloat(style.paddingTop) || 0) +
            (parseFloat(style.paddingBottom) || 0)
          : 0;
        content.style.removeProperty("min-block-size");
        const natural = content.getBoundingClientRect().height;
        // scrollHeight cannot reveal missing extent when natural content is
        // shorter than the viewport. Keep the pre-rebase scroll capacity.
        const extent = parent ? viewport + scrollTop - padding : 0;
        content.style.minBlockSize = `${Math.max(natural, Math.ceil(extent))}px`;
        if (parent) parent.scrollTop = scrollTop;
        held.current = { dialog, content };
      }
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
