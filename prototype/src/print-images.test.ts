import { afterEach, expect, it, vi } from "vitest";
import { waitForPrintImages } from "./print-images";

afterEach(() => vi.useRealTimers());

it("waits for the stored image URL and decoded bytes before print readiness", async () => {
  vi.useFakeTimers();
  const region = document.createElement("div");
  const image = document.createElement("img");
  region.append(image);
  image.setAttribute("aria-busy", "true");
  Object.defineProperty(image, "complete", { value: true });
  Object.defineProperty(image, "naturalWidth", { value: 200 });
  const decode = vi.fn().mockResolvedValue(undefined);
  image.decode = decode;
  let ready = false;
  const pending = waitForPrintImages(region).then(() => {
    ready = true;
  });
  await vi.advanceTimersByTimeAsync(50);
  expect(ready).toBe(false);
  image.removeAttribute("aria-busy");
  await vi.advanceTimersByTimeAsync(25);
  await pending;
  expect(ready).toBe(true);
  expect(decode).toHaveBeenCalledOnce();
});

it("blocks printing when a stored file is missing instead of silently losing its logo", async () => {
  const region = document.createElement("div");
  region.innerHTML = '<img data-file-error="missing">';
  await expect(waitForPrintImages(region)).rejects.toThrow("could not load");
});

it("rejects stalled image loads within the configured time", async () => {
  vi.useFakeTimers();
  const region = document.createElement("div");
  region.innerHTML = '<img aria-busy="true">';
  const pending = expect(waitForPrintImages(region, 50)).rejects.toThrow(
    "still loading",
  );
  await vi.advanceTimersByTimeAsync(50);
  await pending;
});
