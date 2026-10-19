import { afterEach, expect, it } from "vitest";
import { beginAppWork } from "./app-work";
import { observeUnsavedEditors, updateSafe } from "./pwa-safety";
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.innerHTML = "";
});
it("does not approve an update while an actual field differs from its initial value", async () => {
  document.body.innerHTML =
    '<input value="Original"><textarea>Saved note</textarea>';
  const editor = observeUnsavedEditors(document, () => undefined);
  cleanups.push(editor.dispose);
  const input = document.querySelector("input")!;
  input.focus();
  input.value = "Unsaved edit";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(editor.pending()).toBe(true);
  expect(updateSafe(document, editor.pending())).toBe(false);
  input.value = "Original";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(editor.pending()).toBe(false);
  expect(updateSafe(document, editor.pending())).toBe(true);
  input.value = "Another edit";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.remove();
  await Promise.resolve();
  expect(editor.pending()).toBe(false);
});
it("blocks for dialogs, checkbox label selection and overlapping actual work", () => {
  document.body.innerHTML = '<div role="dialog">Current edit</div>';
  expect(updateSafe(document, false)).toBe(false);
  document.body.innerHTML =
    '<div data-pwa-unsaved="true">Selected labels</div>';
  expect(updateSafe(document, false)).toBe(false);
  document.body.innerHTML = "";
  const release = beginAppWork();
  try {
    expect(updateSafe(document, false)).toBe(false);
  } finally {
    release();
  }
  expect(updateSafe(document, false)).toBe(true);
});
it("treats a real custom checkbox change as unsaved until restored or closed", () => {
  document.body.innerHTML =
    '<button role="checkbox" aria-checked="false">New label printed</button>';
  const editor = observeUnsavedEditors(document, () => undefined);
  cleanups.push(editor.dispose);
  const checkbox = document.querySelector("button")!;
  checkbox.focus();
  checkbox.setAttribute("aria-checked", "true");
  checkbox.click();
  expect(editor.pending()).toBe(true);
  checkbox.setAttribute("aria-checked", "false");
  checkbox.click();
  expect(editor.pending()).toBe(false);
});

it("observes a custom checkbox rendered after its actual click handler", async () => {
  document.body.innerHTML =
    '<button role="checkbox" aria-checked="false">Select labels</button>';
  const editor = observeUnsavedEditors(document, () => undefined);
  cleanups.push(editor.dispose);
  const button = document.querySelector("button")!;
  button.addEventListener("click", () =>
    button.setAttribute("aria-checked", "true"),
  );
  button.focus();
  button.click();
  await Promise.resolve();
  expect(editor.pending()).toBe(true);
  expect(updateSafe(document, editor.pending())).toBe(false);
});
