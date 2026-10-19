import { networkInterfaces } from "node:os";
import { expect, test } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import sourceConfiguration from "../../seed/arzon-config.json" with { type: "json" };
import retainedConfiguration from "../src/compat/configuration.json" with { type: "json" };
import { openShellAction, signIn, visitPage } from "./helpers";
import {
  AUTH_IDENTITY_KEY,
  AUTH_PREFERENCES_KEY,
} from "../src/auth-preferences.e1";
import { PRESENTATION_THEME_KEY } from "../src/presentation-theme.c9";

// Match config.ts's existing placeholder fallback without loading browser modules
// into Node's test discovery, whose JSON imports require explicit attributes.
const configuredTimeZone = sourceConfiguration.company.timezone.includes(
  "PLACEHOLDER",
)
  ? retainedConfiguration.company.timezone
  : sourceConfiguration.company.timezone;

function nonLocalOrigin() {
  const explicit = process.env.C9_LAN_BASE_URL;
  const address = Object.values(networkInterfaces())
    .flat()
    .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;
  const origin = explicit ?? (address ? `http://${address}:5174` : "");
  if (!origin)
    throw new Error("C9 needs a non-localhost interface or C9_LAN_BASE_URL.");
  const url = new URL(origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    /^(?:localhost|.*\.localhost|127(?:\.\d+){3}|\[?::1\]?|0\.0\.0\.0)$/i.test(
      url.hostname,
    )
  )
    throw new Error(
      "C9_LAN_BASE_URL must be a real non-localhost app address.",
    );
  return url.origin;
}

// Every existing Chromium project also exercises this scenario at a LAN origin.
// The WebKit project explicitly matches only this one new test file.
test.use({ baseURL: nonLocalOrigin() });

interface FrameWatch {
  documentToken: string;
  armed: boolean;
  frames: number;
  samples: number;
  violations: {
    reason: string;
    source: "animation-frame" | "mutation";
    readyState: DocumentReadyState;
    url: string;
    theme: string;
    colors: string[];
  }[];
}
interface NativeExceptionDiagnostic {
  source: string;
  name: string;
  code: string | number | null;
  message: string;
  frames: string[];
}
type WatchedWindow = Window & {
  __c9FrameWatch?: FrameWatch;
  __c9NativeExceptions?: NativeExceptionDiagnostic[];
};

test("C9 dark LAN clicks never reload, show sign-in, or paint a light page", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const unexpectedNavigations: string[] = [];
  let armed = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      armed &&
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame()
    )
      unexpectedNavigations.push(request.url());
  });
  if (testInfo.project.name === "webkit-no-reload")
    await page.addInitScript(() => {
      const records: NativeExceptionDiagnostic[] = [];
      (window as WatchedWindow).__c9NativeExceptions = records;
      const record = (source: string, error: unknown) => {
        try {
          if (
            !(error instanceof Error || error instanceof DOMException) ||
            records.length >= 32
          )
            return;
          const ownValue = (key: string): unknown =>
            Object.getOwnPropertyDescriptor(error, key)?.value;
          const nativeProperty = (key: string): unknown => {
            if (!(error instanceof DOMException)) return undefined;
            return Object.getOwnPropertyDescriptor(
              DOMException.prototype,
              key,
            )?.get?.call(error);
          };
          let name = ownValue("name") ?? nativeProperty("name");
          if (typeof name !== "string") {
            const descriptor = Object.getOwnPropertyDescriptor(
              Object.getPrototypeOf(error),
              "name",
            );
            name = descriptor?.value;
          }
          const message = ownValue("message") ?? nativeProperty("message");
          const code = ownValue("code") ?? nativeProperty("code");
          const stack = ownValue("stack");
          const diagnostic: NativeExceptionDiagnostic = {
            source,
            name: typeof name === "string" ? name.slice(0, 80) : "Error",
            code:
              typeof code === "number"
                ? code
                : typeof code === "string"
                  ? code.slice(0, 80)
                  : null,
            message: typeof message === "string" ? message.slice(0, 400) : "",
            frames:
              typeof stack === "string"
                ? stack
                    .split(/\r?\n/)
                    .filter((line) => /^\s*at\b|@https?:\/\//.test(line))
                    .slice(0, 8)
                    .map((line) =>
                      line
                        .replace(/(https?:\/\/[^\s)?#]+)[?#][^\s)]*/g, "$1")
                        .trim()
                        .slice(0, 240),
                    )
                : [],
          };
          if (
            !records.some(
              (previous) =>
                JSON.stringify(previous) === JSON.stringify(diagnostic),
            )
          )
            records.push(diagnostic);
        } catch {
          // Diagnostics must not replace the original rejection or exception.
        }
      };
      const originalCatch = Promise.prototype.catch;
      const originalThen = Promise.prototype.then;
      Promise.prototype.catch = function (onRejected) {
        // Only ordinary native promises are tapped. Borrowed catch calls,
        // subclasses and custom then methods keep their original callback too.
        if (
          typeof onRejected !== "function" ||
          !this ||
          typeof this !== "object" ||
          Object.getPrototypeOf(this) !== Promise.prototype ||
          Object.getOwnPropertyDescriptor(this, "then") ||
          Object.getOwnPropertyDescriptor(Promise.prototype, "then")?.value !==
            originalThen
        )
          return Reflect.apply(originalCatch, this, [onRejected]);
        return Reflect.apply(originalCatch, this, [
          (error: unknown) => {
            record("Promise.catch rejection", error);
            return Reflect.apply(onRejected, undefined, [error]);
          },
        ]);
      };
      if (typeof IDBFactory === "undefined") return;
      const originalOpen = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        try {
          const request: IDBOpenDBRequest = Reflect.apply(
            originalOpen,
            this,
            args,
          );
          request.addEventListener("error", () =>
            record("IndexedDB open error", request.error),
          );
          request.addEventListener("success", () => {
            const database = request.result;
            const observeError = (event: Event) => {
              const target = event.target;
              if (
                target instanceof IDBRequest ||
                target instanceof IDBTransaction
              )
                record(`IndexedDB ${event.type}`, target.error);
            };
            database.addEventListener("error", observeError, true);
            database.addEventListener("abort", observeError, true);
          });
          return request;
        } catch (error) {
          record("IndexedDB open exception", error);
          throw error;
        }
      };
    });
  let lastAuthenticationSnapshot: unknown = null;
  let lastAuthenticationNotice = "";
  let authenticationSnapshotPending = false;
  const authenticationEvidence = () => {
    const evidence = JSON.stringify(
      {
        phase: "Initial Manager username/password and second sign-in step",
        expectedSecondStep: demoSeed.demo_users.find(
          (person) => person.username === "manager",
        )!.setup.second_step_method,
        lastAuthenticationSnapshot,
        errors,
      },
      null,
      2,
    );
    return demoSeed.demo_users.reduce(
      (text, person) =>
        person.password ? text.replaceAll(person.password, "[redacted]") : text,
      evidence,
    );
  };
  const captureAuthenticationSnapshot = async () => {
    if (authenticationSnapshotPending || page.isClosed()) return;
    authenticationSnapshotPending = true;
    try {
      lastAuthenticationSnapshot = await page.evaluate((timeZone: string) => {
        const visibleText = (selector: string) =>
          [...document.querySelectorAll<HTMLElement>(selector)]
            .filter((element) => {
              const bounds = element.getBoundingClientRect();
              return bounds.width > 0 && bounds.height > 0;
            })
            .map((element) => element.innerText.trim());
        const dateFormat = (() => {
          try {
            const calendarFormat = new Intl.DateTimeFormat("en-CA", {
              timeZone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
            return {
              configuredTimeZone: timeZone,
              resolvedTimeZone: calendarFormat.resolvedOptions().timeZone,
              enCaDate: calendarFormat.format(new Date()),
            };
          } catch (error) {
            return {
              configuredTimeZone: timeZone,
              error: {
                name:
                  error instanceof Error ? error.name.slice(0, 80) : "Error",
                message:
                  error instanceof Error ? error.message.slice(0, 400) : "",
              },
            };
          }
        })();
        return {
          url: `${location.origin}${location.pathname}`,
          readyState: document.readyState,
          headings: visibleText(".signin-page h1,.sign-in-card h1"),
          fieldLabels: visibleText(".signin-page label,.sign-in-card label"),
          buttons: visibleText(".signin-page button,.sign-in-card button"),
          alerts: visibleText(
            ".signin-page [role=alert],.signin-page .form-error,.sign-in-card [role=alert],.sign-in-card .form-error",
          ),
          statuses: visibleText(
            ".signin-page [role=status],.banner[role=status]",
          ),
          hasWorkspace: Boolean(document.querySelector(".app-shell")),
          secureContext: isSecureContext,
          indexedDBAvailable: typeof indexedDB !== "undefined",
          secureRandomAvailable:
            typeof globalThis.crypto?.getRandomValues === "function",
          dateFormat,
          nativeExceptions:
            (window as WatchedWindow).__c9NativeExceptions ?? [],
        };
      }, configuredTimeZone);
      const evidence = authenticationEvidence();
      if (
        process.env.CI &&
        testInfo.project.name === "webkit-no-reload" &&
        evidence !== lastAuthenticationNotice
      ) {
        lastAuthenticationNotice = evidence;
        const escaped = evidence
          .replaceAll("%", "%25")
          .replaceAll("\r", "%0D")
          .replaceAll("\n", "%0A");
        process.stdout.write(
          `\n::notice title=C9 WebKit initial sign-in::${escaped}\n`,
        );
      }
    } catch {
      // A native test timeout may close the page. Keep the last public DOM
      // snapshot; never read input values, credentials, or authority records.
    } finally {
      authenticationSnapshotPending = false;
    }
  };
  const authenticationDiagnostics = setInterval(
    () => void captureAuthenticationSnapshot(),
    1000,
  );
  try {
    await signIn(page, "Manager");
  } catch (error) {
    await testInfo.attach("C9 initial Manager sign-in failure", {
      body: authenticationEvidence(),
      contentType: "application/json",
    });
    throw error;
  } finally {
    clearInterval(authenticationDiagnostics);
  }
  await (await openShellAction(page, "Switch to dark theme")).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const retainedThemeInput = await page.evaluate(
    ({ preferencesKey, identityKey, hintKey, managerId }) => {
      const identityBytes = sessionStorage.getItem(identityKey);
      const identity = JSON.parse(identityBytes ?? "null");
      const preferences = JSON.parse(localStorage.getItem(preferencesKey)!);
      if (
        typeof identity?.company_id !== "string" ||
        typeof identity?.session_id !== "string" ||
        preferences.by_user_id[managerId]?.theme !== "dark"
      )
        throw new Error(
          "The actual signed-in Manager dark preference is missing.",
        );
      // Reproduce retained E3 presentation bytes only. The genuine SID and all
      // business/authority data remain untouched; old tabs had no C9 hint.
      preferences.device_preferences.theme = "light";
      preferences.recent_user_ids = [
        managerId,
        ...preferences.recent_user_ids.filter((id: string) => id !== managerId),
      ];
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      sessionStorage.removeItem(hintKey);
      return {
        deviceTheme: preferences.device_preferences.theme,
        savedPersonTheme: preferences.by_user_id[managerId].theme,
        identityUnchanged:
          sessionStorage.getItem(identityKey) === identityBytes,
        tabHintAbsent: sessionStorage.getItem(hintKey) === null,
      };
    },
    {
      preferencesKey: AUTH_PREFERENCES_KEY,
      identityKey: AUTH_IDENTITY_KEY,
      hintKey: PRESENTATION_THEME_KEY,
      managerId: demoSeed.demo_users.find(
        (person) => person.username === "manager",
      )!.id,
    },
  );
  expect(retainedThemeInput).toEqual({
    deviceTheme: "light",
    savedPersonTheme: "dark",
    identityUnchanged: true,
    tabHintAbsent: true,
  });

  // Install before a deliberate dark reload so even first painted frames are
  // observed. Only the subsequent user clicks are required to retain this doc.
  await page.addInitScript(() => {
    const watch: FrameWatch = {
      documentToken: `${Date.now()}-${Math.random()}`,
      armed: false,
      frames: 0,
      samples: 0,
      violations: [],
    };
    (window as WatchedWindow).__c9FrameWatch = watch;
    const sample = (source: "animation-frame" | "mutation") => {
      const root = document.documentElement;
      if (!root || !document.body) return;
      watch.samples++;
      const rootStyle = getComputedStyle(root);
      const bodyStyle = getComputedStyle(document.body);
      const colors = [rootStyle.backgroundColor, bodyStyle.backgroundColor];
      const opaque = colors.filter(
        (color) => color !== "rgba(0, 0, 0, 0)" && color !== "transparent",
      );
      const light = opaque.some((color) => {
        const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
        return channels.slice(0, 3).some((channel) => channel > 60);
      });
      let reason = "";
      // A parser mutation can precede render-blocking CSS without being painted.
      // Check the background at every rendering opportunity; both sources still
      // guard against mounting auth or removing the workspace after clicks.
      if (
        source === "animation-frame" &&
        (root.dataset.theme !== "dark" || !opaque.length || light)
      )
        reason = "A frame did not have the chosen dark page background.";
      if (watch.armed) {
        const auth = document.querySelector<HTMLElement>(".signin-page");
        if (auth && auth.getBoundingClientRect().width > 0)
          reason = "A click mounted the sign-in/first-loading layout.";
        else if (!document.querySelector(".app-shell"))
          reason = "A click removed the workspace frame.";
      }
      if (reason && watch.violations.length < 20)
        watch.violations.push({
          reason,
          source,
          readyState: document.readyState,
          url: location.href,
          theme: root.dataset.theme ?? "",
          colors,
        });
    };
    new MutationObserver(() => sample("mutation")).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    const frame = () => {
      watch.frames++;
      sample("animation-frame");
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.reload();
  await expect(page.locator(".user-chip-copy strong")).toHaveText(
    demoSeed.demo_users.find((person) => person.username === "manager")!
      .name_en,
  );
  const documentToken = await page.evaluate(() => {
    const watch = (window as WatchedWindow).__c9FrameWatch!;
    watch.armed = true;
    return watch.documentToken;
  });
  armed = true;
  try {
    await visitPage(page, "Products");
    const search = page.getByRole("searchbox", {
      name: "Search products",
      exact: true,
    });
    await search.fill("Lavash");
    await expect(page.locator("main")).toContainText("Lavash");
    await search.fill("");
    await signIn(page, "Cashier");
    await signIn(page, "Manager");
    await visitPage(page, "Approvals");
    await page.getByRole("tab", { name: /^Approved\b/ }).click();
    await page.getByRole("tab", { name: /^Pending\b/ }).click();

    const lavashName = demoSeed.products.find(
      (product) => product.code === "0006",
    )!.name_en;
    const lavash = page.locator(".approval-card").filter({
      has: page.getByRole("heading", { name: lavashName, exact: true }),
    });
    await lavash
      .getByRole("button", { name: "Approve price", exact: true })
      .click();
    const approval = page.getByRole("dialog", {
      name: "Review approval",
      exact: true,
    });
    await approval
      .getByRole("button", { name: "Approve price", exact: true })
      .click();
    await expect(approval).toBeHidden();
    await expect(lavash).toHaveCount(0);

    const newName = demoSeed.demo_invoice.lines.find(
      (line) => line.product_code === "NEW",
    )!.description;
    const newProduct = page.locator(".approval-card").filter({
      has: page.getByRole("heading", { name: newName, exact: true }),
    });
    await newProduct
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    const rejection = page.getByRole("dialog", {
      name: "Reject proposal",
      exact: true,
    });
    await rejection
      .getByRole("button", { name: "Reject proposal", exact: true })
      .click();
    await expect(rejection).toBeHidden();
    await page.getByRole("tab", { name: /^Rejected\b/ }).click();
    await expect(newProduct).toBeVisible();
    await page.getByRole("tab", { name: /^Approved\b/ }).click();
    await expect(lavash).toBeVisible();
    await visitPage(page, "Lookup");

    const evidence = await page.evaluate(() => ({
      origin: location.origin,
      secureContext: isSecureContext,
      ...((window as WatchedWindow).__c9FrameWatch as FrameWatch),
    }));
    expect(evidence.documentToken).toBe(documentToken);
    expect(evidence.frames).toBeGreaterThan(0);
    expect(evidence.samples).toBeGreaterThan(0);
    expect(evidence.violations).toEqual([]);
    expect(unexpectedNavigations).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("C9 LAN frame observations", {
      body: JSON.stringify(
        {
          documentToken,
          retainedThemeInput,
          unexpectedNavigations,
          errors,
          watch: await page.evaluate(
            () => (window as WatchedWindow).__c9FrameWatch,
          ),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  }
});
