import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PageContentBoundary } from "./PageContentBoundary";

afterEach(() => vi.restoreAllMocks());

function BrokenPage({ broken }: { broken: boolean }) {
  if (broken) throw new Error("Fictional private invoice details stay private");
  return <p>Recovered page</p>;
}

for (const language of ["en", "fa"] as const) {
  it(`contains a real page render error and reloads without exposing details in ${language}`, () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    const title = language === "en" ? "Something went wrong" : "مشکلی پیش آمد";
    const label =
      language === "en" ? "Reload this page" : "بارگذاری دوبارهٔ این صفحه";
    render(
      <>
        <nav aria-label="App navigation">
          <a href="#lookup">Lookup</a>
        </nav>
        <PageContentBoundary
          resetKey="approvals:person:session"
          title={title}
          reloadLabel={label}
          onReload={reload}
        >
          <BrokenPage broken />
        </PageContentBoundary>
      </>,
    );
    expect(
      screen.getByRole("navigation", { name: "App navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("alert", { name: title })).toBeVisible();
    expect(screen.queryByText(/Fictional private/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
}

it("recovers caught errors only on an accepted route or identity reset", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const page = (resetKey: string, broken: boolean) => (
    <PageContentBoundary
      resetKey={resetKey}
      title="Something went wrong"
      reloadLabel="Reload this page"
      onReload={vi.fn()}
    >
      <BrokenPage broken={broken} />
    </PageContentBoundary>
  );
  const view = render(page("approvals:session-a", true));
  view.rerender(page("approvals:session-a", false));
  expect(screen.getByRole("alert")).toBeVisible();
  view.rerender(page("lookup:session-a", false));
  await waitFor(() => expect(screen.getByText("Recovered page")).toBeVisible());
  view.rerender(page("lookup:session-a", true));
  expect(screen.getByRole("alert")).toBeVisible();
  view.rerender(page("lookup:session-b", false));
  await waitFor(() => expect(screen.getByText("Recovered page")).toBeVisible());
});

it("preserves healthy page state through ordinary rerenders and route reset tokens", () => {
  const mounted = vi.fn();
  function HealthyPage() {
    const [value, setValue] = useState("");
    useEffect(() => {
      mounted();
    }, []);
    return (
      <input
        aria-label="Queued work"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  }
  const page = (resetKey: string) => (
    <PageContentBoundary
      resetKey={resetKey}
      title="Something went wrong"
      reloadLabel="Reload this page"
      onReload={vi.fn()}
    >
      <HealthyPage />
    </PageContentBoundary>
  );
  const view = render(page("timesheets?date=1:session"));
  fireEvent.change(screen.getByLabelText("Queued work"), {
    target: { value: "unsaved work" },
  });
  view.rerender(page("timesheets?date=2:session"));
  expect(screen.getByLabelText("Queued work")).toHaveValue("unsaved work");
  expect(mounted).toHaveBeenCalledTimes(1);
});
