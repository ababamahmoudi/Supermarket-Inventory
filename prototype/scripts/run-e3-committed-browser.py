#!/usr/bin/env python3
"""Freeze and verify the real committed E3 app; captures are unedited browser PNGs."""
from pathlib import Path
import argparse, hashlib, io, json, os, re, shutil, subprocess, tarfile, time, urllib.request
parser=argparse.ArgumentParser()
parser.add_argument('--commit', required=True)
parser.add_argument('--git-root', default='/workspace/Supermarket-Inventory')
parser.add_argument('--proof', required=True)
parser.add_argument('--port', type=int, default=5196)
parser.add_argument('--freeze-only', action='store_true')
parser.add_argument('--resume-frozen', action='store_true')
args=parser.parse_args()
if not re.fullmatch('[a-f0-9]{40}',args.commit): raise SystemExit('Use the full 40-character committed SHA.')
root=Path(args.git_root).resolve();proof=Path(args.proof).resolve();source=proof/'source';freeze=proof/'freeze.json'
if proof==root or root in proof.parents: raise SystemExit('Evidence must live outside the working repository.')
sha=lambda data:hashlib.sha256(data).hexdigest()
if args.resume_frozen:
    saved=json.loads(freeze.read_text())
    if saved['commit']!=args.commit: raise SystemExit('The frozen commit differs; do not substitute a new HEAD.')
else:
    if proof.exists(): raise SystemExit('Use a new proof directory, or --resume-frozen.')
    proof.mkdir(parents=True);source.mkdir()
    raw=subprocess.check_output(['git','-C',str(root),'archive',args.commit,'AGENTS.md','prototype','seed','assets','docs/return-policy.md'])
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive: archive.extractall(source,filter='data')
    files={str(p.relative_to(source)):sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()}
    saved={'commit':args.commit,'method':'Exact git archive, no source patches, actor injection, prefilled sessions or edited images.','files':files}
    freeze.write_text(json.dumps(saved,indent=2)+'\n')
    (source/'prototype/node_modules').symlink_to(root/'prototype/node_modules',target_is_directory=True)
if args.freeze_only: print(json.dumps({'frozen':True,'commit':args.commit,'files':len(saved['files'])}));raise SystemExit(0)
def unchanged(): return all((source/rel).exists() and sha((source/rel).read_bytes())==digest for rel,digest in saved['files'].items())
if not unchanged(): raise SystemExit('Frozen Git source was modified.')
node=subprocess.check_output(['node','--version'],text=True).strip()
version=tuple(int(part) for part in node.removeprefix('v').split('.'))
if not ((22,22,2)<=version<(23,0,0)): raise SystemExit('Run with the supported Node 22.22.2 or newer Node 22 release.')
records=[];server=None;result={'commit':args.commit,'node':node,'physical_phone_installation':'Not performed; app-phone-dark screenshot is an actual Chromium browser view, not a home-screen installation.'}
def run(name,command):
    start=time.time()
    with (proof/(name+'.log')).open('w') as log: completed=subprocess.run(command,cwd=source/'prototype',stdout=log,stderr=subprocess.STDOUT)
    records.append({'check':name,'command':command,'exit_code':completed.returncode,'seconds':round(time.time()-start,2)})
    return completed.returncode
base=f'http://127.0.0.1:{args.port}'
def assets():
    values={}
    for path in sorted((source/'prototype/dist').rglob('*')):
        if not path.is_file():continue
        rel=str(path.relative_to(source/'prototype/dist'));expected=sha(path.read_bytes())
        with urllib.request.urlopen(urllib.request.Request(base+'/'+rel,headers={'Cache-Control':'no-cache'}),timeout=15) as response:
            actual=sha(response.read())
            if response.status!=200 or actual!=expected: raise RuntimeError('Served asset differs: '+rel)
        values[rel]=actual
    return values
try:
    if run('build',['npm','run','build']): raise RuntimeError('Build failed; source, logs and failure remain retained.')
    with (proof/'preview.log').open('w') as preview:
        server=subprocess.Popen(['npm','exec','vite','--','preview','--host','127.0.0.1','--port',str(args.port),'--strictPort'],cwd=source/'prototype',stdout=preview,stderr=subprocess.STDOUT,start_new_session=True)
    deadline=time.monotonic()+30
    while True:
        try:
            with urllib.request.urlopen(base,timeout=2) as response:
                if response.status==200:break
        except OSError:
            if time.monotonic()>deadline: raise RuntimeError('Preview did not become ready.')
            time.sleep(.25)
    before=assets()
    configuration={
        'testDir':str(source/'prototype/tests'),'testMatch':['e3-phones.spec.ts','e3-pwa-native.spec.ts'],
        'timeout':60000,'workers':1,'retries':0,'forbidOnly':True,
        'reporter':[['json',{'outputFile':str(proof/'playwright-results.json')}]],'outputDir':str(proof/'artifacts'),
        'use':{'baseURL':base,'viewport':{'width':390,'height':932},'headless':True,'trace':'retain-on-failure','launchOptions':{'executablePath':os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH') or shutil.which('chromium')}},
    }
    config=proof/'playwright.config.mts';config.write_text('export default '+json.dumps(configuration,indent=2)+';\n')
    native_exit=run('native',['npm','exec','playwright','--','test','--config',str(config)])
    after=assets();result['served_files_unchanged']=before==after;result['served_files']=before
    report=json.loads((proof/'playwright-results.json').read_text());result['native_stats']=report['stats']
    result['screenshots']=[{'path':str(path.relative_to(proof)),'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size} for path in sorted((proof/'artifacts').rglob('*.png'))]
    if native_exit: raise RuntimeError('Native browser checks failed; inspect retained artifacts.')
    if report['stats']['unexpected'] or report['stats']['skipped'] or report['stats']['expected']!=13: raise RuntimeError('All thirteen original E3 cases must execute without failure or skip.')
    result['success']=True
except Exception as error:
    result['success']=False;result['error']=str(error)
finally:
    if server is not None:
        import signal
        try: os.killpg(server.pid,signal.SIGTERM)
        except ProcessLookupError:pass
    result['checks']=records;result['frozen_source_unchanged']=unchanged()
    if not result['frozen_source_unchanged']: result['success']=False
    (proof/'execution-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result.get(k) for k in ['success','commit','native_stats','frozen_source_unchanged','error']}))
raise SystemExit(0 if result.get('success') else 1)
