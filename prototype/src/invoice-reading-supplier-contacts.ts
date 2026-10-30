export interface SupplierContactText {
  address: string;
  phone: string;
  email: string;
  website: string;
}

/** Extract only identifiable contacts; the original reading stays untouched. */
export function extractSupplierContactText(
  address: string,
): SupplierContactText {
  let remaining = address.replace(/\r\n?/g, "\n");
  const result = { address: "", phone: "", email: "", website: "" };
  const remove = (index: number, length: number) => {
    const punctuation = remaining
      .slice(index + length)
      .match(/^[.,;](?=$|[\s|])/);
    remaining =
      remaining.slice(0, index) +
      " " +
      remaining.slice(index + length + (punctuation?.[0].length ?? 0));
  };

  // Bare hosts need an explicit label: dotted address abbreviations are not URLs.
  const websitePattern =
    /(?:(?:\b(?:website|web|site)|وب‌سایت|وب سایت)[ \t]*[:：]?[ \t]*((?:https?:\/\/|www\.)?[^\s<>()]+)|(?<![\w@.-])((?:https?:\/\/|www\.)[^\s<>()]+))/gi;
  for (const match of remaining.matchAll(websitePattern)) {
    const value = (match[1] ?? match[2]).replace(/[.,;]+$/, "");
    try {
      const url = new URL(
        /^https?:\/\//i.test(value) ? value : `https://${value}`,
      );
      if (!url.hostname.includes(".") || !/^https?:$/.test(url.protocol))
        continue;
      result.website = value;
      remove(match.index, match[0].length);
      break;
    } catch {
      // An incomplete label or address fragment remains available for review.
    }
  }

  const emailPattern =
    /(?:(?:\be-?mail|ایمیل|رایانامه)[ \t]*[:：]?[ \t]*)?([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9-]+\.)+[a-z]{2,63})/gi;
  const email = emailPattern.exec(remaining);
  if (email) {
    result.email = email[1].replace(/\.+$/, "");
    remove(email.index, email[0].length);
  }

  const labelledPhone =
    /(?:\b(?:telephone|phone|tel|call)\.?|تلفن)[ \t]*[:：]?[ \t]*((?:\+?\d|\(\d)[\d ().\u00a0-]*\d(?:[ \t]*(?:extension|ext\.?|x)[ \t]*\d{1,6})?)/gi;
  for (const match of remaining.matchAll(labelledPhone)) {
    const value = match[1].trim();
    const base = value.replace(/[ \t]*(?:extension|ext\.?|x)[ \t]*\d+$/i, "");
    const length = base.replace(/\D/g, "").length;
    if (length < 7 || length > 15) continue;
    result.phone = value;
    remove(match.index, match[0].length);
    break;
  }
  if (!result.phone) {
    const unlabelledPhone =
      /(?<![\w\d])(?:\+?1[ \t.-]?)?(?:\([2-9]\d{2}\)[ \t.-]*|[2-9]\d{2}[ \t.-])\d{3}[ \t.-]?\d{4}(?:[ \t]*(?:extension|ext\.?|x)[ \t]*\d{1,6})?(?!\w)/gi;
    for (const match of remaining.matchAll(unlabelledPhone)) {
      const prefix = remaining.slice(
        Math.max(0, match.index - 24),
        match.index,
      );
      if (/(?:fax|tax|gst|hst|vat|invoice|account|فکس)[ \t:：]*$/i.test(prefix))
        continue;
      result.phone = match[0];
      remove(match.index, match[0].length);
      break;
    }
  }

  result.address = remaining
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t\u00a0]+/g, " ")
        .replace(/^[ ,;|·•]+|[ ,;|·•]+$/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
  return result;
}
