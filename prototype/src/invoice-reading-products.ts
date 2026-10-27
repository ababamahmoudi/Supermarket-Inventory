export interface InvoiceProductDescriptionInput {
  description: string;
  supplierCode?: string | null;
  unitsPerCase?: string | number | null;
  packSize?: string | null;
  unit?: string | null;
}

export interface InvoiceProductDescriptionSplit {
  name: string;
  pack_size: string;
  units_per_case?: number;
  uncertain: boolean;
  suggested_name?: string;
  supplier_promotion?: boolean;
}

/** Supplier pack sizes stay recognizable while ALL CAPS words become readable names. */
export function suggestInvoiceEnglishName(description: string): string {
  const normalizeSizes = (value: string) =>
    value.replace(
      /\b\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)*\s*(?:kg|g|ml|l|lb|oz)\b/gi,
      (match) => match.toLowerCase(),
    );
  const source = description.trim();
  const words = source.replace(
    /\b\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)*\s*(?:kg|g|ml|l|lb|oz)\b/gi,
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
const sizeUnit = "(?:kg|ml|lbs?|oz|gr?|l(?:it(?:res?|ers?)?|tr?s?)?)";
const container = "(?:(?:box|case|carton|pack|ctn)\\s+(?:of\\s+)?)?";
const measuredPack = new RegExp(
  `\\b${container}(${amount})\\s*[x×*]\\s*(${amount})\\s*(${sizeUnit})\\b`,
  "i",
);
const nestedMeasuredPack = new RegExp(
  `\\b(?:${amount}\\s*[x×*]\\s*){2,}${amount}\\s*${sizeUnit}\\b`,
  "i",
);
const packPrefix = new RegExp(
  `^(?:(?:box|case|carton|pack|ctn)\\s+(?:of\\s+)?\\d|${amount}\\s*[x×*])`,
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

function canonicalSizeUnit(value: string) {
  return /^gr?$/i.test(value)
    ? "g"
    : /^l(?:it|tr)/i.test(value)
      ? "l"
      : /^lbs?$/i.test(value)
        ? "lb"
        : value.toLowerCase();
}
function normalizePack(value: string) {
  return value
    .trim()
    .replace(/(\d)\s*[x×*]\s*(?=\d)/gi, "$1 × ")
    .replace(
      new RegExp(`(${amount})\\s*(${sizeUnit})\\b`, "gi"),
      (_match, number: string, unit: string) =>
        `${number} ${canonicalSizeUnit(unit)}`,
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
  if (nestedMeasuredPack.test(value)) return undefined;
  const measured = measuredPack.exec(value);
  if (measured) return positiveCount(measured[1]);
  const labeled =
    /^(?:ctn|cs)\s*(\d+)$/i.exec(value.trim()) ??
    /\b(\d+)\s*(?:\/|in\s+)\s*(?:box|case|carton)\b/i.exec(value) ??
    /\bpieces\s+in\s+carton\s*:\s*(\d+)\b/i.exec(value);
  if (labeled) return positiveCount(labeled[1]);
  if (
    new RegExp(
      `^\\s*${amount}\\s*${sizeUnit}\\s*\\/\\s*(?:case|box|carton)\\s*$`,
      "i",
    ).test(value)
  )
    return 1;
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
      return {
        name: cleanSeparators(description.replace(known, "")),
        uncertain: false,
      };
  }
  // Short numbers may be part of a product name; an explicit SKU handles those.
  const name = description.replace(
    /^\d{4,}(?:\s*[-:|–—]\s*|\s+)(?=\p{L})/u,
    "",
  );
  return { name, uncertain: name !== description };
}

/** Preserve balanced descriptive brackets and remove only unmatched punctuation. */
function removeUnbalancedBrackets(value: string): string {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { char: string; index: number }[] = [];
  const remove = new Set<number>();
  [...value].forEach((char, index) => {
    if (["(", "[", "{"].includes(char)) stack.push({ char, index });
    else if (pairs[char]) {
      if (stack.at(-1)?.char === pairs[char]) stack.pop();
      else remove.add(index);
    }
  });
  stack.forEach((item) => remove.add(item.index));
  return [...value].filter((_char, index) => !remove.has(index)).join("");
}

/** Separate editable suggestions without changing the caller's printed evidence. */
export function splitInvoiceProductDescription({
  description,
  supplierCode,
  unitsPerCase,
  packSize,
  unit,
}: InvoiceProductDescriptionInput): InvoiceProductDescriptionSplit {
  const code = supplierCode?.trim() ?? "";
  const promotionPattern = /\(?\s*\bpromo(?:tion)?\b\s*\)?/gi;
  const supplierPromotion = promotionPattern.test(description);
  promotionPattern.lastIndex = 0;
  const withoutCode = removeSupplierCode(
    description.trim().replace(promotionPattern, " "),
    code,
  );
  const singleCase = new RegExp(
    `\\b(${amount})\\s*(${sizeUnit})\\s*\\/\\s*(?:case|box|carton|bag)\\s*$`,
    "i",
  ).exec(withoutCode.name);
  let name = withoutCode.name.replace(/\s*\/\s*(?:case|box|ctn)\s*$/i, "");
  const nestedDescription = nestedMeasuredPack.test(name);
  let extractedPack = "";
  let inferredCount: number | undefined;
  let uncertain = withoutCode.uncertain;
  const leadingCount =
    /^(?:box|case|carton|pack|ctn)\s+(?:of\s+)?(\d+)\s*(?:(?:pcs?|pieces?|units?)\b|[x×*](?!\s*\d))\s*/i.exec(
      name,
    );
  if (leadingCount) {
    inferredCount = positiveCount(leadingCount[1]);
    extractedPack = `${leadingCount[1]} units`;
    name = name.slice(leadingCount[0].length);
  }
  const measured = measuredPack.exec(name);
  if (measured) {
    extractedPack = `${measured[1]} × ${measured[2]} ${canonicalSizeUnit(measured[3])}`;
    inferredCount = positiveCount(measured[1]);
    let start = measured.index;
    const nested = /(\d+(?:\.\d+)?)\s*[x×*]\s*$/i.exec(name.slice(0, start));
    if (nested) {
      start = nested.index;
      extractedPack = `${nested[1]} × ${extractedPack}`;
      inferredCount = undefined;
      uncertain = true;
    }
    name = `${name.slice(0, start)} ${name.slice(measured.index + measured[0].length).replace(/^\s*(?:bottles?|jars?|bags?|cans?)\b/i, "")}`;
    uncertain ||= !positiveCount(measured[1]) || measuredPack.test(name);
  } else if (singleCase) {
    extractedPack = `1 × ${singleCase[1]} ${canonicalSizeUnit(singleCase[2])}`;
    inferredCount = 1;
    name = withoutCode.name.slice(0, singleCase.index);
  } else {
    const labeled =
      /\(?\b(\d+)\s*(?:\/|in\s+)\s*(?:box|case|carton)\b\)?/i.exec(name) ??
      /\bpieces\s+in\s+carton\s*:\s*(\d+)\b/i.exec(name);
    if (labeled) {
      inferredCount = positiveCount(labeled[1]);
      extractedPack = `${labeled[1]} units`;
      name = `${name.slice(0, labeled.index)} ${name.slice(labeled.index + labeled[0].length)}`;
    }
    const countOnly = /\s+[x×*]\s*(\d+(?:\.\d+)?)\s*$/i.exec(name);
    if (countOnly) {
      inferredCount = positiveCount(countOnly[1]);
      extractedPack = `${countOnly[1]} units`;
      name = name.slice(0, countOnly.index);
      uncertain ||= inferredCount === undefined;
    }
  }
  // Sizes, packaging labels and printed date codes remain in the unmodified printed description.
  name = name
    .replace(/\(\s*\)/g, " ")
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, " ")
    .replace(/\s+UA\s*$/i, "");
  const attachedSize = new RegExp(
    `\\b(${amount})\\s*(${sizeUnit})\\s*-\\s*(?=\\p{L})`,
    "giu",
  );
  name = name.replace(
    attachedSize,
    (_whole, size: string, sizeUnit: string) => {
      extractedPack ||= `${size} ${canonicalSizeUnit(sizeUnit)}`;
      return " ";
    },
  );
  name = cleanSeparators(name.replace(/\s*\/\s*(?:case|box|ctn)\s*$/i, ""));
  const explicitPack = packSize?.trim() ?? "";
  const nestedPack = nestedDescription || nestedMeasuredPack.test(explicitPack);
  uncertain ||= nestedPack;
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
  const unitCount = packTextCount(unit ?? "");
  if (
    unitCount &&
    (packCount ?? inferredCount) &&
    unitCount !== (packCount ?? inferredCount)
  )
    uncertain = true;
  const parsedCount = nestedPack
    ? undefined
    : (packCount ?? inferredCount ?? unitCount);
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
      ? `${explicitMeasured[1]} × ${explicitMeasured[2]} ${canonicalSizeUnit(explicitMeasured[3])}`
      : normalizePack(explicitPack)
    : extractedPack;
  const normalizedName = suggestInvoiceEnglishName(
    cleanSeparators(removeUnbalancedBrackets(name)),
  );
  uncertain ||= !normalizedName || packPrefix.test(normalizedName);
  const nameLikeCode = /^[\p{L}][\p{L}\s]*$/u.test(code);
  return {
    name: normalizedName,
    ...(supplierPromotion ? { supplier_promotion: true } : {}),
    pack_size: formattedPack,
    ...(count === undefined ? {} : { units_per_case: count }),
    uncertain,
    ...((!normalizedName || packPrefix.test(normalizedName)) && nameLikeCode
      ? { suggested_name: suggestInvoiceEnglishName(code) }
      : {}),
  };
}

/** Only an entirely-capital printed supplier name gets a new readable suggestion. */
export function suggestInvoiceSupplierName(printed: string): string {
  const source = printed.trim();
  if (!/\p{Lu}/u.test(source) || /\p{Ll}/u.test(source)) return source;
  const suffixes: Record<string, string> = {
    inc: "Inc.",
    ltd: "Ltd.",
    co: "Co.",
    corp: "Corp.",
  };
  return source
    .split(/(\s+)/)
    .map((word) => {
      if (/\d/u.test(word)) return word;
      const suffix = /^(inc|ltd|co|corp)\.?(,?)$/i.exec(word);
      if (suffix) return suffixes[suffix[1].toLowerCase()] + suffix[2];
      return word
        .toLocaleLowerCase()
        .replace(
          /(^|[-/'(])([a-z])/g,
          (_match, separator: string, letter: string) =>
            separator + letter.toUpperCase(),
        );
    })
    .join("");
}
