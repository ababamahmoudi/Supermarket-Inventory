import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { BufferedTextarea } from "./ui";
it("keeps both address lines and fast typing while an older save arrives", async () => {
  const user = userEvent.setup();
  const values: string[] = [];
  const field = (saved: string) => (
    <BufferedTextarea
      aria-label="Invented address"
      rows={2}
      value={saved}
      onChange={(event) => values.push(event.target.value)}
    />
  );
  const { rerender } = render(field("Invented street\nUnit "));
  const box = screen.getByRole("textbox", { name: "Invented address" });
  await user.click(box);
  await user.keyboard("{End}20");
  expect(box).toHaveValue("Invented street\nUnit 20");
  act(() => rerender(field("Invented street\nUnit 2")));
  expect(box).toHaveValue("Invented street\nUnit 20");
  expect(box).toHaveFocus();
  act(() => rerender(field("Invented street\nUnit 20")));
  expect(screen.getByRole("textbox")).toBe(box);
  expect(box).toHaveAttribute("rows", "2");
  await user.tab();
  expect(box).toHaveValue("Invented street\nUnit 20");
  expect(values.at(-1)).toBe("Invented street\nUnit 20");
});
