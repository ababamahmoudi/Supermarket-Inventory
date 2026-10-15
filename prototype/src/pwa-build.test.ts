import { expect, it } from "vitest";
import {
  createWebManifest,
  createOfflinePage,
  createServiceWorker,
  publicStaticAsset,
} from "../pwa-build";
import configuration from "../../seed/arzon-config.json";
it("uses the configured company and complete standalone icon/launch contract", () => {
  const manifest = createWebManifest();
  expect(manifest.name).toBe(configuration.company.name);
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual([
    "192x192",
    "512x512",
  ]);
  expect(new Set(manifest.icons.map((icon) => icon.src)).size).toBe(2);
  expect(
    manifest.icons.every(
      (icon) => icon.type === "image/png" && icon.purpose.includes("maskable"),
    ),
  ).toBe(true);
  expect(manifest.theme_color).toMatch(/^#[a-f0-9]{6}$/i);
});
for (const path of [
  "assets/index-Abc12345.js",
  "assets/pdf.worker-Rela1234.mjs",
  "assets/index-123abcd_.css",
  "assets/Manrope-Regular-Abc1234.woff2",
]) {
  it(`permits only fingerprinted public code/style/font: ${path}`, () =>
    expect(publicStaticAsset(path)).toBe(true));
}
for (const path of [
  "index.html",
  "assets/auth.html",
  "api/v1/products",
  "assets/upload-123abcde.js",
  "uploads/photo-Abc12345.png",
  "originals/invoice-Abc12345.svg",
  "assets/private-ABCabc12.js",
  "assets/original-documents-Abc12345.js",
  "assets/invoice-original-Abc12345.svg",
  "assets/rows-Abc12345.json",
  "assets/people.js",
  "https://elsewhere.test/assets/index-Abc12345.js",
]) {
  it(`does not precache private, original, unversioned or HTML content: ${path}`, () =>
    expect(publicStaticAsset(path)).toBe(false));
}
it("offline fallback contains both languages and a working reconnect action", () => {
  const html = createOfflinePage();
  expect(html).toContain("No connection");
  expect(html).toContain("اتصال برقرار نیست");
  expect(html).toContain("location.reload()");
  expect(html).toContain('href="offline.css"');
});
it("emits a worker without unconditional activation or navigation cache writes", () => {
  const worker = createServiceWorker(
    ["assets/index-Abc12345.js", "offline.html"],
    "release-one",
  );
  expect(worker).toContain("includeUncontrolled:true");
  expect(worker).toContain("UPDATE_VOTE");
  expect(worker).toContain("APP_BUSY");
  expect(worker).toContain("response.redirected");
  expect(worker).toContain("response.headers.get('content-type')");
  expect(worker).toContain("url.search");
  const navigation = worker.slice(
    worker.indexOf("if (request.mode === 'navigate')"),
    worker.indexOf("const relative = url.pathname"),
  );
  expect(navigation).toContain("fetch(request).catch");
  expect(navigation).not.toContain("put(");
  const install = worker.slice(
    worker.indexOf("self.addEventListener('install'"),
    worker.indexOf("let proposal"),
  );
  expect(install).not.toContain("self.skipWaiting()");
});
