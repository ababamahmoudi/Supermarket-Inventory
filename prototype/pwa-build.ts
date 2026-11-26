import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { configuredMaker, type MakerConfig } from "./src/maker-branding.ts";
import companyConfiguration from "../seed/arzon-config.json" with { type: "json" };

/** Only fingerprinted compiled code/styles/fonts and explicit public icons. */
export function publicStaticAsset(path: string): boolean {
  return (
    /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{6,}\.(?:m?js|css|woff2?)$/.test(
      path,
    ) &&
    !/(?:^|\/)(?:api|uploads?|originals?|documents?|private)(?:[/_.-]|$)/i.test(
      path,
    )
  );
}
export function createWebManifest(
  configuration: MakerConfig & {
    company: { name: string };
  } = companyConfiguration,
) {
  const maker = configuredMaker(configuration);
  return {
    id: "./",
    name: configuration.company.name,
    short_name: configuration.company.name,
    lang: "en",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#F4F5F7",
    theme_color: "#FFFFFF",
    icons: [192, 512].map((size) => ({
      src:
        (size === 192 ? maker?.icon_192_file : maker?.icon_512_file) ??
        `icons/company-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable",
    })),
  };
}
/** Bootstrap icons use the same public maker choice as the running app. */
export function configureBrandHead(
  html: string,
  configuration: MakerConfig = companyConfiguration,
): string {
  const maker = configuredMaker(configuration);
  const favicon = maker?.favicon_file ?? "icons/company-192.png";
  const touch = maker?.icon_192_file ?? "icons/company-192.png";
  return html
    .replace(
      /(<link\s+rel="icon"[^>]*type=")[^"]+/,
      `$1${favicon.endsWith(".svg") ? "image/svg+xml" : "image/png"}`,
    )
    .replace(/(<link\s+rel="icon"[^>]*href=")[^"]+/, `$1./${favicon}`)
    .replace(
      /(<link\s+rel="apple-touch-icon"[^>]*href=")[^"]+/,
      `$1./${touch}`,
    );
}
export function createOfflinePage(): string {
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme:light)"><meta name="theme-color" content="#181C25" media="(prefers-color-scheme:dark)"><title>No connection</title><link rel="stylesheet" href="offline.css"><script>(()=>{let theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';try{const saved=JSON.parse(localStorage.getItem('supermarket-prototype-preferences-v3')||'null');if(saved?.version===3&&['light','dark'].includes(saved.device_preferences?.theme))theme=saved.device_preferences.theme;}catch{}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();</script></head><body><main><img src="icons/company-192.png" alt=""><h1 id="heading">No connection</h1><p id="detail">Reconnect, then try again.</p><button id="retry">Try again</button><button class="language" id="language" aria-label="Language">EN | فا</button></main><script>let fa=false;document.getElementById('retry').onclick=()=>location.reload();document.getElementById('language').onclick=()=>{fa=!fa;document.documentElement.lang=fa?'fa':'en';document.documentElement.dir=fa?'rtl':'ltr';document.getElementById('heading').textContent=fa?'اتصال برقرار نیست':'No connection';document.getElementById('detail').textContent=fa?'دوباره متصل شوید و تلاش کنید.':'Reconnect, then try again.';document.getElementById('retry').textContent=fa?'تلاش دوباره':'Try again';};</script></body></html>`;
}
export function createServiceWorker(assets: string[], version: string): string {
  return `/* Public app files only. Never cache navigations, identity or business responses. */
const CACHE = ${JSON.stringify(`supermarket-public-${version}`)};
const PATHS = ${JSON.stringify(assets)};
const base = new URL('./', self.location.href);
const permitted = new Set(PATHS.map(path => new URL(path, base).href));
const offline = new URL('offline.html', base).href;
const mime = path => path.endsWith('.html') ? /^text\\/html(?:;|$)/i : path.endsWith('.css') ? /^text\\/css(?:;|$)/i : /\\.m?js$/.test(path) ? /^(?:text|application)\\/(?:javascript|ecmascript)(?:;|$)/i : /\\.woff2?$/.test(path) ? /^(?:font\\/|application\\/(?:font|x-font))/i : /^image\\/png(?:;|$)/i;
const valid = (url, response) => response.ok && !response.redirected && response.type !== 'opaque' && mime(new URL(url).pathname).test(response.headers.get('content-type') || '');
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  for (const path of PATHS) {
    const url = new URL(path, base).href;
    const response = await fetch(new Request(url, {cache:'reload', credentials:'same-origin'}));
    if (!valid(url, response)) { await caches.delete(CACHE); throw new Error('public_asset_unavailable'); }
    await cache.put(url, response);
  }
})()));
// No unconditional skipWaiting: an update waits for every live tab's work check.
let proposal = null;
self.addEventListener('message', event => event.waitUntil((async () => {
  if (event.data?.type === 'APP_BUSY') { proposal = null; return; }
  if (event.data?.type === 'CHECK_UPDATE') {
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    if (!clients.length) return;
    const request = crypto.randomUUID();
    proposal = {request, ids:new Set(clients.map(client => client.id)), yes:new Set(), at:Date.now()};
    for (const client of clients) client.postMessage({type:'CAN_UPDATE', request});
    return;
  }
  if (event.data?.type !== 'UPDATE_VOTE' || !proposal || proposal.request !== event.data.request || !event.source || !proposal.ids.has(event.source.id)) return;
  if (!event.data.safe || Date.now()-proposal.at > 5000) {proposal=null;return;}
  proposal.yes.add(event.source.id);
  if (proposal.yes.size !== proposal.ids.size) return;
  const accepted = proposal;
  const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
  if (proposal !== accepted || !clients.every(client => accepted.yes.has(client.id))) return;
  proposal = null;
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin || url.search || !url.pathname.startsWith(base.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match(offline)));
    return;
  }
  const relative = url.pathname.slice(base.pathname.length);
  const oldPublic = (${publicStaticAsset.toString()})(relative);
  if ((!permitted.has(url.href) && !oldPublic) || url.href === offline) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Older public bundles stay usable for tabs with unsaved work after activation.
    for (const name of await caches.keys()) {
      if (!name.startsWith('supermarket-public-')) continue;
      const cached = await (await caches.open(name)).match(url.href);
      if (cached && valid(url.href, cached)) return cached;
    }
    const response = await fetch(request);
    if (permitted.has(url.href) && valid(url.href, response)) await cache.put(url.href, response.clone());
    return response;
  })());
});`;
}
export function phonePwa(): Plugin {
  return {
    name: "configured-private-safe-phone-app",
    apply: "build",
    transformIndexHtml(html) {
      return configureBrandHead(html);
    },
    generateBundle(_options, bundle) {
      const manifest = JSON.stringify(createWebManifest(), null, 2);
      const assets = Object.keys(bundle).filter(publicStaticAsset).sort();
      const fontFaces = assets
        .flatMap((path) => {
          const match =
            /(?:^|\/)(manrope-latin|vazirmatn-arabic)-(400|500|600|700|800)-normal-[A-Za-z0-9_-]+\.woff2$/.exec(
              path,
            );
          return match
            ? [
                `@font-face{font-family:${match[1] === "manrope-latin" ? "Manrope" : "Vazirmatn"};font-style:normal;font-weight:${match[2]};font-display:swap;src:url("${path}") format("woff2")}`,
              ]
            : [];
        })
        .join("\n");
      const tokens = readFileSync(
        fileURLToPath(new URL("./src/klead-tokens.css", import.meta.url)),
        "utf8",
      );
      const offlineCss = `${tokens}\n${fontFaces}\n:root{color-scheme:light dark;font-family:var(--font-en);background:var(--page);color:var(--text)}html[lang=fa]{font-family:var(--font-fa)}body{min-height:100dvh;margin:0;display:grid;place-items:center;padding:0 16px;box-sizing:border-box}main{max-width:28rem;text-align:center;background:var(--surface);border-radius:var(--radius-card);padding:32px;box-shadow:var(--shadow-card)}img{width:88px;height:88px;background:var(--klead-white);border-radius:var(--radius-control)}button{font:inherit;min-height:44px;border:0;border-radius:var(--radius-control);padding:0 20px;background:var(--accent-fill);color:var(--primary-text);cursor:pointer}button:focus-visible{box-shadow:var(--shadow-focus)}.language{display:block;margin:24px auto 0;background:var(--color-clear);color:var(--accent-tint-text)}`;
      const offline = createOfflinePage();
      const icons = [
        ...new Set([
          ...createWebManifest().icons.map((icon) => icon.src),
          "icons/company-192.png",
          "icons/company-512.png",
        ]),
      ];
      const files = [...assets, ...icons, "offline.css", "offline.html"];
      const release = createHash("sha256");
      for (const name of assets) {
        const entry = bundle[name];
        release.update(entry.type === "chunk" ? entry.code : entry.source);
      }
      release.update(manifest).update(offline).update(offlineCss);
      // A worker-policy-only release must not share or delete the active cache.
      release.update(createServiceWorker([], "cache-policy"));
      for (const icon of icons) {
        const source = readFileSync(
          fileURLToPath(new URL(`./public/${icon}`, import.meta.url)),
        );
        release.update(source);
      }
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: manifest,
      });
      this.emitFile({
        type: "asset",
        fileName: "offline.html",
        source: offline,
      });
      this.emitFile({
        type: "asset",
        fileName: "offline.css",
        source: offlineCss,
      });
      this.emitFile({
        type: "asset",
        fileName: "service-worker.js",
        source: createServiceWorker(files, release.digest("hex").slice(0, 16)),
      });
    },
  };
}
