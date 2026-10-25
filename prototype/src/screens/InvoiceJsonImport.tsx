import { useEffect, useRef, useState, type RefObject } from "react";
import { FileJson } from "lucide-react";
import { beginAppWork } from "../app-work";
import { readInvoiceReadingsFile } from "../invoice-readings-file";
import type { InvoiceReadingsExport } from "../invoice-readings";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import { Button, Dialog } from "../ui";
import { InvoiceReadingsPreview } from "./InvoiceReadingsImport";
import { invoiceReadingsImportError } from "../invoice-readings-import-copy";

/** File choice and navigation only; preview, originals and writes use the shared importer. */
export function InvoiceJsonImport({
  inputRef,
  disabled,
  onChosen,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onChosen(): void;
}) {
  const { state, can, t, navigate, setBranch } = useDemo();
  const reader = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [file, setFile] = useState<{
    name: string;
    exported: InvoiceReadingsExport;
  } | null>(null);
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState(false);
  useEffect(() => () => reader.current?.abort(), []);
  const configuration = useProtectedQuery(
    file && can("settings.manage") ? "settings.manage" : null,
    { company_id: state.config.company.seed_key, kind: "company_shared" },
    (canonical) => structuredClone(canonical.config),
    "invoice-json-entry",
  );
  const displayedError =
    error ||
    (file && configuration.error
      ? t(
          "The import could not be opened. Close it and try again.",
          "باز کردن ورود ممکن نشد. آن را ببندید و دوباره تلاش کنید.",
        )
      : "");
  if (!can("settings.manage")) return null;
  async function read(file: File) {
    onChosen();
    reader.current?.abort();
    const controller = new AbortController();
    reader.current = controller;
    setReading(true);
    setError("");
    setEmpty(false);
    const release = beginAppWork();
    try {
      const exported = await readInvoiceReadingsFile(file, controller.signal);
      if (!controller.signal.aborted) setFile({ name: file.name, exported });
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(invoiceReadingsImportError(failure, t));
    } finally {
      release();
      if (!controller.signal.aborted) setReading(false);
    }
  }
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label={t("JSON file", "فایل JSON")}
        disabled={disabled || reading}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (selected) void read(selected);
        }}
      />
      {(reading || error || empty || (file && !configuration.data)) && (
        <Dialog
          open
          title={t("JSON file", "فایل JSON")}
          description={t(
            "Add invoice readings. Existing records are kept.",
            "خوانش فاکتورها را اضافه کنید. داده‌های موجود حفظ می‌شوند.",
          )}
          icon={<FileJson size={20} />}
          onOpenChange={(open) => {
            if (!open) {
              reader.current?.abort();
              setReading(false);
              setError("");
              setEmpty(false);
              setFile(null);
            }
          }}
          footer={
            <Button
              variant="secondary"
              onClick={() => {
                reader.current?.abort();
                setReading(false);
                setError("");
                setEmpty(false);
                setFile(null);
              }}
            >
              {t("Close", "بستن")}
            </Button>
          }
        >
          {displayedError ? (
            <p role="alert" className="form-error">
              {displayedError}
            </p>
          ) : empty ? (
            <p role="status">
              {t(
                "No new invoices were imported. Existing invoices were kept.",
                "فاکتور جدیدی وارد نشد. فاکتورهای موجود حفظ شدند.",
              )}
            </p>
          ) : (
            <p role="status">{t("Reading file…", "در حال خواندن فایل…")}</p>
          )}
        </Dialog>
      )}
      {file && configuration.data && (
        <InvoiceReadingsPreview
          configuration={configuration.data}
          exported={file.exported}
          fileName={file.name}
          onClose={() => setFile(null)}
          onImported={(result) => {
            setFile(null);
            if (!result.imported.length) {
              setEmpty(true);
              return;
            }
            if (result.other_locations) setBranch("all");
            navigate(
              result.imported.length === 1
                ? `invoices?id=${encodeURIComponent(result.imported[0])}`
                : "invoices?tab=needs_review",
            );
          }}
        />
      )}
    </>
  );
}
