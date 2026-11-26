type Translate = (en: string, fa: string) => string;

/** Display copy never changes retained notes or guesses an unfamiliar warning's meaning. */
export function readingNoteCopy(note: string, t: Translate): string {
  const normalized = note.trim().replace(/\s+/g, " ");
  if (
    /^No ship[- ]to address (?:is|was) printed(?: on the invoice)?; used bill[- ]to for (?:branch_hint|(?:the )?(?:receiving )?location)\.?$/i.test(
      normalized,
    )
  )
    return t(
      "No ship-to address was printed, so the location came from the bill-to address.",
      "نشانی تحویل روی فاکتور نبود؛ مکان از نشانی صورتحساب مشخص شد.",
    );
  if (
    /^Sub\s*Total (?:is|was) (?:(?:marked|printed|shown) )?\(?Tax Inclusive\)? with no separate tax amount (?:printed|shown)\.?$/i.test(
      normalized,
    )
  )
    return t(
      "Tax was included in the printed subtotal; no separate tax amount was shown.",
      "مالیات در جمع چاپ‌شده منظور شده بود؛ مبلغ مالیات جداگانه درج نشده بود.",
    );
  return t(
    "The reading includes an additional note. Compare this invoice with the original.",
    "خوانش یادداشت دیگری دارد. این فاکتور را با اصل آن مقایسه کنید.",
  );
}
