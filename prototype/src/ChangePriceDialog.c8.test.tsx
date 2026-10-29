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
import { authenticatedTestActor } from "./authority-test-fixture";
import { saleStoreDate, saleDateAfter, savePriceChange } from "./sales";

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
  state = initialState(),
) {
  const user = userEvent.setup();
  openedCode = code;
  fixture = await authenticatedProviderFixture({
    state,
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
  await screen.findByRole("textbox", { name: /^(Price|Sale price)/ });
  return user;
}
it("starts a reviewed sale while leaving regular price and invoice/stock/payable evidence unchanged", async () => {
  const user = await show();
  const dialog = screen.getByRole("dialog", { name: "Change price" });
  const before = await financialEvidence();
  expect(
    within(dialog).getByRole("radio", { name: /^Sale, for a while/ }),
  ).toHaveAttribute("aria-checked", "true");
  const price = within(dialog).getByRole("textbox", { name: "Sale price" });
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
    within(dialog).getByRole("textbox", { name: "Sale price" }),
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
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.clear(price);
  await user.type(price, "21.49");
  const summary = dialog.querySelector(".change-price-summary");
  await waitFor(() =>
    expect(summary).toHaveTextContent("Applies after the sale"),
  );
  expect(summary).toHaveTextContent("Customers keep paying the sale price.");
  expect(summary).toHaveTextContent(
    "Regular labels are added when the sale ends. The current Promo label stays.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByTestId("record").textContent).toBe(before);
});
it("saves the after-sale regular price while the running sale keeps its customer charge", async () => {
  const user = await show("0012");
  const dialog = screen.getByRole("dialog", { name: "Change sale" });
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.clear(price);
  await user.type(price, "24.99");
  await clickSubmit(user, dialog, "Save new price");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const canonical = await fixture.readCanonical();
  expect(regularPrice(canonical, "0012", "Branch 1")).toBe("24.99");
  expect(effectivePrice(canonical, "0012", "Branch 1")).toBe("16.99");
});
it("saves a regular price from one store of a multi-store sale without a false sale revision error", async () => {
  const state = initialState();
  state.sales = [];
  state.sale_events = [];
  const manager = authenticatedTestActor(state, "manager", {
    selection: { kind: "location", location_id: "Branch 1" },
  });
  savePriceChange(state, manager, {
    product_code: "0012",
    mode: "sale",
    scope: "selected",
    branches: ["Branch 1", "Branch 2"],
    price: "16.99",
    price_unit: "each",
    starts_on: saleStoreDate(state.config, "Branch 1"),
    last_day: null,
    accept_below_margin: false,
    below_cost_reason: "",
    add_labels: true,
  });
  const user = await show("0012", "manager", false, state);
  const dialog = screen.getByRole("dialog");
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  const price = within(dialog).getByRole("textbox", { name: "Price" });
  await user.clear(price);
  await user.type(price, "24.99");
  await clickSubmit(user, dialog, "Save new price");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const canonical = await fixture.readCanonical();
  expect(regularPrice(canonical, "0012", "Branch 1")).toBe("24.99");
  expect(regularPrice(canonical, "0012", "Branch 2")).toBe("20.99");
  expect(canonical.sales!.every((sale) => sale.status === "active")).toBe(true);
});
it.each(["16.99", "15.99"])(
  "defaults to ending a sale when the new regular price is %s",
  async (amount) => {
    const user = await show("0012");
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("radio", { name: /^New regular price/ }),
    );
    const price = within(dialog).getByRole("textbox", { name: "Price" });
    await user.clear(price);
    await user.type(price, amount);
    await waitFor(() =>
      expect(dialog).toHaveTextContent(
        `The sale price $16.99 isn't lower than the new regular price $${amount}.`,
      ),
    );
    expect(
      within(dialog).getByRole("radio", { name: "End the sale now" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(dialog).toHaveTextContent(
      "The sale ends now. Customers pay the new regular price.",
    );
    if (amount === "15.99")
      await user.click(
        await within(dialog).findByRole("checkbox", {
          name: "Use this price anyway",
        }),
      );
    await clickSubmit(user, dialog, "Save new price");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const canonical = await fixture.readCanonical();
    expect(effectivePrice(canonical, "0012", "Branch 1")).toBe(amount);
    expect(
      canonical.sales!.find((sale) => sale.product_code === "0012")?.status,
    ).toBe("ended");
  },
);
it("can lower the running sale price together with the new regular price", async () => {
  const user = await show("0012");
  const dialog = screen.getByRole("dialog");
  await user.click(
    within(dialog).getByRole("radio", { name: /^New regular price/ }),
  );
  await user.click(
    await within(dialog).findByRole("radio", { name: "Change the sale price" }),
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "New sale price" }),
    "15.99",
  );
  await user.click(
    await within(dialog).findByRole("checkbox", {
      name: "Use this price anyway",
    }),
  );
  await clickSubmit(user, dialog, "Save new price");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const canonical = await fixture.readCanonical();
  expect(regularPrice(canonical, "0012", "Branch 1")).toBe("16.99");
  expect(effectivePrice(canonical, "0012", "Branch 1")).toBe("15.99");
  expect(
    canonical.sales!.find((sale) => sale.product_code === "0012")?.status,
  ).toBe("active");
});
it("a non-discounting sale stays editable with linked validation and no mutation", async () => {
  const user = await show();
  const before = screen.getByTestId("record").textContent;
  const price = screen.getByRole("textbox", { name: "Sale price" });
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
  const price = within(dialog).getByRole("textbox", { name: "Sale price" });
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
    expect(dialog).toHaveTextContent("Customers save $0.20 (7%)"),
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

it("R2g B2 keeps empty, zero and incomplete prices out of margin and price promises", async () => {
  const user = await show();
  const dialog = screen.getByRole("dialog");
  const price = within(dialog).getByRole("textbox", { name: "Sale price" });
  const before = await financialEvidence();
  for (const value of ["", "0", "1."]) {
    await user.clear(price);
    if (value) await user.type(price, value);
    expect(dialog.querySelector(".change-price-facts")).not.toBeInTheDocument();
    expect(
      dialog.querySelector(".change-price-warning"),
    ).not.toBeInTheDocument();
    expect(
      dialog.querySelector(".change-price-summary p"),
    ).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/at —|−0%|-0%/);
  }
  await user.clear(price);
  await user.type(price, "2.79");
  await waitFor(() =>
    expect(dialog.querySelector(".change-price-facts")).toHaveTextContent(
      "Customers save $0.20 (7%)",
    ),
  );
  expect(await financialEvidence()).toBe(before);
});

it("R2g B2 uses one below-cost warning with one persistent full-input reason and acknowledgement", async () => {
  const user = await show("0002");
  const dialog = screen.getByRole("dialog");
  const before = await financialEvidence();
  const price = within(dialog).getByRole("textbox", { name: "Sale price" });
  await user.type(price, "0.89");
  const reason = await within(dialog).findByRole("textbox", { name: "Reason" });
  expect(dialog.querySelectorAll(".change-price-warning")).toHaveLength(1);
  const warning = dialog.querySelector(".change-price-warning")!;
  expect(warning).toHaveClass(
    "change-price-margin-warning",
    "change-price-cost-warning",
  );
  expect(warning).toHaveTextContent("This price is below cost.");
  expect(warning).toHaveTextContent("minimum margin");
  expect(reason.tagName).toBe("INPUT");
  expect(
    within(warning as HTMLElement).getByRole("checkbox", {
      name: "Use this price anyway",
    }),
  ).toBeInTheDocument();
  await user.type(reason, "Fictional clearance reviewed before Friday");
  expect(reason).toHaveValue("Fictional clearance reviewed before Friday");
  expect(reason).toHaveFocus();
  expect(dialog.querySelectorAll(".change-price-warning")).toHaveLength(1);
  await user.click(
    within(warning as HTMLElement).getByRole("checkbox", {
      name: "Use this price anyway",
    }),
  );
  expect(reason).toHaveValue("Fictional clearance reviewed before Friday");
  expect(await financialEvidence()).toBe(before);
});

it("R2g B2 presets describe the retained configured dates and reveal a date field only for Date", async () => {
  const state = initialState();
  const user = await show("0009", "manager", false, state);
  const dialog = screen.getByRole("dialog");
  const ends = within(dialog).getByRole("group", { name: "Ends" });
  expect(within(ends).getAllByRole("button")).toHaveLength(5);
  expect(within(ends).getByRole("button", { name: "2 weeks" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    within(dialog).queryByRole("button", { name: "Last day" }),
  ).not.toBeInTheDocument();
  await user.type(
    within(dialog).getByRole("textbox", { name: "Sale price" }),
    "2.79",
  );
  const today = saleStoreDate(state.config, "Branch 1");
  await user.click(within(ends).getByRole("button", { name: "1 week" }));
  expect(within(ends).getByRole("button", { name: "1 week" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(within(ends).getByRole("button", { name: "No end" }));
  expect(dialog.querySelector(".change-price-until")).not.toBeInTheDocument();
  await user.click(within(ends).getByRole("button", { name: "Date…" }));
  expect(
    within(dialog).getByRole("button", { name: "Last day" }),
  ).toBeInTheDocument();
  await user.click(within(ends).getByRole("button", { name: "1 week" }));
  await clickSubmit(user, dialog, "Start sale");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const saved = await fixture.readCanonical();
  expect(saved.sales!.filter((sale) => sale.product_code === "0009")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        starts_on: today,
        last_day: saleDateAfter(today, 6),
      }),
    ]),
  );
});

it("R2g B2 rounds a tiny negative margin to honest zero rather than negative zero", async () => {
  const state = initialState();
  state.invoices = [];
  state.invoice.status = "review";
  state.products.find(
    (product) => product.code === "0009",
  )!.last_cost_before_tax = "2.9901";
  const user = await show("0009", "manager", false, state);
  const dialog = screen.getByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Sale price" }),
    "2.99",
  );
  await waitFor(() =>
    expect(dialog.querySelector(".change-price-facts")).toHaveTextContent(
      "Margin 0%",
    ),
  );
  expect(dialog.querySelector(".change-price-facts")).toHaveTextContent(
    "Cost $2.9901",
  );
  expect(dialog).not.toHaveTextContent(/−0%|-0%/);
});

it("R2g B2 marks only the chosen discount tile when rounded prices coincide", async () => {
  const user = await show("0002");
  const dialog = screen.getByRole("dialog");
  const picks = within(dialog).getByRole("group", { name: "Quick picks" });
  const ten = within(picks).getByRole("button", { name: "10% off" });
  const twentyFive = within(picks).getByRole("button", { name: "25% off" });
  await user.click(ten);
  expect(ten).toHaveAttribute("aria-pressed", "true");
  expect(picks.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  await user.click(twentyFive);
  expect(twentyFive).toHaveAttribute("aria-pressed", "true");
  expect(ten).toHaveAttribute("aria-pressed", "false");
  expect(picks.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  const price = within(dialog).getByRole("textbox", { name: "Sale price" });
  await user.clear(price);
  await user.type(price, "1.29");
  expect(picks.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
});

it("R2g B2 disables an unavailable rounded discount without inventing a price", async () => {
  const state = initialState();
  const product = state.products.find((item) => item.code === "0002")!;
  product.selling_price = "0.49";
  product.branch_prices = {
    "Branch 1": "0.49",
    "Branch 2": "0.49",
    "Branch 3": "0.49",
  };
  await show("0002", "manager", false, state);
  const dialog = screen.getByRole("dialog");
  const picks = within(dialog).getByRole("group", { name: "Quick picks" });
  for (const button of within(picks).getAllByRole("button")) {
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "No lower price is available with the configured price endings.",
    );
    expect(button.querySelector("bdi")).not.toBeInTheDocument();
  }
  expect(
    within(dialog).getByRole("textbox", { name: "Sale price" }),
  ).toHaveValue("");
});
