export class PackageBarcodeError extends Error {
  constructor(readonly code: "barcode" | "prefix" | "sequence") {
    super(code);
    this.name = "PackageBarcodeError";
  }
}

export function ean13CheckDigit(twelveDigits: string): string {
  if (!/^\d{12}$/.test(twelveDigits)) throw new PackageBarcodeError("barcode");
  const sum = [...twelveDigits].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return String((10 - (sum % 10)) % 10);
}

function gtinCheckDigit(body: string): string {
  const sum = [...body]
    .reverse()
    .reduce(
      (total, digit, index) =>
        total + Number(digit) * (index % 2 === 0 ? 3 : 1),
      0,
    );
  return String((10 - (sum % 10)) % 10);
}
/** Compare GS1 retail identifiers consistently without changing their printed form. */
export function packageBarcodeIdentity(barcode: string): string {
  const value = barcode.trim();
  return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)
    ? value.padStart(14, "0")
    : value;
}
/** Manufacturer GTIN-8/UPC-A/GTIN-13/GTIN-14 retain their printed form. */
export function validatePackageBarcode(barcode: string): string {
  const value = barcode.trim();
  if (
    !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) ||
    gtinCheckDigit(value.slice(0, -1)) !== value.at(-1)
  )
    throw new PackageBarcodeError("barcode");
  return value;
}

/** A fixed-size barcode identifies the product; it never encodes its price. */
export function inStorePackageBarcode(
  productCode: string,
  prefix = "20",
): string {
  if (!/^2\d$/.test(prefix)) throw new PackageBarcodeError("prefix");
  if (!/^\d{1,10}$/.test(productCode))
    throw new PackageBarcodeError("sequence");
  const body = `${prefix}${productCode.padStart(10, "0")}`;
  return `${body}${ean13CheckDigit(body)}`;
}
