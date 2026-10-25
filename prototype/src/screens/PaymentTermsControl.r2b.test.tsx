import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentTermsControl } from "./PaymentTermsControl";
const locale = vi.hoisted(() => ({ language: "en" as "en" | "fa" }));
vi.mock("../store", () => ({
  useDemo: () => ({
    t: (en: string, fa: string) => (locale.language === "en" ? en : fa),
  }),
}));
afterEach(() => {
  cleanup();
  locale.language = "en";
});
function Terms({ initial = "Net 30" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PaymentTermsControl
        id="test-terms"
        value={value}
        onChange={setValue}
        label={locale.language === "en" ? "Payment terms" : "شرایط پرداخت"}
      />
      <output aria-label="stored terms">{value}</output>
    </>
  );
}
it.each(["en", "fa"] as const)(
  "keeps calendar Monthly distinct from Net30 in %s",
  async (language) => {
    locale.language = language;
    const user = userEvent.setup();
    render(<Terms />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveTextContent(
      language === "en" ? "Net 30 (30 days)" : "خالص 30 (30 روز)",
    );
    await user.click(select);
    await user.click(
      screen.getByRole("option", {
        name:
          language === "en"
            ? "Monthly (due the 1st of next month)"
            : "ماهانه (سررسید اول ماه بعد)",
      }),
    );
    expect(screen.getByLabelText("stored terms")).toHaveTextContent("Monthly");
    expect(select).toHaveTextContent(language === "en" ? "Monthly" : "ماهانه");
  },
);
it("keeps Other and its custom number in one field and retains quickly typed20", async () => {
  const user = userEvent.setup();
  render(<Terms initial="Net 17" />);
  const select = screen.getByRole("combobox"),
    days = screen.getByRole("textbox", { name: "Number of days" });
  expect(days.closest(".field")).toBe(select.closest(".field"));
  expect(document.querySelectorAll(".field")).toHaveLength(1);
  await user.clear(days);
  await user.type(days, "20");
  expect(screen.getByRole("textbox", { name: "Number of days" })).toBe(days);
  expect(days).toHaveValue("20");
  expect(screen.getByLabelText("stored terms")).toHaveTextContent("Net 20");
});
