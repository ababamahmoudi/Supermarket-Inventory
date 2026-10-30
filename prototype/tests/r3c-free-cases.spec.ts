import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  signIn,
  setBranch,
  setLanguage,
  openInvoiceDetails,
  confirmInvoiceLine,
} from "./helpers";
import {
  removeReceivingDemo,
  openReceivingLine,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { retainedSourceHashes } from "./r3-live-reading-helpers";

const choices = [
  {
    id: "bonus",
    en: "Free case (bonus)",
    fa: "کارتن رایگان (جایزه)",
    units: 48,
    cost: "1.2500",
  },
  {
    id: "two_for_one",
    en: "Two for the price of one",
    fa: "دو تا به قیمت یکی",
    units: 48,
    cost: "0.6250",
  },
  {
    id: "mistake",
    en: "Mistake on the invoice",
    fa: "اشتباه در فاکتور",
    units: 24,
    cost: "1.2500",
  },
] as const;

for (const language of ["en", "fa"] as const)
  for (const choice of choices)
    test(`R3c K8 actual floor answers ${choice.id} and manager posts conserved paid/free source ${language}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({
        width: info.project.name === "phone" ? 390 : 1440,
        height: 1000,
      });
      await signIn(page, "Owner");
      await setBranch(page, "Branch 1");
      await removeReceivingDemo(page, "en");
      const file = JSON.parse(
        readFileSync(
          new URL(
            "./fixtures/r2b-matching-readings-export.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const entry = file.invoices[0];
      const bytes = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 420;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 800, 420);
        ctx.fillStyle = "black";
        ctx.font = "22px sans-serif";
        [
          "FICTIONAL Northstar Test Foods",
          "K8-PAID-FREE",
          "NORTHSTAR JAM 24 X 300G | 1case | $30.00",
          "NORTHSTAR JAM 24 X 300G BONUS | 1case | $0.00",
          "Subtotal30.00 Tax0.00 TotalCAD30.00",
        ].forEach((line, index) => ctx.fillText(line, 12, 50 + index * 65));
        return canvas.toDataURL("image/png").split(",")[1];
      });
      entry.id = `fictional-k8-${choice.id}`;
      entry.file_name = "fictional-k8-paid-free.png";
      entry.pages = [{ page: 1, mime: "image/png", data: bytes }];
      entry.original_sha256 = [
        createHash("sha256").update(Buffer.from(bytes, "base64")).digest("hex"),
      ];
      entry.ai_reading.supplier_invoice_number = "K8-PAID-FREE";
      const paid = entry.ai_reading.lines[0];
      paid.description = "NORTHSTAR JAM 24 X 300G";
      entry.ai_reading.lines.push({
        ...paid,
        description: "NORTHSTAR JAM 24 X 300G BONUS",
        unit_cost_before_tax: "0.0000",
        cost_per_unit_before_tax: "0.0000",
        cost_per_case_before_tax: "0.0000",
        line_total: "0.00",
      });
      entry.checked_answer = {
        lines: [
          { description: "Northstar Jam 300 g" },
          { description: "Northstar Jam 300 g" },
        ],
      };
      file.invoices = [entry];
      await page.getByLabel("Choose file…", { exact: true }).setInputFiles({
        name: "fictional-k8.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(file)),
      });
      const preview = page.getByRole("dialog", {
        name: "Import invoice readings",
        exact: true,
      });
      await preview
        .getByRole("group", { name: "Reading values", exact: true })
        .getByRole("button", { name: "My checked values", exact: true })
        .click();
      await preview.locator(".ui-dialog-footer > .button-primary").click();
      await page
        .getByRole("dialog", { name: "Import complete", exact: true })
        .getByRole("button", { name: "Open Needs review", exact: true })
        .click();
      await page
        .getByRole("link", { name: "K8-PAID-FREE", exact: true })
        .click();
      await openInvoiceDetails(page);
      await page
        .getByRole("button", {
          name: "Looks right: Invoice details",
          exact: true,
        })
        .click();
      const firstEditor = await openReceivingLine(page, 0);
      await setReceivingCategory(page, firstEditor, "en");
      if (info.project.name === "phone")
        await firstEditor
          .getByRole("button", { name: "Close", exact: true })
          .click();
      const initial = await readCanonicalBusinessEvidence(page),
        id = initial.invoice.id;
      const hashes = await retainedSourceHashes(page, initial.invoice);
      expect(initial.invoice.lines).toHaveLength(1);
      expect(initial.products).toHaveLength(0);
      expect(initial.approvals).toHaveLength(0);
      await signIn(page, "Floor Worker");
      await setBranch(page, "Branch 1");
      if (language === "fa") await setLanguage(page, "fa");
      await page.goto(`/#invoices?id=${encodeURIComponent(id)}`);
      const phone = info.project.name === "phone";
      if (phone) await page.locator(".original-viewer-phone-trigger").click();
      const originalViewer = page.getByRole(
        phone ? "dialog" : "complementary",
        {
          name: word(language, "Original invoice", "فاکتور اصلی"),
          exact: true,
        },
      );
      await expect(originalViewer).toBeVisible();
      const originalImage = originalViewer.getByRole("img", {
        name: word(language, "Original invoice image", "تصویر اصل فاکتور"),
        exact: true,
      });
      await expect(originalImage).toBeVisible();
      await expect
        .poll(() =>
          originalImage.evaluate((image: HTMLImageElement) => ({
            width: image.naturalWidth,
            height: image.naturalHeight,
          })),
        )
        .toEqual({ width: 800, height: 420 });
      if (phone) {
        await originalViewer
          .getByRole("button", {
            name: word(language, "Close dialog", "بستن پنجره"),
            exact: true,
          })
          .click();
        await expect(originalViewer).not.toBeVisible();
      }
      const editor = await openReceivingLine(page, 0);
      const question = editor.getByTestId("free-case-question");
      await expect(editor.locator(".receiving-paper-mismatch")).toHaveCount(0);
      await expect(
        question.getByRole("heading", {
          name: word(language, "1 case free?", "1 کارتن رایگان؟"),
          exact: true,
        }),
      ).toBeVisible();
      await question
        .getByRole("button", {
          name: word(language, choice.en, choice.fa),
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
              .free_case_group?.decision,
        )
        .toBe(choice.id);
      const answered = await readCanonicalBusinessEvidence(page),
        answer = answered.invoice.lines[0].free_case_group!.answer!;
      await expect(editor.locator(".receiving-paper-mismatch")).toHaveCount(0);
      await expect(editor.locator(".receiving-printed-total")).toContainText(
        "30.00",
      );
      await expect(
        editor.locator(".receiving-printed-total"),
      ).not.toContainText("60.00");
      expect(answered.invoice.lines[0]).toMatchObject({
        qty_invoiced: choice.units,
        unit_cost_before_tax: choice.cost,
        line_total: "30.00",
      });
      expect(
        [...answered.activity]
          .reverse()
          .find((row) => row.action === "Answer free-case question")
          ?.actor_role_snapshot,
      ).toBe("floor_worker");
      expect(answered.ledger).toEqual(initial.ledger);
      expect(answered.stock_movements).toEqual(initial.stock_movements);
      expect(answered.products).toEqual(initial.products);
      await confirmInvoiceLine(page, editor);
      await signIn(page, "Manager");
      await setBranch(page, "Branch 1");
      if (language === "fa") await setLanguage(page, "fa");
      await page.goto(`/#invoices?id=${encodeURIComponent(id)}`);
      const totals = page.getByRole("button", {
        name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
        exact: true,
      });
      if (await totals.count()) await totals.click();
      await page
        .getByRole("button", {
          name: word(language, "Post invoice", "ثبت فاکتور"),
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog", {
          name: word(language, "Post invoice", "ثبت فاکتور"),
          exact: true,
        })
        .getByRole("button", {
          name: word(language, "Post invoice", "ثبت فاکتور"),
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.status,
        )
        .toBe("posted");
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.products).toHaveLength(1);
      expect(after.approvals).toHaveLength(1);
      expect(after.invoice.lines).toHaveLength(1);
      expect(after.invoice.final_total).toBe("30.00");
      expect(after.approvals[0].free_case_answer).toMatchObject({
        decision: choice.id,
        answer: { by_user_id: answer.by_user_id, by: answer.by },
      });
      expect(after.approvals[0].triggered_by_user_id).not.toBe(
        answer.by_user_id,
      );
      expect(await retainedSourceHashes(page, after.invoice)).toEqual(hashes);
      expect(after.supplier_items![0].printed_description_keys).toHaveLength(
        choice.id === "mistake" ? 1 : 2,
      );
      await page.goto("/#approvals");
      const approvalRow = page.locator(
        `[data-approval-id="${after.approvals[0].id}"]`,
      );
      await expect(approvalRow).toBeVisible();
      await approvalRow
        .getByRole("button", {
          name: word(language, "Approve product", "تأیید کالا"),
          exact: true,
        })
        .click();
      const approvalDialog = page.getByRole("dialog", {
        name: word(language, "Review approval", "بررسی تأیید"),
        exact: true,
      });
      const freeCaseApproval = approvalDialog.getByTestId("free-case-approval");
      await expect(freeCaseApproval).toBeVisible();
      await expect(freeCaseApproval).toContainText(
        word(language, choice.en, choice.fa),
      );
      await expect(freeCaseApproval).toContainText(answer.by);
      await page.screenshot({
        path: info.outputPath(
          `free-case-approval-${choice.id}-${language}.png`,
        ),
        fullPage: true,
      });
      await approvalDialog
        .getByRole("button", {
          name: word(language, "Approve product", "تأیید کالا"),
          exact: true,
        })
        .click();
      await expect(approvalDialog).not.toBeVisible();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).approvals[0].status,
        )
        .toBe("approved");
      const approved = await readCanonicalBusinessEvidence(page);
      expect(approved.approvals[0]).toMatchObject({
        decided_by_user_id: after.approvals[0].triggered_by_user_id,
        decision_attribution: {
          username: "manager",
          role_snapshot: "manager",
        },
        free_case_answer: {
          decision: choice.id,
          answer: { by_user_id: answer.by_user_id, by: answer.by },
        },
      });
      expect(approved.approvals[0].decided_by_user_id).not.toBe(
        answer.by_user_id,
      );
      expect(approved.products[0].status).toBe("active");
      expect(approved.ledger).toEqual(after.ledger);
      expect(approved.stock_movements).toEqual(after.stock_movements);
      expect(await retainedSourceHashes(page, approved.invoice)).toEqual(
        hashes,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: info.outputPath(`free-case-${choice.id}-${language}.png`),
        fullPage: true,
      });
    });
