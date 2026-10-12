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
