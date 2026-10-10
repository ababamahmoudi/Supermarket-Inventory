import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_KEY } from "./auth";
import i18n from "./i18n";
import { DemoProvider, initialState, STORAGE_KEY } from "./store";
import { Approvals } from "./screens/Approvals";
import { Dashboard } from "./screens/Dashboard";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "all",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
});

describe("C3 approval presentation and archived handover notes", () => {
  it("omits archived notes after Undo while retaining the other handover notes", () => {
    const state = initialState();
    const previous = state.notes.find(
      (note) => note.type === "note_to_supervisor",
    )!;
    state.notes.push({
      ...previous,
      id: "note:c3-archived",
      text: "Archived handover note",
      archived: true,
    });
    state.notes.push({
      ...previous,
      id: "note:c3-visible",
      text: "Current handover note",
      archived: false,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(
      <DemoProvider>
        <Dashboard />
      </DemoProvider>,
    );
    const notes = within(
      screen
        .getByRole("heading", { name: "Notes for Supervisor" })
        .closest(".card") as HTMLElement,
    );
    expect(notes.queryByText("Archived handover note")).not.toBeInTheDocument();
    expect(notes.getByText("Current handover note")).toBeVisible();
  });

  it("clears the reason error on editing its field while keeping the review pending", () => {
    const state = initialState();
    state.approvals = [
      {
        id: "margin:c3-field",
        company_id: state.config.company.seed_key,
        branch: "Branch 1",
        product_code: "0006",
        status: "pending",
        type: "margin_review",
        proposed_price: "1.99",
        unit_cost: "1.7000",
        margin: "0.1457",
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(
      <DemoProvider>
        <Approvals />
      </DemoProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Keep approved price" }),
    );
    expect(
      screen.getByText(
        "Add a reason before keeping the price or proposing an override.",
      ),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Keep the current approved price" },
    });
    expect(
      screen.queryByText(
        "Add a reason before keeping the price or proposing an override.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Pending", { selector: ".badge" })).toBeVisible();
  });
});
