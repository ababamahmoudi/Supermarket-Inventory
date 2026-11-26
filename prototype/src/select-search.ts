/** Public text normalization for reusable pickers; never reads business state. */
export function normalizeSelectSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/(?:\u200c|\u200d|[\u2066-\u2069])/g, "")
    .trim();
}
export interface SearchableOption {
  value: string;
  label: string;
  searchTerms?: readonly string[];
}
export function matchesSelectOption(
  option: SearchableOption,
  query: string,
): boolean {
  const haystack = normalizeSelectSearch(
    [option.label, option.value, ...(option.searchTerms ?? [])].join(" "),
  );
  return normalizeSelectSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
export function matchingSelectTerms(
  option: SearchableOption,
  query: string,
): string[] {
  const words = normalizeSelectSearch(query).split(/\s+/).filter(Boolean);
  const label = normalizeSelectSearch(option.label);
  return words.length
    ? [...new Set(option.searchTerms ?? [])]
        .filter((term) => {
          const normalized = normalizeSelectSearch(term);
          return (
            normalized &&
            !label.includes(normalized) &&
            words.some((word) => normalized.includes(word))
          );
        })
        .slice(0, 2)
    : [];
}

/** Original UTF-16 ranges, including normalized Persian letters and digits. */
export function selectMatchParts(
  value: string,
  query: string,
): { text: string; match: boolean }[] {
  const map: { start: number; end: number }[] = [];
  let normalized = "",
    offset = 0;
  for (const point of value) {
    const folded = /\s/u.test(point) ? point : normalizeSelectSearch(point);
    normalized += folded;
    for (let i = 0; i < folded.length; i++)
      map.push({ start: offset, end: offset + point.length });
    offset += point.length;
  }
  const ranges: { start: number; end: number }[] = [];
  for (const word of normalizeSelectSearch(query)
    .split(/\s+/)
    .filter(Boolean)) {
    let from = 0;
    while (word && from < normalized.length) {
      const index = normalized.indexOf(word, from);
      if (index < 0) break;
      ranges.push({
        start: map[index].start,
        end: map[index + word.length - 1].end,
      });
      from = index + word.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  const parts: { text: string; match: boolean }[] = [];
  let start = 0;
  for (const range of merged) {
    if (range.start > start)
      parts.push({ text: value.slice(start, range.start), match: false });
    parts.push({ text: value.slice(range.start, range.end), match: true });
    start = range.end;
  }
  if (start < value.length)
    parts.push({ text: value.slice(start), match: false });
  return parts;
}

export interface ProductOptionFields {
  code: string;
  name_en: string;
  name_fa?: string;
  barcode?: string;
}
/** Explicit allowlist: costs, margins and source identities cannot enter search metadata. */
export function productSelectOption(
  product: ProductOptionFields,
  language: "en" | "fa",
) {
  return {
    value: product.code,
    label: `${language === "fa" ? product.name_fa || product.name_en : product.name_en} · ${product.code}`,
    searchTerms: [
      product.name_en,
      product.name_fa ?? "",
      product.code,
      product.barcode ?? "",
    ].filter(Boolean),
  };
}
export function supplierSelectOption(supplier: {
  name: string;
  previous_names?: readonly string[];
}) {
  return {
    value: supplier.name,
    label: supplier.name,
    searchTerms: [supplier.name, ...(supplier.previous_names ?? [])],
  };
}
