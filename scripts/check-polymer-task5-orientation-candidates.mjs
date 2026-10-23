// Owner: Task5 orientation feasibility ledger. Fixed CPU screening, not acceptance.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.min.js';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
import {initial,inputFor,measure,normalized} from './analyze-polymer-task5-orientation-feasibility.mjs';
const dir='test-results/pib-orientation-feasibility',solver=JSON.parse(fs.readFileSync(dir+'/solver.json')),decomposition=JSON.parse(fs.readFileSync(dir+'/decomposition.json'));
const candidates=[...decomposition.rows.map(r=>({anchor:r.anchor,name:'reference-'+r.anchor,pose:r.pose})),...solver.rows.filter(r=>r.best).map(r=>({anchor:r.anchor,name:`shadow-maxmin-${r.anchor}-${r.seed}`,pose:r.best.pose}))];
const protocol={kind:'FIXED_FINALIST_CPU_SCREEN_NOT_ACCEPTANCE',maximumRasters:27,actualRasters:candidates.length*3,candidates:candidates.map(r=>r.name),modes:['legacy4','shader32','float64'],selection:'best minimum-margin evaluated point per declared seed, including finite-difference points, plus reference; no additional directions or adaptive refinement',criteria:'independent atom fraction/diameter, bond area/continuous/width/length and Q ratios all >=1; separate safe-region/depth boolean gates; GPU still final authority',limits:['No A06 photometry or actual pointer/reset','Three raster arithmetic modes are sensitivity screening, not universal pixel uncertainty bounds']};
fs.writeFileSync(dir+'/finalists-protocol.json',JSON.stringify(protocol,null,2)+'\n');
const rows=[];
for(const c of candidates){
 const fit=fitPolymerObservation(T,{...inputFor(c.anchor),quaternion:new T.Quaternion(...c.pose.quaternion)});
 assert.ok(Math.abs(fit.scale-c.pose.scale)<1e-8&&fit.position.every((v,i)=>Math.abs(v-c.pose.position[i])<1e-8),'independent JS fit must reproduce the solver fit');
 const modes=[];
 for(const mode of protocol.modes){const m=measure(c.pose,c.anchor,null,mode),margins=normalized(m.grade,fit.qMin),depths=m.snapshot.visual.atoms.flatMap(a=>[a.center.depth-a.radius*a.center.depth/(initial.canvas.height/(2*Math.tan(initial.camera.fov*Math.PI/360))),a.center.depth+a.radius*a.center.depth/(initial.canvas.height/(2*Math.tan(initial.camera.fov*Math.PI/360)))]),depth={min:Math.min(...depths),max:Math.max(...depths)};
  modes.push({mode,grade:m.grade,margins,depth,partialPass:m.grade.jointPartialPixelPass&&fit.fits&&fit.qMin>=20&&depth.min>.2&&depth.max<initial.camera.far});
 }
 const row={...c,qMin:fit.qMin,fitBounds:fit.bounds,safeRegion:fit.safeRegion,minimumMargin:Math.min(...modes.map(m=>m.margins[0].value)),allModesPartialPass:modes.every(m=>m.partialPass),modes};rows.push(row);
 console.log(JSON.stringify({name:row.name,minimumMargin:row.minimumMargin,allModesPartialPass:row.allModesPartialPass,failures:modes.map(m=>({mode:m.mode,atoms:m.grade.atoms.filter(a=>!a.pass),bonds:m.grade.bonds.filter(b=>!b.pass)}))}));
}
fs.writeFileSync(dir+'/finalists.json',JSON.stringify({protocol,rows},null,2)+'\n');
