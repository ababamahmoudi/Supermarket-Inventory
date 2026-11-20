import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { configuredRoleLabel } from "./role-config";
import i18n from "./i18n";
import { DemoProvider, initialState } from "./store";
import { Approvals } from "./screens/Approvals";
import { Dashboard } from "./screens/Dashboard";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});

describe("C3 approval presentation and archived handover notes", () => {
  it("omits archived notes after Undo while retaining the other handover notes", async () => {
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
    const fixture = await authenticatedProviderFixture({
      state,
      role: "manager",
      actorOptions: { selection: { kind: "all_locations" } },
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <Dashboard />
      </DemoProvider>,
    );
    const heading = await screen.findByRole(
      "heading",
      {
        name: `Notes for ${configuredRoleLabel(state.config.roles, "manager", "en")}`,
      },
      { timeout: 10000 },
    );
    const notes = within(heading.closest(".card") as HTMLElement);
    expect(notes.queryByText("Archived handover note")).not.toBeInTheDocument();
    expect(notes.getByText("Current handover note")).toBeVisible();
  });

  it("clears the reason error on editing its field while keeping the review pending", async () => {
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
    const fixture = await authenticatedProviderFixture({
      state,
      role: "manager",
      actorOptions: { selection: { kind: "all_locations" } },
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <Approvals />
      </DemoProvider>,
    );
    const keepPrice = await screen.findByRole("button", {
      name: "Keep approved price",
    });
    const reviewedCard = within(
      keepPrice.closest(".approval-detail-row") as HTMLElement,
    );
    fireEvent.click(keepPrice);
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
    expect(
      reviewedCard.getByText("Pending", { selector: ".badge" }),
    ).toBeVisible();
  });
});
