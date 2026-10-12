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

it("honors opt-in fixed outer widths and keeps omitted fields available without changing column preferences", () => {
  const configured = [
    {
      key: "selection",
      label: "Select",
      width: 48,
      fixedWidth: true,
      required: true,
    },
    {
      key: "product",
      label: "Product",
      minWidth: 180,
      required: true,
      priority: 1,
    },
    { key: "code", label: "Code", width: 104, fixedWidth: true, priority: 3 },
    { key: "offer", label: "Offer", width: 150, fixedWidth: true, priority: 4 },
    { key: "price", label: "Price", width: 156, fixedWidth: true, priority: 2 },
  ];
  const before = structuredClone(configured);
  const full = allocateTableColumns(configured, 724, false);
  expect(full.minimums).toEqual([48, 180, 104, 150, 156]);
  expect(full.visible).toEqual([0, 1, 2, 3, 4]);
  expect(full.collapsed).toEqual([]);
  const narrow = allocateTableColumns(configured, 460, false);
  expect(narrow.visible).toEqual([0, 1, 4]);
  expect(narrow.collapsed).toEqual([2, 3]);
  expect(configured).toEqual(before);
  // A numeric width alone remains the old flexible hint.
  expect(
    allocateTableColumns([{ key: "selection", width: 48 }], 724, false)
      .minimums,
  ).toEqual([180]);
});
