import {
  AuthenticatedUiProvider as DemoProvider,
  renderAuthenticatedUI as render,
  prepareSharedUiFixture,
  disposeSharedUiFixture,
  waitForSharedUiActor,
  sharedUiSessionId,
} from "./shared-ui-provider-test-fixture";
import postcss from "postcss";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import i18n from "./i18n";
import { useDemo } from "./store";
import {
  Button,
  ConfirmDialog,
  DataTable,
  FilterToolbar,
  useTableColumns,
} from "./ui";
import {
  defaultHiddenColumns,
  readTableColumns,
  resetTableColumns,
  saveTableColumns,
  tablePreferenceKey,
  type TableColumnDefinition,
} from "./c3-column-preferences";
const columns: TableColumnDefinition[] = [
  { key: "name", label: "Product", required: true, width: 200 },
  { key: "price", label: "Selling price", align: "end", width: 100 },
  { key: "supplier", label: "Supplier", defaultVisible: false, width: 150 },
  { key: "actions", label: "Actions", actions: true, width: 100 },
];
const scope = { company: "company-one", user: "ali", table: "products" };
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
describe("scoped table presentation preferences", () => {
  it("remembers optional columns without hiding the identifying name or exposing stale columns", () => {
    expect(defaultHiddenColumns(columns)).toEqual(["supplier"]);
    saveTableColumns(localStorage, scope, columns, [
      "name",
      "price",
      "foreign-company-balance",
    ]);
    expect(readTableColumns(localStorage, scope, columns)).toEqual(["price"]);
    expect(
      readTableColumns(localStorage, { ...scope, user: "sara" }, columns),
    ).toEqual(["supplier"]);
    expect(
      readTableColumns(localStorage, { ...scope, company: "two" }, columns),
    ).toEqual(["supplier"]);
    expect(
      readTableColumns(localStorage, { ...scope, table: "suppliers" }, columns),
    ).toEqual(["supplier"]);
    resetTableColumns(localStorage, scope);
    expect(readTableColumns(localStorage, scope, columns)).toEqual([
      "supplier",
    ]);
  });
  it("does not accept tampered identifying-column preferences or fail on blocked storage", () => {
    localStorage.setItem(
      tablePreferenceKey(scope),
      JSON.stringify({ version: 1, hidden: ["name", "price"] }),
    );
    expect(readTableColumns(localStorage, scope, columns)).toEqual(["price"]);
    localStorage.setItem(tablePreferenceKey(scope), "not-json");
    expect(readTableColumns(localStorage, scope, columns)).toEqual([
      "supplier",
    ]);
    const blocked = {
      getItem: () => {
        throw new Error("Storage denied");
      },
      setItem: () => {
        throw new Error("Storage denied");
      },
      removeItem: () => {
        throw new Error("Storage denied");
      },
    };
    expect(readTableColumns(blocked, scope, columns)).toEqual(["supplier"]);
    expect(() =>
      saveTableColumns(blocked, scope, columns, ["price"]),
    ).not.toThrow();
    expect(() => resetTableColumns(blocked, scope)).not.toThrow();
    expect(tablePreferenceKey({ ...scope, user: "a:b" })).not.toBe(
      tablePreferenceKey({ ...scope, company: "company-one:a", user: "b" }),
    );
  });
});
function ProductsTable() {
  const table = useTableColumns("products", columns);
  const { switchDemoUser, demoUsers } = useDemo();
  const switchTo = (role: "manager" | "floor_worker") => {
    const user = demoUsers.find((person) => person.role === role);
    if (!user) throw new Error("Configured demo person is not ready");
    return switchDemoUser(user.username);
  };
  return (
    <>
      <Button onClick={() => switchTo("manager")}>Supervisor account</Button>
      <Button onClick={() => switchTo("floor_worker")}>Worker account</Button>
      <FilterToolbar
        search={
          <input
            aria-label="Search products"
            placeholder="Search name or Product Code"
          />
        }
      >
        {table.chooser}
      </FilterToolbar>
      <DataTable columns={table.columns}>
        <thead>
          <tr>
            <th>Product</th>
            <>
              <th>Selling price</th>
              <th>Supplier</th>
            </>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Milk</td>
            <>
              <td>$4.99</td>
              <td>Fictional supplier</td>
            </>
            <td>
              <Button variant="secondary">View</Button>
            </td>
          </tr>
          <tr>
            <td colSpan={4}>No more products</td>
          </tr>
        </tbody>
      </DataTable>
    </>
  );
}
describe("styled Columns chooser", () => {
  it("keeps header, body, column group and spanning rows synchronized, persists and resets", async () => {
    const user = userEvent.setup();
    const view = await render(
      <DemoProvider>
        <ProductsTable />
      </DemoProvider>,
    );
    const sessionBeforeSwitch1 = sharedUiSessionId();
    await user.click(
      screen.getByRole("button", { name: "Supervisor account" }),
    );
    await waitForSharedUiActor("manager", undefined, sessionBeforeSwitch1);
    await user.click(screen.getByRole("button", { name: "Columns" }));
    const dialog = screen.getByRole("dialog", { name: "Columns" });
    expect(
      within(dialog).getByRole("checkbox", { name: "Product" }),
    ).toBeDisabled();
    expect(
      view.container.querySelector('input[type="checkbox"], select'),
    ).toBeNull();
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Selling price" }),
    );
    expect(
      screen.queryByRole("columnheader", { name: "Selling price" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("$4.99")).not.toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[0].children).toHaveLength(2);
    expect(rows[1].children).toHaveLength(2);
    expect(view.container.querySelectorAll("col")).toHaveLength(2);
    expect(screen.getByText("No more products")).toHaveAttribute(
      "colspan",
      "2",
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Columns" })).toHaveFocus();
    view.unmount();
    await render(
      <DemoProvider>
        <ProductsTable />
      </DemoProvider>,
    );
    expect(
      screen.queryByRole("columnheader", { name: "Selling price" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("button", { name: "Reset columns" }));
    expect(
      screen.getByRole("columnheader", { name: "Selling price" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "Supplier" }),
    ).not.toBeInTheDocument();
  });
  it("changes users without copying another account's hidden columns", async () => {
    const user = userEvent.setup();
    await render(
      <DemoProvider>
        <ProductsTable />
      </DemoProvider>,
    );
    const sessionBeforeSwitch2 = sharedUiSessionId();
    await user.click(
      screen.getByRole("button", { name: "Supervisor account" }),
    );
    await waitForSharedUiActor("manager", undefined, sessionBeforeSwitch2);
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("checkbox", { name: "Selling price" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    const sessionBeforeSwitch3 = sharedUiSessionId();
    await user.click(screen.getByRole("button", { name: "Worker account" }));
    await waitForSharedUiActor("floor_worker", undefined, sessionBeforeSwitch3);
    expect(
      screen.getByRole("columnheader", { name: "Selling price" }),
    ).toBeVisible();
    const sessionBeforeSwitch4 = sharedUiSessionId();
    await user.click(
      screen.getByRole("button", { name: "Supervisor account" }),
    );
    await waitForSharedUiActor("manager", undefined, sessionBeforeSwitch4);
    expect(
      screen.queryByRole("columnheader", { name: "Selling price" }),
    ).not.toBeInTheDocument();
  });
});
it("uses an explicit Danger confirmation and respects its blocked action", async () => {
  const user = userEvent.setup();
  const confirm = vi.fn();
  await render(
    <DemoProvider>
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Reject approval"
        description="Review the rejection."
        confirmLabel="Reject"
        confirmVariant="danger"
        confirmDisabled
        onConfirm={confirm}
      />
    </DemoProvider>,
  );
  const button = screen.getByRole("button", { name: "Reject" });
  expect(button).toHaveClass("button-danger");
  expect(button).toBeDisabled();
  await user.click(button);
  expect(confirm).not.toHaveBeenCalled();
});
function contrast(first: string, second: string): number {
  const luminance = (hex: string) => {
    const values = [1, 3, 5].map(
      (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
    );
    return values.reduce(
      (total, channel, index) =>
        total +
        [0.2126, 0.7152, 0.0722][index] *
          (channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4),
      0,
    );
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
it("keeps Klead neutral and tinted actions readable in both themes", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/klead-tokens.css"),
    "utf8",
  );
  const sheets = postcss.parse(css);
  for (const dark of [false, true]) {
    const vars: Record<string, string> = {};
    sheets.walkRules((rule) => {
      if (
        rule.selector === ":root" ||
        (dark && rule.selector === ':root[data-theme="dark"]')
      )
        rule.walkDecls((declaration) => {
          if (declaration.prop.startsWith("--"))
            vars[declaration.prop] = declaration.value;
        });
    });
    const resolveToken = (name: string): string => {
      const value = vars[name];
      if (!value) throw new Error(`Missing token ${name}`);
      const reference = value.match(/^var\((--[\w-]+)(?:,\s*(.*))?\)$/);
      if (!reference) return value;
      return vars[reference[1]]
        ? resolveToken(reference[1])
        : (reference[2] ?? value);
    };
    const neutralFill = resolveToken("--secondary-fill");
    const neutralText = resolveToken("--secondary-text");
    expect(contrast(neutralText, neutralFill)).toBeGreaterThanOrEqual(4.5);
    const tint = resolveToken("--accent-soft");
    let tintSurface = tint;
    if (tint.startsWith("rgba")) {
      const [r, g, b, alpha] = tint.match(/[\d.]+/g)!.map(Number);
      const base = resolveToken("--surface");
      const channels = [r, g, b].map((channel, index) =>
        Math.round(
          channel * alpha +
            parseInt(base.slice(1 + index * 2, 3 + index * 2), 16) *
              (1 - alpha),
        ),
      );
      tintSurface =
        "#" +
        channels
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join("");
    }
    expect(
      contrast(resolveToken("--accent-tint-text"), tintSurface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        resolveToken("--disabled-text"),
        resolveToken("--disabled-fill"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
beforeEach(async () => {
  await prepareSharedUiFixture();
});
afterEach(() => {
  disposeSharedUiFixture();
});
