import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test } from "@playwright/test";
import {
  invoiceImage,
  openInvoiceUpload,
  openShellAction,
  setBranch,
  signIn,
} from "./helpers";

test.setTimeout(60000);

test("a Floor Worker cannot read another branch's manual draft, and starting their own invoice preserves it for the Supervisor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await page
    .getByLabel("Supplier invoice number (optional)", { exact: true })
    .fill("PRIVATE-BRANCH-2");
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  const original = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(original.branch).toBe("Branch 2");

  await signIn(page, "Floor Worker");
  await expect(
    page.getByText("PRIVATE-BRANCH-2", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByLabel("Supplier invoice number (optional)", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  const own = await readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
  expect(own.invoice.branch).toBe("Branch 1");
  expect(
    own.invoices.find((invoice: { id: string }) => invoice.id === original.id),
  ).toEqual(original);

  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await page.goto("/#invoices");
  await page
    .locator(".invoice-saved-drafts .dialog-actions")
    .filter({ has: page.getByText("PRIVATE-BRANCH-2", { exact: true }) })
    .getByRole("button", { name: "Resume draft", exact: true })
    .click();
  await expect(
    page.getByLabel("Supplier invoice number (optional)", { exact: true }),
  ).toHaveValue("PRIVATE-BRANCH-2");
  const resumed = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(resumed).toEqual(original);
});

test("another branch's reading draft stays hidden and unchanged by reading timers or Demo answers", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await page.goto("/#invoices");
  // The original blank seed workspace belongs to North York. Create an actual
  // selected-store draft instead of uploading into that existing origin.
  const previousInvoiceId = (await readCanonicalBusinessEvidence(page)).invoice
    .id;
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await expect(page).toHaveURL((url) => {
    const [route, parameters] = url.hash.slice(1).split("?");
    const id = new URLSearchParams(parameters).get("id");
    return route === "invoices" && Boolean(id && id !== previousInvoiceId);
  });
  const acceptedInvoiceId = new URLSearchParams(
    new URL(page.url()).hash.split("?")[1],
  ).get("id");
  if (!acceptedInvoiceId)
    throw new Error("The accepted foreign-store draft ID is missing.");
  await expect
    .poll(async () => {
      const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
      return { id: invoice.id, branch: invoice.branch, status: invoice.status };
    })
    .toEqual({ id: acceptedInvoiceId, branch: "Branch 2", status: "draft" });
  await openInvoiceUpload(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  await expect(
    page.getByText("Reading invoice…", { exact: true }),
  ).toBeVisible();
  const original = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(original.status).toBe("reading");
  expect(original.branch).toBe("Branch 2");
  await signIn(page, "Floor Worker");
  await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
  await expect(
    page.getByLabel("Upload a PDF or photo", { exact: true }),
  ).toHaveCount(0);
  await (await openShellAction(page, "Demo")).click();
  await expect(
    page.getByRole("menuitem", {
      name: "Use fictional demo answer",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Attempt the exact public UI event used by the production Demo menu even
  // though the foreign-record action is hidden. No actor or command is forged.
  await page.evaluate(() =>
    window.dispatchEvent(new Event("arzon:demo-invoice-answer")),
  );
  await page.clock.runFor(2800);
  const untouched = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(untouched).toEqual(original);
  await page.reload();
  await page.clock.runFor(2800);
  const reloaded = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(reloaded).toEqual(original);
});
