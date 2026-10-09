import { useState, type ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { DemoProvider } from "./store";
import {
  Money,
  UnitSize,
  DateText,
  ProductName,
  OfferLabel,
  branchLabel,
  demoUserLabel,
  formatMoney,
  formatDate,
} from "./presentation";
import {
  Badge,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DateField,
  Dropzone,
  Field,
  Menu,
  MenuItem,
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

function show(children: ReactNode) {
  return render(<DemoProvider>{children}</DemoProvider>);
}

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
    const view = show(<StatusSelect />);
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
    show(
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
    show(<StatusSelect disabled />);
    const select = screen.getByRole("combobox", { name: "Invoice status" });
    expect(select).toBeDisabled();
    await user.click(select);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected-status")).toHaveTextContent("draft");
  });

  it("preserves a supplied accessible label and description alongside field help", async () => {
    const user = userEvent.setup();
    show(
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
    show(<InvoiceStatusDialog />);
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
    const view = show(<MixAndMatch />);
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
    show(<MixAndMatch disabled />);
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
    const view = show(<ApprovalScope />);
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
    show(
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
    show(<SupplierTabs />);
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
    show(<SupplierTabs rtl />);
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
  it("keeps fixed status meanings in English and Persian despite caller tones", () => {
    show(
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
    const view = show(<InvoiceDate />);
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
    show(<InvoiceDate />);
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
    const view = show(<UnitCost />);
    const input = screen.getByRole("textbox", { name: "Unit cost before tax" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(view.container.querySelector('input[type="number"]')).toBeNull();
    await user.clear(input);
    await user.type(input, "2.35");
    expect(input).toHaveValue("2.35");
  });
});

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
    const view = show(<InvoiceUpload />);
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

  it("accepts a document dropped onto the upload control", () => {
    show(<InvoiceUpload />);
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
  it("moves among enabled actions and restores trigger focus after Escape", async () => {
    const user = userEvent.setup();
    const onLock = vi.fn();
    show(
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
    show(
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
});

describe("shared language and number presentation", () => {
  it("formats money without losing Decimal precision, with Western digits and the symbol first", () => {
    expect(formatMoney("2.99", { currency: "CAD" })).toBe("$2.99");
    expect(formatMoney("1260", { currency: "CAD" })).toBe("$1,260.00");
    expect(formatMoney("-2.99", { currency: "CAD" })).toBe("-$2.99");
    expect(formatMoney("9007199254740993.005", { currency: "CAD" })).toBe(
      "$9,007,199,254,740,993.01",
    );
    expect(formatMoney("1.2345", { currency: "CAD", decimals: 4 })).toBe(
      "$1.2345",
    );
    expect(formatMoney("5", { currency: "CAD", compact: true })).toBe("$5");
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

  it("isolates mixed Latin prices, dates and unit sizes inside Persian text", () => {
    const view = show(
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
    expect(screen.getByText("1 L").closest("bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(screen.getByText("2026-10-07").closest("bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(screen.getByText("$5").closest("bdi")).toHaveAttribute("dir", "ltr");
    expect(view.container).toHaveTextContent("۲ عدد $5");
  });

  it("uses the current language name first and translates branch and demo-user names", () => {
    const view = show(
      <ProductName
        product={{ name_en: "Milk", name_fa: "شیر" }}
        language="fa"
      />,
    );
    expect(view.container.querySelector("strong")).toHaveTextContent("شیر");
    expect(view.container.querySelector("small")).toHaveTextContent("Milk");
    expect(branchLabel("Branch 1", "fa")).toBe("شعبه 1");
    expect(branchLabel("all", "fa")).toBe("همه شعبه‌ها");
    expect(demoUserLabel("Demo Supervisor", "fa")).toBe("سرپرست نمایشی");
    expect(demoUserLabel("floorworker", "fa")).toBe("کارمند سالن نمایشی");
  });

  it("puts a notebook count in its own pill beside the translated tab name", () => {
    show(
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

it("keeps header and financial body fragments in the same shared table columns", () => {
  const warn = vi.spyOn(console, "error");
  show(
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
