import "../c3-tables.css";
import {
  WhatsMissing,
  FieldError,
  type ValidationIssue,
} from "../WhatsMissing";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useListState, useRouteParam } from "../navigation";
import { configuredRoleLabel } from "../role-config";
import Decimal from "decimal.js";
import { Plus, Printer, ArrowLeft, X } from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  TableRowLink,
  useTableColumns,
} from "../ui";
import {
  CasesAndUnits,
  DateText,
  LtrText,
  Money,
  ProductName,
  UnitText,
} from "../presentation";
import { branchLabel } from "../settings";
import { supplierMatches } from "../supplier-editor";
import { packUnits, costPerCase } from "../supplier-items";
import {
  cancelOrder,
  createOrder,
  orderCandidateQuantity,
  orderCandidateCaseCost,
  placeOrder,
  remainingOrderUnits,
  saveOrderDraft,
  type OrderDraftInput,
} from "../orders";
import { orderError, orderStatusCopy } from "../c-orders-i18n";
import { OrderPrintDocument } from "../order-print";
import { useOperationalPrint } from "../operational-print-hook";
import { createId } from "../ids";
import { formatQuantity } from "../formatters";
import { ReceivedDateRange } from "./ReceivedDateRange";
import type { DemoState, Language } from "../types";
import type { AuthenticatedActor } from "../authority-types";
import type { OrderReadDTO, OrderLineReadDTO } from "../purchase-projections";
import { useProtectedQuery } from "../use-protected-query";
import {
  ordersBoard,
  orderFormCandidates,
  previewOrderDraft,
  previewPlaceOrder,
  orderPrintSnapshot,
  requireSameOrderActor,
  type OrderPrintConfig,
} from "../orders-board";
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
  newItems: NewOrderItem[];
}
interface NewOrderItem {
  id: string;
  name_en: string;
  name_fa?: string;
  units_per_case: number | null;
}
function orderCostText(value: string): string {
  return new Decimal(value).toFixed(4).replace(/(\.\d{2,}?)0+$/, "$1");
}
function orderQuantitySuffix(
  line: Pick<OrderLineReadDTO, "quantity_unit" | "new_item_association">,
): string {
  return line.quantity_unit === "lb" ||
    line.new_item_association?.quantity_unit === "lb"
    ? " lb"
    : "";
}
function ScaledOrderPreview({
  order,
  config,
  language,
}: {
  order: OrderReadDTO;
  config: OrderPrintConfig;
  language: Language;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 794, height: 1123, scale: 1 });
  useEffect(() => {
    const measure = () => {
      if (!viewport.current || !sheet.current) return;
      const article = sheet.current.querySelector<HTMLElement>(
        ".operational-print-document",
      );
      if (!article) return;
      const width = article.offsetWidth;
      const height = article.offsetHeight;
      if (width <= 0 || height <= 0) return;
      const scale = Math.min(
        1,
        viewport.current.clientWidth / width,
        Math.max(220, window.innerHeight * 0.62) / height,
      );
      setSize({ width, height, scale });
    };
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (sheet.current) observer.observe(sheet.current);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className="order-sheet-preview" ref={viewport}>
      <div
        className="order-sheet-frame"
        style={{
          width: size.width * size.scale,
          height: size.height * size.scale,
        }}
      >
        <div
          ref={sheet}
          className="order-sheet-scaled"
          style={{ transform: `scale(${size.scale})` }}
        >
          <OrderPrintDocument
            order={order}
            config={config}
            language={language}
          />
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const {
    state,
    actor,
    command,
    query,
    can,
    branch,
    lang,
    t,
    tCount,
    navigate,
    authorityGeneration,
    authorityDirectoryVersion,
    businessRevision,
    locationSelection,
  } = useDemo();
  const [form, setForm] = useState<FormState | null>(null);
  const selectedId = useRouteParam("id");
  const [search, setSearch] = useListState("orders.search", "");
  const [status, setStatus] = useListState("orders.status", "all");
  const [supplierFilter, setSupplierFilter] = useListState(
    "orders.supplier",
    "all",
  );
  const [locationFilter, setLocationFilter] = useListState(
    "orders.location",
    "all",
  );
  const [from, setFrom] = useListState("orders.from", "");
  const [to, setTo] = useListState("orders.to", "");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [errorItemId, setErrorItemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [printRequest, setPrintRequest] = useState<{
    id: string;
    branch: string;
    version: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const writeInFlight = useRef(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPack, setNewItemPack] = useState("");
  const [newItemCases, setNewItemCases] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemErrors, setNewItemErrors] = useState<Record<string, string>>(
    {},
  );
  const tableColumns = useTableColumns("orders", [
    {
      key: "reference",
      label: t("Reference", "شماره"),
      required: true,
      width: "16%",
    },
    { key: "location", label: t("Location", "مکان"), width: "15%" },
    {
      key: "supplier",
      label: t("Supplier", "تأمین‌کننده"),
      width: "25%",
      minWidth: 240,
    },
    { key: "date", label: t("Date", "تاریخ"), width: "13%" },
    {
      key: "total",
      label: t("Before-tax expected total", "جمع مورد انتظار پیش از مالیات"),
      width: "16%",
      align: "end",
    },
    {
      key: "status",
      label: t("Status", "وضعیت"),
      width: "15%",
      minWidth: 136,
    },
    {
      key: "actions",
      label: t("Actions", "عملیات"),
      required: true,
      actions: true,
      width: 56,
    },
  ]);
  useEffect(() => {
    const leaveForm = () => setForm(null);
    window.addEventListener("hashchange", leaveForm);
    return () => window.removeEventListener("hashchange", leaveForm);
  }, []);
  const { printDocument, printOutput, clearPrint } = useOperationalPrint();
  const companyScope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const boardRead = useProtectedQuery(
    "orders.read",
    companyScope,
    (canonical, freshActor) => ordersBoard(canonical, freshActor),
    "orders-board",
  );
  const candidateScope = {
    company_id: state.config.company.seed_key,
    kind: "location_record" as const,
    location_ids: form?.branch ? [form.branch] : [],
  };
  const candidateRead = useProtectedQuery(
    form?.supplier && form.branch ? "orders.read" : null,
    candidateScope,
    (canonical, freshActor) =>
      orderFormCandidates(canonical, freshActor, form!.branch, form!.supplier),
    JSON.stringify([form?.branch, form?.supplier]),
  );
  const printRead = useProtectedQuery(
    printRequest ? "orders.read" : null,
    {
      company_id: state.config.company.seed_key,
      kind: "location_record",
      location_ids: printRequest ? [printRequest.branch] : [],
      location_policy: "retained_read",
    },
    (canonical, freshActor) =>
      orderPrintSnapshot(
        canonical,
        freshActor,
        printRequest!.id,
        printRequest!.version,
      ),
    JSON.stringify(printRequest),
  );
  const printPreview = printRead.data?.order ?? null;
  const mayReadOrders = can("orders.read");
  const sessionScope = JSON.stringify([
    actor?.company_id,
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    authorityGeneration,
    authorityDirectoryVersion,
    locationSelection,
    mayReadOrders,
    can("orders.write"),
    can("orders.cost_read", candidateScope),
  ]);
  const printAccessKey = `${sessionScope}:${businessRevision}`;
  const currentIdentity = useRef(sessionScope);
  const currentAccess = useRef(printAccessKey);
  const clearPrintRef = useRef(clearPrint);
  useLayoutEffect(() => {
    currentIdentity.current = sessionScope;
    currentAccess.current = printAccessKey;
    clearPrintRef.current = clearPrint;
  }, [sessionScope, printAccessKey, clearPrint]);
  useEffect(() => {
    clearPrintRef.current();
  }, [printAccessKey]);
  const [boundScope, setBoundScope] = useState(sessionScope);
  if (boundScope !== sessionScope) {
    setBoundScope(sessionScope);
    setForm(null);
    setPrintRequest(null);
    clearPrint();
    setCancelId(null);
    setNewItemOpen(false);
    setReason("");
    setError("");
    setMessage("");
    return null;
  }
  if (!actor || !mayReadOrders)
    return <EmptyState>{orderError(new Error("permission"), t)}</EmptyState>;
  if (boardRead.error)
    return <EmptyState>{orderError(boardRead.error, t)}</EmptyState>;
  if (boardRead.pending || !boardRead.data)
    return <EmptyState>{t("Loading…", "در حال بارگیری…")}</EmptyState>;
  const board = boardRead.data;
  const all = board.orders;
  const selected = all.find((order) => order.id === selectedId);
  const suppliers = board.suppliers;
  const locations = board.locations;
  const candidates = candidateRead.data?.candidates ?? [];
  const mayReadFormCosts = Boolean(
    form?.branch &&
    form.branch !== "all" &&
    can("orders.cost_read", candidateScope) &&
    (!form.supplier || candidateRead.data?.costs_visible === true),
  );
  const mayWriteForm = Boolean(
    form?.branch &&
    can("orders.write", {
      company_id: actor.company_id,
      kind: "location_record",
      location_ids: [form.branch],
      mutation: true,
    }),
  );
  const notes =
    form?.branch && locations.includes(form.branch)
      ? board.notes.filter(
          (note) =>
            note.branch === form.branch &&
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
    value: string | null | undefined,
    currency = state.config.company.currency,
  ) =>
    value === null ||
    value === undefined ||
    (form !== null && !mayReadFormCosts) ? (
      <span className="muted">—</span>
    ) : (
      <Money value={value} currency={currency} />
    );
  const run = async (
    mutator: (draft: DemoState, freshActor: AuthenticatedActor) => void,
    success: string,
    location: string,
    before?: () => Promise<boolean>,
  ) => {
    if (writeInFlight.current || !location || location === "all") return false;
    writeInFlight.current = true;
    const initiatingActor = actor;
    setSaving(true);
    try {
      if (before && !(await before())) return false;
      await command(
        "orders.write",
        {
          company_id: initiatingActor.company_id,
          kind: "location_record",
          location_ids: [location],
          mutation: true,
        },
        (draft, freshActor) => {
          requireSameOrderActor(draft, freshActor, initiatingActor);
          mutator(draft, freshActor);
        },
      );
      if (currentIdentity.current !== sessionScope) return false;
      setError("");
      setErrorKey("");
      setErrorItemId(null);
      setMessage(success);
      return true;
    } catch (caught) {
      if (currentIdentity.current !== sessionScope) return false;
      setError(orderError(caught, t));
      const key = caught instanceof Error ? caught.message : "";
      setErrorKey(key);
      const invalidItem = candidates.find((item) => {
        const cases = form?.cases[item.id]?.trim();
        if (!cases) return false;
        if (key === "quantity") {
          try {
            orderCandidateQuantity(item, cases);
            return false;
          } catch {
            return true;
          }
        }
        if (key === "cost") {
          const cost = form?.costs[item.id]?.trim() || item.expected_unit_cost;
          return (
            cost === null ||
            cost === undefined ||
            !/^\d+(\.\d{1,4})?$/.test(cost)
          );
        }
        return false;
      });
      const invalidNewItem = form?.newItems.find((item) => {
        if (key === "name") return !item.name_en.trim();
        if (key === "pack")
          return (
            item.units_per_case !== null &&
            (!Number.isSafeInteger(item.units_per_case) ||
              item.units_per_case <= 0)
          );
        if (key === "cost")
          return (
            Boolean(form.costs[item.id]?.trim()) &&
            !/^\d+(\.\d{1,4})?$/.test(form.costs[item.id].trim())
          );
        if (key === "quantity") {
          try {
            if (item.units_per_case === null) {
              const cases = new Decimal(form.cases[item.id]);
              if (!cases.isInteger() || cases.lte(0)) return true;
            } else packUnits(form.cases[item.id], "cases", item.units_per_case);
            return false;
          } catch {
            return true;
          }
        }
        return false;
      });
      setErrorItemId(invalidItem?.id ?? invalidNewItem?.id ?? null);
      setMessage("");
      return false;
    } finally {
      writeInFlight.current = false;
      setSaving(false);
    }
  };
  const validationError = (fieldId: string) =>
    validationIssues.find((issue) => issue.fieldId === fieldId)?.message;
  const clearValidation = (fieldId: string) =>
    setValidationIssues((current) =>
      current.filter((issue) => issue.fieldId !== fieldId),
    );
  const validateForm = async (place: boolean) => {
    if (!form) return false;
    const issues: ValidationIssue[] = [];
    const add = (fieldId: string, code: string, name?: string) => {
      if (!issues.some((issue) => issue.fieldId === fieldId))
        issues.push({
          id: `${fieldId}-error`,
          fieldId,
          message: `${name ? `${name}: ` : ""}${orderError(new Error(code), t)}`,
        });
    };
    if (!locations.includes(form.branch)) add("order-location", "location");
    if (!suppliers.some((supplier) => supplierMatches(supplier, form.supplier)))
      add("order-supplier", "supplier");
    const selected = candidates.filter((item) =>
      Boolean(form.cases[item.id]?.trim()),
    );
    if (place && !selected.length && !form.newItems.length)
      add("order-items", "empty");
    const validCost = (value: string) =>
      /^\d+(\.\d{1,4})?$/.test(value) &&
      new Decimal(value).isFinite() &&
      new Decimal(value).gte(0);
    for (const item of selected) {
      const name = lang === "fa" ? item.name_fa || item.name_en : item.name_en;
      try {
        orderCandidateQuantity(item, form.cases[item.id]);
      } catch {
        add(`order-cases-${item.id}`, "quantity", name);
      }
      const cost = form.costs[item.id]?.trim() || item.expected_unit_cost;
      if (cost !== null && cost !== undefined && !validCost(cost))
        add(`order-cost-${item.id}`, "cost", name);
      if (place && (cost === null || cost === undefined || cost === ""))
        add(`order-cost-${item.id}`, "cost", name);
    }
    for (const item of form.newItems) {
      if (!item.name_en.trim()) add(`order-name-${item.id}`, "name");
      if (
        item.units_per_case !== null &&
        (!Number.isSafeInteger(item.units_per_case) || item.units_per_case <= 0)
      )
        add(`order-pack-${item.id}`, "pack", item.name_en);
      try {
        if (item.units_per_case === null) {
          const cases = new Decimal(form.cases[item.id]);
          if (!cases.isFinite() || !cases.isInteger() || cases.lte(0))
            throw new Error();
        } else packUnits(form.cases[item.id], "cases", item.units_per_case);
      } catch {
        add(`order-cases-${item.id}`, "quantity", item.name_en);
      }
      if (form.costs[item.id]?.trim() && !validCost(form.costs[item.id].trim()))
        add(`order-cost-${item.id}`, "cost", item.name_en);
    }
    if (place)
      for (const noteId of form.selectedNotes) {
        const itemId = form.noteItems[noteId];
        if (!itemId || !form.cases[itemId]?.trim())
          add(`order-note-${noteId}`, "notes");
      }
    if (!issues.length) {
      // Domain validation on a throwaway copy protects stale notes, identities and permission rules.
      try {
        const initiatingActor = actor;
        const proposed = input();
        await query(
          "orders.write",
          {
            company_id: initiatingActor.company_id,
            kind: "location_record",
            location_ids: [proposed.branch],
            mutation: true,
          },
          (canonical, freshActor) => {
            requireSameOrderActor(canonical, freshActor, initiatingActor);
            previewOrderDraft(canonical, freshActor, proposed, {
              id: form.id,
              expected_version: form.version,
              place,
            });
          },
        );
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "item";
        const target =
          code === "location"
            ? "order-location"
            : code === "supplier"
              ? "order-supplier"
              : code === "notes"
                ? `order-note-${form.selectedNotes[0] ?? ""}`
                : "order-items";
        add(target, code);
      }
    }
    if (currentIdentity.current !== sessionScope) return false;
    setValidationIssues(issues);
    return !issues.length;
  };
  const clearFieldError = (...keys: string[]) => {
    if (keys.includes(errorKey)) {
      setError("");
      setErrorKey("");
      setErrorItemId(null);
    }
  };
  const fieldError = (...keys: string[]) =>
    keys.includes(errorKey) ? error : undefined;
  const itemError = (id: string, key: string) =>
    errorItemId === id && errorKey === key ? error : undefined;
  const openNewItem = () => {
    setNewItemName("");
    setNewItemPack("");
    setNewItemCases("");
    setNewItemCost("");
    setNewItemErrors({});
    setNewItemOpen(true);
  };
  const addNewItem = () => {
    const errors: Record<string, string> = {};
    if (!newItemName.trim()) errors.name = orderError(new Error("name"), t);
    const pack = newItemPack.trim() ? Number(newItemPack) : null;
    if (
      pack !== null &&
      (!/^\d+$/.test(newItemPack.trim()) ||
        !Number.isSafeInteger(pack) ||
        pack <= 0)
    )
      errors.pack = orderError(new Error("pack"), t);
    try {
      if (pack === null) {
        const quantity = new Decimal(newItemCases);
        if (!quantity.isFinite() || !quantity.isInteger() || quantity.lte(0))
          throw new Error();
      } else packUnits(newItemCases, "cases", pack);
    } catch {
      errors.quantity = orderError(new Error("quantity"), t);
    }
    if (newItemCost.trim() && !/^\d+(\.\d{1,4})?$/.test(newItemCost.trim()))
      errors.cost = orderError(new Error("cost"), t);
    if (Object.keys(errors).length) {
      setNewItemErrors(errors);
      return;
    }
    const id = createId("new-order-line");
    setForm((current) =>
      current
        ? {
            ...current,
            newItems: [
              ...current.newItems,
              { id, name_en: newItemName.trim(), units_per_case: pack },
            ],
            cases: { ...current.cases, [id]: newItemCases },
            costs: { ...current.costs, [id]: newItemCost.trim() },
          }
        : null,
    );
    clearFieldError("empty", "item");
    setNewItemOpen(false);
  };
  const newForm = () => {
    setValidationIssues([]);
    setForm({
      branch: branch === "all" ? "" : locations.includes(branch) ? branch : "",
      supplier: "",
      cases: {},
      costs: {},
      selectedNotes: [],
      noteItems: {},
      newItems: [],
    });
    setError("");
    setMessage("");
  };
  const editForm = (order: OrderReadDTO) => {
    setForm({
      id: order.id,
      version: order.version,
      branch: order.branch,
      supplier: order.supplier,
      cases: Object.fromEntries(
        order.lines.map((line) => [
          line.new_item ? line.id : line.supplier_item_id,
          line.ordered_cases,
        ]),
      ),
      costs: Object.fromEntries(
        order.lines.map((line) => [
          line.new_item ? line.id : line.supplier_item_id,
          line.expected_unit_cost ?? "",
        ]),
      ),
      selectedNotes: [...order.source_note_ids],
      noteItems: Object.fromEntries(
        order.lines.flatMap((line) =>
          line.source_note_ids.map((id) => [
            id,
            line.new_item ? line.id : line.supplier_item_id,
          ]),
        ),
      ),
      newItems: order.lines
        .filter((line) => line.new_item)
        .map((line) => ({
          id: line.id,
          name_en: line.name_en,
          name_fa: line.name_fa,
          units_per_case: line.units_per_case,
        })),
    });
    setError("");
    setMessage("");
  };
  const setItemCases = (id: string, value: string) => {
    if (errorItemId === id) clearFieldError("quantity");
    clearValidation(`order-cases-${id}`);
    clearValidation("order-items");
    clearFieldError("empty");
    if (form?.selectedNotes.some((noteId) => form.noteItems[noteId] === id))
      clearFieldError("notes");
    for (const noteId of form?.selectedNotes ?? [])
      if (form?.noteItems[noteId] === id)
        clearValidation(`order-note-${noteId}`);
    setForm((current) =>
      current ? { ...current, cases: { ...current.cases, [id]: value } } : null,
    );
  };
  const setItemCost = (id: string, value: string) => {
    if (errorItemId === id) clearFieldError("cost");
    clearValidation(`order-cost-${id}`);
    setForm((current) =>
      current ? { ...current, costs: { ...current.costs, [id]: value } } : null,
    );
  };
  const addNote = (id: string) => {
    clearFieldError("notes");
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
    lines: [
      ...candidates
        .filter((item) => Boolean(form!.cases[item.id]?.trim()))
        .map((item) => ({
          supplier_item_id: item.id,
          cases: form!.cases[item.id],
          expected_unit_cost: form!.costs[item.id],
          source_note_ids: form!.selectedNotes.filter(
            (id) => form!.noteItems[id] === item.id,
          ),
        })),
      ...form!.newItems.map((item) => ({
        new_item: item,
        cases: form!.cases[item.id] ?? "",
        expected_unit_cost: form!.costs[item.id],
        source_note_ids: form!.selectedNotes.filter(
          (id) => form!.noteItems[id] === item.id,
        ),
      })),
    ],
  });
  const save = async (place: boolean) => {
    if (saving || candidateRead.pending || candidateRead.error || !form) return;
    const currentForm = form;
    const proposed = input();
    if (currentForm.id && currentForm.version === undefined) {
      setError(orderError(new Error("stale"), t));
      return;
    }
    let savedId = "";
    if (
      await run(
        (draft, freshActor) => {
          const order = currentForm.id
            ? saveOrderDraft(
                draft,
                freshActor,
                currentForm.id,
                proposed,
                currentForm.version,
              )
            : createOrder(draft, freshActor, proposed);
          if (place) placeOrder(draft, freshActor, order.id, order.version);
          savedId = order.id;
        },
        place
          ? t("Order placed.", "سفارش ثبت شد.")
          : t("Draft saved.", "پیش‌نویس ذخیره شد."),
        proposed.branch,
        () => validateForm(place),
      )
    ) {
      setForm(null);
      navigate(`orders?id=${encodeURIComponent(savedId)}`);
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
      const units = orderCandidateQuantity(item, cases);
      const entered = form?.costs[item.id]?.trim();
      const changed =
        entered &&
        (item.expected_unit_cost === null ||
          item.expected_unit_cost === undefined ||
          !new Decimal(entered).eq(item.expected_unit_cost));
      const caseCost = changed
        ? orderCandidateCaseCost(item, entered!)
        : item.expected_case_cost;
      return {
        id: item.id,
        units,
        caseCost,
        total:
          caseCost === null || caseCost === undefined
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
  const temporaryAmounts = (form?.newItems ?? []).map((item) => {
    try {
      const cases = form!.cases[item.id];
      const pack = item.units_per_case;
      const unit = form!.costs[item.id]?.trim();
      const units = pack === null ? null : packUnits(cases, "cases", pack);
      const caseCost = !unit || pack === null ? null : costPerCase(unit, pack);
      return {
        id: item.id,
        units,
        caseCost,
        total:
          caseCost === null || caseCost === undefined
            ? null
            : new Decimal(caseCost)
                .times(cases)
                .toFixed(2, Decimal.ROUND_HALF_UP),
      };
    } catch {
      return { id: item.id, units: null, caseCost: null, total: null };
    }
  });
  const total = !mayReadFormCosts
    ? undefined
    : rowAmounts.some((row) => row.selected && row.total === null) ||
        temporaryAmounts.some((row) => row.total === null)
      ? null
      : [...rowAmounts, ...temporaryAmounts]
          .reduce((sum, row) => sum.plus(row.total ?? 0), new Decimal(0))
          .toFixed(2);
  const back = () => {
    setForm(null);
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
        description={
          branchLabel(
            state.config,
            form?.branch || selected?.branch || branch,
            lang,
          ) +
          (form?.supplier || selected?.supplier
            ? ` · \u2066${form?.supplier || selected?.supplier}\u2069`
            : "")
        }
        actions={
          form || selected ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft size={16} />
              {t("Back to Orders", "بازگشت به سفارش‌ها")}
            </Button>
          ) : (
            <Button onClick={newForm} disabled={!can("orders.write") || saving}>
              <Plus size={16} />
              {t("New order", "سفارش جدید")}
            </Button>
          )
        }
      />
      {error &&
        !(
          errorKey === "supplier" ||
          errorKey === "location" ||
          errorKey === "reason" ||
          ((errorKey === "cost" ||
            errorKey === "quantity" ||
            errorKey === "pack") &&
            errorItemId)
        ) && (
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
              <WhatsMissing issues={validationIssues} />
              {candidateRead.error && (
                <p className="banner danger" role="alert">
                  {orderError(candidateRead.error, t)}
                </p>
              )}
              <div className="order-heading-fields">
                <Field
                  label={t("Location", "مکان")}
                  error={
                    fieldError("location") || validationError("order-location")
                  }
                >
                  <Select
                    id="order-location"
                    value={form.branch}
                    onChange={(value) => {
                      clearFieldError("location", "notes");
                      clearValidation("order-location");
                      setForm({
                        ...form,
                        branch: value,
                        costs: {},
                        selectedNotes: [],
                        noteItems: {},
                      });
                    }}
                    options={[
                      { value: "", label: t("Choose location", "انتخاب مکان") },
                      ...locations.map((id) => ({
                        value: id,
                        label: branchLabel(state.config, id, lang),
                      })),
                    ]}
                  />
                </Field>
                <Field
                  label={t("Supplier", "تأمین‌کننده")}
                  error={
                    fieldError("supplier") || validationError("order-supplier")
                  }
                >
                  <Select
                    searchable
                    id="order-supplier"
                    value={form.supplier}
                    onChange={(value) => {
                      clearFieldError(
                        "supplier",
                        "item",
                        "notes",
                        "empty",
                        "quantity",
                        "cost",
                      );
                      clearValidation("order-supplier");
                      clearValidation("order-items");
                      setForm({
                        ...form,
                        supplier: value,
                        cases: {},
                        costs: {},
                        noteItems: {},
                      });
                    }}
                    options={[
                      {
                        value: "",
                        label: t("Choose supplier", "انتخاب تأمین‌کننده"),
                      },
                      ...suppliers.map((supplier) => ({
                        searchTerms: [
                          supplier.name,
                          ...(supplier.previous_names ?? []),
                        ],
                        value: supplier.name,
                        label: supplier.name,
                      })),
                    ]}
                  />
                </Field>
              </div>
              {form.supplier && (
                <>
                  <div
                    id="order-items"
                    tabIndex={-1}
                    className="row-between order-items-heading"
                  >
                    <h2>{t("Supplier items", "کالاهای تأمین‌کننده")}</h2>
                    <Button variant="neutral" onClick={openNewItem}>
                      <Plus size={16} />
                      {t("New item", "کالای جدید")}
                    </Button>
                  </div>
                  <FieldError>{validationError("order-items")}</FieldError>
                  {!candidates.length && !form.newItems.length ? (
                    <EmptyState>
                      {t(
                        `No supplier items yet. Ask your ${configuredRoleLabel(state.config.roles, "owner", "en")} or ${configuredRoleLabel(state.config.roles, "manager", "en")} to add items on the supplier page.`,
                        `هنوز کالایی برای این تأمین‌کننده ثبت نشده است. از ${configuredRoleLabel(state.config.roles, "owner", "fa")} یا ${configuredRoleLabel(state.config.roles, "manager", "fa")} بخواهید در صفحهٔ تأمین‌کننده کالا اضافه کند.`,
                      )}
                    </EmptyState>
                  ) : (
                    <DataTable
                      className="order-items-table"
                      responsive={false}
                      columns={[
                        { key: "product", width: 300, required: true },
                        { key: "pack", width: 80, align: "end" },
                        { key: "cases", width: 128, align: "end" },
                        { key: "units", width: 124, align: "end" },
                        { key: "cost", width: 164, align: "end" },
                        { key: "case_cost", width: 112, align: "end" },
                        { key: "total", width: 168, align: "end" },
                      ]}
                    >
                      <thead>
                        <tr>
                          <th>{t("Product", "کالا")}</th>
                          <th>{t("Pack", "بسته")}</th>
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
                          const name =
                            lang === "fa"
                              ? item.name_fa || item.name_en
                              : item.name_en;
                          return (
                            <tr key={item.id} data-item-id={item.id}>
                              <td
                                data-label={t(
                                  "Product / supplier code",
                                  "کالا / کد تأمین‌کننده",
                                )}
                              >
                                <ProductName product={item} language={lang} />
                                <span className="order-item-caption">
                                  <LtrText>
                                    {item.supplier_item_code ||
                                      item.product_code}{" "}
                                    · {item.unit_size}
                                  </LtrText>
                                </span>
                              </td>
                              <td data-label={t("Pack", "بسته")}>
                                <LtrText>
                                  {item.quantity_unit === "lb"
                                    ? `${item.case_weight ?? "—"} ${item.case_weight_unit ?? ""}`
                                    : item.units_per_case}
                                </LtrText>
                              </td>
                              <td data-label={t("Cases", "کارتن")}>
                                <Field
                                  label={t("Cases", "کارتن")}
                                  className="order-table-field"
                                  error={
                                    itemError(item.id, "quantity") ||
                                    validationError(`order-cases-${item.id}`)
                                  }
                                >
                                  <NumberField
                                    id={`order-cases-${item.id}`}
                                    aria-label={`${t("Cases", "کارتن")} — ${name}`}
                                    value={form.cases[item.id] ?? ""}
                                    min="0"
                                    step="0.5"
                                    onChange={(value) =>
                                      setItemCases(item.id, value)
                                    }
                                  />
                                </Field>
                              </td>
                              <td
                                className="numeric"
                                data-label={t("Units", "واحد")}
                              >
                                <LtrText>
                                  {row.units === null
                                    ? "—"
                                    : `= ${formatQuantity(row.units, item.quantity_unit === "lb" ? "lb" : "units", lang)}`}
                                </LtrText>
                              </td>
                              <td
                                className="numeric"
                                data-label={t(
                                  "Expected unit cost",
                                  "هزینهٔ مورد انتظار واحد",
                                )}
                              >
                                <Field
                                  label={t(
                                    "Expected unit cost",
                                    "هزینهٔ مورد انتظار واحد",
                                  )}
                                  className="order-table-field"
                                  error={
                                    itemError(item.id, "cost") ||
                                    validationError(`order-cost-${item.id}`)
                                  }
                                >
                                  <NumberField
                                    id={`order-cost-${item.id}`}
                                    disabled={!mayReadFormCosts}
                                    aria-label={`${t("Expected unit cost", "هزینهٔ مورد انتظار واحد")} — ${name}`}
                                    value={
                                      (mayReadFormCosts
                                        ? form.costs[item.id]
                                        : "") ??
                                      (item.expected_unit_cost === null ||
                                      item.expected_unit_cost === undefined
                                        ? ""
                                        : orderCostText(
                                            item.expected_unit_cost,
                                          ))
                                    }
                                    onChange={(value) =>
                                      setItemCost(item.id, value)
                                    }
                                    onBlur={(event) => {
                                      if (
                                        form.costs[item.id] !== undefined &&
                                        /^\d+(\.\d{1,4})?$/.test(
                                          event.target.value,
                                        )
                                      )
                                        setItemCost(
                                          item.id,
                                          orderCostText(event.target.value),
                                        );
                                    }}
                                    step="0.0001"
                                    min="0"
                                  />
                                </Field>
                                {item.expected_unit_cost !== null &&
                                  item.expected_unit_cost !== undefined &&
                                  item.expected_cost_source && (
                                    <span className="order-item-caption">
                                      {item.expected_cost_source ===
                                      "last_bought"
                                        ? t("Last bought", "آخرین خرید")
                                        : t(
                                            "Supplier quote",
                                            "قیمت اعلامی تأمین‌کننده",
                                          )}{" "}
                                      {money(item.expected_unit_cost)}
                                      {item.quantity_unit === "lb" && (
                                        <LtrText>/lb</LtrText>
                                      )}
                                    </span>
                                  )}
                              </td>
                              <td
                                className="numeric"
                                data-label={t("Case cost", "هزینهٔ کارتن")}
                              >
                                {money(row.caseCost)}
                              </td>
                              <td
                                className="numeric"
                                data-label={t(
                                  "Before-tax total",
                                  "جمع پیش از مالیات",
                                )}
                              >
                                {money(row.total)}
                              </td>
                            </tr>
                          );
                        })}
                        {form.newItems.map((item) => {
                          const row = temporaryAmounts.find(
                            (amount) => amount.id === item.id,
                          )!;
                          return (
                            <tr
                              key={item.id}
                              data-item-id={item.id}
                              className="order-new-item-row"
                            >
                              <td data-label={t("Product", "کالا")}>
                                <strong>
                                  <bdi dir="auto">{item.name_en}</bdi>
                                </strong>
                                <Badge tone="info">
                                  {t("New item", "کالای جدید")}
                                </Badge>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    clearFieldError(
                                      "item",
                                      "name",
                                      "pack",
                                      "quantity",
                                      "cost",
                                    );
                                    setForm({
                                      ...form,
                                      newItems: form.newItems.filter(
                                        (row) => row.id !== item.id,
                                      ),
                                      noteItems: Object.fromEntries(
                                        Object.entries(form.noteItems).map(
                                          ([note, selected]) => [
                                            note,
                                            selected === item.id
                                              ? ""
                                              : selected,
                                          ],
                                        ),
                                      ),
                                    });
                                  }}
                                >
                                  {t("Remove", "حذف")}
                                </Button>
                              </td>
                              <td
                                data-label={t(
                                  "Units per case",
                                  "واحد در کارتن",
                                )}
                              >
                                <Field
                                  label={t(
                                    "Units per case (optional)",
                                    "واحد در کارتن (اختیاری)",
                                  )}
                                  className="order-table-field"
                                  error={
                                    itemError(item.id, "pack") ||
                                    validationError(`order-pack-${item.id}`)
                                  }
                                >
                                  <NumberField
                                    id={`order-pack-${item.id}`}
                                    aria-label={`${t("Units per case", "واحد در کارتن")} — ${item.name_en}`}
                                    value={item.units_per_case ?? ""}
                                    min="1"
                                    step="1"
                                    onChange={(value) => {
                                      clearValidation(`order-pack-${item.id}`);
                                      if (errorItemId === item.id)
                                        clearFieldError("pack", "quantity");
                                      setForm({
                                        ...form,
                                        newItems: form.newItems.map((row) =>
                                          row.id === item.id
                                            ? {
                                                ...row,
                                                units_per_case:
                                                  value === ""
                                                    ? null
                                                    : Number(value),
                                              }
                                            : row,
                                        ),
                                      });
                                    }}
                                  />
                                </Field>
                              </td>
                              <td data-label={t("Cases", "کارتن")}>
                                <Field
                                  label={t("Cases", "کارتن")}
                                  className="order-table-field"
                                  error={
                                    itemError(item.id, "quantity") ||
                                    validationError(`order-cases-${item.id}`)
                                  }
                                >
                                  <NumberField
                                    id={`order-cases-${item.id}`}
                                    aria-label={`${t("Cases", "کارتن")} — ${item.name_en}`}
                                    value={form.cases[item.id] ?? ""}
                                    min="0"
                                    step={
                                      item.units_per_case === null ? "1" : "0.5"
                                    }
                                    onChange={(value) => {
                                      setItemCases(item.id, value);
                                    }}
                                  />
                                </Field>
                              </td>
                              <td
                                className="numeric"
                                data-label={t("Units", "واحد")}
                              >
                                <LtrText>
                                  {row.units === null
                                    ? "—"
                                    : `= ${formatQuantity(row.units, "units", lang)}`}
                                </LtrText>
                              </td>
                              <td
                                data-label={t(
                                  "Expected unit cost",
                                  "هزینهٔ مورد انتظار واحد",
                                )}
                              >
                                <Field
                                  label={t(
                                    "Expected unit cost (optional)",
                                    "هزینهٔ مورد انتظار واحد (اختیاری)",
                                  )}
                                  className="order-table-field"
                                  error={
                                    itemError(item.id, "cost") ||
                                    validationError(`order-cost-${item.id}`)
                                  }
                                >
                                  <NumberField
                                    id={`order-cost-${item.id}`}
                                    disabled={!mayReadFormCosts}
                                    aria-label={`${t("Expected unit cost", "هزینهٔ مورد انتظار واحد")} — ${item.name_en}`}
                                    value={
                                      mayReadFormCosts
                                        ? (form.costs[item.id] ?? "")
                                        : ""
                                    }
                                    min="0"
                                    step="0.0001"
                                    onChange={(value) => {
                                      setItemCost(item.id, value);
                                    }}
                                    onBlur={(event) => {
                                      if (
                                        /^\d+(\.\d{1,4})?$/.test(
                                          event.target.value,
                                        )
                                      )
                                        setItemCost(
                                          item.id,
                                          orderCostText(event.target.value),
                                        );
                                    }}
                                  />
                                </Field>
                              </td>
                              <td
                                className="numeric"
                                data-label={t("Case cost", "هزینهٔ کارتن")}
                              >
                                {money(row.caseCost)}
                              </td>
                              <td
                                className="numeric"
                                data-label={t(
                                  "Before-tax total",
                                  "جمع پیش از مالیات",
                                )}
                              >
                                {money(row.total)}
                              </td>
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
              {total === null && (
                <p className="helper order-estimate-incomplete">
                  {t(
                    "Estimate incomplete: some packs or expected costs are not known.",
                    "برآورد کامل نیست: برخی بسته‌ها یا هزینه‌های مورد انتظار مشخص نشده‌اند.",
                  )}
                </p>
              )}
              <DialogActions className="order-form-actions">
                <Button variant="neutral" onClick={back}>
                  {t("Cancel", "انصراف")}
                </Button>
                <Button
                  type="submit"
                  variant="neutral"
                  disabled={
                    saving ||
                    candidateRead.pending ||
                    candidateRead.error !== null ||
                    !mayWriteForm
                  }
                >
                  {t("Save as draft", "ذخیره پیش‌نویس")}
                </Button>
                <Button
                  disabled={
                    saving ||
                    candidateRead.pending ||
                    candidateRead.error !== null ||
                    !mayWriteForm
                  }
                  onClick={() => save(true)}
                >
                  {t("Place order", "ثبت سفارش")}
                </Button>
              </DialogActions>
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
                              variant="destructive"
                              aria-label={t(
                                "Remove note from order",
                                "حذف یادداشت از سفارش",
                              )}
                              onClick={() => {
                                clearFieldError("notes");
                                setForm({
                                  ...form,
                                  selectedNotes: form.selectedNotes.filter(
                                    (id) => id !== note.id,
                                  ),
                                  noteItems: {
                                    ...form.noteItems,
                                    [note.id]: "",
                                  },
                                });
                              }}
                            >
                              <X size={16} />
                              {t("Remove", "حذف")}
                            </Button>
                          ) : (
                            <Button
                              variant="tinted"
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
                              error={
                                validationError(`order-note-${note.id}`) ||
                                (!form.noteItems[note.id]
                                  ? fieldError("notes")
                                  : undefined)
                              }
                            >
                              <Select
                                searchable
                                id={`order-note-${note.id}`}
                                value={form.noteItems[note.id] ?? ""}
                                onChange={(value) => {
                                  clearFieldError("notes");
                                  clearValidation(`order-note-${note.id}`);
                                  setForm({
                                    ...form,
                                    noteItems: {
                                      ...form.noteItems,
                                      [note.id]: value,
                                    },
                                  });
                                }}
                                options={[
                                  {
                                    value: "",
                                    label: t("Choose item", "انتخاب کالا"),
                                  },
                                  ...candidates.map((item) => ({
                                    value: item.id,
                                    searchTerms: [
                                      item.name_en,
                                      item.name_fa ?? "",
                                      item.product_code,
                                      item.supplier_item_code ?? "",
                                      state.products.find(
                                        (product) =>
                                          product.code === item.product_code,
                                      )?.barcode ?? "",
                                    ],
                                    label: `${lang === "fa" ? item.name_fa || item.name_en : item.name_en} · ${item.supplier_item_code || item.product_code}`,
                                  })),
                                  ...form.newItems.map((item) => ({
                                    value: item.id,
                                    label: `${item.name_en} · ${t("New item", "کالای جدید")}`,
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
                {selected.status === "draft" &&
                  board.writable_order_ids.includes(selected.id) && (
                    <>
                      <Button
                        variant="neutral"
                        disabled={saving}
                        onClick={() => editForm(selected)}
                      >
                        {t("Edit draft", "ویرایش پیش‌نویس")}
                      </Button>
                      <Button
                        disabled={saving}
                        onClick={async () => {
                          const initiatingActor = actor;
                          try {
                            await query(
                              "orders.write",
                              {
                                company_id: initiatingActor.company_id,
                                kind: "location_record",
                                location_ids: [selected.branch],
                                mutation: true,
                              },
                              (canonical, freshActor) => {
                                requireSameOrderActor(
                                  canonical,
                                  freshActor,
                                  initiatingActor,
                                );
                                previewPlaceOrder(
                                  canonical,
                                  freshActor,
                                  selected.id,
                                  selected.version,
                                );
                              },
                            );
                          } catch (caught) {
                            const code =
                              caught instanceof Error ? caught.message : "item";
                            const missingLine = selected.lines.find(
                              (line) =>
                                !line.new_item &&
                                line.expected_unit_cost === null,
                            );
                            editForm(selected);
                            const fieldId =
                              code === "cost" && missingLine
                                ? `order-cost-${missingLine.supplier_item_id}`
                                : code === "supplier"
                                  ? "order-supplier"
                                  : code === "location"
                                    ? "order-location"
                                    : "order-items";
                            setValidationIssues([
                              {
                                id: `${fieldId}-error`,
                                fieldId,
                                message: orderError(caught, t),
                              },
                            ]);
                            return;
                          }
                          await run(
                            (draft, freshActor) => {
                              placeOrder(
                                draft,
                                freshActor,
                                selected.id,
                                selected.version,
                              );
                            },
                            t("Order placed.", "سفارش ثبت شد."),
                            selected.branch,
                          );
                        }}
                      >
                        {t("Place order", "ثبت سفارش")}
                      </Button>
                    </>
                  )}
                <Button
                  variant="tinted"
                  disabled={saving}
                  onClick={() =>
                    setPrintRequest({
                      id: selected.id,
                      branch: selected.branch,
                      version: selected.version,
                    })
                  }
                >
                  <Printer size={16} />
                  {t("Print order", "چاپ سفارش")}
                </Button>
                {["draft", "ordered", "partially_received"].includes(
                  selected.status,
                ) &&
                  board.writable_order_ids.includes(selected.id) && (
                    <Button
                      variant="destructive"
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
                  {selected.estimate_incomplete && (
                    <span className="order-item-caption">
                      {t("Estimate incomplete", "برآورد کامل نیست")}
                    </span>
                  )}
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
                        <UnitText>
                          {lang === "fa"
                            ? line.name_fa || line.name_en
                            : line.name_en}
                        </UnitText>
                      </strong>
                      <span className="order-item-caption">
                        <LtrText>
                          {line.supplier_item_code || line.product_code || "—"}{" "}
                          ·{" "}
                          {line.quantity_unit === "lb"
                            ? `${line.case_weight ?? "—"} ${line.case_weight_unit ?? ""}`
                            : (line.units_per_case ?? "—")}
                        </LtrText>
                      </span>
                      {line.new_item && (
                        <Badge tone="info">{t("New item", "کالای جدید")}</Badge>
                      )}
                      {line.new_item_association && (
                        <span className="order-item-caption">
                          {t("Product Code", "کد کالا")}:{" "}
                          <LtrText>
                            {line.new_item_association.product_code}
                          </LtrText>
                        </span>
                      )}
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
                      {line.quantity_unit !== "lb" &&
                      line.new_item_association?.quantity_unit !== "lb" &&
                      line.ordered_units !== null &&
                      line.units_per_case !== null ? (
                        <CasesAndUnits
                          units={line.ordered_units}
                          unitsPerCase={line.units_per_case}
                          language={lang}
                        />
                      ) : (
                        <LtrText>{line.ordered_cases}</LtrText>
                      )}
                    </td>
                    <td className="numeric">
                      <LtrText>
                        {line.ordered_units ?? "—"}
                        {line.ordered_units !== null
                          ? orderQuantitySuffix(line)
                          : ""}
                      </LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>
                        {line.received_units}
                        {orderQuantitySuffix(line)}
                      </LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>
                        {line.cancelled_units}
                        {orderQuantitySuffix(line)}
                      </LtrText>
                    </td>
                    <td className="numeric">
                      <LtrText>
                        {remainingOrderUnits(line) ?? "—"}
                        {remainingOrderUnits(line) !== null
                          ? orderQuantitySuffix(line)
                          : ""}
                      </LtrText>
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
                    variant="neutral"
                    key={id}
                    onClick={() =>
                      navigate(`invoices?id=${encodeURIComponent(id)}`)
                    }
                  >
                    <LtrText>{board.invoice_numbers[id] ?? id}</LtrText>
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
                    {board.notes.find(
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
            count={
              <span className="filter-toolbar-end">
                <span>
                  {tCount(
                    "{{count}} order",
                    "{{count}} orders",
                    "{{count}} سفارش",
                    "{{count}} سفارش",
                    visible.length,
                  )}
                </span>
                {tableColumns.chooser}
              </span>
            }
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
                searchable
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
            {branch === "all" && (
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
            <ReceivedDateRange
              from={from}
              to={to}
              onChange={(nextFrom, nextTo) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
            />
            {(search ||
              status !== "all" ||
              supplierFilter !== "all" ||
              locationFilter !== "all" ||
              from ||
              to) && (
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
            )}
          </FilterToolbar>
          {!visible.length ? (
            <EmptyState>
              {all.length === 0
                ? t(
                    "No orders yet; create an order when you are ready to request goods from a supplier.",
                    "هنوز سفارشی وجود ندارد؛ برای درخواست کالا از تأمین‌کننده، یک سفارش ایجاد کنید.",
                  )
                : t(
                    "No orders match these filters.",
                    "سفارشی با این فیلترها پیدا نشد.",
                  )}
            </EmptyState>
          ) : (
            <DataTable
              className="orders-list-table"
              columns={tableColumns.columns}
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
                  <th>{t("Actions", "عملیات")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr
                    key={order.id}
                    data-row-href={`#orders?id=${encodeURIComponent(order.id)}`}
                    aria-label={order.reference}
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest("a,button")) {
                        setError("");
                        setMessage("");
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        ["Enter", " "].includes(event.key)
                      ) {
                        setError("");
                        setMessage("");
                      }
                    }}
                  >
                    <td>
                      <a
                        className="order-reference-link"
                        href={`#orders?id=${encodeURIComponent(order.id)}`}
                        onClick={() => {
                          setError("");
                          setMessage("");
                        }}
                      >
                        <LtrText>{order.reference}</LtrText>
                      </a>
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
                    <td>
                      <TableRowLink
                        href={`#orders?id=${encodeURIComponent(order.id)}`}
                        aria-label={`${t("View", "مشاهده")} ${order.reference}`}
                        onClick={() => {
                          setError("");
                          setMessage("");
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      )}
      <Dialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        title={t("New item", "کالای جدید")}
        className="new-order-item-dialog"
      >
        <form
          aria-label={t("New item", "کالای جدید")}
          onSubmit={(event) => {
            event.preventDefault();
            addNewItem();
          }}
        >
          <WhatsMissing
            issues={Object.entries(newItemErrors)
              .filter(([, message]) => message)
              .map(([key, message]) => ({
                id: `order-new-${key}-error`,
                fieldId: `order-new-${key}`,
                message,
              }))}
          />
          <Field label={t("Name", "نام")} error={newItemErrors.name}>
            <input
              id="order-new-name"
              value={newItemName}
              onChange={(event) => {
                setNewItemName(event.target.value);
                setNewItemErrors((current) => ({ ...current, name: "" }));
              }}
            />
          </Field>
          <div className="new-order-item-fields">
            <Field
              label={t("Units per case (optional)", "واحد در کارتن (اختیاری)")}
              error={newItemErrors.pack}
            >
              <NumberField
                id="order-new-pack"
                value={newItemPack}
                min="1"
                step="1"
                onChange={(value) => {
                  setNewItemPack(value);
                  setNewItemErrors((current) => ({ ...current, pack: "" }));
                }}
              />
            </Field>
            <Field label={t("Cases", "کارتن")} error={newItemErrors.quantity}>
              <NumberField
                id="order-new-quantity"
                value={newItemCases}
                min="0"
                step={newItemPack ? "0.5" : "1"}
                onChange={(value) => {
                  setNewItemCases(value);
                  setNewItemErrors((current) => ({ ...current, quantity: "" }));
                }}
              />
            </Field>
            <Field
              label={t(
                "Expected unit cost (optional)",
                "هزینهٔ مورد انتظار واحد (اختیاری)",
              )}
              error={newItemErrors.cost}
            >
              <NumberField
                id="order-new-cost"
                value={mayReadFormCosts ? newItemCost : ""}
                disabled={!mayReadFormCosts}
                min="0"
                step="0.0001"
                onChange={(value) => {
                  setNewItemCost(value);
                  setNewItemErrors((current) => ({ ...current, cost: "" }));
                }}
              />
            </Field>
          </div>
          <p className="helper">
            {t(
              "This item is temporary. Choose its actual invoice line when the delivery arrives.",
              "این کالا موقت است. هنگام رسیدن تحویل، ردیف واقعی آن را در فاکتور انتخاب کنید.",
            )}
          </p>
          <DialogActions>
            <Button variant="neutral" onClick={() => setNewItemOpen(false)}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button type="submit">{t("Add item", "افزودن کالا")}</Button>
          </DialogActions>
        </form>
      </Dialog>
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
        <WhatsMissing
          issues={validationIssues.filter(
            (issue) => issue.fieldId === "order-cancel-reason",
          )}
        />
        <Field
          label={t("Reason", "دلیل")}
          error={fieldError("reason") || validationError("order-cancel-reason")}
        >
          <textarea
            id="order-cancel-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              clearFieldError("reason");
              clearValidation("order-cancel-reason");
            }}
            rows={3}
          />
        </Field>
        <DialogActions>
          <Button variant="neutral" onClick={() => setCancelId(null)}>
            {t("Keep order", "نگه داشتن سفارش")}
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={async () => {
              if (!reason.trim()) {
                setValidationIssues([
                  {
                    id: "order-cancel-reason-error",
                    fieldId: "order-cancel-reason",
                    message: orderError(new Error("reason"), t),
                  },
                ]);
                return;
              }
              const cancelled = all.find((order) => order.id === cancelId);
              if (!cancelled) {
                setError(orderError(new Error("scope"), t));
                return;
              }
              if (
                await run(
                  (draft, freshActor) => {
                    cancelOrder(
                      draft,
                      freshActor,
                      cancelled.id,
                      reason,
                      cancelled.version,
                    );
                  },
                  t("Order cancelled.", "سفارش لغو شد."),
                  cancelled.branch,
                )
              )
                setCancelId(null);
            }}
          >
            {t("Cancel order", "لغو سفارش")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={printRequest !== null}
        onOpenChange={(open) => {
          if (!open) setPrintRequest(null);
        }}
        title={t("Print order", "چاپ سفارش")}
        className="order-print-dialog"
      >
        {printRead.error && (
          <p className="banner danger" role="alert">
            {orderError(printRead.error, t)}
          </p>
        )}
        {printRead.pending && (
          <p className="helper">{t("Loading…", "در حال بارگیری…")}</p>
        )}
        {printPreview && (
          <>
            <ScaledOrderPreview
              order={printPreview}
              config={printRead.data!.config}
              language={lang}
            />
            <DialogActions>
              <Button variant="neutral" onClick={() => setPrintRequest(null)}>
                {t("Close", "بستن")}
              </Button>
              <Button
                variant="tinted"
                disabled={printRead.pending || saving}
                onClick={async () => {
                  if (!printRequest) return;
                  const initiatingActor = actor;
                  const requestKey = printAccessKey;
                  try {
                    const printable = await query(
                      "orders.read",
                      {
                        company_id: initiatingActor.company_id,
                        kind: "location_record",
                        location_ids: [printRequest.branch],
                        location_policy: "retained_read",
                      },
                      (canonical, freshActor) => {
                        requireSameOrderActor(
                          canonical,
                          freshActor,
                          initiatingActor,
                        );
                        return orderPrintSnapshot(
                          canonical,
                          freshActor,
                          printRequest.id,
                          printRequest.version,
                        );
                      },
                    );
                    if (currentAccess.current !== requestKey)
                      throw new Error("stale");
                    printDocument(
                      <OrderPrintDocument
                        order={printable.order}
                        config={printable.config}
                        language={lang}
                      />,
                    );
                  } catch (caught) {
                    clearPrint();
                    setError(orderError(caught, t));
                  }
                }}
              >
                <Printer size={16} />
                {t("Print", "چاپ")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      {printOutput}
    </div>
  );
}
