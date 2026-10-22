import {
  AuthenticatedUiProvider as DemoProvider,
  renderAuthenticatedUI as render,
  prepareSharedUiFixture,
  disposeSharedUiFixture,
} from "./shared-ui-provider-test-fixture";
import { createRef, useState, type ReactNode } from "react";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import i18n from "./i18n";
import { demoSeed } from "./config";
import {
  Money,
  UnitSize,
  DateText,
  ProductName,
  OfferLabel,
  LtrText,
  branchLabel,
  demoUserLabel,
  formatMoney,
  formatDate,
} from "./presentation";
import {
  Badge,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DataTable,
  Disclosure,
  DateField,
  Dropzone,
  Field,
  Menu,
  MenuItem,
  MenuSubmenu,
  TableRowLink,
  Button,
  NumberField,
  Radio,
  Select,
  Switch,
  Tabs,
} from "./ui";
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
async function show(children: ReactNode) {
  return await render(<DemoProvider>{children}</DemoProvider>);
}
it.each([
  ["Waiting for pickup", "info"],
  ["در انتظار جمع‌آوری", "info"],
  ["Waiting for credit", "pending"],
  ["در انتظار اعتبار", "pending"],
  ["در انتظار بستانکاری", "pending"],
  ["Pending credit", "pending"],
  ["اعتبار در انتظار", "pending"],
  ["Closed", "approved"],
  ["بسته‌شده", "approved"],
  ["Credited", "approved"],
  ["اعتبار دریافت‌شده", "approved"],
  ["Replaced", "approved"],
  ["جایگزین‌شده", "approved"],
  ["Written off", "neutral"],
  ["سوخت‌شده", "neutral"],
  ["Cancelled", "neutral"],
  ["لغوشده", "neutral"],
])(
  "gives %s its canonical tone despite a conflicting legacy tone",
  async (label, tone) => {
    await show(<Badge tone="danger">{label}</Badge>);
    expect(screen.getByText(label)).toHaveClass(tone);
    expect(screen.getByText(label)).not.toHaveClass("danger");
  },
);
const statuses = [
  { value: "draft", label: "Draft" },
  { value: "blocked", label: "Blocked", disabled: true },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];
function StatusSelect({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState("draft");
  return (
    <>
      <Field label="Invoice status">
        <Select
          value={value}
          onChange={setValue}
          options={statuses}
          disabled={disabled}
        />
      </Field>
      <output data-testid="selected-status">{value}</output>
    </>
  );
}
function InvoiceStatusDialog() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("draft");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Review invoice status"
      description="Choose the status before confirming."
      confirmLabel="Confirm status"
      onConfirm={vi.fn()}
    >
      <Field label="Invoice status">
        <Select value={value} onChange={setValue} options={statuses} />
      </Field>
      <output data-testid="dialog-status">{value}</output>
    </ConfirmDialog>
  );
}
describe("styled Select", () => {
  it("labels the custom combobox and skips disabled options with the keyboard", async () => {
    const user = userEvent.setup();
    const view = await show(<StatusSelect />);
    const select = screen.getByRole("combobox", { name: "Invoice status" });
    expect(view.container.querySelector("select")).toBeNull();
    expect(select).toHaveTextContent("Draft");
    expect(select).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    expect(select).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(select).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox", { name: "Invoice status" });
    expect(
      within(list).getByRole("option", { name: "Blocked" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Home}{ArrowDown}{Enter}");
    expect(screen.getByTestId("selected-status")).toHaveTextContent("posted");
    expect(select).toHaveTextContent("Posted");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(select).toHaveFocus();
    await user.keyboard("{ArrowDown}{End}{Enter}");
    expect(screen.getByTestId("selected-status")).toHaveTextContent(
      "cancelled",
    );
  });
  it("searches lists with more than eight options and keeps the value on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await show(
      <Select
        aria-label="Supplier"
        value="supplier-1"
        onChange={onChange}
        options={Array.from({ length: 9 }, (_, index) => ({
          value: `supplier-${index + 1}`,
          label: `Supplier ${index + 1}`,
        }))}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Supplier" });
    await user.click(select);
    const search = screen.getByRole("textbox");
    await user.type(search, "Supplier 9");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Supplier 9" })).toBeVisible();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("supplier-9");
    expect(select).toHaveFocus();
    await user.click(select);
    await user.type(screen.getByRole("textbox"), "Missing supplier");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("No matching options")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(select).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it("does not open or change a disabled selection", async () => {
    const user = userEvent.setup();
    await show(<StatusSelect disabled />);
    const select = screen.getByRole("combobox", { name: "Invoice status" });
    expect(select).toBeDisabled();
    await user.click(select);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected-status")).toHaveTextContent("draft");
  });
  it("preserves a supplied accessible label and description alongside field help", async () => {
    const user = userEvent.setup();
    await show(
      <>
        <p id="supplier-policy">Choose a confirmed supplier.</p>
        <Field label="Supplier" hint="Search by supplier name.">
          <Select
            aria-label="Invoice supplier"
            aria-describedby="supplier-policy"
            value="draft"
            options={statuses}
            onChange={vi.fn()}
          />
        </Field>
      </>,
    );
    const select = screen.getByRole("combobox", { name: "Invoice supplier" });
    expect(select).toHaveAccessibleDescription(
      "Choose a confirmed supplier. Search by supplier name.",
    );
    await user.click(select);
    expect(
      screen.getByRole("listbox", { name: "Invoice supplier" }),
    ).toBeVisible();
  });
  it("keeps its options inside a modal dialog and restores focus on Escape", async () => {
    const user = userEvent.setup();
    await show(<InvoiceStatusDialog />);
    const dialog = screen.getByRole("dialog", {
      name: "Review invoice status",
    });
    const select = within(dialog).getByRole("combobox", {
      name: "Invoice status",
    });
    await user.click(select);
    const listbox = within(dialog).getByRole("listbox", {
      name: "Invoice status",
    });
    await user.click(within(listbox).getByRole("option", { name: "Posted" }));
    expect(screen.getByTestId("dialog-status")).toHaveTextContent("posted");
    expect(select).toHaveTextContent("Posted");
    await user.click(select);
    expect(
      within(dialog).getByRole("listbox", { name: "Invoice status" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(within(dialog).queryByRole("listbox")).not.toBeInTheDocument();
    expect(dialog).toBeVisible();
    expect(select).toHaveFocus();
    expect(screen.getByTestId("dialog-status")).toHaveTextContent("posted");
  });
});
function MixAndMatch({ disabled = false }: { disabled?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox checked={checked} onChange={setChecked} disabled={disabled}>
      Mix and match
    </Checkbox>
  );
}
describe("styled Checkbox", () => {
  it("exposes its checked state and toggles using Space and its label", async () => {
    const user = userEvent.setup();
    const view = await show(<MixAndMatch />);
    const checkbox = screen.getByRole("checkbox", { name: "Mix and match" });
    expect(view.container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(checkbox).not.toBeChecked();
    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    await user.click(screen.getByText("Mix and match"));
    expect(checkbox).not.toBeChecked();
  });
  it("keeps disabled checkboxes unchanged", async () => {
    const user = userEvent.setup();
    await show(<MixAndMatch disabled />);
    const checkbox = screen.getByRole("checkbox", { name: "Mix and match" });
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    fireEvent.keyDown(checkbox, { key: " " });
    expect(checkbox).not.toBeChecked();
  });
});
function ApprovalScope() {
  const [scope, setScope] = useState("all");
  return (
    <div role="radiogroup" aria-label="Approval scope">
      <Radio checked={scope === "all"} onChange={() => setScope("all")}>
        All branches
      </Radio>
      <Radio disabled checked={false} onChange={() => setScope("archived")}>
        Archived branch
      </Radio>
      <Radio checked={scope === "this"} onChange={() => setScope("this")}>
        This branch only
      </Radio>
      <Radio checked={scope === "second"} onChange={() => setScope("second")}>
        Branch 2 only
      </Radio>
    </div>
  );
}
describe("styled Radio", () => {
  it("changes one radio at a time with arrow keys and skips disabled choices", async () => {
    const user = userEvent.setup();
    const view = await show(<ApprovalScope />);
    const group = within(
      screen.getByRole("radiogroup", { name: "Approval scope" }),
    );
    const all = group.getByRole("radio", { name: "All branches" });
    const thisBranch = group.getByRole("radio", { name: "This branch only" });
    const secondBranch = group.getByRole("radio", { name: "Branch 2 only" });
    expect(view.container.querySelector('input[type="radio"]')).toBeNull();
    expect(all).toBeChecked();
    await user.tab();
    expect(all).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(thisBranch).toHaveFocus();
    expect(thisBranch).toBeChecked();
    expect(all).not.toBeChecked();
    expect(
      group.getByRole("radio", { name: "Archived branch" }),
    ).not.toBeChecked();
    await user.keyboard("{ArrowLeft}");
    expect(all).toHaveFocus();
    expect(all).toBeChecked();
    await user.keyboard("{End}");
    expect(secondBranch).toHaveFocus();
    expect(secondBranch).toBeChecked();
    await user.keyboard("{Home}");
    expect(all).toHaveFocus();
    expect(all).toBeChecked();
    expect(secondBranch).not.toBeChecked();
  });
});
function RememberDevice() {
  const [checked, setChecked] = useState(false);
  return (
    <Switch checked={checked} onChange={setChecked}>
      Remember this device
    </Switch>
  );
}
describe("styled Switch", () => {
  it("toggles on Space while a disabled switch remains unchanged", async () => {
    const user = userEvent.setup();
    const onDisabledChange = vi.fn();
    await show(
      <>
        <RememberDevice />
        <Switch disabled checked onChange={onDisabledChange}>
          Registered device
        </Switch>
      </>,
    );
    const activeSwitch = screen.getByRole("switch", {
      name: "Remember this device",
    });
    const disabledSwitch = screen.getByRole("switch", {
      name: "Registered device",
    });
    expect(activeSwitch).not.toBeChecked();
    await user.tab();
    expect(activeSwitch).toHaveFocus();
    await user.keyboard(" ");
    expect(activeSwitch).toBeChecked();
    await user.keyboard(" ");
    expect(activeSwitch).not.toBeChecked();
    await user.click(disabledSwitch);
    expect(disabledSwitch).toBeChecked();
    expect(onDisabledChange).not.toHaveBeenCalled();
  });
});
function SupplierTabs({ rtl = false }: { rtl?: boolean }) {
  const [tab, setTab] = useState("overview");
  return (
    <div dir={rtl ? "rtl" : "ltr"}>
      <Tabs
        aria-label="Supplier details"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "payments", label: "Payments", disabled: true },
          { value: "invoices", label: "Invoices" },
          { value: "returns", label: "Returns" },
        ]}
      />
    </div>
  );
}
describe("styled Tabs", () => {
  it("moves focus and selection together, skipping disabled tabs", async () => {
    const user = userEvent.setup();
    await show(<SupplierTabs />);
    const tabs = within(
      screen.getByRole("tablist", { name: "Supplier details" }),
    );
    const overview = tabs.getByRole("tab", { name: "Overview" });
    const invoices = tabs.getByRole("tab", { name: "Invoices" });
    const returns = tabs.getByRole("tab", { name: "Returns" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(invoices).toHaveAttribute("tabindex", "-1");
    await user.tab();
    expect(overview).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(invoices).toHaveFocus();
    expect(invoices).toHaveAttribute("aria-selected", "true");
    expect(overview).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{End}");
    expect(returns).toHaveFocus();
    expect(returns).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(tabs.getByRole("tab", { name: "Payments" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
  it("mirrors arrow navigation within a Persian right-to-left layout", async () => {
    const user = userEvent.setup();
    await show(<SupplierTabs rtl />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    const invoices = screen.getByRole("tab", { name: "Invoices" });
    expect(invoices).toHaveFocus();
    expect(invoices).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
describe("status badges", () => {
  it("keeps fixed status meanings in English and Persian despite caller tones", async () => {
    await show(
      <>
        <Badge tone="approved">Waiting for supplier</Badge>
        <Badge tone="danger">ثبت‌شده</Badge>
        <Badge tone="neutral">Needs review</Badge>
        <Badge tone="pending">پیش‌نویس</Badge>
      </>,
    );
    expect(screen.getByText("Waiting for supplier")).toHaveClass("pending");
    expect(screen.getByText("ثبت‌شده")).toHaveClass("approved");
    expect(screen.getByText("Needs review")).toHaveClass("progress");
    expect(screen.getByText("پیش‌نویس")).toHaveClass("neutral");
  });
});
function InvoiceDate() {
  const [value, setValue] = useState("2026-10-15");
  return (
    <>
      <Field label="Invoice date">
        <DateField
          value={value}
          onChange={setValue}
          min="2026-10-14"
          max="2026-10-17"
        />
      </Field>
      <output data-testid="invoice-date">{value}</output>
    </>
  );
}
describe("styled DateField", () => {
  it("uses a constrained calendar and selects a date with arrow keys", async () => {
    const user = userEvent.setup();
    const view = await show(<InvoiceDate />);
    const trigger = screen.getByRole("button", { name: "Invoice date" });
    expect(view.container.querySelector('input[type="date"]')).toBeNull();
    expect(trigger).toHaveTextContent("2026-10-15");
    await user.click(trigger);
    const beforeMinimum = screen.getByRole("button", {
      name: "2026-10-13",
    });
    const afterMaximum = screen.getByRole("button", {
      name: "2026-10-18",
    });
    expect(beforeMinimum).toBeDisabled();
    expect(afterMaximum).toBeDisabled();
    const selected = screen.getByRole("button", { name: "2026-10-15" });
    await waitFor(() => expect(selected).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2026-10-16" })).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("invoice-date")).toHaveTextContent("2026-10-16");
    expect(
      screen.queryByRole("button", { name: "2026-10-16" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("closes the calendar on Escape without changing the date", async () => {
    const user = userEvent.setup();
    await show(<InvoiceDate />);
    const trigger = screen.getByRole("button", { name: "Invoice date" });
    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2026-10-15" })).toHaveFocus(),
    );
    await user.keyboard("{ArrowRight}{Escape}");
    expect(screen.getByTestId("invoice-date")).toHaveTextContent("2026-10-15");
    expect(
      screen.queryByRole("button", { name: "2026-10-16" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
function UnitCost() {
  const [value, setValue] = useState("1.80");
  return (
    <Field label="Unit cost before tax">
      <NumberField value={value} onChange={setValue} min="0" step="0.01" />
    </Field>
  );
}
describe("styled NumberField", () => {
  it("allows decimal text entry without a native number stepper", async () => {
    const user = userEvent.setup();
    const view = await show(<UnitCost />);
    const input = screen.getByRole("textbox", { name: "Unit cost before tax" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(view.container.querySelector('input[type="number"]')).toBeNull();
    await user.clear(input);
    await user.type(input, "2.35");
    expect(input).toHaveValue("2.35");
  });

  it("keeps every keystroke when the saved value arrives later", async () => {
    const user = userEvent.setup();
    const saved: string[] = [];
    await show(<SlowSavedQuantity saved={saved} />);
    const input = screen.getByRole("textbox", { name: "Delivered" });
    await user.tripleClick(input);
    // Each key lands before the previous save has finished.
    await user.keyboard("2");
    await user.keyboard("0");
    expect(input).toHaveValue("20");
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)));
    expect(input).toHaveValue("20");
    expect(saved.at(-1)).toBe("20");
    // Emptying the box while typing does not snap back to a number.
    await user.clear(input);
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)));
    expect(input).toHaveValue("");
    await user.type(input, "18");
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)));
    await user.tab();
    expect(input).toHaveValue("18");
  });

  it("shows the saved value again after leaving the box", async () => {
    const user = userEvent.setup();
    await show(<SlowSavedQuantity saved={[]} normalize />);
    const input = screen.getByRole("textbox", { name: "Delivered" });
    await user.tripleClick(input);
    await user.keyboard("007");
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)));
    expect(input).toHaveValue("007");
    await user.tab();
    expect(input).toHaveValue("7");
  });
});
function PriceWithChip() {
  const [value, setValue] = useState("4.99");
  return (
    <>
      <Field label="Price">
        <NumberField
          value={value}
          onChange={setValue}
          min="0"
          step="0.01"
          keepTyping
        />
      </Field>
      {/* Safari keeps focus in the box when a button is clicked. */}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setValue("5.49")}
      >
        +10%
      </button>
    </>
  );
}
describe("styled NumberField outside changes", () => {
  it("shows a price set by a chip while the box keeps focus", async () => {
    const user = userEvent.setup();
    await show(<PriceWithChip />);
    const input = screen.getByRole("textbox", { name: "Price" });
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "+10%" }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue("5.49");
  });
});
function SlowSavedQuantity({
  saved,
  normalize = false,
}: {
  saved: string[];
  normalize?: boolean;
}) {
  const [value, setValue] = useState("24");
  return (
    <Field label="Delivered">
      <NumberField
        value={value}
        min="0"
        step="1"
        keepTyping
        onChange={(next) => {
          saved.push(next);
          // Like the app's browser-database save: the value comes back later.
          setTimeout(
            () => setValue(normalize ? String(Number(next)) : next),
            30,
          );
        }}
      />
    </Field>
  );
}
function InvoiceUpload() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <>
      <Dropzone
        aria-label="Original invoice"
        fileName={file?.name}
        fileSize={file?.size}
        accept="application/pdf,image/*"
        onChange={setFile}
        onRemove={() => setFile(null)}
      />
      <output data-testid="invoice-file">{file?.name ?? "No invoice"}</output>
    </>
  );
}
describe("styled Dropzone", () => {
  it("uses a hidden file chooser and allows removing an uploaded document", async () => {
    const user = userEvent.setup();
    const view = await show(<InvoiceUpload />);
    const fileInput =
      view.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveClass("ui-file-input");
    expect(fileInput).toHaveAttribute("tabindex", "-1");
    expect(fileInput).toHaveAccessibleName("Original invoice");
    const chooseFile = vi.spyOn(fileInput!, "click");
    await user.click(screen.getByRole("button", { name: /browse/i }));
    expect(chooseFile).toHaveBeenCalledOnce();
    const file = new File(["fictional invoice"], "invoice.pdf", {
      type: "application/pdf",
    });
    await user.upload(fileInput!, file);
    expect(screen.getByTestId("invoice-file")).toHaveTextContent("invoice.pdf");
    expect(screen.getByRole("button", { name: /remove/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.getByTestId("invoice-file")).toHaveTextContent("No invoice");
    expect(screen.queryByText("invoice.pdf")).not.toBeInTheDocument();
  });
  it("accepts a document dropped onto the upload control", async () => {
    await show(<InvoiceUpload />);
    const file = new File(["fictional invoice photo"], "invoice.jpg", {
      type: "image/jpeg",
    });
    fireEvent.drop(screen.getByLabelText("Original invoice"), {
      dataTransfer: { files: [file] },
    });
    expect(screen.getByTestId("invoice-file")).toHaveTextContent("invoice.jpg");
  });
});
describe("styled Menu", () => {
  it("keeps icon-menu text accessible, preserves rich badges and restores keyboard focus", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    await show(
      <>
        <Menu
          iconOnly
          label="More actions"
          icon={<span aria-hidden="true">⋯</span>}
        >
          <MenuItem onClick={action}>Stop tracking this product</MenuItem>
        </Menu>
        <Menu
          iconOnly
          aria-label="Notifications, 3 unread"
          label={<span className="notification-count">3</span>}
        >
          <MenuItem onClick={vi.fn()}>Approvals</MenuItem>
        </Menu>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveClass("ui-icon-button", "button-neutral");
    expect(within(trigger).getByText("More actions")).toHaveClass("sr-only");
    const notifications = screen.getByRole("button", {
      name: "Notifications, 3 unread",
    });
    expect(within(notifications).getByText("3")).toBeVisible();
    expect(notifications.querySelector(".lucide-chevron-down")).toBeNull();
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const item = screen.getByRole("menuitem", {
      name: "Stop tracking this product",
    });
    await waitFor(() => expect(item).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("moves among enabled actions and restores trigger focus after Escape", async () => {
    const user = userEvent.setup();
    const onLock = vi.fn();
    await show(
      <Menu label="User menu">
        <MenuItem onClick={onLock}>Lock</MenuItem>
        <MenuItem disabled onClick={vi.fn()}>
          Unavailable action
        </MenuItem>
        <MenuItem onClick={vi.fn()}>Sign out</MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "User menu" });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Lock" })).toHaveFocus(),
    );
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Lock" })).toHaveFocus();
    await user.keyboard("{End}{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onLock).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Lock" })).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    expect(onLock).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("can omit its decorative chevron while keeping keyboard menu behavior", async () => {
    const user = userEvent.setup();
    await show(
      <Menu label="Notifications" showChevron={false}>
        <MenuItem onClick={vi.fn()}>Review alert</MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Notifications" });
    expect(trigger.querySelector("svg")).toBeNull();
    await user.click(trigger);
    expect(
      screen.getByRole("menuitem", { name: "Review alert" }),
    ).toBeVisible();
  });
  it("closes a just-opened nested menu before its focus frame without closing the parent", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const request = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        const id = ++nextFrame;
        frames.set(id, callback);
        return id;
      });
    const cancel = vi
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation((id) => {
        frames.delete(id);
      });
    try {
      for (const direction of ["ltr", "rtl"] as const) {
        for (const closeKey of [
          "Escape",
          direction === "rtl" ? "ArrowRight" : "ArrowLeft",
        ]) {
          const action = vi.fn();
          const view = await show(
            <Menu label="More">
              <MenuItem onClick={vi.fn()}>Search</MenuItem>
              <MenuSubmenu label="Demo">
                <MenuItem onClick={action}>Reset demo</MenuItem>
              </MenuSubmenu>
            </Menu>,
          );
          document.documentElement.dir = direction;
          const trigger = screen.getByRole("button", { name: "More" });
          fireEvent.click(trigger);
          const [outerId, outerFocus] = [...frames.entries()][0];
          frames.delete(outerId);
          act(() => outerFocus(0));
          const demo = screen.getByRole("menuitem", { name: /^Demo$/ });
          demo.focus();
          fireEvent.click(demo);
          expect(
            screen.getByRole("menuitem", { name: "Reset demo" }),
          ).toBeVisible();
          expect(demo).toHaveFocus();
          const [nestedId, lateFocus] = [...frames.entries()][0];
          fireEvent.keyDown(demo, { key: closeKey });
          expect(cancel).toHaveBeenCalledWith(nestedId);
          expect(demo).toHaveFocus();
          expect(demo).toHaveAttribute("aria-expanded", "false");
          expect(
            screen.queryByRole("menuitem", { name: "Reset demo" }),
          ).not.toBeInTheDocument();
          expect(screen.getByRole("menu", { name: "More" })).toBeVisible();
          act(() => lateFocus(0));
          expect(demo).toHaveFocus();
          expect(action).not.toHaveBeenCalled();
          fireEvent.keyDown(demo, { key: "Escape" });
          expect(screen.queryByRole("menu")).not.toBeInTheDocument();
          expect(trigger).toHaveFocus();
          view.unmount();
        }
      }
    } finally {
      document.documentElement.dir = "ltr";
      request.mockRestore();
      cancel.mockRestore();
    }
  });
  for (const direction of ["ltr", "rtl"] as const)
    it(`keeps nested Demo navigation at its own level and restores focus (${direction})`, async () => {
      const user = userEvent.setup();
      const action = vi.fn();
      await show(
        <Menu label="More">
          <MenuItem onClick={vi.fn()}>Search</MenuItem>
          <MenuSubmenu label="Demo">
            <MenuItem onClick={action}>Switch to Demo Supervisor</MenuItem>
            <MenuItem onClick={vi.fn()}>Reset demo</MenuItem>
          </MenuSubmenu>
          <MenuItem onClick={vi.fn()}>Theme</MenuItem>
        </Menu>,
      );
      document.documentElement.dir = direction;
      const trigger = screen.getByRole("button", { name: "More" });
      await user.click(trigger);
      await waitFor(() =>
        expect(screen.getByRole("menuitem", { name: "Search" })).toHaveFocus(),
      );
      await user.keyboard("{ArrowDown}");
      const demo = screen.getByRole("menuitem", { name: /^Demo$/ });
      expect(demo).toHaveFocus();
      await user.keyboard(direction === "rtl" ? "{ArrowLeft}" : "{ArrowRight}");
      await waitFor(() =>
        expect(
          screen.getByRole("menuitem", { name: "Switch to Demo Supervisor" }),
        ).toHaveFocus(),
      );
      await user.keyboard("{ArrowDown}");
      expect(
        screen.getByRole("menuitem", { name: "Reset demo" }),
      ).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(demo).toHaveFocus();
      expect(demo).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByRole("menu", { name: "More" })).toBeVisible();
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Theme" })).toHaveFocus();
      await user.keyboard("{ArrowUp}{Enter}");
      await waitFor(() =>
        expect(
          screen.getByRole("menuitem", { name: "Switch to Demo Supervisor" }),
        ).toHaveFocus(),
      );
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledOnce();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      document.documentElement.dir = "ltr";
    });
});
it("detail-opening rows navigate by click and keyboard while child actions remain independent", async () => {
  const user = userEvent.setup();
  const action = vi.fn();
  await show(
    <DataTable>
      <thead>
        <tr>
          <th>Reference</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr data-row-href="#return?id=demo-return-1">
          <td>RM-0001</td>
          <td>
            <Button onClick={action}>Record pickup</Button>
            <TableRowLink
              href="#return?id=demo-return-1"
              aria-label="View return"
            />
          </td>
        </tr>
      </tbody>
    </DataTable>,
  );
  window.location.hash = "#returns";
  await user.click(screen.getByRole("button", { name: "Record pickup" }));
  expect(action).toHaveBeenCalledOnce();
  expect(window.location.hash).toBe("#returns");
  const row = screen.getByText("RM-0001").closest("tr")!;
  row.focus();
  await user.keyboard("{Enter}");
  expect(window.location.hash).toBe("#return?id=demo-return-1");
  window.location.hash = "#returns";
  await user.click(screen.getByText("RM-0001"));
  expect(window.location.hash).toBe("#return?id=demo-return-1");
  expect(screen.getByRole("link", { name: "View return" })).toHaveAttribute(
    "href",
    "#return?id=demo-return-1",
  );
  window.location.hash = "";
});
it("moves a retained cell's navigation into the single phone chevron slot", async () => {
  vi.stubGlobal("innerWidth", 390);
  const opened = vi.fn();
  try {
    const user = userEvent.setup();
    await show(
      <DataTable
        columns={[{ key: "name" }, { key: "cost" }, { key: "status" }]}
        phoneList={{ name: "name", value: "cost", secondary: ["status"] }}
      >
        <thead>
          <tr>
            <th>Product</th>
            <th>Cost</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <LtrText>Fictional pantry item</LtrText>
            </td>
            <td>$1.00</td>
            <td>
              <span>Not confirmed</span>
              <TableRowLink
                href="#review-line"
                aria-label="Review line"
                onClick={(event) => {
                  event.preventDefault();
                  opened();
                }}
              />
            </td>
          </tr>
        </tbody>
      </DataTable>,
    );
    const control = screen.getByRole("link", { name: "Review line" });
    expect(control.closest("td")).toHaveClass("phone-list-chevron");
    expect(screen.getByText("Not confirmed").closest("td")).toHaveClass(
      "phone-list-secondary",
    );
    await user.click(control);
    expect(opened).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps disclosure content while its shared summary opens and closes", async () => {
  const user = userEvent.setup();
  await show(
    <Disclosure summary="More details">
      <p>Optional printed note</p>
    </Disclosure>,
  );
  const summary = screen.getByText("More details").closest("summary")!;
  const details = summary.parentElement!;
  expect(screen.getByText("Optional printed note")).not.toBeVisible();
  await user.click(summary);
  expect(details).toHaveAttribute("open");
  expect(screen.getByText("Optional printed note")).toBeVisible();
  await user.click(summary);
  expect(details).not.toHaveAttribute("open");
  expect(screen.getByText("Optional printed note")).not.toBeVisible();
});
describe("shared language and number presentation", () => {
  it("formats money without losing Decimal precision, with Western digits and the symbol first", () => {
    expect(formatMoney("2.99", { currency: "CAD" })).toBe("$2.99");
    expect(formatMoney("1260", { currency: "CAD" })).toBe("$1,260.00");
    expect(formatMoney("-2.99", { currency: "CAD" })).toBe("-$2.99");
    expect(formatMoney("9007199254740993.005", { currency: "CAD" })).toBe(
      "$9,007,199,254,740,993.005",
    );
    expect(formatMoney("1.2345", { currency: "CAD", decimals: 4 })).toBe(
      "$1.2345",
    );
    expect(formatMoney("5", { currency: "CAD", compact: true })).toBe("$5.00");
    expect(formatMoney("5.49", { currency: "CAD", compact: true })).toBe(
      "$5.49",
    );
    expect(() => formatMoney("NaN", { currency: "CAD" })).toThrow(
      "Money must be finite",
    );
    expect(() => formatMoney("Infinity", { currency: "CAD" })).toThrow(
      "Money must be finite",
    );
  });
  it("keeps recorded date-only values in YYYY-MM-DD when timestamps or languages change", () => {
    expect(formatDate("2026-10-07")).toBe("2026-10-07");
    expect(formatDate("2026-10-07T23:50:00-04:00")).toBe("2026-10-07");
    expect(formatDate(undefined)).toBe("—");
  });
  it("isolates mixed Latin prices, dates and unit sizes inside Persian text", async () => {
    const view = await show(
      <div dir="rtl">
        <Money value="2.99" currency="CAD" />
        <UnitSize value="1 L" />
        <DateText value="2026-10-07" />
        <OfferLabel label="2 for $5" language="fa" currency="CAD" />
      </div>,
    );
    expect(screen.getByText("$2.99").closest("bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    const unit = view.container.querySelector(".unit-text .unit-fragment");
    expect(unit).toHaveTextContent(/^1 L$/);
    expect(unit?.closest("bdi")).toHaveAttribute("dir", "ltr");
    expect(unit?.querySelector("bdi")).toHaveAttribute("dir", "ltr");
    expect(unit?.querySelector("bdi")).toHaveTextContent(/^1$/);
    expect(screen.getByText("2026-10-07").closest("bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(screen.getByText("$5.00").closest("bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(view.container).toHaveTextContent("۲ عدد $5.00");
  });
  it("uses the current language name first and translates branch and demo-user names", async () => {
    const view = await show(
      <ProductName
        product={{ name_en: "Milk", name_fa: "شیر" }}
        language="fa"
      />,
    );
    expect(view.container.querySelector("strong")).toHaveTextContent("شیر");
    expect(view.container.querySelector("small")).toHaveTextContent("Milk");
    expect(branchLabel("Branch 1", "fa")).toBe("شعبه 1");
    expect(branchLabel("all", "fa")).toBe("همه شعبه‌ها");
    expect(demoUserLabel("Demo Supervisor", "fa")).toBe(
      demoSeed.demo_users.find((user) => user.username === "manager")!.name_fa,
    );
    expect(demoUserLabel("floorworker", "fa")).toBe(
      demoSeed.demo_users.find((user) => user.username === "ny-floor")!.name_fa,
    );
  });
  it("puts a notebook count in its own pill beside the translated tab name", async () => {
    await show(
      <Tabs
        aria-label="Notebooks"
        value="supervisor"
        onChange={vi.fn()}
        options={[{ value: "supervisor", label: "For Supervisor", count: 1 }]}
      />,
    );
    const tab = screen.getByRole("tab", { name: "For Supervisor 1" });
    expect(within(tab).getByText("1")).toHaveClass("tab-count");
    expect(within(tab).getByText("For Supervisor")).not.toHaveClass(
      "tab-count",
    );
  });
});
it("keeps header and financial body fragments in the same shared table columns", async () => {
  const warn = vi.spyOn(console, "error");
  await show(
    <DataTable
      columns={[
        { width: 180 },
        { width: 100, align: "end" },
        { width: 100, align: "end" },
        { width: 80, actions: true },
      ]}
    >
      <thead>
        <tr>
          <th>Supplier</th>
          <>
            <th>Balance</th>
            <th>Overdue</th>
          </>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Fictional supplier</td>
          <>
            <td>$10.00</td>
            <td>$2.00</td>
          </>
          <td>View</td>
        </tr>
      </tbody>
    </DataTable>,
  );
  const rows = screen.getAllByRole("row");
  expect(rows[0].children).toHaveLength(4);
  expect(rows[1].children).toHaveLength(4);
  for (let index = 0; index < 4; index++) {
    const header = rows[0].children[index] as HTMLElement;
    const cell = rows[1].children[index] as HTMLElement;
    expect(header.style.textAlign).toBe(index === 0 ? "start" : "end");
    expect(cell.style.textAlign).toBe(header.style.textAlign);
  }
  expect(warn).not.toHaveBeenCalled();
});
it("reflows weighted columns on resize and column changes while reserving intrinsic actions", async () => {
  let width = 900;
  const observers = new Set<ResizeObserverCallback>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observers.add(callback);
      }
      callback: ResizeObserverCallback;
      observe() {}
      disconnect() {
        observers.delete(this.callback);
      }
    },
  );
  const rectangle = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const measuredWidth = this.classList.contains("ui-data-table")
        ? width
        : this.classList.contains("table-details-toggle")
          ? 36
          : this.classList.contains("ui-button")
            ? 80
            : 0;
      return { width: measuredWidth, height: 40 } as DOMRect;
    });
  const contents = (hideSupplier: boolean) => (
    <DataTable
      columns={[
        { key: "reference", width: 108 },
        { key: "supplier", width: 220, hidden: hideSupplier },
        { key: "status", width: 172 },
        { key: "actions", actions: true },
      ]}
    >
      <thead>
        <tr>
          <th>Return #</th>
          <th>Supplier</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Return #1</td>
          <td>Fictional supplier</td>
          <td>Waiting for pickup</td>
          <td style={{ paddingInlineStart: 12, paddingInlineEnd: 12 }}>
            <Button variant="secondary">Record pickup</Button>
          </td>
        </tr>
      </tbody>
    </DataTable>
  );
  try {
    const rendered = await show(contents(false));
    const widths = () =>
      Array.from(rendered.container.querySelectorAll("col")).map((column) => {
        expect(column.style.width).toMatch(/^\d+(?:\.\d+)?px$/);
        return parseFloat(column.style.width);
      });
    let measured = widths();
    expect(measured.reduce((sum, value) => sum + value, 0)).toBeCloseTo(900);
    expect(measured).toHaveLength(4);
    expect(measured[0]).toBeGreaterThanOrEqual(180);
    expect(measured[1]).toBeGreaterThanOrEqual(180);
    expect(measured[2]).toBeGreaterThanOrEqual(160);
    expect(measured[3]).toBe(104);
    width = 640;
    act(() => {
      for (const callback of Array.from(observers))
        callback([], {} as ResizeObserver);
    });
    measured = widths();
    expect(measured.reduce((sum, value) => sum + value, 0)).toBeCloseTo(640);
    expect(measured).toHaveLength(3);
    expect(
      screen.queryByRole("columnheader", { name: "Status" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText("Waiting for pickup")).toBeVisible();
    expect(measured[2]).toBe(140);
    rendered.rerender(<DemoProvider>{contents(true)}</DemoProvider>);
    measured = widths();
    expect(measured).toHaveLength(3);
    expect(measured.reduce((sum, value) => sum + value, 0)).toBeCloseTo(640);
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "Supplier" }),
    ).not.toBeInTheDocument();
    expect(measured[0]).toBeGreaterThanOrEqual(180);
    expect(measured[1]).toBeGreaterThanOrEqual(160);
    expect(measured[2]).toBe(140);
    expect(observers.size).toBe(1);
    rendered.unmount();
    expect(observers.size).toBe(0);
  } finally {
    rectangle.mockRestore();
    vi.unstubAllGlobals();
  }
});
beforeEach(async () => {
  await prepareSharedUiFixture();
});
afterEach(() => {
  disposeSharedUiFixture();
});

describe("shared structured compositions", () => {
  it("keeps field adornments separate from the accessible label and includes rich help", async () => {
    const button = createRef<HTMLButtonElement>();
    await show(
      <>
        <Field
          label="Subtotal"
          labelAdornment={
            <span role="img" aria-label="Check original">
              !
            </span>
          }
          hint={
            <span>
              Calculated from <strong>line totals</strong>.
            </span>
          }
        >
          <input defaultValue="12.50" />
        </Field>
        <Button ref={button}>Apply value</Button>
      </>,
    );
    const input = screen.getByRole("textbox", {
      name: "Subtotal",
    });
    expect(input).toHaveAccessibleDescription("Calculated from line totals.");
    expect(
      screen.getByRole("img", { name: "Check original" }),
    ).toBeInTheDocument();
    expect(button.current).toBe(
      screen.getByRole("button", { name: "Apply value" }),
    );
  });
  it("keeps nested options inside their containing popover", async () => {
    const user = userEvent.setup();
    await show(
      <div data-popover-root data-testid="received-popover">
        <StatusSelect />
      </div>,
    );
    const parent = screen.getByTestId("received-popover");
    const select = within(parent).getByRole("combobox", {
      name: "Invoice status",
    });
    await user.click(select);
    const listbox = within(parent).getByRole("listbox", {
      name: "Invoice status",
    });
    await user.click(within(listbox).getByRole("option", { name: "Posted" }));
    expect(within(parent).getByTestId("selected-status")).toHaveTextContent(
      "posted",
    );
    expect(select).toHaveFocus();
  });
  it("preserves the dialog name, cancellation and return focus with a separate visible heading", async () => {
    function StructuredDialog() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>
            Review imported invoices
          </Button>
          <Dialog
            open={open}
            onOpenChange={setOpen}
            title="Import complete"
            heading="13 invoices imported"
            description="Review before posting."
            icon={<span aria-hidden="true">✓</span>}
            footer={<Button onClick={() => setOpen(false)}>Done</Button>}
          >
            <Field label="Review note">
              <input defaultValue="Fictional invoice" />
            </Field>
          </Dialog>
        </>
      );
    }
    const user = userEvent.setup();
    await show(<StructuredDialog />);
    const trigger = screen.getByRole("button", {
      name: "Review imported invoices",
    });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Import complete" });
    expect(dialog).toHaveAccessibleDescription("Review before posting.");
    expect(
      within(dialog).getByRole("heading", { name: "13 invoices imported" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("textbox", { name: "Review note" }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole("button", { name: "Done" }),
    ).toBeInTheDocument();
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
