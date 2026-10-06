import { describe, expect, it } from "vitest";
import { labelLayout, labelPages } from "./labels";
import type { LabelTemplate } from "./types";
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
