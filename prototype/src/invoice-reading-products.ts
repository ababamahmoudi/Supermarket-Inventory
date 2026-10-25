export interface InvoiceProductDescriptionInput {
  description: string;
  supplierCode?: string | null;
  unitsPerCase?: string | number | null;
  packSize?: string | null;
}

export interface InvoiceProductDescriptionSplit {
  name: string;
  pack_size: string;
  units_per_case?: number;
  uncertain: boolean;
  suggested_name?: string;
}

/** Supplier pack sizes stay recognizable while ALL CAPS words become readable names. */
export function suggestInvoiceEnglishName(description: string): string {
  const normalizeSizes = (value: string) =>
    value.replace(
      /\b\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*\s*(?:kg|g|ml|l|lb|oz)\b/gi,
      (match) => match.toLowerCase(),
    );
  const source = description.trim();
  const words = source.replace(
    /\b\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*\s*(?:kg|g|ml|l|lb|oz)\b/gi,
    "",
  );
  if (/\p{Ll}/u.test(words)) return normalizeSizes(source);
  return normalizeSizes(
    source
      .split(/(\s+)/)
      .map((word) => {
        if (!/\p{L}/u.test(word)) return word;
        if (
          /^(?:\d+(?:\.\d+)?\s*x\s*)*\d+(?:\.\d+)?(?:kg|g|ml|l|lb|oz)\b/i.test(
            word,
          ) ||
          /^x$/i.test(word)
        )
          return word.toLowerCase();
        return word
          .toLocaleLowerCase()
          .replace(
            /(^|[-/])([a-z])/g,
            (_match, separator: string, letter: string) =>
              separator + letter.toUpperCase(),
          );
      })
      .join(""),
  );
}

const amount = "\\d+(?:\\.\\d+)?";
const sizeUnit = "(?:kg|ml|lb|oz|g|l)";
const container = "(?:(?:box|case|carton|pack|ctn)\\s+(?:of\\s+)?)?";
const measuredPack = new RegExp(
  `\\b${container}(${amount})\\s*[x×]\\s*(${amount})\\s*(${sizeUnit})\\b`,
  "i",
);
const packPrefix = new RegExp(
  `^(?:(?:box|case|carton|pack|ctn)\\s+(?:of\\s+)?\\d|${amount}\\s*[x×])`,
  "i",
);
const cleanSeparators = (value: string) =>
  value
    .replace(/^[\s,;:|/–—-]+|[\s,;:|/–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

function positiveCount(value: string | number | null | undefined) {
  if (value == null || String(value).trim() === "") return undefined;
  const text = String(value).trim();
  if (!/^\+?\d+(?:\.0+)?$/.test(text)) return undefined;
  const count = Number(text);
  return Number.isSafeInteger(count) && count > 0 ? count : undefined;
}

function normalizePack(value: string) {
  return value
    .trim()
    .replace(/(\d)\s*[x×]\s*(?=\d)/gi, "$1 × ")
    .replace(
      new RegExp(`(${amount})\\s*(${sizeUnit})\\b`, "gi"),
      (_match, number: string, unit: string) =>
        `${number} ${unit.toLowerCase()}`,
    )
    .replace(/\s+/g, " ");
}

function numericText(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const left = whole.replace(/^0+(?=\d)/, "");
  const right = fraction.replace(/0+$/, "");
  return right ? `${left}.${right}` : left;
}

function packTextCount(value: string) {
  const measured = measuredPack.exec(value);
  if (measured) return positiveCount(measured[1]);
  const count =
    /^(?:(?:box|case|carton|pack|ctn)\s+(?:of\s+)?)?(\d+(?:\.\d+)?)\s*(?:units?|pcs?|pieces?|each)?$/i.exec(
      value.trim(),
    );
  return count ? positiveCount(count[1]) : undefined;
}

function removeSupplierCode(description: string, code: string) {
  if (code) {
    const escaped = code
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const known = new RegExp(`^${escaped}(?=$|[\\s:|–—-])`, "i");
    if (known.test(description))
      return cleanSeparators(description.replace(known, ""));
  }
  // Short numbers may be part of a product name; an explicit SKU handles those.
  return description.replace(/^\d{4,}(?:\s*[-:|–—]\s*|\s+)(?=\p{L})/u, "");
}

/** Separate editable suggestions without changing the caller's printed evidence. */
export function splitInvoiceProductDescription({
  description,
  supplierCode,
  unitsPerCase,
  packSize,
}: InvoiceProductDescriptionInput): InvoiceProductDescriptionSplit {
  const code = supplierCode?.trim() ?? "";
  let name = removeSupplierCode(description.trim(), code).replace(
    /\s*\/\s*(?:case|box|ctn)\s*$/i,
    "",
  );
  let extractedPack = "";
  let inferredCount: number | undefined;
  let uncertain = false;
  const measured = measuredPack.exec(name);
  if (measured) {
    extractedPack = `${measured[1]} × ${measured[2]} ${measured[3].toLowerCase()}`;
    inferredCount = positiveCount(measured[1]);
    let start = measured.index;
    const nested = /(\d+(?:\.\d+)?)\s*[x×]\s*$/i.exec(name.slice(0, start));
    if (nested) {
      start = nested.index;
      extractedPack = `${nested[1]} × ${extractedPack}`;
      inferredCount = undefined;
      uncertain = true;
    }
    name = `${name.slice(0, start)} ${name.slice(measured.index + measured[0].length)}`;
    uncertain ||= !positiveCount(measured[1]) || measuredPack.test(name);
  } else {
    const countOnly = /\s+[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(name);
    if (countOnly) {
      inferredCount = positiveCount(countOnly[1]);
      extractedPack = `${countOnly[1]} units`;
      name = name.slice(0, countOnly.index);
      uncertain ||= inferredCount === undefined;
    }
  }
  name = cleanSeparators(name.replace(/\s*\/\s*(?:case|box|ctn)\s*$/i, ""));
  const explicitPack = packSize?.trim() ?? "";
  const explicitMeasured = measuredPack.exec(explicitPack);
  const packCount = packTextCount(explicitPack);
  if (
    inferredCount !== undefined &&
    packCount !== undefined &&
    inferredCount !== packCount
  )
    uncertain = true;
  if (
    explicitMeasured &&
    measured &&
    (numericText(explicitMeasured[2]) !== numericText(measured[2]) ||
      explicitMeasured[3].toLowerCase() !== measured[3].toLowerCase())
  )
    uncertain = true;
  const explicitCount = positiveCount(unitsPerCase);
  const hasExplicitCount =
    unitsPerCase != null && String(unitsPerCase).trim() !== "";
  const parsedCount = packCount ?? inferredCount;
  if (hasExplicitCount)
    uncertain ||=
      explicitCount === undefined ||
      (parsedCount !== undefined && parsedCount !== explicitCount);
  const count = hasExplicitCount ? explicitCount : parsedCount;
  const onlyMeasuredPack =
    explicitMeasured &&
    !cleanSeparators(
      explicitPack
        .replace(explicitMeasured[0], "")
        .replace(/\s*\/\s*(?:case|box|ctn)\s*$/i, ""),
    );
  const formattedPack = explicitPack
    ? onlyMeasuredPack
      ? `${explicitMeasured[1]} × ${explicitMeasured[2]} ${explicitMeasured[3].toLowerCase()}`
      : normalizePack(explicitPack)
    : extractedPack;
  const normalizedName = suggestInvoiceEnglishName(name);
  uncertain ||= !normalizedName || packPrefix.test(normalizedName);
  const nameLikeCode = /^[\p{L}][\p{L}\s]*$/u.test(code);
  return {
    name: normalizedName,
    pack_size: formattedPack,
    ...(count === undefined ? {} : { units_per_case: count }),
    uncertain,
    ...((!normalizedName || packPrefix.test(normalizedName)) && nameLikeCode
      ? { suggested_name: suggestInvoiceEnglishName(code) }
      : {}),
  };
}
