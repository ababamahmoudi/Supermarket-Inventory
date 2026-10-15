/** Match an installed window's browser chrome to the same active surface token. */
export function synchronizeThemeColor(document: Document): void {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--klead-surface")
    .trim();
  if (!color) return;
  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  ))
    meta.content = color;
}
