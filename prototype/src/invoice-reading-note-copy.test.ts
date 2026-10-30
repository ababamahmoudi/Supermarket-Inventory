import { expect, it } from "vitest";
import { readingNoteCopy } from "./invoice-reading-note-copy";

it("translates recognized reading-note meanings without internal reader keys", () => {
  for (const language of ["en", "fa"] as const) {
    const t = (en: string, fa: string) => (language === "en" ? en : fa);
    expect(
      readingNoteCopy(
        "No ship-to address is printed; used bill-to for branch_hint.",
        t,
      ),
    ).toBe(
      t(
        "No ship-to address was printed, so the location came from the bill-to address.",
        "نشانی تحویل روی فاکتور نبود؛ مکان از نشانی صورتحساب مشخص شد.",
      ),
    );
    expect(
      readingNoteCopy(
        "Sub Total is marked (Tax Inclusive) with no separate tax amount printed.",
        t,
      ),
    ).toBe(
      t(
        "Tax was included in the printed subtotal; no separate tax amount was shown.",
        "مالیات در جمع چاپ‌شده منظور شده بود؛ مبلغ مالیات جداگانه درج نشده بود.",
      ),
    );
  }
});

it("does not turn address differences or tax exemption into missing-address or tax-inclusive facts", () => {
  const notes = [
    "ship_to and bill_to are both present but different; check the location.",
    "No separate tax amount printed: the items are tax-exempt.",
    "Sub Total is not Tax Inclusive; a separate tax amount was printed.",
    "Currency was confirmed from the printed original.",
  ];
  for (const language of ["en", "fa"] as const) {
    const t = (en: string, fa: string) => (language === "en" ? en : fa);
    for (const note of notes)
      expect(readingNoteCopy(note, t)).toBe(
        t(
          "The reading includes an additional note. Compare this invoice with the original.",
          "خوانش یادداشت دیگری دارد. این فاکتور را با اصل آن مقایسه کنید.",
        ),
      );
  }
});

it("keeps unknown technical spellings out of display copy while retaining the raw notes unchanged", () => {
  const notes = [
    "_confidence_note",
    "header.invoiceDate",
    "lines[0].taxable",
    "taxProfile",
    "supplier.address.phone_number",
    "Check branch_hint and unknown_reader_key.",
  ];
  const retained = structuredClone(notes);
  for (const language of ["en", "fa"] as const) {
    const t = (en: string, fa: string) => (language === "en" ? en : fa);
    for (const note of notes) {
      const copy = readingNoteCopy(note, t);
      expect(copy).toBe(
        t(
          "The reading includes an additional note. Compare this invoice with the original.",
          "خوانش یادداشت دیگری دارد. این فاکتور را با اصل آن مقایسه کنید.",
        ),
      );
      expect(copy).not.toContain(note);
    }
  }
  expect(notes).toEqual(retained);
});
