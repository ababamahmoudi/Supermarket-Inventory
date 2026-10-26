import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setBranch, signIn } from "./helpers";
import {
  fillReturnCreation,
  installReturnCreationFixture,
} from "./return-create-r2c-helpers";
import type { OperationalReturn } from "../src/operations";

for (const role of [
  "Owner",
  "Manager",
  "Branch Supervisor",
  "Floor Worker",
  "Cashier",
] as const) {
  test(`R2c7.1 ${role} creates a durable photographed return without premature credit`, async ({
    page,
  }) => {
    const branch = role === "Branch Supervisor" ? "Branch 2" : "Branch 1";
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installReturnCreationFixture(page, branch);
    await signIn(page, role);
    await setBranch(page, branch);
    const before = await readCanonicalBusinessEvidence(page);
    const dialog = await fillReturnCreation(page);
    if (role === "Floor Worker" || role === "Cashier")
      await expect(dialog.getByText("Unit cost", { exact: false })).toHaveCount(
        0,
      );
    else
      await expect(dialog.getByText("$7.1250", { exact: true })).toBeVisible();
    await dialog
      .getByRole("button", { name: "Create return", exact: true })
      .click();
    await expect(
      dialog.getByRole("alert", { name: "What's missing" }),
    ).toContainText("Add at least one photo");
    const quantity = dialog.locator("#new-return-quantity");
    await quantity.scrollIntoViewIfNeeded();
    const original = await quantity.boundingBox();
    await quantity.fill("");
    await quantity.pressSequentially("2", { delay: 20 });
    expect(await quantity.boundingBox()).toMatchObject({
      x: original!.x,
      y: original!.y,
      width: original!.width,
      height: original!.height,
    });
    await dialog
      .getByLabel("Choose return photos", { exact: true })
      .setInputFiles("tests/fixtures/r2c-fictional-return-condition.png");
    await expect(dialog.getByRole("status")).toHaveText("1 photo saved");
    await dialog
      .getByRole("button", { name: "Create return", exact: true })
      .click();
    await expect(page).toHaveURL(/#return\?id=/);
    await expect(
      page.getByRole("heading", { name: "Return #1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Waiting for pickup", { exact: true }).first(),
    ).toBeVisible();
    if (role === "Cashier") {
      await expect(
        page.getByRole("button", { name: "Record pickup", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Cancel return", exact: true }),
      ).toHaveCount(0);
    }
    const saved = await readCanonicalBusinessEvidence(page);
    expect(saved.returns).toHaveLength(1);
    const record = saved.returns[0] as OperationalReturn;
    expect(record.created_by_role_snapshot).toBe(
      (
        {
          Owner: "owner",
          Manager: "manager",
          "Branch Supervisor": "branch_supervisor",
          "Floor Worker": "floor_worker",
          Cashier: "cashier",
        } as const
      )[role],
    );
    expect(record.lines[0]).toMatchObject({
      qty: 2,
      unit_cost: "7.1250",
      quantity_unit: "units",
    });
    expect(saved.ledger).toEqual(before.ledger);
    expect(saved.stock).toEqual(before.stock);
    expect(saved.stock_movements).toEqual(before.stock_movements);
    expect(saved.products).toEqual(before.products);
    const event = record.evidence!.find(
      (event) => event.kind === "creation_photo",
    )!;
    const expectedHash = createHash("sha256")
      .update(
        await readFile("tests/fixtures/r2c-fictional-return-condition.png"),
      )
      .digest("hex");
    expect(event.photo).toBe(
      `idb-file:v1:${record.company_id}:${expectedHash}`,
    );
    const stored = await page.evaluate(async (reference) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("supermarket-prototype-files-v1", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const record = await new Promise<{
          source: ArrayBuffer | Blob;
          sha256: string;
        }>((resolve, reject) => {
          const request = database
            .transaction("files", "readonly")
            .objectStore("files")
            .get(reference);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const bytes =
          record.source instanceof Blob
            ? await record.source.arrayBuffer()
            : record.source;
        return {
          sha256: record.sha256,
          bytes: Array.from(new Uint8Array(bytes)),
        };
      } finally {
        database.close();
      }
    }, event.photo!);
    expect(stored.sha256).toBe(expectedHash);
    expect(
      createHash("sha256").update(Buffer.from(stored.bytes)).digest("hex"),
    ).toBe(expectedHash);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Return #1", exact: true }),
    ).toBeVisible();
    const image = page.getByAltText("Retained local evidence photo");
    await expect
      .poll(() =>
        image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBe(960);
    await signIn(page, "Owner");
    await setBranch(page, branch);
    await page.goto("/#payables");
    await page
      .getByRole("link", { name: "Cloudbay Wholesale", exact: true })
      .first()
      .click();
    await expect(page.locator(".awaiting-return-credits")).toContainText(
      "Not deducted yet",
    );
    await expect(page.locator(".awaiting-return-credits")).toContainText(
      "$14.25",
    );
    await expect(page.locator(".awaiting-return-credits a")).toHaveAttribute(
      "href",
      `#return?id=${encodeURIComponent(record.id)}`,
    );
    await page.goto("/#suppliers?name=Cloudbay%20Wholesale");
    await expect(
      page
        .getByRole("heading", { name: "Cloudbay Wholesale", exact: true })
        .first(),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Returns/ }).click();
    await expect(page.locator("#main-content")).toContainText(
      "Waiting for pickup",
    );
    expect(errors).toEqual([]);
  });
}
