/* global console, process */
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Installed location: prototype/scripts/build-c9-gallery.mjs.
// Usage: node prototype/scripts/build-c9-gallery.mjs --manifest <manifest.json>
//        [--out <index.html>] [--repo-root <repository>]
// This reads local originals and metadata only; it never opens a browser or edits images.
const installedRepository = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const expectedCaptures = 40;
const expectedScenes = 10;
const requiredVariants = ["en-light", "en-dark", "fa-light", "phone390"];
const referenceNames = ["Prices", "Notes", "Lists"];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
const displayJSON = (value) => JSON.stringify(value, null, 2);
const inlineJSON = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const sceneKey = (scene) =>
  String(scene ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const variantKey = (variant) =>
  typeof variant === "string"
    ? variant
    : String(
        variant?.id ?? variant?.key ?? variant?.name ?? variant?.variant ?? "",
      );
const relativeHref = (file, output) =>
  relative(dirname(output), file).split(sep).map(encodeURIComponent).join("/");

export function referenceForScene(scene) {
  const key = sceneKey(scene);
  if (/^notes?/.test(key)) return "Notes";
  if (/^(products?|lookup|labels?)/.test(key)) return "Prices";
  if (/^approvals?/.test(key)) return "Lists";
  if (
    /^(priceupdates?|dates?|datetracking|expiry|requests?|branchrequests?|newrequest|newbranchrequest)/.test(
      key,
    )
  )
    return "Lists";
  return null;
}

function imagePath(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return value.path ?? value.filename ?? value.file ?? null;
}

async function inspectAsset(
  value,
  { manifestPath, outputPath, repositoryRoot },
) {
  const recordedPath = imagePath(value);
  const recordedSHA = typeof value === "object" ? value?.sha256 : null;
  const observation = {
    recorded_path: recordedPath,
    recorded_sha256: recordedSHA ?? null,
    href: null,
    observed_sha256: null,
    bytes: null,
    native_width: null,
    native_height: null,
    issue: null,
  };
  if (typeof recordedPath !== "string" || !recordedPath.trim()) {
    observation.issue = "No local PNG path was recorded.";
    return observation;
  }
  if (/^https?:/i.test(recordedPath)) {
    observation.issue =
      "A remote URL was recorded; this builder reads local originals only.";
    return observation;
  }
  const candidates = recordedPath.startsWith("file:")
    ? [fileURLToPath(recordedPath)]
    : isAbsolute(recordedPath)
      ? [recordedPath]
      : [
          ...new Set([
            resolve(dirname(manifestPath), recordedPath),
            resolve(repositoryRoot, recordedPath),
          ]),
        ];
  let bytes;
  let actualPath;
  for (const candidate of candidates) {
    try {
      bytes = await readFile(candidate);
      actualPath = candidate;
      break;
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error.code)) {
        observation.issue = `Cannot read original PNG: ${error.code ?? error.message}`;
        return observation;
      }
    }
  }
  if (!bytes) {
    observation.issue =
      "The recorded local PNG was not found relative to the manifest or repository.";
    return observation;
  }
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(pngSignature)) {
    observation.issue =
      "The recorded original is not a readable PNG byte stream.";
    return observation;
  }
  observation.href = relativeHref(actualPath, outputPath);
  observation.observed_sha256 = createHash("sha256")
    .update(bytes)
    .digest("hex");
  observation.bytes = bytes.length;
  observation.native_width = bytes.readUInt32BE(16);
  observation.native_height = bytes.readUInt32BE(20);
  if (recordedSHA && recordedSHA !== observation.observed_sha256)
    observation.issue = "The original PNG SHA256 differs from the manifest.";
  return observation;
}

export async function prepareGallery(manifest, locations) {
  if (!manifest || !Array.isArray(manifest.captures))
    throw new Error("Manifest captures must be an array.");
  const problems = [];
  const declaredVariants = Array.isArray(manifest.variants)
    ? manifest.variants.map(variantKey)
    : [];
  const variants = [...new Set(declaredVariants.filter(Boolean))];
  const declaredScenes = Array.isArray(manifest.scenes)
    ? manifest.scenes.map(String)
    : [];
  const scenes = [
    ...new Set([
      ...declaredScenes,
      ...manifest.captures.map((capture) => String(capture.scene ?? "")),
    ]),
  ];
  const references = Object.fromEntries(
    await Promise.all(
      referenceNames.map(async (name) => {
        const supplied = manifest.references?.[name];
        const asset = await inspectAsset(supplied, locations);
        if (asset.issue) problems.push(`${name} reference: ${asset.issue}`);
        return [name, { recorded: supplied ?? null, asset }];
      }),
    ),
  );
  const captures = await Promise.all(
    manifest.captures.map(async (capture, index) => {
      const scene = String(capture.scene ?? "");
      const variant = variantKey(capture.variant);
      if (!scene || !variant)
        problems.push(`Capture ${index + 1}: missing scene or variant.`);
      if (variant && !variants.includes(variant)) {
        variants.push(variant);
        problems.push(
          `Capture ${index + 1}: variant ${variant} was not declared.`,
        );
      }
      const asset = await inspectAsset(capture, locations);
      if (asset.issue) problems.push(`${scene}/${variant}: ${asset.issue}`);
      const reference = referenceNames.includes(capture.reference)
        ? capture.reference
        : referenceForScene(scene);
      if (!reference)
        problems.push(
          `${scene}/${variant}: no matching design reference is defined.`,
        );
      return { index, scene, variant, reference, asset, recorded: capture };
    }),
  );
  const failures = await Promise.all(
    (Array.isArray(manifest.failures) ? manifest.failures : []).map(
      async (failure) => ({
        recorded: failure,
        asset: failure.diagnostic_path
          ? await inspectAsset({ path: failure.diagnostic_path }, locations)
          : null,
      }),
    ),
  );
  for (const failure of failures)
    problems.push(
      `${failure.recorded.scene}/${failure.recorded.variant}: capture attempt failed: ${failure.recorded.error ?? "see recorded failure"}`,
    );
  const pairs = new Map();
  for (const capture of captures) {
    const key = JSON.stringify([capture.scene, capture.variant]);
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  for (const scene of scenes)
    for (const variant of variants) {
      const count = pairs.get(JSON.stringify([scene, variant])) ?? 0;
      if (count !== 1)
        problems.push(
          `${scene}/${variant}: ${count} capture records; expected exactly one.`,
        );
    }
  const expectedSelectedCaptures =
    expectedScenes * Math.max(variants.length, requiredVariants.length);
  if (captures.length !== expectedSelectedCaptures)
    problems.push(
      `${captures.length} capture records; expected ${expectedSelectedCaptures} for the declared variants across ${expectedScenes} scenes.`,
    );
  if (scenes.length !== expectedScenes)
    problems.push(`${scenes.length} scenes; expected ${expectedScenes}.`);
  for (const required of requiredVariants)
    if (!declaredVariants.includes(required))
      problems.push(`The required variant ${required} was not declared.`);
  if (new Set(declaredVariants).size !== declaredVariants.length)
    problems.push("Duplicate variant declarations were recorded.");
  if (new Set(declaredScenes).size !== declaredScenes.length)
    problems.push("Duplicate scene declarations were recorded.");
  if (manifest.source_unchanged === false)
    problems.push(
      "The capture manifest records that source files changed during capture.",
    );
  return {
    generated_at: manifest.generated_at ?? null,
    base_url: manifest.base_url ?? null,
    source: manifest.source ?? null,
    final_source: manifest.final_source ?? null,
    source_unchanged: manifest.source_unchanged ?? null,
    diagnostic_subset: manifest.diagnostic_subset ?? null,
    complete_required_set: manifest.complete_required_set ?? null,
    variant_definitions: manifest.variants ?? null,
    expected_selected_captures: expectedSelectedCaptures,
    manifest_href: relativeHref(locations.manifestPath, locations.outputPath),
    captures,
    failures,
    scenes,
    scene_references: Object.fromEntries(
      scenes.map((scene) => [scene, referenceForScene(scene)]),
    ),
    variants,
    references,
    problems,
  };
}

export function renderGallery(model) {
  const rows = model.scenes
    .map(
      (scene) =>
        `<tr><th scope="row">${escapeHTML(scene)}<small>${escapeHTML(referenceForScene(scene) ?? "No matching")} reference</small></th>${model.variants
          .map((variant) => {
            const matches = model.captures.filter(
              (capture) =>
                capture.scene === scene && capture.variant === variant,
            );
            if (!matches.length) {
              const failures = (model.failures ?? []).filter(
                (failure) =>
                  failure.recorded.scene === scene &&
                  failure.recorded.variant === variant,
              );
              return `<td><span class="finding">Missing capture</span><small>Review required</small>${failures.map((failure) => `<details><summary>Recorded failed attempt</summary><pre>${escapeHTML(displayJSON(failure.recorded))}</pre>${failure.asset?.href ? `<a href="${escapeHTML(failure.asset.href)}" target="_blank" rel="noopener">Failed-attempt diagnostic PNG</a>` : ""}</details>`).join("")}</td>`;
            }
            return `<td>${matches.map((capture) => `<button type="button" data-capture="${capture.index}">${escapeHTML(variant)}</button>${capture.asset.href ? `<a href="${escapeHTML(capture.asset.href)}" target="_blank" rel="noopener">Original PNG</a>` : '<span class="finding">PNG unavailable</span>'}<small>Review required</small>`).join("<hr>")}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("\n");
  const warnings = model.problems.length
    ? `<details class="finding" open><summary>${model.problems.length} manifest or original-file findings</summary><ul>${model.problems.map((problem) => `<li>${escapeHTML(problem)}</li>`).join("")}</ul></details>`
    : '<p class="metadata">The expected record grid and local PNG bytes are available. Individual visual review is still required.</p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>C9 original screenshot comparison — Review required</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#172033;font:14px/1.5 system-ui,sans-serif}header,main{max-width:1800px;margin:auto;padding:24px}h1{margin:0 0 12px}h2{font-size:18px;margin:0 0 8px}h3{font-size:15px}p{margin:8px 0}a{color:#2452bd}button,select{font:inherit;color:inherit;background:white;border:1px solid #dce0e8;border-radius:8px;padding:8px 12px;cursor:pointer}button:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #3563d9;outline-offset:3px}.review{display:inline-block;background:#fff1cc;color:#704600;padding:4px 10px;border-radius:999px;font-weight:600}.finding{color:#9c2638;background:#fff0f0;padding:12px;border-radius:8px}.metadata{color:#536078}.controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-block:16px}label{display:grid;gap:4px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{min-width:0;background:white;border-radius:16px;padding:16px}.frame{height:68vh;overflow:auto;background:#e7eaf0;border:1px solid #dce0e8}.frame img{display:block;max-width:100%;height:auto;margin:auto}.actual-size .frame img{max-width:none}.panel small{display:block;margin-block:8px;overflow-wrap:anywhere}details{margin-block:16px}summary{cursor:pointer;font-weight:600}pre{background:#edf0f5;border-radius:8px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere}.index-wrap{overflow:auto;margin-block:16px}table{width:100%;border-collapse:collapse;background:white}caption{text-align:start;font-weight:600;margin-block:8px}th,td{border:1px solid #dce0e8;text-align:start;vertical-align:top;padding:12px}th{background:#eef1f6}td a,td small,th small{display:block;margin-block-start:6px}th small,td small{font-size:12px;color:#536078}code{overflow-wrap:anywhere}.facts{display:grid;grid-template-columns:minmax(150px,auto) minmax(0,1fr);gap:4px 12px}.facts dt{font-weight:600}.facts dd{margin:0;overflow-wrap:anywhere}[hidden]{display:none!important}@media(max-width:760px){header,main{padding:16px}.panels{grid-template-columns:1fr}.frame{height:60vh}.facts{grid-template-columns:1fr}}
</style></head><body>
<header><h1>C9 screenshot comparison</h1><span class="review">Review required</span>
<p>${model.captures.length}/${model.expected_selected_captures ?? expectedCaptures} capture records · ${model.scenes.length} scenes × ${model.variants.length} variants · ${expectedCaptures} images in the four required variants; declared supplemental variants are additional.</p>
<p class="metadata">Captured: ${escapeHTML(model.generated_at ?? "Not recorded")} · Base URL recorded as <code>${escapeHTML(model.base_url ?? "Not recorded")}</code></p>
<p>Compare each original browser PNG with its supplied design reference. Fit changes display size only; Actual size displays native pixels. Different sample records, language, theme and phone framing need individual review. Screenshot records and file hashes do not establish a visual pass or owner approval.</p>
${warnings}
<details><summary>Recorded source identity and capture scope</summary><pre>${escapeHTML(displayJSON({ source: model.source, final_source: model.final_source ?? null, source_unchanged: model.source_unchanged ?? null, diagnostic_subset: model.diagnostic_subset ?? null, complete_required_set: model.complete_required_set ?? null, variants: model.variant_definitions ?? model.variants }))}</pre></details>
<p><a href="${escapeHTML(model.manifest_href)}">Open the original capture manifest</a></p>
<div class="controls"><label>Scene<select id="scene"></select></label><label>Variant<select id="variant"></select></label><button id="previous" type="button">Previous capture</button><button id="next" type="button">Next capture</button><button id="size" type="button" aria-pressed="false">Actual size</button></div>
</header>
<main><section id="comparison" aria-label="Screenshot and matching design reference"><div class="panels" id="panels">
<article class="panel"><h2 id="candidate-heading">Original browser capture</h2><span class="review">Review required</span><p id="candidate-caption"></p><div class="frame"><img id="candidate" alt="" hidden></div><p id="candidate-issue" class="finding" hidden></p><small id="candidate-meta"></small><a id="candidate-original" target="_blank" rel="noopener" hidden>Open original PNG</a></article>
<article class="panel"><h2 id="reference-heading">Matching reference</h2><p id="reference-caption"></p><div class="frame"><img id="reference" alt="" hidden></div><p id="reference-issue" class="finding" hidden></p><small id="reference-meta"></small><a id="reference-original" target="_blank" rel="noopener" hidden>Open original reference PNG</a></article></div>
<h3>Differences and framing</h3><p id="differences">Review required. Record actual differences after opening the original PNG and matching reference.</p>
<h3>Actual recorded browser evidence</h3><dl class="facts"><dt>Page errors</dt><dd><pre id="page-errors"></pre></dd><dt>Console errors</dt><dd><pre id="console-errors"></pre></dd><dt>Overflow</dt><dd><pre id="overflow"></pre></dd><dt>Recorded route</dt><dd><code id="capture-url"></code></dd></dl>
<details><summary>Exact selected capture and original-file observations</summary><pre id="capture-details"></pre></details>
</section>
<h2>All scenes and variants</h2><p>Every cell remains <strong>Review required</strong>. Select its variant to compare; Original PNG opens the unedited file.</p>
<div class="index-wrap"><table><caption>${model.scenes.length} scenes × ${model.variants.length} variants</caption><thead><tr><th scope="col">Scene</th>${model.variants.map((variant) => `<th scope="col">${escapeHTML(variant)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
<noscript><p>The comparison controls require JavaScript. Original PNG links in the index remain available.</p></noscript>
</main>
<script type="application/json" id="gallery-data">${inlineJSON(model)}</script>
<script>
"use strict";
const data=JSON.parse(document.getElementById("gallery-data").textContent);
const byId=(id)=>document.getElementById(id);
const scene=byId("scene"),variant=byId("variant");
for(const value of data.scenes)scene.add(new Option(value,value));
for(const value of data.variants)variant.add(new Option(value,value));
const describe=(record,key)=>Object.prototype.hasOwnProperty.call(record,key)?JSON.stringify(record[key],null,2):"Not recorded";
function showImage(prefix,asset,alt){
  const image=byId(prefix),original=byId(prefix+"-original"),issue=byId(prefix+"-issue");
  image.hidden=!asset?.href;original.hidden=!asset?.href;
  if(asset?.href){image.src=asset.href;image.alt=alt;original.href=asset.href}else{image.removeAttribute("src");original.removeAttribute("href")}
  issue.hidden=!asset?.issue;issue.textContent=asset?.issue??"";
  byId(prefix+"-meta").textContent=asset?.href?"Native PNG "+asset.native_width+" × "+asset.native_height+" · "+asset.bytes+" bytes · observed SHA256 "+asset.observed_sha256:"Original-file observations unavailable.";
}
let selectedIndex=0;
function choose(index,scroll=false){
  const capture=data.captures[index];if(!capture)return;
  selectedIndex=index;scene.value=capture.scene;variant.value=capture.variant;
  const reference=capture.reference?data.references[capture.reference]:null;
  byId("candidate-heading").textContent=capture.scene+" — "+capture.variant;
  byId("candidate-caption").textContent="Recorded size: "+(capture.recorded.width??"not recorded")+" × "+(capture.recorded.height??"not recorded")+". Visual review required.";
  showImage("candidate",capture.asset,capture.scene+" — "+capture.variant+" original browser screenshot");
  byId("reference-heading").textContent=capture.reference?capture.reference+".png reference":"No matching reference";
  const approvals=/^approvals?/.test(capture.scene.toLowerCase().replace(/[^a-z0-9]/g,""));
  byId("reference-caption").textContent=capture.recorded.reference_note??(approvals?"Lists.png contains the matching Approvals Rejected section at the bottom.":"Supplied design reference. Sample data and framing may differ from the live app.");
  showImage("reference",reference?.asset,capture.reference?capture.reference+" supplied design reference":"No supplied reference");
  byId("differences").textContent="Review required. Record actual differences after opening this original PNG and its matching reference.";
  byId("page-errors").textContent=describe(capture.recorded,"page_errors");
  byId("console-errors").textContent=describe(capture.recorded,"console_errors");
  byId("overflow").textContent=describe(capture.recorded,"overflow");
  byId("capture-url").textContent=capture.recorded.url??"Not recorded";
  byId("capture-details").textContent=JSON.stringify({capture:capture.recorded,original_file_observations:capture.asset,reference:reference??null,visual_review:"Review required"},null,2);
  for(const frame of document.querySelectorAll(".frame"))frame.scrollTo(0,0);
  for(const button of document.querySelectorAll("[data-capture]"))button.setAttribute("aria-pressed",String(Number(button.dataset.capture)===index));
  if(scroll)byId("comparison").scrollIntoView({block:"start"});
}
function selectPair(){const index=data.captures.findIndex((capture)=>capture.scene===scene.value&&capture.variant===variant.value);if(index>=0)choose(index);else{byId("candidate-heading").textContent=scene.value+" — "+variant.value;byId("candidate-caption").textContent="No capture record was supplied for this selection.";showImage("candidate",{issue:"This scene/variant capture is missing."},"");showImage("reference",{issue:"Select an available capture to compare its matching reference."},"");byId("reference-heading").textContent="Matching reference";byId("reference-caption").textContent="No selected capture record.";for(const id of ["page-errors","console-errors","overflow","capture-url"])byId(id).textContent="Not recorded";byId("capture-details").textContent="Review required: no capture record exists for this selection."}}
scene.addEventListener("change",selectPair);variant.addEventListener("change",selectPair);
byId("previous").addEventListener("click",()=>choose((selectedIndex-1+data.captures.length)%data.captures.length));
byId("next").addEventListener("click",()=>choose((selectedIndex+1)%data.captures.length));
byId("size").addEventListener("click",()=>{const active=byId("size").getAttribute("aria-pressed")!=="true";byId("size").setAttribute("aria-pressed",String(active));byId("size").textContent=active?"Fit to panels":"Actual size";byId("panels").classList.toggle("actual-size",active)});
for(const button of document.querySelectorAll("[data-capture]"))button.addEventListener("click",()=>choose(Number(button.dataset.capture),true));
if(data.captures.length)choose(0);else{byId("candidate-issue").hidden=false;byId("candidate-issue").textContent="No capture records were supplied. Review required."}
</script></body></html>\n`;
}

function argumentsFor(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (["--manifest", "--out", "--repo-root"].includes(argument)) {
      if (!argv[index + 1] || argv[index + 1].startsWith("--"))
        throw new Error(`Missing value for ${argument}.`);
      options[argument] = argv[++index];
    } else if (argument === "--help") options.help = true;
    else if (!argument.startsWith("--") && !options["--manifest"])
      options["--manifest"] = argument;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = argumentsFor(argv);
  if (options.help) {
    console.log(
      "Usage: node prototype/scripts/build-c9-gallery.mjs --manifest <manifest.json> [--out <index.html>] [--repo-root <repository>]",
    );
    return;
  }
  const repositoryRoot = resolve(options["--repo-root"] ?? installedRepository);
  const manifestPath = resolve(
    options["--manifest"] ??
      resolve(repositoryRoot, "docs/redesign-screenshots/pr-c9/manifest.json"),
  );
  const outputPath = resolve(
    options["--out"] ?? resolve(dirname(manifestPath), "index.html"),
  );
  if (
    outputPath === manifestPath ||
    !outputPath.toLowerCase().endsWith(".html")
  )
    throw new Error("Output must be a separate .html file.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const model = await prepareGallery(manifest, {
    manifestPath,
    outputPath,
    repositoryRoot,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderGallery(model));
  console.log(
    `Wrote ${outputPath}; ${model.captures.length} capture records; individual visual review required.`,
  );
  if (model.problems.length) {
    for (const problem of model.problems) console.error(problem);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
