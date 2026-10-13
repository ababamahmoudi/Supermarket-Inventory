import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { authenticatedTestActor } from "../authority-test-fixture";
import { SettingsConfigurationGate } from "../SettingsConfigurationGate";
import i18n from "../i18n";
import { saveDateReminderSettings } from "../date-reminder-settings";
import { productReminderDays } from "../date-tracking";
import { ReturnsSettings } from "./ReturnsSettings";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
describe("C6 configurable reminders and supplier document controls", () => {
  it("shows all invalid day fields, links to them, and saves valid values without changing money or prices", async () => {
    const fixture = await authenticatedProviderFixture({
      state: initialState,
      role: "manager",
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <SettingsConfigurationGate>
          <ReturnsSettings />
        </SettingsConfigurationGate>
      </DemoProvider>,
    );
    await screen.findByLabelText("Default date reminder (days)");
    const original = await fixture.readCanonical();
    const previous = JSON.stringify({
      ledger: original.ledger,
      products: original.products,
    });
    fireEvent.change(screen.getByLabelText("Default date reminder (days)"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Waiting-credit reminder (days)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const list = screen.getByRole("alert", { name: "What's missing" });
    expect(within(list).getAllByRole("link")).toHaveLength(2);
    fireEvent.click(
      within(list).getByRole("link", {
        name: "Enter zero or more whole days.",
      }),
    );
    expect(screen.getByLabelText("Default date reminder (days)")).toHaveFocus();
    const invalidSaved = await fixture.readCanonical();
    expect(
      JSON.stringify({
        ledger: invalidSaved.ledger,
        products: invalidSaved.products,
      }),
    ).toBe(previous);
    fireEvent.change(screen.getByLabelText("Default date reminder (days)"), {
      target: { value: "7" },
    });
    expect(
      screen.getByLabelText("Default date reminder (days)"),
    ).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.getByLabelText("Waiting-credit reminder (days)"),
    ).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Waiting-credit reminder (days)"), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(
      async () =>
        expect(
          (await fixture.readCanonical()).config.expiry.expiring_soon_days,
        ).toBe(7),
      { timeout: 3000 },
    );
    const saved = await fixture.readCanonical();
    expect(saved.config.supplier_documents).toEqual({
      return_memo: "en",
      supplier_order: "en",
    });
    expect(
      saved.activity.some(
        (entry: { action: string }) =>
          entry.action === "Date tracking settings changed",
      ),
    ).toBe(true);
    expect(
      JSON.stringify({ ledger: saved.ledger, products: saved.products }),
    ).toBe(previous);
  });
  it("protects the company default and retains explicit per-product overrides", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const floorWorker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    const foreign = structuredClone(state);
    foreign.config.company.seed_key = "other-company";
    const foreignManager = authenticatedTestActor(foreign, "manager");
    const product = state.products.find((item) => item.code === "0006")!;
    product.date_reminder_days = 5;
    saveDateReminderSettings(state, manager, 7);
    expect(productReminderDays(state, product)).toBe(5);
    expect(
      productReminderDays(state, { ...product, date_reminder_days: undefined }),
    ).toBe(7);
    const before = JSON.stringify(state);
    expect(() => saveDateReminderSettings(state, floorWorker, 3)).toThrow(
      "capability",
    );
    expect(() => saveDateReminderSettings(state, foreignManager, 3)).toThrow(
      "company",
    );
    expect(() => saveDateReminderSettings(state, manager, -1)).toThrow(
      "whole days",
    );
    expect(JSON.stringify(state)).toBe(before);
  });
});
