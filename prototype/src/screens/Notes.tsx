import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { WhatsMissing } from "../WhatsMissing";
import {
  Pencil,
  Archive,
  MoreHorizontal,
  Eye,
  Check,
  RotateCcw,
} from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DateField,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  FilterChip,
  Menu,
  MenuItem,
  NumberField,
  PageHeader,
  Select,
  SegmentedControl,
  Tabs,
} from "../ui";
import { demoUserLabel, LtrText, ProductName } from "../presentation";
import {
  addNote,
  builtInNotebookKind,
  operationError,
  companyTimestamp,
  markNoteSeen,
  updateNoteStatus,
} from "../operations";
import { doneRuleDecision, isNoteAuthor } from "../note-engagement";
import {
  addNotebookEntry,
  archiveNotebook,
  editNotebookEntry,
  notebookError,
  markNotebookEntrySeen,
  NotebookError,
  updateNotebookEntryStatus,
  type NotebookDefinition,
  type NotebookEntry,
  NOTEBOOK_EDIT_WINDOW,
} from "../notebooks";
import { configuredRoleLabel } from "../role-config";
import { branchLabel } from "../settings";
import { translateCount } from "../i18n";
import { notesText } from "../c-notes-i18n";
import { BuiltInNoteSettings, NotebookEditor } from "./NotebookSettings";
import {
  visibleNotebookView,
  readableNotebookEntryView,
  canAddNotebookEntryView,
  canEditNotebookEntryView,
  notebookEntryLocationView,
  permittedLocationIdsView,
} from "../notes-dates-read";
import type { DemoState, NoteRecord } from "../types";
import type { AuthenticatedActor, Capability } from "../authority-types";
import { actorAtLocation } from "../authority";
import "./notebooks-b.css";
import "./c3-labels-notes-offers.css";
import "./notes-c9.css";

type NoteField =
  "text" | "product" | "qty" | "date" | "measurement" | "location";

type NoteEvidenceRecord = {
  status: string;
  seen_receipts?: { id: string; user_id: string; by: string; at: string }[];
  done_by?: string;
  done_by_user_id?: string;
  done_at?: string;
};
const noteIsDone = (item: NoteEvidenceRecord) =>
  ["resolved", "ordered", "done"].includes(item.status);
const noteIsSeen = (item: NoteEvidenceRecord) =>
  Boolean(item.seen_receipts?.length || item.status === "read");

function NoteEvidence({
  item,
  ordered = false,
}: {
  item: NoteEvidenceRecord;
  ordered?: boolean;
}) {
  const { state, actor, lang, t } = useDemo();
  const receipts = item.seen_receipts ?? [];
  const receiptName = (receipt: (typeof receipts)[number]) =>
    receipt.user_id === actor?.user_id
      ? t("you", "شما")
      : demoUserLabel(receipt.by, lang);
  const receiptTime = (at: string) =>
    companyTimestamp(state.config, at).split(" ")[1];
  const fullReaders = receipts
    .map(
      (receipt) =>
        `${receiptName(receipt)} ${t("at", "در")} ${receiptTime(receipt.at)}`,
    )
    .join(t(", ", "، "));
  const readerList = (visible: typeof receipts) =>
    visible.map((receipt, index) => (
      <span key={receipt.id}>
        {index > 0 &&
          (index === visible.length - 1 && receipts.length <= 3
            ? t(" and ", " و ")
            : t(", ", "، "))}
        <bdi dir="auto">{receiptName(receipt)}</bdi> {t("at", "در")}{" "}
        <LtrText>{receiptTime(receipt.at)}</LtrText>
      </span>
    ));
  return (
    <div className="note-evidence">
      <div className="note-readers">
        <Eye size={14} aria-hidden="true" />
        {receipts.length > 3 ? (
          <details className="note-readers-details">
            <summary title={fullReaders}>
              {t("Seen by", "دیده‌شده توسط")} {readerList(receipts.slice(0, 3))}{" "}
              {t(
                receipts.length === 4
                  ? "and 1 other"
                  : `and ${receipts.length - 3} others`,
                `و ${receipts.length - 3} نفر دیگر`,
              )}
            </summary>
            <ol
              aria-label={t(
                "Everyone who has seen this note",
                "همهٔ خوانندگان این یادداشت",
              )}
            >
              {receipts.map((receipt) => (
                <li key={receipt.id}>
                  <bdi dir="auto">{receiptName(receipt)}</bdi> {t("at", "در")}{" "}
                  <LtrText>{receiptTime(receipt.at)}</LtrText>
                </li>
              ))}
            </ol>
          </details>
        ) : (
          <span>
            {receipts.length ? (
              <>
                {t("Seen by", "دیده‌شده توسط")} {readerList(receipts)}
              </>
            ) : item.status === "read" ? (
              t("Seen", "دیده‌شده")
            ) : (
              t("Not seen yet", "هنوز دیده نشده")
            )}
          </span>
        )}
      </div>
      {noteIsDone(item) && (
        <p className="note-completion">
          <Check size={14} aria-hidden="true" />
          {item.done_by && item.done_at ? (
            <span>
              {ordered
                ? t("Ordered by", "سفارش‌داده‌شده توسط")
                : t("Done by", "انجام‌شده توسط")}{" "}
              <bdi dir="auto">{demoUserLabel(item.done_by, lang)}</bdi> ·{" "}
              <LtrText>{companyTimestamp(state.config, item.done_at)}</LtrText>
            </span>
          ) : ordered ? (
            t("Ordered", "سفارش‌داده‌شده")
          ) : (
            t("Done", "انجام‌شده")
          )}
        </p>
      )}
    </div>
  );
}

export function Notes() {
  const { state, command, actor, can, branch, role, lang, t } = useDemo();
  const context = actor;
  const canManageNotebooks = can("notebooks.definition_manage");
  const canReadBuiltinNotes = can("notes.read");

  const definitions = visibleNotebookView(state);
  const allDefinitions = visibleNotebookView(state, {
    includeArchived: true,
  });
  const [tab, setTab] = useState<string>(() =>
    !canReadBuiltinNotes ? (definitions[0]?.id ?? "") : "to_order",
  );
  const [text, setText] = useState("");
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [measurement, setMeasurement] = useState("");
  const [entryLocation, setEntryLocation] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [notSeenByMe, setNotSeenByMe] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<NoteField, string>>
  >({});
  const [message, setMessage] = useState<[string, string] | null>(null);
  const [editor, setEditor] = useState<NotebookDefinition | "new" | null>(null);
  const [builtinSettings, setBuiltinSettings] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<NotebookDefinition | null>(null);
  const [editing, setEditing] = useState<{
    entry: NotebookEntry;
    snapshot: string;
  } | null>(null);
  const [entryClock, setEntryClock] = useState(0);
  const lastLinkedNote = useRef("");
  useEffect(() => {
    const openLinkedNote = () => {
      const parameters = new URLSearchParams(
        window.location.hash.split("?")[1] ?? "",
      );
      const noteId = parameters.get("note");
      const entryId = parameters.get("entry");
      const note = canReadBuiltinNotes
        ? state.notes.find((item) => item.id === noteId && !item.archived)
        : undefined;
      const entry = state.notebook_entries?.find(
        (item) => item.id === entryId && !item.archived,
      );
      const target = note ?? entry;
      const linkKey = `${window.location.hash}:${context?.user_id ?? ""}`;
      if (!target || lastLinkedNote.current === linkKey) return;
      lastLinkedNote.current = linkKey;
      setTab(note ? note.type : entry!.notebook_id);
      setSearch(
        entry && !definitions.some((item) => item.id === entry.notebook_id)
          ? entry.text
          : "",
      );
      setStatusFilter("all");
      setNotSeenByMe(false);
      window.requestAnimationFrame(() => {
        const card = document.getElementById(`note-${target.id}`);
        card?.focus({ preventScroll: true });
        card?.scrollIntoView({ block: "nearest" });
      });
    };
    openLinkedNote();
    window.addEventListener("hashchange", openLinkedNote);
    return () => window.removeEventListener("hashchange", openLinkedNote);
  }, [
    state.notes,
    state.notebook_entries,
    definitions,
    canReadBuiltinNotes,
    context?.user_id,
  ]);
  useEffect(() => {
    if (canManageNotebooks) return;
    const now = Date.now();
    const deadline = (state.notebook_entries ?? [])
      .filter(
        (entry) => entry.by_user_id === context?.user_id && !entry.archived,
      )
      .map((entry) => Date.parse(entry.created_at) + NOTEBOOK_EDIT_WINDOW)
      .filter((time) => Number.isFinite(time) && time > now)
      .sort((left, right) => left - right)[0];
    if (deadline === undefined) return;
    const timer = window.setTimeout(
      () => setEntryClock((value) => value + 1),
      deadline - now + 1,
    );
    return () => window.clearTimeout(timer);
  }, [
    canManageNotebooks,
    context?.user_id,
    state.notebook_entries,
    entryClock,
  ]);
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
  const managerEn = configuredRoleLabel(state.config.roles, "manager", "en");
  const managerFa = configuredRoleLabel(state.config.roles, "manager", "fa");
  const builtinTabs = !canReadBuiltinNotes
    ? []
    : [
        { key: "to_order", label: t("To order", "برای سفارش") },
        { key: "store_use", label: t("Store use", "مصرف فروشگاه") },
        {
          key: "note_to_supervisor",
          label: t(
            managerEn === "Manager" ? "For managers" : `For ${managerEn}`,
            managerFa === "مدیر" ? "برای مدیران" : `برای ${managerFa}`,
          ),
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
  const isBuiltin = !notebook && canReadBuiltinNotes;
  const locations = notebook
    ? notebookEntryLocationView(state, notebook, context, can)
    : context
      ? permittedLocationIdsView(state, context, can, "notes.entry_add", {
          mutation: true,
        })
      : [];
  const targetLocation = branch === "all" ? entryLocation : branch;
  const canChooseLocation = Boolean(branch === "all" && locations.length);
  const canAdd = isBuiltin
    ? locations.includes(targetLocation)
    : Boolean(notebook && locations.includes(targetLocation));
  const canSaveEdit = Boolean(
    editing && canEditNotebookEntryView(state, context, can, editing.entry.id),
  );
  const allNotes = !canReadBuiltinNotes || !context ? [] : state.notes;
  const allEntries = readableNotebookEntryView(state);
  const matchesStatus = (item: NoteEvidenceRecord, statusEnabled = true) =>
    (statusFilter === "all" ||
      (statusFilter === "done"
        ? statusEnabled && noteIsDone(item)
        : !noteIsDone(item))) &&
    (!notSeenByMe ||
      (statusEnabled &&
        !item.seen_receipts?.some(
          (receipt) => receipt.user_id === context?.user_id,
        )));
  const query = search.trim().toLocaleLowerCase();
  const searchText = (item: {
    text: string;
    by: string;
    product_code?: string;
    notebook_id?: string;
  }) => {
    const linked = state.products.find(
      (record) =>
        record.company_id === context?.company_id &&
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
      matchesStatus(item) &&
      (!query || searchText(item)),
  );
  const entries = allEntries.filter(
    (item) =>
      (query || item.notebook_id === activeTab) &&
      matchesStatus(
        item,
        allDefinitions.find((owner) => owner.id === item.notebook_id)
          ?.status_enabled,
      ) &&
      (!query || searchText(item)),
  );
  const count = notes.length + entries.length;
  const run = async (
    action: (draft: DemoState, actor: AuthenticatedActor) => void,
    feedback: [string, string],
    custom = false,
    capability: Capability = "notes.entry_add",
    location = targetLocation,
    entityId?: string,
  ) => {
    try {
      await command(
        capability,
        {
          company_id: state.config.company.seed_key,
          kind:
            capability === "notebooks.definition_manage"
              ? "company_shared"
              : "location_record",
          location_ids:
            capability === "notebooks.definition_manage" ? [] : [location],
          mutation: true,
          entity_id: entityId,
          ...(capability === "notebooks.entry_edit_any"
            ? { location_policy: "retained_correction" as const }
            : {}),
        },
        action,
      );
      setMessage(feedback);
      setError("");
      setFieldErrors({});
      return true;
    } catch (caught) {
      const message = custom
        ? notebookError(caught, t, state.config)
        : operationError(
            caught instanceof Error ? caught.message : "",
            t,
            state.config,
          );
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
        record.code === code && record.company_id === context?.company_id,
    );
    return item ? (
      <ProductName product={item} language={lang} />
    ) : (
      <LtrText>{code}</LtrText>
    );
  };
  const recordScope = (item: {
    id: string;
    company_id: string;
    branch: string;
  }) => ({
    company_id: item.company_id,
    kind: "location_record" as const,
    location_ids: [item.branch],
    entity_id: item.id,
    mutation: true,
  });
  // Done follows the notebook's "Who can mark notes done" setting.
  const builtInDoneCapability = (item: NoteRecord): Capability | null => {
    if (!actor) return null;
    const rule = state.config.notebooks?.built_in?.find(
      (record) => record.kind === builtInNotebookKind(item.type),
    )?.done_rule;
    const decision = doneRuleDecision(rule, actor);
    if (decision === "denied") return null;
    if (decision === "allowed") return "notes.read";
    return item.type === "note_to_supervisor"
      ? "notes.status_manage"
      : "notes.operational_status";
  };
  const notebookDoneCapability = (
    owner: NotebookDefinition,
    item: NotebookEntry,
  ): Capability | null => {
    if (!actor) return null;
    const decision = doneRuleDecision(owner.done_rule, actor);
    if (decision === "denied") return null;
    if (decision === "allowed")
      return can("notebooks.read", recordScope(item)) ? "notebooks.read" : null;
    return canAddNotebookEntryView(state, owner, context, can, item.branch)
      ? "notebooks.entry_add"
      : null;
  };
  const seenByMe = (item: NoteEvidenceRecord) =>
    Boolean(
      item.seen_receipts?.some(
        (receipt) => receipt.user_id === context?.user_id,
      ),
    );
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
          `Notes for the team${branch === "all" ? "" : ` at ${branchLabel(state.config, branch, "en")}`}. Mark a note as seen so others know you read it.`,
          `یادداشت‌های تیم${branch === "all" ? "" : ` در ${branchLabel(state.config, branch, "fa")}`}. یادداشت را دیده‌شده علامت بزنید تا دیگران بدانند آن را خوانده‌اید.`,
        )}
        actions={
          <>
            {canManageNotebooks && (
              <Button variant="neutral" onClick={() => setEditor("new")}>
                {t("New notebook", "دفترچه جدید")}
              </Button>
            )}
            {(isBuiltin || canAdd || canChooseLocation) && (
              <Button
                onClick={() => {
                  clearEntryForm();
                  setError("");
                  setMessage(null);
                  setEntryOpen(true);
                }}
              >
                {t("Add note", "افزودن یادداشت")}
              </Button>
            )}
          </>
        }
      />
      <div className="notes-notebook-bar">
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
              item.key === "note_to_supervisor" && can("notes.status_manage")
                ? allNotes.filter(
                    (note) => note.type === item.key && !noteIsDone(note),
                  ).length
                : definitions.some(
                      (record) =>
                        record.id === item.key && record.status_enabled,
                    )
                  ? allEntries.filter(
                      (entry) =>
                        entry.notebook_id === item.key &&
                        entry.status === "open",
                    ).length
                  : undefined,
          }))}
        />
        {isBuiltin && canManageNotebooks && activeTab !== "store_use" && (
          <div className="actions notebook-manage-actions">
            <Button
              variant="plain"
              onClick={() => setBuiltinSettings(activeTab)}
            >
              {t("Notebook settings", "تنظیمات دفترچه")}
            </Button>
          </div>
        )}
        {notebook && canManageNotebooks && (
          <div className="actions notebook-manage-actions">
            <Button variant="plain" onClick={() => setEditor(notebook)}>
              {t("Edit notebook", "ویرایش دفترچه")}
            </Button>
            <Menu
              icon={<MoreHorizontal size={16} aria-hidden="true" />}
              iconOnly
              label={t("Notebook actions", "کارهای دفترچه")}
            >
              <MenuItem
                className="menu-item-danger"
                onClick={() => setArchiving(notebook)}
              >
                <Archive size={16} aria-hidden="true" />
                {t("Archive notebook", "بایگانی دفترچه")}
              </MenuItem>
            </Menu>
          </div>
        )}
      </div>
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
          description={tabs.find((item) => item.key === activeTab)?.label}
          className="c3-operation-dialog notebook-entry-dialog"
        >
          <form
            aria-label={
              editing
                ? t("Edit note", "ویرایش یادداشت")
                : t("Add note", "افزودن یادداشت")
            }
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              const missing: Partial<Record<NoteField, string>> = {};
              if (!text.trim())
                missing.text = t(
                  "Enter a note before saving.",
                  "پیش از ذخیره، یادداشت را وارد کنید.",
                );
              if (!editing && !locations.includes(targetLocation))
                missing.location = notesText(t, "chooseLocation");
              if (activeTab === "store_use" && !product)
                missing.product = t(
                  "Choose a product.",
                  "یک کالا انتخاب کنید.",
                );
              if (
                (activeTab === "store_use" && !qty) ||
                (qty &&
                  (!Number.isFinite(Number(qty)) ||
                    Number(qty) <= 0 ||
                    (isBuiltin && !Number.isSafeInteger(Number(qty)))))
              )
                missing.qty = isBuiltin
                  ? t(
                      "Enter a positive whole quantity.",
                      "تعداد صحیح و مثبت وارد کنید.",
                    )
                  : t(
                      "Enter a quantity greater than zero.",
                      "تعداد بزرگ‌تر از صفر وارد کنید.",
                    );
              if (
                notebook?.fields.date &&
                date &&
                (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                  !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
                  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !==
                    date)
              )
                missing.date = t(
                  "Choose a valid date.",
                  "تاریخ معتبر انتخاب کنید.",
                );
              if (notebook?.fields.measurement && measurement.trim()) {
                try {
                  if (!new Decimal(measurement).isFinite())
                    missing.measurement = t(
                      "Enter a valid measurement number.",
                      "عدد اندازه‌گیری معتبر وارد کنید.",
                    );
                } catch {
                  missing.measurement = t(
                    "Enter a valid measurement number.",
                    "عدد اندازه‌گیری معتبر وارد کنید.",
                  );
                }
              }
              setFieldErrors(missing);
              if (Object.keys(missing).length) return;
              const saved = await run(
                (draft, freshActor) => {
                  if (editing)
                    editNotebookEntry(
                      draft,
                      freshActor,
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
                    addNotebookEntry(draft, freshActor, notebook.id, {
                      branch: targetLocation || undefined,
                      text,
                      product_code: product || undefined,
                      qty: qty ? Number(qty) : undefined,
                      date: date || undefined,
                      measurement: measurement || undefined,
                    });
                  else
                    addNote(
                      draft,
                      actorAtLocation(draft, freshActor, targetLocation),
                      {
                        type: activeTab as NoteRecord["type"],
                        text,
                        product_code: product || undefined,
                        qty: qty ? Number(qty) : undefined,
                      },
                    );
                },
                editing
                  ? ["Saved changes.", "تغییرات ذخیره شد."]
                  : ["Saved note.", "یادداشت ذخیره شد."],
                Boolean(notebook),
                editing
                  ? can("notebooks.entry_edit_any")
                    ? "notebooks.entry_edit_any"
                    : "notebooks.entry_edit_own"
                  : notebook
                    ? "notebooks.entry_add"
                    : "notes.entry_add",
                editing?.entry.branch ?? targetLocation,
              );
              if (saved) {
                clearEntryForm();
                setEntryOpen(false);
              }
            }}
          >
            <WhatsMissing
              issues={Object.entries(fieldErrors).map(([field, message]) => ({
                id: field,
                fieldId: `note-${field}`,
                message,
              }))}
            />
            <div className="form-grid">
              {!editing && canChooseLocation && (
                <Field
                  label={notesText(t, "location")}
                  error={fieldErrors.location}
                >
                  <Select
                    id="note-location"
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
                  id="note-text"
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
                    id="note-product"
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
                            item.company_id === context?.company_id &&
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
                    id="note-qty"
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
                    id="note-date"
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
                    id="note-measurement"
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
            <DialogActions>
              <Button
                variant="neutral"
                onClick={() => {
                  setEntryOpen(false);
                  clearEntryForm();
                  setError("");
                }}
              >
                {t("Cancel", "لغو")}
              </Button>
              <Button type="submit">
                {editing
                  ? t("Save changes", "ذخیره تغییرات")
                  : t("Save note", "ذخیره یادداشت")}
              </Button>
            </DialogActions>
            {editing && !canSaveEdit && (
              <p className="muted" role="status">
                {t(
                  `This note can no longer be edited. Ask an ${configuredRoleLabel(state.config.roles, "owner", "en")} or ${configuredRoleLabel(state.config.roles, "manager", "en")} to review it.`,
                  `دیگر امکان ویرایش این یادداشت وجود ندارد. از ${configuredRoleLabel(state.config.roles, "owner", "fa")} یا ${configuredRoleLabel(state.config.roles, "manager", "fa")} بخواهید آن را بررسی کند.`,
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
            !canManageNotebooks &&
              (!role ||
                !notebook.read_roles.includes(role) ||
                !role ||
                !notebook.add_roles.includes(role))
              ? "readOnly"
              : "noLocation",
            state.config,
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
        className="notes-filter-toolbar"
        count={`${count} ${translateCount("note", "notes", "یادداشت", "یادداشت", count, lang)}`}
        search={
          <input
            aria-label={t("Search notes", "جستجوی یادداشت‌ها")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Search notes", "جستجو در یادداشت‌ها")}
          />
        }
      >
        <SegmentedControl
          aria-label={t("Note status", "وضعیت یادداشت")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "open", label: t("Open", "باز") },
            { value: "done", label: t("Done", "انجام‌شده") },
            { value: "all", label: t("All", "همه") },
          ]}
        />
        <FilterChip checked={notSeenByMe} onChange={setNotSeenByMe}>
          {t("Not seen by me", "من ندیده‌ام")}
        </FilterChip>
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
        <Card
          key={item.id}
          className="notebook-entry-card"
          id={`note-${item.id}`}
          tabIndex={-1}
          data-note={item.id}
        >
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
                      : t(item.text, item.text_fa ?? item.text)}
              </bdi>
            </strong>
            <Badge
              tone={
                item.status === "resolved" || item.status === "ordered"
                  ? "approved"
                  : noteIsSeen(item)
                    ? "neutral"
                    : "info"
              }
            >
              {item.status === "ordered"
                ? t("Ordered", "سفارش‌داده‌شده")
                : item.status === "resolved"
                  ? item.type === "to_order"
                    ? t("Ordered", "سفارش‌داده‌شده")
                    : t("Done", "انجام‌شده")
                  : noteIsSeen(item)
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
          <NoteEvidence
            item={item}
            ordered={item.type === "to_order" && noteIsDone(item)}
          />
          <div className="actions note-card-footer">
            {actor && isNoteAuthor(item, actor) ? (
              <span className="muted note-own-hint">
                {t("Your note", "یادداشت شما")}
              </span>
            ) : seenByMe(item) ? (
              <Button
                variant="plain"
                size="sm"
                className="note-seen-by-you"
                disabled
              >
                <Check size={14} aria-hidden="true" />
                {t("Seen by you", "شما دیده‌اید")}
              </Button>
            ) : (
              can("notes.mark_seen", recordScope(item)) && (
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={() =>
                    run(
                      (draft, freshActor) =>
                        markNoteSeen(
                          draft,
                          actorAtLocation(draft, freshActor, item.branch),
                          item.id,
                        ),
                      ["Marked seen.", "دیده‌شده علامت‌گذاری شد."],
                      false,
                      "notes.mark_seen",
                      item.branch,
                      item.id,
                    )
                  }
                >
                  <Eye size={14} aria-hidden="true" />
                  {t("Mark as seen", "علامت دیده‌شده")}
                </Button>
              )
            )}
            {builtInDoneCapability(item) &&
              can(builtInDoneCapability(item)!, recordScope(item)) && (
              <Button
                variant={noteIsDone(item) ? "plain" : "tinted"}
                size="sm"
                onClick={() =>
                  run(
                    (draft, freshActor) =>
                      updateNoteStatus(
                        draft,
                        actorAtLocation(draft, freshActor, item.branch),
                        item.id,
                        noteIsDone(item) ? "open" : "resolved",
                      ),
                    noteIsDone(item)
                      ? ["Reopened note.", "یادداشت دوباره باز شد."]
                      : item.type === "to_order"
                        ? ["Marked ordered.", "سفارش‌داده‌شده علامت‌گذاری شد."]
                        : ["Marked done.", "انجام‌شده علامت‌گذاری شد."],
                    false,
                    builtInDoneCapability(item)!,
                    item.branch,
                    item.id,
                  )
                }
              >
                {!noteIsDone(item) && <Check size={14} aria-hidden="true" />}
                {noteIsDone(item)
                  ? t("Reopen", "بازگشایی")
                  : item.type === "to_order"
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
            id={`note-${item.id}`}
            tabIndex={-1}
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
                <Badge
                  tone={
                    noteIsDone(item)
                      ? "approved"
                      : noteIsSeen(item)
                        ? "neutral"
                        : "info"
                  }
                >
                  {noteIsDone(item)
                    ? t("Done", "انجام‌شده")
                    : noteIsSeen(item)
                      ? t("Seen", "دیده‌شده")
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
            {owner.status_enabled && <NoteEvidence item={item} />}
            {(owner.status_enabled ||
              canEditNotebookEntryView(state, context, can, item.id)) && (
              <div className="actions note-card-footer">
                {owner.status_enabled &&
                  (actor && isNoteAuthor(item, actor) ? (
                    <span className="muted note-own-hint">
                      {t("Your note", "یادداشت شما")}
                    </span>
                  ) : seenByMe(item) ? (
                    <Button
                      variant="plain"
                      size="sm"
                      className="note-seen-by-you"
                      disabled
                    >
                      <Check size={14} aria-hidden="true" />
                      {t("Seen by you", "شما دیده‌اید")}
                    </Button>
                  ) : (
                    !owner.archived &&
                    can("notebooks.mark_seen", recordScope(item)) && (
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() =>
                          run(
                            (draft, freshActor) =>
                              markNotebookEntrySeen(
                                draft,
                                actorAtLocation(draft, freshActor, item.branch),
                                item.id,
                              ),
                            ["Marked seen.", "دیده‌شده علامت‌گذاری شد."],
                            true,
                            "notebooks.mark_seen",
                            item.branch,
                            item.id,
                          )
                        }
                      >
                        <Eye size={14} aria-hidden="true" />
                        {t("Mark as seen", "علامت دیده‌شده")}
                      </Button>
                    )
                  ))}
                {owner.status_enabled &&
                  notebookDoneCapability(owner, item) && (
                    <Button
                      variant={noteIsDone(item) ? "plain" : "tinted"}
                      size="sm"
                      onClick={() =>
                        run(
                          (draft, freshActor) =>
                            updateNotebookEntryStatus(
                              draft,
                              actorAtLocation(draft, freshActor, item.branch),
                              item.id,
                              noteIsDone(item) ? "open" : "done",
                            ),
                          noteIsDone(item)
                            ? ["Reopened note.", "یادداشت دوباره باز شد."]
                            : ["Marked done.", "انجام‌شده علامت‌گذاری شد."],
                          true,
                          notebookDoneCapability(owner, item)!,
                          item.branch,
                          item.id,
                        )
                      }
                    >
                      {!noteIsDone(item) && (
                        <Check size={14} aria-hidden="true" />
                      )}
                      {noteIsDone(item)
                        ? t("Reopen", "بازگشایی")
                        : t("Mark done", "علامت انجام‌شده")}
                    </Button>
                  )}
                {canEditNotebookEntryView(state, context, can, item.id) && (
                  <Menu
                    icon={<MoreHorizontal size={16} aria-hidden="true" />}
                    iconOnly
                    label={t("More actions", "کارهای بیشتر")}
                  >
                    <MenuItem
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
                      <Pencil size={14} aria-hidden="true" />
                      {t("Edit note", "ویرایش یادداشت")}
                    </MenuItem>
                  </Menu>
                )}
              </div>
            )}
          </Card>
        );
      })}
      {canManageNotebooks && (
        <div className="notes-archive-management">
          <Button
            variant="plain"
            aria-expanded={showArchived}
            aria-controls="archived-notebooks"
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived
              ? t(
                  "Hide archived notebooks",
                  "پنهان کردن دفترچه‌های بایگانی‌شده",
                )
              : t("Show archived notebooks", "نمایش دفترچه‌های بایگانی‌شده")}
          </Button>
          {showArchived && (
            <div
              id="archived-notebooks"
              className="notebook-definition-list"
              aria-label={t("Archived notebooks", "دفترچه‌های بایگانی‌شده")}
            >
              {!allDefinitions.some((item) => item.archived) && (
                <p className="muted">
                  {t(
                    "No archived notebooks.",
                    "دفترچهٔ بایگانی‌شده‌ای وجود ندارد.",
                  )}
                </p>
              )}
              {allDefinitions
                .filter((item) => item.archived)
                .map((item) => (
                  <div className="notebook-definition-row" key={item.id}>
                    <div>
                      <strong>
                        <bdi dir="auto">
                          {lang === "fa"
                            ? item.name_fa || item.name_en
                            : item.name_en}
                        </bdi>
                      </strong>
                      <p className="muted">
                        {t(
                          "Its notes remain searchable.",
                          "یادداشت‌های آن همچنان قابل جستجو هستند.",
                        )}
                      </p>
                    </div>
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={async () => {
                        const restored = await run(
                          (draft, freshActor) =>
                            archiveNotebook(draft, freshActor, item.id, false),
                          ["Restored notebook.", "دفترچه بازیابی شد."],
                          true,
                          "notebooks.definition_manage",
                          undefined,
                          item.id,
                        );
                        if (restored) {
                          setTab(item.id);
                          setSearch("");
                        }
                      }}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      {t("Restore notebook", "بازیابی دفترچه")}
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      {builtinSettings && (
        <BuiltInNoteSettings
          kind={builtInNotebookKind(builtinSettings as NoteRecord["type"])}
          title={tabs.find((item) => item.key === builtinSettings)?.label ?? ""}
          onOpenChange={(open) => {
            if (!open) setBuiltinSettings(null);
          }}
        />
      )}
      {editor && (
        <NotebookEditor
          key={editor === "new" ? "new" : editor.id}
          notebook={editor === "new" ? null : editor}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
          onSaved={(id) => {
            setTab(id);
            setSearch("");
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
        title={t("Archive notebook", "بایگانی دفترچه")}
        description={t(
          "Keep its entries searchable. Restore it here with Show archived notebooks when needed.",
          "یادداشت‌ها قابل جستجو می‌مانند. در صورت نیاز، از نمایش دفترچه‌های بایگانی‌شده در همین صفحه آن را بازیابی کنید.",
        )}
        confirmLabel={t("Archive notebook", "بایگانی دفترچه")}
        onConfirm={async () => {
          if (!archiving) return;
          const saved = await run(
            (draft, freshActor) =>
              archiveNotebook(draft, freshActor, archiving.id),
            ["Archived notebook.", "دفترچه بایگانی شد."],
            true,
            "notebooks.definition_manage",
          );
          if (saved) setArchiving(null);
        }}
      />
    </div>
  );
}
export default Notes;
