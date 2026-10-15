import { useState } from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { addTrackedDate, stopProductDateTracking } from "./date-tracking";
import { ProductDatesSection } from "./ProductDatesSection";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { actorAtLocation } from "./authority";
import { selectHistory } from "./history";
import Expiry from "./screens/Expiry";
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
  window.location.hash = "expiry";
});
type ProviderFixture = Awaited<ReturnType<typeof authenticatedProviderFixture>>;
const fixtures: ProviderFixture[] = [];
let currentFixture: ProviderFixture;
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
function Harness({ lookup = false }: { lookup?: boolean }) {
  const {
    state,
    actor,
    demoUsers,
    switchDemoUser,
    undoToasts,
    undoActivity,
    authorityGeneration,
    setBranch,
    setLang,
    command,
    query,
    revertActivity,
  } = useDemo();
  const [fixtureAction, setFixtureAction] = useState("idle");
  const product = state.products[0];
  const switchRole = async (role: "manager" | "floor_worker" | "cashier") => {
    const account = demoUsers.find((person) => person.role === role);
    if (!account)
      throw new Error("Actual configured demo account was not loaded.");
    const result = await switchDemoUser(account.username);
    if (result) throw new Error(result);
  };
  return (
    <>
      <button onClick={() => switchRole("manager")}>Use Supervisor</button>
      <button onClick={() => switchRole("floor_worker")}>
        Use Floor Worker
      </button>
      <button onClick={() => switchRole("cashier")}>Use Cashier</button>
      <output
        data-testid="current-role"
        data-session-id={actor?.session_id ?? ""}
        data-generation={authorityGeneration}
        data-branch={actor?.branch ?? ""}
      >
        {actor?.role ?? "signed_out"}
      </output>
      <output data-testid="fixture-action-stage">{fixtureAction}</output>
      {actor && product && (
        <>
          <button onClick={async () => await setBranch("Branch 1")}>
            Use North York
          </button>
          <button onClick={() => setLang("fa")}>Use Persian</button>
          <button onClick={() => setLang("en")}>Use English</button>
          <button
            onClick={async () => {
              setFixtureAction("adding");
              await command(
                "dates.add",
                {
                  company_id: actor.company_id,
                  kind: "location_record",
                  location_ids: ["Branch 1"],
                  mutation: true,
                },
                (draft, freshActor) =>
                  addTrackedDate(
                    draft,
                    actorAtLocation(draft, freshActor, "Branch 1"),
                    {
                      product_code: product.code,
                      branch: "Branch 1",
                      date_type: "expiry",
                      date: "2026-11-04",
                    },
                  ),
              );
              setFixtureAction("added");
            }}
          >
            Add fixture date
          </button>
          <button
            onClick={async () => {
              setFixtureAction("keeping");
              await command(
                "catalog.tracking_preference_edit",
                {
                  company_id: actor.company_id,
                  kind: "company_shared",
                  mutation: true,
                },
                (draft, freshActor) =>
                  stopProductDateTracking(
                    draft,
                    freshActor,
                    product.code,
                    "keep",
                  ),
              );
              setFixtureAction("kept");
            }}
          >
            Keep fixture date
          </button>
          <button
            onClick={async () => {
              const latest = await query(
                "history.read_all",
                { company_id: actor.company_id, kind: "company_shared" },
                (draft, freshActor) =>
                  [...selectHistory(draft, freshActor)]
                    .reverse()
                    .find((entry) => entry.action === "Add date"),
              );
              if (latest) await revertActivity(latest.id);
            }}
          >
            Revert latest date
          </button>
          {lookup ? <ProductDatesSection product={product} /> : <Expiry />}
          {undoToasts.map((toast) => (
            <button
              key={toast.id}
              onClick={async () => await undoActivity(toast.id)}
            >{`Undo ${toast.action}`}</button>
          ))}
          <output data-testid="manual-dates">
            {JSON.stringify(
              state.expiry.filter((entry) => entry.source === "manual"),
            )}
          </output>
          <output data-testid="date-preference">
            {String(product.date_tracking)}
          </output>
        </>
      )}
    </>
  );
}
async function show(lookup = false) {
  const fixture = await authenticatedProviderFixture({
    state: initialState,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  currentFixture = fixture;
  fixtures.push(fixture);
  const user = userEvent.setup();
  render(
    <DemoProvider options={fixture.options}>
      <Harness lookup={lookup} />
    </DemoProvider>,
  );
  await waitFor(
    () => {
      if (screen.getByTestId("current-role").textContent !== "manager")
        throw new Error("Waiting for the actual Manager session.");
    },
    { timeout: 3000 },
  );
  if (!lookup)
    await screen.findByRole("form", { name: "Add date" }, { timeout: 3000 });
  else await screen.findByRole("region", { name: "Dates" }, { timeout: 3000 });
  return user;
}
async function chooseToday(
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
) {
  await user.click(within(form).getByRole("button", { name: "Date" }));
  await user.click(screen.getByRole("button", { name: "Today" }));
}
it("quick-add validates edited fields, saves optional evidence, pins the date and clears/refocuses the scanner for Enter", async () => {
  const user = await show();
  const form = screen.getByRole("form", { name: "Add date" });
  const product = within(form).getByRole("combobox", { name: "Product" });
  const date = within(form).getByRole("button", { name: "Date" });
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(product).toHaveAttribute("aria-invalid", "true");
  expect(date).toHaveAttribute("aria-invalid", "true");
  await user.type(product, "0001");
  expect(product).toHaveAttribute("aria-invalid", "false");
  expect(date).toHaveAttribute("aria-invalid", "true");
  await chooseToday(user, form);
  await user.click(within(form).getByRole("button", { name: "More" }));
  const quantity = within(form).getByRole("textbox", {
    name: "Quantity (optional)",
  });
  await user.type(quantity, "0");
  await user.click(within(form).getByRole("button", { name: "Add" }));
  await waitFor(
    () => expect(quantity).toHaveAttribute("aria-invalid", "true"),
    { timeout: 3000 },
  );
  await user.type(
    within(form).getByRole("textbox", { name: "Note (optional)" }),
    "Shelf check",
  );
  expect(quantity).toHaveAttribute("aria-invalid", "true");
  await user.clear(quantity);
  await user.type(quantity, "1.250");
  expect(quantity).toHaveAttribute("aria-invalid", "false");
  await user.type(
    within(form).getByRole("textbox", { name: "Lot (optional)" }),
    "LOT-C5",
  );
  await user.click(within(form).getByRole("button", { name: "Add" }));
  await waitFor(
    () =>
      expect(screen.getByTestId("manual-dates")).toHaveTextContent(
        '"quantity":"1.25"',
      ),
    { timeout: 3000 },
  );
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"note":"Shelf check"',
  );
  await waitFor(
    () =>
      expect(screen.getByTestId("date-preference")).toHaveTextContent("true"),
    { timeout: 3000 },
  );
  expect(
    await screen.findByText(
      "Date added. Date tracking turned on.",
      {},
      { timeout: 3000 },
    ),
  ).toBeInTheDocument();
  expect(product).toHaveValue("");
  expect(product).toHaveFocus();
  expect(quantity).toHaveValue("");
  const firstRow = document.querySelector(".expiry-table tbody tr")!;
  expect(firstRow).toHaveAttribute("data-new-date", "true");
  expect(within(firstRow as HTMLElement).getByText("0001")).toBeInTheDocument();
  const retainedDate = date.textContent;
  await user.type(product, "۰۰۰۲{Enter}");
  await waitFor(() => expect(product).toHaveValue(""), { timeout: 3000 });
  expect(product).toHaveFocus();
  expect(date).toHaveTextContent(retainedDate!);
  const nextRow = document.querySelector(".expiry-table tbody tr")!;
  expect(within(nextRow as HTMLElement).getByText("0002")).toBeInTheDocument();
  expect(nextRow).toHaveAttribute("data-new-date", "true");
  expect(
    document.querySelectorAll(
      'select,input[type="date"],input[type="number"],input[type="checkbox"]',
    ),
  ).toHaveLength(0);
  expect(
    screen.queryByRole("dialog", { name: "Add date" }),
  ).not.toBeInTheDocument();
});
it("adding in another allowed location keeps the date and chosen location while revealing the new row", async () => {
  const user = await show();
  const previousGeneration = Number(
    screen.getByTestId("current-role").getAttribute("data-generation"),
  );
  await user.click(screen.getByRole("button", { name: "Use North York" }));
  await waitFor(
    () => {
      const marker = screen.getByTestId("current-role");
      if (
        Number(marker.getAttribute("data-generation")) <= previousGeneration ||
        marker.getAttribute("data-branch") !== "Branch 1"
      )
        throw new Error("Waiting for the actual selected-location transition.");
    },
    { timeout: 3000 },
  );
  const form = screen.getByRole("form", { name: "Add date" });
  const product = within(form).getByRole("combobox", { name: "Product" });
  const location = within(form).getByRole("combobox", { name: "Location" });
  await user.type(product, "0001");
  await chooseToday(user, form);
  const retainedDate = within(form).getByRole("button", {
    name: "Date",
  }).textContent;
  await user.click(location);
  await user.click(screen.getByRole("option", { name: "Richmond Hill" }));
  await user.click(within(form).getByRole("button", { name: "Add" }));
  await waitFor(() => expect(product).toHaveValue(""), { timeout: 3000 });
  expect(product).toHaveFocus();
  expect(within(form).getByRole("button", { name: "Date" })).toHaveTextContent(
    retainedDate!,
  );
  expect(location).toHaveTextContent("Richmond Hill");
  expect(screen.getByRole("tab", { name: "All dates" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const newRow = await waitFor(
    () => {
      const selectedLocation = screen
        .getByTestId("current-role")
        .getAttribute("data-branch");
      const row = document.querySelector(
        '.expiry-table tbody tr[data-new-date="true"]',
      );
      if (selectedLocation !== "Branch 2" || !row)
        throw new Error("Waiting for the real destination and new date row.");
      return row;
    },
    { timeout: 3000 },
  );
  expect(
    within(newRow as HTMLElement).getByText("Richmond Hill"),
  ).toBeInTheDocument();
  expect(within(newRow as HTMLElement).getByText("0001")).toBeInTheDocument();
});
it("the Products quick-add route validates the preselected product and preserves safe History reversion without a transient Add toast", async () => {
  const user = await show();
  window.location.hash = "expiry?product=0001";
  await waitFor(
    () =>
      expect(screen.getByRole("combobox", { name: "Product" })).toHaveValue(
        "Basmati Rice 4.5 kg",
      ),
    { timeout: 3000 },
  );
  const form = screen.getByRole("form", { name: "Add date" });
  const product = within(form).getByRole("combobox", { name: "Product" });
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(product).toHaveValue("برنج باسماتی ۴٫۵ کیلوگرمی");
  await user.click(screen.getByRole("button", { name: "Use English" }));
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await chooseToday(user, form);
  await user.click(within(form).getByRole("button", { name: "Add" }));
  await waitFor(
    () =>
      expect(screen.getByTestId("date-preference")).toHaveTextContent("true"),
    { timeout: 3000 },
  );
  expect(
    screen.queryByRole("button", { name: "Undo Add date" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Revert latest date" }));
  await waitFor(
    () =>
      expect(screen.getByTestId("date-preference")).toHaveTextContent("false"),
    { timeout: 3000 },
  );
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"status":"removed"',
  );
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"removal_action":"undo"',
  );
});
it("selected product labels follow language changes while typed scanner text stays literal", async () => {
  const user = await show();
  const product = screen.getByRole("combobox", { name: "Product" });
  await user.type(product, "0001");
  await user.click(screen.getByRole("option", { name: /Basmati Rice 4.5 kg/ }));
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(product).toHaveValue("برنج باسماتی ۴٫۵ کیلوگرمی");
  await user.click(screen.getByRole("button", { name: "Use English" }));
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await user.clear(product);
  await user.type(product, "DEMO-600000");
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(product).toHaveValue("DEMO-600000");
});
it.each([false, true])(
  "renders retained quick-add success in the current language without adding another date (tracking already on: %s)",
  async (trackingAlreadyOn) => {
    const user = await show();
    if (trackingAlreadyOn) {
      await user.click(
        screen.getByRole("button", { name: "Add fixture date" }),
      );
      await waitFor(
        () => {
          if (
            screen.getByTestId("fixture-action-stage").textContent !== "added"
          )
            throw new Error(
              "Waiting for the actual fixture command to finish.",
            );
        },
        { timeout: 3000 },
      );
    }
    const form = screen.getByRole("form", { name: "Add date" });
    await user.type(
      within(form).getByRole("combobox", { name: "Product" }),
      "0001",
    );
    await chooseToday(user, form);
    await user.click(within(form).getByRole("button", { name: "Add" }));
    const english = trackingAlreadyOn
      ? "Date added."
      : "Date added. Date tracking turned on.";
    const persian = trackingAlreadyOn
      ? "تاریخ اضافه شد."
      : "تاریخ اضافه شد. پیگیری تاریخ روشن شد.";
    await waitFor(
      () =>
        expect(
          within(screen.getByRole("form", { name: "Add date" })).getByRole(
            "status",
          ),
        ).toHaveTextContent(english),
      { timeout: 3000 },
    );
    const retainedDates = screen.getByTestId("manual-dates").textContent;
    await user.click(screen.getByRole("button", { name: "Use Persian" }));
    expect(within(form).getByRole("status")).toHaveTextContent(persian);
    expect(within(form).getByRole("status")).not.toHaveTextContent(
      "Date added.",
    );
    expect(screen.getByTestId("manual-dates").textContent).toBe(retainedDates);
    await user.click(screen.getByRole("button", { name: "Use English" }));
    await waitFor(
      () =>
        expect(
          within(screen.getByRole("form", { name: "Add date" })).getByRole(
            "status",
          ),
        ).toHaveTextContent(english),
      { timeout: 3000 },
    );
    expect(screen.getByTestId("manual-dates").textContent).toBe(retainedDates);
  },
);
it("C6 Lookup dates are read-only for every role and kept dates remain visible", async () => {
  const user = await show(true);
  await user.click(screen.getByRole("button", { name: "Add fixture date" }));
  await waitFor(
    () => {
      if (screen.getByTestId("fixture-action-stage").textContent !== "added")
        throw new Error("Waiting for the actual fixture command to finish.");
    },
    { timeout: 3000 },
  );
  await user.click(screen.getByRole("button", { name: "Keep fixture date" }));
  await waitFor(
    () => {
      if (screen.getByTestId("fixture-action-stage").textContent !== "kept")
        throw new Error("Waiting for the actual fixture command to finish.");
    },
    { timeout: 3000 },
  );
  await waitFor(
    async () => {
      const saved = await currentFixture.readCanonical();
      if (
        !saved.expiry.some((entry) => entry.source === "manual") ||
        saved.products[0].date_tracking !== false
      )
        throw new Error(
          "Waiting for the actual retained-date Stop tracking commit.",
        );
    },
    { timeout: 3000 },
  );
  const retained = JSON.stringify(
    (await currentFixture.readCanonical()).expiry.filter(
      (entry) => entry.source === "manual",
    ),
  );
  for (const [account, role] of [
    ["Use Supervisor", "manager"],
    ["Use Floor Worker", "floor_worker"],
    ["Use Cashier", "cashier"],
  ]) {
    const previousSession = screen
      .getByTestId("current-role")
      .getAttribute("data-session-id");
    await user.click(screen.getByRole("button", { name: account }));
    await waitFor(
      () => {
        const marker = screen.getByTestId("current-role");
        if (
          marker.textContent !== role ||
          marker.getAttribute("data-session-id") === previousSession
        )
          throw new Error("Waiting for the actual switched session.");
      },
      { timeout: 3000 },
    );
    const section = await screen.findByRole(
      "region",
      { name: "Dates" },
      { timeout: 3000 },
    );
    expect(within(section).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(section).queryByRole("form")).not.toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: "Add" }),
    ).not.toBeInTheDocument();
    expect(section).toHaveTextContent("Expires 2026-11-04 · North York");
    expect(
      JSON.stringify(
        (await currentFixture.readCanonical()).expiry.filter(
          (entry) => entry.source === "manual",
        ),
      ),
    ).toBe(retained);
  }
});
