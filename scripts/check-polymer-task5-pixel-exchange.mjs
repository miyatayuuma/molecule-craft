// Owner: docs/validation/polymer-local-fragment-task5-pixel-exchange.md.
// Fixed-list native-mesh CPU check. Never grants formal GPU acceptance.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {poseAt} from './diagnose-polymer-task5-boundaries.mjs';
import {initial, frozen, snapshot, measure, normalized} from './analyze-polymer-task5-orientation-feasibility.mjs';
import {png} from './analyze-polymer-task5-exact-mesh.mjs';
import {pngPixels,maskColor} from '../tests/helpers/polymer-task5-visual.mjs';

const dir=process.argv[2];assert.ok(dir);
assert.ok(!fs.existsSync(dir+'/results.json.gz'),'refusing to repeat candidate rasters');
const protocol=JSON.parse(fs.readFileSync(dir+'/protocol.json'));
const candidates=JSON.parse(fs.readFileSync(dir+'/candidates.json'));
assert.equal(candidates.rows.length,protocol.candidateSlots);
const old=pngPixels(fs.readFileSync(new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-boundary-92da7771/baseline-CPU-id.png',import.meta.url)));
const colorToId=new Map([[0,0],...snapshot(poseAt([-.054539559717073846,-.10453805899021659,.08315483688476073]).pose).meshes.map(m=>[maskColor(m.id),m.id])]);
const oldIds=new Uint32Array(old.width*old.height);
for(let i=0;i<oldIds.length;i++){const k=i*old.channels;oldIds[i]=colorToId.get((old.pixels[k]<<16)|(old.pixels[k+1]<<8)|old.pixels[k+2]);}
const rows=[];let rasters=0;
for(const candidate of candidates.rows){
  const observations=[];
  if(candidate.hasIncumbent){
    const {pose,fit}=poseAt(candidate.rotationDegrees);
    for(const precision of ['legacy4','shader32','float64']){
      assert.ok(rasters<protocol.CPUCap,'fixed raster budget exhausted');
      const m=measure(pose,30,null,precision);rasters++;
      const margins=normalized(m.grade,fit.qMin);
      const f=initial.canvas.height/(2*Math.tan(initial.camera.fov*Math.PI/360));
      const depths=m.snapshot.visual.atoms.flatMap(a=>[a.center.depth-a.radius*a.center.depth/f,a.center.depth+a.radius*a.center.depth/f]);
      const guards={fit:fit.fits,near:Math.min(...depths)>.2,far:Math.max(...depths)<initial.camera.far};
      const exchanges=[31,1056,1057,1058,1059].map(id=>{
        const gain=[],loss=[],kept=[];
        for(let i=0;i<oldIds.length;i++){
          if(m.raster.ids[i]===id&&oldIds[i]!==id)gain.push(i);
          if(m.raster.ids[i]!==id&&oldIds[i]===id)loss.push(i);
          if(m.raster.ids[i]===id&&oldIds[i]===id)kept.push(i);
        }return{id,gain,loss,keptCount:kept.length};
      });
      const sampleTraces=[32,34,35].map(index=>{
        const l=m.snapshot.visual.lanes.find(l=>l.bondIndex===index),dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,L=Math.hypot(dx,dy),steps=Math.ceil(2*L);
        return{index,length:L,steps,rawSamples:Array.from({length:steps+1},(_,j)=>({j,pixels:[-.5,0,.5].map(k=>{const x=Math.floor(l.a.x+dx*j/steps-k*dy/L),y=Math.floor(l.a.y+dy*j/steps+k*dx/L);return{x,y,owner:m.raster.ids[y*m.raster.width+x]};})}))};
      });
      const mask=candidate.name+'-'+precision+'-CPU-id.png';fs.writeFileSync(dir+'/'+mask,png(m.raster));
      observations.push({precision,pose,qMin:fit.qMin,bounds:fit.bounds,guards,grade:m.grade,margins,minimumMargin:Object.values(guards).every(Boolean)?margins[0].value:0,exchanges,sampleTraces,mask});
    }
  }
  rows.push({...candidate,observations});
  const result={protocol,CPURasters:rasters,graphDigest:frozen.graphDigest,rows,CPUJointWitness:rows.some(r=>r.observations.length===3&&r.observations.every(o=>o.minimumMargin>=1)),certifiedExcludedRegions:0,disposition:'UNRESOLVED_UNTIL_ACTUAL_GPU_WITNESS_OR_CONSERVATIVE_PROOF'};
  fs.writeFileSync(dir+'/results.json.gz',gzipSync(JSON.stringify(result)+'\n'));
  console.log(JSON.stringify({slot:candidate.name,hasIncumbent:candidate.hasIncumbent,modes:observations.map(o=>({precision:o.precision,minimum:o.minimumMargin,failAtoms:o.grade.atoms.filter(a=>!a.pass),failBonds:o.grade.bonds.filter(b=>!b.pass)}))}));
}
console.log(JSON.stringify({CPURasters:rasters,slots:rows.length,CPUJointWitness:rows.some(r=>r.observations.length===3&&r.observations.every(o=>o.minimumMargin>=1)),noGlobalProof:true}));
