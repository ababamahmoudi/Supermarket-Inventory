import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ReadingCheckProvider } from "../../InvoiceReadingReview";
import { ReceivedField } from "./ReceivedField";
vi.mock("../../store", () => ({
  useDemo: () => ({
    state: { config: { company: { timezone: "UTC" } } },
    demoUsers: [],
    t: (en: string) => en,
  }),
}));
it.each([
  {
    source: "handwriting" as const,
    hint: "Taken from the handwriting on the invoice",
  },
  {
    source: "invoice_date" as const,
    hint: "Set to the invoice date; change it if delivery was another day",
  },
  {
    source: "unresolved" as const,
    hint: "The AI wasn't sure about this. Compare it with the photo.",
  },
])(
  "uses an accurate Received explanation for $source",
  async ({ source, hint }) => {
    const user = userEvent.setup();
    render(
      <ReadingCheckProvider
        fields={["received_at"]}
        idPrefix="received-test"
        onAcknowledge={() => {}}
      >
        <ReceivedField
          source={source}
          date="2026-10-21"
          time="12:00"
          employee="Invented Receiver"
          onReceived={() => {}}
          onEmployee={() => {}}
        />
      </ReadingCheckProvider>,
    );
    await user.hover(
      screen.getByRole("img", { name: "Check this against the original" }),
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(hint);
    if (source === "unresolved")
      expect(screen.getByRole("tooltip")).not.toHaveTextContent(
        "Set to the invoice date",
      );
    await user.unhover(
      screen.getByRole("img", { name: "Check this against the original" }),
    );
    await user.click(screen.getByRole("button", { name: /^Change$/ }));
    expect(
      screen.getByRole("dialog", { name: "Change received details" }),
    ).toHaveClass("ui-form-surface");
  },
);
