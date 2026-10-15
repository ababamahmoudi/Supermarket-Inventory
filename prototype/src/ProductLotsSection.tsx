import { useState } from "react";
import { effectivePrice } from "./catalog";
import { useDemo } from "./store";
import {
  effectiveProjectedClearanceOffers,
  receiptLotsForProduct,
  setLotClearance,
  ClearanceError,
} from "./receipt-lots";
import { addClearanceLabelToWaitlist } from "./label-workflow";
import { branchLabel } from "./settings";
import { DateText, LtrText, Money } from "./presentation";
import { formatQuantity } from "./formatters";
import { ProductCost, ProductPrice } from "./weight-price-presentation";
import type { ProductReadDTO } from "./catalog-read-model";
import { useProtectedQuery } from "./use-protected-query";
import { Badge, Button, DataTable, Dialog, Field, NumberField } from "./ui";
import { WhatsMissing } from "./WhatsMissing";

export function ProductLotsSection({ product }: { product: ProductReadDTO }) {
  const { state, actor, can, command, lang, t, setBranch, navigate } =
    useDemo();
  const [selectedId, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState(false);
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const lotsRead = useProtectedQuery(
    "lots.read",
    scope,
    (canonical, currentActor) =>
      receiptLotsForProduct(canonical, currentActor, product.code),
    product.code,
  );
  const lots = lotsRead.data ?? [];
  const selected = lotsRead.data?.find((lot) => lot.id === selectedId);
  const costs = can("lots.cost_read", scope);
  if (!actor || !can("lots.read", scope)) return null;
  const message = (cause: unknown) =>
    cause instanceof ClearanceError && cause.code === "price"
      ? t(
          "Enter a clearance price below the regular price.",
          "قیمت فروش ویژه را کمتر از قیمت عادی وارد کنید.",
        )
      : t(
          "This lot changed or is outside your allowed location. Refresh and try again.",
          "این سری تغییر کرده یا خارج از مکان مجاز شما است. صفحه را تازه‌سازی و دوباره تلاش کنید.",
        );
  return (
    <section className="stack product-lots-section">
      <h2>{t("Lots", "سری‌های کالا")}</h2>
      {!lots.length ? (
        <p className="muted">
          {t("No dated receipts recorded.", "تحویل دارای تاریخ ثبت نشده است.")}
        </p>
      ) : (
        <DataTable
          className="product-lots-table"
          columns={[
            {
              label: t("Expiry", "انقضا"),
              width: 128,
              minWidth: 120,
              priority: 1,
              required: true,
              mobilePrimary: true,
            },
            {
              label: t("Location", "مکان"),
              width: 130,
              minWidth: 120,
              priority: 2,
            },
            {
              label: t("Supplier", "تأمین‌کننده"),
              width: 180,
              minWidth: 160,
              priority: 3,
            },
            {
              label: t("Quantity received", "مقدار دریافت‌شده"),
              width: 120,
              minWidth: 116,
              priority: 5,
              align: "end",
            },
            ...(costs
              ? [
                  {
                    label: t("Unit cost", "هزینهٔ واحد"),
                    width: 120,
                    minWidth: 104,
                    priority: 6,
                    align: "end" as const,
                  },
                ]
              : []),
            {
              label: t("Clearance price", "قیمت فروش ویژه"),
              width: 150,
              minWidth: 140,
              priority: 4,
              align: "end",
            },
            {
              label: t("Actions", "عملیات"),
              width: 165,
              minWidth: 165,
              priority: 0,
              actions: true,
            },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Expiry", "انقضا")}</th>
              <th>{t("Location", "مکان")}</th>
              <th>{t("Supplier", "تأمین‌کننده")}</th>
              <th>{t("Quantity received", "مقدار دریافت‌شده")}</th>
              {costs && <th>{t("Unit cost", "هزینهٔ واحد")}</th>}
              <th>{t("Clearance price", "قیمت فروش ویژه")}</th>
              <th>{t("Actions", "عملیات")}</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const clearance = effectiveProjectedClearanceOffers(
                state,
                product,
                lot.branch,
              ).find((offer) => offer.lot_id === lot.id);
              return (
                <tr key={lot.id}>
                  <td>
                    <DateText value={lot.expiry_date} />
                  </td>
                  <td>{branchLabel(state.config, lot.branch, lang)}</td>
                  <td>
                    <LtrText>{lot.supplier}</LtrText>
                  </td>
                  <td>
                    <LtrText>
                      {formatQuantity(
                        lot.received_quantity,
                        lot.quantity_unit,
                        lang,
                      )}
                    </LtrText>
                  </td>
                  {costs && (
                    <td>
                      {lot.unit_cost !== undefined ? (
                        <ProductCost
                          value={lot.unit_cost}
                          product={product}
                          config={state.config}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td>
                    {clearance ? (
                      <Badge tone="info">
                        <ProductPrice
                          value={clearance.price}
                          product={product}
                          config={state.config}
                        />
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <Button
                        disabled={
                          pending ||
                          !can(
                            clearance
                              ? "labels.queue_write"
                              : "offers.clearance_create",
                            {
                              company_id: lot.company_id,
                              kind: "location_record",
                              location_ids: [lot.branch],
                              mutation: true,
                            },
                          )
                        }
                        variant={clearance ? "tinted" : "neutral"}
                        size="sm"
                        onClick={async () => {
                          if (!clearance) {
                            setSelected(lot.id);
                            setPrice("");
                            setError("");
                            setValidation(false);
                            return;
                          }
                          if (pending) return;
                          setPending(true);
                          try {
                            await command(
                              "labels.queue_write",
                              {
                                company_id: lot.company_id,
                                kind: "location_record",
                                location_ids: [lot.branch],
                                mutation: true,
                              },
                              (next, currentActor) =>
                                addClearanceLabelToWaitlist(
                                  next,
                                  product.code,
                                  lot.id,
                                  1,
                                  lot.branch,
                                  currentActor,
                                ),
                            );
                            await setBranch(lot.branch);
                            navigate(
                              `labels?tab=waitlist&lot=${encodeURIComponent(lot.id)}`,
                            );
                          } catch (cause) {
                            setError(message(cause));
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        {clearance
                          ? t("Print Promo label", "چاپ برچسب ویژه")
                          : t("Create clearance", "ایجاد فروش ویژه")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
      {error && !selected && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={t("Create clearance offer", "ایجاد پیشنهاد فروش ویژه")}
        >
          <form
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              setValidation(false);
              setError("");
              if (pending) return;
              setPending(true);
              try {
                await command(
                  "offers.clearance_create",
                  {
                    company_id: selected.company_id,
                    kind: "location_record",
                    location_ids: [selected.branch],
                    entity_id: selected.id,
                    mutation: true,
                  },
                  (next, currentActor) =>
                    setLotClearance(next, currentActor, selected.id, price),
                );
                setSelected(null);
              } catch (cause) {
                setError(message(cause));
                setValidation(
                  cause instanceof ClearanceError && cause.code === "price",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <p>
              {branchLabel(state.config, selected.branch, lang)} ·{" "}
              {t("Expires", "انقضا")} <DateText value={selected.expiry_date} />
            </p>
            <p className="helper">
              {t("Regular price", "قیمت عادی")}:{" "}
              {effectivePrice(state, product, selected.branch) ? (
                <Money
                  value={effectivePrice(state, product, selected.branch)!}
                  currency={state.config.company.currency}
                />
              ) : (
                t("No approved price yet", "هنوز قیمت تأییدشده‌ای وجود ندارد")
              )}
            </p>
            <WhatsMissing
              issues={
                validation
                  ? [
                      {
                        id: "clearance-price",
                        fieldId: "clearance-price",
                        message: error,
                      },
                    ]
                  : []
              }
            />
            <Field
              label={t("Clearance price", "قیمت فروش ویژه")}
              error={validation ? error : undefined}
            >
              <NumberField
                id="clearance-price"
                value={price}
                onChange={(value) => {
                  setPrice(value);
                  setError("");
                  setValidation(false);
                }}
              />
            </Field>
            {error && !validation && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="c3-dialog-actions">
              <Button variant="neutral" onClick={() => setSelected(null)}>
                {t("Cancel", "لغو")}
              </Button>
              <Button disabled={pending} type="submit">
                {t("Create clearance offer", "ایجاد پیشنهاد فروش ویژه")}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
