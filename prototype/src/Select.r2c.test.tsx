import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  AuthenticatedUiProvider,
  disposeSharedUiFixture,
  prepareSharedUiFixture,
  renderAuthenticatedUI,
} from "./shared-ui-provider-test-fixture";
import { Select } from "./ui";
import { productSelectOption } from "./select-search";
import i18n from "./i18n";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
  await prepareSharedUiFixture();
});
afterEach(() => {
  disposeSharedUiFixture();
});

function Picker() {
  const [value, setValue] = useState("P-1");
  return (
    <>
      <Select
        searchable
        aria-label="Product"
        value={value}
        onChange={setValue}
        options={[
          productSelectOption(
            {
              code: "P-1",
              name_en: "Cedarberry Jam",
              name_fa: "مربای سدر",
              barcode: "8712345678901",
            },
            "en",
          ),
          productSelectOption(
            {
              code: "P-2",
              name_en: "Meadow Pears",
              name_fa: "گلابی",
              barcode: "8712345678902",
            },
            "en",
          ),
        ]}
      />
      <output>{value}</output>
    </>
  );
}
it("searches alternative public names and barcode in a short list, highlights why and chooses with the keyboard", async () => {
  const user = userEvent.setup();
  await renderAuthenticatedUI(
    <AuthenticatedUiProvider>
      <Picker />
    </AuthenticatedUiProvider>,
  );
  const trigger = screen.getByRole("combobox", { name: "Product" });
  await user.click(trigger);
  let search = screen.getByRole("textbox", { name: "Search options" });
  await user.type(search, "گلابی");
  let list = screen.getByRole("listbox", { name: "Product" });
  expect(within(list).getAllByRole("option")).toHaveLength(1);
  expect(list.querySelector("mark")).toHaveTextContent("گلابی");
  await user.keyboard("{Enter}");
  expect(screen.getByText("P-2", { selector: "output" })).toBeVisible();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  search = screen.getByRole("textbox", { name: "Search options" });
  await user.type(search, "8712345678901");
  list = screen.getByRole("listbox", { name: "Product" });
  expect(list.querySelector("mark")).toHaveTextContent("8712345678901");
  await user.keyboard("{Escape}");
  expect(screen.getByText("P-2", { selector: "output" })).toBeVisible();
  expect(trigger).toHaveFocus();
});
it("keeps a long list searchable even when a caller passes false and announces no matches", async () => {
  const user = userEvent.setup();
  await renderAuthenticatedUI(
    <AuthenticatedUiProvider>
      <Select
        searchable={false}
        aria-label="Supplier"
        value="S-1"
        onChange={() => undefined}
        options={Array.from({ length: 9 }, (_, index) => ({
          value: `S-${index + 1}`,
          label: `Fictional supplier ${index + 1}`,
        }))}
      />
    </AuthenticatedUiProvider>,
  );
  await user.click(screen.getByRole("combobox", { name: "Supplier" }));
  await user.type(
    screen.getByRole("textbox", { name: "Search options" }),
    "unmatched",
  );
  expect(screen.getByRole("status")).toHaveTextContent("No matches");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
});

it("shows a placeholder only in the closed box, excludes it from keyboard choices and the search threshold", async () => {
  const user = userEvent.setup();
  await renderAuthenticatedUI(
    <AuthenticatedUiProvider>
      <Select
        aria-label="Product"
        value=""
        onChange={() => undefined}
        options={[
          { value: "", label: "Choose a product", placeholder: true },
          ...Array.from({ length: 8 }, (_, index) => ({
            value: `P-${index + 1}`,
            label: `Fictional product ${index + 1}`,
          })),
        ]}
      />
    </AuthenticatedUiProvider>,
  );
  const trigger = screen.getByRole("combobox", { name: "Product" });
  expect(trigger).toHaveTextContent("Choose a product");
  await user.click(trigger);
  expect(
    screen.queryByRole("textbox", { name: "Search options" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Choose a product" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("option")).toHaveLength(8);
  const activeId = trigger.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  expect(document.getElementById(activeId!)).toHaveTextContent(
    "Fictional product 1",
  );
  expect(
    screen
      .getAllByRole("option")
      .every((option) => option.getAttribute("aria-selected") === "false"),
  ).toBe(true);
  await user.keyboard("{Escape}");
  expect(trigger).toHaveTextContent("Choose a product");
});

it("keeps genuine empty-value All and None choices selectable and accessible", async () => {
  const user = userEvent.setup();
  function Filter() {
    const [value, setValue] = useState("supplier-1");
    return (
      <>
        <Select
          aria-label="Supplier filter"
          value={value}
          onChange={setValue}
          options={[
            { value: "", label: "All suppliers" },
            { value: "supplier-1", label: "Cedarbridge Supply" },
          ]}
        />
        <output data-testid="supplier-filter">{value || "all"}</output>
      </>
    );
  }
  await renderAuthenticatedUI(
    <AuthenticatedUiProvider>
      <Filter />
    </AuthenticatedUiProvider>,
  );
  const trigger = screen.getByRole("combobox", { name: "Supplier filter" });
  await user.click(trigger);
  await user.keyboard("{Home}{Enter}");
  expect(screen.getByTestId("supplier-filter")).toHaveTextContent("all");
  expect(trigger).toHaveTextContent("All suppliers");
  await user.click(trigger);
  const all = screen.getByRole("option", { name: "All suppliers" });
  expect(all).toHaveAttribute("aria-selected", "true");
  expect(trigger.getAttribute("aria-activedescendant")).toBe(all.id);
});
