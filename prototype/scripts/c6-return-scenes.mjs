import { expect } from "@playwright/test";
import { readC8State } from "./capture-c8-proof.mjs";

/** All return scenes use actual UI pickup/settlement events and the retained signed memo. */
export async function setupReturnScene(page, scene, { button, field, choose }) {
  if (scene === "returns-list") {
    await page.goto("/#returns");
    await expect(page.locator(".returns-overview")).toBeVisible();
    return {
      selector: ".returns-overview",
      capture: "page",
      evidence: { workflow: "allowed_open_returns" },
    };
  }
  await page.goto("/#return?id=demo-return-1");
  const header = page.locator(".return-header-card");
  await button(header, "Record pickup").click();
  let form = page.locator(".return-action-card");
  await field(form, "Actual pickup quantity").fill(
    scene === "pickup-shortfall" ? "2" : "3",
  );
  if (scene === "pickup-shortfall") {
    await field(form, "Shortfall reason").fill(
      "Rep refused: not covered by the return policy",
    );
    await choose(page, field(form, "Leftover outcome"), "Keep for next pickup");
  }
  await field(form, "Supplier representative name").fill(
    "Fictional Representative",
  );
  await field(form, "Signed paper pickup slip reference").fill(
    "C6-SIGNED-PAPER-001",
  );
  if (scene === "pickup-shortfall")
    return {
      selector: ".return-action-card",
      capture: "page",
      evidence: {
        workflow: "pickup_shortfall_form",
        committed: false,
        actual_pickup: 2,
        leftover: 1,
        outcome: "keep_for_next_pickup",
      },
    };
  await button(form, "Record pickup").click();
  await expect(page.locator(".return-detail-title")).toContainText(
    "Waiting for credit",
  );
  const pickup = (await readC8State(page)).returns.find(
    (record) => record.id === "demo-return-1",
  );
  if (scene === "return-memo") {
    const reference = pickup.pickup_memos.at(-1).reference;
    return {
      selector: ".ui-dialog[open]",
      capture: "viewport",
      afterAppearance: async () => {
        await button(page.locator(".return-memos-card"), reference).click();
        await expect(
          page.locator('.return-memo-document[lang="en"]'),
        ).toBeVisible();
      },
      evidence: {
        workflow: "signed_pickup_memo",
        reference,
        pickup_quantity: pickup.lines[0].picked_up,
      },
    };
  }
  if (scene !== "partial-resolution")
    throw new Error(`Unknown return capture scene: ${scene}`);
  await button(header, "Record resolution").click();
  form = page.locator(".return-action-card");
  await choose(page, field(form, "Outcome"), "Replaced");
  await field(form, "Original quantity covered").fill("1");
  await field(form, "Actual replacement quantity").fill("1");
  await field(form, "Supplier representative name").fill(
    "Fictional Representative",
  );
  await field(form, "Replacement receipt reference").fill(
    "C6-ACTUAL-REPLACEMENT-001",
  );
  await field(form, "Remaining expected date").click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await field(form, "Note (optional)").fill(
    "The remaining two units are still outstanding.",
  );
  await button(form, "Record resolution").click();
  await expect(page.locator(".return-detail-title")).toContainText(
    "Waiting for credit",
  );
  await button(header, "Record resolution").click();
  const resolution = (await readC8State(page)).returns.find(
    (record) => record.id === "demo-return-1",
  );
  return {
    selector: ".return-detail",
    capture: "page",
    evidence: {
      workflow: "partial_replacement_outstanding",
      locked_pickup: resolution.lines[0].picked_up,
      resolved: resolution.lines[0].settled,
      outstanding: resolution.lines[0].picked_up - resolution.lines[0].settled,
      expected_date: resolution.lines[0].outstanding_expected_date,
      signed_memo: resolution.pickup_memos.at(-1).reference,
    },
  };
}
