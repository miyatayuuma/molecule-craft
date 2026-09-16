import {performance} from 'node:perf_hooks';
import {readFile} from 'node:fs/promises';
import {nextCraftBondHint} from '../src/craft-target-hint.js';
import {evaluateCraftTargetMatch} from '../src/craft-target-match.js';
import {moleculeFingerprint} from '../src/chemistry.js';
import {createMoleculeGraph,getFrontierCandidates} from '../src/molecule-graph.js';
import {buildVisibleGraphProjection} from '../src/encyclopedia-graph.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {routeFlowAt} from '../src/veil/route-kit.js';

const molecules=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(molecules.map(row=>[row.id,row]));
const pct=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor((xs.length-1)*p))];
function bench(name,fn,reps=7){const samples=[];let result;for(let i=0;i<reps;i++){const t=performance.now();result=fn();samples.push(performance.now()-t);}const row={name,median:+pct(samples,.5).toFixed(3),p95:+pct(samples,.95).toFixed(3),max:+Math.max(...samples).toFixed(3)};console.log(JSON.stringify(row));return {row,result};}
function workspaceFrom(record,{removeLastBond=false}={}){const atoms=record.atoms.map((element,index)=>({id:1000+index,element}));const bonds=record.bonds.slice(0,removeLastBond?-1:undefined).map(([a,b,order])=>({a:atoms[a].id,b:atoms[b].id,order}));return {atoms,bonds};}
function alkane(n){const atoms=Array(n).fill('C'),bonds=[];for(let i=0;i<n-1;i++)bonds.push([i,i+1,1]);let h=n;for(let i=0;i<n;i++){const count=i===0||i===n-1?3:2;for(let j=0;j<count;j++){atoms.push('H');bonds.push([i,h++,1]);}}return {id:`synthetic-alkane-${n}`,atoms,bonds};}
function ring(n,aromatic=false){const atoms=Array(n).fill('C'),bonds=[];for(let i=0;i<n;i++)bonds.push([i,(i+1)%n,aromatic?(i%2?1:2):1]);return {id:`ring-${n}`,atoms,bonds};}
function circulant(n){const atoms=Array.from({length:n},(_,id)=>({id,element:'C'})),seen=new Set(),bonds=[];for(let i=0;i<n;i++)for(const d of [1,2]){const j=(i+d)%n,key=i<j?`${i}:${j}`:`${j}:${i}`;if(!seen.has(key)){seen.add(key);bonds.push({a:i,b:j,order:1});}}return {atoms,bonds};}
console.log(`molecules=${molecules.length}`);
for(const id of ['benzene','methylcyclohexane','n-hexane']){const r=byId.get(id);if(r)bench(`hint:${id}`,()=>nextCraftBondHint(r,workspaceFrom(r,{removeLastBond:true})),5);}
for(const n of [3,6,8,10]){const t=alkane(n),w=workspaceFrom(t,{removeLastBond:true});bench(`hint:alkane-C${n}`,()=>nextCraftBondHint(t,w),n>=10?3:5);bench(`match:alkane-C${n}`,()=>evaluateCraftTargetMatch(t,w),5);}
for(const n of [12,14]){const t=alkane(n),w=workspaceFrom(t,{removeLastBond:true});bench(`hint:alkane-C${n}`,()=>nextCraftBondHint(t,w),1);}
for(const n of [6,10,15,20]){const t=ring(n,n===6),w=workspaceFrom(t,{removeLastBond:true});bench(`match:ring-${n}`,()=>evaluateCraftTargetMatch(t,w),5);}
for(const n of [8,12,16,24,32]){const g=circulant(n);bench(`fingerprint:degree4-${n}`,()=>moleculeFingerprint(g.atoms,g.bonds),5);}
function syntheticGraph(n,degree=4){const nodeColumns=['id','sectorCode','branchCodes','familyCode','depth','tier'],nodes=Array.from({length:n},(_,i)=>[`n${i}`,i%8,[i%7],i%5,Math.floor(i/8),i%3]),edgeColumns=['from','to','relationCode'],edges=[],seen=new Set();for(let i=0;i<n;i++)for(let d=1;d<=degree/2;d++){const j=(i+d)%n,key=i<j?`${i}:${j}`:`${j}:${i}`;if(i!==j&&!seen.has(key)){seen.add(key);edges.push([i,j,0]);}}return createMoleculeGraph({schemaVersion:1,nodeColumns,nodes,edgeColumns,edges,graphRoots:['n0'],familyCodes:{},roleCodes:{},sectorCodes:{},branchCodes:{0:'b0',1:'b1',2:'b2',3:'b3',4:'b4',5:'b5',6:'b6'},relationCodes:{}});}
for(const n of [100,200,300]){const g=syntheticGraph(n);const registered=Array.from({length:Math.floor(n/2)},(_,i)=>`n${i*2}`);bench(`graph:projection-${n}`,()=>buildVisibleGraphProjection(g,{focusId:'n0',registeredIds:registered}),10);bench(`graph:frontier-${n}`,()=>getFrontierCandidates(g,{discoveredIds:registered}),10);}
function dustMap(n){return {seed:1,universe:false,dust:Array.from({length:n},(_,i)=>({id:i,x:10000+(i%100)*20,y:10000+Math.floor(i/100)*20,angle:0,value:1,kind:'normal',element:'H',ready:0})),fields:[],signals:[],currents:[]};}
for(const n of [5000,10000,15000]){const run=createRun(dustMap(n),undefined,{predators:false});bench(`field:step-dust-${n}`,()=>stepRun(run,{x:0,y:0},1/60,{}),10);}
function syntheticRoute(n){return {width:220,points:Array.from({length:n},(_,i)=>({x:i*10,y:Math.sin(i*.05)*100,angle:0}))};}
for(const n of [100,300,900]){const route=syntheticRoute(n);bench(`field:route-${n}`,()=>routeFlowAt(route,{x:n*5,y:20}),20);}
