import { cleanup, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { NoteEvidence } from "./screens/Notes";
import type { DemoState } from "./types";

let view: {
  state: DemoState;
  actor: { user_id: string } | null;
  lang: string;
  t: (en: string, fa?: string) => string;
};
vi.mock("./store", () => ({ useDemo: () => view }));
afterEach(cleanup);

const receipt = (id: string, user_id: string, by: string, minute: number) => ({
  id,
  user_id,
  by,
  at: `2026-10-19T18:${String(minute).padStart(2, "0")}:00.000Z`,
});
const note = (receipts: ReturnType<typeof receipt>[]) =>
  ({
    id: "note-s1",
    type: "note_to_supervisor",
    status: "open",
    text: "Readers",
    seen_receipts: receipts,
  }) as unknown as Parameters<typeof NoteEvidence>[0]["item"];

it("lists up to three readers on one line without a disclosure", () => {
  view = {
    state: initialState(),
    actor: { user_id: "reader-3" },
    lang: "en",
    t: (en) => en,
  };
  const { container } = render(
    <NoteEvidence
      item={note([
        receipt("r1", "reader-1", "Demo Owner", 1),
        receipt("r2", "reader-2", "Demo North York Floor Worker", 2),
        receipt("r3", "reader-3", "Demo Cashier", 3),
      ])}
    />,
  );
  expect(container.querySelector(".note-readers-details")).toBeNull();
  expect(container.querySelector(".note-readers")?.textContent).toMatch(
    /^Seen by .+ at \d{2}:\d{2}, .+ at \d{2}:\d{2} and you at \d{2}:\d{2}$/,
  );
});

it("folds a fourth reader into 'and 1 other' and keeps everyone, in order, behind the disclosure", () => {
  view = {
    state: initialState(),
    actor: { user_id: "reader-4" },
    lang: "en",
    t: (en) => en,
  };
  const { container } = render(
    <NoteEvidence
      item={note([
        receipt("r1", "reader-1", "Demo Manager", 1),
        receipt("r2", "reader-2", "Demo Owner", 2),
        receipt("r3", "reader-3", "Demo North York Floor Worker", 3),
        receipt("r4", "reader-4", "Demo Cashier", 4),
      ])}
    />,
  );
  const details = container.querySelector<HTMLDetailsElement>(
    ".note-readers-details",
  )!;
  expect(details).not.toBeNull();
  const summary = details.querySelector("summary")!;
  expect(summary.textContent).toContain("and 1 other");
  expect(summary.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(summary.getAttribute("title")).toMatch(/you at \d{2}:\d{2}$/);
  const everyone = within(details).getByRole("list", {
    name: "Everyone who has seen this note",
    hidden: true,
  });
  const items = within(everyone).getAllByRole("listitem", { hidden: true });
  expect(items).toHaveLength(4);
  expect(items.at(-1)?.textContent).toMatch(/^you at \d{2}:\d{2}$/);
});

it("says 'and 2 others' from five readers", () => {
  view = {
    state: initialState(),
    actor: { user_id: "someone-else" },
    lang: "en",
    t: (en) => en,
  };
  const { container } = render(
    <NoteEvidence
      item={note(
        [1, 2, 3, 4, 5].map((n) =>
          receipt(`r${n}`, `reader-${n}`, `Reader ${n}`, n),
        ),
      )}
    />,
  );
  expect(
    container.querySelector(".note-readers-details summary")?.textContent,
  ).toContain("and 2 others");
});
