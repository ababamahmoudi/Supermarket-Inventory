import type { LabelTemplate } from "./types";

export interface LabelLayout {
  columns: number;
  rows: number;
  capacity: number;
}
export function labelLayout(template: LabelTemplate): LabelLayout {
  const values = [
    template.width,
    template.height,
    template.margin_top,
    template.margin_bottom,
    template.margin_left,
    template.margin_right,
    template.gap_x,
    template.gap_y,
  ];
  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    template.width <= 0 ||
    template.height <= 0
  ) {
    throw new Error("dimensions");
  }
  const columns = Math.floor(
    (210 - template.margin_left - template.margin_right + template.gap_x) /
      (template.width + template.gap_x),
  );
  const rows = Math.floor(
    (297 - template.margin_top - template.margin_bottom + template.gap_y) /
      (template.height + template.gap_y),
  );
  if (columns < 1 || rows < 1) throw new Error("fit");
  return { columns, rows, capacity: columns * rows };
}

export function labelPages<T>(
  items: T[],
  template: LabelTemplate,
  startSlot: number,
): (T | null)[][] {
  const { capacity } = labelLayout(template);
  if (!Number.isInteger(startSlot) || startSlot < 1 || startSlot > capacity)
    throw new Error("slot");
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
