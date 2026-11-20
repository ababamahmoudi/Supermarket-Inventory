import { expect, test, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openInvoiceDetails, setLanguage } from "./helpers";
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

async function manual(page: Page, language: "en" | "fa", reference?: string) {
  const previousId = (await readCanonicalBusinessEvidence(page)).invoice.id;
  const close = page.getByRole("button", {
    name: t(language, "Save and close", "ذخیره و بستن"),
    exact: true,
  });
  if (await close.isVisible()) await close.click();
  await page
    .getByRole("button", {
      name: t(language, "New invoice", "فاکتور جدید"),
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", {
      name: t(language, "New invoice", "فاکتور جدید"),
      exact: true,
    })
    .getByRole("button", {
      name: t(language, "Manual entry", "ورود دستی"),
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: t(language, "Invoice lines", "ردیف‌های فاکتور"),
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readCanonicalBusinessEvidence(page)).invoice.id)
    .not.toBe(previousId);
  const acceptedId = (await readCanonicalBusinessEvidence(page)).invoice.id;
  await expect(page).toHaveURL(
    (url) =>
      new URLSearchParams(url.hash.split("?")[1]).get("id") === acceptedId,
  );
  await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(0);
  if (reference) {
    await openInvoiceDetails(page);
    await page
      .getByLabel(t(language, "Invoice number", "شماره فاکتور"), {
        exact: true,
      })
      .fill(reference);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice
            .supplier_invoice_number,
      )
      .toBe(reference);
  }
  return (await readCanonicalBusinessEvidence(page)).invoice;
}
async function geometry(page: Page) {
  return page.evaluate(() => {
    const ready = document.querySelector<HTMLElement>(
      '[data-testid="live-reading-ready"]',
    )!;
    const undo = document.querySelector<HTMLElement>(".undo-toast-stack");
    const footer = document.querySelector<HTMLElement>(".receiving-progress");
    const failures: string[] = [];
    const visible = (element: HTMLElement | null) =>
      element &&
      element.getBoundingClientRect().height &&
      getComputedStyle(element).display !== "none";
    const readyBox = ready.getBoundingClientRect();
    const undoBox = visible(undo) ? undo!.getBoundingClientRect() : null;
    const footerBox =
      visible(footer) && getComputedStyle(footer!).position === "fixed"
        ? footer!.getBoundingClientRect()
        : null;
    if (footerBox && readyBox.bottom > footerBox.top - 4)
      failures.push("ready notice overlaps the actual receiving footer");
    if (footerBox && undoBox && undoBox.bottom > footerBox.top - 4)
      failures.push("Undo overlaps the actual receiving footer");
    if (undoBox && readyBox.bottom > undoBox.top - 4)
      failures.push("ready notice overlaps Undo");
    if (
      readyBox.top < 0 ||
      readyBox.bottom > innerHeight + 2 ||
      readyBox.left < -2 ||
      readyBox.right > innerWidth + 2
    )
      failures.push("ready notice leaves viewport");
    const button = footer?.querySelector<HTMLElement>(
      ".receiving-post-control > button",
    );
    const post = button?.getBoundingClientRect();
    if (post && footerBox) {
      const hit = document.elementFromPoint(
        post.x + post.width / 2,
        post.y + post.height / 2,
      );
      if (!hit || !button!.contains(hit))
        failures.push("Post hit target is covered");
    }
    const box = (value: DOMRect | null) =>
      value
        ? {
            x: value.x,
            y: value.y,
            width: value.width,
            height: value.height,
            top: value.top,
            bottom: value.bottom,
          }
        : null;
    return {
      failures,
      ready: box(readyBox),
      undo: box(undoBox),
      footer: box(footerBox),
      post: box(post ?? null),
    };
  });
}
async function lookup(page: Page, language: "en" | "fa") {
  const toggle = page.locator("#menu-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
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
  await link.click();
}
for (const language of ["en", "fa"] as const) {
  test(`K5 ready and Undo clear measured phone Post, New invoice and Lookup/Open ${language}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 932 });
    const gate = deferred();
    const reference = "FICTIONAL-FOOTER-READY";
    const reader = await mockReader(page, [
      {
        kind: "held",
        wait: gate.promise,
        response: fictionalResponse(reference),
      },
    ]);
    try {
      await configureLive(page);
      await setLanguage(page, language);
      const photo = await fictionalPhoto(page, "fictional-footer-original.png");
      const source = await newLiveOriginal(page, photo, "photo", language);
      await pressRead(page, language);
      await expect.poll(() => reader.requests.length).toBe(1);
      const other = await manual(page, language, "FICTIONAL-FOOTER-MANUAL");
      const empty = await manual(page, language);
      expect(empty.id).not.toBe(other.id);
      await page
        .locator("#invoice-review-header")
        .getByRole("button", {
          name: t(language, "Discard invoice", "کنار گذاشتن فاکتور"),
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.status,
        )
        .toBe("cancelled");
      await page.getByRole("tab", { name: /^(Drafts|پیش‌نویس‌ها) / }).click();
      await page
        .locator(
          `.invoice-saved-table a.entity-link[href="#invoices?id=${encodeURIComponent(other.id)}"]`,
        )
        .click();
      await expect
        .poll(
          async () => (await readCanonicalBusinessEvidence(page)).invoice.id,
        )
        .toBe(other.id);
      const undo = page.getByTestId("undo-toast").getByRole("button", {
        name: t(language, "Undo", "واگرد"),
        exact: true,
      });
      await undo.focus();
      const before = await readCanonicalBusinessEvidence(page);
      gate.resolve();
      const ready = page.getByTestId("live-reading-ready");
      await expect(ready).toContainText(reference);
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      const clean = await geometry(page);
      expect(clean.footer).not.toBeNull();
      expect(clean.undo).not.toBeNull();
      const region = page.locator(".live-reading-ready-region");
      const oldStyle = await region.getAttribute("style");
      await region.evaluate((element) => {
        (element as HTMLElement).style.insetBlockEnd = "24px";
      });
      expect((await geometry(page)).failures).toContain(
        "ready notice overlaps the actual receiving footer",
      );
      await region.evaluate((element, value) => {
        if (value === null) element.removeAttribute("style");
        else element.setAttribute("style", value);
      }, oldStyle);
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      const footer = page.locator(".receiving-progress");
      const footerStyle = await footer.getAttribute("style");
      await footer.evaluate((element) => {
        const style = getComputedStyle(element);
        (element as HTMLElement).style.paddingBottom =
          `${parseFloat(style.paddingBottom) + 40}px`;
      });
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      await expect
        .poll(async () => (await geometry(page)).ready!.bottom)
        .toBeLessThanOrEqual(clean.ready!.bottom - 38);
      await footer.evaluate((element, value) => {
        if (value === null) element.removeAttribute("style");
        else element.setAttribute("style", value);
      }, footerStyle);
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      const post = (await geometry(page)).post!;
      // The genuine incomplete-invoice Post remains pointer-operable and opens
      // its guarded missing-fields panel; no force click bypasses an overlay.
      await page.mouse.click(post.x + post.width / 2, post.y + post.height / 2);
      await expect(
        page.getByRole("alert", {
          name: t(language, "What's missing", "موارد ناقص"),
          exact: true,
        }),
      ).toBeVisible();
      expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
        before.invoice,
      );
      await undo.focus();
      await page
        .getByRole("button", {
          name: t(language, "Save and close", "ذخیره و بستن"),
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: t(language, "New invoice", "فاکتور جدید"),
          exact: true,
        })
        .click();
      const chooser = page.getByRole("dialog", {
        name: t(language, "New invoice", "فاکتور جدید"),
        exact: true,
      });
      await expect(chooser).toBeVisible();
      await expect(
        chooser.getByRole("button", {
          name: t(language, "Manual entry", "ورود دستی"),
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("dialog-action-status")).toHaveCount(0);
      await chooser
        .getByRole("button", {
          name: t(language, "Cancel", "انصراف"),
          exact: true,
        })
        .click();
      await undo.focus();
      await lookup(page, language);
      const search = page.locator("input.lookup-search");
      await search.fill("0004");
      await expect(search).toHaveValue("0004");
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      await undo.click();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoices!.find(
              (invoice) => invoice.id === empty.id,
            )?.status,
        )
        .toBe("draft");
      await expect
        .poll(async () => (await geometry(page)).failures)
        .toEqual([]);
      await expect(ready).toContainText(reference);
      await ready
        .getByRole("button", {
          name: t(language, "Open", "باز کردن"),
          exact: true,
        })
        .click();
      const reviewed = await expectReview(page, source.id, language);
      expect(reviewed.supplier_invoice_number).toBe(reference);
      expect(await retainedSourceHashes(page, reviewed)).toEqual([
        sourceHash(photo),
      ]);
      expectNoPosting(before, await readCanonicalBusinessEvidence(page));
      expect(reader.requests).toHaveLength(1);
      await info.attach("measured-ready-undo-and-phone-footer", {
        body: JSON.stringify(clean, null, 2),
        contentType: "application/json",
      });
    } finally {
      gate.resolve();
    }
  });
}
