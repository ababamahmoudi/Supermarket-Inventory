import { configSeed } from "./config";
import { isMonthlyPaymentTerms, paymentTermsDays } from "./invoice-entry";
import type { CompanyConfig } from "./types";

/** Resolve only a recognized configured default; never rewrite existing invoices. */
export function receivingDefaultPaymentTerms(config: CompanyConfig): string {
  const configured = config.receiving.default_payment_terms;
  const value =
    configured === undefined
      ? configSeed.receiving.default_payment_terms
      : configured;
  if (typeof value !== "string") return "";
  const terms = value.trim();
  return isMonthlyPaymentTerms(terms) || paymentTermsDays(terms) !== undefined
    ? terms
    : "";
}
