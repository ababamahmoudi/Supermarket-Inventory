import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { ProgressStrip } from "./ProgressStrip";
const locale = vi.hoisted(() => ({ fa: false }));
vi.mock("../../store", () => ({
  useDemo: () => ({ t: (en: string, fa: string) => (locale.fa ? fa : en) }),
}));
it.each([0, 1, 2])(
  "counts %i open checks with English singular/plural and Persian wording",
  (count) => {
    const invoice = {
      low_confidence_fields: ["tax", "subtotal"].slice(0, count),
      lines: [],
      subtotal: "0.00",
      tax: "0.00",
      final_total: "0.00",
    } as unknown as InvoiceReadDTO;
    const props = {
      invoice,
      onNext: () => {},
      missing: "",
      onPost: () => {},
      onAttemptPost: () => {},
    };
    locale.fa = false;
    const { rerender } = render(<ProgressStrip {...props} />);
    expect(
      screen.getByText(
        `${count} highlighted ${count === 1 ? "field" : "fields"}`,
      ),
    ).toBeInTheDocument();
    locale.fa = true;
    rerender(<ProgressStrip {...props} />);
    expect(screen.getByText(`${count} فیلد مشخص‌شده`)).toBeInTheDocument();
  },
);
