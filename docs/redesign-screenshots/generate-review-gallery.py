#!/usr/bin/env python3
"""Generate an offline proof gallery without modifying any screenshot bytes.
Default is a strict 85-image/hash/asset check; --diagnostic explicitly permits
partial or failed captures and labels the page as unsuitable for final proof.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import quote

SCENES = ['topbar','lookup-clearance-dates','date-tracking','edit-product-dates','invoices-list','manual-invoice-missing','products','received-range','returns-list','pickup-shortfall','partial-resolution','return-memo','payables-ledger','supplier-cards','dashboard','approvals','settings']
VARIANTS = ['en-light','en-dark','fa-light','mid-900','phone-dark']
VARIANT_LABELS = {'en-light':'English light','en-dark':'English dark','fa-light':'Persian','mid-900':'900 px','phone-dark':'Phone dark'}
SCENE_LABELS = {'topbar':'Top bar','lookup-clearance-dates':'Lookup: clearance and read-only dates','date-tracking':'Date tracking','edit-product-dates':'Edit product: dates','invoices-list':'Invoices list','manual-invoice-missing':"Manual invoice: what's missing",'products':'Products','received-range':'Received: date range','returns-list':'Returns list','pickup-shortfall':'Record pickup: shortfall','partial-resolution':'Partial resolution','return-memo':'Return memo','payables-ledger':'Payables ledger','supplier-cards':'Supplier summary cards','dashboard':'Dashboard','approvals':'Approvals','settings':'Settings'}

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
def url(path: Path, base: Path) -> str:
    return '/'.join(quote(part, safe='') for part in Path(os.path.relpath(path, base)).parts)
def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--stage',choices=['c6','c7'],required=True)
    p.add_argument('--source-commit',required=True)
    p.add_argument('--screenshots',type=Path,required=True)
    p.add_argument('--capture-manifest',type=Path,action='append',required=True)
    p.add_argument('--reference-manifest',type=Path,required=True)
    p.add_argument('--docs-root',type=Path,required=True)
    p.add_argument('--visual-review',type=Path,action='append',default=[])
    p.add_argument('--differences-json',type=Path)
    p.add_argument('--readme',type=Path)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--diagnostic',action='store_true')
    a=p.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}',a.source_commit):p.error('Use full source commit SHA')
    output=a.output.resolve();base=output.parent;folder=a.screenshots.resolve();docs=a.docs_root.resolve()
    warnings=[];screens=[];builds=[];slots=set();errors=[]
    for manifest in a.capture_manifest:
        d=load(manifest)
        if d.get('sourceCommit')!=a.source_commit or d.get('stage')!=a.stage:raise ValueError(f'Wrong capture source/stage: {manifest}')
        errors+=d.get('browserErrors',[]);builds+=d.get('productionBuilds',[])
        for item in d.get('screens',[]):
            slot=(item.get('scene'),item.get('variant'))
            if slot in slots or slot[0] not in SCENES or slot[1] not in VARIANTS:raise ValueError(f'Unknown/duplicate scene: {slot}')
            slots.add(slot)
            name=item.get('filename');expected=f'{slot[0]}-{slot[1]}.png'
            if name!=expected:raise ValueError(f'Unexpected filename: {name}')
            path=folder/name;sha=digest(path)
            if sha!=item.get('sha256'):raise ValueError(f'Image hash mismatch: {path}')
            item=dict(item);item['sourceCommit']=a.source_commit;item['url']=url(path,base)
            screens.append(item)
    expected={(s,v) for s in SCENES for v in VARIANTS}
    if slots!=expected:warnings.append(f'{len(slots)}/85 expected screenshot slots present; missing {len(expected-slots)}.')
    failures=[{'filename':s['filename'],'failures':s.get('layout',{}).get('failures',[])} for s in screens if s.get('layout',{}).get('failures')]
    incomplete_geometry=[s['filename'] for s in screens
                         if not isinstance(s.get('layout'),dict)
                         or 'failures' not in s['layout']
                         or not isinstance(s['layout'].get('words'),int)
                         or s['layout']['words'] <= 0]
    if errors:warnings.append(f'{len(errors)} captured browser errors.')
    if failures:warnings.append(f'{len(failures)} screenshots have recorded layout failures.')
    if incomplete_geometry:warnings.append(f'{len(incomplete_geometry)} screenshots lack positive word measurement or complete layout results.')
    fingerprints={b.get('fingerprint') for b in builds}
    if any(not isinstance(f,str) or not re.fullmatch(r'[a-f0-9]{64}',f) for f in fingerprints) or len(fingerprints)!=1:warnings.append('Production asset fingerprints missing or inconsistent.')
    buildslots={(b.get('scene'),b.get('variant'),b.get('phase')) for b in builds}
    if len(builds)!=2*len(screens) or buildslots!={(s,v,phase) for s,v in slots for phase in ['before','after']}:warnings.append('Before/after production asset guards incomplete or duplicated.')
    references=load(a.reference_manifest).get('files',[])
    if len(references)!=19 or len({r.get('path') for r in references})!=19:raise ValueError('Expected 19 distinct unchanged owner-reference files')
    if sum('/klead-v1/' in r['path'] for r in references)!=5 or sum('/c6-owner-bugs/' in r['path'] for r in references)!=14:raise ValueError('Expected five Klead retouches and 14 owner bug notes')
    refs=[]
    for r in references:
        path=docs/r['path'];sha=digest(path)
        if sha!=r.get('sha256') or path.stat().st_size!=r.get('bytes'):raise ValueError(f'Reference hash/size mismatch: {path}')
        refs.append({**r,'url':url(path,base),'kind':'Klead retouch' if '/klead-v1/' in r['path'] else 'Owner bug note'})
    reviews={}
    for path in a.visual_review:
        d=load(path)
        if d.get('sourceCommit')!=a.source_commit:raise ValueError(f'Wrong individual-review source: {path}')
        for r in d.get('reviews',[]):
            filename=r.get('filename');s=next((s for s in screens if s['filename']==filename),None)
            if r.get('sourceCommit',a.source_commit)!=a.source_commit:raise ValueError(f'Review entry source mismatch: {filename}')
            if not s or r.get('sha256')!=s['sha256']:raise ValueError(f'Review image identity mismatch: {filename}')
            if filename in reviews:raise ValueError(f'Duplicate review: {filename}')
            reviews[filename]=r
    for s in screens:s['individualReview']=reviews.get(s['filename'])
    review_count=sum(bool(s['individualReview'] and s['individualReview'].get('openedIndividually')) for s in screens)
    if review_count!=len(screens):warnings.append(f'Individual review records supplied for {review_count}/{len(screens)} images; capture/hash verification is not visual approval.')
    review_failures=[s['filename'] for s in screens if s['individualReview'] and s['individualReview'].get('realFailures')]
    if review_failures:warnings.append(f'{len(review_failures)} individual reviews record unresolved real failures.')
    if warnings and not a.diagnostic:raise ValueError('Final gallery gate failed: '+' '.join(warnings))
    differences=load(a.differences_json) if a.differences_json else []
    if not isinstance(differences,list):raise ValueError('Differences JSON must be an array of explicit notes')
    model={'stage':a.stage,'sourceCommit':a.source_commit,'diagnostic':a.diagnostic,'warnings':warnings,'screenCount':len(screens),'expectedCount':85,'reviewCount':review_count,'screens':sorted(screens,key=lambda s:(SCENES.index(s['scene']),VARIANTS.index(s['variant']))),'references':refs,'scenes':SCENES,'variants':VARIANTS,'sceneLabels':SCENE_LABELS,'variantLabels':VARIANT_LABELS,'buildFingerprint':next(iter(fingerprints)) if len(fingerprints)==1 else None,'layoutFailures':failures,'browserErrors':errors,'differences':differences,'readmeUrl':url(a.readme.resolve(),base) if a.readme else None}
    data=json.dumps(model,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    output.parent.mkdir(parents=True,exist_ok=True)
    template='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Screenshot comparison</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#141a2b;font:14px/1.5 system-ui,sans-serif}header{padding:20px 24px;background:#fff;border-bottom:1px solid #e6e7eb}h1{font-size:24px;margin:0 0 8px}.muted{color:#5a6070}.warning{background:#fdf3e2;color:#895000;padding:12px;border-radius:12px}code{font-size:12px;overflow-wrap:anywhere}label{display:flex;flex-direction:column;gap:6px;min-width:150px}.controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-top:16px}select,button{min-height:40px;padding:8px 12px;border:1px solid #e1e3e8;border-radius:10px;background:#fff;color:#141a2b;font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #7397f0;outline-offset:2px}main{padding:20px 24px}.panels{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}.panel{min-width:0;background:white;border-radius:16px;overflow:hidden}.panel h2,.panel p{padding:0 16px}.viewport{height:72vh;overflow:auto;border-top:1px solid #eef0f3;background:#e6e7eb;padding:8px}.viewport img{display:block;height:auto;margin:auto;background:white;width:100%;max-width:100%}.viewport img[hidden]{display:none}.actual .viewport img{width:auto;max-width:none}.metadata{font-size:12px;color:#5a6070}details{margin-top:16px;background:white;padding:12px;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#2b59c3}@media(max-width:760px){.panels{grid-template-columns:1fr}.viewport{height:65vh}header,main{padding:16px}}</style>
<header><h1 id="heading"></h1><p id="proof" class="muted"></p><p>Images are original, unchanged PNG files. Fitting them to these panels changes display size only. Use Actual size to inspect the original pixels.</p><div id="warning" class="warning" hidden></div><div class="controls"><label>Screen<select id="scene"></select></label><label>Variant<select id="variant"></select></label><label>Owner reference<select id="reference"></select></label><button id="previous" type="button">Previous screenshot</button><button id="next" type="button">Next screenshot</button><button id="size" type="button" aria-pressed="false">Actual size</button></div></header>
<main><div class="panels" id="panels"><section class="panel"><h2>Candidate screenshot</h2><p id="candidate-name"></p><p id="candidate-meta" class="metadata"></p><div class="viewport"><img id="candidate" alt=""></div></section><section class="panel"><h2>Owner reference</h2><p id="reference-name"></p><p id="reference-meta" class="metadata"></p><div class="viewport"><img id="original" alt=""></div></section></div><details open><summary>Intentional differences and review boundaries</summary><ul id="differences"></ul><p id="readme"></p></details><details><summary>Source, file hashes and individual review record</summary><pre id="details"></pre></details></main>
<script type="application/json" id="proof-data">__DATA__</script><script>
'use strict';const data=JSON.parse(document.getElementById('proof-data').textContent);const byId=id=>document.getElementById(id);const scene=byId('scene'),variant=byId('variant'),reference=byId('reference');
byId('heading').textContent=`${data.stage.toUpperCase()} screenshot comparison${data.diagnostic?' — DIAGNOSTIC, NOT FINAL PROOF':''}`;byId('proof').textContent=`${data.screenCount}/85 images; ${data.reviewCount} individual review records; source ${data.sourceCommit}; production fingerprint ${data.buildFingerprint??'unavailable'}`;
if(data.warnings.length){byId('warning').hidden=false;byId('warning').textContent=data.warnings.join(' ')}
for(const s of data.scenes){const o=new Option(data.sceneLabels[s],s);scene.add(o)}for(const v of data.variants)variant.add(new Option(data.variantLabels[v],v));data.references.forEach((r,i)=>reference.add(new Option(`${r.kind}: ${r.source_name}`,String(i))));
const note=text=>{const li=document.createElement('li');li.textContent=text;byId('differences').append(li)};note('Capture/hash verification is distinct from the owner’s approval. Missing individual review or recorded layout failure is never a passing result.');note('Reference sample records, names and prices are not the app’s business data; actual permitted demo records remain authoritative.');if(data.diagnostic)note('This diagnostic gallery must not be presented as the final C6/C7 comparison.');for(const n of data.differences)note(typeof n==='string'?n:JSON.stringify(n));if(data.readmeUrl){const a=document.createElement('a');a.href=data.readmeUrl;a.textContent='Open the review guide / README';byId('readme').append(a)}
function update(){const s=data.screens.find(s=>s.scene===scene.value&&s.variant===variant.value);const r=data.references[Number(reference.value)];byId('candidate-name').textContent=s?s.filename:'This screenshot is not available in this diagnostic set.';byId('candidate-meta').textContent=s?`SHA256 ${s.sha256} · ${s.viewport.width}×${s.viewport.height} viewport · ${s.individualReview?.openedIndividually?'Individually opened (see review record)':'Individual review record unavailable'}`:'';byId('candidate').hidden=!s;if(s){byId('candidate').src=s.url;byId('candidate').alt=data.sceneLabels[s.scene]+' — '+data.variantLabels[s.variant]}else byId('candidate').removeAttribute('src');byId('reference-name').textContent=r.source_name;byId('reference-meta').textContent=`SHA256 ${r.sha256} · ${r.bytes} original bytes`;byId('original').src=r.url;byId('original').alt=r.kind+' — '+r.source_name;byId('details').textContent=JSON.stringify({sourceCommit:data.sourceCommit,productionFingerprint:data.buildFingerprint,candidate:s??null,reference:r},null,2);for(const panel of document.querySelectorAll('.viewport'))panel.scrollTo(0,0)}
scene.addEventListener('change',update);variant.addEventListener('change',update);reference.addEventListener('change',update);function step(delta){let i=data.screens.findIndex(s=>s.scene===scene.value&&s.variant===variant.value);i=(i+delta+data.screens.length)%data.screens.length;scene.value=data.screens[i].scene;variant.value=data.screens[i].variant;update()}byId('previous').addEventListener('click',()=>step(-1));byId('next').addEventListener('click',()=>step(1));byId('size').addEventListener('click',()=>{const pressed=byId('size').getAttribute('aria-pressed')!=='true';byId('size').setAttribute('aria-pressed',String(pressed));byId('size').textContent=pressed?'Fit to panels':'Actual size';byId('panels').classList.toggle('actual',pressed)});if(data.screens.length){scene.value=data.screens[0].scene;variant.value=data.screens[0].variant}update();
</script></html>'''
    output.write_text(template.replace('__DATA__',data),encoding='utf-8')
    summary={'sourceCommit':a.source_commit,'stage':a.stage,'diagnostic':a.diagnostic,'output':str(output),'screens':len(screens),'individuallyReviewed':review_count,'references':len(refs),'warnings':warnings,'productionFingerprint':model['buildFingerprint']}
    output.with_suffix('.manifest.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
