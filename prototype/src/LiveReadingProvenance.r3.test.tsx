import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveReadingProvenance } from "./LiveReadingProvenance";
import type { InvoiceReadDTO } from "./invoice-projections";

let role = "manager";
vi.mock("./store", () => ({
  useDemo: () => ({
    actor: { role },
    state: { config: { company: { currency: "CAD" } } },
    t: (en: string) => en,
  }),
}));
const invoice = {
  reading_record: {
    source: "live",
    seconds: 84,
    reading_cost_usd: "0.11",
    models: ["Fictional Model One", "Fictional Model Two"],
  },
} as unknown as InvoiceReadDTO;
afterEach(() => {
  role = "manager";
  cleanup();
});
it("shows the actual USD fee independently of a CAD company and the returned duration/models", () => {
  render(<LiveReadingProvenance invoice={invoice} />);
  expect(screen.getByTestId("live-reading-provenance")).toHaveTextContent(
    "Read by AI · 84 s · $0.11 USD · Fictional Model One + Fictional Model Two",
  );
});
it.each(["floor_worker", "cashier", "branch_supervisor"])(
  "does not render private provenance for %s even if a caller supplies it",
  (otherRole) => {
    role = otherRole;
    render(<LiveReadingProvenance invoice={invoice} />);
    expect(screen.queryByTestId("live-reading-provenance")).toBeNull();
  },
);
it("does not invent model names when the reader returned none", () => {
  render(
    <LiveReadingProvenance
      invoice={{
        ...invoice,
        reading_record: { ...invoice.reading_record!, models: [] },
      }}
    />,
  );
  expect(screen.getByTestId("live-reading-provenance")).toHaveTextContent(
    "Read by AI · 84 s · $0.11 USD",
  );
  expect(screen.getByTestId("live-reading-provenance")).not.toHaveTextContent(
    "Model",
  );
});
