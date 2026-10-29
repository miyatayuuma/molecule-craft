// Owner: docs/validation/polymer-local-fragment-task5-native-projection.md.
// Budgeted offline native constraints. Not a production orientation selector.
import fs from 'node:fs';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {seed,poseAt} from './diagnose-polymer-task5-boundaries.mjs';
import {snapshot,frozen,initial} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {nativeConstraints} from './polymer-task5-native-projection.mjs';

const directory=process.argv[2],protocol=JSON.parse(fs.readFileSync(directory+'/candidate-protocol.json'));
const gate=JSON.parse(gunzipSync(fs.readFileSync(directory+'/consistency.json.gz')));
assert.equal(gate.consistencyGate,true);
const group=JSON.parse(fs.readFileSync('docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-visibility-conflict.json')).groups.find(g=>g.anchor===30);
let calls=0;
for await(const line of readline.createInterface({input:process.stdin})){
  try{
    assert.ok(calls++<protocol.nativeConstraintEvaluationCap);
    const {deltaDegrees}=JSON.parse(line);assert.equal(deltaDegrees.length,3);
    assert.ok(deltaDegrees.every(v=>Number.isFinite(v)&&Math.abs(v)<=1+1e-10));
    const rotationDegrees=seed.rotationDegrees.map((v,i)=>v+deltaDegrees[i]),p=poseAt(rotationDegrees),s=snapshot(p.pose);
    const exact=nativeConstraints(s,group,frozen.views[0].domOcclusions);
    const objects=exact.objects.map(o=>({id:o.id,kind:o.kind,index:o.index,pixels:o.visiblePixels.length,required:o.required,pass:o.pass,
      ...(o.kind==='atom'?{diameter:o.diameter}:{width:o.width,length:o.branch.length,steps:o.branch.steps,continuous:o.branch.continuous,bestStart:o.branch.bestStart,bestEnd:o.branch.bestEnd})}));
    const constraints=objects.flatMap(o=>[{key:'area:'+o.id,value:o.pixels/o.required-1},
      ...(o.kind==='atom'?[{key:'diameter:'+o.id,value:o.diameter/(initial.graph.atoms[o.index].element==='H'?5.5:9.5)-1}]:
        [{key:'width:'+o.id,value:o.width/1.25-1},{key:'length:'+o.id,value:o.length/7.75-1},{key:'continuous:'+o.id,value:o.continuous/7.75-1}])]);
    constraints.push({key:'Q',value:p.fit.qMin/20-1});
    // The native per-triangle query retains near/far clipping. In addition,
    // production fit must contain the selected shell without a fit override.
    const guards={fit:p.fit.fits};
    process.stdout.write(JSON.stringify({deltaDegrees,rotationDegrees,pose:p.pose,objects,constraints,guards,qMin:p.fit.qMin,
      jointPass:exact.jointPass&&p.fit.qMin>=20&&guards.fit})+'\n');
  }catch(e){process.stdout.write(JSON.stringify({error:String(e.stack)})+'\n');}
}
