import { describe, expect, it } from "vitest";
import {
  allocateTableColumns,
  tableResponsiveDefinition,
} from "./c6-table-layout";
const columns = [
  {
    key: "reference",
    label: "Return #",
    required: true,
    minWidth: 120,
    priority: 1,
  },
  { key: "supplier", label: "Supplier", minWidth: 180, priority: 3 },
  { key: "status", label: "Status", minWidth: 160, priority: 2 },
  { key: "location", label: "Location", minWidth: 144, priority: 5 },
  { key: "date", label: "Created", minWidth: 140, priority: 4 },
];
describe("responsive column priorities", () => {
  it("keeps essential identity and the highest priorities within the real width budget", () => {
    const result = allocateTableColumns(columns, 530, false);
    expect(result.visible).toEqual([0, 1, 2]);
    expect(result.collapsed).toEqual([3, 4]);
    expect(
      result.visible.reduce((sum, index) => sum + result.minimums[index], 0),
    ).toBeLessThanOrEqual(530 - 36);
  });
  it("does not mutate saved choices while width-hiding columns", () => {
    const configured = columns.map((column, index) => ({
      ...column,
      hidden: index === 1,
    }));
    const before = structuredClone(configured);
    expect(allocateTableColumns(configured, 350, false).visible).toEqual([
      0, 2,
    ]);
    expect(configured).toEqual(before);
    expect(allocateTableColumns(configured, 1200, false).visible).toEqual([
      0, 2, 3, 4,
    ]);
  });
  it("provides hidden authorized values for expanded details and primary values on cards", () => {
    const result = allocateTableColumns(columns, 358, true);
    expect(result.visible).toEqual([0, 1, 2]);
    expect(result.collapsed).toEqual([3, 4]);
    expect([...result.visible, ...result.collapsed].sort()).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });
  it("honors measured whole-word minima, explicit priorities, and mandatory columns", () => {
    const result = allocateTableColumns(columns, 400, false, [120, 230, 200]);
    expect(result.visible).toEqual([0, 2]);
    expect(result.minimums[2]).toBe(200);
  });
  it("keeps each table's declared defaults while accepting explicit domain priorities", () => {
    expect(
      tableResponsiveDefinition("expiry", { key: "date", label: "Expiry" }, 1)
        .priority,
    ).toBe(2);
    expect(
      tableResponsiveDefinition(
        "products",
        { key: "cost", label: "Cost", priority: 4 },
        4,
      ).priority,
    ).toBe(4);
  });
});
