import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoProvider } from "./store";
import { WhatsMissing } from "./WhatsMissing";
afterEach(() => vi.useRealTimers());
describe("linked form validation", () => {
  it("links a missing requirement to the right field without changing the application route", () => {
    vi.useFakeTimers();
    const scroll = vi.fn();
    render(
      <DemoProvider>
        <WhatsMissing
          issues={[
            {
              id: "email-error",
              message: "Enter a valid email address",
              fieldId: "supplier-email",
            },
          ]}
        />
        <input id="supplier-email" aria-label="Email" />
        <input aria-label="Unrelated field" />
      </DemoProvider>,
    );
    const field = screen.getByRole("textbox", { name: "Email" });
    field.scrollIntoView = scroll;
    const previousHash = window.location.hash;
    fireEvent.click(
      screen.getByRole("link", { name: "Enter a valid email address" }),
    );
    expect(field).toHaveFocus();
    expect(scroll).toHaveBeenCalled();
    expect(field).toHaveClass("validation-field-highlight");
    expect(window.location.hash).toBe(previousHash);
    act(() => vi.advanceTimersByTime(2500));
    expect(field).not.toHaveClass("validation-field-highlight");
  });
  it("focuses Browse rather than the hidden native file input", () => {
    render(
      <DemoProvider>
        <WhatsMissing
          issues={[
            {
              id: "original-error",
              message: "Add the original invoice",
              fieldId: "original-field",
            },
          ]}
        />
        <div id="original-field">
          <input type="file" className="ui-file-input" />
          <button>Browse original</button>
        </div>
      </DemoProvider>,
    );
    fireEvent.click(
      screen.getByRole("link", { name: "Add the original invoice" }),
    );
    expect(
      screen.getByRole("button", { name: "Browse original" }),
    ).toHaveFocus();
  });
  it("omits the summary when the form is valid", () => {
    render(
      <DemoProvider>
        <WhatsMissing issues={[]} />
      </DemoProvider>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
