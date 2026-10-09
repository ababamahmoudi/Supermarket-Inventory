import { useEffect, useState } from "react";
import { Plus, Pencil, Archive } from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DateField,
  Dialog,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  Tabs,
} from "../ui";
import { demoUserLabel, LtrText, ProductName } from "../presentation";
import {
  addNote,
  operationError,
  companyTimestamp,
  scopedRecords,
  updateNoteStatus,
} from "../operations";
import {
  addNotebookEntry,
  archiveNotebook,
  canAddNotebookEntry,
  canEditNotebookEntry,
  editNotebookEntry,
  notebookError,
  NotebookError,
  notebookEntryLocations,
  readableNotebookEntries,
  updateNotebookEntryStatus,
  visibleNotebooks,
  type NotebookDefinition,
  type NotebookContext,
  type NotebookEntry,
} from "../notebooks";
import { branchLabel, configuredBranches } from "../settings";
import { translateCount } from "../i18n";
import { UNDO_DURATION } from "../undo-queue";
import { notesText } from "../c-notes-i18n";
import { NotebookEditor } from "./NotebookSettings";
import type { NoteRecord } from "../types";
import "./notebooks-b.css";
import "./c3-labels-notes-offers.css";

type NoteField =
  "text" | "product" | "qty" | "date" | "measurement" | "location";

export function Notes() {
  const { state, update, branch, role, user, lang, t } = useDemo();
  const context: NotebookContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? "",
    allowed_branches:
      role === "supervisor"
        ? configuredBranches(state.config, true)
        : user
          ? [user.branch]
          : [],
  };
  const definitions = visibleNotebooks(state, context);
  const allDefinitions = visibleNotebooks(state, context, {
    includeArchived: true,
  });
  const [tab, setTab] = useState<string>(() =>
    role === "cashier" ? (definitions[0]?.id ?? "") : "to_order",
  );
  const [text, setText] = useState("");
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [measurement, setMeasurement] = useState("");
  const [entryLocation, setEntryLocation] = useState("");
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<NoteField, string>>
  >({});
  const [message, setMessage] = useState<[string, string] | null>(null);
  const [editor, setEditor] = useState<NotebookDefinition | "new" | null>(null);
  const [archiving, setArchiving] = useState<NotebookDefinition | null>(null);
  const [editing, setEditing] = useState<{
    entry: NotebookEntry;
    snapshot: string;
  } | null>(null);
  const [entryClock, setEntryClock] = useState(0);
  useEffect(() => {
    if (role === "supervisor") return;
    const now = Date.now();
    const deadline = (state.notebook_entries ?? [])
      .filter((entry) => entry.by === context.actor && !entry.archived)
      .map((entry) => Date.parse(entry.created_at) + UNDO_DURATION)
      .filter((time) => Number.isFinite(time) && time > now)
      .sort((left, right) => left - right)[0];
    if (deadline === undefined) return;
    const timer = window.setTimeout(
      () => setEntryClock((value) => value + 1),
      deadline - now + 1,
    );
    return () => window.clearTimeout(timer);
  }, [role, context.actor, state.notebook_entries, entryClock]);
  const clearEntryForm = () => {
    setEditing(null);
    setText("");
    setProduct("");
    setQty("");
    setDate("");
    setMeasurement("");
    setFieldErrors({});
  };
  const clearFieldError = (field: NoteField) =>
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  const builtinTabs =
    role === "cashier"
      ? []
      : [
          { key: "to_order", label: t("To order", "برای سفارش") },
          { key: "store_use", label: t("Store use", "مصرف فروشگاه") },
          {
            key: "note_to_supervisor",
            label: t("For Supervisor", "برای سرپرست"),
          },
        ];
  const tabs = [
    ...builtinTabs,
    ...definitions.map((item) => ({
      key: item.id,
      label: lang === "fa" ? item.name_fa || item.name_en : item.name_en,
    })),
  ];
  const activeTab = tabs.some((item) => item.key === tab)
    ? tab
    : (tabs[0]?.key ?? "");
  const notebook = definitions.find((item) => item.id === activeTab);
  const isBuiltin = !notebook && role !== "cashier";
  const locations = notebook
    ? notebookEntryLocations(state, notebook, context)
    : [];
  const targetLocation = branch === "all" ? entryLocation : branch;
  const canChooseLocation = Boolean(
    notebook && role === "supervisor" && branch === "all" && locations.length,
  );
  const canAdd = isBuiltin
    ? branch !== "all"
    : Boolean(notebook && locations.includes(targetLocation));
  const canSaveEdit = Boolean(
    editing && canEditNotebookEntry(state, context, editing.entry.id),
  );
  const allNotes =
    role === "cashier" ? [] : scopedRecords(state.notes, context);
  const allEntries = readableNotebookEntries(state, context);
  const query = search.trim().toLocaleLowerCase();
  const searchText = (item: {
    text: string;
    by: string;
    product_code?: string;
    notebook_id?: string;
  }) => {
    const linked = state.products.find(
      (record) =>
        record.company_id === context.company_id &&
        record.code === item.product_code,
    );
    const named = allDefinitions.find(
      (record) => record.id === item.notebook_id,
    );
    return `${item.text} ${item.by} ${item.product_code ?? ""} ${linked?.name_en ?? ""} ${linked?.name_fa ?? ""} ${named?.name_en ?? ""} ${named?.name_fa ?? ""}`
      .toLocaleLowerCase()
      .includes(query);
  };
  const notes = allNotes.filter(
    (item) =>
      !("archived" in item && item.archived) &&
      (query || item.type === activeTab) &&
      (showDone || (item.status !== "resolved" && item.status !== "ordered")) &&
      (!query || searchText(item)),
  );
  const entries = allEntries.filter(
    (item) =>
      (query || item.notebook_id === activeTab) &&
      (showDone || item.status !== "done") &&
      (!query || searchText(item)),
  );
  const count = notes.length + entries.length;
  const run = (
    action: (draft: typeof state) => void,
    feedback: [string, string],
    custom = false,
  ) => {
    try {
      update(action);
      setMessage(feedback);
      setError("");
      setFieldErrors({});
      return true;
    } catch (caught) {
      const message = custom
        ? notebookError(caught, t)
        : operationError(caught instanceof Error ? caught.message : "", t);
      const key =
        caught instanceof NotebookError
          ? caught.key
          : caught instanceof Error
            ? caught.message
            : "";
      const field = (
        {
          text: "text",
          product: "product",
          quantity: "qty",
          date: "date",
          measurement: "measurement",
          branch: "location",
          location_unavailable: "location",
          store_use: product ? "qty" : "product",
        } as Record<string, NoteField>
      )[key];
      if (entryOpen && field)
        setFieldErrors((previous) => ({ ...previous, [field]: message }));
      else setError(message);
      return false;
    }
  };
  const productView = (code: string) => {
    const item = state.products.find(
      (record) =>
        record.code === code && record.company_id === context.company_id,
    );
    return item ? (
      <ProductName product={item} language={lang} />
    ) : (
      <LtrText>{code}</LtrText>
    );
  };
  if (!role || (!tabs.length && !allDefinitions.length))
    return (
      <EmptyState>
        {t(
          "No notebooks are available for your role in this branch.",
          "دفترچه‌ای برای نقش شما در این شعبه در دسترس نیست.",
        )}
      </EmptyState>
    );
  return (
    <div className="notebooks-page">
      <PageHeader
        title={t("Notes", "یادداشت‌ها")}
        description={t(
          "Recorded with author, branch and time.",
          "ثبت‌شده با نویسنده، شعبه و زمان.",
        )}
        actions={
          <>
            {(isBuiltin || canAdd || canChooseLocation) && (
              <Button
                onClick={() => {
                  clearEntryForm();
                  setError("");
                  setMessage(null);
                  setEntryOpen(true);
                }}
              >
                <Plus size={16} aria-hidden="true" />
                {t("Add note", "افزودن یادداشت")}
              </Button>
            )}
            {role === "supervisor" && (
              <Button variant="secondary" onClick={() => setEditor("new")}>
                <Plus size={16} aria-hidden="true" />
                {t("New notebook", "دفترچه جدید")}
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={activeTab}
        aria-label={t("Notebooks", "دفترچه‌ها")}
        onChange={(value) => {
          setTab(value);
          clearEntryForm();
          setEntryLocation("");
          setError("");
          setMessage(null);
          setEntryOpen(false);
        }}
        options={tabs.map((item) => ({
          value: item.key,
          label: item.label,
          count:
            item.key === "note_to_supervisor" && role === "supervisor"
              ? allNotes.filter(
                  (note) => note.type === item.key && note.status === "open",
                ).length
              : definitions.some(
                    (record) => record.id === item.key && record.status_enabled,
                  )
                ? allEntries.filter(
                    (entry) =>
                      entry.notebook_id === item.key && entry.status === "open",
                  ).length
                : undefined,
        }))}
      />
      {notebook && role === "supervisor" && (
        <div className="actions notebook-manage-actions">
          <Button variant="secondary" onClick={() => setEditor(notebook)}>
            <Pencil size={16} aria-hidden="true" />
            {t("Edit notebook", "ویرایش دفترچه")}
          </Button>
          <Button variant="secondary" onClick={() => setArchiving(notebook)}>
            <Archive size={16} aria-hidden="true" />
            {t("Archive notebook", "بایگانی دفترچه")}
          </Button>
          <a href="#settings?group=notes">
            {t("Notebook settings", "تنظیمات دفترچه")}
          </a>
        </div>
      )}
      {entryOpen && (editing || isBuiltin || canAdd || canChooseLocation) && (
        <Dialog
          open
          onOpenChange={(open) => {
            setEntryOpen(open);
            if (!open) {
              clearEntryForm();
              setError("");
            }
          }}
          title={
            editing
              ? t("Edit note", "ویرایش یادداشت")
              : t("Add note", "افزودن یادداشت")
          }
          className="c3-operation-dialog notebook-entry-dialog"
        >
          <form
            aria-label={
              editing
                ? t("Edit note", "ویرایش یادداشت")
                : t("Add note", "افزودن یادداشت")
            }
            onSubmit={(event) => {
              event.preventDefault();
              const saved = run(
                (draft) => {
                  if (editing)
                    editNotebookEntry(
                      draft,
                      context,
                      editing.entry.id,
                      {
                        text,
                        product_code: product || undefined,
                        qty: qty ? Number(qty) : undefined,
                        date: date || undefined,
                        measurement: measurement || undefined,
                      },
                      editing.snapshot,
                    );
                  else if (notebook)
                    addNotebookEntry(draft, context, notebook.id, {
                      branch: targetLocation || undefined,
                      text,
                      product_code: product || undefined,
                      qty: qty ? Number(qty) : undefined,
                      date: date || undefined,
                      measurement: measurement || undefined,
                    });
                  else
                    addNote(draft, context, {
                      type: activeTab as NoteRecord["type"],
                      text,
                      product_code: product || undefined,
                      qty: qty ? Number(qty) : undefined,
                    });
                },
                editing
                  ? ["Saved changes.", "تغییرات ذخیره شد."]
                  : ["Saved note.", "یادداشت ذخیره شد."],
                Boolean(notebook),
              );
              if (saved) {
                clearEntryForm();
                setEntryOpen(false);
              }
            }}
          >
            <div className="form-grid">
              {!editing && canChooseLocation && (
                <Field
                  label={notesText(t, "location")}
                  error={fieldErrors.location}
                >
                  <Select
                    value={entryLocation}
                    onChange={(value) => {
                      setEntryLocation(value);
                      clearFieldError("location");
                    }}
                    options={[
                      { value: "", label: notesText(t, "chooseLocation") },
                      ...locations.map((location) => ({
                        value: location,
                        label: branchLabel(state.config, location, lang),
                      })),
                    ]}
                  />
                </Field>
              )}
              <Field
                className="notebook-note-field"
                label={t("Note", "یادداشت")}
                error={fieldErrors.text}
              >
                <textarea
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    clearFieldError("text");
                  }}
                  placeholder={t(
                    "What should the team know?",
                    "تیم باید چه چیزی بداند؟",
                  )}
                />
              </Field>
              {(isBuiltin || notebook?.fields.product) && (
                <Field
                  error={fieldErrors.product}
                  label={
                    activeTab === "store_use"
                      ? notesText(t, "productRequired")
                      : t("Product (optional)", "محصول (اختیاری)")
                  }
                >
                  <Select
                    value={product}
                    onChange={(value) => {
                      setProduct(value);
                      clearFieldError("product");
                    }}
                    options={[
                      { value: "", label: t("Choose product", "انتخاب محصول") },
                      ...state.products
                        .filter(
                          (item) =>
                            item.company_id === context.company_id &&
                            (item.status === "active" ||
                              item.code === editing?.entry.product_code),
                        )
                        .map((item) => ({
                          value: item.code,
                          label:
                            lang === "fa"
                              ? item.name_fa || item.name_en
                              : item.name_en,
                        })),
                    ]}
                  />
                </Field>
              )}
              {(isBuiltin || notebook?.fields.quantity) && (
                <Field
                  className="field-short"
                  error={fieldErrors.qty}
                  label={
                    activeTab === "store_use"
                      ? t(
                          "Actual quantity used (required)",
                          "تعداد واقعی مصرف‌شده (ضروری)",
                        )
                      : t("Quantity (optional)", "تعداد (اختیاری)")
                  }
                >
                  <NumberField
                    min="1"
                    step={isBuiltin ? "1" : "0.01"}
                    value={qty}
                    onChange={(value) => {
                      setQty(value);
                      clearFieldError("qty");
                    }}
                  />
                </Field>
              )}
              {notebook?.fields.date && (
                <Field
                  label={t("Date (optional)", "تاریخ (اختیاری)")}
                  error={fieldErrors.date}
                >
                  <DateField
                    value={date}
                    onChange={(value) => {
                      setDate(value);
                      clearFieldError("date");
                    }}
                  />
                </Field>
              )}
              {notebook?.fields.measurement && (
                <Field
                  className="field-short"
                  error={fieldErrors.measurement}
                  label={`${t("Measurement", "اندازه‌گیری")} (${editing?.entry.measurement_unit ?? notebook.fields.measurement_unit})`}
                >
                  <NumberField
                    step="0.1"
                    value={measurement}
                    onChange={(value) => {
                      setMeasurement(value);
                      clearFieldError("measurement");
                    }}
                  />
                </Field>
              )}
            </div>
            {activeTab === "store_use" && (
              <p className="banner info">{notesText(t, "storeUse")}</p>
            )}
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            <div className="dialog-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setEntryOpen(false);
                  clearEntryForm();
                  setError("");
                }}
              >
                {t("Cancel", "لغو")}
              </Button>
              <Button type="submit" disabled={editing ? !canSaveEdit : !canAdd}>
                {editing
                  ? t("Save changes", "ذخیره تغییرات")
                  : t("Save note", "ذخیره یادداشت")}
              </Button>
            </div>
            {editing && !canSaveEdit && (
              <p className="muted" role="status">
                {t(
                  "This note can no longer be edited. Ask the Supervisor to review it.",
                  "دیگر امکان ویرایش این یادداشت وجود ندارد. از سرپرست بخواهید آن را بررسی کند.",
                )}
              </p>
            )}
            {!editing && branch === "all" && !canAdd && (
              <p className="muted" role="status">
                {notebook
                  ? notesText(t, "chooseLocation")
                  : t(
                      "Choose one branch before adding or updating a note.",
                      "پیش از افزودن یا تغییر یادداشت، یک شعبه انتخاب کنید.",
                    )}
              </p>
            )}
          </form>
        </Dialog>
      )}
      {notebook && !canAdd && !canChooseLocation && !editing && (
        <p className="muted" role="status">
          {notesText(
            t,
            role !== "supervisor" &&
              (!notebook.read_roles.includes(role ?? "cashier") ||
                !notebook.add_roles.includes(role ?? "cashier"))
              ? "readOnly"
              : "noLocation",
          )}
        </p>
      )}
      {error && !entryOpen && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="banner approved" role="status">
          {t(...message)}
        </div>
      )}
      <FilterToolbar
        count={`${count} ${translateCount("note", "notes", "یادداشت", "یادداشت", count, lang)}`}
        search={
          <input
            aria-label={t("Search notes", "جستجوی یادداشت‌ها")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Search all notebooks", "جستجو در همه دفترچه‌ها")}
          />
        }
      >
        <Checkbox checked={showDone} onChange={setShowDone}>
          {t(
            "Include done and ordered notes",
            "نمایش موارد انجام‌شده و سفارش‌داده‌شده",
          )}
        </Checkbox>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setShowDone(false);
          }}
        >
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
      </FilterToolbar>
      {count === 0 && (
        <EmptyState>
          {t(
            "No notes match these filters.",
            "هیچ یادداشتی با این فیلترها مطابق نیست.",
          )}
        </EmptyState>
      )}
      {notes.map((item) => (
        <Card key={item.id} className="notebook-entry-card">
          <div className="row-between">
            <strong>
              <bdi dir="auto">
                {item.text === "Sunflower oil 1.8 L is out of stock"
                  ? t(
                      "Sunflower oil 1.8 L is out of stock",
                      "روغن آفتابگردان ۱٫۸ لیتری موجود نیست",
                    )
                  : item.text === "2 Lavash Bread taken for staff lunch"
                    ? t(
                        "2 Lavash Bread taken for staff lunch",
                        "۲ نان لواش برای ناهار کارکنان برداشته شد",
                      )
                    : item.text ===
                        "Customer asked about the tea glass set price; please confirm."
                      ? t(
                          "Customer asked about the tea glass set price; please confirm.",
                          "مشتری درباره قیمت ست استکان پرسید؛ لطفاً تأیید کنید.",
                        )
                      : item.text}
              </bdi>
            </strong>
            <Badge
              tone={
                item.status === "resolved" || item.status === "ordered"
                  ? "approved"
                  : item.status === "read"
                    ? "info"
                    : "pending"
              }
            >
              {item.status === "ordered"
                ? t("Ordered", "سفارش‌داده‌شده")
                : item.status === "resolved"
                  ? item.type === "to_order"
                    ? t("Ordered", "سفارش‌داده‌شده")
                    : t("Done", "انجام‌شده")
                  : item.status === "read"
                    ? t("Seen", "دیده‌شده")
                    : t("Open", "باز")}
            </Badge>
          </div>
          <p className="muted">
            {demoUserLabel(item.by, lang)} ·{" "}
            {branchLabel(state.config, item.branch, lang)} ·{" "}
            <LtrText>{companyTimestamp(state.config, item.created_at)}</LtrText>
            {query && (
              <>
                {" "}
                ·{" "}
                {builtinTabs.find((record) => record.key === item.type)?.label}
              </>
            )}
          </p>
          {item.product_code && (
            <p>
              {productView(item.product_code)}{" "}
              {item.qty ? <LtrText>× {item.qty}</LtrText> : null}
            </p>
          )}
          <div className="actions">
            {item.status === "open" &&
              item.type === "note_to_supervisor" &&
              role === "supervisor" && (
                <Button
                  variant="secondary"
                  disabled={branch === "all"}
                  onClick={() =>
                    run(
                      (draft) =>
                        updateNoteStatus(draft, context, item.id, "read"),
                      ["Marked seen.", "دیده‌شده علامت‌گذاری شد."],
                    )
                  }
                >
                  {t("Mark seen", "علامت دیده‌شده")}
                </Button>
              )}
            {item.status !== "resolved" &&
              item.status !== "ordered" &&
              (item.type !== "note_to_supervisor" || role === "supervisor") && (
                <Button
                  variant="secondary"
                  disabled={branch === "all"}
                  onClick={() =>
                    run(
                      (draft) =>
                        updateNoteStatus(draft, context, item.id, "resolved"),
                      item.type === "to_order"
                        ? ["Marked ordered.", "سفارش‌داده‌شده علامت‌گذاری شد."]
                        : ["Marked done.", "انجام‌شده علامت‌گذاری شد."],
                    )
                  }
                >
                  {item.type === "to_order"
                    ? t("Mark ordered", "علامت سفارش‌داده‌شده")
                    : t("Mark done", "علامت انجام‌شده")}
                </Button>
              )}
          </div>
        </Card>
      ))}
      {entries.map((item) => {
        const owner = allDefinitions.find(
          (record) => record.id === item.notebook_id,
        )!;
        return (
          <Card
            key={item.id}
            className="notebook-entry-card"
            data-notebook-entry={item.id}
          >
            <div className="row-between">
              <strong>
                <bdi dir="auto">
                  {item.id === "demo-deli-temperature-1" &&
                  item.text === "Morning fridge check"
                    ? t("Morning fridge check", "بررسی صبح یخچال")
                    : item.text}
                </bdi>
              </strong>
              {owner.status_enabled && (
                <Badge tone={item.status === "done" ? "approved" : "info"}>
                  {item.status === "done"
                    ? t("Done", "انجام‌شده")
                    : t("Open", "باز")}
                </Badge>
              )}
            </div>
            <p className="muted">
              {demoUserLabel(item.by, lang)} ·{" "}
              {branchLabel(state.config, item.branch, lang)} ·{" "}
              <LtrText>
                {companyTimestamp(state.config, item.created_at)}
              </LtrText>
              {(query || owner.archived) && (
                <>
                  {" "}
                  ·{" "}
                  <bdi dir="auto">
                    {lang === "fa"
                      ? owner.name_fa || owner.name_en
                      : owner.name_en}
                  </bdi>
                </>
              )}
              {owner.archived && <> · {t("Archived", "بایگانی‌شده")}</>}
            </p>
            <div className="notebook-entry-details">
              {item.product_code && (
                <span>{productView(item.product_code)}</span>
              )}
              {item.qty !== undefined && (
                <span>
                  {t("Quantity", "تعداد")}: <LtrText>{item.qty}</LtrText>
                </span>
              )}
              {item.date && (
                <span>
                  {t("Date", "تاریخ")}: <LtrText>{item.date}</LtrText>
                </span>
              )}
              {item.measurement !== undefined && (
                <span>
                  {t("Measurement", "اندازه‌گیری")}:{" "}
                  <LtrText>
                    {item.measurement} {item.measurement_unit}
                  </LtrText>
                </span>
              )}
            </div>
            {(canEditNotebookEntry(state, context, item.id) ||
              (owner.status_enabled &&
                canAddNotebookEntry(owner, context))) && (
              <div className="actions">
                {canEditNotebookEntry(state, context, item.id) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing({
                        entry: structuredClone(item),
                        snapshot: JSON.stringify(item),
                      });
                      setTab(item.notebook_id);
                      setSearch("");
                      setText(item.text);
                      setProduct(item.product_code ?? "");
                      setQty(item.qty === undefined ? "" : String(item.qty));
                      setDate(item.date ?? "");
                      setMeasurement(item.measurement ?? "");
                      setError("");
                      setMessage(null);
                      setFieldErrors({});
                      setEntryOpen(true);
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    {t("Edit note", "ویرایش یادداشت")}
                  </Button>
                )}
                {owner.status_enabled &&
                  canAddNotebookEntry(owner, context) && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        run(
                          (draft) =>
                            updateNotebookEntryStatus(
                              draft,
                              context,
                              item.id,
                              item.status === "done" ? "open" : "done",
                            ),
                          item.status === "done"
                            ? ["Marked open.", "باز علامت‌گذاری شد."]
                            : ["Marked done.", "انجام‌شده علامت‌گذاری شد."],
                          true,
                        )
                      }
                    >
                      {item.status === "done"
                        ? t("Mark open", "علامت باز")
                        : t("Mark done", "علامت انجام‌شده")}
                    </Button>
                  )}
              </div>
            )}
          </Card>
        );
      })}
      {editor && (
        <NotebookEditor
          key={editor === "new" ? "new" : editor.id}
          notebook={editor === "new" ? null : editor}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
          onSaved={(id) => setTab(id)}
        />
      )}
      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
        title={t("Archive notebook", "بایگانی دفترچه")}
        description={t(
          "Keep its entries searchable. Restore the notebook in Settings when needed.",
          "یادداشت‌ها قابل جستجو می‌مانند. در صورت نیاز، دفترچه را در تنظیمات بازیابی کنید.",
        )}
        confirmLabel={t("Archive notebook", "بایگانی دفترچه")}
        onConfirm={() => {
          if (!archiving) return;
          run(
            (draft) => archiveNotebook(draft, context, archiving.id),
            ["Archived notebook.", "دفترچه بایگانی شد."],
            true,
          );
          setArchiving(null);
        }}
      />
    </div>
  );
}
export default Notes;
