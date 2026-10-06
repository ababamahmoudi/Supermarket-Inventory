import { useState } from "react";
import policySource from "../../../docs/return-policy.md?raw";
import { demoUsers, useDemo } from "../store";
import { companyDate } from "../invoice";
import { Badge, Button, Card, EmptyState, Field, PageHeader } from "../ui";
import {
  cancelReturn,
  operationError,
  companyTimestamp,
  postReturnClaim,
  receiveReplacement,
  recordPickup,
  reviewCancellation,
  scopedRecords,
  submitFinancialClaim,
  type Disposition,
  type OperationalReturn,
  type OperationsContext,
  type ReturnClaim,
} from "../operations";

export function Returns() {
  const { state, update, role, branch, t, lang } = useDemo();
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: demoUsers.find((user) => user.role === role)?.name ?? "Demo user",
  };
  const suppliers = [
    ...new Set([
      ...state.returns
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.supplier),
      ...state.products
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.main_supplier),
    ]),
  ];
  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
  const [history, setHistory] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<"pickup" | "resolve" | "cancel">("pickup");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [representative, setRepresentative] = useState("");
  const [slip, setSlip] = useState("");
  const [photo, setPhoto] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("replacement_received");
  const [replacement, setReplacement] = useState("");
  const [replacementQty, setReplacementQty] = useState("1");
  const [date, setDate] = useState(() => companyDate(state.config));
  const [fully, setFully] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>(
    {},
  );
  const [safe, setSafe] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [retainSettlement, setRetainSettlement] = useState(false);
  const returns = scopedRecords(state.returns, context).filter(
    (record) =>
      record.supplier === supplier &&
      (history ||
        (record.status !== "cancelled" && record.status !== "resolved")),
  ) as OperationalReturn[];
  const productName = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return product ? (lang === "fa" ? product.name_fa : product.name_en) : code;
  };
  const statusLabel = (status: string) =>
    ({
      open: t("Open", "باز"),
      picked_up: t("Picked up", "جمع‌آوری‌شده"),
      partially_resolved: t("Partially resolved", "تا حدی حل‌شده"),
      resolved: t("Resolved", "حل‌شده"),
      cancelled: t("Cancelled", "لغوشده"),
      cancellation_review: t("Needs review", "نیازمند بررسی"),
      claim_pending: t("Pending", "در انتظار"),
    })[status] ?? t("Open", "باز");
  const run = (action: (draft: typeof state) => void, message: string) => {
    try {
      update(action);
      setError("");
      setFeedback(message);
    } catch (caught) {
      setError(
        operationError(caught instanceof Error ? caught.message : "", t),
      );
      setFeedback("");
    }
  };
  const counts = (record: OperationalReturn) =>
    Object.fromEntries(
      record.lines.map((line) => [
        line.product_code,
        Number(quantities[line.product_code] ?? "0"),
      ]),
    );
  const openPanel = (record: OperationalReturn, nextPanel: typeof panel) => {
    setActive(record.id);
    setPanel(nextPanel);
    setQuantities({});
    setRepresentative("");
    setSlip("");
    setPhoto("");
    setNote("");
    setAmount("");
    setInvoiceId("");
    setDispositions({});
    setSafe(false);
    setVerified(false);
    setFully(false);
    setReplacement(record.lines[0]?.product_code ?? "");
    setError("");
    setFeedback("");
  };
  const loadPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };
  const eligibleInvoices = state.ledger.filter(
    (row) =>
      row.company_id === context.company_id &&
      row.branch === branch &&
      row.supplier === supplier &&
      row.type === "invoice",
  );
  if (!role || role === "cashier")
    return (
      <EmptyState>
        {t(
          "Cashiers can only use price lookup.",
          "صندوق‌دار فقط می‌تواند قیمت را جستجو کند.",
        )}
      </EmptyState>
    );
  return (
    <>
      <PageHeader
        title={t("Returns", "مرجوعی‌ها")}
        description={t(
          "Supplier returns and credits. Record what actually happened; keep every receipt.",
          "مرجوعی و بستانکاری تأمین‌کننده. رویداد واقعی را ثبت و همه رسیدها را نگهداری کنید.",
        )}
      />
      {branch === "all" && (
        <div className="banner info">
          {t(
            "All branches are visible. Choose one branch before recording a pickup or settlement.",
            "همه شعب نمایش داده می‌شوند. برای ثبت جمع‌آوری یا تسویه یک شعبه انتخاب کنید.",
          )}
        </div>
      )}
      <Card>
        <div className="form-grid">
          <Field label={t("Supplier", "تأمین‌کننده")}>
            <select
              value={supplier}
              onChange={(event) => {
                setSupplier(event.target.value);
                setActive(null);
              }}
            >
              {suppliers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("View", "نمایش")}>
            <select
              value={history ? "history" : "open"}
              onChange={(event) => setHistory(event.target.value === "history")}
            >
              <option value="open">
                {t("Open returns", "مرجوعی‌های باز")}
              </option>
              <option value="history">
                {t("All returns and history", "همه مرجوعی‌ها و سوابق")}
              </option>
            </select>
          </Field>
        </div>
      </Card>
      <details className="card">
        <summary>
          {t(
            "Staff return checklist and supplier terms",
            "چک‌لیست کارکنان و شرایط تأمین‌کننده",
          )}
        </summary>
        <p>
          {t(
            "Supplier terms have not been supplied for this demo. Ask the Supervisor to obtain written terms; do not assume pickup promises a credit.",
            "شرایط تأمین‌کننده در این نمایش ارائه نشده است. از سرپرست شرایط کتبی بخواهید؛ جمع‌آوری به معنی وعده بستانکاری نیست.",
          )}
        </p>
        <ol>
          <li>
            {t(
              "Count originals, record condition and location, and keep damaged goods off the sales floor.",
              "اصل کالاها را بشمارید، وضعیت و محل را ثبت و کالای آسیب‌دیده را از فروش خارج کنید.",
            )}
          </li>
          <li>
            {t(
              "Check actual pickup quantities with the representative. Obtain a signed paper slip before handing over goods.",
              "تعداد واقعی را با نماینده بررسی کنید. پیش از تحویل، رسید کاغذی امضاشده بگیرید.",
            )}
          </li>
          <li>
            {t(
              "Retain the signed original and record its reference. A pickup does not require a new invoice.",
              "اصل امضاشده را نگهداری و مرجع آن را ثبت کنید. جمع‌آوری به فاکتور جدید نیاز ندارد.",
            )}
          </li>
          <li>
            {t(
              "Workers submit claims and evidence; Supervisors verify and post money. Replacements add only received stock.",
              "کارکنان ادعا و مدرک ارسال می‌کنند؛ سرپرست پول را تأیید و ثبت می‌کند. جایگزین فقط به موجودی دریافتی اضافه می‌شود.",
            )}
          </li>
          <li>
            {t(
              "Cancellation never restores supplier-held or unsafe goods, and never automatically reverses compensation.",
              "لغو هرگز کالای نزد تأمین‌کننده یا ناسالم را به موجودی بازنمی‌گرداند و جبران را خودکار معکوس نمی‌کند.",
            )}
          </li>
        </ol>
        <Button
          variant="secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([policySource], { type: "text/markdown;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "return-policy.md";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("Download the full return policy", "دریافت سیاست کامل مرجوعی")}
        </Button>
      </details>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {feedback && (
        <div className="banner approved" role="status">
          {feedback}
        </div>
      )}
      {returns.length === 0 && (
        <EmptyState>
          {t(
            "No open returns for this supplier in the selected branch. Choose another supplier or view history.",
            "برای این تأمین‌کننده در شعبه انتخاب‌شده مرجوعی بازی وجود ندارد. تأمین‌کننده دیگری یا سوابق را انتخاب کنید.",
          )}
        </EmptyState>
      )}
      {returns.map((record) => (
        <Card key={record.id} title={`${record.supplier} · ${record.branch}`}>
          <div className="row-between">
            <span className="muted">{record.id}</span>
            <Badge
              tone={
                record.status === "cancelled"
                  ? "neutral"
                  : record.status === "resolved"
                    ? "approved"
                    : "pending"
              }
            >
              {statusLabel(record.status)}
            </Badge>
          </div>
          {record.lines.map((line) => (
            <div key={line.product_code} className="return-line">
              <strong>{productName(line.product_code)}</strong>
              <p>
                {t("Original units set aside", "تعداد اصلی کنارگذاشته‌شده")}:{" "}
                <b dir="ltr">{line.qty}</b> · {t("Picked up", "جمع‌آوری‌شده")}:{" "}
                <span dir="ltr">
                  {line.picked_up ??
                    (record.replacement_received ? line.qty : 0)}
                </span>{" "}
                · {t("Settled", "تسویه‌شده")}:{" "}
                <span dir="ltr">
                  {line.settled ??
                    line.replaced ??
                    record.replacement_received?.covers_original_qty ??
                    0}
                </span>{" "}
                ·{" "}
                {t("Originals safely recovered", "اصل کالای سالم بازیابی‌شده")}:{" "}
                <span dir="ltr">
                  {record.recovered?.[line.product_code] ??
                    record.original_units_recovered}
                </span>
              </p>
              <p className="muted">
                {t("Reason", "دلیل")}:{" "}
                {line.reason === "Leaking"
                  ? t("Leaking", "نشتی")
                  : line.reason === "Torn bag"
                    ? t("Torn bag", "کیسه پاره")
                    : line.reason}{" "}
                {line.location &&
                  `· ${t("Location", "محل")}: ${line.location === "Walk-in cooler" ? t("Walk-in cooler", "سردخانه") : line.location}`}
              </p>
            </div>
          ))}
          {record.replacement_received && (
            <div className="banner info">
              {t("Replacement received", "جایگزین دریافت‌شده")}:{" "}
              {productName(record.replacement_received.product_code)} ×{" "}
              <span dir="ltr">{record.replacement_received.qty}</span>.{" "}
              {t(
                "No amount was added to Payables.",
                "هیچ مبلغی به پرداختنی‌ها اضافه نشده است.",
              )}
            </div>
          )}
          {record.cancellation_demo_note && (
            <p className="muted">
              {t(
                "Two originals remain with the supplier; one replacement was received. Cancellation restores zero supplier-held units and needs Supervisor review.",
                "دو اصل کالا نزد تأمین‌کننده است؛ یک جایگزین دریافت شده است. لغو هیچ کالایی از نزد تأمین‌کننده به موجودی بازنمی‌گرداند و نیازمند بررسی سرپرست است.",
              )}
            </p>
          )}
          {record.signed_pickup_slip_reference && (
            <p>
              {t("Signed pickup slip", "رسید جمع‌آوری امضاشده")}:{" "}
              <span dir="ltr">{record.signed_pickup_slip_reference}</span> ·{" "}
              {record.supplier_rep_name}
            </p>
          )}
          {record.status !== "cancelled" &&
            record.status !== "cancellation_review" && (
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() => openPanel(record, "pickup")}
                >
                  {t("Record pickup", "ثبت جمع‌آوری")}
                </Button>
                <Button onClick={() => openPanel(record, "resolve")}>
                  {t("Record resolution", "ثبت حل‌وفصل")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => openPanel(record, "cancel")}
                >
                  {record.replacement_received ||
                  record.lines.some(
                    (line) => (line.settled ?? line.replaced ?? 0) > 0,
                  )
                    ? t("Request cancellation", "درخواست لغو")
                    : t("Cancel return", "لغو مرجوعی")}
                </Button>
              </div>
            )}
          {active === record.id &&
            record.status !== "cancelled" &&
            record.status !== "cancellation_review" && (
              <section className="form-section">
                <h3>
                  {panel === "pickup"
                    ? t("Record actual pickup", "ثبت جمع‌آوری واقعی")
                    : panel === "resolve"
                      ? t("Record resolution", "ثبت حل‌وفصل")
                      : t(
                          "Actual original-stock disposition",
                          "وضعیت واقعی اصل کالا",
                        )}
                </h3>
                {panel === "resolve" && (
                  <Field label={t("Resolution type", "نوع حل‌وفصل")}>
                    <select
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                    >
                      <option value="replacement_received">
                        {t(
                          "Replacement product received",
                          "کالای جایگزین دریافت‌شده",
                        )}
                      </option>
                      <option value="credit_current_invoice">
                        {t(
                          "Credit on current invoice",
                          "بستانکاری فاکتور جاری",
                        )}
                      </option>
                      <option value="credit_later_invoice">
                        {t(
                          "Credit on a later invoice",
                          "بستانکاری فاکتور بعدی",
                        )}
                      </option>
                      <option value="cash_or_other">
                        {t("Cash or other compensation", "نقد یا جبران دیگر")}
                      </option>
                      {role === "supervisor" && (
                        <option value="no_compensation">
                          {t("No compensation", "بدون جبران")}
                        </option>
                      )}
                    </select>
                  </Field>
                )}
                <div className="form-grid">
                  {record.lines.map((line) => (
                    <div key={line.product_code}>
                      <Field
                        label={`${productName(line.product_code)} · ${panel === "pickup" ? t("Actual pickup units", "تعداد واقعی جمع‌آوری") : panel === "cancel" ? t("Actual safe originals recovered (zero is valid)", "اصل کالای سالم واقعاً بازیابی‌شده (صفر مجاز است)") : t("Original units this settlement covers", "تعداد اصلی تحت پوشش این تسویه")}`}
                      >
                        <input
                          type="number"
                          min="0"
                          max={line.qty}
                          step="1"
                          value={quantities[line.product_code] ?? "0"}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [line.product_code]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      {panel === "cancel" && (
                        <Field label={t("Actual disposition", "وضعیت واقعی")}>
                          <select
                            value={dispositions[line.product_code] ?? ""}
                            onChange={(event) =>
                              setDispositions((current) => ({
                                ...current,
                                [line.product_code]: event.target
                                  .value as Disposition,
                              }))
                            }
                          >
                            <option value="">
                              {t("Choose disposition", "انتخاب وضعیت")}
                            </option>
                            <option value="supplier_held">
                              {t(
                                "Supplier still holds originals — restore zero",
                                "اصل کالا نزد تأمین‌کننده است — بازیابی صفر",
                              )}
                            </option>
                            <option value="unsafe_on_site">
                              {t(
                                "Damaged or unsafe on site — restore zero",
                                "کالای آسیب‌دیده یا ناسالم در محل — بازیابی صفر",
                              )}
                            </option>
                            <option value="recovered_sellable">
                              {t(
                                "Originals physically recovered and safe to sell",
                                "اصل کالا واقعاً بازیابی‌شده و سالم برای فروش",
                              )}
                            </option>
                          </select>
                        </Field>
                      )}
                    </div>
                  ))}
                </div>
                {panel === "pickup" ||
                (panel === "resolve" &&
                  resolution === "replacement_received") ? (
                  <div className="form-grid">
                    <Field
                      label={t(
                        "Supplier representative name",
                        "نام نماینده تأمین‌کننده",
                      )}
                    >
                      <input
                        value={representative}
                        onChange={(event) =>
                          setRepresentative(event.target.value)
                        }
                        placeholder={t(
                          "Type the fictional representative name",
                          "نام ساختگی نماینده را وارد کنید",
                        )}
                      />
                    </Field>
                    <Field
                      label={
                        panel === "pickup"
                          ? t(
                              "Fictional signed paper pickup slip reference",
                              "مرجع ساختگی رسید کاغذی امضاشده جمع‌آوری",
                            )
                          : t(
                              "Fictional replacement receipt reference",
                              "مرجع ساختگی رسید جایگزین",
                            )
                      }
                    >
                      <input
                        value={slip}
                        onChange={(event) => setSlip(event.target.value)}
                        placeholder={
                          panel === "pickup"
                            ? "DEMO-SIGNED-SLIP-001"
                            : "DEMO-REPLACEMENT-001"
                        }
                      />
                    </Field>
                    <Field label={t("Optional item photo", "عکس اختیاری کالا")}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => loadPhoto(event.target.files?.[0])}
                      />
                    </Field>
                    {photo && (
                      <img
                        className="evidence-photo"
                        src={photo}
                        alt={t(
                          "Local demo evidence photo",
                          "عکس مدرک محلی نمایش",
                        )}
                      />
                    )}
                  </div>
                ) : null}
                {panel === "resolve" &&
                  resolution === "replacement_received" && (
                    <div className="form-grid">
                      <Field
                        label={t(
                          "Replacement product actually received",
                          "کالای جایگزین واقعاً دریافت‌شده",
                        )}
                      >
                        <select
                          value={replacement}
                          onChange={(event) =>
                            setReplacement(event.target.value)
                          }
                        >
                          {state.products
                            .filter(
                              (item) =>
                                item.company_id === context.company_id &&
                                item.status === "active",
                            )
                            .map((product) => (
                              <option key={product.code} value={product.code}>
                                {productName(product.code)}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field
                        label={t(
                          "Actual replacement quantity",
                          "تعداد واقعی جایگزین",
                        )}
                      >
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={replacementQty}
                          onChange={(event) =>
                            setReplacementQty(event.target.value)
                          }
                        />
                      </Field>
                      <Field label={t("Received date", "تاریخ دریافت")}>
                        <input
                          type="date"
                          value={date}
                          onChange={(event) => setDate(event.target.value)}
                        />
                      </Field>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={fully}
                          onChange={(event) => setFully(event.target.checked)}
                        />
                        {t(
                          "Fully resolves the original return (otherwise partial)",
                          "مرجوعی اصلی را کامل حل می‌کند (در غیر این صورت جزئی)",
                        )}
                      </label>
                    </div>
                  )}
                {panel === "resolve" &&
                  resolution !== "replacement_received" && (
                    <>
                      <p className="banner info">
                        {t(
                          "Workers submit evidence and covered quantities. Only a Supervisor verifies and posts financial amounts.",
                          "کارکنان مدرک و تعداد پوشش‌داده‌شده ارسال می‌کنند. فقط سرپرست مبالغ مالی را تأیید و ثبت می‌کند.",
                        )}
                      </p>
                      {resolution !== "no_compensation" && (
                        <Field
                          label={t(
                            "Fictional supplier credit or compensation document reference",
                            "مرجع ساختگی سند بستانکاری یا جبران تأمین‌کننده",
                          )}
                        >
                          <input
                            value={slip}
                            onChange={(event) => setSlip(event.target.value)}
                            placeholder="DEMO-CREDIT-001"
                          />
                        </Field>
                      )}
                      {resolution.startsWith("credit_") && (
                        <Field
                          label={t(
                            "One posted invoice to credit",
                            "یک فاکتور ثبت‌شده برای بستانکاری",
                          )}
                        >
                          <select
                            value={invoiceId}
                            onChange={(event) =>
                              setInvoiceId(event.target.value)
                            }
                          >
                            <option value="">
                              {t("Choose an invoice", "انتخاب فاکتور")}
                            </option>
                            {eligibleInvoices.map((row) => (
                              <option
                                key={row.id}
                                value={row.invoice_id ?? row.id}
                              >
                                {row.reference}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </>
                  )}
                <Field
                  label={
                    panel === "cancel"
                      ? t("Cancellation reason (required)", "دلیل لغو (ضروری)")
                      : resolution === "no_compensation"
                        ? t(
                            "Reason for no compensation (required)",
                            "دلیل بدون جبران (ضروری)",
                          )
                        : t("Optional note", "یادداشت اختیاری")
                  }
                >
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                {panel === "cancel" && (
                  <>
                    <div className="banner info">
                      {t(
                        "Leave recovered quantity at zero for supplier-held or unsafe goods. Existing replacements and credits are preserved for Supervisor review.",
                        "برای کالای نزد تأمین‌کننده یا ناسالم، تعداد بازیابی را صفر نگه دارید. جایگزین‌ها و بستانکاری‌های قبلی برای بررسی سرپرست حفظ می‌شوند.",
                      )}
                    </div>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={safe}
                        onChange={(event) => setSafe(event.target.checked)}
                      />
                      {t(
                        "I inspected these physically recovered originals and confirm they are safe and sellable.",
                        "اصل کالاهای واقعاً بازیابی‌شده را بررسی و سالم و قابل‌فروش بودن آن‌ها را تأیید می‌کنم.",
                      )}
                    </label>
                  </>
                )}
                <p className="muted">
                  {t("Recorded by", "ثبت‌کننده")}: {context.actor} · {branch}
                </p>
                <div className="actions">
                  <Button
                    disabled={branch === "all"}
                    onClick={() => {
                      if (panel === "pickup")
                        run(
                          (draft) =>
                            recordPickup(draft, context, record.id, {
                              quantities: counts(record),
                              representative,
                              slip,
                              photo,
                              note,
                            }),
                          t(
                            "Recorded pickup. No stock was deducted again.",
                            "جمع‌آوری ثبت شد. موجودی دوباره کاهش نیافت.",
                          ),
                        );
                      else if (panel === "cancel")
                        run(
                          (draft) =>
                            cancelReturn(draft, context, record.id, {
                              reason: note,
                              dispositions,
                              recovered: counts(record),
                              safe,
                            }),
                          t(
                            "Recorded cancellation disposition. Existing compensation remains unchanged.",
                            "وضعیت لغو ثبت شد. جبران قبلی بدون تغییر باقی ماند.",
                          ),
                        );
                      else if (resolution === "replacement_received")
                        run(
                          (draft) =>
                            receiveReplacement(draft, context, record.id, {
                              product_code: replacement,
                              qty: Number(replacementQty),
                              covers: counts(record),
                              date,
                              representative,
                              note,
                              photo,
                              receipt: slip,
                              fully,
                            }),
                          t(
                            "Received replacement. Stock increased; Payables did not change.",
                            "جایگزین دریافت شد. موجودی افزایش یافت؛ پرداختنی‌ها تغییر نکرد.",
                          ),
                        );
                      else
                        run(
                          (draft) =>
                            submitFinancialClaim(draft, context, record.id, {
                              type: resolution as ReturnClaim["type"],
                              covers: counts(record),
                              document: slip,
                              invoice_id: invoiceId,
                              reason: note,
                            }),
                          t(
                            "Submitted claim for Supervisor verification.",
                            "ادعا برای تأیید سرپرست ارسال شد.",
                          ),
                        );
                    }}
                  >
                    {panel === "pickup"
                      ? t("Record pickup", "ثبت جمع‌آوری")
                      : panel === "cancel"
                        ? t("Record cancellation disposition", "ثبت وضعیت لغو")
                        : resolution === "replacement_received"
                          ? t("Receive replacement", "دریافت جایگزین")
                          : t("Submit claim", "ارسال ادعا")}
                  </Button>
                  <Button variant="secondary" onClick={() => setActive(null)}>
                    {t("Close", "بستن")}
                  </Button>
                </div>
              </section>
            )}
          {(record.claims ?? []).map((claim) => (
            <div key={claim.id} className="form-section">
              <div className="row-between">
                <strong>
                  {claim.type.startsWith("credit_")
                    ? t("Credit claim", "ادعای بستانکاری")
                    : claim.type === "cash_or_other"
                      ? t("Compensation claim", "ادعای جبران")
                      : t("No compensation claim", "ادعای بدون جبران")}
                </strong>
                <Badge
                  tone={claim.status === "posted" ? "approved" : "pending"}
                >
                  {claim.status === "posted"
                    ? t("Posted", "ثبت‌شده")
                    : t("Pending", "در انتظار")}
                </Badge>
              </div>
              <p>
                {t("Evidence", "مدرک")}: {claim.document || claim.reason} ·{" "}
                {t("Submitted by", "ارسال‌کننده")}: {claim.submitted_by}
              </p>
              {role === "supervisor" && claim.status === "submitted" && (
                <>
                  <Field
                    label={t(
                      "Verified financial amount (Supervisor only)",
                      "مبلغ مالی تأییدشده (فقط سرپرست)",
                    )}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      disabled={claim.type === "no_compensation"}
                    />
                  </Field>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={verified}
                      onChange={(event) => setVerified(event.target.checked)}
                    />
                    {t(
                      "I verified the document, covered quantities, and invoice allocation.",
                      "سند، تعداد پوشش‌داده‌شده و تخصیص فاکتور را تأیید کردم.",
                    )}
                  </label>
                  <Button
                    disabled={!verified || branch === "all"}
                    onClick={() =>
                      run(
                        (draft) =>
                          postReturnClaim(
                            draft,
                            context,
                            record.id,
                            claim.id,
                            amount,
                          ),
                        t(
                          "Verified and posted claim once.",
                          "ادعا تأیید و یک‌بار ثبت شد.",
                        ),
                      )
                    }
                  >
                    {t("Verify and post claim", "تأیید و ثبت ادعا")}
                  </Button>
                </>
              )}
            </div>
          ))}
          {record.status === "cancellation_review" && (
            <div className="form-section">
              <div className="banner pending">
                {t(
                  "Supervisor review required. Originals held by the supplier restore zero stock. Existing settlement has not been reversed.",
                  "بررسی سرپرست ضروری است. اصل کالا نزد تأمین‌کننده هیچ موجودی بازنمی‌گرداند. تسویه قبلی معکوس نشده است.",
                )}
              </div>
              {role === "supervisor" && (
                <>
                  <Field
                    label={t(
                      "Settlement review and reason",
                      "بررسی تسویه و دلیل",
                    )}
                  >
                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </Field>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={retainSettlement}
                      onChange={(event) =>
                        setRetainSettlement(event.target.checked)
                      }
                    />
                    {t(
                      "I reviewed the history. Existing replacement or compensation is retained; no reversal is needed.",
                      "سابقه را بررسی کردم. جایگزین یا جبران قبلی حفظ می‌شود؛ معکوس‌سازی لازم نیست.",
                    )}
                  </label>
                  <div className="actions">
                    <Button
                      disabled={branch === "all"}
                      onClick={() =>
                        run(
                          (draft) =>
                            reviewCancellation(draft, context, record.id, {
                              accept: true,
                              settlement_retained: retainSettlement,
                              note: reviewNote,
                            }),
                          t(
                            "Approved cancellation; retained existing settlement.",
                            "لغو تأیید شد؛ تسویه قبلی حفظ شد.",
                          ),
                        )
                      }
                    >
                      {t("Approve cancellation", "تأیید لغو")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={branch === "all"}
                      onClick={() =>
                        run(
                          (draft) =>
                            reviewCancellation(draft, context, record.id, {
                              accept: false,
                              settlement_retained: false,
                              note: reviewNote,
                            }),
                          t(
                            "Declined cancellation; preserved return history.",
                            "لغو رد شد؛ سابقه مرجوعی حفظ شد.",
                          ),
                        )
                      }
                    >
                      {t("Decline cancellation", "رد لغو")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          <details>
            <summary>
              {t("Preserved evidence and history", "مدارک و سوابق حفظ‌شده")}
            </summary>
            {(record.evidence ?? []).length === 0 ? (
              <p className="muted">
                {t(
                  "No additional events yet. Seed pickup evidence is shown above.",
                  "رویداد دیگری ثبت نشده است. مدرک جمع‌آوری نمونه در بالا نمایش داده می‌شود.",
                )}
              </p>
            ) : (
              (record.evidence ?? []).map((event) => (
                <div className="history-row" key={event.id}>
                  <strong>
                    {event.kind === "pickup"
                      ? t("Recorded pickup", "جمع‌آوری ثبت‌شده")
                      : event.kind === "replacement"
                        ? t("Received replacement", "جایگزین دریافت‌شده")
                        : event.kind === "original_recovery"
                          ? t(
                              "Received safe original goods",
                              "اصل کالای سالم دریافت شد",
                            )
                          : event.kind.startsWith("cancellation")
                            ? t("Cancellation review", "بررسی لغو")
                            : t("Resolution claim", "ادعای حل‌وفصل")}
                  </strong>
                  <p dir="ltr">
                    {companyTimestamp(state.config, event.at)} · {event.by} ·{" "}
                    {event.document}
                  </p>
                  {event.note && <p>{event.note}</p>}
                  {event.photo && (
                    <img
                      className="evidence-photo"
                      src={event.photo}
                      alt={t(
                        "Retained local evidence photo",
                        "عکس مدرک محلی حفظ‌شده",
                      )}
                    />
                  )}
                </div>
              ))
            )}
          </details>
        </Card>
      ))}
    </>
  );
}
export default Returns;
