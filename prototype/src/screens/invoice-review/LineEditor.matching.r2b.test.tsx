import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticatedProviderFixture } from "../../authority-provider-test-fixture";
import { DemoProvider, useDemo } from "../../store";
import i18n from "../../i18n";
import { recalculateInvoice, setInvoiceLineQuantity } from "../../invoice";
import {
  importMatchingReading,
  postedMatchingProduct,
} from "../../test/r2b-product-matching-fixture";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "../../test/rendered-ui-readiness";
import { LineEditor } from "./LineEditor";
import type { ReviewUpdate, EditLine } from "./types";

vi.mock("../../file-database", async (original) => ({
  ...(await original<typeof import("../../file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => ({
      reference: `idb-file:v1:${company}:${"a".repeat(64)}`,
      name: file.name ?? "fictional.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
const commands: Promise<unknown>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  try {
    await Promise.all(commands.splice(0));
  } finally {
    clearRenderedUiReadiness();
    cleanup();
    fixture?.dispose();
  }
});
function ActualMatchingEditor() {
  const { state, actor, authStage, command, setLang } = useDemo();
  const workspace = state.invoice_workspace;
  if (!actor || authStage !== "complete" || !workspace) return null;
  const scope = {
    company_id: workspace.invoice.company_id,
    kind: "company_shared" as const,
    entity_id: workspace.invoice.id,
  };
  const update: ReviewUpdate = (change) => {
    const operation = command("invoices.edit", scope, change);
    commands.push(operation);
    return operation;
  };
  const editLine: EditLine = (index, change, recalculate) => {
    const operation = command("invoices.edit", scope, (draft, current) => {
      change(draft.invoice.lines[index], draft, current);
      if (recalculate) recalculateInvoice(draft.invoice, draft.config);
    });
    commands.push(operation);
  };
  return (
    <>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      {
        <LineEditor
          invoice={workspace.invoice}
          workspace={workspace}
          index={0}
          update={update}
          editLine={editLine}
          onQuantity={setInvoiceLineQuantity}
          onClose={() => {}}
          anchor={() => {}}
          attemptedPost={false}
        />
      }
    </>
  );
}

it.each(["en", "fa"] as const)(
  "shows safe earlier-delivery provenance and clears the open cross-supplier question on confirmation in %s",
  async (language) => {
    const { state, actor } = await postedMatchingProduct();
    await importMatchingReading(state, actor, 1, "Elmwood Test Supply");
    fixture = await authenticatedProviderFixture({ state, role: "owner" });
    render(
      <DemoProvider options={fixture.options}>
        <ActualMatchingEditor />
      </DemoProvider>,
    );
    await renderedUiReady(() =>
      Boolean(
        screen.queryByRole("combobox", {
          name: "Matched product",
        }),
      ),
    );
    if (language === "fa")
      fireEvent.click(screen.getByRole("button", { name: "Use Persian" }));
    const label = language === "en" ? "Matched product" : "کالای مرتبط";
    await renderedUiReady(() =>
      Boolean(screen.queryByRole("combobox", { name: label })),
    );
    const select = screen.getByRole("combobox", { name: label });
    expect(select).toHaveAccessibleDescription(
      language === "en"
        ? "Matched to “Crafted Carrot Jam” from an earlier delivery. Check the match"
        : "تطبیق با «مربای هویج آزمایشی» از دریافت قبلی. تطبیق را بررسی کنید",
    );
    expect(select.closest(".field")).toHaveClass("please-check-field");
    expect(
      screen.getByText(
        language === "en" ? "Check the match" : "تطبیق را بررسی کنید",
        { exact: true },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: language === "en" ? "Printed description" : "شرح چاپ‌شده",
        hidden: true,
      }),
    ).toHaveValue("CARROT 24");
    fireEvent.click(
      screen.getByRole("button", {
        name: language === "en" ? "Confirm line" : "تأیید ردیف",
      }),
    );
    await act(async () => {
      await Promise.all(commands);
    });
    await renderedUiReady(
      () =>
        !screen.queryByText(
          language === "en" ? "Check the match" : "تطبیق را بررسی کنید",
          { exact: true },
        ),
    );
    expect(
      screen.getByRole("combobox", { name: label }).closest(".field"),
    ).not.toHaveClass("please-check-field");
    const canonical = await fixture.readCanonical();
    expect(canonical.invoice.lines[0].low_confidence_fields).toEqual([]);
    expect(canonical.invoice.lines[0].description).toBe("CARROT 24");
  },
);
