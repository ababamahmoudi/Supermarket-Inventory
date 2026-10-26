import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDemo } from "../../store";
import { Button, Select } from "../../ui";
import { addManualLine, recalculateInvoice } from "../../invoice";
import { InvoiceOtherCharges } from "../../InvoiceReadingReview";
import { ReviewHeader } from "./ReviewHeader";
import { ProgressStrip } from "./ProgressStrip";
import { InvoiceDetailsCard } from "./InvoiceDetailsCard";
import { LinesTable } from "./LinesTable";
import { TotalsCard } from "./TotalsCard";
import { MissingPanel } from "./MissingPanel";
import {
  nextInvoiceAttention,
  revealInvoiceReviewTarget,
  focusInvoiceReviewTarget,
} from "./review-attention";
import { missingGroups } from "./missing-groups";
import { OriginalViewer } from "./OriginalViewer";
import { acknowledgeInvoiceOtherChargeCheck } from "../../invoice-checks";
import { invoiceLineId } from "../../invoice-line-links";
import { useInvoiceLineHighlight } from "./useInvoiceLineHighlight";
import { useReviewScrollAnchor } from "./useReviewScrollAnchor";
import type { ReviewProps } from "./types";
import "./invoice-review.css";
export function InvoiceReviewPage(props: ReviewProps & { extras?: ReactNode }) {
  const {
    invoice,
    workspace,
    update,
    editLine,
    onQuantity,
    onProductAdd,
    extras,
  } = props;
  const { state, t } = useDemo();
  const [optimisticConfirmed, setOptimisticConfirmed] = useState<
    ReadonlySet<string>
  >(new Set());
  const [confirmationLines, setConfirmationLines] = useState(invoice.lines);
  if (confirmationLines !== invoice.lines) {
    setConfirmationLines(invoice.lines);
    const retained = new Set(
      [...optimisticConfirmed].filter((id) =>
        invoice.lines.some(
          (line, index) =>
            invoiceLineId(line, index) === id && !line.review_confirmed,
        ),
      ),
    );
    if (retained.size !== optimisticConfirmed.size)
      setOptimisticConfirmed(retained);
  }
  const displayedInvoice = optimisticConfirmed.size
    ? {
        ...invoice,
        lines: invoice.lines.map((line, index) =>
          optimisticConfirmed.has(invoiceLineId(line, index))
            ? { ...line, review_confirmed: true, low_confidence_fields: [] }
            : line,
        ),
      }
    : invoice;
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [addProduct, setAddProduct] = useState("");
  const [hidden, setHidden] = useState(false);
  const [reservedHeight, setReservedHeight] = useState(0);
  const [attentionNavigationKey, setAttentionNavigationKey] = useState(0);
  const [, refreshLayout] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const focusCleanup = useRef<(() => void) | undefined>(undefined);
  const focusRequest = useRef(0);
  const cancelFocus = () => {
    focusRequest.current++;
    focusCleanup.current?.();
    focusCleanup.current = undefined;
  };
  useEffect(() => () => focusCleanup.current?.(), []);
  useLayoutEffect(() => {
    const topbar = document.querySelector<HTMLElement>(".topbar");
    const progress = root.current?.querySelector<HTMLElement>(
      ".receiving-progress",
    );
    const measure = () => {
      root.current?.style.setProperty(
        "--receiving-topbar-height",
        `${topbar?.getBoundingClientRect().height ?? 0}px`,
      );
      root.current?.style.setProperty(
        "--receiving-progress-height",
        `${progress?.getBoundingClientRect().height ?? 0}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (topbar) observer.observe(topbar);
    if (progress) observer.observe(progress);
    return () => observer.disconnect();
  }, []);
  const open = (index: number | null) => {
    if (index === null && openLine !== null)
      setReservedHeight(root.current?.getBoundingClientRect().height ?? 0);
    setOpenLine(index);
  };
  const { anchor, clear: clearAnchor } = useReviewScrollAnchor();
  useInvoiceLineHighlight(invoice.id, true);
  const show = (target: string, line?: number) => {
    cancelFocus();
    const request = focusRequest.current;
    setAttentionNavigationKey((value) => value + 1);
    clearAnchor();
    setReservedHeight(0);
    if (line !== undefined) setOpenLine(line);
    requestAnimationFrame(() => {
      if (root.current) revealInvoiceReviewTarget(root.current, target);
      requestAnimationFrame(() => {
        clearAnchor();
        if (request === focusRequest.current && root.current)
          focusCleanup.current = focusInvoiceReviewTarget(target, root.current);
      });
    });
  };
  const next = () => {
    const attention = nextInvoiceAttention(invoice);
    if (attention) show(attention.target, attention.line);
  };
  const guidance = missingGroups(
    invoice,
    t,
    workspace.blockers,
    workspace.blockerLineIndexes,
    workspace.orderProblems,
  );
  const missing = guidance.map((x) => x.label).join("\n");
  return (
    <div
      className="receiving-review ui-form-surface"
      data-testid="invoice-review"
      ref={root}
      style={{ minHeight: reservedHeight || undefined }}
      onWheelCapture={() => {
        clearAnchor();
        setReservedHeight(0);
      }}
      onClickCapture={(e) => {
        if (e.target instanceof Node && e.currentTarget.contains(e.target))
          refreshLayout((n) => n + 1);
      }}
      onKeyDownCapture={(e) => {
        cancelFocus();
        if (
          !["Enter", " "].includes(e.key) ||
          !(e.target instanceof HTMLElement) ||
          !e.currentTarget.contains(e.target) ||
          !e.target.matches("button,summary,[role='combobox']")
        )
          return;
        anchor(e.target);
        setReservedHeight((current) =>
          Math.max(current, root.current?.getBoundingClientRect().height ?? 0),
        );
      }}
      onPointerDownCapture={(e) => {
        cancelFocus();
        const target =
          e.target instanceof Element
            ? e.target.closest<HTMLElement>(
                "button,input,summary,a[data-control-kind='disclosure'],[role='radio'],[role='combobox']",
              )
            : null;
        if (target && e.currentTarget.contains(target)) {
          anchor(target);
          setReservedHeight((current) =>
            Math.max(
              current,
              root.current?.getBoundingClientRect().height ?? 0,
            ),
          );
        }
      }}
      onChangeCapture={(e) => {
        if (e.target instanceof HTMLElement) anchor(e.target);
      }}
    >
      <ReviewHeader
        invoice={invoice}
        missing={missing}
        postDisabled={workspace.blockers.includes("permission")}
        onClose={props.onClose}
        onPost={props.onPost}
        onAttemptPost={props.onAttemptPost}
      />
      <ProgressStrip
        invoice={displayedInvoice}
        onNext={next}
        postDisabled={workspace.blockers.includes("permission")}
        missing={missing}
        onPost={props.onPost}
        onAttemptPost={props.onAttemptPost}
      />
      {props.attemptedPost && workspace.blockers.length > 0 && (
        <MissingPanel
          invoice={invoice}
          blockers={workspace.blockers}
          blockerLineIndexes={workspace.blockerLineIndexes}
          orderProblems={workspace.orderProblems}
          onShow={show}
        />
      )}
      <div className={`receiving-layout${hidden ? " is-original-hidden" : ""}`}>
        <div className="receiving-work list-box-stack">
          <InvoiceDetailsCard
            invoice={invoice}
            update={update}
            onSupplierAdd={props.onSupplierAdd}
            onReceived={props.onReceived}
            receivedLocal={props.receivedLocal}
            attemptedPost={props.attemptedPost}
            invalidDueDate={
              workspace.blockers.includes("payment_terms") &&
              guidance.some((row) => row.target === "invoice-due-date")
            }
          />
          <LinesTable
            invoice={invoice}
            workspace={workspace}
            update={update}
            editLine={editLine}
            onQuantity={onQuantity}
            openLine={openLine}
            onOpen={open}
            anchor={anchor}
            attemptedPost={props.attemptedPost}
            attentionNavigationKey={attentionNavigationKey}
            optimisticConfirmed={optimisticConfirmed}
            onOptimisticConfirmation={(id, confirmed) =>
              setOptimisticConfirmed((current) => {
                const next = new Set(current);
                if (confirmed) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          />
          <InvoiceOtherCharges
            invoice={invoice}
            onEdit={(index, field, value) => {
              void update((draft, actor) => {
                const charge = draft.invoice.other_charges?.[index];
                if (!charge) return;
                if (field === "line_total") charge.amount = value;
                else if (field === "taxable") charge.taxable = value === "true";
                else if (field === "description") charge.description = value;
                acknowledgeInvoiceOtherChargeCheck(draft, actor, index, field);
                recalculateInvoice(draft.invoice, draft.config);
              });
            }}
          />
          <section className="list-box receiving-add-line">
            <div className="actions">
              <Select
                aria-label={t(
                  "Add a product to the invoice",
                  "افزودن کالا به فاکتور",
                )}
                id="invoice-add-product"
                value={addProduct}
                options={[
                  { value: "", label: t("Choose a product", "انتخاب کالا") },
                  ...state.products
                    .filter(
                      (x) =>
                        x.company_id === invoice.company_id &&
                        x.status !== "archived",
                    )
                    .map((x) => ({ value: x.code, label: x.name_en })),
                  { value: "NEW", label: t("New product", "کالای جدید") },
                ]}
                onChange={setAddProduct}
              />
              <Button
                variant="secondary"
                disabled={!addProduct}
                onClick={() => {
                  if (addProduct === "NEW") {
                    onProductAdd();
                    return;
                  }
                  void update((draft, actor) =>
                    addManualLine(draft, actor, addProduct),
                  );
                }}
              >
                {t("Add line", "افزودن ردیف")}
              </Button>
              <Button variant="plain" onClick={onProductAdd}>
                {t("+ Add new product", "+ افزودن کالای جدید")}
              </Button>
            </div>
          </section>
          {extras}
          <TotalsCard
            invoice={invoice}
            update={update}
            attemptedPost={props.attemptedPost}
          />
        </div>
        <OriginalViewer
          invoice={invoice}
          onAttach={props.onAttach}
          onVisibilityChange={(visible) => setHidden(!visible)}
        />
      </div>
    </div>
  );
}
