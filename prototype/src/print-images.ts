/** Wait for the actual print DOM, including asynchronously resolved stored logos. */
export async function waitForPrintImages(
  region: Element | null,
  timeoutMs = 8000,
): Promise<void> {
  if (!region) throw new Error("The print region is missing.");
  const started = Date.now();
  while (true) {
    const images = [...region.querySelectorAll<HTMLImageElement>("img")];
    if (images.some((image) => image.dataset.fileError))
      throw new Error("A print image could not load.");
    if (
      images.every(
        (image) =>
          image.getAttribute("aria-busy") !== "true" &&
          image.complete &&
          image.naturalWidth > 0,
      )
    ) {
      await Promise.all(
        images.map((image) =>
          typeof image.decode === "function" ? image.decode() : undefined,
        ),
      );
      return;
    }
    if (Date.now() - started >= timeoutMs)
      throw new Error("A print image is still loading.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * PR 29: print only the label sheets. While the browser print runs, the page
 * carries a class that hides every other part of the document, so nothing can
 * push the sheets down (this does not depend on CSS `:has()` support).
 */
export function printLabelSheets(print: () => void = () => window.print()) {
  const root = document.documentElement;
  root.classList.add("printing-labels");
  const cleanup = () => {
    root.classList.remove("printing-labels");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  try {
    print();
  } finally {
    // Most browsers block until the dialog closes; afterprint covers the rest.
    setTimeout(cleanup, 0);
  }
}
