/* global Buffer */
import { test as base } from "@playwright/test";
import { createAuthorityNativeServer } from "../scripts/e1-authority-native-server.mjs";
import {
  nativeAuthorityCaseNames,
  runNativeAuthorityCase,
} from "./e1-authority-native-cases.mjs";

const test = base.extend({
  authorityServer: [
    // Playwright requires fixture destructuring; this worker has no dependencies.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = await createAuthorityNativeServer();
      try {
        await use(server);
        await server.assertSourceUnchanged();
      } finally {
        await server.close();
      }
    },
    { scope: "worker" },
  ],
});
// Twelve real independently reported cases. Both configured projects execute
// them; native repository correctness is separate from physical phone install.
for (const [index, name] of nativeAuthorityCaseNames.entries()) {
  test(name, async ({ browser, authorityServer }, testInfo) => {
    const use = testInfo.project.use;
    const contextOptions = {
      viewport: use.viewport,
      isMobile: use.isMobile,
      deviceScaleFactor: use.deviceScaleFactor,
      hasTouch: use.hasTouch,
      userAgent: use.userAgent,
    };
    await testInfo.attach("actual-sdk-source-and-compiler", {
      body: Buffer.from(
        JSON.stringify(
          {
            source: authorityServer.source,
            compiler: authorityServer.compiled,
            logicalCase: index + 1,
            freshContext: true,
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    await runNativeAuthorityCase(
      browser,
      authorityServer,
      index,
      contextOptions,
    );
  });
}
