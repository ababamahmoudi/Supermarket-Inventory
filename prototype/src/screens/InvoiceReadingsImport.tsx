import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  DialogActions,
  Field,
  SegmentedControl,
  Select,
} from "../ui";
import { useDemo } from "../store";
import { useSettingsConfiguration } from "../settings-configuration";
import { branchLabel, configuredBranches } from "../settings";
import { DateText, LtrValue, NotAdded } from "../presentation";
import { useProtectedQuery } from "../use-protected-query";
import { beginAppWork } from "../app-work";
import { readInvoiceReadingsFile } from "../invoice-readings-file";
import {
  importInvoiceReadings,
  prepareInvoiceReadingPages,
  previewInvoiceReadings,
  selectInvoiceReading,
  type ImportMode,
  type ImportSummary,
  type InvoiceReadingsExport,
} from "../invoice-readings";
import { removeFictionalData } from "../empty-store";
import "./invoice-readings.css";

type Translate = (en: string, fa: string) => string;
function importError(error: unknown, t: Translate): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.message
        : "invalid_file";
  if (/permission|actor|company/.test(code))
    return t(
      "Only an Owner or Manager can import invoice readings for this company.",
      "فقط مالک یا مدیر می‌تواند خوانش فاکتور را برای این شرکت وارد کند.",
    );
  if (/version/.test(code))
    return t(
      "This invoice-readings file uses an unsupported version. Export it again with version 1.",
      "نسخهٔ این فایل خوانش فاکتور پشتیبانی نمی‌شود. آن را با نسخهٔ ۱ دوباره صادر کنید.",
    );
  if (/schema/.test(code))
    return t(
      "This file does not use the invoice-reading-v2 reading schema.",
      "این فایل از ساختار خوانش invoice-reading-v2 استفاده نمی‌کند.",
    );
  if (/json|syntax/.test(code))
    return t(
      "This file is not valid JSON. Choose the JSON export from the invoice-reader kit.",
      "این فایل JSON معتبر نیست. خروجی JSON ابزار خواندن فاکتور را انتخاب کنید.",
    );
  if (code === "pages")
    return t(
      "An invoice page or its original SHA-256 is missing or damaged. Export the file again from the invoice-reader kit.",
      "یکی از صفحات فاکتور یا SHA-256 اصل آن وجود ندارد یا آسیب دیده است. فایل را دوباره از ابزار خواندن فاکتور صادر کنید.",
    );
  if (code === "invalid_number")
    return t(
      "This file contains an invalid quantity or amount. Check the export and try again.",
      "این فایل مقدار یا مبلغ نامعتبری دارد. خروجی را بررسی و دوباره تلاش کنید.",
    );
  if (/storage|quota|file_read_failed/.test(code))
    return t(
      "The file could not be read or saved. Check available browser storage and try again.",
      "خواندن یا ذخیرهٔ فایل ممکن نشد. فضای ذخیره‌سازی مرورگر را بررسی و دوباره تلاش کنید.",
    );
  return t(
    "This isn't an invoice-readings file from the invoice-reader kit. Choose a valid JSON export.",
    "این فایل خوانش فاکتور از ابزار خواندن فاکتور نیست. یک خروجی JSON معتبر انتخاب کنید.",
  );
}
function skippedReason(reason: string, t: Translate): string {
  if (reason === "invoice_number")
    return t(
      "This supplier already has that invoice number in the app.",
      "این شمارهٔ فاکتور برای این تأمین‌کننده از قبل در برنامه است.",
    );
  if (reason === "page_sha256")
    return t(
      "An original page with the same SHA-256 is already in the app.",
      "یک صفحهٔ اصل با همین SHA-256 از قبل در برنامه است.",
    );
  if (reason === "missing_reading")
    return t(
      "This invoice has no usable AI or checked reading.",
      "این فاکتور خوانش هوش مصنوعی یا خوانش بررسی‌شدهٔ قابل استفاده ندارد.",
    );
  if (reason === "not_selected")
    return t("You left this invoice unticked.", "این فاکتور را انتخاب نکردید.");
  return t("The invoice could not be imported.", "ورود این فاکتور ممکن نشد.");
}

function ImportPreview({
  exported,
  fileName,
  onClose,
  onImported,
}: {
  exported: InvoiceReadingsExport;
  fileName: string;
  onClose(): void;
  onImported(summary: ImportSummary): void;
}) {
  const { state, branch, command, lang, t, money } = useDemo();
  const config = useSettingsConfiguration();
  const [mode, setMode] = useState<ImportMode>("ai");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const preview = useProtectedQuery(
    "settings.manage",
    scope,
    (canonical, actor) =>
      previewInvoiceReadings(canonical, actor, exported, mode, branch),
    `${fileName}:${exported.exported_at}:${mode}:${branch}`,
  );
  const rows = preview.data ?? [];
  const eligible = rows.filter((row) => !row.duplicate_reason && !row.error);
  const selection =
    selected ?? eligible.filter((row) => row.recommended).map((row) => row.id);
  const selectedRows = eligible.filter((row) => selection.includes(row.id));
  const locationWidth = Math.max(
    180,
    ...configuredBranches(config).map(
      (value) => branchLabel(config, value, lang).length * 9 + 56,
    ),
  );
  const missingLocation = selectedRows.filter(
    (row) => !(locations[row.id] ?? row.location),
  );
  const hasImportSelection =
    selectedRows.length > 0 || (rows.length > 0 && eligible.length === 0);
  const importSelected = async () => {
    if (busy || !hasImportSelection || missingLocation.length) return;
    setBusy(true);
    setError("");
    const release = beginAppWork();
    try {
      const selectedIds = selectedRows.map((row) => row.id);
      const pages = await prepareInvoiceReadingPages(
        exported,
        selectedIds,
        scope.company_id,
      );
      const result = await command(
        "settings.manage",
        { ...scope, mutation: true },
        (canonical, actor) =>
          importInvoiceReadings(canonical, actor, {
            exported,
            fileName,
            mode,
            currentLocation: branch,
            locations: Object.fromEntries(
              selectedRows.map((row) => [
                row.id,
                locations[row.id] ?? row.location ?? "",
              ]),
            ),
            selectedIds,
            pages,
          }),
      );
      const skipped = new Map(result.skipped.map((row) => [row.id, row]));
      for (const row of rows) {
        if (row.duplicate_reason || row.error)
          skipped.set(row.id, {
            id: row.id,
            reason: row.duplicate_reason ?? row.error!,
          });
      }
      onImported({ ...result, skipped: [...skipped.values()] });
    } catch (failure) {
      setError(importError(failure, t));
    } finally {
      release();
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={t("Import invoice readings", "ورود خوانش فاکتورها")}
      description={<LtrValue value={fileName} />}
      className="invoice-readings-dialog dialog-wide dialog-phone-fullscreen"
    >
      <div className="invoice-readings-mode">
        <span>{t("Use:", "استفاده از:")}</span>
        <SegmentedControl
          aria-label={t("Reading values", "مقادیر خوانش")}
          value={mode}
          onChange={(value) => {
            setMode(value as ImportMode);
            setSelected(null);
          }}
          options={[
            {
              value: "ai",
              label: t("AI reading", "خوانش هوش مصنوعی"),
              disabled: busy,
            },
            {
              value: "checked",
              label: t("My checked values", "مقادیر بررسی‌شدهٔ من"),
              disabled: busy,
            },
          ]}
        />
      </div>
      {preview.pending && (
        <p role="status">{t("Preparing preview…", "آماده‌سازی پیش‌نمایش…")}</p>
      )}
      {preview.error ? (
        <p role="alert" className="form-error">
          {importError(preview.error, t)}
        </p>
      ) : (
        <DataTable
          className="invoice-readings-table"
          columns={[
            {
              key: "selected",
              label: t("Import", "ورود"),
              required: true,
              fixedWidth: true,
              width: 64,
            },
            {
              key: "page",
              label: t("Page 1", "صفحهٔ ۱"),
              required: true,
              fixedWidth: true,
              width: 88,
            },
            {
              key: "supplier",
              label: t("Supplier", "تأمین‌کننده"),
              required: true,
            },
            {
              key: "number",
              label: t("Invoice number", "شمارهٔ فاکتور"),
              priority: 2,
              minWidth: 140,
            },
            {
              key: "date",
              label: t("Invoice date", "تاریخ فاکتور"),
              priority: 5,
              align: "end",
              minWidth: 128,
            },
            {
              key: "location",
              label: t("Location", "مکان"),
              priority: 2,
              minWidth: locationWidth,
            },
            {
              key: "lines",
              label: t("Lines", "ردیف‌ها"),
              required: true,
              fixedWidth: true,
              width: 64,
              align: "end",
            },
            {
              key: "total",
              label: t("Total", "جمع کل"),
              priority: 3,
              align: "end",
              minWidth: 100,
            },
            {
              key: "checks",
              label: t("Review", "بررسی"),
              priority: 4,
              minWidth: 160,
            },
            { key: "status", label: t("Status", "وضعیت"), priority: 1 },
          ]}
          phoneList={{
            name: "supplier",
            value: "status",
            selection: "selected",
            secondary: [
              "number",
              "page",
              "date",
              "location",
              "lines",
              "total",
              "checks",
            ],
          }}
        >
          <thead>
            <tr>
              <th>{t("Import", "ورود")}</th>
              <th>{t("Page 1", "صفحهٔ ۱")}</th>
              <th>{t("Supplier", "تأمین‌کننده")}</th>
              <th>{t("Invoice number", "شمارهٔ فاکتور")}</th>
              <th>{t("Invoice date", "تاریخ فاکتور")}</th>
              <th>{t("Location", "مکان")}</th>
              <th>{t("Lines", "ردیف‌ها")}</th>
              <th>{t("Total", "جمع کل")}</th>
              <th>{t("Review", "بررسی")}</th>
              <th>{t("Status", "وضعیت")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const disabled = Boolean(row.duplicate_reason || row.error);
              const original = exported.invoices.find(
                (invoice) => invoice.id === row.id,
              );
              const firstPage = original?.pages[0];
              const number = row.invoice_number || row.id;
              const location = locations[row.id] ?? row.location ?? "";
              return (
                <tr key={row.id} data-import-id={row.id}>
                  <td>
                    <Checkbox
                      checked={!disabled && selection.includes(row.id)}
                      disabled={disabled || busy}
                      aria-label={`${t("Import", "ورود")} ${number}`}
                      onChange={(checked) =>
                        setSelected((current) =>
                          selectInvoiceReading(
                            rows,
                            current ?? selection,
                            row.id,
                            checked,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    {firstPage ? (
                      <img
                        className="invoice-reading-thumbnail"
                        src={`data:${firstPage.mime};base64,${firstPage.data}`}
                        alt={`${t("Page 1 of", "صفحهٔ ۱ از")} ${number}`}
                      />
                    ) : (
                      <NotAdded />
                    )}
                  </td>
                  <td>
                    <LtrValue value={row.supplier} />
                  </td>
                  <td>
                    <LtrValue value={row.invoice_number} />
                  </td>
                  <td>
                    {row.invoice_date ? (
                      <DateText value={row.invoice_date} />
                    ) : (
                      <NotAdded />
                    )}
                  </td>
                  <td>
                    <Select
                      value={location}
                      aria-label={`${t("Location for", "مکان برای")} ${number}`}
                      aria-invalid={
                        !disabled && selection.includes(row.id) && !location
                      }
                      disabled={disabled || busy}
                      options={[
                        {
                          value: "",
                          label: t(
                            "Choose a location…",
                            "یک مکان انتخاب کنید…",
                          ),
                        },
                        ...configuredBranches(config).map((value) => ({
                          value,
                          label: branchLabel(config, value, lang),
                        })),
                      ]}
                      onChange={(value) =>
                        setLocations((current) => ({
                          ...current,
                          [row.id]: value,
                        }))
                      }
                    />
                  </td>
                  <td>{row.line_count}</td>
                  <td>{row.total ? money(row.total) : <NotAdded />}</td>
                  <td>
                    <div className="invoice-reading-badges">
                      {row.checked && (
                        <Badge tone="approved">
                          {t("Checked by you", "بررسی‌شده توسط شما")}
                        </Badge>
                      )}
                      {row.check_count > 0 && (
                        <Badge tone="pending">
                          {t(
                            `${row.check_count} to check`,
                            `${row.check_count} مورد برای بررسی`,
                          )}
                        </Badge>
                      )}
                      {mode === "checked" && !row.using_checked && (
                        <span className="muted">
                          {t(
                            "Uses AI reading; no checked values",
                            "خوانش هوش مصنوعی؛ مقادیر بررسی‌شده ندارد",
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {row.duplicate_reason ? (
                      <Badge>
                        {t("Already in the app", "از قبل در برنامه است")}
                      </Badge>
                    ) : row.in_file_duplicate_group ? (
                      <Badge tone="pending">
                        {t(
                          "Same invoice twice in this file",
                          "همین فاکتور دو بار در این فایل است",
                        )}
                      </Badge>
                    ) : row.error ? (
                      <Badge tone="danger">
                        {t("No usable reading", "خوانش قابل استفاده ندارد")}
                      </Badge>
                    ) : !location ? (
                      <Badge tone="pending">
                        {t("Choose a location", "یک مکان انتخاب کنید")}
                      </Badge>
                    ) : (
                      <Badge>{t("Ready", "آماده")}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
      {missingLocation.length > 0 && (
        <p role="status">
          {t(
            `${missingLocation.length} invoices need a location before import.`,
            `${missingLocation.length} فاکتور پیش از ورود به انتخاب مکان نیاز دارند.`,
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {busy && (
        <p role="status">
          {t(
            "Saving invoice originals and drafts…",
            "ذخیرهٔ اصل فاکتورها و پیش‌نویس‌ها…",
          )}
        </p>
      )}
      <DialogActions>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t("Cancel", "انصراف")}
        </Button>
        <Button
          disabled={
            busy ||
            preview.pending ||
            !hasImportSelection ||
            missingLocation.length > 0
          }
          onClick={() => void importSelected()}
        >
          {t(
            `Import ${selectedRows.length} invoices`,
            `ورود ${selectedRows.length} فاکتور`,
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function InvoiceReadingsImport() {
  const { state, command, can, role, t, navigate, setBranch } = useDemo();
  const input = useRef<HTMLInputElement>(null);
  const reader = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [exported, setExported] = useState<InvoiceReadingsExport | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [emptyConfirmation, setEmptyConfirmation] = useState("");
  const [removing, setRemoving] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState("");
  useEffect(() => () => reader.current?.abort(), []);
  if (!can("settings.manage") || (role !== "owner" && role !== "manager"))
    return null;
  const readFile = async (file: File) => {
    reader.current?.abort();
    const controller = new AbortController();
    reader.current = controller;
    setError("");
    setSummary(null);
    setReading(true);
    const release = beginAppWork();
    try {
      const parsed = await readInvoiceReadingsFile(file, controller.signal);
      if (!controller.signal.aborted) {
        setFileName(file.name);
        setExported(parsed);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(importError(failure, t));
    } finally {
      release();
      if (!controller.signal.aborted) setReading(false);
    }
  };
  const remove = async () => {
    setRemoving(true);
    setError("");
    try {
      await command(
        "settings.manage",
        {
          company_id: state.config.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (canonical, actor) => removeFictionalData(canonical, actor),
      );
      setEmptyOpen(false);
      setEmptyMessage(
        t(
          "Fictional business data removed. Your store is ready for invoice readings.",
          "داده‌های کسب‌وکار خیالی حذف شد. فروشگاه شما برای ورود خوانش فاکتورها آماده است.",
        ),
      );
    } catch (failure) {
      setError(importError(failure, t));
    } finally {
      setRemoving(false);
    }
  };
  return (
    <>
      <Card
        title={t("Import invoice readings", "ورود خوانش فاکتورها")}
        className="settings-form-card"
      >
        <p>
          {t(
            "Bring in invoices read by the invoice-reader kit. Each one becomes a draft in Invoices for you to check and post.",
            "فاکتورهای خوانده‌شده با ابزار خواندن فاکتور را وارد کنید. هر کدام به پیش‌نویسی در فاکتورها تبدیل می‌شود تا بررسی و ثبت کنید.",
          )}
        </p>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label={t("Choose file…", "انتخاب فایل…")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readFile(file);
          }}
        />
        <Button disabled={reading} onClick={() => input.current?.click()}>
          {t("Choose file…", "انتخاب فایل…")}
        </Button>
        {reading && (
          <p role="status" aria-live="polite">
            {t("Reading file…", "در حال خواندن فایل…")}
          </p>
        )}
      </Card>
      <Card
        title={t("Start with an empty store", "شروع با فروشگاه خالی")}
        className="settings-form-card"
      >
        <p>
          {t(
            "Remove the fictional demo business data and keep your settings, locations, people and pricing rules.",
            "داده‌های کسب‌وکار خیالی دمو را حذف و تنظیمات، مکان‌ها، کارکنان و قواعد قیمت‌گذاری را حفظ کنید.",
          )}
        </p>
        <Button
          variant="danger"
          onClick={() => {
            setError("");
            setEmptyConfirmation("");
            setEmptyOpen(true);
          }}
        >
          {t("Remove fictional data…", "حذف داده‌های خیالی…")}
        </Button>
        {emptyMessage && <p role="status">{emptyMessage}</p>}
      </Card>
      <a className="entity-link" href="#history">
        {t("History", "تاریخچه")}
      </a>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {exported && (
        <ImportPreview
          exported={exported}
          fileName={fileName}
          onClose={() => setExported(null)}
          onImported={(result) => {
            setSummary(result);
            setExported(null);
          }}
        />
      )}
      {summary && (
        <Dialog
          open
          onOpenChange={(open) => !open && setSummary(null)}
          title={t("Import complete", "ورود کامل شد")}
        >
          <dl className="detail-grid">
            <div>
              <dt>{t("Imported", "واردشده")}</dt>
              <dd>{summary.imported.length}</dd>
            </div>
            <div>
              <dt>{t("Skipped", "ردشده")}</dt>
              <dd>{summary.skipped.length}</dd>
            </div>
            <div>
              <dt>{t("New suppliers", "تأمین‌کنندگان جدید")}</dt>
              <dd>{summary.new_suppliers.length}</dd>
            </div>
            <div>
              <dt>
                {t("Invoices needing a location", "فاکتورهای نیازمند مکان")}
              </dt>
              <dd>{summary.needs_location.length}</dd>
            </div>
          </dl>
          {summary.skipped.length > 0 && (
            <ul className="invoice-reading-summary">
              {summary.skipped.map((item, index) => (
                <li className="list-box" key={`${item.id}:${index}`}>
                  <LtrValue value={item.id} /> · {t("Skipped", "ردشده")}:{" "}
                  {skippedReason(item.reason, t)}
                </li>
              ))}
            </ul>
          )}
          {summary.new_suppliers.length > 0 && (
            <p>
              {t(
                "New suppliers are active. Contact details can be completed later.",
                "تأمین‌کنندگان جدید فعال هستند. اطلاعات تماس را می‌توان بعداً تکمیل کرد.",
              )}
            </p>
          )}
          {(summary.other_locations ?? 0) > 0 && (
            <p>
              {t(
                `${summary.other_locations} more are at other locations`,
                `${summary.other_locations} مورد دیگر در مکان‌های دیگر هستند`,
              )}{" "}
              <Button
                variant="secondary"
                onClick={async () => {
                  await setBranch("all");
                  setSummary(null);
                  navigate("invoices?tab=needs_review");
                }}
              >
                {t("All my locations", "همهٔ مکان‌های من")}
              </Button>
            </p>
          )}
          <DialogActions>
            <Button
              onClick={() => {
                setSummary(null);
                navigate("invoices?tab=needs_review");
              }}
            >
              {t("Open Needs review", "باز کردن نیازمند بررسی")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog
        open={emptyOpen}
        onOpenChange={(open) => !removing && setEmptyOpen(open)}
        title={t("Start with an empty store", "شروع با فروشگاه خالی")}
      >
        <p>
          {t(
            "Keep company settings, locations, people and sign-in, roles, pricing rules and categories, label templates, notification settings and modules.",
            "تنظیمات شرکت، مکان‌ها، کارکنان و ورود، نقش‌ها، قواعد و دسته‌های قیمت‌گذاری، قالب برچسب، تنظیمات اعلان و بخش‌ها حفظ می‌شوند.",
          )}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p>
          {t(
            "Remove fictional products, suppliers, supplier items, invoices, received records, offers, sales and sale requests, returns, orders, branch requests, payables, notes and notebook entries, tracked dates, price updates, alerts, the label waitlist and their History. This also removes invoices you imported.",
            "محصولات، تأمین‌کنندگان، اقلام تأمین‌کنندگان، فاکتورها، دریافت‌ها، پیشنهادها، حراج‌ها و درخواست‌های حراج، مرجوعی‌ها، سفارش‌ها، درخواست‌های شعب، حساب‌های پرداختنی، یادداشت‌ها و نوشته‌های دفترچه‌ها، تاریخ‌های پیگیری، به‌روزرسانی قیمت‌ها، هشدارها، صف برچسب و تاریخچهٔ آن‌ها حذف می‌شوند. فاکتورهایی که وارد کرده‌اید نیز حذف می‌شوند.",
          )}
        </p>
        <Field label={t("Type DELETE to confirm", "برای تأیید حذف را بنویسید")}>
          <input
            value={emptyConfirmation}
            onChange={(event) => setEmptyConfirmation(event.target.value)}
            autoComplete="off"
          />
        </Field>
        <DialogActions>
          <Button
            variant="secondary"
            disabled={removing}
            onClick={() => setEmptyOpen(false)}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            variant="danger"
            disabled={
              removing || !["DELETE", "حذف"].includes(emptyConfirmation.trim())
            }
            onClick={() => void remove()}
          >
            {t("Remove fictional data", "حذف داده‌های خیالی")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
