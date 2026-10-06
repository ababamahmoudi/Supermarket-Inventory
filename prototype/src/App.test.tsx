import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { DemoProvider } from "./store";
import i18n from "./i18n";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  void i18n.changeLanguage("en");
});
function show() {
  render(
    <DemoProvider>
      <App />
    </DemoProvider>,
  );
}
async function signIn(
  role: "Cashier" | "Floor Worker" | "Supervisor",
  pin: string,
) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: role }));
  await user.type(screen.getByLabelText("Demo PIN"), pin);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}
describe("role-aware bilingual demo shell", () => {
  it("explains an incorrect PIN and signs in with the selected demo PIN", async () => {
    show();
    const user = await signIn("Cashier", "1111");
    expect(
      screen.getByText("Use the demo PIN shown below for the selected role."),
    ).toBeVisible();
    await user.clear(screen.getByLabelText("Demo PIN"));
    await user.type(screen.getByLabelText("Demo PIN"), "3333");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const nav = within(screen.getByRole("navigation", { name: "Pages" }));
    expect(nav.getAllByRole("link")).toHaveLength(1);
    expect(nav.getByRole("link", { name: "Cashier lookup" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
  });
  it("prevents a Floor Worker from navigating directly to Payables", async () => {
    show();
    await signIn("Floor Worker", "2222");
    window.location.hash = "payables";
    fireEvent(window, new HashChangeEvent("hashchange"));
    const nav = within(screen.getByRole("navigation", { name: "Pages" }));
    expect(
      nav.queryByRole("link", { name: "Payables" }),
    ).not.toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });
  it("supports branch selection and Persian RTL for Supervisor", async () => {
    show();
    const user = await signIn("Supervisor", "1111");
    await user.selectOptions(screen.getByLabelText("Branch"), "Branch 2");
    expect(screen.getByLabelText("Branch")).toHaveValue("Branch 2");
    await user.click(screen.getByRole("button", { name: "فارسی" }));
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(document.documentElement).toHaveAttribute("lang", "fa");
    expect(screen.getByRole("navigation", { name: "صفحه‌ها" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });
  it("requires confirmation before resetting and returns to PIN after locking", async () => {
    show();
    const user = await signIn("Cashier", "3333");
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    const dialog = screen.getByRole("dialog", { name: "Reset demo" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lock" }));
    expect(screen.getByLabelText("Demo PIN")).toBeVisible();
  });
});
