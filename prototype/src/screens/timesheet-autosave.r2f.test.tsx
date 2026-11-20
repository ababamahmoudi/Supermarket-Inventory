import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimesheetSavedField } from "./timesheet-autosave";

vi.mock("../store", () => ({ useDemo: () => ({ t: (en: string) => en }) }));
afterEach(() => vi.useRealTimers());

describe("R2f D1 focused Now suggestion", () => {
  it("offers the actual clock only for an empty focused time and commits its value", async () => {
    const save = vi.fn(async () => undefined);
    render(
      <TimesheetSavedField
        id="cedar-in"
        label="In time"
        value=""
        save={save}
        time
        now={() => "13:42"}
      />,
    );
    expect(screen.queryByRole("listbox")).toBeNull();
    const input = screen.getByRole("textbox", { name: "In time" });
    fireEvent.focus(input);
    expect(
      screen.getByRole("listbox", { name: "Suggested time" }),
    ).toBeVisible();
    expect(screen.getByRole("option")).toHaveTextContent("13:42");
    await act(async () => fireEvent.click(screen.getByRole("option")));
    expect(save).toHaveBeenCalledExactlyOnceWith("13:42");
    expect(input).toHaveValue("13:42");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps genuine 730 typing, closes Now, and normalizes the accepted field on blur", async () => {
    const save = vi.fn(async () => undefined);
    render(
      <TimesheetSavedField
        id="cedar-out"
        label="Out time"
        value=""
        save={save}
        time
        now={() => "13:42"}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Out time" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "730" } });
    expect(input).toHaveValue("730");
    expect(screen.queryByRole("listbox")).toBeNull();
    await act(async () => fireEvent.blur(input));
    expect(save).toHaveBeenCalledExactlyOnceWith("07:30");
    expect(input).toHaveValue("07:30");
  });

  it("never offers Now over an already recorded time", () => {
    render(
      <TimesheetSavedField
        id="cedar-saved"
        label="In time"
        value="07:30"
        save={async () => undefined}
        time
        now={() => "13:42"}
      />,
    );
    fireEvent.focus(screen.getByRole("textbox"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
