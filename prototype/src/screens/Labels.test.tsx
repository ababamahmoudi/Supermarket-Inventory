import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, STORAGE_KEY } from "../store";
import i18n from "../i18n";
import { Labels } from "./Labels";
import { SESSION_KEY } from "../auth";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "floorworker",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
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
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: "New template" }));
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Template 1");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.templates).toHaveLength(3);
    const created = saved.templates.find(
      (item: { name: string }) => item.name === "Template 1",
    );
    expect(created.id).toMatch(/^label-template-/);
    expect(created.width).toBe(60);
  });
  it("explains a missing name, the specific zero dimension, and A4 capacity", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: "New template" }));
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
    ).toHaveLength(2);
  });
  it("offers Regular and Promo immediately, archives without deleting and restores the same preset", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    expect(
      screen.getByRole("combobox", { name: "Saved template" }),
    ).toHaveTextContent("Regular");
    await user.click(screen.getByRole("combobox", { name: "Saved template" }));
    await user.click(screen.getByRole("option", { name: "Promo" }));
    expect(screen.getByLabelText("Width (mm)")).toHaveValue("210");
    expect(screen.getByLabelText("Height (mm)")).toHaveValue("148.5");
    expect(screen.getByText(/2 labels per sheet/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Archive template" }));
    expect(
      screen.getByRole("button", { name: "Save template" }),
    ).toBeDisabled();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).templates,
    ).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Restore template" }));
    expect(screen.getByRole("button", { name: "Save template" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^Delete/ }),
    ).not.toBeInTheDocument();
  });
});
