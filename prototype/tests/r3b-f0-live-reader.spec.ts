import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openInvoiceDetails, setLanguage } from "./helpers";
import {
  configureLive,
  expectNoPosting,
  expectReview,
  failureMessage,
  fictionalPhoto,
  fictionalResponse,
  mockReader,
  newLiveOriginal,
  pressRead,
  retainedSourceHashes,
  sourceHash,
} from "./r3-live-reading-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R3b F0 accepts kit object models, numeric metrics and checkFailures (${language})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    // Independent fictional values in the real kit's response shape.
    const response = {
      ...fictionalResponse("R3B-F0-FICTIONAL-001"),
      models: [
        {
          id: "fictional-model-argon",
          ok: true,
          seconds: 71.25,
          costUSD: 0.0825,
          error: null,
        },
        {
          id: "fictional-model-luna",
          ok: true,
          seconds: 30.5,
          costUSD: 0.0025,
          error: null,
        },
      ],
      checkFailures: [],
      costUSD: 0.085,
      seconds: 84.5,
    };
    const reader = await mockReader(page, [{ kind: "success", response }]);
    await configureLive(page);
    await setLanguage(page, language);
    const source = await fictionalPhoto(page, "r3b-f0-fictional-original.png");
    const before = await readCanonicalBusinessEvidence(page);
    const original = await newLiveOriginal(page, source, "photo", language);
    await pressRead(page, language);

    const review = await expectReview(page, original.id, language);
    expect(reader.requests).toHaveLength(1);
    expect(review.file_data).toBe(original.file_data);
    expect(await retainedSourceHashes(page, review)).toEqual([
      sourceHash(source),
    ]);
    expect(review.supplier_invoice_number).toBe("R3B-F0-FICTIONAL-001");
    expect(review.lines).toHaveLength(1);
    expect(review.lines[0].unit_cost_before_tax).toBe("1.2345");
    expect(review.reading_record).toMatchObject({
      source: "live",
      models: ["fictional-model-argon", "fictional-model-luna"],
      seconds: 84.5,
      reading_cost_usd: "0.0850",
      model_details: [
        {
          id: "fictional-model-argon",
          ok: true,
          seconds: 71.25,
          costUSD: "0.0825",
        },
        {
          id: "fictional-model-luna",
          ok: true,
          seconds: 30.5,
          costUSD: "0.0025",
        },
      ],
    });
    expect(review.reading_record).not.toHaveProperty("checkFailures");
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
    await expect(page.getByText(failureMessage, { exact: true })).toHaveCount(
      0,
    );
    await openInvoiceDetails(page);
    const provenance = page.getByTestId("live-reading-provenance");
    for (const model of response.models)
      await expect(provenance).toContainText(model.id);
    await expect(provenance).toContainText("$0.09 USD");

    await page.reload();
    const retained = await expectReview(page, original.id, language);
    expect(retained.reading_record).toEqual(review.reading_record);
    expect(await retainedSourceHashes(page, retained)).toEqual([
      sourceHash(source),
    ]);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
    expect(reader.requests).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
