import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { configSeed } from "../../config";
import { ReceivedField } from "./ReceivedField";

vi.mock("../../store", () => ({
  useDemo: () => ({
    state: { config: configSeed },
    demoUsers: [],
    t: (en: string) => en,
  }),
  useConfiguredTimeZone: () => configSeed.company.timezone,
}));
afterEach(cleanup);
it("offers one-click alternate handwriting time and retains its supporting row after acknowledgment", () => {
  const onReceived = vi.fn();
  const props = {
    date: "2026-08-11",
    time: "14:15",
    employee: "Fictional Receiver",
    source: "handwriting" as const,
    alternative: "2026-08-11T06:15:00.000Z",
    onReceived,
    onEmployee: vi.fn(),
  };
  const view = render(<ReceivedField {...props} />);
  expect(screen.getByText("Read as 14:15 from the handwriting")).toBeVisible();
  const button = screen.getByRole("button", { name: "Use 02:15 instead" });
  const choice = button.closest(".receiving-received-choice");
  expect(choice).not.toBeNull();
  expect(button.closest(".receiving-received-summary")).toBeNull();
  fireEvent.click(button);
  expect(onReceived).toHaveBeenCalledExactlyOnceWith("2026-08-11", "02:15");
  view.rerender(
    <ReceivedField {...props} time="02:15" alternative={undefined} />,
  );
  expect(
    screen.getByRole("button", { name: "Use 02:15 instead" }),
  ).toBeDisabled();
  expect(
    screen
      .getByRole("button", { name: "Use 02:15 instead" })
      .closest(".receiving-received-choice"),
  ).toBe(choice);
  expect(screen.getByText("Read as 14:15 from the handwriting")).toBeVisible();
});
