from pathlib import Path,PurePosixPath
import hashlib,json,shutil,os,subprocess,time,signal,urllib.request,urllib.parse,tarfile,io,sys
repo=Path('/workspace/Supermarket-Inventory');root=Path('/tmp/e1-ci-native-three-bounded-v1');root.mkdir();tree=root/'source';tree.mkdir()
commit='ca00c5a68eddb12aaaec9c35c6d4f4b39f01ad4d';manifest=Path('/tmp/e1-ci-native-three-adaptations/manifest.json');overlay=json.loads(manifest.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,data):(root/name).write_text(json.dumps(data,indent=2)+'\n')
actual=subprocess.check_output(['git','rev-parse',commit+'^{commit}'],cwd=repo,text=True).strip();assert actual==commit
archive=subprocess.check_output(['git','archive','--format=tar',commit,'AGENTS.md','prototype','docs','seed','assets'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive))as tar:
 for member in tar:
  name=PurePosixPath(member.name);assert not name.is_absolute()and'..'not in name.parts
  target=tree.joinpath(*name.parts)
  if member.isdir():target.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   target.parent.mkdir(parents=True,exist_ok=True)
   with tar.extractfile(member)as src,target.open('wb')as out:shutil.copyfileobj(src,out)
   target.chmod(member.mode&0o777)
  else:raise RuntimeError('Unexpected archive entry'+member.name)
tracked={str(p.relative_to(tree)):sha(p.read_bytes())for p in tree.rglob('*')if p.is_file()};save('source-pins-committed.json',tracked)
for f in overlay['files']:
 p=tree/f['path'];assert sha(p.read_bytes())==f['baseline_sha256'],f['path'];b=Path(f['source']).read_bytes();assert sha(b)==f['sha256'];p.write_bytes(b)
(tree/'prototype/node_modules').symlink_to(repo/'prototype/node_modules',target_is_directory=True)
def pins():return{name:sha((tree/name).read_bytes())for name in tracked}
before=pins();save('source-pins-before.json',before)
changes={n:{'committed':tracked[n],'candidate':before[n]}for n in tracked if tracked[n]!=before[n]};assert set(changes)=={f['path']for f in overlay['files']};assert all(n.startswith('prototype/tests/')for n in changes)
node='/workspace/scratch/node-install/node-v22.23.3-linux-x64/bin';env=dict(os.environ);env['PATH']=node+':'+env['PATH'];env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']='/usr/bin/chromium';assert not env.get('CI');assert not env.get('C6_NONSECURE_TEST_ORIGIN');assert not env.get('C6_LAN_BASE_URL');env['C6_NONSECURE_TEST_ORIGIN']='http://supermarket-lan-proof.invalid';env['PLAYWRIGHT_JSON_OUTPUT_NAME']=str(root/'playwright.json')
save('execution-start.json',{'commit':commit,'archive_sha256':sha(archive),'manifest_sha256':sha(manifest.read_bytes()),'overlay':changes,'expected_cases':12,'production_source':'Exact E1ca00c5a with3recorded test-only overlays; fresh normal npmrunbuild','budgets':'Original60000ms tests/5000ms expect,0retries,0skip,1worker; bothoriginalDesktopChrome/iPhone13Chromium projects','transport':'Loopback actual Vitepreview; preserved explicit .invalid nonsecure-responsefixture if exercised'})
start=time.time()
def run(cmd,label):
 started=time.time()
 with(root/(label+'.log')).open('w')as log:
  proc=subprocess.Popen(cmd,cwd=tree/'prototype',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);save(label+'-running.json',{'pid':proc.pid,'command':cmd});code=proc.wait()
 save(label+'-execution.json',{'command':cmd,'actual_exit_code':code,'seconds':time.time()-started});return code
code=run(['npm','run','build'],'normal-build');assert code==0,'normal build failed'
dist={str(p.relative_to(tree/'prototype/dist')):sha(p.read_bytes())for p in(tree/'prototype/dist').rglob('*')if p.is_file()};save('dist-pins.json',dist)
base='http://127.0.0.1:5199';cfg=tree/'prototype/playwright.ci-native-proof.config.ts';cfg.write_text('import base from "./playwright.config";\nexport default { ...base, use: { ...base.use, baseURL: '+json.dumps(base)+' }, webServer: undefined };\n')
preview=subprocess.Popen(['node','node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5199','--strictPort'],cwd=tree/'prototype',env=env,stdout=(root/'preview.log').open('w'),stderr=subprocess.STDOUT,start_new_session=True);save('owned-preview.json',{'pid':preview.pid,'baseURL':base})
def http():return{name:sha(urllib.request.urlopen(base+'/'+urllib.parse.quote(name),timeout=10).read())for name in dist}
try:
 deadline=time.monotonic()+30
 while True:
  if preview.poll()is not None:raise RuntimeError('owned preview exited')
  try:
   with urllib.request.urlopen(base,timeout=1)as response:
    if response.status==200:break
  except Exception:pass
  if time.monotonic()>=deadline:raise RuntimeError('Original30secpreview budget exceeded')
  time.sleep(.1)
 http_before=http();assert http_before==dist
 pattern='Supervisor creates a Warehouse fractional-case draft|Settings presents the exact 13 groups|Supervisor supplier overview reconciles balances|Floor Worker supplier overview and every tab omit financial DOM|Cashier cannot open Suppliers through a direct address'
 cmd=['node','node_modules/@playwright/test/cli.js','test','--config',str(cfg),'tests/orders-c2.spec.ts','tests/settings-b.spec.ts','tests/suppliers-a2.spec.ts','--grep',pattern,'--workers=1','--reporter=line,json','--output',str(root/'native-output')]
 code=run(cmd,'native');after=pins();save('source-pins-after.json',after);http_after=http();actualdist={str(p.relative_to(tree/'prototype/dist')):sha(p.read_bytes())for p in(tree/'prototype/dist').rglob('*')if p.is_file()};report=json.loads((root/'playwright.json').read_text());result={'actual_exit_code':code,'seconds':time.time()-start,'source_unchanged':before==after,'http_matches_dist_before':http_before==dist,'http_unchanged':http_before==http_after,'dist_unchanged':actualdist==dist,'dist_asset_count':len(dist),'expected_cases':12,'stats':report['stats'],'global_errors':report.get('errors',[]),'commit':commit,'manifest_sha256':sha(manifest.read_bytes()),'production_changes':0,'normal_build_exit_code':0};save('execution-result.json',result);print(json.dumps(result),flush=True)
finally:
 os.killpg(preview.pid,signal.SIGTERM);preview.wait(timeout=10)
raise SystemExit(code)
