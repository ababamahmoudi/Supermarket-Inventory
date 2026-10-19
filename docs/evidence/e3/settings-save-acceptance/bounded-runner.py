from pathlib import Path
import hashlib,json,shutil,os,subprocess,time,signal,urllib.request,urllib.parse
root=Path('/tmp/e3-settings-save-bounded-v1');root.mkdir();tree=root/'source';tree.mkdir()
parent=Path('/tmp/e3-complete-final-proof-v2');meta=json.loads((parent/'freeze.json').read_text());original=json.loads((parent/'source-pins.json').read_text());dist=json.loads((parent/'dist-pins.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
for name,pin in original.items():
 p=parent/'source'/name; assert sha(p.read_bytes())==pin['sha256'],name
 target=tree/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
for name,digest in dist.items():
 p=parent/'source/prototype/dist'/name;assert sha(p.read_bytes())==digest,name
 target=tree/'prototype/dist'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
(tree/'prototype/node_modules').symlink_to('/workspace/Supermarket-Inventory/prototype/node_modules',target_is_directory=True)
manifest=Path('/tmp/e3-settings-save-acceptance/manifest.json');data=json.loads(manifest.read_text())
for f in data['files']:
 p=tree/f['path'];assert sha(p.read_bytes())==f['baseline_sha256'];replacement=Path(f['source']).read_bytes();assert sha(replacement)==f['sha256'];p.write_bytes(replacement)
def pins():return {name:sha((tree/name).read_bytes()) for name in original}
def save(name,value):(root/name).write_text(json.dumps(value,indent=2)+'\n')
before=pins();save('source-pins-before.json',before);save('dist-pins.json',dist)
save('execution-start.json',{'commit':meta['commit'],'manifest_sha256':sha(manifest.read_bytes()),'expected_cases':2,'normal_build_reused':True,'normal_build_record':str(parent/'build/normal-build-execution.json'),'production_source':'Exact e47 unchanged; only recorded test fixture overlay','budgets':'Original60000ms tests,5000ms expect,0 retries,0skip,1worker','transport':'Original explicit http://supermarket-lan-proof.invalid insecure-response fixture'})
base='http://127.0.0.1:5199';cfg=tree/'prototype/playwright.migration-proof.config.ts';cfg.write_text('import base from "./playwright.config";\nexport default { ...base, use: { ...base.use, baseURL: '+json.dumps(base)+' }, webServer: undefined };\n')
env=dict(os.environ);env['PATH']=meta['node_dir']+':'+env['PATH'];env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']='/usr/bin/chromium';assert not env.get('CI');assert not env.get('C6_NONSECURE_TEST_ORIGIN');assert not env.get('C6_LAN_BASE_URL');env['C6_NONSECURE_TEST_ORIGIN']='http://supermarket-lan-proof.invalid';env['PLAYWRIGHT_JSON_OUTPUT_NAME']=str(root/'playwright.json')
preview=subprocess.Popen(['node','node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5199','--strictPort'],cwd=tree/'prototype',env=env,stdout=(root/'preview.log').open('w'),stderr=subprocess.STDOUT,start_new_session=True);save('owned-preview.json',{'pid':preview.pid,'baseURL':base})
def http():return {name:sha(urllib.request.urlopen(base+'/'+urllib.parse.quote(name),timeout=10).read()) for name in dist}
started=time.time()
try:
 deadline=time.monotonic()+30
 while True:
  if preview.poll() is not None:raise RuntimeError('preview exited')
  try:
   with urllib.request.urlopen(base,timeout=1)as response:
    if response.status==200:break
  except Exception:pass
  if time.monotonic()>=deadline:raise RuntimeError('Original30sec preview budget exceeded')
  time.sleep(.1)
 http_before=http();assert http_before==dist
 cmd=['node','node_modules/@playwright/test/cli.js','test','--config',str(cfg),'tests/settings.spec.ts','--grep','divisors update live, survive refresh, and invalid money preserves valid rules','--workers=1','--reporter=line,json','--output',str(root/'native-output')]
 with(root/'native.log').open('w')as log:
  proc=subprocess.Popen(cmd,cwd=tree/'prototype',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);save('native-running.json',{'pid':proc.pid,'command':cmd});code=proc.wait()
 after=pins();save('source-pins-after.json',after);http_after=http();actualdist={str(p.relative_to(tree/'prototype/dist')):sha(p.read_bytes())for p in(tree/'prototype/dist').rglob('*')if p.is_file()}
 result={'actual_exit_code':code,'seconds':time.time()-started,'source_unchanged':before==after,'http_matches_dist_before':http_before==dist,'http_unchanged':http_before==http_after,'dist_unchanged':actualdist==dist,'expected_cases':2,'commit':meta['commit'],'manifest_sha256':sha(manifest.read_bytes())};save('execution-result.json',result);print(json.dumps(result),flush=True)
finally:
 os.killpg(preview.pid,signal.SIGTERM);preview.wait(timeout=10)
