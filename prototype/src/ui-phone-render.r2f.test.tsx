import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import {
  AuthenticatedUiProvider,
  renderAuthenticatedUI,
  prepareSharedUiFixture,
  disposeSharedUiFixture,
} from "./shared-ui-provider-test-fixture";
import { DataTable, TableRowLink } from "./ui";
beforeEach(async () => {
  await prepareSharedUiFixture();
  vi.stubGlobal("innerWidth", 390);
});
afterEach(() => disposeSharedUiFixture());
it("R2f custom phone composition exposes declared permitted cells and only the permitted genuine record link", async () => {
  await renderAuthenticatedUI(
    <AuthenticatedUiProvider>
      <DataTable
        recordDetails
        columns={[
          { key: "name" },
          { key: "private", hidden: true },
          { key: "actions" },
        ]}
        phoneList={{
          name: "name",
          value: "private",
          secondary: [],
          render: ({ cell, recordLink }) => (
            <>
              <td>
                {cell("name")}
                {cell("private")}
                {cell("undeclared")}
                {cell("actions")}
              </td>
              <td>{recordLink}</td>
            </>
          ),
        }}
      >
        <thead>
          <tr>
            <th>Name</th>
            <th>Private cost</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr data-row-href="#return?id=visible">
            <td>Visible return</td>
            <td>
              PRIVATE-987.65
              <TableRowLink
                href="#private-invoice"
                aria-label="Private invoice"
              />
            </td>
            <td>
              <span>View return</span>
              <TableRowLink
                href="#return?id=visible"
                aria-label="Open visible return"
              />
            </td>
          </tr>
        </tbody>
      </DataTable>
    </AuthenticatedUiProvider>,
  );
  expect(screen.getByText("Visible return")).toBeVisible();
  expect(screen.queryByText("PRIVATE-987.65")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Private invoice" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("link", { name: "Open visible return" }),
  ).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "Open visible return" }),
  ).toHaveAttribute("href", "#return?id=visible");
});
