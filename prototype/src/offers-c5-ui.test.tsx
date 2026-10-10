import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { SESSION_KEY } from "./auth";
import i18n from "./i18n";
import { Offers } from "./screens/Offers";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
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

it("retranslates retained offer feedback after switching language without changing business records", () => {
  const state = initialState();
  const existing = state.offers.find(
    (offer) => offer.product_code === "0003" && offer.status === "active",
  )!;
  state.offers = [
    { ...existing, id: "offer:language", branch: "all", scope: "all" },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Stop offer" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Stop offer" })).getByRole(
      "button",
      { name: "Stop offer" },
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Stopped offer.");
  const stopped = localStorage.getItem(STORAGE_KEY);
  expect(JSON.parse(stopped!).offers[0].status).toBe("stopped");

  fireEvent.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(screen.getByRole("status")).toHaveTextContent("پیشنهاد متوقف شد.");
  expect(screen.getByRole("status")).not.toHaveTextContent("Stopped offer.");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(stopped);

  fireEvent.click(screen.getByRole("button", { name: "Use English" }));
  expect(screen.getByRole("status")).toHaveTextContent("Stopped offer.");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(stopped);
});
