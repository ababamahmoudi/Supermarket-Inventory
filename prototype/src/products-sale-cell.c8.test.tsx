import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DemoProvider, useDemo } from "./store";
import { Products } from "./screens/Catalog";
import { initialState } from "./e1-bootstrap";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import i18n from "./i18n";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "products";
  await i18n.changeLanguage("en");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.classList.contains("ui-data-table")
          ? 600
          : this.classList.contains("ui-button") ||
              this.classList.contains("ui-menu-trigger") ||
              this.classList.contains("table-row-link")
            ? 36
            : 0,
        height: 36,
      } as DOMRect;
    },
  );
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Harness() {
  const { actor } = useDemo();
  return actor ? <Products /> : null;
}
it.each(["manager", "floor_worker"] as const)(
  "retains the requested-sale amount beside the current charge when Status is omitted for %s",
  async (role) => {
    const user = userEvent.setup();
    fixture = await authenticatedProviderFixture({
      state: initialState(),
      role,
      actorOptions: {
        selection: { kind: "location", location_id: "Branch 1" },
      },
    });
    render(
      <DemoProvider options={fixture.options}>
        <Harness />
      </DemoProvider>,
    );
    await screen.findByRole("searchbox", { name: "Search products" });
    await user.type(
      screen.getByRole("searchbox", { name: "Search products" }),
      "0008",
    );
    expect(
      screen.queryByRole("columnheader", { name: "Status and offer" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        document.querySelector(
          '.catalog-products-table tbody td[data-column-key="price"]',
        ),
      ).toBeInTheDocument(),
    );
    const priceCell = document.querySelector(
      '.catalog-products-table tbody td[data-column-key="price"]',
    ) as HTMLElement;
    expect(priceCell).toBeInTheDocument();
    expect(priceCell).toHaveTextContent("$9.49");
    const request = priceCell.querySelector(".sale-request-pill")!;
    expect(request).toHaveTextContent("Sale requested");
    expect(request).toHaveTextContent("$7.99");
    expect(priceCell).toHaveTextContent("Waiting for approval");
    expect(
      document.querySelectorAll(".catalog-products-table .sale-request-pill"),
    ).toHaveLength(1);
    if (role === "floor_worker") {
      expect(
        within(screen.getByRole("table")).queryByText("Store cost"),
      ).not.toBeInTheDocument();
      expect(
        document.querySelector(
          '.catalog-products-table [data-column-key="cost"]',
        ),
      ).toBeNull();
      expect(
        document.querySelector(
          '.catalog-products-table [data-column-key="margin"]',
        ),
      ).toBeNull();
    }
  },
);
