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
          ? 850
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
  "retains the request in its own Offer column when Status is omitted for %s",
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
      screen.queryByRole("columnheader", { name: "Status" }),
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
    expect(priceCell).not.toHaveTextContent("Sale requested");
    const offerCell = document.querySelector(
      '.catalog-products-table tbody td[data-column-key="offer"]',
    ) as HTMLElement;
    const request = offerCell.querySelector(
      ".product-offer-line.is-requested",
    )!;
    expect(request).toHaveTextContent("Sale requested");
    expect(request).toHaveTextContent("$7.99");
    expect(offerCell).toHaveTextContent("$7.99");
    expect(
      document.querySelectorAll(
        ".catalog-products-table .product-offer-line.is-requested",
      ),
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
