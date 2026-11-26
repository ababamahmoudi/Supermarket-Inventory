import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInvoiceOriginal } from "./use-invoice-original";
import type { InvoiceReadDTO } from "./invoice-projections";
import type { StoredFileRecord } from "./file-database";
const context = vi.hoisted(() => ({
  actor: {
    user_id: "reader",
    session_id: "session",
    authority_epoch: 1,
    person_version: 1,
  },
  query: vi.fn(),
  can: vi.fn(() => true),
  authorityGeneration: 1,
  businessRevision: 1,
  authorityDirectoryVersion: 1,
  locationSelection: "All",
  locked: false,
}));
const load = vi.hoisted(() => vi.fn());
vi.mock("./store", () => ({ useDemo: () => context }));
vi.mock("./invoice-file-access", () => ({ loadInvoiceOriginal: load }));
const invoice = {
  id: "fictional",
  company_id: "fictional-company",
  version: 1,
  original_available: true,
  file_name: "invented.svg",
  file_type: "image/svg+xml",
  file_size: 10,
  original_page_count: 1,
} as InvoiceReadDTO;
function bytes(hash = "first") {
  return {
    sha256: hash,
    preview: new Blob([hash]),
    source: new Blob([hash]),
    source_size: 10,
    name: invoice.file_name,
    type: invoice.file_type,
  } as StoredFileRecord;
}
beforeEach(() => {
  context.can.mockReturnValue(true);
  context.locked = false;
  context.businessRevision = 1;
  context.actor = {
    user_id: "reader",
    session_id: "session",
    authority_epoch: 1,
    person_version: 1,
  };
  load.mockReset().mockResolvedValue(bytes());
  let number = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    () => `blob:fictional-${++number}`,
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it("keeps the decoded source and URL throughout edit revalidation, swapping only changed bytes", async () => {
  const { result, rerender } = renderHook(
    ({ value }) => useInvoiceOriginal(value),
    { initialProps: { value: invoice } },
  );
  await waitFor(() => expect(result.current.url).toBe("blob:fictional-1"));
  const first = result.current;
  let finish!: (record: StoredFileRecord) => void;
  load.mockImplementationOnce(
    () =>
      new Promise<StoredFileRecord>((resolve) => {
        finish = resolve;
      }),
  );
  context.businessRevision++;
  rerender({ value: { ...invoice, version: 2 } });
  expect(result.current.url).toBe(first.url);
  expect(result.current.loading).toBe(false);
  await act(async () => finish(bytes()));
  expect(result.current.source).toBe(first.source);
  expect(result.current.key).toBe(first.key);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  load.mockResolvedValueOnce(bytes("replacement"));
  context.businessRevision++;
  rerender({ value: { ...invoice, version: 3 } });
  await waitFor(() => expect(result.current.url).toBe("blob:fictional-2"));
  expect(result.current.key).not.toBe(first.key);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.url);
});
it("masks and revokes bytes immediately on permission loss and never resurrects them while access revalidates", async () => {
  const { result, rerender } = renderHook(() => useInvoiceOriginal(invoice));
  await waitFor(() => expect(result.current.url).toBe("blob:fictional-1"));
  context.can.mockReturnValue(false);
  rerender();
  expect(result.current.url).toBeUndefined();
  expect(result.current.source).toBeUndefined();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fictional-1");
  let finish!: (record: StoredFileRecord) => void;
  load.mockImplementationOnce(
    () =>
      new Promise<StoredFileRecord>((resolve) => {
        finish = resolve;
      }),
  );
  context.can.mockReturnValue(true);
  rerender();
  expect(result.current.url).toBeUndefined();
  expect(result.current.loading).toBe(true);
  await act(async () => finish(bytes()));
  expect(result.current.url).toBe("blob:fictional-2");
  context.actor = { ...context.actor, session_id: "new-session" };
  rerender();
  expect(result.current.url).toBeUndefined();
});

it("recovers a transient revalidation failure with the same SHA and a fresh valid URL", async () => {
  const { result, rerender } = renderHook(() => useInvoiceOriginal(invoice));
  await waitFor(() => expect(result.current.url).toBe("blob:fictional-1"));
  load.mockRejectedValueOnce(new Error("Temporary source failure"));
  context.businessRevision++;
  rerender();
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.url).toBeUndefined();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fictional-1");
  load.mockResolvedValueOnce(bytes());
  context.businessRevision++;
  rerender();
  await waitFor(() => expect(result.current.url).toBe("blob:fictional-2"));
  expect(result.current.error).toBe(false);
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:fictional-2");
});

it("refreshes same-byte file metadata without replacing the decoded source or URL", async () => {
  const { result, rerender } = renderHook(
    ({ value }) => useInvoiceOriginal(value),
    { initialProps: { value: invoice } },
  );
  await waitFor(() => expect(result.current.url).toBe("blob:fictional-1"));
  const first = result.current;
  load.mockResolvedValueOnce({
    ...bytes(),
    name: "renamed-invented.svg",
    source_size: 15,
  });
  rerender({
    value: { ...invoice, file_name: "renamed-invented.svg", file_size: 15 },
  });
  await waitFor(() => expect(result.current.name).toBe("renamed-invented.svg"));
  expect(result.current.size).toBe(15);
  expect(result.current.source).toBe(first.source);
  expect(result.current.url).toBe(first.url);
  expect(result.current.key).toBe(first.key);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});
