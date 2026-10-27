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

/** Manufacturer and in-store fixed-size codes use the same EAN-13 validation. */
export function validatePackageBarcode(barcode: string): string {
  const value = barcode.trim();
  if (!/^\d{13}$/.test(value) || ean13CheckDigit(value.slice(0, 12)) !== value[12])
    throw new PackageBarcodeError("barcode");
  return value;
}

/** A fixed-size barcode identifies the product; it never encodes its price. */
export function inStorePackageBarcode(productCode: string, prefix = "20"): string {
  if (!/^2\d$/.test(prefix)) throw new PackageBarcodeError("prefix");
  if (!/^\d{1,10}$/.test(productCode)) throw new PackageBarcodeError("sequence");
  const body = `${prefix}${productCode.padStart(10, "0")}`;
  return `${body}${ean13CheckDigit(body)}`;
}
