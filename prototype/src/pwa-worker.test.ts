import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { createServiceWorker } from "../pwa-build";
function workerFixture(options: { htmlInsteadOfScript?: boolean } = {}) {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const network: string[] = [];
  const messages: { id: string; message: { type: string; request: string } }[] =
    [];
  let activations = 0;
  const windows = ["a", "b"].map((id) => ({
    id,
    postMessage: (message: { type: string; request: string }) =>
      messages.push({ id, message }),
  }));
  const caches = {
    async keys() {
      return [...stores.keys()];
    },
    async open(name: string) {
      const entries = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, entries);
      return {
        put: async (url: string, response: Response) => {
          entries.set(url, response);
        },
        match: async (url: string) => entries.get(url),
      };
    },
    async match(url: string) {
      for (const store of stores.values())
        if (store.has(url)) return store.get(url);
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  runInNewContext(
    createServiceWorker(
      [
        "assets/main-Abc12345.js",
        "assets/pdf.worker-Abc12345.mjs",
        "offline.html",
      ],
      "proof-release",
    ),
    {
      URL,
      Request,
      Response,
      Set,
      Date,
      crypto: { randomUUID: () => "proof-update-request" },
      caches,
      fetch: async (request: Request | string) => {
        const url = typeof request === "string" ? request : request.url;
        network.push(url);
        return new Response(
          url.endsWith(".html") || options.htmlInsteadOfScript
            ? "<html>Access sign-in</html>"
            : "export {}",
          {
            status: 200,
            headers: {
              "content-type":
                url.endsWith(".html") || options.htmlInsteadOfScript
                  ? "text/html"
                  : "text/javascript",
            },
          },
        );
      },
      self: {
        location: {
          href: "https://private.example.test/demo/service-worker.js",
        },
        addEventListener: (
          type: string,
          listener: (event: Record<string, unknown>) => void,
        ) => listeners.set(type, listener),
        clients: {
          matchAll: async () => windows,
          claim: async () => undefined,
        },
        skipWaiting: async () => {
          activations++;
        },
      },
    },
  );
  async function lifetime(type: string, data: Record<string, unknown> = {}) {
    const promises: Promise<unknown>[] = [];
    listeners.get(type)!({
      ...data,
      waitUntil: (promise: Promise<unknown>) => promises.push(promise),
    });
    await Promise.all(promises);
  }
  function request(path: string, mode = "same-origin") {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: {
        url: new URL(path, "https://private.example.test/demo/").href,
        method: "GET",
        mode,
      },
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });
    return response;
  }
  return {
    lifetime,
    request,
    stores,
    network,
    messages,
    activations: () => activations,
  };
}
it("executes the real generated worker: valid JS/mjs cached, API/private/original/query traffic untouched", async () => {
  const worker = workerFixture();
  await worker.lifetime("install");
  expect(worker.network).toHaveLength(3);
  expect(worker.stores.values().next().value!.size).toBe(3);
  expect(
    await (await worker.request("assets/pdf.worker-Abc12345.mjs"))!.text(),
  ).toBe("export {}");
  expect(worker.network).toHaveLength(3);
  for (const path of [
    "api/v1/products",
    "uploads/photo.png",
    "originals/invoice.svg",
    "assets/rows.json",
    "assets/main-Abc12345.js?user=private",
    "https://foreign.test/assets/main-Abc12345.js",
  ])
    expect(worker.request(path)).toBeUndefined();
});
it("rejects an actual Access HTML response at a script URL and removes incomplete cache", async () => {
  const worker = workerFixture({ htmlInsteadOfScript: true });
  await expect(worker.lifetime("install")).rejects.toThrow(
    "public_asset_unavailable",
  );
  expect(worker.stores.size).toBe(0);
  expect(worker.activations()).toBe(0);
});
it("requires fresh affirmative votes from all live tabs; dirty work cancels approval", async () => {
  const worker = workerFixture();
  await worker.lifetime("message", { data: { type: "CHECK_UPDATE" } });
  expect(worker.messages).toHaveLength(2);
  const request = worker.messages[0].message.request;
  await worker.lifetime("message", {
    source: { id: "a" },
    data: { type: "UPDATE_VOTE", request, safe: true },
  });
  expect(worker.activations()).toBe(0);
  await worker.lifetime("message", { data: { type: "APP_BUSY" } });
  await worker.lifetime("message", {
    source: { id: "b" },
    data: { type: "UPDATE_VOTE", request, safe: true },
  });
  expect(worker.activations()).toBe(0);
  await worker.lifetime("message", { data: { type: "CHECK_UPDATE" } });
  await worker.lifetime("message", {
    source: { id: "a" },
    data: { type: "UPDATE_VOTE", request, safe: true },
  });
  await worker.lifetime("message", {
    source: { id: "b" },
    data: { type: "UPDATE_VOTE", request, safe: true },
  });
  expect(worker.activations()).toBe(1);
});

it("keeps an older cached public hashed module available without caching arbitrary old URLs", async () => {
  const worker = workerFixture();
  await worker.lifetime("install");
  const old = new Map<string, Response>();
  old.set(
    "https://private.example.test/demo/assets/older-Previous123.js",
    new Response("export const earlier = true", {
      headers: { "content-type": "text/javascript" },
    }),
  );
  worker.stores.set("supermarket-public-earlier", old);
  const before = worker.network.length;
  const response = await worker.request("assets/older-Previous123.js");
  expect(await response!.text()).toBe("export const earlier = true");
  expect(worker.network).toHaveLength(before);
});
