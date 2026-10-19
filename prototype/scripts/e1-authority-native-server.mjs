/* global process, Buffer, URL */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const prototypeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sdkFiles = [
  "authority-types.ts",
  "auth-preferences.e1.ts",
  "authentication-service.ts",
  "authority-document.ts",
  "authority-history.ts",
  "authority-initialization.ts",
  "authority-location-invariants.ts",
  "authority-repository.ts",
  "authority.ts",
  "capability-names.ts",
  "credentials.ts",
  "devices.ts",
  "people.ts",
  "permissions.ts",
  "sha256.ts",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function sourceSnapshot() {
  const files = [];
  for (const name of sdkFiles) {
    const path = join(prototypeRoot, "src", name),
      bytes = await readFile(path);
    files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  const seedPath = resolve(prototypeRoot, "../seed/demo-data.json"),
    seedBytes = await readFile(seedPath);
  files.push({
    path: seedPath,
    bytes: seedBytes.length,
    sha256: hash(seedBytes),
  });
  return {
    files,
    fingerprint: hash(JSON.stringify(files)),
    seed: JSON.parse(seedBytes.toString()),
  };
}
async function compile(directory) {
  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "Bundler",
      lib: ["ES2022", "DOM"],
      strict: true,
      skipLibCheck: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      rootDir: join(prototypeRoot, "src"),
      outDir: join(directory, "sdk"),
    },
    files: sdkFiles.map((name) => join(prototypeRoot, "src", name)),
  };
  const configPath = join(directory, "tsconfig.json");
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  const command = [
    process.execPath,
    require.resolve("typescript/bin/tsc"),
    "-p",
    configPath,
  ];
  const result = await new Promise((accept, reject) => {
    const process = spawn(command[0], command.slice(1), {
      cwd: prototypeRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    process.stdout.on("data", (chunk) => (output += chunk));
    process.stderr.on("data", (chunk) => (output += chunk));
    process.once("error", reject);
    process.once("close", (code, signal) =>
      accept({ command, actualExitCode: code, signal, output }),
    );
  });
  await writeFile(
    join(directory, "compile-result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  assert.equal(
    result.actualExitCode,
    0,
    `Actual SDK browser compilation failed: ${JSON.stringify(result)}`,
  );
  return result;
}
/** Test-only server. It never changes the app, publishes a Vite test route, or
 * caches/exposes actual authority/business storage. Only current compiled SDK
 * modules and the configured fictional seed are served on ephemeral loopback.
 */
export async function createAuthorityNativeServer() {
  assert.equal(
    Number(process.versions.node.split(".")[0]),
    22,
    "Use the repository-pinned Node22 toolchain",
  );
  const directory = await mkdtemp(join(tmpdir(), "supermarket-e1-native-"));
  let server;
  try {
    const before = await sourceSnapshot(),
      compiled = await compile(directory);
    const assets = new Map(),
      compiledFiles = [];
    for (const file of await readdir(join(directory, "sdk"))) {
      if (!file.endsWith(".js")) continue;
      assert.ok(
        sdkFiles.includes(file.replace(/\.js$/, ".ts")),
        `Unexpected compiled public test module: ${file}`,
      );
      const path = join(directory, "sdk", file),
        raw = await readFile(path, "utf8");
      // Browsers require explicit extensions; only test compiler output is adapted.
      const adapted = raw.replace(
        /(from\s+["']|import\(["'])(\.\.?\/[^"']+)(["'])/g,
        (whole, prefix, target, quote) =>
          /\.[a-z]+$/i.test(target) ? whole : `${prefix}${target}.js${quote}`,
      );
      await writeFile(path, adapted);
      const bytes = Buffer.from(adapted);
      assets.set(`/sdk/${file}`, {
        bytes,
        type: "text/javascript; charset=utf-8",
      });
      compiledFiles.push({ file, sha256: hash(bytes), bytes: bytes.length });
    }
    const seed = Buffer.from(
      JSON.stringify({
        demo_users: before.seed.demo_users,
        registered_computers: before.seed.registered_computers,
      }),
    );
    assert.ok(
      Array.isArray(before.seed.demo_users) &&
        Array.isArray(before.seed.registered_computers),
      "Use the actual integrated configured demo directory",
    );
    assets.set("/demo-users.json", {
      bytes: seed,
      type: "application/json; charset=utf-8",
    });
    assets.set("/", {
      bytes: Buffer.from(
        '<!doctype html><html><head><meta charset="utf-8"><title>Native authority test fixture</title></head><body>Native IndexedDB authority fixture</body></html>',
      ),
      type: "text/html; charset=utf-8",
    });
    server = createServer((request, response) => {
      const entry = assets.get(
        new URL(request.url, "http://127.0.0.1").pathname,
      );
      if (!entry || !["GET", "HEAD"].includes(request.method)) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": entry.type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : entry.bytes);
    });
    await new Promise((accept, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", accept);
    });
    const url = `http://127.0.0.1:${server.address().port}/`;
    const source = { files: before.files, fingerprint: before.fingerprint };
    return {
      url,
      directory,
      source,
      compiled: {
        command: compiled.command,
        actualExitCode: compiled.actualExitCode,
        files: compiledFiles,
      },
      async assertSourceUnchanged() {
        assert.equal(
          (await sourceSnapshot()).fingerprint,
          before.fingerprint,
          "Actual SDK/seed changed during native proof",
        );
      },
      async close() {
        await new Promise((accept, reject) =>
          server.close((error) => (error ? reject(error) : accept())),
        );
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (server?.listening) await new Promise((accept) => server.close(accept));
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
