import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page, Route } from "@playwright/test";
import { createAuthorityNativeServer } from "../scripts/e1-authority-native-server.mjs";
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1";
import type { CommandIdentity } from "../src/authority-types";
import type { BrowserAuthorityRepository } from "../src/authority-repository";
import type { DemoState } from "../src/types";

/**
 * Install explicit business test fixtures through the actual native repository.
 * The caller first signs in normally as a configured company-role person.
 * Compiler output is served only by a private Playwright route in this test;
 * there is no application route, public asset, authority write, or actor mint.
 */
export async function runCanonicalBusinessFixture<TArgs, TValue>(
  page: Page,
  operation: (draft: DemoState, args: TArgs) => TValue,
  args: TArgs,
): Promise<TValue> {
  const server = await createAuthorityNativeServer();
  const prefix = `/__e1-business-fixture-${randomUUID()}/`;
  const pattern = `**${prefix}*`;
  const assets = new Map<string, Buffer>();
  const handler = async (route: Route) => {
    const name = new URL(route.request().url()).pathname.slice(prefix.length);
    const bytes = assets.get(name);
    if (!bytes) {
      await route.fulfill({ status: 404, body: "Unknown test module" });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
      body: bytes,
    });
  };
  try {
    for (const output of server.compiled.files) {
      const bytes = await readFile(join(server.directory, "sdk", output.file));
      if (createHash("sha256").update(bytes).digest("hex") !== output.sha256)
        throw new Error("Actual SDK fixture compiler output changed.");
      assets.set(output.file, bytes);
    }
    await page.route(pattern, handler);
    const value = await page.evaluate(
      async ({ prefix, identityKey, operationSource, args }) => {
        const raw = sessionStorage.getItem(identityKey);
        if (!raw)
          throw new Error("Sign in normally before installing a fixture.");
        const identity = JSON.parse(raw) as CommandIdentity;
        if (!identity.company_id || !identity.session_id)
          throw new Error("The real current session identity is missing.");
        const { BrowserAuthorityRepository: Repository } = (await import(
          `${prefix}authority-repository.js`
        )) as { BrowserAuthorityRepository: typeof BrowserAuthorityRepository };
        const repository = new Repository();
        try {
          // This is the explicit test fixture operation, not production input.
          const install = new Function(`return (${operationSource});`)() as (
            draft: DemoState,
            args: TArgs,
          ) => TValue;
          const result = await repository.runBusinessCommand<DemoState, TValue>(
            identity,
            (draft) => install(draft, args as TArgs),
            {
              capability: "settings.manage",
              resource: {
                company_id: identity.company_id,
                kind: "company_shared",
                mutation: true,
              },
            },
          );
          return result.value;
        } finally {
          repository.dispose();
        }
      },
      {
        prefix,
        identityKey: AUTH_IDENTITY_KEY,
        operationSource: operation.toString(),
        args,
      },
    );
    await server.assertSourceUnchanged();
    return value;
  } finally {
    await page.unroute(pattern, handler);
    await server.close();
  }
}
