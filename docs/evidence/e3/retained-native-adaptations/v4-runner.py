from pathlib import Path
import json,hashlib,shutil,os,subprocess,time,urllib.request,signal
root=Path('/tmp/e3-retained-bounded-v4'); src=Path('/tmp/e3-complete-browser-proof/source'); manifests=[Path('/tmp/e3-retained-native-adaptations/manifest-v7.json'),Path('/tmp/e3-labels-selection-repair/manifest.json')]
if root.exists(): raise RuntimeError('fresh proof required')
root.mkdir(); tree=root/'source'; tree.mkdir()
repo='/workspace/Supermarket-Inventory'; commit=subprocess.check_output(['git','-C',repo,'rev-parse','HEAD']).decode().strip()
archive=root/'source.tar'
with archive.open('wb') as out:subprocess.run(['git','-C',repo,'archive','--format=tar',commit,'AGENTS.md','prototype','docs','seed','assets'],stdout=out,check=True)
import tarfile
with tarfile.open(archive) as t:t.extractall(tree,filter='data')
(root/'base-source.json').write_text(json.dumps({'exact_git_commit':commit,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2))
(tree/'prototype/node_modules').symlink_to('/workspace/Supermarket-Inventory/prototype/node_modules',target_is_directory=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
for manifest in manifests:
 for f in json.loads(manifest.read_text())['files']:
  p=tree/f['path'];data=Path(f['source']).read_bytes()
  if sha(p.read_bytes())!=(f.get('baseline_worktree') or f.get('baseline_sha256')) or sha(data)!=f['sha256']: raise RuntimeError(f)
  p.write_bytes(data)
def pins():return {str(p.relative_to(tree)):sha(p.read_bytes()) for p in tree.rglob('*') if p.is_file() and not p.is_symlink() and 'node_modules' not in p.parts and 'dist' not in p.parts and p.name!='bounded.config.ts'}
before=pins();(root/'source-pins-before.json').write_text(json.dumps(before,indent=2))
base='http://127.0.0.1:5197';cfg=tree/'prototype/bounded.config.ts';cfg.write_text('import base from "./playwright.config";\nexport default { ...base, use: { ...base.use, baseURL: '+json.dumps(base)+' }, webServer: undefined };\n')
env=dict(os.environ);env['PATH']='/workspace/scratch/node-install/node-v22.23.3-linux-x64/bin:'+env['PATH'];env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']='/usr/bin/chromium';env.pop('CI',None);env.pop('C6_NONSECURE_TEST_ORIGIN',None);env.pop('C6_LAN_BASE_URL',None)
executions=[];start=time.time()
def run(cmd,label):
 with(root/(label+'.log')).open('w')as log:r=subprocess.run(cmd,cwd=tree/'prototype',env=env,stdout=log,stderr=subprocess.STDOUT)
 result={'label':label,'command':cmd,'actual_exit_code':r.returncode};executions.append(result);(root/'progress.json').write_text(json.dumps(executions,indent=2));return r.returncode
if run(['npm','run','build'],'normal-build'):raise RuntimeError('normal build failed; preserve logs')
dist={str(p.relative_to(tree/'prototype/dist')):sha(p.read_bytes())for p in(tree/'prototype/dist').rglob('*')if p.is_file()};(root/'dist-pins.json').write_text(json.dumps(dist,indent=2))
preview=subprocess.Popen(['node','node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5197','--strictPort'],cwd=tree/'prototype',env=env,stdout=(root/'preview.log').open('w'),stderr=subprocess.STDOUT,start_new_session=True)
def http_pins():
 import urllib.parse
 return {name:sha(urllib.request.urlopen(base+'/'+urllib.parse.quote(name),timeout=10).read())for name in dist}
try:
 for attempt in range(100):
  try:
   with urllib.request.urlopen(base,timeout=1)as res:res.read();break
  except Exception:time.sleep(.1)
 http_before=http_pins();assert http_before==dist
 greps={'desktop':'simulated upload, review|C6 keeps twenty distinct|Cashier cannot open Suppliers|worker catalog actions|a worker retargets|invoice changed regular cost|supplier pickup and partial|Return detail pickup|Supplier-held cancellation|Settings presents the exact|an already-open worker editor','phone':'table columns align and phone cards retain|Part 1 pills and dashboard branch|C5 button contract covers Suppliers|C5 button contract covers Labels|C5 button contract covers primary|C5 conditional label selection|C5 Waiting for credit|C5 Klead text actions|C8 Received uses whole cases|C8 list navigation and disclosure'}
 (root/'execution-start.json').write_text(json.dumps({'base_commit':commit,'manifests':{str(m):sha(m.read_bytes())for m in manifests},'expected_cases':{'desktop':11,'phone':17},'preserved':['original whole native test bodies and business/geometry oracles except documented current-contract replacements','original test and assertion time budgets','no retries or skips','same full frozen source except recorded21 files; normal production rebuild','one browser worker']},indent=2))
 for project,grep in greps.items():
  env['PLAYWRIGHT_JSON_OUTPUT_NAME']=str(root/(project+'-playwright.json'))
  cmd=['node','node_modules/@playwright/test/cli.js','test','--config',str(cfg),'--workers=1','--project='+project,'--grep',grep,'--reporter=line,json','--output',str(root/(project+'-output'))]
  run(cmd,'native-'+project)
 http_after=http_pins();after=pins();(root/'source-pins-after.json').write_text(json.dumps(after,indent=2))
 result={'executions':executions,'seconds':time.time()-start,'source_unchanged':before==after,'http_matches_built_dist_before':http_before==dist,'http_unchanged':http_before==http_after,'expected_tests':28};(root/'execution-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
finally:
 os.killpg(preview.pid,signal.SIGTERM);preview.wait(timeout=10)
