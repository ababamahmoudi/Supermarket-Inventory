import { afterEach, beforeEach, expect, it } from "vitest";
import { useState } from "react";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { authenticatedTestActor } from "../authority-test-fixture";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, useDemo } from "../store";
import { returnFixture } from "../return-test-fixture";
import { recordPickup } from "../operations";
import { ReturnActionForms } from "./ReturnActionForms";
import { ReturnMemoDocument } from "../return-memo";
import i18n from "../i18n";
const worker = (state: ReturnType<typeof returnFixture>) =>
  authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Demo Floor Worker",
  });
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
async function prepare(mode: "pickup" | "resolve") {
  const state = returnFixture();
  if (mode === "resolve") {
    state.returns[0].lines.push({
      product_code: "0001",
      qty: 2,
      reason: "Damaged",
      unit_cost: "5.0000",
    });
    recordPickup(state, worker(state), "c4-return", {
      quantities: { "0003": 3, "0001": 2 },
      representative: "Demo Driver",
      slip: "SIGNED-UI-001",
    });
  }
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: {
      selection: { kind: "location", location_id: "Branch 1" },
      name_en: "Demo Supervisor",
    },
  });
  fixtures.push(fixture);
  return fixture;
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
function Harness({ mode }: { mode: "pickup" | "resolve" }) {
  const { state, actor, t } = useDemo();
  const [loaded, setLoaded] = useState(false);
  const record = state.returns.find((item) => item.id === "c4-return");
  return (
    <>
      {actor && (
        <button onClick={() => setLoaded(true)}>Load fictional return</button>
      )}
      {loaded && record && actor && (
        <ReturnActionForms
          record={record}
          mode={mode}
          context={actor}
          onClose={() => {}}
          onSaved={() => {}}
        />
      )}
      <output data-testid="return-json">{JSON.stringify(record)}</output>
      <output data-testid="title">{t("Return", "مرجوعی")}</output>
    </>
  );
}
it("lists missing pickup fields with working links, clears only edited errors and saves shortfalls", async () => {
  const user = userEvent.setup();
  const fixture = await prepare("pickup");
  render(
    <DemoProvider options={fixture.options}>
      <Harness mode="pickup" />
    </DemoProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(screen.getByRole("button", { name: "Record pickup" }));
  const missing = screen.getByRole("alert", { name: "What's missing" });
  expect(within(missing).getAllByRole("link")).toHaveLength(4);
  await user.click(
    within(missing).getByRole("link", { name: /shortfall reason/ }),
  );
  expect(screen.getByLabelText("Shortfall reason")).toHaveFocus();
  await user.type(
    screen.getByLabelText("Shortfall reason"),
    "Rep refused: not covered by the return policy",
  );
  expect(within(missing).getAllByRole("link")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Actual pickup quantity"), {
    target: { value: "2" },
  });
  await user.click(screen.getByRole("combobox", { name: "Leftover outcome" }));
  await user.click(
    screen.getByRole("option", { name: "Keep for next pickup" }),
  );
  await user.type(
    screen.getByLabelText("Supplier representative name"),
    "Demo Driver",
  );
  await user.type(
    screen.getByLabelText("Signed paper pickup slip reference"),
    "SIGNED-UI-002",
  );
  await user.click(screen.getByRole("button", { name: "Record pickup" }));
  await waitFor(() => {
    const record = JSON.parse(screen.getByTestId("return-json").textContent!);
    expect(record.lines[0]).toMatchObject({
      picked_up: 2,
      pickup_shortfall: {
        reason: "Rep refused: not covered by the return policy",
        outcome: "keep_for_next_pickup",
        quantity: 1,
      },
    });
    expect(record.pickup_memos[0].reference).toBe("RM-0001");
  });
});
it("records mixed per-item replacement and outstanding date without exposing editable pickup", async () => {
  const user = userEvent.setup();
  const fixture = await prepare("resolve");
  render(
    <DemoProvider options={fixture.options}>
      <Harness mode="resolve" />
    </DemoProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  expect(
    screen.queryByLabelText("Actual pickup quantity"),
  ).not.toBeInTheDocument();
  const outcomes = screen.getAllByRole("combobox", { name: "Outcome" });
  await user.click(outcomes[0]);
  await user.click(screen.getByRole("option", { name: "Replaced" }));
  fireEvent.change(screen.getByLabelText("Original quantity covered"), {
    target: { value: "1" },
  });
  await user.type(
    screen.getByLabelText("Supplier representative name"),
    "Demo Driver",
  );
  await user.type(
    screen.getByLabelText("Replacement receipt reference"),
    "ACTUAL-REPLACEMENT-UI",
  );
  // This is a controlled styled date field; value is a real entered expected date.
  await user.click(screen.getByLabelText("Remaining expected date"));
  await user.click(screen.getByRole("button", { name: "2026-10-23" }));
  await user.click(screen.getByLabelText("Expected date"));
  await user.click(screen.getByRole("button", { name: "2026-10-23" }));
  await user.click(screen.getByRole("button", { name: "Record resolution" }));
  await waitFor(() => {
    const record = JSON.parse(screen.getByTestId("return-json").textContent!);
    expect(record.lines[0]).toMatchObject({ picked_up: 3, settled: 1 });
    expect(record.lines[1]).toMatchObject({
      picked_up: 2,
      outstanding_expected_date: "2026-10-23",
    });
    expect(record.pickup_memos[0].lines[0].quantity).toBe(3);
    expect(
      record.evidence.map((event: { kind: string }) => event.kind),
    ).toContain("replacement");
    expect(
      record.evidence.map((event: { kind: string }) => event.kind),
    ).toContain("outstanding");
  });
});
it("prints English by default in Persian UI and supports independent bilingual document choice", () => {
  const state = returnFixture();
  pickupForPrint();
  function pickupForPrint() {
    recordPickup(state, worker(state), "c4-return", {
      quantities: { "0003": 3 },
      representative: "Demo Driver",
      slip: "SIGNED-PRINT",
    });
  }
  const memo = state.returns[0].pickup_memos![0];
  const before = structuredClone(memo);
  const { container, rerender } = render(
    <ReturnMemoDocument memo={memo} language="fa" />,
  );
  expect(screen.getByRole("article")).toHaveAttribute("lang", "en");
  expect(screen.getByRole("article")).toHaveAttribute("dir", "ltr");
  expect(container.querySelector('[lang="fa"]')).toBeNull();
  expect(screen.queryByText("c4-return")).not.toBeInTheDocument();
  expect(screen.getByText("RM-0001")).toBeInTheDocument();
  expect(screen.getAllByText("Signature")).toHaveLength(2);
  rerender(
    <ReturnMemoDocument
      memo={memo}
      language="fa"
      documentLanguage="bilingual"
    />,
  );
  expect(screen.getByRole("article")).toHaveAttribute("dir", "rtl");
  expect(container.querySelector('[lang="fa"]')).not.toBeNull();
  expect(memo).toEqual(before);
});
