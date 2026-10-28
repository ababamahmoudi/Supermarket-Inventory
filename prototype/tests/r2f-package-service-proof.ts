import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { build } from "vite";
import type { Page } from "@playwright/test";
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1";
import type { CommandIdentity } from "../src/authority-types";
import type { BrowserAuthorityRepository } from "../src/authority-repository";
import type { createPackageService } from "../src/package-service";
/** Actual source bundled only for a private Playwright route, using the signed-in session.
 * Every child, derived price, barcode and history entry comes from the protected API.
 */
export async function addActualPackageSizes(
  page: Page,
  parentCode = "0016",
  sizes: readonly { size: string; unit: "g" | "kg" | "lb" | "oz" }[] = [
    "100",
    "250",
    "500",
    "1000",
  ].map((size) => ({ size, unit: "g" })),
) {
  const token = `r2f-package-proof-${randomUUID()}`;
  const built = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry: token, formats: ["es"], fileName: "private-package-proof" },
    },
    plugins: [
      {
        name: "private-package-proof",
        resolveId(id) {
          if (id === token || id.endsWith(`/${token}`)) return `\0${token}`;
        },
        load(id) {
          if (id === `\0${token}`)
            return [
              `export {BrowserAuthorityRepository} from ${JSON.stringify(resolve("src/authority-repository.ts"))};`,
              `export {createPackageService} from ${JSON.stringify(resolve("src/package-service.ts"))};`,
            ].join("\n");
        },
      },
    ],
  });
  const result = Array.isArray(built) ? built[0] : built;
  if (!("output" in result))
    throw new Error("Expected actual private package build output");
  const { output } = result;
  if (output.length !== 1 || output[0].type !== "chunk")
    throw new Error("Expected one actual private package module");
  const pattern = `**/__${token}.js`;
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: output[0].type === "chunk" ? output[0].code : "",
    }),
  );
  try {
    return await page.evaluate(
      async ({ url, key, parentCode, sizes }) => {
        const identity = JSON.parse(
          sessionStorage.getItem(key) ?? "null",
        ) as CommandIdentity;
        if (!identity?.session_id || !identity.company_id)
          throw new Error("Sign in normally first");
        const sdk = (await import(url)) as {
          BrowserAuthorityRepository: typeof BrowserAuthorityRepository;
          createPackageService: typeof createPackageService;
        };
        const repository = new sdk.BrowserAuthorityRepository();
        try {
          const service = sdk.createPackageService(repository);
          for (const { size, unit } of sizes)
            await service.add(identity, {
              parent_code: parentCode,
              expected_parent_snapshot: await service.parentSnapshot(
                identity,
                parentCode,
              ),
              size,
              unit,
            });
          return await service.list(identity, parentCode);
        } finally {
          repository.dispose();
        }
      },
      { url: `/__${token}.js`, key: AUTH_IDENTITY_KEY, parentCode, sizes },
    );
  } finally {
    await page.unroute(pattern);
  }
}
