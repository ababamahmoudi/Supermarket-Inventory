/* global process, console, window, localStorage, URL */
import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appearance,
  button,
  choose,
  field,
  settled,
} from "./c5-browser-proof.mjs";
import {
  C8_SCENES,
  C8_VARIANTS,
  inspectC8Layout,
} from "./capture-c8-proof.mjs";
import { c8SceneRole, setupC8Scene } from "./capture-c8-scenes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(process.env.CAPTURE_SOURCE_ROOT ?? root);
const gitRoot = resolve(process.env.CAPTURE_GIT_ROOT ?? root);
if (sourceRoot !== root)
  throw new Error(
    "Launch capture-c8.mjs from the exact frozen source tree; CAPTURE_SOURCE_ROOT cannot substitute another script tree.",
  );
const base = process.env.CAPTURE_BASE_URL;
const sourceCommit = process.env.CAPTURE_SOURCE_COMMIT;
if (!base || !/^[a-f0-9]{40}$/.test(sourceCommit ?? ""))
  throw new Error(
    "Set CAPTURE_BASE_URL and the full frozen CAPTURE_SOURCE_COMMIT.",
  );
if (!process.env.CAPTURE_DESTINATION)
  throw new Error("Set CAPTURE_DESTINATION outside the immutable source tree.");
const destination = resolve(process.env.CAPTURE_DESTINATION);
if (destination === sourceRoot || destination.startsWith(sourceRoot + "/"))
  throw new Error("Capture output must not mutate the immutable source tree.");
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? C8_SCENES;
const variants = process.env.CAPTURE_VARIANTS?.split(",") ?? C8_VARIANTS;
if (
  new Set(scenes).size !== scenes.length ||
  new Set(variants).size !== variants.length ||
  scenes.some((scene) => !C8_SCENES.includes(scene)) ||
  variants.some((variant) => !C8_VARIANTS.includes(variant))
)
  throw new Error("Unknown or duplicate C8 scene/variant.");
const diagnostic =
  scenes.length !== C8_SCENES.length || variants.length !== C8_VARIANTS.length;
const sha = (value) => createHash("sha256").update(value).digest("hex");
const execute = promisify(execFile);
const seed = JSON.parse(
  await readFile(resolve(sourceRoot, "seed/demo-data.json"), "utf8"),
);
const configuration = JSON.parse(
  await readFile(resolve(sourceRoot, "seed/arzon-config.json"), "utf8"),
);

async function sourceIdentity() {
  const { stdout } = await execute(
    "git",
    [
      "-C",
      gitRoot,
      "ls-tree",
      "-rz",
      "--format=%(objectname)%x09%(path)",
      sourceCommit,
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const files = [];
  for (const entry of stdout.split("\0").filter(Boolean)) {
    const tab = entry.indexOf("\t");
    const blob = entry.slice(0, tab),
      path = entry.slice(tab + 1);
    if (!/^(prototype\/|seed\/|assets\/|AGENTS\.md$)/.test(path)) continue;
    const bytes = await readFile(resolve(sourceRoot, path));
    const actual = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    if (actual !== blob)
      throw new Error("Frozen source differs from exact Git blob: " + path);
    files.push({
      path,
      gitBlob: blob,
      sha256: sha(bytes),
      bytes: bytes.length,
    });
  }
  if (
    !files.some((entry) => entry.path === "prototype/scripts/capture-c8.mjs") ||
    !files.some((entry) => entry.path === "prototype/src/sales.ts")
  )
    throw new Error(
      "C8 capture and Sales domain must be included in the exact source commit.",
    );
  return {
    sourceCommit,
    verified: true,
    method:
      "Every prototype/seed/asset file is compared with the exact committed Git blob; no mutable source substitute",
    fileCount: files.length,
    fingerprint: sha(JSON.stringify(files)),
    files,
  };
}

async function assets(page) {
  const response = await page.request.get(base);
  if (!response.ok())
    throw new Error(`Production HTML returned ${response.status()}.`);
  const servedHTML = await response.body();
  const diskHTML = await readFile(
    resolve(sourceRoot, "prototype/dist/index.html"),
  );
  if (
    sha(servedHTML) !== sha(diskHTML) ||
    servedHTML.toString().includes("/@vite/client")
  )
    throw new Error(
      "Served production HTML does not match the frozen local dist.",
    );
  const paths = await page
    .locator('script[type="module"][src],link[rel="stylesheet"][href]')
    .evaluateAll((elements) =>
      elements
        .map(
          (element) =>
            element.getAttribute("src") ?? element.getAttribute("href"),
        )
        .sort(),
    );
  if (!paths.length)
    throw new Error("No production JavaScript/CSS assets found.");
  const entries = [];
  for (const path of paths) {
    const url = new URL(path, base);
    if (
      url.origin !== new URL(base).origin ||
      !url.pathname.startsWith("/assets/") ||
      !/\.(js|css)$/.test(url.pathname)
    )
      throw new Error("Unexpected external or mutable runtime asset: " + path);
    const response = await page.request.get(url.href);
    if (!response.ok())
      throw new Error("Production asset failed: " + url.pathname);
    const servedSHA = sha(await response.body());
    if (
      servedSHA !==
      sha(
        await readFile(
          resolve(sourceRoot, "prototype/dist", url.pathname.slice(1)),
        ),
      )
    )
      throw new Error(
        "Served asset differs from the exact frozen dist: " + url.pathname,
      );
    entries.push({ path: url.pathname, sha256: servedSHA });
  }
  return {
    htmlSHA256: sha(servedHTML),
    fingerprint: sha(JSON.stringify(entries)),
    assets: entries,
    verifiedAgainstLocalDist: true,
  };
}

const initialSource = await sourceIdentity();
await mkdir(destination, { recursive: true });
const screens = [],
  browserErrors = [],
  productionBuilds = [];
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
});
let finalSource = null;
try {
  for (const variant of variants)
    for (const scene of scenes) {
      const viewport =
        variant === "phone-dark"
          ? { width: 390, height: 844 }
          : variant === "mid-900"
            ? { width: 900, height: 1080 }
            : { width: 1440, height: 1080 };
      const context = await browser.newContext({
        baseURL: base,
        viewport,
        deviceScaleFactor: 1,
        isMobile: variant === "phone-dark",
        hasTouch: variant === "phone-dark",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on("pageerror", (error) =>
        browserErrors.push({ scene, variant, message: error.message }),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          browserErrors.push({ scene, variant, message: message.text() });
      });
      try {
        await page.goto(base);
        const before = await assets(page);
        productionBuilds.push({ scene, variant, phase: "before", ...before });
        const role = c8SceneRole(scene),
          account = seed.demo_users.find((user) => user.role === role);
        if (!account?.password)
          throw new Error("Missing approved demo account: " + role);
        await field(page, "Username").fill(account.username);
        await field(page, "Password").fill(account.password);
        await button(page, "Sign in").click();
        await expect(page.locator(".topbar")).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () => localStorage.getItem("supermarket-prototype-v1") !== null,
            ),
          )
          .toBe(true);
        const branch = configuration.branches.find(
          (entry) => entry.id === "Branch 1",
        );
        if (role === "supervisor")
          await choose(
            page,
            field(page.locator(".topbar"), "Branch"),
            branch.name,
          );
        else
          await expect(page.locator(".topbar .branch-pill")).toContainText(
            branch.name,
          );
        const setup = await setupC8Scene(page, scene, {
          costOriginal: resolve(
            sourceRoot,
            "prototype/public/demo-originals/fictional-hw-5012.svg",
          ),
        });
        await appearance(
          page,
          variant === "phone-dark"
            ? "en-dark"
            : variant === "mid-900"
              ? "en-light"
              : variant,
        );
        await setup.afterAppearance?.(page);
        await expect(page.locator(setup.selector).first()).toBeVisible();
        await settled(page);
        await page.mouse.move(0, 0);
        // Keep native-dialog scroll position chosen by its real field/focus action.
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        const layout = await inspectC8Layout(
          page,
          scene,
          variant === "fa-light" ? "fa" : "en",
          viewport.width,
        );
        const filename = `${scene}-${variant}.png`;
        await page.screenshot({
          path: resolve(destination, filename),
          fullPage: setup.capture === "page",
          animations: "disabled",
        });
        const after = await assets(page);
        productionBuilds.push({ scene, variant, phase: "after", ...after });
        if (
          before.htmlSHA256 !== after.htmlSHA256 ||
          before.fingerprint !== after.fingerprint
        )
          throw new Error("Production assets changed during capture.");
        const png = await readFile(resolve(destination, filename));
        screens.push({
          scene,
          variant,
          filename,
          sha256: sha(png),
          bytes: png.length,
          viewport,
          role,
          route: new URL(page.url()).hash,
          captureMode: setup.capture,
          fixtureEvidence: await page
            .locator(setup.selector)
            .first()
            .innerText(),
          fixtureInputs: setup.evidence ?? null,
          layout,
        });
        console.log(
          `${filename}: ${layout.words} measured words; ${layout.containment.rowCount} measured table rows; ${layout.failures.length} layout findings`,
        );
        for (const finding of layout.failures)
          console.error(`${filename}: ${finding}`);
      } catch (error) {
        browserErrors.push({ scene, variant, message: error.message });
        console.error(`${scene}-${variant}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  finalSource = await sourceIdentity();
  if (finalSource.fingerprint !== initialSource.fingerprint)
    throw new Error("Frozen source files changed during capture.");
} catch (error) {
  browserErrors.push({ phase: "source-after", message: error.message });
} finally {
  await browser.close();
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        stage: "c8",
        sourceCommit,
        diagnostic,
        expectedCount: 75,
        selectedCount: scenes.length * variants.length,
        method:
          "Fresh approved fictional profiles and real UI actions. Full page or native dialog viewport PNGs remain unedited. Exact Git source files and local production HTML/assets verified before/after; existing glyph/control/overflow guards plus row-to-card containment retained.",
        sourceIdentity: {
          ...initialSource,
          verified:
            finalSource?.verified === true &&
            finalSource.fingerprint === initialSource.fingerprint,
          afterFingerprint: finalSource?.fingerprint ?? null,
        },
        productionBuilds,
        screens,
        browserErrors,
      },
      null,
      2,
    ) + "\n",
  );
}
if (
  screens.length !== scenes.length * variants.length ||
  browserErrors.length ||
  screens.some((screen) => screen.layout.failures.length) ||
  new Set(productionBuilds.map((build) => build.fingerprint)).size !== 1 ||
  new Set(productionBuilds.map((build) => build.htmlSHA256)).size !== 1
)
  process.exitCode = 1;
