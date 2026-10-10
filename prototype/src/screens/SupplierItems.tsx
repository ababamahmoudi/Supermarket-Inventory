import { useState } from "react";
import { useListState } from "../navigation";
import { useDemo } from "../store";
import {
  saveSupplierItem,
  supplierItems,
  SupplierItemError,
  type SupplierItemRow,
} from "../supplier-items";
import type { OperationsContext } from "../operations";
import { branchLabel } from "../settings";
import {
  DateText,
  LtrText,
  Money,
  ProductName,
  UnitSize,
} from "../presentation";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  FilterToolbar,
  Select,
} from "../ui";
import "./manual-entry.css";
import "./supplier-items.css";

export default function SupplierItems({
  supplier,
  editable,
}: {
  supplier: string;
  editable: boolean;
}) {
  const { state, role, branch, user, lang, t, update, navigate } = useDemo();
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    role: role ?? "cashier",
    branch,
    actor: user?.name ?? "",
  };
  const supervisor = role === "supervisor";
  const rows = supplierItems(state, context, supplier);
  const [query, setQuery] = useListState(
    `supplier-items.${supplier}.search`,
    "",
  );
  const [editor, setEditor] = useState<"new" | SupplierItemRow | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const visible = rows.filter((row) =>
    [row.name_en, row.name_fa, row.product_code, row.supplier_item_code]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase().trim()),
  );
  const history = supervisor
    ? rows.find((row) => row.id === historyId)
    : undefined;
  const money = (value: string | null) =>
    value === null ? (
      <span className="muted">—</span>
    ) : (
      <Money
        className="money"
        value={value}
        currency={state.config.company.currency}
      />
    );
  const pack = (units: number) => (
    <span className="supplier-item-pack">
      {t("Case of", "کارتنِ")} <LtrText>{units}</LtrText>
    </span>
  );
  return (
    <>
      <FilterToolbar
        className="supplier-items-toolbar"
        search={
          <input
            aria-label={t(
              "Search supplier items",
              "جستجوی کالاهای تأمین‌کننده",
            )}
            placeholder={t(
              "Search product or supplier code",
              "جستجوی کالا یا کد تأمین‌کننده",
            )}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      >
        {query && (
          <Button variant="ghost" onClick={() => setQuery("")}>
            {t("Clear filters", "پاک کردن فیلترها")}
          </Button>
        )}
        <span className="muted supplier-item-count">
          <LtrText>{visible.length}</LtrText> {t("items", "کالا")}
        </span>
        {supervisor && editable && (
          <Button onClick={() => setEditor("new")}>
            {t("Add item", "افزودن کالا")}
          </Button>
        )}
      </FilterToolbar>
      {visible.length ? (
        <DataTable
          className={`supplier-items-table ${supervisor ? "supervisor" : "worker"}`}
          columns={[
            { width: "240px" },
            { width: "130px" },
            { width: "110px" },
            ...(supervisor
              ? [
                  { width: "145px", align: "end" as const },
                  { width: "145px", align: "end" as const },
                ]
              : []),
            { width: "160px" },
            { width: "160px" },
            ...(supervisor ? [{ width: "150px", actions: true }] : []),
          ]}
        >
          <thead>
            <tr>
              <th>{t("Product", "کالا")}</th>
              <th>{t("Supplier code", "کد تأمین‌کننده")}</th>
              <th>{t("Pack", "بسته")}</th>
              {supervisor && (
                <>
                  <th className="numeric">
                    {t("Last bought / case", "آخرین خرید / کارتن")}
                  </th>
                  <th className="numeric">
                    {t("Last bought / unit", "آخرین خرید / واحد")}
                  </th>
                </>
              )}
              <th>{t("Date last bought", "تاریخ آخرین خرید")}</th>
              <th>{t("Last invoice", "آخرین فاکتور")}</th>
              {supervisor && <th>{t("Actions", "عملیات")}</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className={supervisor ? "supplier-item-history-row" : undefined}
                tabIndex={supervisor ? 0 : undefined}
                onClick={supervisor ? () => setHistoryId(row.id) : undefined}
                onKeyDown={
                  supervisor
                    ? (event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          setHistoryId(row.id);
                        }
                      }
                    : undefined
                }
              >
                <td>
                  <a
                    href={`#product?code=${encodeURIComponent(row.product_code)}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ProductName
                      product={row}
                      language={row.name_fa ? lang : "en"}
                    />
                  </a>
                  <small className="muted supplier-secondary">
                    <LtrText>{row.product_code}</LtrText>
                    {row.unit_size && (
                      <>
                        {" "}
                        · <UnitSize value={row.unit_size} />
                      </>
                    )}
                  </small>
                </td>
                <td>
                  <LtrText>{row.supplier_item_code || "—"}</LtrText>
                </td>
                <td>{pack(row.units_per_case)}</td>
                {row.financial && (
                  <>
                    <td className="numeric">
                      {money(row.financial.last_bought_case_cost)}
                      {row.financial.last_bought_units_per_case !== null &&
                        row.financial.last_bought_units_per_case !==
                          row.units_per_case && (
                          <small className="muted supplier-secondary">
                            {pack(row.financial.last_bought_units_per_case)}
                          </small>
                        )}
                    </td>
                    <td className="numeric">
                      {money(row.financial.last_bought_unit_cost)}
                    </td>
                  </>
                )}
                <td>
                  <DateText value={row.last_bought_date} />
                </td>
                <td>
                  {row.last_invoice_id ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(
                          `invoices?id=${encodeURIComponent(row.last_invoice_id!)}`,
                        );
                      }}
                    >
                      <LtrText>
                        {row.last_invoice_number || row.last_invoice_id}
                      </LtrText>
                    </Button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {supervisor && (
                  <td>
                    <div className="actions supplier-item-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setHistoryId(row.id);
                        }}
                      >
                        {t("History", "تاریخچه")}
                      </Button>
                      {editable && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditor(row);
                          }}
                        >
                          {t("Edit", "ویرایش")}
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState>
          {query
            ? t(
                "No supplier items match your search.",
                "کالایی از تأمین‌کننده با جستجوی شما مطابقت ندارد.",
              )
            : t(
                "No supplier items yet.",
                "هنوز کالایی برای تأمین‌کننده ثبت نشده است.",
              )}
        </EmptyState>
      )}
      {history?.financial && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setHistoryId(null);
          }}
          title={t("Price history", "تاریخچه قیمت")}
          className="supplier-item-history-dialog"
        >
          <div className="stack">
            <ProductName
              product={history}
              language={history.name_fa ? lang : "en"}
            />
            <p className="muted">{t("Before tax", "پیش از مالیات")}</p>
            {history.financial.quoted_unit_cost_before_tax !== undefined && (
              <div className="supplier-item-quote">
                <span>
                  {t("Expected unit cost", "هزینه مورد انتظار واحد")}:{" "}
                  {money(history.financial.quoted_unit_cost_before_tax)}
                </span>
                <small className="muted">
                  {t("Quoted", "قیمت اعلام‌شده")} ·{" "}
                  <bdi dir="auto">{history.financial.quoted_by}</bdi> ·{" "}
                  <DateText value={history.financial.quoted_at} />
                </small>
              </div>
            )}
            {history.financial.history.length ? (
              <DataTable
                className="supplier-item-price-history"
                columns={[
                  { width: "120px" },
                  { width: "120px" },
                  { width: "130px" },
                  { width: "100px" },
                  { width: "145px", align: "end" },
                  { width: "145px", align: "end" },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Date", "تاریخ")}</th>
                    <th>{t("Invoice", "فاکتور")}</th>
                    <th>{t("Location", "مکان")}</th>
                    <th>{t("Pack", "بسته")}</th>
                    <th className="numeric">{t("Case cost", "هزینه کارتن")}</th>
                    <th className="numeric">{t("Unit cost", "هزینه واحد")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.financial.history.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>
                        <DateText value={purchase.date} />
                        {purchase.short_dated && (
                          <Badge tone="pending">
                            {t("Short-dated", "نزدیک به انقضا")}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `invoices?id=${encodeURIComponent(purchase.invoice_id)}`,
                            )
                          }
                        >
                          <LtrText>{purchase.invoice_number}</LtrText>
                        </Button>
                      </td>
                      <td>
                        <span>
                          {branchLabel(state.config, purchase.branch, lang)}
                        </span>
                      </td>
                      <td>{pack(purchase.units_per_case)}</td>
                      <td className="numeric">
                        {money(purchase.case_cost_before_tax)}
                      </td>
                      <td className="numeric">
                        {money(purchase.unit_cost_before_tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState>
                {t(
                  "No purchase history yet.",
                  "هنوز سابقه خریدی ثبت نشده است.",
                )}
              </EmptyState>
            )}
            <div className="actions">
              <Button variant="secondary" onClick={() => setHistoryId(null)}>
                {t("Close", "بستن")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      {supervisor && editor && (
        <SupplierItemEditor
          key={editor === "new" ? "new" : editor.id}
          supplier={supplier}
          item={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={(values) =>
            update((draft) =>
              saveSupplierItem(
                draft,
                context,
                supplier,
                values,
                editor === "new" ? undefined : editor.id,
              ),
            )
          }
        />
      )}
    </>
  );
}

function SupplierItemEditor({
  supplier,
  item,
  onClose,
  onSave,
}: {
  supplier: string;
  item?: SupplierItemRow;
  onClose: () => void;
  onSave: (edits: Parameters<typeof saveSupplierItem>[3]) => void;
}) {
  const { state, lang, t } = useDemo();
  const [product, setProduct] = useState(item?.product_code ?? "");
  const [code, setCode] = useState(item?.supplier_item_code ?? "");
  const [pack, setPack] = useState(String(item?.units_per_case ?? 1));
  const [quote, setQuote] = useState(
    item?.financial?.quoted_unit_cost_before_tax ?? "",
  );
  const [error, setError] = useState<SupplierItemError["code"] | null>(null);
  const errors: Record<SupplierItemError["code"], string> = {
    permission: t(
      "Only a Supervisor can save supplier items.",
      "فقط سرپرست می‌تواند کالاهای تأمین‌کننده را ذخیره کند.",
    ),
    scope: t("Choose an allowed location.", "یک مکان مجاز انتخاب کنید."),
    supplier: t(
      "Choose an active confirmed supplier.",
      "یک تأمین‌کننده فعال و تأییدشده انتخاب کنید.",
    ),
    product: t("Choose a product.", "یک کالا انتخاب کنید."),
    pack: t(
      "Enter a positive whole number of units per case.",
      "تعداد صحیح و مثبت واحدها در هر کارتن را وارد کنید.",
    ),
    quantity: t(
      "Enter a quantity that converts to positive whole units.",
      "تعدادی وارد کنید که به واحدهای صحیح و مثبت تبدیل شود.",
    ),
    cost: t(
      "Enter a cost with at most four decimals or leave it blank.",
      "هزینه را با حداکثر چهار رقم اعشار وارد کنید یا خالی بگذارید.",
    ),
    duplicate: t(
      "This product and supplier code already have an item.",
      "برای این کالا و کد تأمین‌کننده، یک مورد ثبت شده است.",
    ),
    not_found: t("Supplier item not found.", "کالای تأمین‌کننده پیدا نشد."),
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        item ? t("Edit item", "ویرایش کالا") : t("Add item", "افزودن کالا")
      }
      description={<LtrText>{supplier}</LtrText>}
      className="manual-entry-dialog supplier-item-editor"
    >
      <form
        className="stack manual-entry-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          try {
            onSave({
              product_code: product,
              supplier_item_code: code,
              units_per_case: /^\d+$/.test(pack) ? Number(pack) : NaN,
              quoted_unit_cost_before_tax: quote,
            });
            onClose();
          } catch (cause) {
            setError(cause instanceof SupplierItemError ? cause.code : "scope");
          }
        }}
      >
        <Field
          label={t("Product", "کالا")}
          error={error === "product" ? errors.product : undefined}
        >
          <Select
            value={product}
            onChange={(value) => {
              setProduct(value);
              if (error === "product") setError(null);
            }}
            searchable
            options={[
              { value: "", label: t("Choose a product", "انتخاب کالا") },
              ...state.products
                .filter(
                  (record) =>
                    record.company_id === state.config.company.seed_key &&
                    record.status !== "archived",
                )
                .map((record) => ({
                  value: record.code,
                  label: `${record.code} · ${lang === "fa" ? record.name_fa : record.name_en}`,
                })),
            ]}
          />
        </Field>
        <Field label={t("Supplier code", "کد تأمین‌کننده")}>
          <input
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <div className="supplier-item-editor-values">
          <Field
            label={t("Units per case", "واحد در هر کارتن")}
            error={error === "pack" ? errors.pack : undefined}
          >
            <input
              className="supplier-item-narrow"
              dir="ltr"
              inputMode="numeric"
              value={pack}
              onChange={(event) => {
                setPack(event.target.value);
                if (error === "pack" || error === "quantity") setError(null);
              }}
            />
          </Field>
          <Field
            label={t("Expected unit cost", "هزینه مورد انتظار واحد")}
            error={error === "cost" ? errors.cost : undefined}
          >
            <input
              className="supplier-item-narrow"
              dir="ltr"
              inputMode="decimal"
              value={quote}
              onChange={(event) => {
                setQuote(event.target.value);
                if (error === "cost") setError(null);
              }}
            />
          </Field>
        </div>
        <p className="muted">
          {t(
            "Expected unit cost is a quote, not a purchase price.",
            "هزینه مورد انتظار واحد، قیمت اعلام‌شده است و قیمت خرید نیست.",
          )}
        </p>
        {error && !["product", "pack", "cost"].includes(error) && (
          <p role="alert" className="problem-text">
            {errors[error]}
          </p>
        )}
        <div className="actions">
          <Button type="submit">
            {item ? t("Save item", "ذخیره کالا") : t("Add item", "افزودن کالا")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel", "لغو")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
