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
function Terms({
  initial = "Net 30",
  initiallyDefaulted = false,
}: {
  initial?: string;
  initiallyDefaulted?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [defaulted, setDefaulted] = useState(initiallyDefaulted);
  return (
    <>
      <PaymentTermsControl
        id="test-terms"
        value={value}
        onChange={(next) => {
          setValue(next);
          setDefaulted(false);
        }}
        defaulted={defaulted}
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
it.each(["en", "fa"] as const)(
  "shows a quiet Monthly default in %s and removes it after an explicit choice",
  async (language) => {
    locale.language = language;
    const user = userEvent.setup();
    render(<Terms initial="Monthly" initiallyDefaulted />);
    const hint =
      language === "en"
        ? "Default: first of next month"
        : "پیش‌فرض: اول ماه بعد";
    expect(screen.getByText(hint)).toBeVisible();
    expect(document.querySelector(".invoice-payment-terms")).not.toHaveClass(
      "please-check-field",
    );
    expect(screen.queryByText(/earlier invoice|فاکتور قبلی/)).toBeNull();
    await user.click(screen.getByRole("combobox"));
    await user.click(
      screen.getByRole("option", {
        name: language === "en" ? "Net 30 (30 days)" : "خالص 30 (30 روز)",
      }),
    );
    expect(screen.getByLabelText("stored terms")).toHaveTextContent("Net 30");
    expect(screen.queryByText(hint)).toBeNull();
  },
);
it("describes an alternate configured default truthfully", () => {
  render(<Terms initial="Net 45" initiallyDefaulted />);
  expect(screen.getByText("Default: Net 45")).toBeVisible();
  expect(screen.queryByText("Default: first of next month")).toBeNull();
});
