import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { SettingsConfigurationGate } from "../SettingsConfigurationGate";
import { useSettingsConfiguration } from "../settings-configuration";
import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";
import PricingSettings from "./PricingSettings";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});

function Harness() {
  const configuration = useSettingsConfiguration();
  return (
    <>
      <PricingSettings />
      <output data-testid="saved-categories">
        {configuration.pricing_categories
          .map((category) => category.label)
          .join(",")}
      </output>
    </>
  );
}

async function show() {
  const fixture = await authenticatedProviderFixture({
    state: initialState,
    role: "manager",
  });
  fixtures.push(fixture);
  const user = userEvent.setup();
  render(
    <DemoProvider options={fixture.options}>
      <SettingsConfigurationGate>
        <Harness />
      </SettingsConfigurationGate>
    </DemoProvider>,
  );
  // The protected Settings DTO is an actual second asynchronous read after
  // session resume; do not exercise the form before its affordance mounts.
  await renderedUiReady(
    () => screen.queryByRole("button", { name: "Add category" }) !== null,
  );
  await screen.findByRole("button", { name: "Add category" });
  return user;
}

describe("Pricing field validation", () => {
  it("clears only the category field that changed, then saves the valid category", async () => {
    const user = await show();
    await user.click(screen.getByRole("button", { name: "Add category" }));
    const dialog = screen.getByRole("dialog", { name: "Add category" });
    await user.click(
      within(dialog).getByRole("button", { name: "Apply category" }),
    );
    const name = within(dialog).getByRole("textbox", {
      name: "Name (English)",
    });
    expect(name).toHaveAttribute("aria-invalid", "true");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name (Persian)" }),
      "منجمد",
    );
    expect(name).toHaveAttribute("aria-invalid", "true");
    await user.type(name, "Frozen food");
    expect(name).toHaveAttribute("aria-invalid", "false");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();

    const divisor = within(dialog).getByRole("textbox", {
      name: "Cost divisor",
    });
    await user.clear(divisor);
    await user.type(divisor, "0");
    await user.click(
      within(dialog).getByRole("button", { name: "Apply category" }),
    );
    expect(divisor).toHaveAttribute("aria-invalid", "true");
    await user.type(name, " premium");
    expect(divisor).toHaveAttribute("aria-invalid", "true");
    await user.clear(divisor);
    await user.type(divisor, "0.65");
    expect(divisor).toHaveAttribute("aria-invalid", "false");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Apply category" }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByTestId("saved-categories")).toHaveTextContent(
        "Frozen food premium",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps a rounding error beside its fields, without blaming cost, until those fields change", async () => {
    const user = await show();
    const upper = screen.getAllByRole("textbox", { name: "Below" })[0];
    await user.clear(upper);
    await user.type(upper, "0.22");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const from = screen.getAllByRole("textbox", { name: "From" })[0];
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("textbox", { name: "Unit cost before tax" }),
    ).toHaveAttribute("aria-invalid", "false");
    const correction = screen.getAllByRole("textbox", {
      name: "From price",
    })[0];
    await user.clear(correction);
    await user.type(correction, "2.48");
    expect(from).toHaveAttribute("aria-invalid", "true");
    const divisor = screen.getByRole("textbox", {
      name: "Cost divisor for Grocery",
    });
    await user.clear(divisor);
    await user.type(divisor, "0.70");
    expect(divisor).toHaveAttribute("aria-invalid", "false");
    expect(from).toHaveAttribute("aria-invalid", "true");
    await user.clear(upper);
    await user.type(upper, "0.23");
    expect(from).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("places a minimum-price error beside Minimum result and clears it on editing that value", async () => {
    const user = await show();
    const minimum = screen.getByRole("textbox", { name: "Minimum result" });
    await user.clear(minimum);
    await user.type(minimum, "-1");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(minimum).toHaveAttribute("aria-invalid", "true");
    await user.type(
      screen.getByRole("textbox", { name: "Unit cost before tax" }),
      "2",
    );
    expect(minimum).toHaveAttribute("aria-invalid", "true");
    await user.clear(minimum);
    await user.type(minimum, "0.49");
    expect(minimum).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
