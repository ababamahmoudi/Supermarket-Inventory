import type { LabelTemplate } from "./types";

export interface LabelLayout {
  columns: number;
  rows: number;
  capacity: number;
}
export class LabelLayoutError extends Error {
  constructor(
    readonly code: "dimensions" | "fit" | "slot",
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
  return { columns, rows, capacity: columns * rows };
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
