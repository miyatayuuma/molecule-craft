import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {instrumentPolymerViewer} from '../tests/helpers/polymer-profile-instrumentation.mjs';
const root=resolve('.'),baseline=resolve('../polymer-scale-baseline'),ref=process.argv[2];
if(!ref||!/^[0-9a-f]{40}$/.test(ref))throw Error('Provide verified baseline main SHA');
const run=(args,cwd=root,env={})=>{const r=spawnSync(args[0],args.slice(1),{cwd,env:{...process.env,...env},stdio:'inherit'});if(r.status!==0)throw Error(args.join(' ')+' failed');};
const original=await readFile('src/reaction-lab-viewer.js','utf8');
run(['git','worktree','add','--detach',baseline,ref]);
try{
  await cp('tests/reaction-lab-polymer-browser.test.mjs',join(baseline,'tests/reaction-lab-polymer-browser.test.mjs'));
  const old=await readFile(join(baseline,'src/reaction-lab-viewer.js'),'utf8');await writeFile(join(baseline,'src/reaction-lab-viewer.js'),instrumentPolymerViewer(old));
  await writeFile('src/reaction-lab-viewer.js',instrumentPolymerViewer(original));
  await mkdir('test-results/polymer-scale-up',{recursive:true});
  for(let i=1;i<=3;i++){
    run(['node','tests/reaction-lab-polymer-browser.test.mjs'],baseline,{POLYMER_BASELINE:'1'});
    await cp(join(baseline,'test-results/polymer-scale-up/baseline-390.json'),`test-results/polymer-scale-up/baseline-mobile-${i}.json`);
    run(['node','tests/reaction-lab-polymer-browser.test.mjs']);
    await cp('test-results/polymer-scale-up/profile-390.json',`test-results/polymer-scale-up/cinematic-mobile-${i}.json`);
  }
  run(['node','tests/reaction-lab-polymer-browser.test.mjs'],root,{POLYMER_DESKTOP:'1'});
}finally{
  await writeFile('src/reaction-lab-viewer.js',original);run(['git','worktree','remove','--force',baseline]);
}
console.log('Three paired mobile baseline/cinematic measurements plus desktop validated. Instrumentation removed.');
