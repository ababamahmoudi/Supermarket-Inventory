import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { SettingsConfigurationGate } from "../SettingsConfigurationGate";
import UndoToasts from "../UndoToasts";
import i18n from "../i18n";
import WeighedItemsSettings from "./WeighedItemsSettings";
import History from "./History";
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
describe("Weighed items settings and History", () => {
  it("keeps Save quiet and restores live settings through History without changing approved product prices", async () => {
    const fixture = await authenticatedProviderFixture({
      state: initialState,
      role: "manager",
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <SettingsConfigurationGate>
          <WeighedItemsSettings />
        </SettingsConfigurationGate>
        <History />
        <UndoToasts />
      </DemoProvider>,
    );
    await screen.findByLabelText("Main display unit", {}, { timeout: 3000 });
    const products = (await fixture.readCanonical()).products;
    fireEvent.click(screen.getByLabelText("Main display unit"));
    fireEvent.click(screen.getByRole("option", { name: /^kg$/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Show second unit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(
      async () =>
        expect(
          (await fixture.readCanonical()).config.weighed_items
            ?.main_display_unit,
        ).toBe("kg"),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(screen.getByLabelText("Main display unit")).toHaveTextContent(
          "kg",
        ),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole("switch", { name: "Show second unit" }),
        ).not.toBeChecked(),
      { timeout: 3000 },
    );
    expect(
      screen.queryByRole("button", { name: /^Undo$/ }),
    ).not.toBeInTheDocument();
    const settingsHistoryRow = (
      await screen.findByText(
        "Pricing rules changed",
        { selector: "td" },
        { timeout: 3000 },
      )
    ).closest("tr")!;
    expect(settingsHistoryRow).toHaveTextContent("Settings");
    fireEvent.click(
      within(settingsHistoryRow).getByRole("button", { name: /^Revert$/ }),
    );
    const revert = await waitFor(
      () => {
        const button = screen.getByRole("button", { name: /^Revert change$/ });
        if (button.hasAttribute("disabled"))
          throw new Error("Waiting for the protected History preview.");
        return button;
      },
      { timeout: 3000 },
    );
    fireEvent.click(revert);
    await waitFor(
      () =>
        expect(screen.getByLabelText("Main display unit")).toHaveTextContent(
          "lb",
        ),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole("switch", { name: "Show second unit" }),
        ).toBeChecked(),
      { timeout: 3000 },
    );
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect((await fixture.readCanonical()).products).toEqual(products);
    expect(
      (await fixture.readCanonical()).activity.some(
        (entry: { reversal_kind?: string }) => entry.reversal_kind === "revert",
      ),
    ).toBe(true);
  });
});
