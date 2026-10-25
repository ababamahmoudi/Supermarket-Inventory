import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, initialState } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { useProtectedQuery } from "../use-protected-query";
import { purchaseInvoiceView } from "../invoice-projections";
import { PostedInvoice } from "./PostedInvoice";
import { installMissingInvoiceImageDecoder } from "../invoice-ui-image-test-platform";
import i18n from "../i18n";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  installMissingInvoiceImageDecoder();
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#invoices";
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

function Harness({ id, company }: { id: string; company: string }) {
  const read = useProtectedQuery(
    "invoices.cost_read",
    { company_id: company, kind: "company_shared", entity_id: id },
    (canonical, actor) => purchaseInvoiceView(canonical, actor, id),
    id,
  );
  return read.data ? (
    <PostedInvoice
      original={read.data}
      invoice={read.data}
      versionId="original"
    />
  ) : null;
}
async function open(tracked = false) {
  const state = initialState();
  const invoice = state.invoices!.find((record) => record.status === "posted")!;
  invoice.import_warnings = [
    "No ship-to address is printed; used bill-to for branch_hint.",
    "Sub Total is Tax Inclusive with no separate tax amount printed.",
  ];
  invoice.import_handwritten_notes = ["Oct 6, 2026 11:35 AM"];
  invoice.lines.forEach((line) => {
    line.date_tracking = false;
    line.date_value = "";
    line.supplier_item_code =
      line.new_name_en ||
      state.products.find((product) => product.code === line.product_code)
        ?.name_en ||
      line.description;
  });
  if (tracked) {
    invoice.lines[0].date_tracking = true;
    invoice.lines[0].date_value = "2026-12-03";
  }
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "all_locations" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Harness id={invoice.id} company={invoice.company_id} />
    </DemoProvider>,
  );
  await screen.findByRole("button", { name: "Correct invoice" });
  return invoice;
}

it("places permissioned actions in the header and shows collapsed human reading notes, clean rows and four-decimal costs", async () => {
  const user = userEvent.setup();
  const invoice = await open();
  const correct = screen.getByRole("button", {
    name: "Correct invoice",
  });
  expect(correct.closest("header")).not.toBeNull();
  expect(
    screen.getByRole("button", { name: "Move invoice" }).closest("header"),
  ).not.toBeNull();
  expect(screen.getByRole("link", { name: invoice.supplier })).toHaveAttribute(
    "href",
    `#suppliers?name=${encodeURIComponent(invoice.supplier)}`,
  );
  const disclosure = screen
    .getByText("Reading notes (2)", { exact: true })
    .closest("details")!;
  expect(disclosure).not.toHaveAttribute("open");
  await user.click(
    within(disclosure).getByText("Reading notes (2)", { exact: true }),
  );
  expect(disclosure).toHaveAttribute("open");
  expect(disclosure).not.toHaveTextContent("branch_hint");
  expect(disclosure).toHaveTextContent(
    "the location came from the bill-to address",
  );
  expect(
    screen.getByText("Handwritten on the invoice", { exact: true }),
  ).toBeVisible();
  const table = document.querySelector(".posted-invoice-lines")!;
  expect(
    within(table as HTMLElement).queryByRole("columnheader", {
      name: "Tracked date",
    }),
  ).toBeNull();
  expect(table.querySelectorAll(".receiving-cost-cell")).toHaveLength(
    invoice.lines.length,
  );
  for (const cell of table.querySelectorAll(".receiving-cost-cell"))
    expect(cell.textContent).toMatch(/\d\.\d{4}(?:\/\w+)?$/);
  for (let index = 0; index < invoice.lines.length; index++)
    expect(
      table.querySelectorAll(".receiving-product-meta")[index],
    ).not.toHaveTextContent(invoice.lines[index].supplier_item_code!);
  expect(
    document.querySelectorAll(".posted-invoice-totals > div"),
  ).toHaveLength(5);
});

it("includes the tracked-date column only when at least one retained line has a real date", async () => {
  await open(true);
  expect(
    screen.getByRole("columnheader", { name: "Tracked date" }),
  ).toBeInTheDocument();
  expect(document.querySelector(".posted-tracked-cell")).toHaveTextContent(
    "2026-12-03",
  );
});
