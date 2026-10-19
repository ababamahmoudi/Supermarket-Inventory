import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { UnitText } from "./presentation";
import { DemoProvider } from "./store";
import { Field, Select } from "./ui";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("atomic invoice Select content", () => {
  it.each([
    ["en", "⁦0002⁩ · ⁦Canned Fava Beans 400 g⁩", "400 g"],
    ["fa", "⁦0002⁩ · باقالا کنسرو شده ۴۰۰ گرمی", "۴۰۰ گرمی"],
  ] as const)(
    "preserves the exact %s label and selection/search semantics while grouping its physical unit",
    async (language, label, unit) => {
      await i18n.changeLanguage(language);
      const user = userEvent.setup();
      const change = vi.fn();
      render(
        <DemoProvider>
          <Field label="Matched product">
            <Select
              value="0002"
              onChange={change}
              searchable
              options={[
                {
                  value: "0002",
                  label,
                  content: (
                    <>
                      {"⁦0002⁩ · "}
                      {language === "en" ? (
                        <>
                          {"⁦"}
                          <UnitText>Canned Fava Beans 400 g</UnitText>
                          {"⁩"}
                        </>
                      ) : (
                        <UnitText>باقالا کنسرو شده ۴۰۰ گرمی</UnitText>
                      )}
                    </>
                  ),
                },
                { value: "0003", label: "0003 · Other product" },
              ]}
            />
          </Field>
        </DemoProvider>,
      );
      const trigger = screen.getByRole("combobox", { name: "Matched product" });
      expect(trigger.textContent).toBe(label);
      expect(trigger.querySelector(".unit-fragment")?.textContent).toBe(unit);
      await user.click(trigger);
      const option = screen.getByRole("option", { name: label });
      expect(option.textContent).toBe(label);
      expect(option.querySelector(".unit-fragment")?.textContent).toBe(unit);
      await user.type(screen.getByRole("textbox"), unit);
      expect(
        within(screen.getByRole("listbox")).getAllByRole("option"),
      ).toHaveLength(1);
      expect(screen.getByRole("option", { name: label })).toBeVisible();
      await user.keyboard("{Enter}");
      expect(change).toHaveBeenCalledExactlyOnceWith("0002");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(trigger.textContent).toBe(label);
    },
  );
});
