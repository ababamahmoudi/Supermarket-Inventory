import { useState } from "react";
import Decimal from "decimal.js";
import { Plus, Printer, ArrowLeft, X } from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateField,
  Dialog,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
} from "../ui";
import { DateText, LtrText, Money } from "../presentation";
import { branchLabel, configuredBranches } from "../settings";
import { supplierRecords } from "../supplier-editor";
import { packUnits, costPerCase } from "../supplier-items";
import {
  canUseOrders,
  cancelOrder,
  createOrder,
  orderCandidates,
  orderLocations,
  placeOrder,
  remainingOrderUnits,
  saveOrderDraft,
  scopedOrders,
  type Order,
  type OrderContext,
  type OrderDraftInput,
} from "../orders";
import { orderError, orderStatusCopy } from "../c-orders-i18n";
import { OrderPrintDocument } from "../order-print";
import { useOperationalPrint } from "../operational-print-hook";
import "./orders.css";

interface FormState {
  id?: string;
  version?: number;
  branch: string;
  supplier: string;
  cases: Record<string, string>;
  costs: Record<string, string>;
  selectedNotes: string[];
  noteItems: Record<string, string>;
}

export default function Orders() {
  const { state, update, branch, role, user, lang, t, tCount, navigate } =
    useDemo();
  const context: OrderContext = {
    company_id: state.config.company.seed_key,
    branch: role === "floor_worker" ? (user?.branch ?? branch) : branch,
    role: role ?? "cashier",
    actor: user?.name ?? "",
    username: user?.username,
    device: "Browser demo",
    allowed_branches:
      role === "supervisor"
        ? configuredBranches(state.config, true)
        : user
          ? [user.branch]
          : [],
  };
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("id"),
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [printPreview, setPrintPreview] = useState<Order | null>(null);
  const { printDocument, printOutput, clearPrint } = useOperationalPrint();
  const sessionScope = `${context.company_id}:${context.role}:${context.username ?? ""}:${context.branch}`;
  const [boundScope, setBoundScope] = useState(sessionScope);
  if (boundScope !== sessionScope) {
    setBoundScope(sessionScope);
    setForm(null);
    setSelectedId(null);
    setPrintPreview(null);
    clearPrint();
    setCancelId(null);
    setReason("");
    setError("");
    setMessage("");
    setSearch("");
    setStatus("all");
    setSupplierFilter("all");
    setLocationFilter("all");
    setFrom("");
    setTo("");
    return null;
  }
  if (!canUseOrders(state, context))
    return <EmptyState>{orderError(new Error("permission"), t)}</EmptyState>;
  const all = scopedOrders(state, context);
  const selected = all.find((order) => order.id === selectedId);
  const suppliers = supplierRecords(state).filter(
    (supplier) =>
      supplier.company_id === context.company_id &&
      supplier.active &&
      supplier.status === "confirmed",
  );
  const locations = orderLocations(state, context);
  const candidates = form?.supplier
    ? orderCandidates(state, context, form.supplier)
    : [];
  const notes =
    form?.branch && locations.includes(form.branch)
      ? state.notes.filter(
          (note) =>
            note.company_id === context.company_id &&
            note.branch === form.branch &&
            note.type === "to_order" &&
            (note.status === "open" || form.selectedNotes.includes(note.id)),
        )
      : [];
  const visible = all.filter(
    (order) =>
      (status === "all" || order.status === status) &&
      (supplierFilter === "all" || order.supplier === supplierFilter) &&
      (locationFilter === "all" || order.branch === locationFilter) &&
      (!from || order.date >= from) &&
      (!to || order.date <= to) &&
      `${order.reference} ${order.supplier} ${branchLabel(state.config, order.branch, lang)} ${order.lines.map((line) => `${line.name_en} ${line.name_fa} ${line.supplier_item_code}`).join(" ")}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const money = (
    value: string | null,
    currency = state.config.company.currency,
    decimals = 2,
  ) =>
    value === null ? (
      <span className="muted">—</span>
    ) : (
      <Money value={value} currency={currency} decimals={decimals} />
    );
  const run = (mutator: (draft: typeof state) => void, success: string) => {
    try {
      update(mutator);
      setError("");
      setMessage(success);
      return true;
    } catch (caught) {
      setError(orderError(caught, t));
      setMessage("");
      return false;
    }
  };
  const newForm = () => {
    setForm({
      branch:
        branch === "all"
          ? ""
          : locations.includes(context.branch)
            ? context.branch
            : "",
      supplier: "",
      cases: {},
      costs: {},
      selectedNotes: [],
      noteItems: {},
    });
    setSelectedId(null);
    setError("");
    setMessage("");
  };
  const editForm = (order: Order) => {
    setForm({
      id: order.id,
      version: order.version,
      branch: order.branch,
      supplier: order.supplier,
      cases: Object.fromEntries(
        order.lines.map((line) => [line.supplier_item_id, line.ordered_cases]),
      ),
      costs: Object.fromEntries(
        order.lines.map((line) => [
          line.supplier_item_id,
          line.expected_unit_cost ?? "",
        ]),
      ),
      selectedNotes: [...order.source_note_ids],
      noteItems: Object.fromEntries(
        order.lines.flatMap((line) =>
          line.source_note_ids.map((id) => [id, line.supplier_item_id]),
        ),
      ),
    });
    setError("");
    setMessage("");
  };
  const setItemCases = (id: string, value: string) =>
    setForm((current) =>
      current ? { ...current, cases: { ...current.cases, [id]: value } } : null,
    );
  const setItemCost = (id: string, value: string) =>
    setForm((current) =>
      current ? { ...current, costs: { ...current.costs, [id]: value } } : null,
    );
  const addNote = (id: string) => {
    const note = notes.find((item) => item.id === id);
    const matches = note?.product_code
      ? candidates.filter((item) => item.product_code === note.product_code)
      : [];
    setForm((current) =>
      current
        ? {
            ...current,
            selectedNotes: [...new Set([...current.selectedNotes, id])],
            noteItems: {
              ...current.noteItems,
              [id]: matches.length === 1 ? matches[0].id : "",
            },
          }
        : null,
    );
  };
  const input = (): OrderDraftInput => ({
    branch: form!.branch,
    supplier: form!.supplier,
    source_note_ids: form!.selectedNotes,
    lines: candidates
      .filter((item) => Boolean(form!.cases[item.id]?.trim()))
      .map((item) => ({
        supplier_item_id: item.id,
        cases: form!.cases[item.id],
        expected_unit_cost: form!.costs[item.id],
        source_note_ids: form!.selectedNotes.filter(
          (id) => form!.noteItems[id] === item.id,
        ),
      })),
  });
  const save = (place: boolean) => {
    let savedId = "";
    if (
      run(
        (draft) => {
          const order = form!.id
            ? saveOrderDraft(draft, context, form!.id, input(), form!.version)
            : createOrder(draft, context, input());
          if (place) placeOrder(draft, context, order.id, order.version);
          savedId = order.id;
        },
        place
          ? t("Order placed.", "سفارش ثبت شد.")
          : t("Draft saved.", "پیش‌نویس ذخیره شد."),
      )
    ) {
      setSelectedId(savedId);
      setForm(null);
    }
  };
  const rowAmounts = candidates.map((item) => {
    const cases = form?.cases[item.id]?.trim() ?? "";
    if (!cases)
      return {
        id: item.id,
        units: null,
        caseCost: item.expected_case_cost,
        total: null,
        selected: false,
      };
    try {
      const units = packUnits(cases, "cases", item.units_per_case);
      const entered = form?.costs[item.id]?.trim();
      const changed =
        entered &&
        (item.expected_unit_cost === null ||
          !new Decimal(entered).eq(item.expected_unit_cost));
      const caseCost = changed
        ? costPerCase(entered!, item.units_per_case)
        : item.expected_case_cost;
      return {
        id: item.id,
        units,
        caseCost,
        total:
          caseCost === null
            ? null
            : new Decimal(caseCost)
                .times(cases)
                .toFixed(2, Decimal.ROUND_HALF_UP),
        selected: true,
      };
    } catch {
      return {
        id: item.id,
        units: null,
        caseCost: null,
        total: null,
        selected: true,
      };
    }
  });
  const total = rowAmounts.some((row) => row.selected && row.total === null)
    ? null
    : rowAmounts
        .reduce((sum, row) => sum.plus(row.total ?? 0), new Decimal(0))
        .toFixed(2);
  const back = () => {
    setForm(null);
    setSelectedId(null);
    setError("");
    setMessage("");
    navigate("orders");
  };
  return (
    <div className="orders-page">
      <PageHeader
        title={
          form
            ? t("New order", "سفارش جدید")
            : selected
              ? selected.reference
              : t("Orders", "سفارش‌ها")
        }
        actions={
          form || selected ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft size={16} />
              {t("All orders", "همه سفارش‌ها")}
            </Button>
          ) : (
            <Button onClick={newForm}>
              <Plus size={16} />
              {t("New order", "سفارش جدید")}
            </Button>
          )
        }
      />
      {error && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="banner success" role="status">
          {message}
        </p>
      )}
      {form ? (
        <>
          <Card className="order-form-card">
            <form
              aria-label={t("New order", "سفارش جدید")}
              onSubmit={(event) => {
                event.preventDefault();
                save(false);
              }}
            >
              <div className="order-heading-fields">
                <Field label={t("Location", "مکان")}>
                  <Select
                    value={form.branch}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        branch: value,
                        selectedNotes: [],
                        noteItems: {},
                      })
                    }
                    options={[
                      { value: "", label: t("Choose location", "انتخاب مکان") },
                      ...locations.map((id) => ({
                        value: id,
                        label: branchLabel(state.config, id, lang),
                      })),
                    ]}
                  />
                </Field>
                <Field label={t("Supplier", "تأمین‌کننده")}>
                  <Select
                    value={form.supplier}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        supplier: value,
                        cases: {},
                        costs: {},
                        noteItems: {},
                      })
                    }
                    options={[
                      {
                        value: "",
                        label: t("Choose supplier", "انتخاب تأمین‌کننده"),
                      },
                      ...suppliers.map((supplier) => ({
                        value: supplier.name,
                        label: supplier.name,
                      })),
                    ]}
                  />
                </Field>
              </div>
              {form.supplier && (
                <>
                  <h2>{t("Supplier items", "کالاهای تأمین‌کننده")}</h2>
                  {!candidates.length ? (
                    <EmptyState>
                      {t(
                        "No supplier items yet. Ask your Supervisor to add items on the supplier page.",
                        "هنوز کالایی برای این تأمین‌کننده ثبت نشده است. از سرپرست بخواهید در صفحهٔ تأمین‌کننده کالا اضافه کند.",
                      )}
                    </EmptyState>
                  ) : (
                    <DataTable
                      className="order-items-table"
                      columns={[
                        { width: "240px" },
                        { width: "130px" },
                        { width: "120px" },
                        { width: "110px", align: "end" },
                        { width: "160px", align: "end" },
                        { width: "160px", align: "end" },
                        { width: "150px", align: "end" },
                      ]}
                    >
                      <thead>
                        <tr>
                          <th>
                            {t(
                              "Product / supplier code",
                              "کالا / کد تأمین‌کننده",
                            )}
                          </th>
                          <th>{t("Units per case", "واحد در کارتن")}</th>
                          <th>{t("Cases", "کارتن")}</th>
                          <th>{t("Units", "واحد")}</th>
                          <th>
                            {t("Expected unit cost", "هزینهٔ مورد انتظار واحد")}
                          </th>
                          <th>{t("Case cost", "هزینهٔ کارتن")}</th>
                          <th>{t("Before-tax total", "جمع پیش از مالیات")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((item) => {
                          const row = rowAmounts.find(
                            (amount) => amount.id === item.id,
                          )!;
                          let costSource = item.expected_cost_source;
                          const enteredCost = form.costs[item.id];
                          if (enteredCost !== undefined) {
                            try {
                              if (
                                !/^\d+(\.\d{1,4})?$/.test(enteredCost.trim()) ||
                                item.expected_unit_cost === null ||
                                !new Decimal(enteredCost).eq(
                                  item.expected_unit_cost,
                                )
                              )
                                costSource = null;
                            } catch {
                              costSource = null;
                            }
                          }
                          const name =
                            lang === "fa"
                              ? item.name_fa || item.name_en
                              : item.name_en;
                          return (
                            <tr key={item.id} data-item-id={item.id}>
                              <td>
                                <strong>{name}</strong>
                                <span className="order-item-caption">
                                  <LtrText>
                                    {item.supplier_item_code ||
                                      item.product_code}{" "}
                                    · {item.unit_size}
                                  </LtrText>
                                </span>
                              </td>
                              <td>
                                <LtrText>{item.units_per_case}</LtrText>
                              </td>
                              <td>
                                <NumberField
                                  aria-label={`${t("Cases", "کارتن")} — ${name}`}
                                  value={form.cases[item.id] ?? ""}
                                  min="0"
                                  step="0.5"
                                  onChange={(value) =>
                                    setItemCases(item.id, value)
                                  }
                                />
                              </td>
                              <td className="numeric">
                                <LtrText>{row.units ?? "—"}</LtrText>
                              </td>
                              <td className="numeric">
                                <NumberField
                                  aria-label={`${t("Expected unit cost", "هزینهٔ مورد انتظار واحد")} — ${name}`}
                                  value={
                                    form.costs[item.id] ??
                                    item.expected_unit_cost ??
                                    ""
                                  }
                                  onChange={(value) =>
                                    setItemCost(item.id, value)
                                  }
                                  step="0.0001"
                                  min="0"
                                />
                                <span className="order-item-caption">
                                  {costSource === "last_bought"
                                    ? t("Last bought", "آخرین خرید")
                                    : costSource === "quoted"
                                      ? t(
                                          "Supplier quote",
                                          "قیمت اعلامی تأمین‌کننده",
                                        )
                                      : t(
                                          "Expected unit cost",
                                          "هزینهٔ مورد انتظار واحد",
                                        )}
                                </span>
                              </td>
                              <td className="numeric">
                                {money(row.caseCost, undefined, 4)}
                              </td>
                              <td className="numeric">{money(row.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </DataTable>
                  )}
                </>
              )}
              <div className="order-total">
                <span>
                  {t(
                    "Expected total before tax",
                    "جمع مورد انتظار پیش از مالیات",
                  )}
                </span>
                <strong>{money(total)}</strong>
              </div>
              <div className="actions order-form-actions">
                <Button type="submit" variant="secondary">
                  {t("Save as draft", "ذخیره پیش‌نویس")}
                </Button>
                <Button onClick={() => save(true)}>
                  {t("Place order", "ثبت سفارش")}
                </Button>
                <Button variant="ghost" onClick={back}>
                  {t("Cancel", "انصراف")}
                </Button>
              </div>
            </form>
          </Card>
          {form.branch && (
            <Card
              title={t("To order", "برای سفارش")}
              className="order-notes-card"
            >
              {!notes.length ? (
                <EmptyState>
                  {t(
                    "No open To order notes at this location.",
                    "یادداشت باز برای سفارش در این مکان وجود ندارد.",
                  )}
                </EmptyState>
              ) : (
                <div className="order-note-list">
                  {notes.map((note) => {
                    const added = form.selectedNotes.includes(note.id);
                    return (
                      <div className="order-source-note" key={note.id}>
                        <div className="row-between">
                          <span>
                            <bdi dir="auto">{note.text}</bdi>
                            {note.qty !== undefined && (
                              <span className="order-item-caption">
                                {t("Quantity", "تعداد")}{" "}
                                <LtrText>{note.qty}</LtrText>
                              </span>
                            )}
                          </span>
                          {added ? (
                            <Button
                              variant="ghost"
                              aria-label={t(
                                "Remove note from order",
                                "حذف یادداشت از سفارش",
                              )}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  selectedNotes: form.selectedNotes.filter(
                                    (id) => id !== note.id,
                                  ),
                                  noteItems: {
                                    ...form.noteItems,
                                    [note.id]: "",
                                  },
                                })
                              }
                            >
                              <X size={16} />
                              {t("Remove", "حذف")}
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() => addNote(note.id)}
                            >
                              {t("Add to order", "افزودن به سفارش")}
                            </Button>
                          )}
                        </div>
                        {added && (
                          <div className="order-note-mapping">
                            <Field
                              label={t("Supplier item", "کالای تأمین‌کننده")}
                            >
                              <Select
                                value={form.noteItems[note.id] ?? ""}
                                onChange={(value) =>
                                  setForm({
                                    ...form,
                                    noteItems: {
                                      ...form.noteItems,
                                      [note.id]: value,
                                    },
                                  })
                                }
                                options={[
                                  {
                                    value: "",
                                    label: t("Choose item", "انتخاب کالا"),
                                  },
                                  ...candidates.map((item) => ({
                                    value: item.id,
                                    label: `${lang === "fa" ? item.name_fa || item.name_en : item.name_en} · ${item.supplier_item_code || item.product_code}`,
                                  })),
                                ]}
                              />
                            </Field>
                            <p className="helper">
                              {t(
                                "Enter Cases for this item in the table before placing the order.",
                                "پیش از ثبت سفارش، تعداد کارتن این کالا را در جدول وارد کنید.",
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      ) : selected ? (
        <>
          <Card className="order-detail-card">
            <div className="row-between">
              <Badge
                tone={
                  selected.status === "received"
                    ? "approved"
                    : selected.status === "partially_received"
                      ? "progress"
                      : "neutral"
                }
              >
                {t(...orderStatusCopy[selected.status])}
              </Badge>
              <div className="actions">
                {selected.status === "draft" && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => editForm(selected)}
                    >
                      {t("Edit draft", "ویرایش پیش‌نویس")}
                    </Button>
                    <Button
                      onClick={() =>
                        run(
                          (draft) => {
                            placeOrder(
                              draft,
                              context,
                              selected.id,
                              selected.version,
                            );
                          },
                          t("Order placed.", "سفارش ثبت شد."),
                        )
                      }
                    >
                      {t("Place order", "ثبت سفارش")}
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setPrintPreview(structuredClone(selected))}
                >
                  <Printer size={16} />
                  {t("Print order", "چاپ سفارش")}
                </Button>
                {["draft", "ordered", "partially_received"].includes(
                  selected.status,
                ) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCancelId(selected.id);
                      setReason("");
                    }}
                  >
                    {t("Cancel order", "لغو سفارش")}
                  </Button>
                )}
              </div>
            </div>
            <dl className="order-detail-meta">
              <div>
                <dt>{t("Location", "مکان")}</dt>
                <dd>{branchLabel(state.config, selected.branch, lang)}</dd>
              </div>
              <div>
                <dt>{t("Supplier", "تأمین‌کننده")}</dt>
                <dd>
                  <LtrText>{selected.supplier}</LtrText>
                </dd>
              </div>
              <div>
                <dt>{t("Date", "تاریخ")}</dt>
                <dd>
                  <DateText value={selected.date} />
                </dd>
              </div>
              <div>
                <dt>
                  {t(
                    "Expected total before tax",
                    "جمع مورد انتظار پیش از مالیات",
                  )}
                </dt>
                <dd>
                  {money(selected.expected_total_before_tax, selected.currency)}
                </dd>
              </div>
            </dl>
            <DataTable
              className="order-progress-table"
              columns={[
                { width: "260px" },
                { width: "120px", align: "end" },
                { width: "120px", align: "end" },
                { width: "120px", align: "end" },
                { width: "120px", align: "end" },
                { width: "120px", align: "end" },
                { width: "160px", align: "end" },
              ]}
            >
              <thead>
                <tr>
                  <th>
                    {t("Product / supplier code", "کالا / کد تأمین‌کننده")}
                  </th>
                  <th>{t("Cases", "کارتن")}</th>
                  <th>{t("Ordered units", "واحد سفارش‌شده")}</th>
                  <th>{t("Received units", "واحد دریافت‌شده")}</th>
                  <th>{t("Cancelled units", "واحد لغوشده")}</th>
                  <th>{t("Remaining units", "واحد باقی‌مانده")}</th>
                  <th>{t("Before-tax total", "جمع پیش از مالیات")}</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <strong>
                        {lang === "fa"
                          ? line.name_fa || line.name_en
                          : line.name_en}
                      </strong>
                      <span className="order-item-caption">
                        <LtrText>
                          {line.supplier_item_code || line.product_code} ·{" "}
                          {line.units_per_case}
                        </LtrText>
                      </span>
                      {line.outstanding_decision && (
                        <span className="order-item-caption">
                          {line.outstanding_decision === "short"
                            ? t("Short", "کسری")
                            : line.outstanding_decision === "back_ordered"
                              ? t("Back-ordered", "در انتظار تأمین")
                              : t("Cancelled", "لغوشده")}
                        </span>
                      )}
                    </td>
                    <td className="numeric">
                      <LtrText>{line.ordered_cases}</LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>{line.ordered_units}</LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>{line.received_units}</LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>{line.cancelled_units}</LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>{remainingOrderUnits(line)}</LtrText>
                    </td>
                    <td className="numeric">
                      {money(line.expected_line_total, selected.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {selected.cancellation_reason && (
              <p className="helper">{selected.cancellation_reason}</p>
            )}
          </Card>
          {selected.linked_invoice_ids.length > 0 && (
            <Card title={t("Linked invoices", "فاکتورهای مرتبط")}>
              <div className="actions">
                {selected.linked_invoice_ids.map((id) => (
                  <Button
                    variant="secondary"
                    key={id}
                    onClick={() =>
                      navigate(`invoices?id=${encodeURIComponent(id)}`)
                    }
                  >
                    <LtrText>
                      {[...(state.invoices ?? []), state.invoice].find(
                        (invoice) => invoice.id === id,
                      )?.supplier_invoice_number ?? id}
                    </LtrText>
                  </Button>
                ))}
              </div>
            </Card>
          )}
          {selected.source_note_ids.length > 0 && (
            <Card title={t("To order", "برای سفارش")}>
              {selected.source_note_ids.map((id) => (
                <p key={id}>
                  <bdi dir="auto">
                    {state.notes.find(
                      (note) =>
                        note.id === id &&
                        note.company_id === selected.company_id &&
                        note.branch === selected.branch,
                    )?.text ?? "—"}
                  </bdi>
                </p>
              ))}
            </Card>
          )}
        </>
      ) : (
        <Card>
          <FilterToolbar
            aria-label={t("Order filters", "فیلتر سفارش‌ها")}
            className="order-filters"
            search={
              <input
                aria-label={t("Search orders", "جستجوی سفارش‌ها")}
                placeholder={t(
                  "Search reference, supplier or product",
                  "جستجوی شماره، تأمین‌کننده یا کالا",
                )}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            }
            count={tCount(
              "{{count}} order",
              "{{count}} orders",
              "{{count}} سفارش",
              "{{count}} سفارش",
              visible.length,
            )}
          >
            <Field label={t("Status", "وضعیت")}>
              <Select
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: t("All statuses", "همه وضعیت‌ها") },
                  ...Object.entries(orderStatusCopy).map(([value, copy]) => ({
                    value,
                    label: t(...copy),
                  })),
                ]}
              />
            </Field>
            <Field label={t("Supplier", "تأمین‌کننده")}>
              <Select
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={[
                  {
                    value: "all",
                    label: t("All suppliers", "همه تأمین‌کننده‌ها"),
                  },
                  ...[...new Set(all.map((order) => order.supplier))].map(
                    (value) => ({ value, label: value }),
                  ),
                ]}
              />
            </Field>
            {role === "supervisor" && branch === "all" && (
              <Field label={t("Location", "مکان")}>
                <Select
                  value={locationFilter}
                  onChange={setLocationFilter}
                  options={[
                    { value: "all", label: t("All locations", "همه مکان‌ها") },
                    ...[...new Set(all.map((order) => order.branch))].map(
                      (value) => ({
                        value,
                        label: branchLabel(state.config, value, lang),
                      }),
                    ),
                  ]}
                />
              </Field>
            )}
            <Field label={t("From", "از")}>
              <DateField value={from} onChange={setFrom} />
            </Field>
            <Field label={t("To", "تا")}>
              <DateField value={to} onChange={setTo} />
            </Field>
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setSupplierFilter("all");
                setLocationFilter("all");
                setFrom("");
                setTo("");
              }}
            >
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          </FilterToolbar>
          {!visible.length ? (
            <EmptyState>
              {t(
                "No orders match these filters.",
                "سفارشی با این فیلترها پیدا نشد.",
              )}
            </EmptyState>
          ) : (
            <DataTable
              className="orders-list-table"
              columns={[
                { width: "145px" },
                { width: "165px" },
                { width: "220px" },
                { width: "135px" },
                { width: "170px", align: "end" },
                { width: "180px" },
              ]}
            >
              <thead>
                <tr>
                  <th>{t("Reference", "شماره")}</th>
                  <th>{t("Location", "مکان")}</th>
                  <th>{t("Supplier", "تأمین‌کننده")}</th>
                  <th>{t("Date", "تاریخ")}</th>
                  <th>
                    {t(
                      "Before-tax expected total",
                      "جمع مورد انتظار پیش از مالیات",
                    )}
                  </th>
                  <th>{t("Status", "وضعیت")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedId(order.id);
                          setError("");
                          setMessage("");
                        }}
                      >
                        <LtrText>{order.reference}</LtrText>
                      </Button>
                    </td>
                    <td>{branchLabel(state.config, order.branch, lang)}</td>
                    <td>
                      <LtrText>{order.supplier}</LtrText>
                    </td>
                    <td>
                      <DateText value={order.date} />
                    </td>
                    <td className="numeric">
                      {money(order.expected_total_before_tax, order.currency)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          order.status === "received"
                            ? "approved"
                            : order.status === "partially_received"
                              ? "progress"
                              : "neutral"
                        }
                      >
                        {t(...orderStatusCopy[order.status])}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      )}
      <Dialog
        open={cancelId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelId(null);
        }}
        title={t("Cancel order", "لغو سفارش")}
        description={t(
          "Previous receipts and invoice links are retained.",
          "رسیدهای قبلی و ارتباط با فاکتورها حفظ می‌شوند.",
        )}
      >
        <Field label={t("Reason", "دلیل")}>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </Field>
        <div className="actions">
          <Button variant="secondary" onClick={() => setCancelId(null)}>
            {t("Keep order", "نگه داشتن سفارش")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (
                run(
                  (draft) => {
                    cancelOrder(
                      draft,
                      context,
                      cancelId!,
                      reason,
                      all.find((order) => order.id === cancelId)?.version,
                    );
                  },
                  t("Order cancelled.", "سفارش لغو شد."),
                )
              )
                setCancelId(null);
            }}
          >
            {t("Cancel order", "لغو سفارش")}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={printPreview !== null}
        onOpenChange={(open) => {
          if (!open) setPrintPreview(null);
        }}
        title={t("Print order", "چاپ سفارش")}
        className="order-print-dialog"
      >
        {printPreview && (
          <>
            <div className="order-sheet-preview">
              <OrderPrintDocument
                order={printPreview}
                config={state.config}
                language={lang}
              />
            </div>
            <div className="actions">
              <Button variant="secondary" onClick={() => setPrintPreview(null)}>
                {t("Close", "بستن")}
              </Button>
              <Button
                onClick={() =>
                  printDocument(
                    <OrderPrintDocument
                      order={structuredClone(printPreview)}
                      config={structuredClone(state.config)}
                      language={lang}
                    />,
                  )
                }
              >
                <Printer size={16} />
                {t("Print", "چاپ")}
              </Button>
            </div>
          </>
        )}
      </Dialog>
      {printOutput}
    </div>
  );
}
