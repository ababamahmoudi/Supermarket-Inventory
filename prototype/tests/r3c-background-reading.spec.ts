import { expect, test, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setLanguage } from "./helpers";
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

async function openLookup(page: Page, language: "en" | "fa") {
  const toggle = page.locator("#menu-toggle");
  if (
    (page.viewportSize()?.width ?? 1280) <= 760 &&
    (await toggle.getAttribute("aria-expanded")) !== "true"
  )
    await toggle.click();
  const link = page
    .getByRole("navigation", {
      name: t(language, "Pages", "صفحه‌ها"),
      exact: true,
    })
    .getByRole("link", {
      name: t(language, "Lookup", "جست‌وجو"),
      exact: true,
      includeHidden: true,
    });
  if (!(await link.isVisible())) {
    const group = link
      .locator('xpath=ancestor::div[contains(@class, "nav-section")][1]')
      .getByRole("button")
      .first();
    if (
      (await group.count()) &&
      (await group.getAttribute("aria-expanded")) === "false"
    )
      await group.click();
  }
  await expect(link).toBeVisible();
  await link.click();
}

for (const language of ["en", "fa"] as const) {
  test(`K5 finishes a live reading while Lookup keeps the route, text and focus ${language}`, async ({
    page,
  }) => {
    const gate = deferred();
    const reference = "BACKGROUND-FICTIONAL-101";
    const reader = await mockReader(page, [
      {
        kind: "held",
        wait: gate.promise,
        response: fictionalResponse(reference),
      },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    const photo = await fictionalPhoto(
      page,
      "fictional-background-original.png",
    );
    const before = await readCanonicalBusinessEvidence(page);
    const original = await newLiveOriginal(page, photo, "photo", language);
    await pressRead(page, language);
    await expect.poll(() => reader.requests.length).toBe(1);
    const attempt = (await readCanonicalBusinessEvidence(page)).invoice
      .live_reading!.attempt_id;
    await openLookup(page, language);
    await expect(page).toHaveURL(/#lookup$/);
    const search = page.locator("input.lookup-search");
    await search.fill("0004");
    await search.focus();
    gate.resolve();
    const toast = page.getByTestId("live-reading-ready");
    await expect(toast).toContainText(reference);
    await expect(page).toHaveURL(/#lookup$/);
    await expect(search).toHaveValue("0004");
    await expect(search).toBeFocused();
    expect(reader.requests).toHaveLength(1);
    const background = await readCanonicalBusinessEvidence(page);
    const saved = background.invoices!.find(
      (invoice) => invoice.id === original.id,
    )!;
    expect(saved.status).toBe("review");
    expect(saved.live_reading).toMatchObject({
      phase: "complete",
      attempt_id: attempt,
    });
    expect(saved.supplier_invoice_number).toBe(reference);
    expect(saved.original_pages).toEqual(original.original_pages);
    expect(await retainedSourceHashes(page, saved)).toEqual([
      sourceHash(photo),
    ]);
    expectNoPosting(before, background);
    await toast
      .getByRole("button", {
        name: t(language, "Open", "باز کردن"),
        exact: true,
      })
      .click();
    const reviewed = await expectReview(page, original.id, language);
    expect(reviewed.supplier_invoice_number).toBe(reference);
    expect(reviewed.live_reading!.attempt_id).toBe(attempt);
    expect(reader.requests).toHaveLength(1);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
  });

  test(`K5 fills only its saved target while another invoice remains selected ${language}`, async ({
    page,
  }) => {
    const gate = deferred();
    const reference = "BACKGROUND-FICTIONAL-202";
    const reader = await mockReader(page, [
      {
        kind: "held",
        wait: gate.promise,
        response: fictionalResponse(reference),
      },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    const firstPhoto = await fictionalPhoto(
      page,
      "fictional-background-first.png",
      "#243f80",
    );
    const first = await newLiveOriginal(page, firstPhoto, "photo", language);
    await pressRead(page, language);
    await expect.poll(() => reader.requests.length).toBe(1);
    const secondPhoto = await fictionalPhoto(
      page,
      "fictional-background-second.png",
      "#38642a",
    );
    const second = await newLiveOriginal(page, secondPhoto, "photo", language);
    expect(second.id).not.toBe(first.id);
    const route = page.url();
    gate.resolve();
    const toast = page.getByTestId("live-reading-ready");
    await expect(toast).toContainText(reference);
    expect(page.url()).toBe(route);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice).toEqual(second);
    const completed = after.invoices!.find(
      (invoice) => invoice.id === first.id,
    )!;
    expect(completed.status).toBe("review");
    expect(completed.supplier_invoice_number).toBe(reference);
    expect(completed.original_pages).toEqual(first.original_pages);
    expect(await retainedSourceHashes(page, completed)).toEqual([
      sourceHash(firstPhoto),
    ]);
    expect(await retainedSourceHashes(page, after.invoice)).toEqual([
      sourceHash(secondPhoto),
    ]);
    expect(reader.requests).toHaveLength(1);
    expectNoPosting(before, after);
    await toast
      .getByRole("button", {
        name: t(language, "Open", "باز کردن"),
        exact: true,
      })
      .click();
    await expectReview(page, first.id, language);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
  });
}

for (const language of ["en", "fa"] as const) {
  test(`K5 F4 retires an active read across Discard and Undo, ignores its late answer and allows an explicit new read ${language}`, async ({
    page,
  }) => {
    const gate = deferred();
    const reader = await mockReader(page, [
      {
        kind: "held",
        wait: gate.promise,
        response: fictionalResponse("FICTIONAL-DISCARDED-ANSWER"),
      },
      {
        kind: "success",
        response: fictionalResponse("FICTIONAL-EXPLICIT-NEW-READ"),
      },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    const photo = await fictionalPhoto(
      page,
      "fictional-discard-during-read.png",
    );
    const original = await newLiveOriginal(page, photo, "photo", language);
    await pressRead(page, language);
    await expect.poll(() => reader.requests.length).toBe(1);
    const attempt = (await readCanonicalBusinessEvidence(page)).invoice
      .live_reading!.attempt_id;
    await page
      .locator("#invoice-review-header")
      .getByRole("button", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: t(language, "Discard invoice?", "فاکتور کنار گذاشته شود؟"),
      exact: true,
    });
    await dialog
      .getByRole("textbox", {
        name: t(language, "Reason", "دلیل"),
        exact: true,
      })
      .fill("Fictional duplicate upload; keep the original history");
    await dialog
      .getByRole("button", {
        name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        exact: true,
      })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(
        async () => (await readCanonicalBusinessEvidence(page)).invoice.status,
      )
      .toBe("cancelled");
    await openLookup(page, language);
    await page
      .getByTestId("undo-toast")
      .getByRole("button", { name: t(language, "Undo", "واگرد"), exact: true })
      .click();
    await expect
      .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice)
      .toMatchObject({
        id: original.id,
        status: "reading",
        live_reading: { phase: "cancelled" },
      });
    const restored = await readCanonicalBusinessEvidence(page);
    expect(restored.invoice.id).toBe(original.id);
    expect(restored.invoice.status).toBe("reading");
    expect(restored.invoice.live_reading!.attempt_id).not.toBe(attempt);
    expect(await retainedSourceHashes(page, restored.invoice)).toEqual([
      sourceHash(photo),
    ]);
    gate.resolve();
    await expect.poll(() => reader.finished).toBe(1);
    await expect(page).toHaveURL(/#lookup$/);
    await expect(page.getByTestId("live-reading-ready")).toHaveCount(0);
    const late = await readCanonicalBusinessEvidence(page);
    expect(late.invoice).toEqual(restored.invoice);
    expect(late.activity).toEqual(restored.activity);
    expectNoPosting(before, late);
    expect(reader.requests).toHaveLength(1);
    await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
    await page
      .getByRole("button", {
        name: t(language, "Read again", "خواندن دوباره"),
        exact: true,
      })
      .click();
    const reread = await expectReview(page, original.id, language);
    expect(reread.supplier_invoice_number).toBe("FICTIONAL-EXPLICIT-NEW-READ");
    expect(reread.live_reading!.attempt_id).not.toBe(attempt);
    expect(reread.live_reading!.attempt_id).not.toBe(
      restored.invoice.live_reading!.attempt_id,
    );
    expect(await retainedSourceHashes(page, reread)).toEqual([
      sourceHash(photo),
    ]);
    expect(reader.requests).toHaveLength(2);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
  });
}
