import { useState } from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { ChangePriceDialog } from "./ChangePriceDialog";
import { DemoProvider, useDemo } from "./store";
import { effectivePrice, regularPrice } from "./catalog";
import i18n from "./i18n";
import { configSeed } from "./config";
import { branchLabel } from "./settings";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "products";
  await i18n.changeLanguage("en");
});
function Harness({
  code = "0009",
  approve = false,
}: {
  code?: string;
  approve?: boolean;
}) {
  const { state, switchDemoUser, branch, update } = useDemo();
  const [open, setOpen] = useState(false);
  const request = state.sale_requests?.find(
    (item) => item.product_code === code && item.status === "pending",
  );
  const product = state.products.find((item) => item.code === code)!;
  return (
    <>
      <button onClick={() => switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button onClick={() => switchDemoUser("floorworker")}>Use Worker</button>
      <button onClick={() => setOpen(true)}>Open price dialog</button>
      <button
        onClick={() =>
          update((draft) => {
            draft.config.weighed_items!.main_display_unit = "kg";
          })
        }
      >
        Display kilograms
      </button>
      {open && (
        <ChangePriceDialog
          product_code={code}
          approve_request_id={approve ? request?.id : undefined}
          onClose={() => setOpen(false)}
        />
      )}
      <output data-testid="record">
        {JSON.stringify({
          regular: regularPrice(state, product, branch),
          charge: effectivePrice(state, product, branch),
          sales: state.sales?.filter((item) => item.product_code === code),
          requests: state.sale_requests?.filter(
            (item) => item.product_code === code,
          ),
        })}
      </output>
      <output data-testid="financial-evidence">
        {JSON.stringify({
          invoices: state.invoices,
          invoice: state.invoice,
          stock: state.stock,
          ledger: state.ledger,
          returns: state.returns,
        })}
      </output>
    </>
  );
}
async function show(code = "0009", role = "supervisor", approve = false) {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness code={code} approve={approve} />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", {
      name: role === "supervisor" ? "Use Supervisor" : "Use Worker",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Open price dialog" }));
  return user;
}
it("starts a reviewed sale while leaving regular price and invoice/stock/payable evidence unchanged", async () => {
  const user = await show();
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  const before = screen.getByTestId("financial-evidence").textContent;
  expect(
    within(dialog).getByRole("radio", { name: /^Sale, for a while/ }),
  ).toHaveAttribute("aria-checked", "true");
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.type(price, "2.79");
  expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
    "2.79",
  );
  await user.click(within(dialog).getByRole("button", { name: "Start sale" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const saved = JSON.parse(screen.getByTestId("record").textContent ?? "{}");
  expect(saved).toMatchObject({ regular: "2.99", charge: "2.79" });
  expect(saved.sales).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sale_price: "2.79", status: "active" }),
    ]),
  );
  expect(screen.getByTestId("financial-evidence").textContent).toBe(before);
});
it("approval below minimum margin needs an explicit acknowledgement; a draft is never an implicit approval", async () => {
  const user = await show("0008", "supervisor", true);
  const before = screen.getByTestId("record").textContent;
  const evidence = screen.getByTestId("financial-evidence").textContent;
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).queryByRole("radiogroup", { name: "Stores" }),
  ).not.toBeInTheDocument();
  expect(dialog.querySelector(".change-price-stores")).toHaveTextContent(
    branchLabel(configSeed, "Branch 1", "en"),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Change and approve" }),
  );
  const missing = screen.getByRole("alert", { name: "What's missing" });
  expect(missing).toHaveTextContent("Use this price anyway");
  expect(screen.getByTestId("record").textContent).toBe(before);
  const ack = within(dialog).getByRole("checkbox", {
    name: "Use this price anyway",
  });
  await user.click(ack);
  await user.click(
    within(dialog).getByRole("button", { name: "Change and approve" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const saved = JSON.parse(screen.getByTestId("record").textContent ?? "{}");
  expect(saved.requests).toEqual([
    expect.objectContaining({ status: "approved", requested_price: "7.99" }),
  ]);
  expect(saved).toMatchObject({ regular: "9.49", charge: "7.99" });
  expect(screen.getByTestId("financial-evidence").textContent).toBe(evidence);
});
it("worker request exposes no cost or margin and does not change the customer's charge", async () => {
  const user = await show("0009", "worker");
  const before = screen.getByTestId("financial-evidence").textContent;
  const dialog = screen.getByRole("dialog", { name: "Request a sale" });
  expect(
    within(dialog).queryByRole("radiogroup", { name: "Price change" }),
  ).not.toBeInTheDocument();
  expect(dialog).not.toHaveTextContent(/Margin|minimum margin|below cost/i);
  expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
    "The manager approves this first. Until then, the regular price stays.",
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Price" }),
    "2.79",
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Why? (optional)" }),
    "Shelf promotion",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Send request" }),
  );
  const saved = JSON.parse(screen.getByTestId("record").textContent ?? "{}");
  expect(saved).toMatchObject({ regular: "2.99", charge: "2.99" });
  expect(saved.sales).toHaveLength(0);
  expect(saved.requests).toEqual([
    expect.objectContaining({
      status: "pending",
      branch: "Branch 1",
      why: "Shelf promotion",
      requested_price: "2.79",
    }),
  ]);
  expect(screen.getByTestId("financial-evidence").textContent).toBe(before);
});
it("new regular price during a sale explains deferred charging and labels, and Cancel saves nothing", async () => {
  const user = await show("0012");
  const before = screen.getByTestId("record").textContent;
  const dialog = screen.getByRole("dialog", { name: "Change sale" });
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  const summary = dialog.querySelector(".change-price-summary");
  expect(summary).toHaveTextContent("Applies after the sale");
  expect(summary).toHaveTextContent("Customers keep paying the sale price.");
  expect(summary).toHaveTextContent(
    "Regular labels are added when the sale ends. The current Promo label stays.",
  );
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.clear(price);
  await user.type(price, "21.49");
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByTestId("record").textContent).toBe(before);
});
it("a non-discounting sale stays editable with linked validation and no mutation", async () => {
  const user = await show();
  const before = screen.getByTestId("record").textContent;
  const price = screen.getByRole("textbox", { name: "Price" });
  await user.type(price, "3.99");
  await user.click(screen.getByRole("button", { name: "Start sale" }));
  const missing = screen.getByRole("alert", { name: "What's missing" });
  const link = within(missing).getByRole("link", {
    name: "A sale price must be lower than $2.99. To raise the price, choose New regular price.",
  });
  await user.click(link);
  await waitFor(() => expect(price).toHaveFocus());
  expect(price).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByTestId("record").textContent).toBe(before);
});

it("claims savings only for a lower price, including regular-price edits", async () => {
  const user = await show();
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.type(price, "3.99");
  expect(dialog).not.toHaveTextContent("Customers save");
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  expect(dialog).not.toHaveTextContent("Customers save");
  await user.clear(price);
  await user.type(price, "2.99");
  expect(dialog).not.toHaveTextContent("Customers save");
  await user.clear(price);
  await user.type(price, "2.79");
  expect(dialog).toHaveTextContent("Customers save $0.20 (7% off)");
  await user.clear(price);
  await user.type(price, "3.49");
  expect(dialog).not.toHaveTextContent("Customers save");
  expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
    "$3.49 instead of $2.99",
  );
});

it("regular weighed summary promises the actual saved canonical conversion while a sale keeps exact entered kilograms", async () => {
  const user = await show("0016");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Display kilograms" }));
  await user.click(screen.getByRole("button", { name: "Open price dialog" }));
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Price (per kg)" }),
    "16.99",
  );
  expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
    "$17.00/kg",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Save new price" }),
  );
  const saved = JSON.parse(screen.getByTestId("record").textContent ?? "{}");
  expect(saved).toMatchObject({ regular: "7.71", charge: "7.71" });
});
