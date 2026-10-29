import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { expect, type Locator, type Page, type Route } from "@playwright/test";
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1.ts";

const prototypeRoot = fileURLToPath(new URL("..", import.meta.url));
const entryPath = fileURLToPath(
  new URL("./r2g-owned-dialog-fixture.tsx", import.meta.url),
);
const sourceFiles = [
  "src/store.tsx",
  "src/ui.tsx",
  "src/UndoToasts.tsx",
  "src/undo-queue.ts",
  "src/dialog-feedback.ts",
  "src/authority-repository.ts",
  "src/e1-application-options.ts",
  "src/operations.ts",
  "src/date-tracking.ts",
];
const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function fingerprint(): Promise<string> {
  return hash(
    JSON.stringify(
      await Promise.all(
        sourceFiles.map(async (name) => ({
          name,
          hash: hash(await readFile(new URL(`../${name}`, import.meta.url))),
        })),
      ),
    ),
  );
}
interface Bundle {
  files: Map<string, { body: Buffer; contentType: string }>;
  sourceFingerprint: string;
  entry: string;
}
let compiled: { fingerprint: string; result: Promise<Bundle> } | undefined;

/** Builds genuine UI/Provider code only for this test's intercepted private URLs. */
export async function compileOwnedDialogProof(): Promise<Bundle> {
  const before = await fingerprint();
  if (compiled?.fingerprint === before) return compiled.result;
  const result = (async (): Promise<Bundle> => {
    const noDuplicateStyles: Plugin = {
      name: "r2g-owned-dialog-existing-page-styles",
      enforce: "pre",
      resolveId(source) {
        if (/\.css(?:\?|$)/.test(source))
          return "\0r2g-owned-dialog-existing-page-styles";
      },
      load(id) {
        if (id === "\0r2g-owned-dialog-existing-page-styles")
          return "export {};";
      },
    };
    const output = await build({
      configFile: false,
      root: prototypeRoot,
      publicDir: false,
      logLevel: "silent",
      plugins: [noDuplicateStyles, react()],
      build: {
        write: false,
        minify: false,
        sourcemap: false,
        lib: {
          entry: entryPath,
          formats: ["es"],
          fileName: () => "owned-dialog.js",
        },
      },
    });
    const files = new Map<string, { body: Buffer; contentType: string }>();
    let entry = "";
    const modules = new Set<string>();
    for (const item of Array.isArray(output) ? output : [output]) {
      if (!("output" in item))
        throw new Error(
          "The private UI build returned a watcher instead of output.",
        );
      for (const asset of item.output) {
        if (asset.type === "chunk") {
          files.set(asset.fileName, {
            body: Buffer.from(asset.code),
            contentType: "text/javascript; charset=utf-8",
          });
          for (const id of Object.keys(asset.modules)) modules.add(id);
          if (asset.isEntry) entry = asset.fileName;
        } else {
          files.set(asset.fileName, {
            body: Buffer.from(asset.source),
            contentType: "application/octet-stream",
          });
        }
      }
    }
    for (const required of [
      "src/store.tsx",
      "src/ui.tsx",
      "src/UndoToasts.tsx",
      "src/authority-repository.ts",
      "src/e1-application-options.ts",
    ])
      if (![...modules].some((id) => id.endsWith(`/${required}`)))
        throw new Error(
          `The private proof did not compile the genuine ${required}.`,
        );
    if (!entry || !files.size)
      throw new Error("The private UI build produced no module.");
    if (before !== (await fingerprint()))
      throw new Error(
        "Production UI source changed while compiling the private proof.",
      );
    return { files, sourceFingerprint: before, entry };
  })();
  compiled = { fingerprint: before, result };
  try {
    return await result;
  } catch (caught) {
    if (compiled?.result === result) compiled = undefined;
    throw caught;
  }
}

export interface OwnedDialogProof {
  dialog: Locator;
  trigger: Locator;
  cancel: Locator;
  done: Locator;
  record: Locator;
  dispose(): Promise<void>;
}

/** Restore the caller's real current session; no actor, authority or business seed is fabricated. */
export async function mountOwnedDialogProof(
  page: Page,
): Promise<OwnedDialogProof> {
  const identity = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw)
      throw new Error(
        "Sign in normally before mounting the private dialog proof.",
      );
    const value = JSON.parse(raw) as {
      user_id?: string;
      company_id?: string;
      session_id?: string;
    };
    if (!value.user_id || !value.company_id || !value.session_id)
      throw new Error("The genuine current session is incomplete.");
    return {
      user_id: value.user_id,
      company_id: value.company_id,
      session_id: value.session_id,
    };
  }, AUTH_IDENTITY_KEY);
  const bundle = await compileOwnedDialogProof();
  const prefix = `/__r2g-owned-dialog-${randomUUID()}/`;
  const pattern = `**${prefix}*`;
  const handler = async (route: Route) => {
    const name = new URL(route.request().url()).pathname.slice(prefix.length);
    const asset = bundle.files.get(name);
    await route.fulfill(
      asset
        ? {
            status: 200,
            headers: {
              "Content-Type": asset.contentType,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
            body: asset.body,
          }
        : { status: 404, body: "Unknown private proof module" },
    );
  };
  await page.route(pattern, handler);
  const url = `${prefix}${bundle.entry}`;
  try {
    await page.evaluate(async (url) => {
      const module = (await import(url)) as { mountOwnedDialogProof(): void };
      module.mountOwnedDialogProof();
    }, url);
    const dialog = page.locator("dialog.r2g-owned-dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("owned-dialog-actor")).toHaveText(
      identity.user_id,
    );
    return {
      dialog,
      trigger: dialog.getByTestId("owned-dialog-trigger"),
      cancel: dialog.getByTestId("owned-dialog-cancel"),
      done: dialog.getByTestId("owned-dialog-done"),
      record: dialog.getByTestId("owned-dialog-record"),
      async dispose() {
        try {
          await page.evaluate(async (url) => {
            const module = (await import(url)) as {
              unmountOwnedDialogProof(): void;
            };
            module.unmountOwnedDialogProof();
          }, url);
          if (bundle.sourceFingerprint !== (await fingerprint()))
            throw new Error(
              "Production UI source changed during the private proof.",
            );
          expect(
            await page.evaluate((key) => {
              const value = JSON.parse(
                sessionStorage.getItem(key) ?? "null",
              ) as {
                user_id?: string;
                company_id?: string;
                session_id?: string;
              } | null;
              return (
                value && {
                  user_id: value.user_id,
                  company_id: value.company_id,
                  session_id: value.session_id,
                }
              );
            }, AUTH_IDENTITY_KEY),
          ).toEqual(identity);
        } finally {
          await page.unroute(pattern, handler);
        }
      },
    };
  } catch (caught) {
    await page.unroute(pattern, handler);
    throw caught;
  }
}
