import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, STORAGE_KEY } from "../store";
import i18n from "../i18n";
import { Labels } from "./Labels";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
});
afterEach(() => vi.unstubAllGlobals());
const show = () =>
  render(
    <DemoProvider>
      <Labels />
    </DemoProvider>,
  );

describe("Label template validation and ordinary HTTP", () => {
  it("saves valid dimensions when crypto.randomUUID is unavailable", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Template 1");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.templates).toHaveLength(1);
    expect(saved.templates[0].id).toMatch(/^label-template-/);
    expect(saved.templates[0].width).toBe(60);
  });
  it("explains a missing name, the specific zero dimension, and A4 capacity", async () => {
    const user = userEvent.setup();
    show();
    await user.clear(screen.getByLabelText("Template name"));
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a template name.",
    );
    fireEvent.change(screen.getByLabelText("Template name"), {
      target: { value: "Shelf" },
    });
    fireEvent.change(screen.getByLabelText("Width (mm)"), {
      target: { value: "0" },
    });
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Width must be greater than zero.",
    );
    fireEvent.change(screen.getByLabelText("Width (mm)"), {
      target: { value: "220" },
    });
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only 0 labels fit on A4.",
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).templates,
    ).toHaveLength(0);
  });
});
