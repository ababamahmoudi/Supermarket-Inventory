/** Separate from supplier/invoice identity normalization: these are printed item keys. */
export function normalizedPrintedItem(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(
        Math.max("۰۱۲۳۴۵۶۷۸۹".indexOf(digit), "٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
      ),
    )
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
