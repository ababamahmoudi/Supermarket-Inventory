import { expect, test, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { configuredPersonExpectation } from "./configured-person-expectations";
import { chooseOption, setBranch, signIn, type DemoRole } from "./helpers";

test.setTimeout(120000);

const statusChoices = (page: Page) =>
  page.getByRole("group", { name: "Note status", exact: true });
const undo = (page: Page) =>
  page
    .locator(".undo-toast")
    .getByRole("button", { name: "Undo", exact: true });
const unchangedOperations = (
  state: Awaited<ReturnType<typeof readCanonicalBusinessEvidence>>,
) => ({
  stock: state.stock,
  movements: state.stock_movements,
  ledger: state.ledger,
  returns: state.returns,
  invoices: state.invoices,
  prices: state.products.map((product) => ({
    code: product.code,
    price: product.selling_price,
    cost: product.last_cost_before_tax,
  })),
});

test("C9 readers keep separate receipts while Manager done, reopen and Undo preserve the other reader and all operational evidence", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#notes");
  await page.getByRole("tab", { name: /^For managers/ }).click();
  const before = unchangedOperations(await readCanonicalBusinessEvidence(page));
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page
    .getByLabel("Note", { exact: true })
    .fill("C9 handover needs a manager decision");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const card = page
    .locator("[data-note]")
    .filter({ hasText: "C9 handover needs a manager decision" });
  await expect(
    card.getByRole("button", { name: "Mark done", exact: true }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Mark as seen", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
  const readNote = async () =>
    (await readCanonicalBusinessEvidence(page)).notes.find(
      (note) => note.text === "C9 handover needs a manager decision",
    )!;
  const firstSeen = await readNote();
  expect(firstSeen.status).toBe("open");
  expect(firstSeen.seen_receipts?.map((receipt) => receipt.user_id)).toEqual([
    configuredPersonExpectation("ny-floor").id,
  ]);

  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto(`/#notes?note=${encodeURIComponent(firstSeen.id)}`);
  await expect(
    page.getByRole("tab", { name: /^For managers/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    statusChoices(page).getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Mark as seen", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
  await expect(card.locator(".note-readers")).toContainText(" and you at ");
  await undo(page).click();
  await expect(
    card.getByRole("button", { name: "Mark as seen", exact: true }),
  ).toBeEnabled();
  expect((await readNote()).seen_receipts).toEqual(firstSeen.seen_receipts);

  await card.getByRole("button", { name: "Mark as seen", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
  const bothReaders = (await readNote()).seen_receipts;
  await card.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(card.locator(".badge")).toHaveText("Done");
  await expect(card.locator(".note-completion")).toContainText(
    configuredPersonExpectation("manager").name_en,
  );
  await expect(card.locator(".note-completion")).toContainText(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,
  );
  expect((await readNote()).seen_receipts).toEqual(bothReaders);
  await page
    .getByRole("button", { name: "Not seen by me", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page
    .getByRole("button", { name: "Not seen by me", exact: true })
    .click();
  await card.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(card.locator(".badge")).toHaveText("Seen");
  expect((await readNote()).seen_receipts).toEqual(bothReaders);
  await undo(page).click();
  await expect(card.locator(".badge")).toHaveText("Done");
  expect((await readNote()).seen_receipts).toEqual(bothReaders);
  await page.reload();
  await expect(card.locator(".badge")).toHaveText("Done");
  await expect(
    card.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
  expect(
    unchangedOperations(await readCanonicalBusinessEvidence(page)),
  ).toEqual(before);
});

test("C9 four genuine readers have ordered persisted receipts, accessible full disclosure and no Cashier done grant", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#notes");
  await page.getByRole("button", { name: "New notebook", exact: true }).click();
  const editor = page.getByRole("dialog", {
    name: "New notebook",
    exact: true,
  });
  await editor
    .getByLabel("Name (English)", { exact: true })
    .fill("C9 reader handover");
  await chooseOption(
    page,
    editor.getByLabel("Branch", { exact: true }),
    "Branch 1",
    "North York",
  );
  await editor
    .getByRole("group", { name: "Who can read", exact: true })
    .getByRole("checkbox", { name: "Cashier", exact: true })
    .check();
  await editor
    .getByRole("button", { name: "Save notebook", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page
    .getByLabel("Note", { exact: true })
    .fill("C9 four people read the same handover");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const card = page
    .locator("[data-notebook-entry]")
    .filter({ hasText: "C9 four people read the same handover" });
  const readers: [DemoRole, string][] = [
    ["Manager", "manager"],
    ["Owner", "owner"],
    ["Floor Worker", "ny-floor"],
    ["Cashier", "cashier"],
  ];
  for (const [role, username] of readers) {
    await signIn(page, role);
    await setBranch(page, "Branch 1");
    await page.goto("/#notes");
    await page.getByRole("tab", { name: /^C9 reader handover/ }).click();
    await card
      .getByRole("button", { name: "Mark as seen", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Seen by you", exact: true }),
    ).toBeDisabled();
    const receipts = (
      await readCanonicalBusinessEvidence(page)
    ).notebook_entries!.find(
      (entry) => entry.text === "C9 four people read the same handover",
    )!.seen_receipts!;
    expect(receipts.at(-1)?.user_id).toBe(
      configuredPersonExpectation(username).id,
    );
  }
  await expect(
    card.getByRole("button", { name: /^(Mark done|Reopen)$/ }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: /^C9 reader handover/ }).click();
  await expect(card.locator(".badge")).toHaveText("Seen");
  await expect(
    card.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
  const disclosure = card.locator(".note-readers-details");
  await expect(disclosure.locator("summary")).toContainText("and 1 other");
  await expect(disclosure.locator("summary")).not.toContainText(
    /\d{4}-\d{2}-\d{2}/,
  );
  await expect(disclosure.locator("summary")).toHaveAttribute(
    "title",
    /you at \d{2}:\d{2}/,
  );
  const everyone = disclosure.getByRole("list", {
    name: "Everyone who has seen this note",
    exact: true,
  });
  await expect(everyone).toBeHidden();
  await disclosure.locator("summary").click();
  await expect(everyone).toBeVisible();
  await expect(everyone.getByRole("listitem")).toHaveCount(4);
  const final = (
    await readCanonicalBusinessEvidence(page)
  ).notebook_entries!.find(
    (entry) => entry.text === "C9 four people read the same handover",
  )!;
  expect(final.status).toBe("open");
  expect(final.seen_receipts?.map((receipt) => receipt.user_id)).toEqual(
    readers.map(([, username]) => configuredPersonExpectation(username).id),
  );
  expect(new Set(final.seen_receipts?.map((receipt) => receipt.id)).size).toBe(
    4,
  );
});
