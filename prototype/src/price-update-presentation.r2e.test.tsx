import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { configSeed } from "./config";
import { PriceUpdateChange } from "./price-update-presentation";
import { priceUpdateReasonLabel } from "./price-update-copy";
import type { PriceUpdateTask } from "./price-updates";

const display = vi.hoisted(() => ({ language: "en" as "en" | "fa" }));
vi.mock("./store", () => ({
  useDemo: () => ({
    state: { config: configSeed },
    lang: display.language,
    t: (en: string, fa: string) => (display.language === "fa" ? fa : en),
  }),
}));
afterEach(cleanup);
const task = (old: string | null): PriceUpdateTask =>
  ({
    old_price: { price: old, regular_price: old, unit: "lb" },
    new_price: { price: "6.49", regular_price: "6.49", unit: "lb" },
  }) as PriceUpdateTask;

it.each(["en", "fa"] as const)(
  "identifies a first price without a missing-price arrow in %s",
  (language) => {
    display.language = language;
    const { container } = render(<PriceUpdateChange task={task(null)} />);
    expect(
      screen.getByText(language === "fa" ? "کالای جدید" : "New item"),
    ).toBeVisible();
    expect(container).toHaveTextContent("$6.49/lb");
    expect(container).not.toHaveTextContent("—");
    expect(container).not.toHaveTextContent("→");
    expect(container.querySelector("del")).toBeNull();
  },
);
it("keeps a genuine previous zero price and the frozen new price", () => {
  display.language = "en";
  const { container } = render(<PriceUpdateChange task={task("0.00")} />);
  expect(container.querySelector("del")).toHaveTextContent("$0.00/lb");
  expect(container).toHaveTextContent("→");
  expect(container).toHaveTextContent("$6.49/lb");
  expect(screen.queryByText("New item")).not.toBeInTheDocument();
});
it.each([
  [
    "Package price recalculated",
    "Package price updated",
    "قیمت بسته به‌روز شد",
  ],
  ["Approve product", "New product approved", "کالای جدید تأیید شد"],
  [
    "Edit and approve product",
    "Product edits approved",
    "ویرایش کالا تأیید شد",
  ],
  ["Approve price", "Price change approved", "تغییر قیمت تأیید شد"],
  ["Start sale", "Sale started", "حراج شروع شد"],
  ["End sale", "Sale ended", "حراج پایان یافت"],
])("describes the completed %s decision", (reason, english, persian) => {
  expect(priceUpdateReasonLabel(reason, "en")).toBe(english);
  expect(priceUpdateReasonLabel(reason, "fa")).toBe(persian);
});
