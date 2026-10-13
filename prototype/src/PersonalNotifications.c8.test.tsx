import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { SESSION_KEY } from "./auth";
import i18n from "./i18n";
import { PersonalNotifications } from "./PersonalNotifications";
import { requestSale, saleDateAfter, saleStoreDate } from "./sales";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";
import { Menu } from "./ui";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  void i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 2",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
});

function Harness() {
  const { branch, state } = useDemo();
  return (
    <>
      <output aria-label="Selected location">{branch}</output>
      <output aria-label="Unread personal notifications">
        {(state.notifications ?? []).filter((item) => !item.read_at).length}
      </output>
      <Menu label="Notifications">
        <PersonalNotifications />
      </Menu>
    </>
  );
}

it("opens the notified location before navigating to its approval and marks the actual record read", async () => {
  const state = initialState();
  state.notifications = [];
  const today = saleStoreDate(state.config, "Branch 1");
  requestSale(
    state,
    {
      company_id: state.config.company.seed_key,
      role: "floor_worker",
      actor: "Demo Floor Worker",
      username: "floorworker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
      notification_recipients: [
        {
          username: "supervisor",
          role: "supervisor",
          allowed_branches: ["Branch 1", "Branch 2", "Branch 3"],
        },
      ],
    },
    {
      product_code: "0006",
      mode: "sale",
      scope: "current",
      price: "1.19",
      price_unit: "each",
      branches: ["Branch 1"],
      starts_on: today,
      last_day: saleDateAfter(today, 7),
      accept_below_margin: false,
      below_cost_reason: "",
      add_labels: false,
      why: "slow seller",
    },
  );
  const notification = state.notifications![0];
  expect(notification.branch).toBe("Branch 1");
  expect(notification.target_username).toBe("supervisor");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  expect(screen.getByLabelText("Selected location")).toHaveTextContent(
    "Branch 2",
  );
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: /Sale request.*Lavash Bread/ }),
  );
  await waitFor(() => {
    expect(screen.getByLabelText("Selected location")).toHaveTextContent(
      "Branch 1",
    );
    expect(
      screen.getByLabelText("Unread personal notifications"),
    ).toHaveTextContent("0");
  });
  expect(window.location.hash).toBe(`#${notification.href}`);
  expect(window.location.hash).toMatch(/^#approvals/);
});
