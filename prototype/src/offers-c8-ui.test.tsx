import {
  configure,
  getConfig,
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { DemoProvider, useDemo } from "./store";
import { Offers } from "./screens/Offers";
import { effectivePrice, regularPrice } from "./catalog";
import { initialState } from "./e1-bootstrap";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";

const previousAsyncTimeout = getConfig().asyncUtilTimeout;
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
afterEach(() => {
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
  configure({ asyncUtilTimeout: previousAsyncTimeout });
});
const financialEvidence = async () => {
  const state = await fixture.readCanonical();
  return JSON.stringify({
    invoice: state.invoice,
    invoices: state.invoices,
    stock: state.stock,
    ledger: state.ledger,
    returns: state.returns,
  });
};
beforeEach(async () => {
  configure({ asyncUtilTimeout: 3000 });
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "offers";
  await i18n.changeLanguage("en");
});
function Harness() {
  const { state, branch } = useDemo();
  return (
    <>
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
    </>
  );
}
async function show(worker = false) {
  const user = userEvent.setup();
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: worker ? "floor_worker" : "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  await screen.findByRole("button", { name: "Create offer" });
  return user;
}
const records = async () => {
  const state = await fixture.readCanonical();
  return {
    sales: state.sales ?? [],
    requests: state.sale_requests ?? [],
    offers: state.offers,
    prices: state.products.map((product) => ({
      code: product.code,
      regular: regularPrice(state, product, "Branch 1"),
      charged: effectivePrice(state, product, "Branch 1"),
    })),
  };
};
const row = (code: string, kind: "sale" | "request") =>
  document.querySelector<HTMLElement>(
    `tr[data-product-code="${code}"][data-offer-kind="${kind}"]`,
  )!;

it("creates a sale for a price outside the multi-buy mapping through the actual Offers dialog without touching regular price or financial evidence", async () => {
  const user = await show();
  const evidence = await financialEvidence();
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
  const startSale = within(dialog).getByRole("button", { name: "Start sale" });
  await waitFor(() => expect(startSale).toBeEnabled());
  await user.click(startSale);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const saved = await records();
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
  await waitFor(() => expect(row("0013", "sale")).toHaveTextContent("49.99"));
  expect(await financialEvidence()).toBe(evidence);
});

it("keeps the current sale until the end confirmation is accepted, then restores the regular charge and retains the sale in Past offers", async () => {
  const user = await show();
  const before = screen.getByTestId("records").textContent;
  const evidence = await financialEvidence();
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
    (await records()).sales.find(
      (sale: { product_code: string }) => sale.product_code === "0012",
    ),
  ).toMatchObject({ status: "ended" });
  expect(
    (await records()).prices.find(
      (product: { code: string }) => product.code === "0012",
    ),
  ).toMatchObject({ regular: "20.99", charged: "20.99" });
  await waitFor(() => expect(row("0012", "sale")).toBeNull());
  await user.click(screen.getByRole("tab", { name: "Past offers" }));
  expect(row("0012", "sale")).toHaveTextContent("Ended");
  expect(await financialEvidence()).toBe(evidence);
});

it("lets the requester edit the pending sale through the same request dialog while keeping the approved charge unchanged and private money absent", async () => {
  const user = await show(true);
  const original = (await records()).requests.find(
    (request: { product_code: string }) => request.product_code === "0008",
  );
  if (!original) throw new Error("The original pending request is missing");
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
  const sendRequest = within(dialog).getByRole("button", {
    name: "Send request",
  });
  await waitFor(() => expect(sendRequest).toBeEnabled());
  await user.click(sendRequest);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    (await records()).requests.find(
      (request: { id: string }) => request.id === original.id,
    ),
  ).toMatchObject({
    status: "pending",
    requested_price: "7.49",
    revision: original.revision + 1,
  });
  expect(
    (await records()).prices.find(
      (product: { code: string }) => product.code === "0008",
    ),
  ).toMatchObject({ regular: "9.49", charged: "9.49" });
});

it("requires a confirmation to withdraw one's request and leaves the approved customer price and financial evidence untouched", async () => {
  const user = await show(true);
  const before = screen.getByTestId("records").textContent;
  const evidence = await financialEvidence();
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
    (await records()).requests.find(
      (request: { product_code: string }) => request.product_code === "0008",
    ),
  ).toMatchObject({ status: "withdrawn" });
  await waitFor(() => expect(row("0008", "request")).toBeNull());
  expect(
    (await records()).prices.find(
      (product: { code: string }) => product.code === "0008",
    ),
  ).toMatchObject({ regular: "9.49", charged: "9.49" });
  expect(await financialEvidence()).toBe(evidence);
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
  await waitFor(() => expect(row("0012", "sale")).toBeNull());
  expect(row("0008", "request")).toHaveTextContent("Sale requested");
});

it("pauses a retained multi-buy at the sale store, removes it from that pool, and restores that same record after a confirmed end", async () => {
  const user = await show();
  const priorOffers = (await records()).offers.filter(
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
  await waitFor(() =>
    expect(
      document.querySelector(
        'tr[data-product-code="0003"]:not([data-offer-kind])',
      ),
    ).toHaveTextContent("Paused during sale"),
  );
  expect(
    (await records()).offers.filter(
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
    (await records()).offers.filter(
      (offer: { product_code: string }) => offer.product_code === "0003",
    ),
  ).toEqual(priorOffers);
  await user.click(screen.getByRole("tab", { name: "Mix-and-match pools" }));
  expect(screen.getByText("0003").closest("tr")).toHaveTextContent(
    "Sour Cherry Juice 1 L",
  );
});
