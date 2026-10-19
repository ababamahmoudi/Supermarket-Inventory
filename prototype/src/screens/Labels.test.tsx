import {
  configure,
  getConfig,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, useDemo } from "../store";
import i18n from "../i18n";
import { Labels } from "./Labels";
import { initialState } from "../e1-bootstrap";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";

const previousAsyncTimeout = getConfig().asyncUtilTimeout;
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
beforeEach(() => {
  configure({ asyncUtilTimeout: 3000 });
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
  configure({ asyncUtilTimeout: previousAsyncTimeout });
});
function ReadyLabels() {
  const { actor } = useDemo();
  return actor ? <Labels /> : null;
}
const show = async () => {
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "floor_worker",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <ReadyLabels />
    </DemoProvider>,
  );
  await screen.findByRole("tab", { name: "Templates" });
};

describe("Label template validation and ordinary HTTP", () => {
  it("saves valid dimensions when crypto.randomUUID is unavailable", async () => {
    const user = userEvent.setup();
    await show();
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: crypto.subtle,
    });
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: "New template" }));
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Saved template" }),
      ).toHaveTextContent("Template 1"),
    );
    const saved = await fixture.readCanonical();
    expect(saved.templates).toHaveLength(3);
    const created = saved.templates.find(
      (item: { name: string }) => item.name === "Template 1",
    );
    if (!created) throw new Error("The committed template is missing");
    expect(created.id).toMatch(/^label-template-/);
    expect(created.width).toBe(60);
  });
  it("explains a missing name, the specific zero dimension, and A4 capacity", async () => {
    const user = userEvent.setup();
    await show();
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: "New template" }));
    await user.clear(screen.getByLabelText("Template name"));
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(
      screen.getByRole("alert", { name: "What's missing" }),
    ).toHaveTextContent("Enter a template name.");
    await user.click(
      screen.getByRole("link", { name: "Enter a template name." }),
    );
    expect(screen.getByLabelText("Template name")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Template name"), {
      target: { value: "Shelf" },
    });
    fireEvent.change(screen.getByLabelText("Width (mm)"), {
      target: { value: "0" },
    });
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(
      screen.getByRole("alert", { name: "What's missing" }),
    ).toHaveTextContent("Width must be greater than zero.");
    fireEvent.change(screen.getByLabelText("Width (mm)"), {
      target: { value: "220" },
    });
    await user.click(screen.getByRole("button", { name: /^Save template$/ }));
    expect(
      screen.getByRole("alert", { name: "What's missing" }),
    ).toHaveTextContent("Only 0 labels fit on A4.");
    expect((await fixture.readCanonical()).templates).toHaveLength(2);
  });
  it("offers Regular and Promo immediately, archives without deleting and restores the same preset", async () => {
    const user = userEvent.setup();
    await show();
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
    await screen.findByRole("button", { name: "Restore template" });
    expect(screen.getByRole("button", { name: "Save template" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save template" }));
    expect(
      screen.getByRole("alert", { name: "What's missing" }),
    ).toHaveTextContent("Restore it before editing or printing.");
    await user.click(
      screen.getByRole("link", { name: /This template is archived/ }),
    );
    expect(
      screen.getByRole("button", { name: "Restore template" }),
    ).toHaveFocus();
    expect((await fixture.readCanonical()).templates).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Restore template" }));
    await screen.findByRole("button", { name: "Archive template" });
    expect(screen.getByRole("button", { name: "Save template" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^Delete/ }),
    ).not.toBeInTheDocument();
  });
});
