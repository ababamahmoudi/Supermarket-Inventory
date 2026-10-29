import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyApprovedPrice } from "../approvals";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { createAuthenticationService } from "../authentication-service";
import i18n from "../i18n";
import { LANGUAGE_KEY } from "../auth-preferences.e1";
import { DemoProvider, initialState, useDemo } from "../store";
import type { DemoState } from "../types";
import Alerts from "./Alerts";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});

const fixtures: { dispose(): void }[] = [];
afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.unstubAllGlobals();
});
function Harness({ otherChange }: { otherChange(): Promise<void> }) {
  const { actor } = useDemo();
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState("");
  if (!actor) return null;
  return (
    <>
      <button
        onClick={() => {
          void otherChange()
            .then(() => setRecorded(true))
            .catch((failure) => setError(String(failure)));
        }}
      >
        Record another employee's price change
      </button>
      {recorded && <output>Other employee price saved</output>}
      {error && <p role="alert">{error}</p>}
      <Alerts />
    </>
  );
}

it("announces a stale price comparison at its alert and clears it when a fresh price is chosen", async () => {
  const user = userEvent.setup();
  const state = initialState();
  const conflict = state.alerts.find(
    (alert) => alert.type === "price_conflict",
  );
  if (!conflict) throw new Error("The demo price conflict is missing");
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
  });
  fixtures.push(fixture);
  // The second writer receives a separate genuine Owner SID. It neither
  // replaces this Manager session nor supplies a caller-created actor.
  const service = createAuthenticationService({
    repository: fixture.repository,
  });
  const other = await service.switchDemoUser(
    state.config.company.seed_key,
    "owner",
  );
  const otherChange = async () => {
    await fixture.repository.runBusinessCommand<DemoState, void>(
      other.identity,
      (draft, actualOwner) =>
        applyApprovedPrice(
          draft,
          actualOwner,
          conflict.product_code,
          "2.49",
          "branch",
          "Branch 1",
        ),
    );
  };
  render(
    <DemoProvider options={fixture.options}>
      <Harness otherChange={otherChange} />
    </DemoProvider>,
  );
  await user.click(
    await screen.findByRole(
      "button",
      { name: /Black Tea/ },
      { timeout: 10000 },
    ),
  );
  await user.click(
    (
      await screen.findAllByRole("button", { name: "Apply this price to all" })
    )[0],
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Apply price to all branches",
  });
  expect(within(dialog).queryByText("Warehouse")).not.toBeInTheDocument();
  // Another employee can change the record while this user's confirmation is open.
  await user.click(
    screen.getByRole("button", {
      name: "Record another employee's price change",
    }),
  );
  await screen.findByText("Other employee price saved");
  await user.click(
    within(dialog).getByRole("button", { name: "Apply price to all branches" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Prices changed. Review the latest conflict and choose the price again.",
  );
  await user.click(
    screen.getAllByRole("button", { name: "Apply this price to all" })[0],
  );
  await screen.findByRole("dialog", { name: "Apply price to all branches" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each(["en", "fa"] as const)(
  "keeps Show resolved in the card when no pending alerts remain in %s",
  async (language) => {
    await i18n.changeLanguage(language);
    localStorage.setItem(LANGUAGE_KEY, language);
    const state = initialState();
    const resolved = state.alerts.find(
      (item) => item.type === "price_conflict",
    )!;
    state.alerts = [{ ...resolved, status: "resolved" }];
    state.expiry = [];
    state.sales = [];
    state.sale_requests = [];
    const fixture = await authenticatedProviderFixture({
      state,
      role: "manager",
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <Alerts />
      </DemoProvider>,
    );
    const title = await screen.findByRole(
      "heading",
      {
        name: language === "fa" ? "همه هشدارها" : "All alerts",
      },
      { timeout: 10000 },
    );
    const card = title.closest("section")!;
    const toggle = within(card).getByRole("button", {
      name: language === "fa" ? "نمایش حل‌شده‌ها" : "Show resolved",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(card.querySelector(`[data-alert-id="${resolved.id}"]`)).toBeNull();
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      card.querySelector(`[data-alert-id="${resolved.id}"]`),
    ).not.toBeNull();
  },
);
