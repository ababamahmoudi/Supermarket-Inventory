import { describe, expect, it } from "vitest";
import {
  labelContentGeometry,
  LabelLayoutError,
  labelLayout,
  labelPages,
  ensureBuiltInLabelTemplates,
  labelSlotGeometry,
  promoContentGeometry,
} from "./labels";
import type { LabelTemplate } from "./types";
import { initialState } from "./store";
const template: LabelTemplate = {
  id: "test",
  company_id: "demo",
  name: "Template 1",
  width: 60,
  height: 40,
  margin_top: 10,
  margin_bottom: 10,
  margin_left: 10,
  margin_right: 10,
  gap_x: 4,
  gap_y: 4,
};
describe("A4 labels", () => {
  it("fits exact millimetre bounds including gaps", () => {
    expect(labelLayout(template)).toEqual({
      columns: 3,
      rows: 6,
      capacity: 18,
    });
  });
  it("leaves the first four used slots empty and carries remaining labels onto a new page", () => {
    const pages = labelPages(
      Array.from({ length: 20 }, (_, i) => i),
      template,
      5,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0].slice(0, 5)).toEqual([null, null, null, null, 0]);
    expect(pages.flat().filter((x) => x !== null)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
  });
  it("rejects invalid dimensions and slots without printing off-sheet", () => {
    expect(() => labelLayout({ ...template, width: 220 })).toThrow("fit");
    expect(() => labelLayout({ ...template, gap_x: -1 })).toThrow("dimensions");
    expect(() => labelPages([1], template, 19)).toThrow("slot");
    expect(() => labelPages([1], template, 0)).toThrow("slot");
  });
  it("keeps every requested copy when a product repeats across page boundaries", () => {
    const products = ["0003", "0003", "0005", "0005", "0009", "0009"];
    const pages = labelPages(products, template, 17);
    expect(pages).toHaveLength(2);
    expect(pages[0].slice(16)).toEqual(["0003", "0003"]);
    expect(pages.flat().filter((product) => product !== null)).toEqual(
      products,
    );
    expect(pages[1]).toEqual(["0005", "0005", "0009", "0009"]);
  });
});

describe("Label content bounds", () => {
  it.each([
    [60, 40],
    [10, 6],
    [200, 2],
    [1, 200],
    [0.001, 0.001],
  ])("keeps the complete hierarchy inside %s × %s mm", (width, height) => {
    const content = labelContentGeometry(width, height);
    expect(content.scale).toBeGreaterThan(0);
    expect(content.left).toBeGreaterThanOrEqual(0);
    expect(content.top).toBeGreaterThanOrEqual(0);
    expect(content.left + 220 * content.scale).toBeLessThanOrEqual(
      (width * 96) / 25.4,
    );
    expect(content.top + 136 * content.scale).toBeLessThanOrEqual(
      (height * 96) / 25.4,
    );
  });
  it("identifies the field causing invalid dimensions", () => {
    try {
      labelLayout({ ...template, height: 0 });
    } catch (error) {
      expect(error).toBeInstanceOf(LabelLayoutError);
      expect((error as LabelLayoutError).field).toBe("height");
    }
    try {
      labelLayout({ ...template, margin_left: -1 });
    } catch (error) {
      expect((error as LabelLayoutError).field).toBe("margin_left");
    }
  });
});

describe("company built-in Regular and Promo templates", () => {
  it("is additive and idempotent, retaining custom, edited, archived and foreign templates", () => {
    const state = initialState();
    ensureBuiltInLabelTemplates(state);
    const regular = state.templates.find(
      (item) => item.built_in === "regular",
    )!;
    const promo = state.templates.find((item) => item.built_in === "promo")!;
    regular.name = "My adjusted shelf sheet";
    regular.width = 61;
    promo.archived = true;
    state.templates.push({
      ...template,
      company_id: state.config.company.seed_key,
    });
    state.templates.push({
      ...promo,
      id: "foreign-promo",
      company_id: "another-company",
      width: 75,
    });
    const before = structuredClone(state.templates);
    ensureBuiltInLabelTemplates(state);
    expect(state.templates).toEqual(before);
    expect(state.templates).toHaveLength(4);
  });
  it("retains exact tested shelf size and half-A4 Promo geometry", () => {
    const state = initialState();
    ensureBuiltInLabelTemplates(state);
    const regular = state.templates.find(
      (item) => item.built_in === "regular",
    )!;
    const promo = state.templates.find((item) => item.built_in === "promo")!;
    expect(labelLayout(regular)).toEqual({ columns: 3, rows: 6, capacity: 18 });
    expect(labelSlotGeometry(regular, 0)).toEqual({
      left: 10,
      top: 10,
      width: 60,
      height: 40,
    });
    expect(labelSlotGeometry(regular, 17)).toEqual({
      left: 138,
      top: 230,
      width: 60,
      height: 40,
    });
    expect(labelLayout(promo)).toEqual({ columns: 1, rows: 2, capacity: 2 });
    expect(labelSlotGeometry(promo, 0)).toEqual({
      left: 0,
      top: 0,
      width: 210,
      height: 148.5,
    });
    expect(labelSlotGeometry(promo, 1)).toEqual({
      left: 0,
      top: 148.5,
      width: 210,
      height: 148.5,
    });
    expect(labelPages([1, 2, 3, 4, 5], promo, 1)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });
  it("keeps the thick black Promo border and complete content at least 5mm inside the print slot", () => {
    const content = promoContentGeometry(210, 148.5, true);
    const px = 96 / 25.4;
    expect(content.inset).toBe(5);
    expect(content.border).toBe(1.5);
    expect(content.frameWidth).toBe(200);
    expect(content.frameHeight).toBe(138.5);
    expect(content.left).toBeGreaterThanOrEqual(5 * px);
    expect(content.top).toBeGreaterThanOrEqual(5 * px);
    expect(content.left + 650 * content.scale).toBeLessThanOrEqual(205 * px);
    expect(content.top + 420 * content.scale).toBeLessThanOrEqual(143.5 * px);
  });
});
