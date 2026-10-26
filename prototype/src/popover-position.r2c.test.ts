import { describe, expect, it } from "vitest";
import {
  boundedPopoverPosition,
  type PopoverRect,
  type PopoverViewport,
} from "./popover-position";

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): PopoverRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const viewport: PopoverViewport = {
  left: 0,
  top: 0,
  width: 390,
  height: 600,
  layoutHeight: 600,
};

describe("R2c 2.3 bounded popover geometry", () => {
  for (const rtl of [false, true]) {
    for (const [name, trigger, visible] of [
      ["near the bottom", rect(290, 530, 88, 44), viewport],
      ["near the top", rect(2, 18, 180, 44), viewport],
      [
        "short viewport",
        rect(60, 65, 240, 44),
        { ...viewport, height: 160, layoutHeight: 160 },
      ],
      [
        "offset keyboard viewport",
        rect(180, 310, 200, 44),
        { left: 100, top: 200, width: 390, height: 240, layoutHeight: 900 },
      ],
      ["trigger above viewport", rect(60, -30, 240, 44), viewport],
      ["trigger below viewport", rect(60, 650, 240, 44), viewport],
    ] as const) {
      it(`${name} stays inside the viewport in ${rtl ? "RTL" : "LTR"}`, () => {
        const position = boundedPopoverPosition(trigger, visible, {
          minWidth: 224,
          rtl,
        });
        const height = Math.min(320, position.maxHeight);
        const top =
          position.top ?? visible.layoutHeight - position.bottom! - height;
        expect(position.left).toBeGreaterThanOrEqual(visible.left + 12);
        expect(position.left + position.width).toBeLessThanOrEqual(
          visible.left + visible.width - 12,
        );
        expect(top).toBeGreaterThanOrEqual(visible.top + 16);
        expect(top + height).toBeLessThanOrEqual(
          visible.top + visible.height - 16,
        );
        expect(position.maxHeight).toBeGreaterThanOrEqual(0);
      });
    }
  }
  it("flips above a bottom trigger and never forces an overflowing 120px minimum", () => {
    expect(
      boundedPopoverPosition(rect(30, 530, 200, 44), viewport, {
        minWidth: 224,
        rtl: false,
      }).bottom,
    ).toBeDefined();
    const position = boundedPopoverPosition(
      rect(30, 65, 200, 44),
      { ...viewport, height: 160, layoutHeight: 160 },
      { minWidth: 224, rtl: false },
    );
    expect(position.maxHeight).toBeLessThan(120);
  });
  it("keeps the last option above an overlapping Undo without reserving an unrelated toast", () => {
    const trigger = rect(30, 180, 250, 44),
      toast = rect(20, 450, 330, 70);
    const overlap = boundedPopoverPosition(trigger, viewport, {
      minWidth: 224,
      rtl: false,
      obstruction: toast,
    });
    expect((overlap.top ?? 0) + overlap.maxHeight).toBe(442);
    const otherSide = boundedPopoverPosition(trigger, viewport, {
      minWidth: 224,
      rtl: false,
      obstruction: rect(350, 450, 20, 70),
    });
    expect((otherSide.top ?? 0) + otherSide.maxHeight).toBe(584);
  });
});
