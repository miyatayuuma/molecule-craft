import assert from 'node:assert/strict';
import {createMap,sampleLine} from '../src/veil/map.js';
import {createRun,stepRun,beginBurst} from '../src/veil/engine.js';
import {VEIL} from '../src/veil/config.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {WORKSPACE_STORAGE_KEY} from '../src/workspace-save.js?v=30';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const storage=memory(),r=createResources({storage});
assert.equal(r.state.elements.H,0);assert.equal(r.makeHydrogen(1),false);
assert.equal(r.spend({N:1}),false,'An unlocked element is not free without BASE STOCK');r.refund({N:1});assert.equal(r.spend({N:1}),true);assert.equal(r.state.elements.N,0);
r.collect(20,25);r.learn('hydrogen');assert.equal(r.makeHydrogen(1),true);r.save();
assert.equal(r.state.elements.H,18);assert.equal(r.state.molecules.hydrogen,1);
const drive=createResources({storage:memory()});drive.learn('hydrogen');drive.state.molecules.hydrogen=3;assert.equal(drive.fillTank('hydrogen'),true);assert.equal(drive.consumeBoost(),true);assert.equal(drive.state.molecules.hydrogen,0);assert.equal(drive.state.tanks.hydrogen,2);
assert.equal(r.makeHydrogen(5),true);assert.equal(r.state.elements.H,8);assert.equal(r.makeHydrogen(5),false);
assert.equal(r.spend({H:9,C:1}),false);assert.equal(r.state.elements.H,8,'Rejected parts must not partially spend');
r.save();const reboot=createResources({storage});assert.equal(reboot.state.elements.H,8);assert.equal(reboot.state.molecules.hydrogen,6);assert.equal(reboot.state.progress.bestChain,25);
const other=createResources({storage});reboot.collect(2,26);reboot.save();other.collect(8,26);assert.equal(other.save(),false);assert.ok(other.blocked);assert.equal(createResources({storage}).state.elements.H,10);
for(const raw of ['{broken',JSON.stringify({...r.snapshot(),schemaVersion:99})]){const s=memory();s.setItem(RESOURCE_KEY,raw);const protectedSave=createResources({storage:s});assert.ok(protectedSave.blocked);protectedSave.collect(10,10);assert.equal(protectedSave.save(),false);assert.equal(s.getItem(RESOURCE_KEY),raw);}
const legacy={schemaVersion:1,atoms:[{element:'H',position:[0,0,0]}],bonds:[],camera:{position:[5,4,7],target:[0,0,0],up:[0,1,0]},selected:0,focus:0,pivot:null};
const old=memory();old.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(legacy));const migrated=createResources({storage:old});assert.deepEqual(migrated.state.workspace,legacy);migrated.collect(10,0);migrated.spend({H:1});migrated.workspaceAdapter.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({...legacy,atoms:[...legacy.atoms,{element:'H',position:[1,0,0]}]}));
const atomic=JSON.parse(old.getItem(RESOURCE_KEY));assert.equal(atomic.elements.H,9);assert.equal(atomic.workspace.atoms.length,2);assert.equal(old.getItem(WORKSPACE_STORAGE_KEY),JSON.stringify(legacy),'Legacy checkpoint retained');
const noSpace=createResources({storage:{getItem:()=>null,setItem:()=>{throw Error('Quota');}}});noSpace.collect(5,0);assert.equal(noSpace.save(),false);assert.match(noSpace.message,/保存できません/);
const m1=createMap(42),m2=createMap(42),m3=createMap(43);assert.deepEqual(m1,m2);assert.deepEqual(m1.routes,m3.routes);assert.notDeepEqual(m1.fields,m3.fields);
assert.ok(m1.routes.some(x=>x.id==='risk'));assert.ok(m1.routes.some(x=>x.id==='safe'));
for(const route of m1.routes)for(let i=1;i<route.points.length;i++)assert.ok(Math.hypot(route.points[i].x-route.points[i-1].x,route.points[i].y-route.points[i-1].y)<33);
const fly=createRun(createMap(1),VEIL,{predators:false});for(let i=0;i<180;i++)stepRun(fly,{x:0,y:-1},1/60);assert.ok(fly.collected>=3);assert.ok(fly.best>=10);assert.ok(fly.effects.length<=VEIL.maxEffects);
const chain=fly.chain;for(let i=0;i<120;i++)stepRun(fly,{x:0,y:0},1/60);assert.equal(fly.chain,0);assert.ok(chain>0);
// The gap is still a readable phrase break, but CHAIN/FLOW is feedback rather
// than the reason to spend emergency fuel.
function gap(){const points=[...sampleLine([[0,0],[0,-180]]),...sampleLine([[0,-640],[0,-1200]])];const map={dust:points.map((p,id)=>({...p,id,value:1,kind:'normal',ready:0})),fields:[]};const run=createRun(map,VEIL,{predators:false});run.player.x=0;run.player.y=0;run.player.speed=VEIL.speed;let cuts=0;for(let i=0;i<420;i++){for(const e of stepRun(run,{x:0,y:-1},1/60))if(e.type==='chainEnd'&&run.player.y>-700)cuts++;if(run.player.y<-750)break;}return cuts;}
assert.ok(gap()>0);
function gate(boost){const run=createRun(createMap(2),VEIL,{fuel:{hydrogen:1},predators:false});Object.assign(run.player,{x:VEIL.gate.x,y:VEIL.gate.y+130,angle:-Math.PI/2,speed:VEIL.speed});if(boost)beginBurst(run,()=>true);for(let i=0;i<120;i++)stepRun(run,{x:0,y:-1},1/60);return run;}
assert.equal(gate(false).gatePassed,false);assert.equal(gate(true).gatePassed,true);
// Follow authored route points with a human-like look-ahead, not teleportation.
function circuit(seed,risk=false){const run=createRun(createMap(seed),VEIL,{fuel:{hydrogen:1},predators:false}),routeIds=['entry',risk?'risk':'safe','detour','return'];let fuel=0;for(const id of routeIds){const route=run.map.routes.find(x=>x.id===id);let index=0,frames=0;while(index<route.points.length&&frames++<60*100){const p=run.player;while(index<route.points.length-1&&Math.hypot(route.points[index].x-p.x,route.points[index].y-p.y)<75)index++;const target=route.points[index],dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);if(index===route.points.length-1&&d<70)break;if(risk&&id==='risk'&&p.y<-1550&&p.y>-1750&&fuel===0){if(beginBurst(run,()=>true))fuel++;}stepRun(run,{x:dx/d,y:dy/d},1/60);if(run.lap)break;}assert.ok(frames<60*100,`${id} must not trap the player`);}assert.ok(run.lap,'Return loop should cross its start');return {seed,risk,seconds:Math.round(run.time),H:run.collected,best:run.best,fuel};}
const laps=[circuit(41),circuit(42,true),circuit(43)];for(const lap of laps){assert.ok(lap.seconds>=55&&lap.seconds<=180);assert.ok(lap.H>=80&&lap.H<=350);}
console.log('H Veil simulation:',JSON.stringify(laps));
console.log('Resources, atomic migration, corruption/conflict/quota, movement, FLOW feedback, authored map and physical BURST gate passed. Simulations do not establish subjective fun.');

const fpsRuns=[15,30,60].map(fps=>{const run=createRun(createMap(77),VEIL,{predators:false});for(let frame=0;frame<fps*5;frame++)stepRun(run,{x:0,y:-1},1/fps);return run;});
for(const run of fpsRuns){assert.ok(Math.abs(run.player.y-fpsRuns[2].player.y)<.1);assert.equal(run.collected,fpsRuns[2].collected);assert.equal(run.best,fpsRuns[2].best);}
console.log('15/30/60fps: matching path, resources and chain.');
