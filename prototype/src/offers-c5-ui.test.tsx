import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { Offers } from "./screens/Offers";
import { DemoProvider, useDemo } from "./store";
import { initialState } from "./e1-bootstrap";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "./test/rendered-ui-readiness";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
});

function Harness() {
  const { setLang } = useDemo();
  return (
    <>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <button onClick={() => setLang("en")}>Use English</button>
      <Offers />
    </>
  );
}

it("retranslates retained offer feedback after switching language without changing business records", async () => {
  const state = initialState();
  const existing = state.offers.find(
    (offer) => offer.product_code === "0003" && offer.status === "active",
  )!;
  state.offers = [
    { ...existing, id: "offer:language", branch: "all", scope: "all" },
  ];
  fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  // The real Provider resumes its private persisted session asynchronously.
  // The source capability affordance marks completion; permissions stay real.
  await renderedUiReady(
    () => screen.queryByRole("button", { name: "Create offer" }) !== null,
  );
  await screen.findByRole("button", { name: "Create offer" });
  const offerRow = document.querySelector('tr[data-product-code="0003"]')!;
  fireEvent.click(
    within(offerRow as HTMLElement).getByRole("button", { name: "More" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /^Stop offer/ }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Stop offer" })).getByRole(
      "button",
      { name: "Stop offer" },
    ),
  );
  await renderedUiReady(
    () =>
      screen.queryByRole("status")?.textContent?.includes("Stopped offer.") ===
      true,
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Stopped offer."),
  );
  const stopped = JSON.stringify(await fixture.readCanonical());
  expect(JSON.parse(stopped!).offers[0].status).toBe("stopped");

  fireEvent.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(screen.getByRole("status")).toHaveTextContent("پیشنهاد متوقف شد.");
  expect(screen.getByRole("status")).not.toHaveTextContent("Stopped offer.");
  expect(JSON.stringify(await fixture.readCanonical())).toBe(stopped);

  fireEvent.click(screen.getByRole("button", { name: "Use English" }));
  expect(screen.getByRole("status")).toHaveTextContent("Stopped offer.");
  expect(JSON.stringify(await fixture.readCanonical())).toBe(stopped);
});
