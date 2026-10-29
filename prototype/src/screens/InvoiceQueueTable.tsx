import { useDemo } from "../store";
import type { InvoiceReadDTO } from "../invoice-projections";
import { DataTable, Button } from "../ui";
import { DateText, LtrText, LtrValue, NotAdded } from "../presentation";
import { ReadingMoney } from "../InvoiceReadingReview";
import { effectiveInvoiceLocation } from "../received";
import { branchLabel as configuredBranchLabel } from "../settings";
import { useLiveReadingActivity } from "../live-reading-activity";

function LiveQueueProgress({ invoice }: { invoice: InvoiceReadDTO }) {
  const { t } = useDemo();
  const reading = useLiveReadingActivity(invoice);
  return reading.active ? (
    <span>
      {t("Reading with AI…", "در حال خواندن با هوش مصنوعی…")}{" "}
      <bdi>{reading.elapsed}</bdi>
    </span>
  ) : (
    <span>
      {t("Original saved · ready to read", "اصل فایل ذخیره شد · آمادهٔ خواندن")}
    </span>
  );
}

export function InvoiceQueueTable({
  invoices,
  onOpen,
}: {
  invoices: readonly InvoiceReadDTO[];
  onOpen?(invoice: InvoiceReadDTO): void | Promise<void>;
}) {
  const { state, branch, t, lang, navigate } = useDemo();
  const unreadOriginal = (invoice: InvoiceReadDTO) =>
    invoice.status === "empty" && invoice.original_available;
  const open =
    onOpen ??
    ((invoice: InvoiceReadDTO) =>
      navigate(`invoices?id=${encodeURIComponent(invoice.id)}`));
  return (
    <DataTable
      className="invoice-saved-table"
      columns={[
        {
          key: "invoice",
          label: t("Invoice", "فاکتور"),
          required: true,
          priority: 1,
          minWidth: 240,
        },
        {
          key: "supplier",
          label: t("Supplier", "تأمین‌کننده"),
          priority: 2,
          minWidth: 150,
        },
        ...(branch === "all"
          ? [
              {
                key: "location",
                label: t("Location", "مکان"),
                priority: 4,
                minWidth: 130,
              },
            ]
          : []),
        {
          key: "date",
          label: t("Invoice date", "تاریخ فاکتور"),
          priority: 4,
          minWidth: 120,
        },
        {
          key: "total",
          label: t("Total", "جمع"),
          align: "end",
          priority: 2,
          minWidth: 95,
        },
        {
          key: "lines",
          label: t("Lines", "ردیف‌ها"),
          align: "end",
          priority: 3,
          minWidth: 60,
        },
        {
          key: "progress",
          label: t("Progress", "پیشرفت"),
          priority: 3,
          minWidth: 190,
        },
        {
          key: "action",
          label: t("Action", "عملیات"),
          actions: true,
          required: true,
          priority: 0,
          minWidth: 90,
        },
      ]}
      phoneList={{
        name: "invoice",
        value: "total",
        secondary: [
          "supplier",
          ...(branch === "all" ? ["location"] : []),
          "date",
          "progress",
        ],
      }}
    >
      <thead>
        <tr>
          <th scope="col">{t("Invoice", "فاکتور")}</th>
          <th scope="col">{t("Supplier", "تأمین‌کننده")}</th>
          {branch === "all" && <th scope="col">{t("Location", "مکان")}</th>}
          <th scope="col">{t("Invoice date", "تاریخ فاکتور")}</th>
          <th scope="col">{t("Total", "جمع")}</th>
          <th scope="col">{t("Lines", "ردیف‌ها")}</th>
          <th scope="col">{t("Progress", "پیشرفت")}</th>
          <th scope="col">{t("Action", "عملیات")}</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((saved) => {
          const confirmed = saved.lines.filter(
            (line) => line.review_confirmed,
          ).length;
          const checks =
            (saved.low_confidence_fields?.length ?? 0) +
            saved.lines.reduce(
              (sum, line) => sum + (line.low_confidence_fields?.length ?? 0),
              0,
            ) +
            (saved.other_charges ?? []).reduce(
              (sum, charge) =>
                sum + (charge.low_confidence_fields?.length ?? 0),
              0,
            );
          const href = `#invoices?id=${encodeURIComponent(saved.id)}`;
          const reviewAction = saved.status === "review";
          return (
            <tr key={saved.id} data-row-href={href}>
              <td>
                <a className="entity-link" href={href}>
                  <LtrText className="invoice-draft-reference">
                    {saved.supplier_invoice_number || t("Draft", "پیش‌نویس")}
                  </LtrText>
                </a>
              </td>
              <td>
                {saved.supplier ? (
                  <a
                    className="entity-link"
                    href={`#suppliers?name=${encodeURIComponent(saved.supplier)}`}
                  >
                    <LtrValue value={saved.supplier} />
                  </a>
                ) : (
                  <NotAdded />
                )}
              </td>
              {branch === "all" && (
                <td>
                  {configuredBranchLabel(
                    state.config,
                    effectiveInvoiceLocation(state, saved),
                    lang,
                  )}
                </td>
              )}
              <td>
                {saved.invoice_date ? (
                  <DateText value={saved.invoice_date} />
                ) : (
                  <NotAdded />
                )}
              </td>
              <td className="numeric">
                <ReadingMoney
                  value={saved.final_total ?? ""}
                  currency={state.config.company.currency}
                />
              </td>
              <td className="numeric">
                <LtrValue value={String(saved.lines.length)} />
              </td>
              <td>
                <span className="invoice-queue-progress">
                  {saved.live_reading && saved.status === "reading" ? (
                    <LiveQueueProgress invoice={saved} />
                  ) : (
                    t(
                      `${confirmed}/${saved.lines.length} confirmed · ${checks} to check`,
                      `${confirmed}/${saved.lines.length} تأیید شده · ${checks} نیاز به بررسی`,
                    )
                  )}
                </span>
              </td>
              <td>
                <Button
                  variant={reviewAction ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => void open(saved)}
                >
                  {reviewAction
                    ? t("Review", "بررسی")
                    : unreadOriginal(saved)
                      ? t("Continue", "ادامه")
                      : saved.live_reading && saved.status === "reading"
                        ? t("Read again", "خواندن دوباره")
                        : t("Resume draft", "ادامه پیش‌نویس")}
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
