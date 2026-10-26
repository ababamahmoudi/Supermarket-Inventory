export interface PopoverRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
export interface PopoverViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  layoutHeight: number;
}

export interface BoundedPopoverPosition {
  position: "fixed";
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/** Geometry only: fixed popups stay in the visible viewport and above an overlapping Undo. */
export function boundedPopoverPosition(
  trigger: PopoverRect,
  viewport: PopoverViewport,
  options: { minWidth: number; rtl: boolean; obstruction?: PopoverRect },
): BoundedPopoverPosition {
  const minLeft = viewport.left + Math.min(12, viewport.width / 2);
  const maxRight =
    viewport.left + viewport.width - Math.min(12, viewport.width / 2);
  const topLimit = viewport.top + Math.min(16, viewport.height / 2);
  const width = Math.min(
    Math.max(trigger.width, options.minWidth),
    Math.max(0, maxRight - minLeft),
  );
  const left = Math.max(
    minLeft,
    Math.min(
      options.rtl ? trigger.right - width : trigger.left,
      maxRight - width,
    ),
  );
  const obstruction = options.obstruction;
  const overlaps =
    obstruction &&
    obstruction.width > 0 &&
    obstruction.height > 0 &&
    obstruction.right > left &&
    obstruction.left < left + width;
  const bottomLimit = Math.max(
    topLimit,
    Math.min(
      viewport.top + viewport.height - Math.min(16, viewport.height / 2),
      overlaps ? obstruction.top - 8 : Number.POSITIVE_INFINITY,
    ),
  );
  const belowTop = Math.max(
    topLimit,
    Math.min(trigger.bottom + 8, bottomLimit),
  );
  const aboveBottom = Math.max(
    topLimit,
    Math.min(trigger.top - 8, bottomLimit),
  );
  const below = Math.max(0, bottomLimit - belowTop);
  const above = Math.max(0, aboveBottom - topLimit);
  const opensAbove = below < 240 && above > below;
  return {
    position: "fixed" as const,
    left,
    width,
    ...(opensAbove
      ? { bottom: viewport.layoutHeight - aboveBottom }
      : { top: belowTop }),
    maxHeight: opensAbove ? above : below,
  };
}
