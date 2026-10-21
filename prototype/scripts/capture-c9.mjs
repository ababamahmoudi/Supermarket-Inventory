/* global process, console, document, window, getComputedStyle, URL */
import { chromium, expect, devices } from "@playwright/test";
import Decimal from "decimal.js";
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
  shellAction,
} from "./c5-browser-proof.mjs";
import { inspectC8Layout, readC8State, visitC8 } from "./capture-c8-proof.mjs";

// Copy beside the existing capture helpers in prototype/scripts before running.
// All scene changes use the genuine UI. The imported IDB helper is readonly.
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const prototypeRoot = resolve(sourceRoot, "prototype");
const execute = promisify(execFile);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const SCENES = [
  "products",
  "product-sale",
  "lookup-sale",
  "labels",
  "notes-seen-done",
  "price-updates",
  "dates",
  "branch-requests",
  "new-branch-request",
  "approvals-rejected",
];
const VARIANTS = {
  "en-light": { lang: "en", theme: "light", width: 1440, height: 1080 },
  "en-dark": { lang: "en", theme: "dark", width: 1440, height: 1080 },
  "fa-light": { lang: "fa", theme: "light", width: 1440, height: 1080 },
  phone390: { lang: "en", theme: "dark", width: 390, height: 844, phone: true },
  "fa-phone390": {
    lang: "fa",
    theme: "light",
    width: 390,
    height: 844,
    phone: true,
  },
};
const DEFAULT_VARIANTS = ["en-light", "en-dark", "fa-light", "phone390"];
const REFERENCE_FOR_SCENE = {
  products: "Prices",
  "product-sale": "Prices",
  "lookup-sale": "Prices",
  labels: "Prices",
  "notes-seen-done": "Notes",
  "price-updates": "Lists",
  dates: "Lists",
  "branch-requests": "Lists",
  "new-branch-request": "Lists",
  "approvals-rejected": "Lists",
};
if (process.argv.includes("--help")) {
  console.log(`From prototype/scripts: CAPTURE_BASE_URL=http://127.0.0.1:5174 CAPTURE_DESTINATION=/tmp/c9-final-captures node capture-c9.mjs
Optional: CAPTURE_SCREENS=${SCENES.join(",")}; CAPTURE_VARIANTS=${DEFAULT_VARIANTS.join(",")}; CAPTURE_REFERENCE_DIR=/tmp/c9-source-designs/C9-designs
The complete required run has 10 scenes × 4 variants. Add fa-phone390 for supplemental Persian phone captures. No browser runs until the caller supplies a stable production preview.`);
  process.exit(0);
}
const base = process.env.CAPTURE_BASE_URL;
if (!base || !/^https?:\/\//.test(base))
  throw new Error("Set CAPTURE_BASE_URL to the stable production preview.");
if (new URL(base).username || new URL(base).password)
  throw new Error(
    "The capture base URL must not contain embedded credentials.",
  );
if (!process.env.CAPTURE_DESTINATION)
  throw new Error("Set CAPTURE_DESTINATION outside the source tree.");
const destination = resolve(process.env.CAPTURE_DESTINATION);
if (destination === sourceRoot || destination.startsWith(sourceRoot + "/"))
  throw new Error("Capture output must be outside the frozen source tree.");
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? SCENES;
const variants = process.env.CAPTURE_VARIANTS?.split(",") ?? DEFAULT_VARIANTS;
if (
  new Set(scenes).size !== scenes.length ||
  new Set(variants).size !== variants.length ||
  scenes.some((scene) => !SCENES.includes(scene)) ||
  variants.some((variant) => !VARIANTS[variant])
)
  throw new Error("Unknown or duplicate capture scene/variant.");
const seed = JSON.parse(
  await readFile(resolve(sourceRoot, "seed/demo-data.json"), "utf8"),
);
const configuration = JSON.parse(
  await readFile(resolve(sourceRoot, "seed/arzon-config.json"), "utf8"),
);
const privateDiagnosticValues = [
  ...new Set(
    [
      ...seed.demo_users.map((person) => person.password),
      configuration.session.simulated_authenticator_code,
    ].filter((value) => typeof value === "string" && value.length > 0),
  ),
];
const privateRecordKey =
  /^(?:.*password.*|.*verifier.*|credentials?.*|sessions?|session_.*|authority.*|auth_identity|people|devices)$/i;
function publicDiagnostic(value) {
  let message = String(value ?? "");
  // Keep counts and harmless error context without publishing a serialized
  // authority/credential record or a Playwright fill() credential call log.
  if (
    /(?:["']?(?:password|credential|verifier|sessions?|session_id|session_token|authority_snapshot|authority_epoch)["']?\s*[:=]|AuthoritySnapshot)/i.test(
      message,
    )
  )
    return "Sensitive diagnostic payload omitted; the browser error count is retained.";
  for (const secret of privateDiagnosticValues)
    message = message.replaceAll(secret, "[redacted]");
  return message.replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]");
}
function publicURL(value) {
  const url = new URL(value, base);
  url.username = "";
  url.password = "";
  for (const key of [...url.searchParams.keys()])
    if (
      /password|token|secret|verifier|session|credential|^code$|api.?key/i.test(
        key,
      )
    )
      url.searchParams.set(key, "[redacted]");
  return url.href;
}
function assertPublicManifest(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (privateRecordKey.test(key))
      throw new Error(
        "Private authority/credential records cannot enter a capture manifest.",
      );
    assertPublicManifest(nested);
  }
}
async function writeManifest(manifest) {
  assertPublicManifest(manifest);
  await writeFile(
    resolve(destination, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
await mkdir(destination, { recursive: true });

async function sourceIdentity() {
  const { stdout: head } = await execute("git", [
    "-C",
    sourceRoot,
    "rev-parse",
    "HEAD",
  ]);
  const { stdout: status } = await execute("git", [
    "-C",
    sourceRoot,
    "status",
    "--porcelain",
    "--untracked-files=normal",
  ]);
  const { stdout: paths } = await execute(
    "git",
    [
      "-C",
      sourceRoot,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "prototype",
      "seed",
      "assets",
      "AGENTS.md",
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const files = [];
  for (const path of [...new Set(paths.split("\0").filter(Boolean))].sort()) {
    if (
      /^(prototype\/(node_modules|dist|test-results|playwright-report)\/)/.test(
        path,
      )
    )
      continue;
    const bytes = await readFile(resolve(sourceRoot, path));
    files.push({ path, sha256: sha(bytes), bytes: bytes.length });
  }
  return {
    git_head: head.trim(),
    dirty_worktree: Boolean(status.trim()),
    fingerprint: sha(JSON.stringify(files)),
    files,
  };
}

async function productionAssets(page) {
  const response = await page.request.get(base);
  if (!response.ok())
    throw new Error(`Preview HTML returned ${response.status()}`);
  const html = await response.body();
  const diskHTML = await readFile(resolve(prototypeRoot, "dist/index.html"));
  if (sha(html) !== sha(diskHTML) || html.toString().includes("/@vite/client"))
    throw new Error(
      "Preview must serve the exact stable local production dist.",
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
  if (!paths.length) throw new Error("Production JS/CSS paths are missing.");
  const assets = [];
  for (const path of paths) {
    const url = new URL(path, base);
    if (
      url.origin !== new URL(base).origin ||
      !url.pathname.startsWith("/assets/") ||
      !/\.(js|css)$/.test(url.pathname)
    )
      throw new Error(`Unexpected production asset: ${path}`);
    const served = await page.request.get(url.href);
    if (!served.ok())
      throw new Error(`Production asset returned ${served.status()}: ${path}`);
    const bytes = await served.body();
    if (
      sha(bytes) !==
      sha(await readFile(resolve(prototypeRoot, "dist", url.pathname.slice(1))))
    )
      throw new Error(`Preview asset differs from local dist: ${path}`);
    assets.push({
      path: url.pathname,
      sha256: sha(bytes),
      bytes: bytes.length,
    });
  }
  return {
    html_sha256: sha(html),
    fingerprint: sha(JSON.stringify(assets)),
    assets,
  };
}

async function signIn(page, username) {
  const account = seed.demo_users.find(
    (person) => person.username === username,
  );
  if (!account?.password)
    throw new Error(`Configured fictional account is missing: ${username}`);
  const isFa = (await page.locator("html").getAttribute("lang")) === "fa";
  if (await page.locator(".topbar").isVisible()) {
    await (await shellAction(page, "Demo", "دمو")).click();
    await page
      .getByRole("menuitem", {
        name: isFa
          ? `تغییر به ${account.name_fa}`
          : `Switch to ${account.name_en}`,
        exact: true,
      })
      .click();
  } else {
    await expect(
      page.getByRole("heading", { name: /^(Sign in|ورود)$/ }),
    ).toBeVisible();
    await field(page, "Username", "نام کاربری").fill(account.username);
    await field(page, "Password", "گذرواژه").fill(account.password);
    await button(page, "Sign in", "ورود").click();
    if (["owner", "manager", "branch_supervisor"].includes(account.role)) {
      if (account.setup.second_step_method === "authenticator") {
        await field(
          page,
          "Authenticator app code",
          "کد برنامهٔ احراز هویت",
        ).fill(configuration.session.simulated_authenticator_code);
        await button(page, "Continue", "ادامه").click();
      } else {
        await button(
          page,
          "Use simulated passkey",
          "استفاده از کلید ورود شبیه‌سازی‌شده",
        ).click();
      }
    }
  }
  await expect(page.locator(".topbar")).toBeVisible();
  const fa = (await page.locator("html").getAttribute("lang")) === "fa";
  await expect(page.locator(".user-chip-copy strong")).toHaveText(
    fa ? account.name_fa : account.name_en,
  );
  await expect(
    field(page.locator(".topbar"), "Location", "مکان"),
  ).toBeEnabled();
}

async function setLocation(page, id) {
  const control = field(page.locator(".topbar"), "Location", "مکان");
  if (id === "all") {
    await choose(page, control, /^All (locations|my locations)$/);
  } else {
    const location = configuration.branches.find((record) => record.id === id);
    if (!location) throw new Error(`Configured location is missing: ${id}`);
    await choose(page, control, location.name);
  }
  await expect(control).toBeEnabled();
}

async function ready(page, selector) {
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator(selector).first()).toBeVisible();
  await expect(page.locator(".signin-page")).toHaveCount(0);
  await settled(page);
}

async function setupNotes(page) {
  await signIn(page, "ny-floor");
  await visitC8(page, "notes");
  await page.getByRole("tab", { name: /^For managers/ }).click();
  const text = "Please review the shelf labels before the next shift.";
  await button(page, "Add note").click();
  await field(page, "Note").fill(text);
  await button(page, "Save note").click();
  await expect(
    page.getByRole("dialog", { name: "Add note", exact: true }),
  ).toBeHidden();
  const state = await readC8State(page);
  const created = state.notes.find((record) => record.text === text);
  if (!created)
    throw new Error(
      "The note was not committed through its genuine Save action.",
    );
  const prior = state.notes.find(
    (record) =>
      record.type === "note_to_supervisor" &&
      record.id !== created.id &&
      !record.archived,
  );
  if (!prior) throw new Error("The genuine seeded manager note is missing.");
  const first = page.locator(`[data-note="${prior.id}"]`);
  await button(first, "Mark as seen").click();
  await expect(button(first, "Seen by you")).toBeDisabled();
  await signIn(page, "manager");
  await setLocation(page, "Branch 1");
  await visitC8(page, `notes?note=${encodeURIComponent(prior.id)}`);
  await button(first, "Mark as seen").click();
  await expect(button(first, "Seen by you")).toBeDisabled();
  const completed = page.locator(`[data-note="${created.id}"]`);
  await button(completed, "Mark done").click();
  await expect(completed.locator(".badge")).toHaveText("Done");
  const saved = await readC8State(page);
  const selected = saved.notes.filter((record) =>
    [prior.id, created.id].includes(record.id),
  );
  expect(
    selected.find((record) => record.id === prior.id).seen_receipts,
  ).toHaveLength(2);
  expect(selected.find((record) => record.id === created.id)).toMatchObject({
    status: "resolved",
    done_by_user_id: seed.demo_users.find(
      (person) => person.username === "manager",
    ).id,
  });
  return {
    selector: ".notebooks-page",
    reference: "Notes",
    evidence: {
      source:
        "Actual Floor Worker and Manager UI acknowledgements; actual Manager completion",
      notes: selected.map(
        ({ id, status, seen_receipts, done_by, done_by_user_id, done_at }) => ({
          id,
          status,
          seen_receipts,
          done_by,
          done_by_user_id,
          done_at,
        }),
      ),
    },
  };
}

async function setupPriceUpdates(page) {
  await setLocation(page, "all");
  await visitC8(page, "alerts");
  const card = page
    .locator("main .card")
    .filter({ hasText: "Black Tea" })
    .filter({ has: button(page, "Apply this price to all") })
    .first();
  const northYork = card.getByRole("row").filter({ hasText: "North York" });
  await button(northYork, "Apply this price to all").click();
  const dialog = page.getByRole("dialog", {
    name: "Apply price to all branches",
    exact: true,
  });
  await button(dialog, "Apply price to all branches").click();
  await expect
    .poll(
      async () =>
        (await readC8State(page)).price_update_tasks?.filter(
          (task) => task.status === "pending",
        ).length ?? 0,
    )
    .toBeGreaterThan(0);
  const state = await readC8State(page);
  await visitC8(page, "price-updates");
  await expect(page.locator(".price-updates-row")).not.toHaveCount(0);
  return {
    selector: ".price-updates-page",
    reference: "Lists",
    evidence: {
      source:
        "Actual Apply this price to all UI decision creates current pending work",
      tasks: state.price_update_tasks
        .filter((task) => task.status === "pending")
        .map(({ id, product_code, branch, version, status }) => ({
          id,
          product_code,
          branch,
          version,
          status,
        })),
    },
  };
}

async function openBranchRequest(page, send) {
  await visitC8(page, "requests");
  await button(page, "New request").click();
  await choose(
    page,
    field(page, "Ask this location"),
    configuration.branches.find((record) => record.id === "Branch 2").name,
  );
  const search = field(
    page,
    "Add a product, or type an item that isn't in the catalog",
  );
  await search.fill("0008");
  const result = page
    .locator(".request-search-results")
    .filter({ hasText: "Sunflower" });
  await button(result, "Add").first().click();
  await field(page.locator(".request-draft-line").first(), "Quantity").fill(
    "2",
  );
  if (!send)
    return {
      selector: ".request-form",
      reference: "Lists",
      evidence: {
        source:
          "Actual unsaved New request form; selected catalog item and quantity through UI",
        saved: false,
        product_code: "0008",
        quantity: "2",
        from_location: "Branch 1",
        ask_location: "Branch 2",
      },
    };
  await button(page, "Send request").click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Requested",
  );
  const reference = await page.locator(".request-detail h2").innerText();
  await button(page, "Back to requests").click();
  const row = page.getByRole("row").filter({ hasText: reference });
  await expect(row).toBeVisible();
  const state = await readC8State(page);
  const request = state.branch_requests.find(
    (record) => record.reference === reference,
  );
  expect(request.status).toBe("requested");
  return {
    selector: ".branch-requests-screen",
    reference: "Lists",
    evidence: {
      source:
        "Actual New request and Send request UI; no goods marked sent or received",
      request_id: request.id,
      reference,
      status: request.status,
      from_location: request.from_branch,
      ask_location: request.to_branch,
      item_count: request.items.length,
    },
  };
}

async function setupRejected(page) {
  await visitC8(page, "approvals");
  const state = await readC8State(page);
  const request = state.sale_requests.find(
    (record) =>
      record.id === "demo-c8-oil-request" && record.status === "pending",
  );
  if (!request)
    throw new Error("The genuine configured pending sale request is missing.");
  const card = page.locator(`[data-sale-request-id="${request.id}"]`);
  await button(card, "Reject").click();
  const dialog = page.getByRole("dialog", {
    name: "Reject sale request",
    exact: true,
  });
  const reason = "Keep the current price until the next delivery is reviewed.";
  await field(dialog, "Reason").fill(reason);
  await button(dialog, "Reject").click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(
      async () =>
        (await readC8State(page)).sale_requests.find(
          (record) => record.id === request.id,
        )?.status,
    )
    .toBe("rejected");
  await page.getByRole("tab", { name: /^Rejected(?: \d+)?$/ }).click();
  await expect(card).toBeVisible();
  await expect(card).toContainText(reason);
  await expect(card.getByRole("button")).toHaveCount(0);
  const saved = (await readC8State(page)).sale_requests.find(
    (record) => record.id === request.id,
  );
  return {
    selector: "main",
    reference: "Lists",
    evidence: {
      source:
        "Actual pending sale request rejected through Manager UI; decided tab selected",
      request_id: saved.id,
      status: saved.status,
      decision_reason: saved.decision_reason,
      decided_by: saved.decided_by,
      decided_at: saved.decided_at,
    },
    reference_note:
      "Lists.png contains the matching Approvals Rejected section at the bottom.",
  };
}

async function setupScene(page, scene) {
  if (scene === "notes-seen-done") return setupNotes(page);
  if (scene === "price-updates") return setupPriceUpdates(page);
  if (scene === "branch-requests") return openBranchRequest(page, true);
  if (scene === "new-branch-request") return openBranchRequest(page, false);
  if (scene === "approvals-rejected") return setupRejected(page);
  const state = await readC8State(page);
  const sale = state.sales?.find((record) => record.id === "demo-c8-pot-sale");
  if (
    scene === "products" ||
    scene === "product-sale" ||
    scene === "lookup-sale" ||
    scene === "labels"
  ) {
    if (!sale || sale.status !== "active")
      throw new Error("The genuine active configured pot sale is missing.");
    const product = state.products.find(
      (record) => record.code === sale.product_code,
    );
    const regular =
      product.branch_prices?.[sale.branch] ?? product.selling_price;
    if (!new Decimal(sale.sale_price).lt(regular))
      throw new Error(
        "The configured sale does not have a lower public price.",
      );
    if (scene === "products") {
      await visitC8(page, "products");
      await expect(
        page.locator(
          ".catalog-products-table .product-offer-line.is-requested",
        ),
      ).not.toHaveCount(0);
      return {
        selector: ".catalog-products-table",
        reference: "Prices",
        evidence: {
          source:
            "Actual full Products list with configured active sale, offers and pending request",
          sale_id: sale.id,
          sale_price: sale.sale_price,
          regular_price: regular,
          pending_request_ids: state.sale_requests
            .filter((record) => record.status === "pending")
            .map((record) => record.id),
          offer_ids: state.offers.map((record) => record.id),
        },
      };
    }
    if (scene === "product-sale") {
      await visitC8(
        page,
        `product?code=${encodeURIComponent(sale.product_code)}`,
      );
      await expect(page.locator(".c9-sale-details")).toBeVisible();
      return {
        selector: ".product-page",
        reference: "Prices",
        evidence: {
          source: "Actual full Product page and genuine running sale detail",
          product_code: sale.product_code,
          sale_id: sale.id,
          sale_price: sale.sale_price,
          regular_price: regular,
        },
      };
    }
    if (scene === "lookup-sale") {
      await visitC8(
        page,
        `lookup?search=${encodeURIComponent(sale.product_code)}`,
      );
      const search = page.locator(".lookup-page").getByRole("combobox", {
        name: /^(Search products|جست‌وجوی محصولات|جستجوی کالاها)$/,
      });
      await search.fill(sale.product_code);
      await search.press("Enter");
      await expect(page.locator(".lookup-detail .sale-pill")).toBeVisible();
      return {
        selector: ".lookup-page",
        reference: "Prices",
        evidence: {
          source: "Actual Lookup search selection and active sale",
          product_code: sale.product_code,
          sale_id: sale.id,
          sale_price: sale.sale_price,
          regular_price: regular,
        },
      };
    }
    await visitC8(page, "labels");
    await expect(page.locator(".labels-product-table")).toBeVisible();
    return {
      selector: ".labels-product-table",
      reference: "Prices",
      evidence: {
        source:
          "Actual unfiltered Labels Products list with native fixed column layout",
        sale_id: sale.id,
      },
    };
  }
  if (scene === "dates") {
    await visitC8(page, "expiry");
    return {
      selector: ".date-tracking-page",
      reference: "Lists",
      evidence: {
        source:
          "Actual Date tracking list/filter controls and configured date entries",
        active_dates: state.expiry
          .filter((record) => record.status === "active")
          .map(({ id, product_code, date }) => ({ id, product_code, date })),
      },
    };
  }
  throw new Error(`Unknown scene: ${scene}`);
}

async function layoutMetadata(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !element.closest("[hidden],dialog:not([open])")
      );
    };
    const panels = [
      ...document.querySelectorAll(
        "main,main .card,main .ui-card,main .ui-data-table,main .c9-filter-toolbar,main .notebook-entry-card,main .request-form",
      ),
    ]
      .filter(visible)
      .map((element) => ({
        selector: element.id ? `#${element.id}` : element.className,
        client_width: element.clientWidth,
        scroll_width: element.scrollWidth,
        overflow: element.scrollWidth > element.clientWidth + 2,
      }));
    const filterControls = [
      ...document.querySelectorAll("main .filter-toolbar"),
    ]
      .filter(visible)
      .map((bar) => ({
        classes: bar.className,
        controls: [
          ...bar.querySelectorAll(
            ".filter-search-pill,.ui-segments,.ui-select,.ui-button,.filter-chip,.ui-date-trigger",
          ),
        ]
          .filter(visible)
          .filter(
            (element) =>
              !element.closest(".ui-segments") ||
              element.matches(".ui-segments"),
          )
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label:
                element.getAttribute("aria-label") ??
                element.textContent?.trim(),
              height: rect.height,
              top: rect.top,
              center: rect.top + rect.height / 2,
              left: rect.left,
              right: rect.right,
            };
          }),
      }));
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        document_width: document.documentElement.scrollWidth,
      },
      page_overflow:
        document.documentElement.scrollWidth > window.innerWidth + 2,
      panels,
      filter_controls: filterControls,
      theme: document.documentElement.dataset.theme,
      lang: document.documentElement.lang,
      direction: document.documentElement.dir,
      page_background: getComputedStyle(document.documentElement)
        .backgroundColor,
    };
  });
}

const references = {};
for (const name of ["Prices", "Notes", "Lists"]) {
  const original = resolve(
    process.env.CAPTURE_REFERENCE_DIR ?? "/tmp/c9-source-designs/C9-designs",
    `${name}.png`,
  );
  const bytes = await readFile(original);
  const path = `references/${name}.png`;
  await mkdir(resolve(destination, "references"), { recursive: true });
  await writeFile(resolve(destination, path), bytes);
  references[name] = {
    path,
    sha256: sha(bytes),
    original_source: original,
    unedited_copy: true,
  };
}
const source = await sourceIdentity();
const manifest = {
  generated_at: new Date().toISOString(),
  base_url: publicURL(base),
  source,
  scope:
    "Native Chromium screenshots of the actual frozen production app; all setup uses UI; no injected state or CSS.",
  variants: variants.map((key) => ({ key, ...VARIANTS[key] })),
  scenes,
  references,
  captures: [],
  failures: [],
  required_capture_count: SCENES.length * DEFAULT_VARIANTS.length,
  diagnostic_subset:
    scenes.length !== SCENES.length ||
    DEFAULT_VARIANTS.some((key) => !variants.includes(key)),
};
await writeManifest(manifest);
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
});
try {
  for (const variant of variants)
    for (const scene of scenes) {
      const options = VARIANTS[variant];
      const context = await browser.newContext({
        ...(options.phone ? devices["iPhone 13"] : {}),
        baseURL: base,
        viewport: { width: options.width, height: options.height },
        deviceScaleFactor: 1,
        isMobile: Boolean(options.phone),
        hasTouch: Boolean(options.phone),
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const pageErrors = [],
        consoleErrors = [],
        requestFailures = [];
      page.on("pageerror", (error) =>
        pageErrors.push(publicDiagnostic(error.message)),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          consoleErrors.push(publicDiagnostic(message.text()));
      });
      page.on("requestfailed", (request) =>
        requestFailures.push({
          url: publicURL(request.url()),
          error: publicDiagnostic(request.failure()?.errorText),
        }),
      );
      try {
        await page.goto(base);
        const beforeAssets = await productionAssets(page);
        await signIn(page, "manager");
        await setLocation(page, "Branch 1");
        const setup = await setupScene(page, scene);
        await appearance(
          page,
          options.lang === "fa"
            ? "fa-light"
            : options.theme === "dark"
              ? "en-dark"
              : "en-light",
        );
        const dismissUndo = button(
          page,
          "Dismiss Undo message",
          "بستن پیام واگرد",
        );
        if (await dismissUndo.isVisible()) await dismissUndo.click();
        await ready(page, setup.selector);
        // End setup like a reader: leave the editor,
        // then return to the top before native full-page capture. This also
        // avoids capturing a focused skip link or a scrolled sticky top bar.
        await page.locator("main h1").click();
        await page.keyboard.press("Control+Home");
        await settled(page);
        if (scene === "lookup-sale") {
          await expect(page.locator(".lookup-detail .sale-pill")).toBeVisible();
          await expect(
            page.locator(".lookup-detail .c9-regular-line"),
          ).toBeVisible();
          await expect(
            page.locator(".lookup-page").getByRole("combobox"),
          ).toHaveValue(setup.evidence.product_code);
        }
        // Native screenshot only. No CSS, DOM, storage or business-state patching.
        const path = `${scene}-${variant}.png`;
        await page.screenshot({
          path: resolve(destination, path),
          fullPage: true,
          animations: "disabled",
        });
        const bytes = await readFile(resolve(destination, path));
        const imageWidth = bytes.readUInt32BE(16);
        const imageHeight = bytes.readUInt32BE(20);
        const overflow = await layoutMetadata(page);
        const layout = await inspectC8Layout(
          page,
          scene,
          options.lang,
          options.width,
        );
        const afterAssets = await productionAssets(page);
        if (beforeAssets.fingerprint !== afterAssets.fingerprint)
          throw new Error("Served assets changed during this scene.");
        manifest.captures.push({
          scene,
          variant,
          path,
          url: publicURL(page.url()),
          sha256: sha(bytes),
          bytes: bytes.length,
          width: imageWidth,
          height: imageHeight,
          viewport: { width: options.width, height: options.height },
          full_page: true,
          reference: setup.reference ?? REFERENCE_FOR_SCENE[scene],
          reference_note: setup.reference_note,
          page_errors: pageErrors,
          console_errors: consoleErrors,
          request_failures: requestFailures,
          overflow,
          layout,
          evidence: setup.evidence,
          production_assets: afterAssets,
          captured_at: new Date().toISOString(),
          review_status: "Review required",
        });
        console.log(
          JSON.stringify({
            scene,
            variant,
            captured: path,
            page_errors: pageErrors.length,
            console_errors: consoleErrors.length,
            page_overflow: overflow.page_overflow,
            layout_failures: layout.failures.length,
          }),
        );
      } catch (error) {
        const failure = {
          scene,
          variant,
          error: publicDiagnostic(error.message),
          url: publicURL(page.url()),
          page_errors: pageErrors,
          console_errors: consoleErrors,
          request_failures: requestFailures,
        };
        try {
          if (!(await page.locator(".signin-page").isVisible())) {
            failure.diagnostic_path = `FAILED-${scene}-${variant}.png`;
            await page.screenshot({
              path: resolve(destination, failure.diagnostic_path),
              fullPage: true,
              animations: "disabled",
            });
          }
        } catch {
          /* The failure remains evidence even when the page has closed. */
        }
        manifest.failures.push(failure);
        console.log(
          JSON.stringify({
            scene,
            variant,
            failed: publicDiagnostic(error.message),
          }),
        );
      } finally {
        await context.close();
        await writeManifest(manifest);
      }
    }
} finally {
  await browser.close();
  manifest.final_source = await sourceIdentity();
  manifest.source_unchanged =
    source.fingerprint === manifest.final_source.fingerprint;
  manifest.finished_at = new Date().toISOString();
  manifest.complete_required_set = SCENES.every((scene) =>
    DEFAULT_VARIANTS.every((variant) =>
      manifest.captures.some(
        (capture) => capture.scene === scene && capture.variant === variant,
      ),
    ),
  );
  await writeManifest(manifest);
}
const actualErrors = manifest.captures.some(
  (capture) =>
    capture.page_errors.length ||
    capture.console_errors.length ||
    capture.request_failures.length ||
    capture.overflow.page_overflow ||
    capture.overflow.panels.some((panel) => panel.overflow) ||
    capture.layout.failures.length,
);
console.log(
  JSON.stringify({
    manifest: resolve(destination, "manifest.json"),
    captures: manifest.captures.length,
    failures: manifest.failures.length,
    source_unchanged: manifest.source_unchanged,
    complete_required_set: manifest.complete_required_set,
    gallery_command: `node prototype/scripts/build-c9-gallery.mjs --manifest ${resolve(destination, "manifest.json")}`,
  }),
);
if (manifest.failures.length || !manifest.source_unchanged || actualErrors)
  process.exitCode = 1;
