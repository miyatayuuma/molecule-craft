// Owner: Task⑤ PIB recovery. Replays the declared, bounded numeric experiments.
// Never a browser, geometry, photometry or visual acceptance gate.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
const mode=process.argv[2];
if(!['sphere','facets','refine30','factors'].includes(mode))throw Error('Expected sphere | facets | refine30 | factors');
const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const r=JSON.parse(gunzipSync(fs.readFileSync(new URL('ba94cb-pib-visual.json.gz',base))));
const initial=r.initial,c=initial.camera,camera=new T.PerspectiveCamera(c.fov,initial.canvas.width/initial.canvas.height,c.near,c.far);camera.position.fromArray(c.position);camera.updateMatrixWorld(true);
const plan={atoms:initial.layoutAtoms,bonds:initial.graph.bonds};
fs.mkdirSync('test-results',{recursive:true});
const inputFor=anchor=>{const target=initial.observation.targets.find(t=>t.target.anchor===anchor&&t.target.kind.startsWith('local:')).target,indices=new Set(target.atomIndices);for(const b of plan.bonds)if(target.atomIndices.includes(b.a)||target.atomIndices.includes(b.b)){indices.add(b.a);indices.add(b.b);}return{plan,camera,width:initial.canvas.width,height:initial.canvas.height,safeRegion:initial.fit.safeRegion,atomIndices:[...indices],requiredAtomIndices:target.atomIndices,requiredBondIndices:target.bondIndices};};
const better=(a,b)=>b.localReadability.score-a.localReadability.score||b.qMin-a.qMin;
const save=(name,protocol,value)=>{fs.writeFileSync(`test-results/${name}-protocol.json`,JSON.stringify(protocol,null,2)+'\n');fs.writeFileSync(`test-results/${name}.json`,JSON.stringify({protocol,...value})+'\n');};
const read=name=>JSON.parse(fs.readFileSync(`test-results/${name}.json`));
if(mode==='sphere'){
 const protocol={kind:'ONE_FIXED_NUMERIC_REACHABILITY_DIAGNOSTIC_NOT_ACCEPTANCE',anchor:30,directions:8192,rolls:[0,Math.PI/2],totalFits:16384,selection:'unchanged localReadability score then qMin',inputs:'frozen ba94cb-pib-visual and unchanged current fit',limits:['No browser','No global impossibility proof','No production or threshold change','All fits retained; no new sweep after outcome']};
 fs.writeFileSync('test-results/pib-reachability-protocol.json',JSON.stringify(protocol)+'\n');
 const input=inputFor(30),rows=[];let best=[];
 for(let k=0;k<8192;k++)for(const roll of protocol.rolls){const z=1-2*(k+.5)/8192,a=k*2.399963229728653,n=new T.Vector3(Math.sqrt(1-z*z)*Math.cos(a),Math.sqrt(1-z*z)*Math.sin(a),z),quaternion=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll).multiply(new T.Quaternion().setFromUnitVectors(n,new T.Vector3(0,0,1))),fit=fitPolymerObservation(T,{...input,quaternion});rows.push({k,roll,score:fit.localReadability.score,qMin:fit.qMin});if(best.length<5||fit.localReadability.score>=best[4].localReadability.score){best.push({k,roll,...fit});best.sort(better);best=best.slice(0,5);}}
 save('pib-reachability',protocol,{best,rows});console.log({fits:rows.length,best:best[0].localReadability.score});
}
if(mode==='facets'){
 const protocol={kind:'GRAPH_FACET_RANK_DISCRIMINATION_NOT_ACCEPTANCE',anchors:[0,17,30],axes:'all existing graph-derived normals before top-four truncation; at most525 per10 edges',faces:2,rolls:4,totalFitBound:12600,rank:'unchanged production localReadability then qMin',reason:'Determine whether current gap-only top-four truncation discards a simultaneous readable orientation; extra45degree roll diagnoses fit-scale loss',limits:['Numeric only','No production/source/geometry/threshold changes','All observations retained']};
 fs.writeFileSync('test-results/pib-facets-protocol.json',JSON.stringify(protocol)+'\n');
 const source=fs.readFileSync(new URL('../src/reaction-lab-polymer-presentation.js',import.meta.url),'utf8'),func=source.slice(source.indexOf('export function polymerLocalOrientationCandidates'),source.indexOf('export function fitPolymerObservation')).replace('export function','function').replace('axes.slice(0,4)','axes').replace('[0,Math.PI/2]','[0,Math.PI/4,Math.PI/2,3*Math.PI/4]');
 const framesOf=new Function('modelAtomRadius',func+';return polymerLocalOrientationCandidates;')(modelAtomRadius),groups=[];
 for(const anchor of protocol.anchors){const input=inputFor(anchor),frames=framesOf(T,{plan,bondIndices:input.requiredBondIndices,camera}),rows=[];let best=[];
  for(const frame of frames){const fit=fitPolymerObservation(T,{...input,quaternion:frame.quaternion});rows.push({axis:frame.axis,face:frame.face,roll:frame.roll,score:fit.localReadability.score,qMin:fit.qMin});if(best.length<5||fit.localReadability.score>=best[4].localReadability.score){best.push({frame:{...frame,quaternion:frame.quaternion.toArray()},...fit});best.sort(better);best=best.slice(0,5);}}
  groups.push({anchor,rows,best});console.log({anchor,fits:rows.length,best:best[0].localReadability.score});
 }save('pib-facets',protocol,{groups});
}
if(mode==='refine30'){
 const protocol={kind:'FIXED_30_COARSE_TO_FINE_NUMERIC_DIAGNOSTIC_NOT_ACCEPTANCE',seeds:5,degrees:[6,3,1.5,.75],sweepsPerLevel:2,candidatesPerSweep:7,totalFits:280,reason:'Coarse directions leave exposure conflicts on bonds32/33/34; bounded local refinement distinguishes a missed narrow orientation',limits:['No browser or acceptance','No new global search','No source/threshold/XYZ changes']};
 fs.writeFileSync('test-results/pib-reachability-refine-protocol.json',JSON.stringify(protocol)+'\n');
 const input=inputFor(30),seeds=read('pib-reachability').best,rows=[];
 for(let seed=0;seed<seeds.length;seed++){let q=new T.Quaternion(...seeds[seed].quaternion);for(const degree of protocol.degrees)for(let sweep=0;sweep<2;sweep++){
  const qs=[q.clone(),...[[1,0,0],[0,1,0],[0,0,1]].flatMap(a=>[-1,1].map(sign=>new T.Quaternion().setFromAxisAngle(new T.Vector3(...a),sign*degree*Math.PI/180).multiply(q)))],fits=qs.map((quaternion,candidate)=>({seed,degree,sweep,candidate,...fitPolymerObservation(T,{...input,quaternion})}));rows.push(...fits);fits.sort(better);q.fromArray(fits[0].quaternion);
 }}const best=rows.toSorted(better)[0];save('pib-reachability-refine',protocol,{best,rows});console.log({fits:rows.length,best:best.localReadability.score});
}
if(mode==='factors'){
 const protocol={kind:'PIVOT_AND_SAFE_REGION_FACTOR_DIAGNOSTIC_NOT_ACCEPTANCE',anchors:[0,17,30],regionVariants:['frozen262x309','candidate344x309 (requires visible pH control relocation and actual DOM verification)'],pivotVariants:['existing shell AABB','spec selected AABB'],poses:'current selector + fixed offline numerical best1 + five graph facet best + five coarse sphere best for30',limits:['No browser','No source/XYZ/threshold change','Synthetic candidate safe rectangle is NOT actual acceptance']};
 fs.writeFileSync('test-results/pib-fit-factors-protocol.json',JSON.stringify(protocol)+'\n');
 let source=fs.readFileSync(new URL('../src/reaction-lab-polymer-presentation.js',import.meta.url),'utf8').replace("'./chemistry.js?v=20'",JSON.stringify(new URL('../src/chemistry.js',import.meta.url).href)).replace("'./polymer-fragment-3d-layout.js?v=1'",JSON.stringify(new URL('../src/polymer-fragment-3d-layout.js',import.meta.url).href)).replace('const pivot=new THREE.Vector3(...min.map',`if(selected&&requiredAtomIndices.length){min=[Infinity,Infinity,Infinity];max=[-Infinity,-Infinity,-Infinity];for(const i of requiredAtomIndices){const p=plan.atoms[i],r=modelAtomRadius(p.element);for(let k=0;k<3;k++){const v=[p.x,p.y,p.z][k];min[k]=Math.min(min[k],v-r);max[k]=Math.max(max[k],v+r);}}}const pivot=new THREE.Vector3(...min.map`);
 const pivotFit=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).fitPolymerObservation;
 const refinement=read('pib-refinement'),facets=read('pib-facets'),sphere=read('pib-reachability'),refined=read('pib-reachability-refine'),rows=[];
 for(const anchor of protocol.anchors){const input=inputFor(anchor),qs=[null,refinement.groups.find(g=>g.anchor===anchor).best.quaternion,...facets.groups.find(g=>g.anchor===anchor).best.map(v=>v.quaternion),...(anchor===30?[refined.best.quaternion,...sphere.best.map(v=>v.quaternion)]:[])];
  for(const pivotMode of ['shell','selected'])for(const region of ['frozen','wide'])for(let seed=0;seed<qs.length;seed++){const safeRegion=region==='frozen'?initial.fit.safeRegion:{left:12,right:356,top:81,bottom:390,width:344,height:309},fit=(pivotMode==='shell'?fitPolymerObservation:pivotFit)(T,{...input,safeRegion,quaternion:qs[seed]?new T.Quaternion(...qs[seed]):null});rows.push({anchor,pivotMode,region,seed,...fit});}
 }save('pib-fit-factors',protocol,{rows});console.log({fits:rows.length});
}
