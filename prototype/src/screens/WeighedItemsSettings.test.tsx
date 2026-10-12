import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProvider, STORAGE_KEY } from "../store";
import { SESSION_KEY } from "../auth";
import UndoToasts from "../UndoToasts";
import i18n from "../i18n";
import WeighedItemsSettings from "./WeighedItemsSettings";
import History from "./History";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
});

describe("Weighed items settings and History", () => {
  it("keeps Save quiet and restores live settings through History without changing approved product prices", async () => {
    render(
      <DemoProvider>
        <WeighedItemsSettings />
        <History />
        <UndoToasts />
      </DemoProvider>,
    );
    const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const products = stored().products;
    fireEvent.click(screen.getByLabelText("Main display unit"));
    fireEvent.click(screen.getByRole("option", { name: /^kg$/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Show second unit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(stored().config.weighed_items.main_display_unit).toBe("kg"),
    );
    expect(screen.getByLabelText("Main display unit")).toHaveTextContent("kg");
    expect(
      screen.getByRole("switch", { name: "Show second unit" }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: /^Undo$/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Revert$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Revert change$/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("Main display unit")).toHaveTextContent(
        "lb",
      ),
    );
    expect(
      screen.getByRole("switch", { name: "Show second unit" }),
    ).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(stored().products).toEqual(products);
    expect(
      stored().activity.some(
        (entry: { reversal_kind?: string }) => entry.reversal_kind === "revert",
      ),
    ).toBe(true);
  });
});
