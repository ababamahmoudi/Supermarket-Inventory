import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { initialState, DemoProvider, useDemo } from "../store";
import type { E1DemoContextValue } from "../e1-demo-context";
import { loadInvoiceOriginal } from "../invoice-file-access";
import { invoiceView } from "../invoice-projections";
import { OriginalInvoice } from "./OriginalInvoice";
import { OriginalViewer } from "./invoice-review/OriginalViewer";

let context: E1DemoContextValue | null = null;
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
function Sample() {
  const current = useDemo();
  useEffect(() => {
    context = current;
  }, [current]);
  return current.state.invoice_workspace ? (
    <OriginalInvoice invoice={current.state.invoice_workspace.invoice} />
  ) : null;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  context = null;
  window.location.hash = "#invoices";
});
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
async function fixture() {
  const state = initialState();
  const pages = ["Fictional page one", "Fictional page two"].map((text, i) => ({
    file_name: `fictional-page-${i + 1}.svg`,
    file_type: "image/svg+xml",
    file_data: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><text>${text}</text></svg>`)}`,
    file_size: text.length,
    original_sha256: String(i + 1).repeat(64),
  }));
  Object.assign(state.invoice, pages[0], { original_pages: pages });
  const result = await authenticatedProviderFixture({ state, role: "manager" });
  fixtures.push(result);
  return result;
}
it("opens each retained image page with navigation and keeps private page references out of the DTO", async () => {
  const actual = await fixture();
  const canonicalBefore = await actual.readCanonical();
  const user = userEvent.setup();
  render(
    <DemoProvider options={actual.options}>
      <Sample />
    </DemoProvider>,
  );
  await screen.findByLabelText("Page 1 of 2", {}, { timeout: 10_000 });
  const view = await context!.query(
    "invoices.read",
    {
      company_id: actual.actor.company_id,
      kind: "company_shared",
      entity_id: canonicalBefore.invoice.id,
    },
    (state, actor) => invoiceView(state, actor, canonicalBefore.invoice.id),
  );
  expect(view.original_page_count).toBe(2);
  expect(view).not.toHaveProperty("original_pages");
  expect(JSON.stringify(view)).not.toContain("idb-file:");
  await waitFor(() =>
    expect(
      screen.getByRole("img", { name: "Original invoice image" }),
    ).toHaveAttribute("src", expect.stringMatching(/^blob:/)),
  );
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  const firstUrl = screen
    .getByRole("img", { name: "Original invoice image" })
    .getAttribute("src");
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByLabelText("Page 2 of 2");
  await waitFor(() =>
    expect(
      screen.getByRole("img", { name: "Original invoice image" }),
    ).toHaveAttribute("src", expect.stringMatching(/^blob:/)),
  );
  expect(
    screen
      .getByRole("img", { name: "Original invoice image" })
      .getAttribute("src"),
  ).not.toBe(firstUrl);
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(await screen.findByText("fictional-page-2.svg")).toBeInTheDocument();
  const first = await loadInvoiceOriginal(context!.query, {
    company_id: actual.actor.company_id,
    invoice_id: canonicalBefore.invoice.id,
  });
  const second = await loadInvoiceOriginal(context!.query, {
    company_id: actual.actor.company_id,
    invoice_id: canonicalBefore.invoice.id,
    page: 1,
  });
  expect(await first.source.text()).toContain("Fictional page one");
  expect(await second.source.text()).toContain("Fictional page two");
  expect(second.name).toBe("fictional-page-2.svg");
  expect((await actual.readCanonical()).invoice).toEqual(
    canonicalBefore.invoice,
  );
});
it("rejects unavailable or invalid pages instead of substituting page one", async () => {
  const actual = await fixture();
  render(
    <DemoProvider options={actual.options}>
      <Sample />
    </DemoProvider>,
  );
  await waitFor(
    () => expect(context?.actor?.user_id).toBe(actual.actor.user_id),
    { timeout: 10_000 },
  );
  for (const page of [-1, 2, 0.5, Number.NaN]) {
    await expect(
      loadInvoiceOriginal(context!.query, {
        company_id: actual.actor.company_id,
        invoice_id: (await actual.readCanonical()).invoice.id,
        page,
      }),
    ).rejects.toThrow(/Original (page|evidence)/);
  }
});

it("rechecks the same page reference after loading bytes before making them visible", async () => {
  const actual = await fixture();
  render(
    <DemoProvider options={actual.options}>
      <Sample />
    </DemoProvider>,
  );
  await screen.findByLabelText("Page 1 of 2", {}, { timeout: 10_000 });
  const invoiceId = (await actual.readCanonical()).invoice.id;
  const current = context!;
  let queryCount = 0;
  const guardedQuery: typeof current.query = async (
    capability,
    scope,
    read,
  ) => {
    queryCount++;
    if (queryCount === 2)
      await current.command(
        "invoices.edit",
        {
          company_id: actual.actor.company_id,
          kind: "company_shared",
          entity_id: invoiceId,
        },
        (state) => {
          state.invoice.original_pages![1].file_data =
            state.invoice.original_pages![0].file_data;
        },
      );
    return current.query(capability, scope, read);
  };
  await expect(
    loadInvoiceOriginal(guardedQuery, {
      company_id: actual.actor.company_id,
      invoice_id: invoiceId,
      page: 1,
    }),
  ).rejects.toThrow("Original evidence changed.");
});

it("opens at full width with rotation and keeps replacement in the More menu", async () => {
  const actual = await fixture();
  const user = userEvent.setup();
  render(
    <DemoProvider options={actual.options}>
      <Sample />
    </DemoProvider>,
  );
  const image = await screen.findByRole("img", {
    name: "Original invoice image",
  });
  await waitFor(() =>
    expect(image).toHaveAttribute("src", expect.stringMatching(/^blob:/)),
  );
  expect(image.closest(".invoice-original-media")).toHaveAttribute(
    "data-fit",
    "width",
  );
  await user.click(screen.getByRole("button", { name: "Rotate" }));
  expect(image.closest(".invoice-original-media")).toHaveAttribute(
    "data-rotation",
    "90",
  );
  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(image.closest(".invoice-original-media")).toHaveAttribute(
    "data-fit",
    "custom",
  );
  await user.click(screen.getByRole("button", { name: "Fit width" }));
  expect(image.closest(".invoice-original-media")).toHaveAttribute(
    "data-fit",
    "width",
  );
  expect(
    screen.queryByRole("button", { name: "Browse" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("AI invoice reading is simulated"),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "More" }));
  expect(
    screen.getByRole("menuitem", { name: "Fit page" }),
  ).toBeInTheDocument();
});

function ViewerSample() {
  const current = useDemo();
  return current.state.invoice_workspace ? (
    <OriginalViewer invoice={current.state.invoice_workspace.invoice} />
  ) : null;
}
it("remembers original visibility per person and tolerates blocked preference storage", async () => {
  const actual = await fixture();
  const user = userEvent.setup();
  render(
    <DemoProvider options={actual.options}>
      <ViewerSample />
    </DemoProvider>,
  );
  const hide = await screen.findByRole("button", { name: "Hide original" });
  await user.click(hide);
  expect(
    screen
      .getByRole("button", { name: "Show original" })
      .closest(".original-viewer"),
  ).toHaveAttribute("data-hidden", "true");
  expect(
    localStorage.getItem(
      `invoice-original-hidden:${actual.actor.company_id}:${actual.actor.user_id}`,
    ),
  ).toBe("true");
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
  await user.click(screen.getByRole("button", { name: "Show original" }));
  expect(
    screen
      .getByRole("button", { name: "Hide original" })
      .closest(".original-viewer"),
  ).toHaveAttribute("data-hidden", "false");
  write.mockRestore();
});
