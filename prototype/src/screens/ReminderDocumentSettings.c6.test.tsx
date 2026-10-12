import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProvider, initialState, STORAGE_KEY } from "../store";
import { SESSION_KEY } from "../auth";
import { saveDateReminderSettings } from "../date-reminder-settings";
import { productReminderDays } from "../date-tracking";
import { ReturnsSettings } from "./ReturnsSettings";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
});
describe("C6 configurable reminders and supplier document controls", () => {
  it("shows all invalid day fields, links to them, and saves valid values without changing money or prices", () => {
    render(
      <DemoProvider>
        <ReturnsSettings />
      </DemoProvider>,
    );
    const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const previous = JSON.stringify({
      ledger: saved().ledger,
      products: saved().products,
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
    expect(
      JSON.stringify({ ledger: saved().ledger, products: saved().products }),
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
    expect(saved().config.expiry.expiring_soon_days).toBe(7);
    expect(saved().config.supplier_documents).toEqual({
      return_memo: "en",
      supplier_order: "en",
    });
    expect(
      saved().activity.some(
        (entry: { action: string }) =>
          entry.action === "Date tracking settings changed",
      ),
    ).toBe(true);
    expect(
      JSON.stringify({ ledger: saved().ledger, products: saved().products }),
    ).toBe(previous);
  });
  it("protects the company default and retains explicit per-product overrides", () => {
    const state = initialState();
    const context = {
      company_id: state.config.company.seed_key,
      role: "supervisor" as const,
      branch: "all",
      actor: "Reminder reviewer",
    };
    const product = state.products.find((item) => item.code === "0006")!;
    product.date_reminder_days = 5;
    saveDateReminderSettings(state, context, 7);
    expect(productReminderDays(state, product)).toBe(5);
    expect(
      productReminderDays(state, { ...product, date_reminder_days: undefined }),
    ).toBe(7);
    const before = JSON.stringify(state);
    expect(() =>
      saveDateReminderSettings(state, { ...context, role: "floor_worker" }, 3),
    ).toThrow("supervisor");
    expect(() =>
      saveDateReminderSettings(
        state,
        { ...context, company_id: "other-company" },
        3,
      ),
    ).toThrow("scope");
    expect(() => saveDateReminderSettings(state, context, -1)).toThrow(
      "whole days",
    );
    expect(JSON.stringify(state)).toBe(before);
  });
});
