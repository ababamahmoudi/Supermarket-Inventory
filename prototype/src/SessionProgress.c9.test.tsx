import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { beginAppWork } from "./app-work";
import { InitialSessionLoading, SessionProgress } from "./SessionProgress.c9";

const releases: (() => void)[] = [];
afterEach(() => {
  cleanup();
  releases.splice(0).forEach((release) => release());
  vi.useRealTimers();
});

it("does not show an initial Loading card before 300 ms or after a fast completed start", () => {
  vi.useFakeTimers();
  const view = render(
    <InitialSessionLoading>
      <p role="status">Loading…</p>
    </InitialSessionLoading>,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  view.rerender(<p>Ready</p>);
  act(() => vi.advanceTimersByTime(100));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("Ready")).toBeVisible();
});

it("shows first-start Loading only after the full 300 ms delay", () => {
  vi.useFakeTimers();
  render(
    <InitialSessionLoading>
      <p role="status">Loading…</p>
    </InitialSessionLoading>,
  );
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
});

it("does not flash progress for fast work and waits 300 ms again for later work", () => {
  vi.useFakeTimers();
  render(<SessionProgress label="Loading…" />);
  let fast!: () => void;
  act(() => {
    fast = beginAppWork();
    releases.push(fast);
    vi.advanceTimersByTime(299);
    fast();
  });
  act(() => vi.advanceTimersByTime(10));
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  act(() => releases.push(beginAppWork()));
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("progressbar", { name: "Loading…" })).toBeVisible();
});

it("keeps progress visible for overlapping work until the last actual lease completes", () => {
  vi.useFakeTimers();
  const first = beginAppWork();
  releases.push(first);
  render(<SessionProgress label="در حال بارگذاری…" />);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole("progressbar")).toBeVisible();
  let second!: () => void;
  act(() => {
    second = beginAppWork();
    releases.push(second);
    first();
  });
  expect(screen.getByRole("progressbar")).toBeVisible();
  act(() => second());
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
