import { approvalProductEditRead } from "../approval-product-editor";
import { ProductEditor } from "./Catalog";
import { InvoiceApprovalDialog } from "./InvoiceApprovalDialog";
import { ApprovalNumbers } from "./ApprovalNumbers";
import { saleRequestTab } from "../sale-request-status";
import { approvalBoard, approvalCategoryPreview } from "../approval-board";
import { useProtectedQuery } from "../use-protected-query";
import { domainScope } from "../domain-authority";
import {
  branchLabel as configuredBranchLabel,
  branchSellsToCustomers,
  sellingBranches,
} from "../settings";
import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import {
  approvalSnapshot,
  approveInvoiceApprovals,
  changeApprovalCategory,
  resubmitApproval,
  keepApprovedPrice,
  proposeManualOverride,
  resolveApproval,
  requiresIndividualApprovalReview,
} from "../approvals";
import { regularPrice } from "../catalog";
import { ManualPricePill } from "../manual-price-presentation";
import {
  categoryLabel,
  demoUserLabel,
  LtrText,
  ProductName,
} from "../presentation";
import { ProductCost, ProductPrice } from "../weight-price-presentation";
import "./financial-polish.css";
import { useDemo } from "../store";
import { ApprovalReviewPanel } from "./ApprovalReviewPanel";
import { SaleRequestCards } from "./SalesApprovals";
import type { Approval, Branch } from "../types";
import "./approval-receiving.css";
import "./approval-r2e.css";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  Tabs,
  NumberField,
  Select,
  Dialog,
  Checkbox,
} from "../ui";

export function Approvals() {
  const {
    state,
    command,
    query,
    actor,
    can,
    branch,
    lang,
    t,
    authorityGeneration,
    authorityDirectoryVersion,
  } = useDemo();
  const canDecide = can("approvals.decide");
  const boardRead = useProtectedQuery(
    can("approvals.read") ? "approvals.read" : null,
    domainScope(state),
    approvalBoard,
    branch,
  );
  const accessKey = `${authorityGeneration}:${authorityDirectoryVersion}:${actor?.user_id}:${actor?.session_id}:${actor?.authority_epoch}:${branch}`;
  const [retainedBoard, setRetainedBoard] = useState<{
    accessKey: string;
    data: NonNullable<typeof boardRead.data>;
  } | null>(null);
  useEffect(() => {
    if (boardRead.data) setRetainedBoard({ accessKey, data: boardRead.data });
  }, [boardRead.data, accessKey]);
  const board =
    boardRead.data ??
    (retainedBoard?.accessKey === accessKey ? retainedBoard.data : []);
  const boardElement = useRef<HTMLDivElement>(null);
  const [boardFloor, setBoardFloor] = useState(0);
  const [departureKey, setDepartureKey] = useState(accessKey);
  const [departing, setDeparting] = useState<
    NonNullable<typeof boardRead.data>
  >([]);
  const [bulk, setBulk] = useState<{
    accessKey: string;
    ids: string[];
    selected: string[];
    snapshots: Record<string, string>;
    title: string;
  } | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [productEdit, setProductEdit] = useState<
    | (ReturnType<typeof approvalProductEditRead> & {
        id: string;
        accessKey: string;
        manualReview: boolean;
        scroll: { x: number; y: number };
      })
    | null
  >(null);

  const [correction, setCorrection] = useState<{
    accessKey: string;
    item: Approval;
    category: string;
    price: string;
    reason: string;
    error: string;
  } | null>(null);
  const correctionRead = useProtectedQuery(
    correction?.accessKey === accessKey && canDecide
      ? "approvals.decide"
      : null,
    domainScope(state, correction?.item),
    (canonical, currentActor) =>
      approvalCategoryPreview(
        canonical,
        currentActor,
        correction!.item.id,
        correction!.category,
      ),
    `${correction?.item.id}:${correction?.category}`,
  );
  const [filter, setFilter] = useState<Approval["status"]>("pending");
  const [scope, setScope] = useState<"all" | "branch">("all");
  const [regularDecision, setRegularDecision] = useState<"rule" | "keep">(
    "rule",
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [marginAcknowledgments, setMarginAcknowledgments] = useState<
    Record<string, string>
  >({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({});
  const [overrideErrors, setOverrideErrors] = useState<Record<string, string>>(
    {},
  );
  const [previewState, setPreview] = useState<{
    approval: Approval;
    accessKey: string;
    user_id: string;
    session_id: string;
    decision: "approve" | "reject";
    snapshot: string;
    target: Branch;
    company: string;
    branch: Branch;
  } | null>(null);
  const preview = previewState?.accessKey === accessKey ? previewState : null;
  const company = state.config.company.seed_key;
  const branches = sellingBranches(state.config);
  const viewStatus = canDecide ? filter : "pending";
  const currentRows = board.filter(
    (row) =>
      row.approval.status === viewStatus &&
      row.approval.type !== "new_supplier",
  );
  const visibleDepartures = departureKey === accessKey ? departing : [];
  const boardOrder = new Map(
    board.map((row, index) => [row.approval.id, index]),
  );
  const displayedRows = [
    ...currentRows,
    ...visibleDepartures.filter(
      (row) =>
        row.approval.status === viewStatus &&
        !currentRows.some((current) => current.approval.id === row.approval.id),
    ),
  ].sort(
    (left, right) =>
      (boardOrder.get(left.approval.id) ?? Number.MAX_SAFE_INTEGER) -
      (boardOrder.get(right.approval.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const groups = new Map<string, typeof displayedRows>();
  for (const row of displayedRows) {
    const key =
      viewStatus === "pending"
        ? (row.invoiceId ?? row.approval.id)
        : row.approval.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const rows = [...groups.values()].flat();
  const items = rows.map((row) => row.approval);
  const saleRequests = (state.sale_requests ?? []).filter(
    (request) =>
      request.company_id === company &&
      actor?.allowed_branches.includes(request.branch) &&
      (branch === "all" || request.branch === branch),
  );
  const counts = (status: Approval["status"]) =>
    board.filter(
      (row) =>
        row.approval.status === status && row.approval.type !== "new_supplier",
    ).length +
    saleRequests.filter((request) => saleRequestTab(request.status) === status)
      .length;
  const saleCount = saleRequests.filter(
    (request) => saleRequestTab(request.status) === viewStatus,
  ).length;
  if (!actor || !can("approvals.read"))
    return <EmptyState>{t("Approvals", "تأییدها")}</EmptyState>;
  const typeName = (item: Approval) =>
    item.manual_override
      ? t("Manual price override", "تغییر دستی قیمت")
      : {
          new_product: t("New product", "کالای جدید"),
          price_change: t("Price change", "تغییر قیمت"),
          margin_review: t("Below minimum margin", "کمتر از حداقل حاشیه سود"),
          barcode_conflict: t("Barcode conflict", "تداخل بارکد"),
          tax_profile: t("Tax profile change", "تغییر وضعیت مالیات"),
          new_supplier: t(
            "Supplier waiting for confirmation",
            "تأمین‌کننده در انتظار تأیید",
          ),
        }[item.type];
  const branchName = (value: Branch) =>
    configuredBranchLabel(state.config, value, lang);
  const needsMarginAcknowledgment = (row: (typeof board)[number]) =>
    row.approval.type !== "margin_review" &&
    row.approval.type !== "barcode_conflict" &&
    row.margin !== null &&
    row.minimumMargin !== null &&
    new Decimal(row.margin).lt(row.minimumMargin);
  const marginAcknowledgmentKey = (row: (typeof board)[number]) =>
    JSON.stringify([
      accessKey,
      row.approval.id,
      row.approval.proposed_price,
      row.unitCost,
      row.margin,
      row.minimumMargin,
    ]);
  const openPreview = async (
    item: Approval,
    decision: "approve" | "reject",
  ) => {
    if (!canDecide || !actor) return;
    const shown = board.find((row) => row.approval.id === item.id);
    if (
      decision === "approve" &&
      shown &&
      needsMarginAcknowledgment(shown) &&
      marginAcknowledgments[item.id] !== marginAcknowledgmentKey(shown)
    ) {
      document.getElementById(`approval-card-margin-${item.id}`)?.focus();
      return;
    }
    setMessage("");
    setRegularDecision("rule");
    const target = branchSellsToCustomers(state.config, item.branch)
      ? item.branch
      : branchSellsToCustomers(state.config, branch)
        ? branch
        : (branches[0] ?? "all");
    try {
      const source = await query(
        "approvals.decide",
        domainScope(state, item),
        (canonical, actualActor) => {
          const fresh = approvalBoard(canonical, actualActor).find(
            (row) => row.approval.id === item.id,
          );
          if (
            !fresh ||
            (decision === "approve" &&
              needsMarginAcknowledgment(fresh) &&
              marginAcknowledgments[item.id] !== marginAcknowledgmentKey(fresh))
          )
            throw new Error("Margin review changed");
          return {
            snapshot: approvalSnapshot(
              canonical,
              actualActor,
              item.product_code,
            ),
          };
        },
      );
      setPreview({
        approval: item,
        decision,
        ...source,
        user_id: actor.user_id,
        session_id: actor.session_id,
        target,
        company,
        branch,
        accessKey,
      });
    } catch {
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
    }
  };
  const preserveViewport = () => {
    const scroll = { x: window.scrollX, y: window.scrollY };
    if (boardElement.current)
      setBoardFloor((height) =>
        Math.max(height, boardElement.current!.getBoundingClientRect().height),
      );
    return scroll;
  };
  const finishRemoval = (
    ids: readonly string[],
    scroll: { x: number; y: number },
  ) => {
    setDepartureKey(accessKey);
    setDeparting((stored) => {
      const current = departureKey === accessKey ? stored : [];
      return [
        ...current,
        ...rows.filter(
          (row) =>
            ids.includes(row.approval.id) &&
            !current.some((item) => item.approval.id === row.approval.id),
        ),
      ];
    });
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y)),
    );
    window.setTimeout(
      () =>
        setDeparting((current) =>
          current.filter((row) => !ids.includes(row.approval.id)),
        ),
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
    );
  };
  const openBulk = async (group: typeof rows) => {
    setBulkError("");
    try {
      const snapshots = await query(
        "approvals.decide",
        domainScope(state),
        (canonical, currentActor) => {
          const requested = new Set(group.map((row) => row.approval.id));
          const pending = approvalBoard(canonical, currentActor).filter(
            (row) =>
              requested.has(row.approval.id) &&
              row.approval.status === "pending",
          );
          if (!pending.length) throw new Error("No pending products remain");
          return {
            pending,
            values: Object.fromEntries(
              pending.map((row) => [
                row.approval.product_code,
                approvalSnapshot(
                  canonical,
                  currentActor,
                  row.approval.product_code,
                ),
              ]),
            ),
          };
        },
      );
      setBulk({
        accessKey,
        ids: snapshots.pending.map((row) => row.approval.id),
        selected: snapshots.pending
          .filter((row) => !requiresIndividualApprovalReview(row.approval))
          .map((row) => row.approval.id),
        snapshots: snapshots.values,
        title: `${t("Invoice", "فاکتور")} ${snapshots.pending[0].invoiceNumber} · ${snapshots.pending[0].supplierName ?? ""}`,
      });
      setMessage("");
    } catch {
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
    }
  };
  const confirmBulk = async () => {
    if (
      !bulk ||
      bulk.accessKey !== accessKey ||
      bulkPending ||
      !bulk.selected.length
    )
      return;
    const scroll = preserveViewport();
    setBulkPending(true);
    setBulkError("");
    try {
      await command(
        "approvals.decide",
        domainScope(state, undefined, true),
        (draft, currentActor) => {
          for (const [code, snapshot] of Object.entries(bulk.snapshots))
            if (approvalSnapshot(draft, currentActor, code) !== snapshot)
              throw new Error("Prices changed. Refresh the approval preview");
          approveInvoiceApprovals(
            draft,
            currentActor,
            bulk.selected,
            "all",
            branches[0] ?? "all",
          );
        },
      );
      finishRemoval(bulk.selected, scroll);
      setBulk(null);
    } catch {
      setBulkError(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
    } finally {
      setBulkPending(false);
    }
  };
  const openProductEdit = async (item: Approval) => {
    const scroll = preserveViewport();
    try {
      const data = await query(
        "approvals.decide",
        domainScope(state, item),
        (canonical, currentActor) =>
          approvalProductEditRead(canonical, currentActor, item.id),
      );
      setProductEdit({
        ...data,
        id: item.id,
        accessKey,
        scroll,
        manualReview: Boolean(
          item.manual_price_review || item.source_manual_request,
        ),
      });
    } catch {
      setMessage(
        t(
          "This request changed. Open it again and check the product and price.",
          "این درخواست تغییر کرد. دوباره باز کنید و کالا و قیمت را بررسی کنید.",
        ),
      );
    }
  };
  const openCorrection = (item: Approval) => {
    const product = state.products.find(
      (value) =>
        value.company_id === company && value.code === item.product_code,
    );
    setCorrection({
      accessKey,
      item,
      category: item.pricing_category ?? product?.pricing_category ?? "",
      price: "",
      reason: "",
      error: "",
    });
  };
  const saveCorrection = async () => {
    if (!correction || correction.accessKey !== accessKey || savingCorrection)
      return;
    const scroll = preserveViewport();
    setSavingCorrection(true);
    try {
      await command(
        "approvals.decide",
        domainScope(state, correction.item, true),
        (draft, currentActor) => {
          if (correction.item.status === "rejected")
            resubmitApproval(draft, currentActor, correction.item.id, {
              category: correction.category,
              price: correction.price,
              reason: correction.reason,
            });
          else
            changeApprovalCategory(
              draft,
              currentActor,
              correction.item.id,
              correction.category,
            );
        },
      );
      setCorrection(null);
      window.requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y));
    } catch (error) {
      setCorrection((current) =>
        current
          ? {
              ...current,
              error:
                error instanceof Error && /reason/.test(error.message)
                  ? t(
                      "Add a reason for a price below the minimum margin.",
                      "برای قیمتی کمتر از حداقل حاشیه سود دلیل وارد کنید.",
                    )
                  : t(
                      "This request changed. Open it again and check the category and price.",
                      "این درخواست تغییر کرد. دوباره باز کنید و دسته‌بندی و قیمت را بررسی کنید.",
                    ),
            }
          : null,
      );
    } finally {
      setSavingCorrection(false);
    }
  };
  const confirm = async () => {
    if (!preview) return;
    const scroll = preserveViewport();
    if (
      preview.company !== company ||
      preview.branch !== branch ||
      !canDecide
    ) {
      setPreview(null);
      return;
    }
    try {
      await command(
        "approvals.decide",
        domainScope(state, preview.approval, true),
        (draft, freshActor) => {
          if (
            freshActor.user_id !== preview.user_id ||
            freshActor.session_id !== preview.session_id
          )
            throw new Error("Approval changed. Refresh the preview");
          resolveApproval(
            draft,
            freshActor,
            preview.approval.id,
            preview.decision,
            scope,
            preview.target,
            reasons[preview.approval.id],
            preview.snapshot,
            preview.approval.manual_price_review ? regularDecision : undefined,
          );
        },
      );
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("reason")) {
        setReasonErrors((current) => ({
          ...current,
          [preview.approval.id]: t("Add a reason.", "یک دلیل اضافه کنید."),
        }));
        return;
      }
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
      setPreview(null);
      return;
    }
    finishRemoval([preview.approval.id], scroll);
    setPreview(null);
  };
  const marginAction = async (item: Approval, action: "keep" | "override") => {
    if (!canDecide) return;
    const scroll = preserveViewport();
    const reason = reasons[item.id]?.trim();
    if (!reason) {
      setReasonErrors((current) => ({
        ...current,
        [item.id]: t(
          "Add a reason before keeping the price or proposing an override.",
          "پیش از حفظ قیمت یا پیشنهاد تغییر دستی، دلیل را وارد کنید.",
        ),
      }));
      return;
    }
    const amount = overrides[item.id] ?? "";
    if (action === "override" && !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setOverrideErrors((current) => ({
        ...current,
        [item.id]: t(
          "Enter a nonnegative override price with at most two decimals.",
          "قیمت دستی غیرمنفی را با حداکثر دو رقم اعشار وارد کنید.",
        ),
      }));
      return;
    }
    try {
      await command(
        "approvals.decide",
        domainScope(state, item, true),
        (draft, freshActor) =>
          action === "keep"
            ? keepApprovedPrice(draft, freshActor, item.id, reason)
            : void proposeManualOverride(
                draft,
                freshActor,
                item.id,
                amount,
                reason,
              ),
      );
    } catch {
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
      return;
    }
    finishRemoval([item.id], scroll);
  };
  const correctionPrice = correction?.price || correctionRead.data || "…";
  return (
    <>
      <PageHeader
        title={t("Approvals", "تأییدها")}
        description={t(
          "Review new products and prices. Pending prices never replace approved prices.",
          "کالاها و قیمت‌های جدید را بررسی کنید. قیمت در انتظار، جایگزین قیمت تأییدشده نمی‌شود.",
        )}
      />
      <Tabs
        showZeroCounts
        value={viewStatus}
        aria-label={t("Approval status", "وضعیت تأیید")}
        onChange={(value) => {
          setFilter(value as typeof filter);
          setBoardFloor(0);
          setDeparting([]);
          setMessage("");
        }}
        options={
          canDecide
            ? [
                {
                  value: "pending",
                  count: counts("pending"),
                  label: t("Pending", "در انتظار"),
                },
                {
                  value: "approved",
                  count: counts("approved"),
                  label: t("Approved", "تأییدشده"),
                },
                {
                  value: "rejected",
                  count: counts("rejected"),
                  label: t("Rejected", "ردشده"),
                },
                {
                  value: "superseded",
                  count: counts("superseded"),
                  label: t("Superseded", "جایگزین‌شده"),
                },
              ]
            : [
                {
                  value: "pending",
                  count: counts("pending"),
                  label: t("Pending", "در انتظار"),
                },
              ]
        }
      />
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      <SaleRequestCards status={viewStatus} />
      {items.length === 0 && saleCount === 0 && (
        <EmptyState>
          {viewStatus === "pending"
            ? t(
                "No pending requests. Receive an invoice to create a proposal.",
                "درخواستی در انتظار نیست. برای ایجاد پیشنهاد، یک فاکتور دریافت کنید.",
              )
            : viewStatus === "approved"
              ? t("No approved requests yet.", "هنوز درخواستی تأیید نشده است.")
              : viewStatus === "rejected"
                ? t("No rejected requests yet.", "هنوز درخواستی رد نشده است.")
                : t(
                    "No expired or withdrawn requests yet.",
                    "هنوز درخواستی منقضی یا پس گرفته نشده است.",
                  )}
        </EmptyState>
      )}
      <div
        ref={boardElement}
        className="approval-board-list"
        style={{ minBlockSize: boardFloor }}
      >
        {items.map((item, itemIndex) => {
          const product = state.products.find(
            (value) =>
              value.company_id === company && value.code === item.product_code,
          );
          if (!product) return null;
          const approved =
            "current_price" in item
              ? item.current_price
              : regularPrice(state, product, item.branch);
          const details = rows.find((row) => row.approval.id === item.id)!;
          const { unitCost, margin, triggeredBy } = details;
          const invoiceNumber = details.invoiceNumber;
          const category = state.config.pricing_categories.find(
            (row) => row.key === details.category,
          );
          const threshold = details.minimumMargin;
          const belowMinimum =
            margin !== null &&
            threshold != null &&
            new Decimal(margin).lt(threshold);
          const priceChange =
            approved && new Decimal(approved).gt(0)
              ? new Decimal(item.proposed_price)
                  .minus(approved)
                  .div(approved)
                  .times(100)
                  .toFixed(1)
              : null;

          const group = details.invoiceId
            ? groups
                .get(details.invoiceId)
                ?.filter((row) =>
                  currentRows.some(
                    (current) => current.approval.id === row.approval.id,
                  ),
                )
            : undefined;
          const groupStart =
            viewStatus === "pending" &&
            details.invoiceId &&
            (itemIndex === 0 ||
              rows[itemIndex - 1].invoiceId !== details.invoiceId);
          return (
            <div
              key={item.id}
              className={
                visibleDepartures.some((row) => row.approval.id === item.id)
                  ? "approval-departure is-leaving"
                  : "approval-departure"
              }
            >
              <div>
                {groupStart && group && group.length > 0 && (
                  <div
                    className="approval-invoice-group"
                    data-testid={`invoice-approval-group-${details.invoiceId}`}
                  >
                    <h2>
                      {t("Invoice", "فاکتور")}{" "}
                      <bdi dir="ltr">{invoiceNumber}</bdi> ·{" "}
                      {details.supplierName} ·{" "}
                      {
                        new Set(group.map((row) => row.approval.product_code))
                          .size
                      }{" "}
                      {t("products", "کالا")}
                    </h2>
                    {canDecide && (
                      <Button
                        variant="secondary"
                        onClick={() => void openBulk(group)}
                      >
                        {t(
                          `Approve all (${new Set(group.map((row) => row.approval.product_code)).size})`,
                          `تأیید همه (${new Set(group.map((row) => row.approval.product_code)).size})`,
                        )}
                      </Button>
                    )}
                  </div>
                )}
                <Card
                  className="approval-card approval-detail-row"
                  data-approval-id={item.id}
                  data-approval-status={item.status}
                  data-approval-type={item.type}
                >
                  <div className="approval-row-heading">
                    <h2
                      aria-label={
                        lang === "fa"
                          ? product.name_fa || product.name_en
                          : product.name_en
                      }
                    >
                      <a
                        href={`#product?code=${encodeURIComponent(product.code)}`}
                      >
                        <ProductName product={product} language={lang} />
                      </a>
                    </h2>
                    <p className="muted approval-product-context">
                      {product.unit_size && (
                        <>
                          <bdi dir="ltr">{product.unit_size}</bdi>
                          <span aria-hidden="true"> · </span>
                        </>
                      )}
                      {category
                        ? lang === "fa"
                          ? category.label_fa ||
                            categoryLabel(category.label, lang)
                          : category.label
                        : t("Not added", "اضافه نشده")}
                      <span aria-hidden="true"> · </span>
                      <bdi dir="auto">
                        {details.supplierName || product.main_supplier}
                      </bdi>
                      <span aria-hidden="true"> · </span>
                      <bdi dir="ltr">{product.code}</bdi>
                    </p>
                    <div className="approval-row-badges">
                      <Badge
                        tone={
                          item.status === "pending"
                            ? "pending"
                            : item.status === "approved"
                              ? "approved"
                              : "neutral"
                        }
                      >
                        {item.status === "pending"
                          ? t("Pending", "در انتظار")
                          : item.status === "approved"
                            ? t("Approved", "تأییدشده")
                            : item.status === "superseded"
                              ? t("Superseded", "جایگزین‌شده")
                              : t("Rejected", "ردشده")}
                      </Badge>
                      <Badge tone="info">{typeName(item)}</Badge>
                    </div>
                  </div>
                  {item.type === "barcode_conflict" && (
                    <div className="barcode-conflict-details">
                      <LtrText>{item.barcode}</LtrText>
                      <p>
                        {t("Product", "محصول")}:{" "}
                        <ProductName product={product} language={lang} />
                      </p>
                      {state.products
                        .filter(
                          (value) =>
                            value.company_id === company &&
                            value.code === item.conflicting_product_code,
                        )
                        .map((value) => (
                          <p key={value.code}>
                            {t(
                              "Existing barcode mapping",
                              "محصول متصل به بارکد",
                            )}
                            : <ProductName product={value} language={lang} />
                          </p>
                        ))}
                    </div>
                  )}
                  {item.type !== "barcode_conflict" && (
                    <ApprovalNumbers
                      financial={canDecide}
                      leadingLabel={t("Unit cost", "هزینه واحد")}
                      leading={
                        unitCost !== null && unitCost !== undefined ? (
                          <ProductCost
                            value={unitCost}
                            product={product}
                            config={state.config}
                          />
                        ) : (
                          t("Not added", "اضافه نشده")
                        )
                      }
                      priceLabel={t("Price", "قیمت")}
                      price={
                        <ProductPrice
                          value={item.proposed_price}
                          product={product}
                          config={state.config}
                        />
                      }
                      priceNote={
                        item.type === "new_product" || !approved ? (
                          t("first price", "اولین قیمت")
                        ) : (
                          <>
                            {t("was", "قبلاً")}{" "}
                            <ProductPrice
                              value={approved}
                              product={product}
                              config={state.config}
                            />{" "}
                            {priceChange !== null && (
                              <bdi dir="ltr">
                                ({new Decimal(priceChange).gte(0) ? "+" : ""}
                                {new Decimal(priceChange).toFixed(0)}%)
                              </bdi>
                            )}{" "}
                            <ManualPricePill
                              product={product}
                              branch={item.branch}
                            />
                          </>
                        )
                      }
                      marginLabel={t("Margin", "حاشیه سود")}
                      margin={
                        margin !== null ? (
                          <bdi dir="ltr">
                            {new Decimal(margin).times(100).toFixed(1)}%
                          </bdi>
                        ) : (
                          t("Not added", "اضافه نشده")
                        )
                      }
                      marginNote={
                        threshold
                          ? belowMinimum
                            ? t(
                                `Below ${new Decimal(threshold).times(100).toString()}% minimum`,
                                `کمتر از حداقل ${new Decimal(threshold).times(100).toString()}٪`,
                              )
                            : t(
                                `Min. ${new Decimal(threshold).times(100).toString()}%`,
                                `حداقل ${new Decimal(threshold).times(100).toString()}٪`,
                              )
                          : undefined
                      }
                      warning={belowMinimum}
                    />
                  )}
                  {canDecide &&
                    item.status === "pending" &&
                    needsMarginAcknowledgment(details) && (
                      <div className="approval-margin-warning">
                        <Checkbox
                          id={`approval-card-margin-${item.id}`}
                          checked={
                            marginAcknowledgments[item.id] ===
                            marginAcknowledgmentKey(details)
                          }
                          onChange={(checked) =>
                            setMarginAcknowledgments((current) => ({
                              ...current,
                              [item.id]: checked
                                ? marginAcknowledgmentKey(details)
                                : "",
                            }))
                          }
                        >
                          {t(
                            "Use this price anyway — it's below the minimum margin.",
                            "با وجود حاشیه کمتر از حداقل، این قیمت را استفاده کن.",
                          )}
                        </Checkbox>
                      </div>
                    )}
                  {canDecide && item.manual_override && (
                    <p>
                      {t("Reason", "دلیل")}: {item.reason}
                    </p>
                  )}
                  {canDecide &&
                    item.status === "pending" &&
                    item.type === "margin_review" && (
                      <>
                        <p className="muted">
                          {t(
                            "Receiving continues. Keep this price with a reason, propose an override, or leave the review pending.",
                            "دریافت کالا ادامه دارد. قیمت را با دلیل حفظ کنید، تغییر دستی پیشنهاد دهید یا بررسی را در انتظار بگذارید.",
                          )}
                        </p>
                        <div className="form-grid approval-form">
                          <Field
                            label={t("Reason", "دلیل")}
                            error={reasonErrors[item.id]}
                          >
                            <input
                              value={reasons[item.id] ?? ""}
                              onChange={(event) => {
                                setReasons({
                                  ...reasons,
                                  [item.id]: event.target.value,
                                });
                                setReasonErrors((current) => ({
                                  ...current,
                                  [item.id]: "",
                                }));
                              }}
                            />
                          </Field>
                          <Field
                            label={t("Manual override price", "قیمت دستی")}
                            error={overrideErrors[item.id]}
                          >
                            <NumberField
                              value={overrides[item.id] ?? ""}
                              onChange={(value) => {
                                setOverrides({
                                  ...overrides,
                                  [item.id]: value,
                                });
                                setOverrideErrors((current) => ({
                                  ...current,
                                  [item.id]: "",
                                }));
                              }}
                            />
                          </Field>
                        </div>
                        <div className="actions approval-margin-actions">
                          <Button
                            variant="secondary"
                            onClick={() => void openProductEdit(item)}
                          >
                            {t("Edit and approve", "ویرایش و تأیید")}
                          </Button>
                          <Button onClick={() => marginAction(item, "keep")}>
                            {t("Keep approved price", "حفظ قیمت تأییدشده")}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => marginAction(item, "override")}
                          >
                            {t("Propose manual override", "پیشنهاد تغییر دستی")}
                          </Button>
                        </div>
                      </>
                    )}
                  <div className="approval-card-footer">
                    <div className="approval-meta">
                      <span>{branchName(item.branch)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t("Triggered by", "ایجادشده توسط")}:{" "}
                        {triggeredBy
                          ? demoUserLabel(triggeredBy, lang)
                          : t("Not recorded", "ثبت نشده")}
                      </span>
                      {invoiceNumber && (
                        <>
                          <span aria-hidden="true">·</span>
                          <a
                            href={`#invoices?id=${encodeURIComponent(details.invoiceId ?? "")}`}
                          >
                            <span>{t("Invoice", "فاکتور")}</span>{" "}
                            <bdi dir="ltr">{invoiceNumber}</bdi>
                          </a>
                        </>
                      )}
                    </div>
                    {canDecide &&
                      item.status === "pending" &&
                      item.type !== "margin_review" && (
                        <div className="actions approval-decision-actions">
                          {item.type !== "barcode_conflict" && (
                            <Button
                              variant="secondary"
                              onClick={() => void openProductEdit(item)}
                            >
                              {t("Edit and approve", "ویرایش و تأیید")}
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            onClick={() => openPreview(item, "reject")}
                          >
                            {t("Reject", "رد کردن")}
                          </Button>
                          <Button
                            aria-label={
                              item.type === "new_product"
                                ? t("Approve product", "تأیید کالا")
                                : item.type === "barcode_conflict"
                                  ? t("Approve", "تأیید")
                                  : t("Approve price", "تأیید قیمت")
                            }
                            onClick={() => {
                              setScope("all");
                              void openPreview(item, "approve");
                            }}
                          >
                            {t("Approve", "تأیید")}
                          </Button>
                        </div>
                      )}
                  </div>
                  {canDecide && item.acknowledgment_reason && (
                    <p>
                      {t("Review reason", "دلیل بررسی")}:{" "}
                      {item.acknowledgment_reason}
                    </p>
                  )}
                  {item.applies_after_sale && (
                    <Badge tone="info">
                      {t("Applies after the sale", "پس از حراج اعمال می‌شود")}
                    </Badge>
                  )}
                  {canDecide &&
                    item.status === "rejected" &&
                    item.type !== "barcode_conflict" &&
                    !item.resubmitted_as_id && (
                      <Button onClick={() => openCorrection(item)}>
                        {t("Fix and resubmit", "اصلاح و ارسال دوباره")}
                      </Button>
                    )}
                  {item.resubmitted_as_id && (
                    <p className="muted">
                      {t(
                        "Resubmitted as a new pending request",
                        "به عنوان درخواست جدید در انتظار ارسال شد",
                      )}
                    </p>
                  )}
                </Card>
              </div>
            </div>
          );
        })}
      </div>
      {canDecide && productEdit?.accessKey === accessKey && (
        <ProductEditor
          key={`${productEdit.id}:${accessKey}`}
          product={productEdit.existingProduct}
          approval={{
            ...productEdit,
            onSaved: () => finishRemoval([productEdit.id], productEdit.scroll),
          }}
          onClose={() => {
            const scroll = productEdit.scroll;
            setProductEdit(null);
            requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y));
          }}
        />
      )}
      {canDecide && bulk?.accessKey === accessKey && (
        <InvoiceApprovalDialog
          title={bulk.title}
          selected={bulk.selected}
          busy={bulkPending}
          error={bulkError}
          onClose={() => setBulk(null)}
          onConfirm={() => void confirmBulk()}
          onSelect={(selected) => setBulk({ ...bulk, selected })}
          rows={board
            .filter(
              (row) =>
                bulk.ids.includes(row.approval.id) &&
                row.approval.status === "pending",
            )
            .flatMap((row) => {
              const product = state.products.find(
                (value) =>
                  value.company_id === company &&
                  value.code === row.approval.product_code,
              );
              if (!product) return [];
              const category = state.config.pricing_categories.find(
                (value) => value.key === row.category,
              );
              return [
                {
                  id: row.approval.id,
                  product,
                  category: category
                    ? lang === "fa"
                      ? category.label_fa || categoryLabel(category.label, lang)
                      : category.label
                    : t("Not added", "اضافه نشده"),
                  cost: row.unitCost,
                  price: row.approval.proposed_price,
                  margin: row.margin,
                  belowMinimum:
                    row.margin !== null &&
                    row.minimumMargin !== null &&
                    new Decimal(row.margin).lt(row.minimumMargin),
                  individual: requiresIndividualApprovalReview(row.approval),
                },
              ];
            })}
        />
      )}
      {canDecide && correction?.accessKey === accessKey && (
        <Dialog
          open
          title={
            correction.item.status === "rejected"
              ? t("Fix and resubmit", "اصلاح و ارسال دوباره")
              : t("Change category", "تغییر دسته‌بندی")
          }
          description={t(
            "Compare the corrected category and proposed price before saving.",
            "پیش از ذخیره، دسته‌بندی اصلاح‌شده و قیمت پیشنهادی را مقایسه کنید.",
          )}
          onOpenChange={(open) => {
            if (!open) setCorrection(null);
          }}
        >
          <Field label={t("Pricing category", "دسته‌بندی قیمت")}>
            <Select
              value={correction.category}
              onChange={(category) =>
                setCorrection({ ...correction, category, error: "" })
              }
              options={state.config.pricing_categories.map((category) => ({
                value: category.key,
                label:
                  lang === "fa"
                    ? (category.label_fa ?? category.label)
                    : category.label,
              }))}
            />
          </Field>
          <p>
            <bdi dir="ltr">
              {correction.item.proposed_price} → {correctionPrice}
            </bdi>
          </p>
          {correction.item.status === "rejected" && (
            <>
              <Field label={t("New price (optional)", "قیمت جدید (اختیاری)")}>
                <NumberField
                  value={correction.price}
                  onChange={(price) =>
                    setCorrection({ ...correction, price, error: "" })
                  }
                />
              </Field>
              <Field
                label={t(
                  "Reason (required below minimum margin)",
                  "دلیل (برای کمتر از حداقل حاشیه سود الزامی)",
                )}
              >
                <input
                  value={correction.reason}
                  onChange={(event) =>
                    setCorrection({
                      ...correction,
                      reason: event.target.value,
                      error: "",
                    })
                  }
                />
              </Field>
            </>
          )}
          {correction.error && <p role="alert">{correction.error}</p>}
          <div className="actions c3-dialog-actions">
            <Button variant="secondary" onClick={() => setCorrection(null)}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button
              disabled={savingCorrection || correctionRead.pending}
              onClick={() => void saveCorrection()}
            >
              {correction.item.status === "rejected"
                ? t("Resubmit", "ارسال دوباره")
                : t("Save category", "ذخیره دسته‌بندی")}
            </Button>
          </div>
        </Dialog>
      )}
      {canDecide && preview && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          title={
            preview.approval.type === "barcode_conflict"
              ? t("Existing barcode mapping", "محصول متصل به بارکد")
              : preview.decision === "approve"
                ? t("Review approval", "بررسی تأیید")
                : t("Reject proposal", "رد پیشنهاد")
          }
          description={
            preview.decision === "approve"
              ? t(
                  "Review every affected branch before confirming.",
                  "پیش از تأیید، همه شعبه‌های تحت تأثیر را بررسی کنید.",
                )
              : t(
                  "The current approved price stays unchanged. This proposal will be marked Rejected.",
                  "قیمت تأییدشده فعلی حفظ می‌شود. این پیشنهاد به وضعیت ردشده تغییر می‌کند.",
                )
          }
          confirmLabel={
            preview.decision === "reject"
              ? t("Reject proposal", "رد پیشنهاد")
              : preview.approval.type === "barcode_conflict"
                ? t("Approve", "تأیید")
                : preview.approval.type === "new_product"
                  ? t("Approve product", "تأیید کالا")
                  : t("Approve price", "تأیید قیمت")
          }
          onConfirm={confirm}
          confirmVariant={preview.decision === "reject" ? "danger" : "primary"}
          confirmDisabled={
            preview.decision === "approve" &&
            preview.approval.type !== "barcode_conflict" &&
            !branches.length
          }
        >
          {preview.approval.type !== "barcode_conflict" && (
            <ApprovalReviewPanel
              approval={preview.approval}
              scope={scope}
              target={preview.target}
              onScopeChange={setScope}
              showEffects={preview.decision === "approve"}
              regularDecision={regularDecision}
              onRegularDecisionChange={(decision) => {
                setRegularDecision(decision);
                if (decision === "keep") setScope("branch");
                setReasonErrors((current) => ({
                  ...current,
                  [preview.approval.id]: "",
                }));
              }}
              regularReason={reasons[preview.approval.id] ?? ""}
              regularReasonError={reasonErrors[preview.approval.id]}
              onRegularReasonChange={(reason) => {
                setReasons((current) => ({
                  ...current,
                  [preview.approval.id]: reason,
                }));
                setReasonErrors((current) => ({
                  ...current,
                  [preview.approval.id]: "",
                }));
              }}
            />
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

export default Approvals;
