#!/usr/bin/env python3
"""Strict C8 gallery: 15 scenes, five variants, five unchanged owner images.

C6/C7 retain their separate 85-image/19-reference generator and records.
This script verifies evidence; it neither captures nor modifies PNG bytes.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
from urllib.parse import quote

SCENES = [
    "edit-product-dates", "edit-product-missing-date", "labels-products",
    "new-order", "product-detail", "change-price-sale", "change-price-regular",
    "request-sale-dialog", "requested-sale-products", "requested-sale-lookup",
    "sale-request-approval", "sale-lookup", "sales-offers", "sale-cost-increase",
    "sale-promo-label",
]
VARIANTS = ["en-light", "en-dark", "fa-light", "mid-900", "phone-dark"]


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative_url(path, base):
    return "/".join(quote(p, safe="") for p in Path(os.path.relpath(path, base)).parts)


def review_signals():
    path = Path(__file__).with_name("generate-review-gallery.py")
    spec = importlib.util.spec_from_file_location("c6_c7_review_outcomes", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.review_failure_signals


def c8_review_signals(report, label, legacy):
    """Final records must explicitly pass, even when a diagnostic lists no failures."""
    issues = legacy(report, label)
    verdict = str(report.get("verdict", "")).strip().lower()
    if verdict not in {"pass", "passed"}:
        issues.append(label + ": missing or non-passing explicit verdict")
    if not isinstance(report.get("realFailures"), list):
        issues.append(label + ": explicit realFailures array is required")
    for key in ["realFailures", "visualFailures", "failures"]:
        if key in report and (not isinstance(report[key], list) or report[key]):
            issues.append(label + ": " + key + " must be an empty array")
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--screenshots", type=Path, required=True)
    parser.add_argument("--capture-manifest", type=Path, required=True)
    parser.add_argument("--reference-manifest", type=Path, required=True)
    parser.add_argument("--visual-review", type=Path, action="append", default=[])
    parser.add_argument("--differences-json", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--diagnostic", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-f0-9]{40}", args.source_commit):
        parser.error("Use the full frozen C8 source commit.")
    folder = args.screenshots.resolve()
    output = args.output.resolve()
    capture = load(args.capture_manifest)
    if capture.get("stage") != "c8" or capture.get("sourceCommit") != args.source_commit:
        raise ValueError("Capture source/stage does not match C8.")
    expected = {(scene, variant) for scene in SCENES for variant in VARIANTS}
    screens, slots, warnings = [], set(), []
    for item in capture.get("screens", []):
        slot = item.get("scene"), item.get("variant")
        if slot not in expected or slot in slots:
            raise ValueError("Unknown/duplicate C8 screenshot slot: " + str(slot))
        slots.add(slot)
        filename = slot[0] + "-" + slot[1] + ".png"
        if item.get("filename") != filename:
            raise ValueError("Screenshot name does not identify its C8 slot.")
        path = folder / filename
        if path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n" or digest(path) != item.get("sha256") or path.stat().st_size != item.get("bytes"):
            raise ValueError("Unchanged original PNG hash mismatch: " + filename)
        layout = item.get("layout", {})
        containment = layout.get("containment", {})
        if not isinstance(layout.get("words"), int) or layout["words"] <= 0:
            warnings.append(filename + ": no positive real-word measurement")
        if not isinstance(layout.get("failures"), list) or layout.get("failures"):
            warnings.append(filename + ": incomplete/failed geometry proof")
        if not isinstance(containment.get("rowCount"), int) or not isinstance(containment.get("failures"), list) or containment.get("failures"):
            warnings.append(filename + ": incomplete/failed row-card containment proof")
        if item.get("captureMode") not in {"page", "viewport"}:
            warnings.append(filename + ": incomplete C8 page/dialog framing")
        screens.append({**item, "sourceCommit": args.source_commit, "url": relative_url(path, output.parent)})
    if slots != expected or capture.get("expectedCount") != 75:
        warnings.append(str(len(slots)) + "/75 slots; final C8 requires every scene/variant")
    if capture.get("diagnostic") is not False or capture.get("selectedCount") != 75:
        warnings.append("Capture is diagnostic or does not explicitly cover all 75 slots")
    if capture.get("browserErrors"):
        warnings.append("Captured browser errors remain")
    source = capture.get("sourceIdentity", {})
    if source.get("sourceCommit") != args.source_commit or source.get("verified") is not True:
        warnings.append("Frozen source identity was not verified")
    if source.get("fingerprint") != source.get("afterFingerprint"):
        warnings.append("Frozen source changed during capture")
    builds = capture.get("productionBuilds", [])
    build_slots = {(b.get("scene"), b.get("variant"), b.get("phase")) for b in builds}
    if len(builds) != 2 * len(screens) or build_slots != {(s, v, p) for s, v in slots for p in ["before", "after"]}:
        warnings.append("Before/after production guards incomplete or duplicated")
    fingerprints = {b.get("fingerprint") for b in builds}
    html_hashes = {b.get("htmlSHA256") for b in builds}
    if len(fingerprints) != 1 or any(not isinstance(f, str) or not re.fullmatch(r"[a-f0-9]{64}", f) for f in fingerprints):
        warnings.append("Production fingerprint missing/inconsistent")
    if len(html_hashes) != 1 or any(not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value) for value in html_hashes):
        warnings.append("Production HTML changed during capture")
    for build in builds:
        assets = build.get("assets", [])
        if build.get("verifiedAgainstLocalDist") is not True or not isinstance(assets, list) or not assets or any(not isinstance(asset.get("path"), str) or not re.fullmatch(r"/assets/[^/]+\.(?:js|css)", asset["path"]) or not re.fullmatch(r"[a-f0-9]{64}", str(asset.get("sha256"))) for asset in assets):
            warnings.append("Incomplete actual local-dist production asset proof")
            break
    originals = load(args.reference_manifest).get("unchanged_uploaded_originals", [])
    if len(originals) != 5 or {r.get("file") for r in originals} != {str(i) + ".png" for i in range(1, 6)}:
        raise ValueError("Expected five distinct unchanged C8 owner annotations.")
    references = []
    for original in originals:
        path = args.reference_manifest.resolve().parent / original["file"]
        if digest(path) != original["sha256"] or path.stat().st_size != original["bytes"]:
            raise ValueError("Owner annotation hash/size mismatch: " + original["file"])
        references.append({**original, "url": relative_url(path, output.parent)})
    signals = review_signals()
    reviews, outcomes, review_reports = {}, [], []
    for path in args.visual_review:
        report = load(path)
        if report.get("sourceCommit") != args.source_commit or not isinstance(report.get("reviews"), list):
            raise ValueError("Wrong C8 review source/schema: " + str(path))
        outcomes += c8_review_signals(report, path.name, signals)
        if report.get("reviewPassed") is not True or report.get("strictGalleryEligible") is not True or report.get("diagnostic") is not False:
            outcomes.append(path.name + ": final review must explicitly pass and be eligible, not diagnostic")
        compared = report.get("referenceImages", [])
        if not isinstance(compared, list) or len(compared) != 5 or {r.get("file") for r in compared} != {r["file"] for r in originals}:
            outcomes.append(path.name + ": all five owner annotations need individual reference-open records")
        else:
            for record in compared:
                original = next(r for r in originals if r["file"] == record["file"])
                if record.get("openedIndividually") is not True or record.get("sha256") != original["sha256"]:
                    outcomes.append(path.name + ": owner annotation identity/open mismatch " + record["file"])
        review_reports.append({"filename": path.name, "sha256": digest(path), "sourceCommit": report["sourceCommit"], "verdict": report.get("verdict"), "referenceImages": compared})
        for review in report["reviews"]:
            filename = review.get("filename")
            screen = next((s for s in screens if s["filename"] == filename), None)
            if not screen or filename in reviews or review.get("sha256") != screen["sha256"] or review.get("sourceCommit", args.source_commit) != args.source_commit:
                raise ValueError("Review image identity/duplication mismatch: " + str(filename))
            outcomes += c8_review_signals(review, filename, signals)
            reviews[filename] = review
    opened = sum(r.get("openedIndividually") is True for r in reviews.values())
    if opened != len(screens):
        warnings.append("Individual original-PNG opens recorded for " + str(opened) + "/" + str(len(screens)))
    if outcomes:
        warnings.append("Strict current review outcomes failed: " + "; ".join(outcomes))
    if warnings and not args.diagnostic:
        raise ValueError("Final C8 gallery rejected: " + " | ".join(warnings))
    for screen in screens:
        screen["individualReview"] = reviews.get(screen["filename"])
    differences = load(args.differences_json) if args.differences_json else []
    if not isinstance(differences, list):
        raise ValueError("Differences must be explicit separate notes.")
    model = {"stage": "c8", "sourceCommit": args.source_commit, "diagnostic": args.diagnostic,
             "warnings": warnings, "screens": sorted(screens, key=lambda s: (SCENES.index(s["scene"]), VARIANTS.index(s["variant"]))),
             "references": references, "scenes": SCENES, "variants": VARIANTS, "reviewCount": opened,
             "reviewReports": review_reports,
             "expectedCount": 75, "buildFingerprint": next(iter(fingerprints)) if len(fingerprints) == 1 else None,
             "differences": differences, "captureManifestSHA256": digest(args.capture_manifest)}
    data = json.dumps(model, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    template = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C8 screenshot comparison</title>
<style>*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui;background:#f4f5f7;color:#141a2b}header,main{padding:20px}h1{margin:0 0 8px}.controls{display:flex;gap:12px;flex-wrap:wrap}label{display:grid;gap:4px}select,button{padding:10px;border:1px solid #e1e3e8;border-radius:10px;background:white;color:inherit;font:inherit}.panels{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{min-width:0;background:white;border-radius:16px;padding:16px}.viewport{height:72vh;overflow:auto;background:#e6e7eb}.viewport img{display:block;max-width:100%;height:auto;margin:auto}.actual img{max-width:none}.warning{padding:12px;background:#fdf3e2;color:#895000}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:760px){.panels{grid-template-columns:1fr}.viewport{height:65vh}}</style>
<header><h1 id="title"></h1><p id="identity"></p><p>Original, unedited PNGs. Fit changes display size only; Actual size preserves original pixels. Visual verification is separate from owner approval.</p><p class="warning" id="warning" hidden></p><div class="controls"><label>Scene<select id="scene"></select></label><label>Variant<select id="variant"></select></label><label>Owner annotation<select id="reference"></select></label><button id="previous">Previous</button><button id="next">Next</button><button id="size" aria-pressed="false">Actual size</button></div></header>
<main><div class="panels" id="panels"><section class="panel"><h2 id="candidate-name"></h2><div class="viewport"><img id="candidate" alt=""></div></section><section class="panel"><h2 id="reference-name"></h2><div class="viewport"><img id="original" alt=""></div></section></div><details open><summary>Differences and framing limits</summary><ul id="differences"></ul></details><details><summary>Exact source, hashes and individual review</summary><pre id="details"></pre></details></main>
<script type="application/json" id="proof-data">__DATA__</script><script>
'use strict';const data=JSON.parse(document.getElementById('proof-data').textContent),byId=id=>document.getElementById(id),scene=byId('scene'),variant=byId('variant'),reference=byId('reference');byId('title').textContent='C8 comparison'+(data.diagnostic?' — DIAGNOSTIC, NOT FINAL PROOF':'');byId('identity').textContent=data.screens.length+'/75 images; '+data.reviewCount+' original-image review records; source '+data.sourceCommit;if(data.warnings.length){byId('warning').hidden=false;byId('warning').textContent=data.warnings.join(' | ')}for(const s of data.scenes)scene.add(new Option(s,s));for(const v of data.variants)variant.add(new Option(v,v));data.references.forEach((r,i)=>reference.add(new Option(r.file,String(i))));for(const note of data.differences){const li=document.createElement('li');li.textContent=typeof note==='string'?note:JSON.stringify(note);byId('differences').append(li)}function update(){const s=data.screens.find(s=>s.scene===scene.value&&s.variant===variant.value),r=data.references[Number(reference.value)];byId('candidate-name').textContent=s?s.filename:'Missing diagnostic slot';byId('candidate').hidden=!s;if(s){byId('candidate').src=s.url;byId('candidate').alt=s.scene+' '+s.variant}byId('reference-name').textContent=r.file;byId('original').src=r.url;byId('original').alt='Unchanged owner annotation '+r.file;byId('details').textContent=JSON.stringify({source:data.sourceCommit,fingerprint:data.buildFingerprint,candidate:s,reference:r},null,2);for(const panel of document.querySelectorAll('.viewport'))panel.scrollTo(0,0)}function step(delta){let i=data.screens.findIndex(s=>s.scene===scene.value&&s.variant===variant.value);i=(i+delta+data.screens.length)%data.screens.length;scene.value=data.screens[i].scene;variant.value=data.screens[i].variant;update()}for(const select of [scene,variant,reference])select.addEventListener('change',update);byId('previous').onclick=()=>step(-1);byId('next').onclick=()=>step(1);byId('size').onclick=()=>{const active=byId('size').getAttribute('aria-pressed')!=='true';byId('size').setAttribute('aria-pressed',String(active));byId('size').textContent=active?'Fit':'Actual size';byId('panels').classList.toggle('actual',active)};if(data.screens.length){scene.value=data.screens[0].scene;variant.value=data.screens[0].variant}update();
</script></html>'''
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(template.replace("__DATA__", data) + "\n", encoding="utf-8")
    summary = {"stage": "c8", "sourceCommit": args.source_commit, "diagnostic": args.diagnostic,
               "screens": len(screens), "expectedCount": 75, "individuallyReviewed": opened,
               "references": 5, "warnings": warnings, "productionFingerprint": model["buildFingerprint"]}
    output.with_suffix(".manifest.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
