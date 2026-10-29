import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SecondSignInStep from "./AuthSteps.e1";
import type { RoleId } from "./authority-types";
import { initialState } from "./e1-bootstrap";

let role: RoleId = "manager";
let state = initialState();
const completeSecondStep = vi.fn();
vi.mock("./store", () => ({
  useDemo: () => ({
    authStage: "second_step_challenge",
    secondStepMethod: "passkey",
    setupSecondStep: vi.fn(),
    completeSecondStep,
    signOut: vi.fn(),
    user: { name_en: "Fictional Person", role },
    state,
    t: (_en: string, fa: string) => fa,
  }),
}));
afterEach(() => {
  cleanup();
  role = "manager";
  state = initialState();
  vi.clearAllMocks();
});

it.each([
  ["owner", "دارندهٔ نمونه"],
  ["branch_supervisor", "سرپرست ویژهٔ شعبه"],
] as const)(
  "uses the configured Persian %s label in the second-step explanation",
  (selectedRole, label) => {
    role = selectedRole;
    state.config.roles.find((definition) => definition.key === role)!.label_fa =
      label;
    render(<SecondSignInStep />);
    expect(
      screen.getByText(`برای ابزارهای ${label} یک مرحلهٔ دوم لازم است.`),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "تأیید هویت" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "ادامه با کلید ورود" }),
    ).toBeVisible();
    expect(completeSecondStep).not.toHaveBeenCalled();
  },
);

it("retains the approved ordinary Manager subtitle in Persian", () => {
  render(<SecondSignInStep />);
  expect(
    screen.getByText("برای ابزارهای مدیر یک مرحلهٔ دوم لازم است."),
  ).toBeVisible();
  expect(completeSecondStep).not.toHaveBeenCalled();
});
