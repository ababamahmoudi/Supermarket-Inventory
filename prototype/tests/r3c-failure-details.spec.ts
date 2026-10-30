import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage, signIn } from "./helpers";
import {
  configureLive,
  deferred,
  expectNoPosting,
  expectReview,
  fictionalPhoto,
  fictionalResponse,
  mockReader,
  newLiveOriginal,
  pressRead,
  retainedSourceHashes,
  sourceHash,
  t,
} from "./r3-live-reading-helpers";

test.setTimeout(60000);
for (const language of ["en", "fa"] as const) {
  test(`F11 model-id failure stays private, survives Manager reload and clears only on explicit F0 retry ${language}`, async ({
    page,
  }) => {
    const privateSentinel = "Wholly fictional private transport payload";
    const gate = deferred();
    const good = {
      ...fictionalResponse("F11-FICTIONAL-RETRY"),
      models: [
        {
          id: "fictional-model-violet",
          ok: true,
          seconds: 12.345,
          costUSD: 0.0123,
          error: null,
        },
      ],
      costUSD: 0.0123,
      seconds: 12.345,
      checkFailures: [],
    };
    const bad = {
      ...good,
      models: [{ ...good.models[0], id: "   " }],
      checkFailures: [{ message: privateSentinel }],
    };
    const reader = await mockReader(page, [
      { kind: "success", response: bad },
      { kind: "held", wait: gate.promise, response: good },
    ]);
    await configureLive(page);
    await signIn(page, "Floor Worker");
    await setLanguage(page, language);
    const photo = await fictionalPhoto(page, "fictional-diagnostic-source.png");
    const original = await newLiveOriginal(page, photo, "photo", language);
    const before = await readCanonicalBusinessEvidence(page);
    await pressRead(page, language);
    const generic = t(
      language,
      "The AI reading didn't finish. Your original is saved.",
      "خوانش هوش مصنوعی کامل نشد. اصل فایل شما ذخیره شده است.",
    );
    await expect(page.getByRole("alert")).toContainText(generic);
    await expect(page.getByTestId("live-reading-failure-details")).toHaveCount(
      0,
    );
    const failed = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(failed.live_reading?.failure_diagnostic).toEqual({
      reason: "invalid_model_id",
      field: "models[].id",
    });
    expect(failed.original_pages).toEqual(original.original_pages);
    expect(JSON.stringify(failed)).not.toContain(privateSentinel);
    expect(await retainedSourceHashes(page, failed)).toEqual([
      sourceHash(photo),
    ]);
    expect(reader.requests).toHaveLength(1);
    const attempt = failed.live_reading!.attempt_id;

    await signIn(page, "Manager");
    await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
    const detail = page.getByTestId("live-reading-failure-details");
    const explanation = t(
      language,
      "Reader response: models[].id must contain a model id. Check the reader kit, then try again.",
      "پاسخ خواننده: models[].id باید شناسهٔ مدل داشته باشد. کیت خواننده را بررسی و دوباره تلاش کنید.",
    );
    await expect(detail).toHaveText(explanation);
    await expect(page.locator("body")).not.toContainText(privateSentinel);
    await page.reload();
    await expect(detail).toHaveText(explanation);
    expect(reader.requests).toHaveLength(1);
    expect(
      (await readCanonicalBusinessEvidence(page)).invoice.live_reading!
        .attempt_id,
    ).toBe(attempt);

    await signIn(page, "Floor Worker");
    await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
    await expect(page.getByRole("alert")).toContainText(generic);
    await expect(detail).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("models[].id");
    await signIn(page, "Manager");
    await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
    await expect(detail).toHaveText(explanation);
    await page
      .getByRole("button", {
        name: t(language, "Try again", "تلاش دوباره"),
        exact: true,
      })
      .click();
    await expect.poll(() => reader.requests.length).toBe(2);
    const retry = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(retry.live_reading?.phase).toBe("processing");
    expect(retry.live_reading?.attempt_id).not.toBe(attempt);
    expect(retry.live_reading).not.toHaveProperty("failure_diagnostic");
    await expect(detail).toHaveCount(0);
    gate.resolve();
    const review = await expectReview(page, original.id, language);
    expect(review.original_pages).toEqual(original.original_pages);
    expect(await retainedSourceHashes(page, review)).toEqual([
      sourceHash(photo),
    ]);
    expect(review.live_reading).not.toHaveProperty("failure_diagnostic");
    expect(reader.requests).toHaveLength(2);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
  });

  test(`F11 HTTP network and JSON details are safe actionable Manager failures ${language}`, async ({
    page,
  }) => {
    const reader = await mockReader(page, [
      { kind: "http" },
      { kind: "network" },
      { kind: "invalid-json" },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    for (const [index, reason, expected] of [
      [
        0,
        "http",
        t(
          language,
          "The reader returned HTTP 500. Check the reader kit and try again.",
          "خواننده پاسخ HTTP 500 داد. کیت خواننده را بررسی و دوباره تلاش کنید.",
        ),
      ],
      [
        1,
        "network_or_cors",
        t(
          language,
          "Check the reader address, network and permission for this page, then try again. The browser cannot distinguish a network failure from a blocked page origin.",
          "نشانی خواننده، شبکه و مجوز این صفحه را بررسی و دوباره تلاش کنید. مرورگر نمی‌تواند قطعی شبکه را از مسدود بودن نشانی صفحه تشخیص دهد.",
        ),
      ],
      [
        2,
        "invalid_json",
        t(
          language,
          "The reader returned invalid JSON. Check the reader kit, then try again.",
          "خواننده JSON نامعتبر برگرداند. کیت خواننده را بررسی و دوباره تلاش کنید.",
        ),
      ],
    ] as const) {
      const photo = await fictionalPhoto(
        page,
        `fictional-failure-${index}.png`,
        ["#d41414", "#14d414", "#1414d4"][index],
      );
      const original = await newLiveOriginal(page, photo, "photo", language);
      await pressRead(page, language);
      await expect(page.getByTestId("live-reading-failure-details")).toHaveText(
        expected,
      );
      const failed = (await readCanonicalBusinessEvidence(page)).invoice;
      expect(failed.live_reading?.phase).toBe("failed");
      expect(failed.live_reading?.failure_diagnostic).toMatchObject({ reason });
      expect(failed.original_pages).toEqual(original.original_pages);
      expect(await retainedSourceHashes(page, failed)).toEqual([
        sourceHash(photo),
      ]);
      expect(reader.requests).toHaveLength(index + 1);
      await expect(page.locator("body")).not.toContainText(
        "Fictional reader failure",
      );
      await expect(page.locator("body")).not.toContainText(
        "fictional-invalid-json",
      );
    }
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
  });
}
