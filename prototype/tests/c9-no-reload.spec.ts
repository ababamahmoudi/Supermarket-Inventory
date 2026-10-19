import { networkInterfaces } from "node:os";
import { expect, test } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import { openShellAction, signIn, visitPage } from "./helpers";
import {
  AUTH_IDENTITY_KEY,
  AUTH_PREFERENCES_KEY,
} from "../src/auth-preferences.e1";
import { PRESENTATION_THEME_KEY } from "../src/presentation-theme.c9";

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
    url: string;
    theme: string;
    colors: string[];
  }[];
}
type WatchedWindow = Window & { __c9FrameWatch?: FrameWatch };

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
  await signIn(page, "Manager");
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
    const sample = () => {
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
      if (root.dataset.theme !== "dark" || !opaque.length || light)
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
          url: location.href,
          theme: root.dataset.theme ?? "",
          colors,
        });
    };
    new MutationObserver(sample).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    const frame = () => {
      watch.frames++;
      sample();
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
