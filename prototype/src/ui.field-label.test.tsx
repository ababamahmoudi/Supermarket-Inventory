import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { Field } from "./ui";

afterEach(cleanup);

it("keeps a formatted confirmation label associated with its input", async () => {
  render(
    <Field
      label="Type DELETE to confirm"
      labelContent={
        <>
          Type <strong>DELETE</strong> to confirm
        </>
      }
    >
      <input />
    </Field>,
  );
  const input = screen.getByRole("textbox", {
    name: "Type DELETE to confirm",
  });
  await userEvent.click(screen.getByText("DELETE"));
  expect(input).toHaveFocus();
});
