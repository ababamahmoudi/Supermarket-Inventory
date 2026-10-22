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
import { missingGroups } from "./missing-groups";
import { OriginalViewer } from "./OriginalViewer";
import { useInvoiceLineHighlight } from "./useInvoiceLineHighlight";
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
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [addProduct, setAddProduct] = useState("");
  const [hidden, setHidden] = useState(false);
  const [reservedHeight, setReservedHeight] = useState(0);
  const [, refreshLayout] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const open = (index: number | null) => {
    if (index === null && openLine !== null)
      setReservedHeight(root.current?.getBoundingClientRect().height ?? 0);
    setOpenLine(index);
  };
  const position = useRef<{
    element: HTMLElement;
    top: number;
    expires: number;
  } | null>(null);
  const anchor = (element?: HTMLElement) => {
    if (element)
      position.current = {
        element,
        top: element.getBoundingClientRect().top,
        expires: Number.POSITIVE_INFINITY,
      };
  };
  const adjustingScroll = useRef<number | null>(null);
  useEffect(() => {
    const scrolled = () => {
      if (
        adjustingScroll.current !== null &&
        Math.abs(window.scrollY - adjustingScroll.current) <= 0.25
      ) {
        adjustingScroll.current = null;
        return;
      }
      adjustingScroll.current = null;
      position.current = null;
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => window.removeEventListener("scroll", scrolled);
  }, []);
  useLayoutEffect(() => {
    const saved = position.current;
    if (
      !saved ||
      !saved.element.isConnected ||
      performance.now() > saved.expires
    )
      return;
    const delta = saved.element.getBoundingClientRect().top - saved.top;
    if (Math.abs(delta) > 0.25) {
      const before = window.scrollY;
      window.scrollBy({ top: delta, behavior: "instant" });
      adjustingScroll.current =
        window.scrollY !== before ? window.scrollY : null;
    }
  });
  useInvoiceLineHighlight(invoice.id, true);
  const show = (target: string, line?: number) => {
    position.current = null;
    setReservedHeight(0);
    if (line !== undefined) setOpenLine(line);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const element = document.getElementById(target);
        element?.scrollIntoView({ block: "center", behavior: "smooth" });
        element?.focus({ preventScroll: true });
      }),
    );
  };
  const next = () => {
    const index = invoice.lines.findIndex(
      (x) => !x.review_confirmed || x.low_confidence_fields?.length,
    );
    if (index >= 0) {
      show(`invoice-line-${index}-detail`, index);
      return;
    }
    show(
      (invoice.low_confidence_fields ?? []).some((x) =>
        /subtotal|tax|final_total/.test(x),
      ) ||
        (invoice.other_charges ?? []).some(
          (charge) => charge.low_confidence_fields?.length,
        )
        ? "invoice-totals"
        : "invoice-details-fields",
    );
  };
  const missing = missingGroups(
    invoice,
    t,
    workspace.blockers,
    workspace.blockerLineIndexes,
  )
    .map((x) => x.label)
    .join("\n");
  return (
    <div
      className="receiving-review"
      data-testid="invoice-review"
      ref={root}
      style={{ minHeight: reservedHeight || undefined }}
      onWheelCapture={() => {
        position.current = null;
        setReservedHeight(0);
      }}
      onClickCapture={(e) => {
        if (e.target instanceof Node && e.currentTarget.contains(e.target))
          refreshLayout((n) => n + 1);
      }}
      onKeyDownCapture={(e) => {
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
        onClose={props.onClose}
        onPost={props.onPost}
        onAttemptPost={props.onAttemptPost}
      />
      <ProgressStrip invoice={invoice} onNext={next} />
      {props.attemptedPost && workspace.blockers.length > 0 && (
        <MissingPanel
          invoice={invoice}
          blockers={workspace.blockers}
          blockerLineIndexes={workspace.blockerLineIndexes}
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
          />
          <InvoiceOtherCharges
            invoice={invoice}
            onEdit={(index, field, value) => {
              void update((draft) => {
                const charge = draft.invoice.other_charges?.[index];
                if (!charge) return;
                if (field === "line_total") charge.amount = value;
                else if (field === "taxable") charge.taxable = value === "true";
                else if (field === "description") charge.description = value;
                charge.low_confidence_fields =
                  charge.low_confidence_fields?.filter((key) => key !== field);
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
