import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import i18n from "./i18n";
import { DemoProvider, useDemo } from "./store";
import { Offers } from "./screens/Offers";
import { effectivePrice, regularPrice } from "./catalog";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "offers";
  await i18n.changeLanguage("en");
});
function Harness() {
  const { state, switchDemoUser, branch } = useDemo();
  return (
    <>
      <button onClick={() => switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button onClick={() => switchDemoUser("floorworker")}>Use Worker</button>
      <Offers />
      <output data-testid="records">
        {JSON.stringify({
          sales: state.sales,
          requests: state.sale_requests,
          offers: state.offers,
          prices: state.products.map((product) => ({
            code: product.code,
            regular: regularPrice(state, product, branch),
            charged: effectivePrice(state, product, branch),
          })),
        })}
      </output>
      <output data-testid="financial-evidence">
        {JSON.stringify({
          invoice: state.invoice,
          invoices: state.invoices,
          stock: state.stock,
          ledger: state.ledger,
          returns: state.returns,
        })}
      </output>
    </>
  );
}
async function show(worker = false) {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", {
      name: worker ? "Use Worker" : "Use Supervisor",
    }),
  );
  return user;
}
const records = () =>
  JSON.parse(screen.getByTestId("records").textContent ?? "{}");
const row = (code: string, kind: "sale" | "request") =>
  document.querySelector<HTMLElement>(
    `tr[data-product-code="${code}"][data-offer-kind="${kind}"]`,
  )!;

it("creates a sale for a price outside the multi-buy mapping through the actual Offers dialog without touching regular price or financial evidence", async () => {
  const user = await show();
  const evidence = screen.getByTestId("financial-evidence").textContent;
  await user.click(screen.getByRole("button", { name: "Create offer" }));
  const picker = screen.getByRole("dialog", { name: "Create offer" });
  await user.click(
    within(picker).getByRole("combobox", { name: "Offer type" }),
  );
  await user.click(screen.getByRole("option", { name: "Sale price" }));
  expect(
    within(picker).queryByRole("combobox", { name: "Offer scope" }),
  ).not.toBeInTheDocument();
  await user.click(within(picker).getByRole("combobox", { name: "Product" }));
  await user.click(screen.getByRole("option", { name: /Rice Cooker 1.8 L/ }));
  await user.click(within(picker).getByRole("button", { name: "Continue" }));
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  await user.type(
    within(dialog).getByRole("textbox", { name: "Price" }),
    "49.99",
  );
  await user.click(within(dialog).getByRole("button", { name: "Start sale" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const saved = records();
  expect(
    saved.sales.filter(
      (sale: { product_code: string }) => sale.product_code === "0013",
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ branch: "Branch 1", sale_price: "49.99" }),
      expect.objectContaining({ branch: "Branch 2", sale_price: "49.99" }),
      expect.objectContaining({ branch: "Branch 3", sale_price: "49.99" }),
    ]),
  );
  expect(
    saved.sales.filter(
      (sale: { product_code: string }) => sale.product_code === "0013",
    ),
  ).toHaveLength(3);
  expect(
    saved.prices.find((product: { code: string }) => product.code === "0013"),
  ).toMatchObject({ regular: "52.49", charged: "49.99" });
  expect(row("0013", "sale")).toHaveTextContent("49.99");
  expect(screen.getByTestId("financial-evidence").textContent).toBe(evidence);
});

it("keeps the current sale until the end confirmation is accepted, then restores the regular charge and retains the sale in Past offers", async () => {
  const user = await show();
  const before = screen.getByTestId("records").textContent;
  const evidence = screen.getByTestId("financial-evidence").textContent;
  const saleRow = row("0012", "sale");
  expect(saleRow).toHaveTextContent("16.99");
  expect(saleRow.querySelector("del")).toHaveTextContent("20.99");
  await user.click(within(saleRow).getByRole("button", { name: "More" }));
  await user.click(screen.getByRole("menuitem", { name: /^End sale now/ }));
  let dialog = screen.getByRole("dialog", { name: "End sale now" });
  expect(dialog).toHaveTextContent("20.99");
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByTestId("records").textContent).toBe(before);
  await user.click(
    within(row("0012", "sale")).getByRole("button", { name: "More" }),
  );
  await user.click(screen.getByRole("menuitem", { name: /^End sale now/ }));
  dialog = screen.getByRole("dialog", { name: "End sale now" });
  await user.click(
    within(dialog).getByRole("button", { name: "End sale now" }),
  );
  expect(
    records().sales.find(
      (sale: { product_code: string }) => sale.product_code === "0012",
    ),
  ).toMatchObject({ status: "ended" });
  expect(
    records().prices.find(
      (product: { code: string }) => product.code === "0012",
    ),
  ).toMatchObject({ regular: "20.99", charged: "20.99" });
  expect(row("0012", "sale")).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Past offers" }));
  expect(row("0012", "sale")).toHaveTextContent("Ended");
  expect(screen.getByTestId("financial-evidence").textContent).toBe(evidence);
});

it("lets the requester edit the pending sale through the same request dialog while keeping the approved charge unchanged and private money absent", async () => {
  const user = await show(true);
  const original = records().requests.find(
    (request: { product_code: string }) => request.product_code === "0008",
  );
  const requestRow = row("0008", "request");
  expect(requestRow).toHaveTextContent("Requested");
  expect(requestRow).toHaveTextContent("9.49");
  expect(requestRow).toHaveTextContent("7.99");
  await user.click(within(requestRow).getByRole("button", { name: "More" }));
  await user.click(screen.getByRole("menuitem", { name: "Change request" }));
  const dialog = screen.getByRole("dialog", { name: "Request a sale" });
  expect(
    within(dialog).queryByText(/Margin at|below cost|minimum margin/),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).queryByRole("radio", { name: /^New regular price/ }),
  ).not.toBeInTheDocument();
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.clear(price);
  await user.type(price, "7.49");
  await user.click(
    within(dialog).getByRole("button", { name: "Send request" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    records().requests.find(
      (request: { id: string }) => request.id === original.id,
    ),
  ).toMatchObject({
    status: "pending",
    requested_price: "7.49",
    revision: original.revision + 1,
  });
  expect(
    records().prices.find(
      (product: { code: string }) => product.code === "0008",
    ),
  ).toMatchObject({ regular: "9.49", charged: "9.49" });
});

it("requires a confirmation to withdraw one's request and leaves the approved customer price and financial evidence untouched", async () => {
  const user = await show(true);
  const before = screen.getByTestId("records").textContent;
  const evidence = screen.getByTestId("financial-evidence").textContent;
  await user.click(
    within(row("0008", "request")).getByRole("button", { name: "More" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Withdraw request" }));
  let dialog = screen.getByRole("dialog", { name: "Withdraw request" });
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByTestId("records").textContent).toBe(before);
  await user.click(
    within(row("0008", "request")).getByRole("button", { name: "More" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Withdraw request" }));
  dialog = screen.getByRole("dialog", { name: "Withdraw request" });
  await user.click(
    within(dialog).getByRole("button", { name: "Withdraw request" }),
  );
  expect(
    records().requests.find(
      (request: { product_code: string }) => request.product_code === "0008",
    ),
  ).toMatchObject({ status: "withdrawn" });
  expect(row("0008", "request")).toBeNull();
  expect(
    records().prices.find(
      (product: { code: string }) => product.code === "0008",
    ),
  ).toMatchObject({ regular: "9.49", charged: "9.49" });
  expect(screen.getByTestId("financial-evidence").textContent).toBe(evidence);
});

it("opens a sale record by clicking the product row, and filters requests independently from other current sales", async () => {
  const user = await show();
  await user.click(
    within(row("0012", "sale")).getByText("Stainless Steel Pot 24 cm"),
  );
  const dialog = screen.getByRole("dialog", { name: "Offer" });
  expect(dialog).toHaveTextContent("Created by");
  expect(dialog).toHaveTextContent("16.99");
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  await user.click(screen.getByRole("combobox", { name: "Offer status" }));
  await user.click(screen.getByRole("option", { name: "Requested" }));
  expect(row("0012", "sale")).toBeNull();
  expect(row("0008", "request")).toHaveTextContent("Sale requested");
});

it("pauses a retained multi-buy at the sale store, removes it from that pool, and restores that same record after a confirmed end", async () => {
  const user = await show();
  const priorOffers = records().offers.filter(
    (offer: { product_code: string }) => offer.product_code === "0003",
  );
  expect(
    priorOffers.some((offer: { status: string }) => offer.status === "active"),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Create offer" }));
  const picker = screen.getByRole("dialog", { name: "Create offer" });
  await user.click(
    within(picker).getByRole("combobox", { name: "Offer type" }),
  );
  await user.click(screen.getByRole("option", { name: "Sale price" }));
  await user.click(within(picker).getByRole("combobox", { name: "Product" }));
  await user.click(
    screen.getByRole("option", { name: /Sour Cherry Juice 1 L/ }),
  );
  await user.click(within(picker).getByRole("button", { name: "Continue" }));
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  await user.type(
    within(dialog).getByRole("textbox", { name: "Price" }),
    "2.89",
  );
  await user.click(within(dialog).getByRole("button", { name: "Start sale" }));
  const multiBuyRow = document.querySelector<HTMLElement>(
    'tr[data-product-code="0003"]:not([data-offer-kind])',
  )!;
  expect(multiBuyRow).toHaveTextContent("Paused during sale");
  expect(
    records().offers.filter(
      (offer: { product_code: string }) => offer.product_code === "0003",
    ),
  ).toEqual(priorOffers);
  await user.click(screen.getByRole("tab", { name: "Mix-and-match pools" }));
  expect(screen.queryByText("0003")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Current offers" }));
  await user.click(
    within(row("0003", "sale")).getByRole("button", { name: "More" }),
  );
  await user.click(screen.getByRole("menuitem", { name: /^End sale now/ }));
  await user.click(
    within(screen.getByRole("dialog", { name: "End sale now" })).getByRole(
      "button",
      { name: "End sale now" },
    ),
  );
  expect(
    records().offers.filter(
      (offer: { product_code: string }) => offer.product_code === "0003",
    ),
  ).toEqual(priorOffers);
  await user.click(screen.getByRole("tab", { name: "Mix-and-match pools" }));
  expect(screen.getByText("0003").closest("tr")).toHaveTextContent(
    "Sour Cherry Juice 1 L",
  );
});
