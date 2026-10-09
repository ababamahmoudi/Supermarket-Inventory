import type { DemoState, LabelTemplate } from "./types";

export const regularLabelGeometry = {
  width: 60,
  height: 40,
  margin_top: 10,
  margin_bottom: 10,
  margin_left: 10,
  margin_right: 10,
  gap_x: 4,
  gap_y: 4,
  offset_x: 0,
  offset_y: 0,
};
export const promoLabelGeometry = {
  width: 210,
  height: 148.5,
  margin_top: 0,
  margin_bottom: 0,
  margin_left: 0,
  margin_right: 0,
  gap_x: 0,
  gap_y: 0,
  offset_x: 0,
  offset_y: 0,
};

/** Add missing company presets; edits and archived built-ins stay untouched. */
export function ensureBuiltInLabelTemplates(state: DemoState) {
  for (const kind of ["regular", "promo"] as const) {
    const company_id = state.config.company.seed_key;
    const id = `label-builtin-${kind}-${encodeURIComponent(company_id)}`;
    if (
      state.templates.some(
        (template) =>
          template.company_id === company_id &&
          (template.built_in === kind || template.id === id),
      )
    )
      continue;
    state.templates.push({
      id,
      company_id,
      name: kind === "regular" ? "Regular" : "Promo",
      style: kind,
      built_in: kind,
      ...(kind === "regular" ? regularLabelGeometry : promoLabelGeometry),
    });
  }
}

export interface LabelLayout {
  columns: number;
  rows: number;
  capacity: number;
}
export class LabelLayoutError extends Error {
  constructor(
    readonly code: "dimensions" | "fit" | "slot" | "calibration",
    readonly field?: keyof LabelTemplate,
    readonly capacity?: number,
  ) {
    super(code);
  }
}
export function labelLayout(template: LabelTemplate): LabelLayout {
  const fields = [
    "width",
    "height",
    "margin_top",
    "margin_bottom",
    "margin_left",
    "margin_right",
    "gap_x",
    "gap_y",
  ] as const;
  for (const field of fields) {
    const value = template[field];
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      ((field === "width" || field === "height") && value === 0)
    ) {
      throw new LabelLayoutError("dimensions", field);
    }
  }
  const columns = Math.floor(
    (210 - template.margin_left - template.margin_right + template.gap_x) /
      (template.width + template.gap_x),
  );
  const rows = Math.floor(
    (297 - template.margin_top - template.margin_bottom + template.gap_y) /
      (template.height + template.gap_y),
  );
  if (columns < 1 || rows < 1) throw new LabelLayoutError("fit", undefined, 0);
  const offsetX = template.offset_x ?? 0;
  const offsetY = template.offset_y ?? 0;
  if (
    !Number.isFinite(offsetX) ||
    template.margin_left + offsetX < 0 ||
    template.margin_left +
      offsetX +
      columns * template.width +
      (columns - 1) * template.gap_x >
      210
  )
    throw new LabelLayoutError("calibration", "offset_x");
  if (
    !Number.isFinite(offsetY) ||
    template.margin_top + offsetY < 0 ||
    template.margin_top +
      offsetY +
      rows * template.height +
      (rows - 1) * template.gap_y >
      297
  )
    throw new LabelLayoutError("calibration", "offset_y");
  return { columns, rows, capacity: columns * rows };
}

/** Both the scaled preview and exact-size print use this physical position. */
export function labelSlotGeometry(template: LabelTemplate, index: number) {
  const { columns } = labelLayout(template);
  return {
    left:
      template.margin_left +
      (template.offset_x ?? 0) +
      (index % columns) * (template.width + template.gap_x),
    top:
      template.margin_top +
      (template.offset_y ?? 0) +
      Math.floor(index / columns) * (template.height + template.gap_y),
    width: template.width,
    height: template.height,
  };
}

export function labelPages<T>(
  items: T[],
  template: LabelTemplate,
  startSlot: number,
): (T | null)[][] {
  const { capacity } = labelLayout(template);
  if (!Number.isInteger(startSlot) || startSlot < 1 || startSlot > capacity)
    throw new LabelLayoutError("slot", undefined, capacity);
  if (items.length === 0) return [];
  const slots: (T | null)[] = [
    ...Array<T | null>(startSlot - 1).fill(null),
    ...items,
  ];
  const pages: (T | null)[][] = [];
  for (let offset = 0; offset < slots.length; offset += capacity)
    pages.push(slots.slice(offset, offset + capacity));
  return pages;
}

/** Fit the complete label hierarchy in the physical box, even on tiny stock. */
export function labelContentGeometry(width: number, height: number) {
  const widthPx = (width * 96) / 25.4;
  const heightPx = (height * 96) / 25.4;
  const padding = Math.min(5, widthPx * 0.03, heightPx * 0.03);
  const scale = Math.min(
    (widthPx - 2 * padding) / 220,
    (heightPx - 2 * padding) / 136,
  );
  return {
    scale,
    left: (widthPx - 220 * scale) / 2,
    top: (heightPx - 136 * scale) / 2,
  };
}

/** A safe inset border and complete promo hierarchy, shared by preview/print. */
export function promoContentGeometry(
  width: number,
  height: number,
  includeLogo: boolean,
) {
  const pxPerMm = 96 / 25.4;
  const inset = Math.min(5, width / 10, height / 10);
  const border = Math.min(1.5, width / 20, height / 20);
  const padding = Math.min(4, width / 20, height / 20);
  const contentWidth = (width - 2 * (inset + border + padding)) * pxPerMm;
  const contentHeight =
    Math.max(
      0.1,
      height - 2 * (inset + border + padding) - (includeLogo ? 9 : 0),
    ) * pxPerMm;
  const scale = Math.min(contentWidth / 650, contentHeight / 420);
  return {
    inset,
    border,
    frameWidth: width - 2 * inset,
    frameHeight: height - 2 * inset,
    scale,
    left:
      (inset + border + padding) * pxPerMm + (contentWidth - 650 * scale) / 2,
    top:
      (inset + border + padding) * pxPerMm + (contentHeight - 420 * scale) / 2,
  };
}
