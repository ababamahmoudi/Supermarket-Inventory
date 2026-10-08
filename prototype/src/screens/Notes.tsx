import { useState } from "react";
import { demoUsers, useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  Tabs,
} from "../ui";
import {
  branchLabel,
  demoUserLabel,
  LtrText,
  ProductName,
} from "../presentation";
import {
  addNote,
  operationError,
  companyTimestamp,
  scopedRecords,
  updateNoteStatus,
  type OperationsContext,
} from "../operations";
import type { NoteRecord } from "../types";

export function Notes() {
  const { state, update, branch, role, lang, t } = useDemo();
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: demoUsers.find((user) => user.role === role)?.name ?? "Demo user",
  };
  const [tab, setTab] = useState<NoteRecord["type"]>("to_order");
  const [text, setText] = useState("");
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const allNotes = scopedRecords(state.notes, context);
  const unread = allNotes.filter(
    (item) => item.type === "note_to_supervisor" && item.status === "open",
  ).length;
  const tabs: { key: NoteRecord["type"]; label: string }[] = [
    { key: "to_order", label: t("To order", "برای سفارش") },
    { key: "store_use", label: t("Store use", "مصرف فروشگاه") },
    { key: "note_to_supervisor", label: t("For Supervisor", "برای سرپرست") },
  ];
  const notes = allNotes.filter(
    (item) =>
      item.type === tab &&
      (showDone || item.status !== "resolved") &&
      (!search ||
        `${item.text} ${item.by} ${item.product_code ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const run = (action: (draft: typeof state) => void, feedback: string) => {
    try {
      update(action);
      setMessage(feedback);
      setError("");
    } catch (caught) {
      setError(
        operationError(caught instanceof Error ? caught.message : "", t),
      );
    }
  };
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
        title={t("Notes", "یادداشت‌ها")}
        description={t(
          "To order, store use, and messages for the Supervisor — recorded with author, branch, and time.",
          "سفارش، مصرف فروشگاه و پیام برای سرپرست — ثبت‌شده با نویسنده، شعبه و زمان.",
        )}
      />
      <Tabs
        value={tab}
        aria-label={t("Notebooks", "دفترچه‌ها")}
        onChange={(value) => {
          setTab(value as NoteRecord["type"]);
          setMessage("");
          setError("");
        }}
        options={tabs.map((item) => ({
          value: item.key,
          label: item.label,
          count:
            item.key === "note_to_supervisor" &&
            role === "supervisor" &&
            unread > 0
              ? unread
              : undefined,
        }))}
      />
      <Card title={t("Add note", "افزودن یادداشت")} className="form-card">
        <div className="form-grid">
          <Field label={t("Note", "یادداشت")}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t(
                "What should the team know?",
                "تیم باید چه چیزی بداند؟",
              )}
            />
          </Field>
          <Field
            label={
              tab === "store_use"
                ? t("Product (required for stock)", "محصول (برای موجودی ضروری)")
                : t("Product (optional)", "محصول (اختیاری)")
            }
          >
            <Select
              value={product}
              onChange={setProduct}
              options={[
                { value: "", label: t("Choose product", "انتخاب محصول") },
                ...state.products
                  .filter(
                    (item) =>
                      item.company_id === context.company_id &&
                      item.status === "active",
                  )
                  .map((item) => ({
                    value: item.code,
                    label: lang === "fa" ? item.name_fa : item.name_en,
                  })),
              ]}
            />
          </Field>
          <Field
            className="field-short"
            label={
              tab === "store_use"
                ? t(
                    "Actual quantity used (required)",
                    "تعداد واقعی مصرف‌شده (ضروری)",
                  )
                : t("Quantity (optional)", "تعداد (اختیاری)")
            }
          >
            <NumberField min="1" step="1" value={qty} onChange={setQty} />
          </Field>
        </div>
        {tab === "store_use" && (
          <p className="banner info">
            {t(
              "Saving store use deducts this actual quantity from estimated sellable stock once. It does not change Payables.",
              "ذخیره مصرف فروشگاه این تعداد واقعی را یک‌بار از موجودی قابل‌فروش تخمینی کم می‌کند. پرداختنی‌ها تغییر نمی‌کنند.",
            )}
          </p>
        )}
        <div className="actions">
          <Button
            disabled={branch === "all"}
            onClick={() => {
              try {
                update((draft) =>
                  addNote(draft, context, {
                    type: tab,
                    text,
                    product_code: product || undefined,
                    qty: qty ? Number(qty) : undefined,
                  }),
                );
                setText("");
                setQty("");
                setProduct("");
                setMessage(t("Saved note.", "یادداشت ذخیره شد."));
                setError("");
              } catch (caught) {
                setError(
                  operationError(
                    caught instanceof Error ? caught.message : "",
                    t,
                  ),
                );
              }
            }}
          >
            {t("Save note", "ذخیره یادداشت")}
          </Button>
        </div>
        {branch === "all" && (
          <p>
            {t(
              "Choose one branch before adding or updating a note.",
              "پیش از افزودن یا تغییر یادداشت، یک شعبه انتخاب کنید.",
            )}
          </p>
        )}
      </Card>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="banner approved" role="status">
          {message}
        </div>
      )}
      <FilterToolbar count={`${notes.length} ${t("notes", "یادداشت")}`}>
        <Field label={t("Search notes", "جستجوی یادداشت‌ها")}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
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
      {notes.length === 0 && (
        <EmptyState>
          {t(
            "No notes match these filters. Add a note above.",
            "هیچ یادداشتی با این فیلترها مطابق نیست. از بالا یادداشت اضافه کنید.",
          )}
        </EmptyState>
      )}
      {notes.map((item) => (
        <Card key={item.id}>
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
                item.status === "resolved"
                  ? "approved"
                  : item.status === "read"
                    ? "info"
                    : "pending"
              }
            >
              {item.status === "resolved"
                ? tab === "to_order"
                  ? t("Ordered", "سفارش‌داده‌شده")
                  : t("Done", "انجام‌شده")
                : item.status === "read"
                  ? t("Seen", "دیده‌شده")
                  : t("Open", "باز")}
            </Badge>
          </div>
          <p className="muted">
            {demoUserLabel(item.by, lang)} · {branchLabel(item.branch, lang)} ·{" "}
            <LtrText>{companyTimestamp(state.config, item.created_at)}</LtrText>
          </p>
          {item.product_code && (
            <p>
              {(() => {
                const linkedProduct = state.products.find(
                  (productItem) =>
                    productItem.code === item.product_code &&
                    productItem.company_id === context.company_id,
                );
                return linkedProduct ? (
                  <ProductName product={linkedProduct} language={lang} />
                ) : (
                  <LtrText>{item.product_code}</LtrText>
                );
              })()}
              {item.qty ? <LtrText>× {item.qty}</LtrText> : null}
            </p>
          )}
          <div className="actions">
            {item.status === "open" &&
              tab === "note_to_supervisor" &&
              role === "supervisor" && (
                <Button
                  variant="secondary"
                  disabled={branch === "all"}
                  onClick={() =>
                    run(
                      (draft) =>
                        updateNoteStatus(draft, context, item.id, "read"),
                      t("Marked seen.", "دیده‌شده علامت‌گذاری شد."),
                    )
                  }
                >
                  {t("Mark seen", "علامت دیده‌شده")}
                </Button>
              )}
            {item.status !== "resolved" &&
              (tab !== "note_to_supervisor" || role === "supervisor") && (
                <Button
                  variant="secondary"
                  disabled={branch === "all"}
                  onClick={() =>
                    run(
                      (draft) =>
                        updateNoteStatus(draft, context, item.id, "resolved"),
                      tab === "to_order"
                        ? t("Marked ordered.", "سفارش‌داده‌شده علامت‌گذاری شد.")
                        : t("Marked done.", "انجام‌شده علامت‌گذاری شد."),
                    )
                  }
                >
                  {tab === "to_order"
                    ? t("Mark ordered", "علامت سفارش‌داده‌شده")
                    : t("Mark done", "علامت انجام‌شده")}
                </Button>
              )}
          </div>
        </Card>
      ))}
    </>
  );
}
export default Notes;
