/* global process, console */
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const prototype = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = dirname(prototype);
const value = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const job = value("--job") ?? "checks";
if (!["checks", "native", "screenshots", "browser", "all"].includes(job))
  throw new Error("Use --job=checks, native, screenshots, browser or all.");
const proof = resolve(
  value("--proof-dir") ?? join(tmpdir(), `arzon-e2-${Date.now()}`),
);
if (existsSync(join(proof, "result.json")))
  throw new Error("Use a fresh proof directory; earlier evidence is retained.");
mkdirSync(proof, { recursive: true });
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
function files(path, output = {}) {
  if (!existsSync(path)) return output;
  for (const item of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const child = join(path, item.name);
    if (item.isDirectory()) files(child, output);
    else if (item.isFile()) output[relative(repository, child)] = hash(child);
  }
  return output;
}
function source() {
  const output = {};
  for (const path of [
    "prototype/src",
    "prototype/tests",
    "prototype/scripts",
    "assets",
    "seed",
  ])
    files(join(repository, path), output);
  for (const path of [
    "prototype/package.json",
    "prototype/package-lock.json",
    "prototype/vite.config.ts",
    "prototype/tsconfig.json",
    "docs/return-policy.md",
  ])
    if (existsSync(join(repository, path)))
      output[path] = hash(join(repository, path));
  return output;
}
const baseline = source();
writeFileSync(
  join(proof, "source-before.json"),
  JSON.stringify(baseline, null, 2),
);
const results = [];
function run(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: prototype,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(
    join(proof, `${label}.log`),
    `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.stack}` : ""}`,
  );
  const unchanged = JSON.stringify(source()) === JSON.stringify(baseline);
  results.push({
    label,
    exit_code: result.status,
    source_unchanged: unchanged,
  });
  writeFileSync(
    join(proof, "result.json"),
    JSON.stringify({ success: false, job, results, proof }, null, 2),
  );
  if (result.status !== 0 || !unchanged)
    throw new Error(`${label} failed. Read ${join(proof, `${label}.log`)}.`);
}
const bin = (packageName, path) =>
  resolve(prototype, "node_modules", packageName, path);
function cases(report) {
  const output = [];
  function visit(suite) {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) output.push(test);
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report.suites ?? []) visit(suite);
  return output;
}
if (job === "checks" || job === "all") {
  run("lint", [bin("eslint", "bin/eslint.js"), ".", "--max-warnings=0"]);
  run("format", [bin("prettier", "bin/prettier.cjs"), "--check", "."]);
  run("types", [bin("typescript", "bin/tsc"), "--noEmit"]);
  run("unit", [
    bin("vitest", "vitest.mjs"),
    "run",
    "--maxWorkers=1",
    "--reporter=json",
    `--outputFile=${join(proof, "unit.json")}`,
  ]);
  const unit = JSON.parse(readFileSync(join(proof, "unit.json"), "utf8"));
  if (!unit.success || !unit.numPassedTests || unit.numFailedTests)
    throw new Error("Unit report is not a successful nonempty run.");
  run("sdk", [
    bin("vitest", "vitest.mjs"),
    "run",
    "--config",
    "vitest.e1-sdk.config.ts",
    "--maxWorkers=1",
  ]);
}
run("build", [bin("typescript", "bin/tsc"), "--noEmit"]);
run("vite", [bin("vite", "bin/vite.js"), "build"]);
const built = files(join(prototype, "dist"));
writeFileSync(
  join(proof, "assets-before.json"),
  JSON.stringify(built, null, 2),
);
if (job !== "checks") {
  const quote = (text) => `'${text.replaceAll("'", `'"'"'`)}'`;
  for (const mode of ["all", "browser"].includes(job)
    ? ["native", "screenshots"]
    : [job]) {
    const configPath = join(proof, `playwright-${mode}.mjs`);
    const reportPath = join(proof, `${mode}.json`);
    const config = {
      testDir: join(prototype, mode === "native" ? "tests" : "scripts"),
      testMatch:
        mode === "native"
          ? "e2-price-updates.spec.ts"
          : "e2-screenshots.spec.ts",
      timeout: 60000,
      workers: 1,
      retries: 0,
      forbidOnly: true,
      reporter: [["json", { outputFile: reportPath }]],
      outputDir: join(proof, `${mode}-artifacts`),
      use: {
        baseURL: "http://127.0.0.1:5182",
        trace: "retain-on-failure",
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
      webServer: {
        command: `${quote(process.execPath)} ${quote(bin("vite", "bin/vite.js"))} preview --host 127.0.0.1 --port 5182 --strictPort`,
        cwd: prototype,
        url: "http://127.0.0.1:5182",
        reuseExistingServer: false,
        timeout: 30000,
      },
    };
    writeFileSync(
      configPath,
      `import {devices} from ${JSON.stringify(pathToFileURL(bin("@playwright/test", "index.mjs")).href)};\nexport default {...${JSON.stringify(config)},projects:${mode === "native" ? '[{name:"desktop",use:{...devices["Desktop Chrome"]}},{name:"phone",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}}]' : '[{name:"screenshots",use:{...devices["Desktop Chrome"]}}]'}};\n`,
    );
    run(mode, [
      bin("@playwright/test", "cli.js"),
      "test",
      "--config",
      configPath,
    ]);
    const tests = cases(JSON.parse(readFileSync(reportPath, "utf8")));
    if (
      tests.length !== (mode === "native" ? 8 : 4) ||
      tests.some(
        (test) =>
          test.status !== "expected" ||
          test.results.length !== 1 ||
          test.results[0].status !== "passed",
      )
    )
      throw new Error(
        `${mode} report has failures, skipped tests, retries or an unexpected case count.`,
      );
    if (
      mode === "screenshots" &&
      tests
        .flatMap((test) => test.results[0].attachments ?? [])
        .filter((attachment) => attachment.contentType === "image/png")
        .length !== 24
    )
      throw new Error(
        "Screenshot report must contain all 24 requested scene/variant captures.",
      );
    if (
      JSON.stringify(files(join(prototype, "dist"))) !== JSON.stringify(built)
    )
      throw new Error("Built assets changed during browser proof.");
  }
}
writeFileSync(
  join(proof, "result.json"),
  JSON.stringify(
    {
      success: true,
      job,
      results,
      source_unchanged: JSON.stringify(source()) === JSON.stringify(baseline),
      assets_unchanged:
        JSON.stringify(files(join(prototype, "dist"))) ===
        JSON.stringify(built),
      proof,
    },
    null,
    2,
  ),
);
console.log(`E2 ${job} passed. Evidence: ${proof}`);
