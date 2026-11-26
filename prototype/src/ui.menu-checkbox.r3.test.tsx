import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Menu, MenuItem, MenuSubmenu } from "./ui";

afterEach(cleanup);
function CheckedMenu() {
  const [checked, setChecked] = useState(true);
  return (
    <Menu label="Reader controls">
      <MenuItem
        checked={checked}
        closeOnSelect={false}
        onClick={() => setChecked(!checked)}
      >
        Simulated reading
      </MenuItem>
      <MenuItem onClick={() => {}}>Another action</MenuItem>
      <MenuSubmenu label="Nested reader controls">
        <MenuItem
          checked={checked}
          closeOnSelect={false}
          onClick={() => setChecked(!checked)}
        >
          Nested simulated reading
        </MenuItem>
        <MenuItem onClick={() => {}}>Nested action</MenuItem>
      </MenuSubmenu>
    </Menu>
  );
}
it("includes checked menu items in first focus and arrow navigation without closing the toggle", async () => {
  render(<CheckedMenu />);
  fireEvent.click(screen.getByRole("button", { name: "Reader controls" }));
  const toggle = screen.getByRole("menuitemcheckbox", {
    name: "Simulated reading",
  });
  await waitFor(() => expect(toggle).toHaveFocus());
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(screen.getByRole("menu", { name: "Reader controls" })).toBeVisible();
  fireEvent.keyDown(toggle, { key: "ArrowDown" });
  expect(
    screen.getByRole("menuitem", { name: "Another action" }),
  ).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(toggle).toHaveFocus();
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Nested reader controls" }),
  );
  const nested = screen.getByRole("menuitemcheckbox", {
    name: "Nested simulated reading",
  });
  await waitFor(() => expect(nested).toHaveFocus());
  fireEvent.keyDown(nested, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Nested action" })).toHaveFocus();
});
