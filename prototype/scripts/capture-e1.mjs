/* global process, console, window, URL */
import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appearance, button, field, settled } from "./c5-browser-proof.mjs";
import { inspectC8Layout } from "./capture-c8-proof.mjs";
const E1_SCENES = [
  "people",
  "add-person",
  "edit-person",
  "location-picker",
  "branch-supervisor-dashboard",
];
const E1_VARIANTS = ["en-light", "en-dark", "fa-light", "phone-dark"];
async function setupE1Scene(page, scene, variant, seed, configuration) {
  const localized = variant === "fa-light";
  if (scene === "branch-supervisor-dashboard") {
    await page.evaluate(() => {
      window.location.hash = "dashboard";
    });
    await expect(page.locator(".location-dashboard-kpis .ui-kpi")).toHaveCount(
      4,
    );
    await expect(page.locator(".location-dashboard-cards > .card")).toHaveCount(
      6,
    );
    await expect(page.locator(".topbar .branch-pill")).toContainText(
      localized ? "همه مکان‌های من" : "All my locations",
    );
    return {
      selector: ".location-dashboard",
      capture: "page",
      evidence: {
        actor_username: "rh-supervisor",
        allowed_locations: ["Branch 2", "Branch 3"],
        default_selection: "all_my_locations",
        no_supplier_money: true,
      },
    };
  }
  if (scene === "location-picker") {
    const picker = page.locator(".topbar").getByRole("combobox", {
      name: localized ? "مکان" : "Location",
      exact: true,
    });
    await expect(picker).toContainText(
      localized ? "همه مکان‌های من" : "All my locations",
    );
    await picker.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const account = seed.demo_users.find(
      (person) => person.username === "rh-supervisor",
    );
    const assigned = account.location_scope.location_ids;
    await expect(page.getByRole("option")).toHaveCount(assigned.length + 1);
    for (const branch of configuration.branches) {
      const option = page.getByRole("option", {
        name: localized ? branch.name_fa : branch.name,
        exact: true,
      });
      if (assigned.includes(branch.id)) await expect(option).toBeVisible();
      else await expect(option).toHaveCount(0);
    }
    await expect(
      page.getByRole("option", {
        name: localized ? "همه مکان‌های من" : "All my locations",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", {
        name: localized ? "همه مکان‌ها" : "All locations",
        exact: true,
      }),
    ).toHaveCount(0);
    return {
      selector: ".ui-select-popover",
      capture: "viewport",
      evidence: {
        actor_username: "rh-supervisor",
        allowed_locations: assigned,
        selection: "all_my_locations",
        forbidden_locations: configuration.branches
          .filter((branch) => !assigned.includes(branch.id))
          .map((branch) => branch.id),
        company_aggregate_available: false,
        write_location_not_inferred: true,
      },
    };
  }
  await page.evaluate(() => {
    window.location.hash = "settings?group=people";
  });
  await expect(page.locator(".people-e1")).toBeVisible();
  const people = page.locator(".people-e1");
  await expect(
    people.locator("tbody > tr:not(.table-expanded-row)"),
  ).toHaveCount(6);
  if (scene === "people")
    return {
      selector: ".people-e1",
      capture: "page",
      evidence: { configured_people: 6 },
    };
  if (scene === "add-person") {
    await people
      .getByRole("button", {
        name: localized ? "افزودن شخص" : "Add person",
        exact: true,
      })
      .click();
    const role = configuration.roles.find(
      (role) => role.key === "floor_worker",
    );
    const location = configuration.branches.find(
      (branch) => branch.id === "Branch 1",
    );
    await page.locator("#person-role").click();
    await page
      .getByRole("option", {
        name: localized ? role.label_fa : role.label,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("checkbox", {
        name: localized ? location.name_fa : location.name,
        exact: true,
      })
      .check();
    await expect(page.locator("#person-role")).toContainText(
      localized ? role.label_fa : role.label,
    );
    await expect(
      page.getByRole("dialog").getByRole("checkbox", {
        name: localized ? location.name_fa : location.name,
        exact: true,
      }),
    ).toBeChecked();
  } else {
    const account = seed.demo_users.find(
      (person) => person.username === "cashier",
    );
    const row = people
      .locator("tbody > tr:not(.table-expanded-row)")
      .filter({ hasText: localized ? account.name_fa : account.name_en });
    await expect(row).toHaveCount(1);
    await row
      .getByRole("button", { name: localized ? "ویرایش" : "Edit", exact: true })
      .click();
  }
  const title =
    scene === "add-person"
      ? localized
        ? "افزودن شخص"
        : "Add person"
      : localized
        ? "ویرایش شخص"
        : "Edit person";
  await expect(
    page.getByRole("dialog", { name: title, exact: true }),
  ).toBeVisible();
  if (scene === "edit-person")
    await expect(page.locator("#person-username")).toHaveValue("cashier");
  return {
    selector: ".person-editor-dialog",
    capture: "viewport",
    evidence: {
      form: scene,
      changes_saved: false,
      existing_username: scene === "edit-person" ? "cashier" : null,
      draft_role: scene === "add-person" ? "floor_worker" : null,
      draft_assigned_locations: scene === "add-person" ? ["Branch 1"] : null,
    },
    framing:
      "Native dialog viewport; its actual body may scroll on phones. No fields are moved or hidden for the image.",
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(process.env.CAPTURE_SOURCE_ROOT ?? root);
const gitRoot = resolve(process.env.CAPTURE_GIT_ROOT ?? root);
if (sourceRoot !== root)
  throw new Error(
    "Launch capture-e1.mjs from the exact frozen source tree; CAPTURE_SOURCE_ROOT cannot substitute another script tree.",
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
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? E1_SCENES;
const variants = process.env.CAPTURE_VARIANTS?.split(",") ?? E1_VARIANTS;
if (
  new Set(scenes).size !== scenes.length ||
  new Set(variants).size !== variants.length ||
  scenes.some((scene) => !E1_SCENES.includes(scene)) ||
  variants.some((variant) => !E1_VARIANTS.includes(variant))
)
  throw new Error("Unknown or duplicate E1 scene/variant.");
const diagnostic =
  scenes.length !== E1_SCENES.length || variants.length !== E1_VARIANTS.length;
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
    !files.some((entry) => entry.path === "prototype/scripts/capture-e1.mjs") ||
    !files.some(
      (entry) => entry.path === "prototype/src/authority-repository.ts",
    )
  )
    throw new Error(
      "E1 capture and actual authority repository must be included in the exact source commit.",
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
        const role = [
          "branch-supervisor-dashboard",
          "location-picker",
        ].includes(scene)
          ? "branch_supervisor"
          : "manager";
        const username =
          role === "branch_supervisor" ? "rh-supervisor" : "manager";
        const account = seed.demo_users.find(
          (user) => user.username === username,
        );
        if (!account?.password || account.role !== role)
          throw new Error(
            "Missing approved configured demo account: " + username,
          );
        await field(page, "Username").fill(account.username);
        await field(page, "Password").fill(account.password);
        await button(page, "Sign in").click();
        await expect(
          page.getByRole("heading", {
            name: "Second sign-in step",
            exact: true,
          }),
        ).toBeVisible();
        await button(page, "Use simulated passkey").click();
        await expect(page.locator(".topbar")).toBeVisible();
        await appearance(
          page,
          variant === "phone-dark"
            ? "en-dark"
            : variant === "mid-900"
              ? "en-light"
              : variant,
        );
        const setup = await setupE1Scene(
          page,
          scene,
          variant,
          seed,
          configuration,
        );
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
          framing: setup.framing ?? null,
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
        stage: "e1",
        sourceCommit,
        diagnostic,
        expectedCount: 20,
        selectedCount: scenes.length * variants.length,
        method:
          "Six configured fictional people and real username/password + simulated second-step UI actions; no raw identity/session writes or source data mutation. Full page or native dialog viewport PNGs remain unedited. Exact Git source files and local production HTML/assets verified before/after; existing glyph/control/overflow guards plus row-to-card containment retained.",
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
