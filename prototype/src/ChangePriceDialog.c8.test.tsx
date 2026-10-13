import { useState } from "react";
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
import { ChangePriceDialog } from "./ChangePriceDialog";
import { DemoProvider, useDemo } from "./store";
import { effectivePrice, regularPrice } from "./catalog";
import i18n from "./i18n";
import { configSeed } from "./config";
import { branchLabel, savePricingSettings } from "./settings";
import { initialState } from "./e1-bootstrap";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";

const previousAsyncTimeout = getConfig().asyncUtilTimeout;
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
let openedCode = "0009";
const codeForRecord = () => openedCode;
afterEach(() => {
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
  configure({ asyncUtilTimeout: previousAsyncTimeout });
});
const financialEvidence = async () => {
  const state = await fixture.readCanonical();
  return JSON.stringify({
    invoices: state.invoices,
    invoice: state.invoice,
    stock: state.stock,
    ledger: state.ledger,
    returns: state.returns,
  });
};
beforeEach(async () => {
  configure({ asyncUtilTimeout: 3000 });
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
  const { state, actor, branch, command } = useDemo();
  const [open, setOpen] = useState(false);
  const request = state.sale_requests?.find(
    (item) => item.product_code === code && item.status === "pending",
  );
  const product = state.products.find((item) => item.code === code)!;
  return (
    <>
      {actor && (
        <button onClick={() => setOpen(true)}>Open price dialog</button>
      )}
      <button
        onClick={() =>
          command(
            "settings.manage",
            {
              company_id: state.config.company.seed_key,
              kind: "company_shared",
              mutation: true,
            },
            (draft, currentActor) => {
              const candidate = structuredClone(draft.config);
              candidate.weighed_items!.main_display_unit = "kg";
              savePricingSettings(draft, candidate, currentActor);
            },
          )
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
          display_unit: state.config.weighed_items?.main_display_unit,
          regular: regularPrice(state, product, branch),
          charge: effectivePrice(state, product, branch),
          sales: state.sales?.filter((item) => item.product_code === code),
          requests: state.sale_requests?.filter(
            (item) => item.product_code === code,
          ),
        })}
      </output>
    </>
  );
}
async function clickSubmit(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  name: string,
) {
  const button = within(dialog).getByRole("button", { name });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}
async function show(
  code = "0009",
  role: "manager" | "floor_worker" = "manager",
  approve = false,
) {
  const user = userEvent.setup();
  openedCode = code;
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: role,
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <Harness code={code} approve={approve} />
    </DemoProvider>,
  );
  await screen.findByRole("button", { name: "Open price dialog" });
  await user.click(screen.getByRole("button", { name: "Open price dialog" }));
  await screen.findByRole("textbox", { name: /^Price/ });
  return user;
}
it("starts a reviewed sale while leaving regular price and invoice/stock/payable evidence unchanged", async () => {
  const user = await show();
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  const before = await financialEvidence();
  expect(
    within(dialog).getByRole("radio", { name: /^Sale, for a while/ }),
  ).toHaveAttribute("aria-checked", "true");
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.type(price, "2.79");
  expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
    "2.79",
  );
  await clickSubmit(user, dialog, "Start sale");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const canonical = await fixture.readCanonical();
  const saved = {
    regular: regularPrice(canonical, codeForRecord(), "Branch 1"),
    charge: effectivePrice(canonical, codeForRecord(), "Branch 1"),
    sales: canonical.sales?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
    requests: canonical.sale_requests?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
  };
  expect(saved).toMatchObject({ regular: "2.99", charge: "2.79" });
  expect(saved.sales).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sale_price: "2.79", status: "active" }),
    ]),
  );
  expect(await financialEvidence()).toBe(before);
});
it("approval below minimum margin needs an explicit acknowledgement; a draft is never an implicit approval", async () => {
  const user = await show("0008", "manager", true);
  const before = screen.getByTestId("record").textContent;
  const evidence = await financialEvidence();
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).queryByRole("radiogroup", { name: "Stores" }),
  ).not.toBeInTheDocument();
  expect(dialog.querySelector(".change-price-stores")).toHaveTextContent(
    branchLabel(configSeed, "Branch 1", "en"),
  );
  await clickSubmit(user, dialog, "Change and approve");
  const missing = await screen.findByRole("alert", { name: "What's missing" });
  expect(missing).toHaveTextContent("Use this price anyway");
  expect(screen.getByTestId("record").textContent).toBe(before);
  const ack = within(dialog).getByRole("checkbox", {
    name: "Use this price anyway",
  });
  await user.click(ack);
  await clickSubmit(user, dialog, "Change and approve");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const canonical = await fixture.readCanonical();
  const saved = {
    regular: regularPrice(canonical, codeForRecord(), "Branch 1"),
    charge: effectivePrice(canonical, codeForRecord(), "Branch 1"),
    sales: canonical.sales?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
    requests: canonical.sale_requests?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
  };
  expect(saved.requests).toEqual([
    expect.objectContaining({ status: "approved", requested_price: "7.99" }),
  ]);
  expect(saved).toMatchObject({ regular: "9.49", charge: "7.99" });
  expect(await financialEvidence()).toBe(evidence);
});
it("worker request exposes no cost or margin and does not change the customer's charge", async () => {
  const user = await show("0009", "floor_worker");
  const before = await financialEvidence();
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
  await clickSubmit(user, dialog, "Send request");
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).sale_requests?.filter(
        (item) => item.product_code === "0009",
      ),
    ).toHaveLength(1),
  );
  const canonical = await fixture.readCanonical();
  const saved = {
    regular: regularPrice(canonical, codeForRecord(), "Branch 1"),
    charge: effectivePrice(canonical, codeForRecord(), "Branch 1"),
    sales: canonical.sales?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
    requests: canonical.sale_requests?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
  };
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
  expect(await financialEvidence()).toBe(before);
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
  await clickSubmit(user, screen.getByRole("dialog"), "Start sale");
  const missing = await screen.findByRole("alert", { name: "What's missing" });
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
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", {
        name: /^(Start sale|Save new price)$/,
      }),
    ).toBeEnabled(),
  );
  expect(dialog).not.toHaveTextContent("Customers save");
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", {
        name: /^(Start sale|Save new price)$/,
      }),
    ).toBeEnabled(),
  );
  expect(dialog).not.toHaveTextContent("Customers save");
  await user.clear(price);
  await user.type(price, "2.99");
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", {
        name: /^(Start sale|Save new price)$/,
      }),
    ).toBeEnabled(),
  );
  expect(dialog).not.toHaveTextContent("Customers save");
  await user.clear(price);
  await user.type(price, "2.79");
  await waitFor(() =>
    expect(dialog).toHaveTextContent("Customers save $0.20 (7% off)"),
  );
  await user.clear(price);
  await user.type(price, "3.49");
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", {
        name: /^(Start sale|Save new price)$/,
      }),
    ).toBeEnabled(),
  );
  expect(dialog).not.toHaveTextContent("Customers save");
  await waitFor(() =>
    expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
      "$3.49 instead of $2.99",
    ),
  );
});

it("regular weighed summary promises the actual saved canonical conversion while a sale keeps exact entered kilograms", async () => {
  const user = await show("0016");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Display kilograms" }));
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByTestId("record").textContent!).display_unit,
    ).toBe("kg"),
  );
  await user.click(screen.getByRole("button", { name: "Open price dialog" }));
  await screen.findByRole("textbox", { name: "Price (per kg)" });
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Price (per kg)" }),
    "16.99",
  );
  await waitFor(() =>
    expect(dialog.querySelector(".change-price-summary")).toHaveTextContent(
      "$17.00/kg",
    ),
  );
  await clickSubmit(user, dialog, "Save new price");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const canonical = await fixture.readCanonical();
  const saved = {
    regular: regularPrice(canonical, codeForRecord(), "Branch 1"),
    charge: effectivePrice(canonical, codeForRecord(), "Branch 1"),
    sales: canonical.sales?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
    requests: canonical.sale_requests?.filter(
      (item) => item.product_code === codeForRecord(),
    ),
  };
  expect(saved).toMatchObject({ regular: "7.71", charge: "7.71" });
});
