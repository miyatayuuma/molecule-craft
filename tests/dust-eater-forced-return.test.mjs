import assert from 'node:assert/strict';
import {EXPEDITION,VEIL} from '../src/veil/config.js';
import {beginBurst,beginShock,createRun,runInsightLossSnapshot,setCombustionHeld,stepRun,triggerInsight} from '../src/veil/expedition-run.js';
import {advanceForcedLossParticle,createLostCargoParticles,createLostInsightParticles,LOST_CARGO_PARTICLE_CAP,LOST_INSIGHT_PARTICLE_CAP,lostCargoParticleCounts} from '../src/veil/renderer.js';
import {createResources,expeditionLoss} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const emptyMap=()=>({seed:71,dust:[],fields:[],labels:[],routes:[]});
const fuel={
  propellant:{molecule:'hydrogen',amount:120,capacity:120},
  fuel:{molecule:'methane',amount:8,capacity:8},
  oxidizer:{molecule:'oxygen',amount:16,capacity:16},
  coolant:{molecule:null,amount:0,capacity:0},
  shock:{molecule:'nitromethane',amount:1,capacity:1},
};
const treatments={mechanical:.72,abrasive:.64,thermal:.58,electrical:.51};
const run=createRun(emptyMap(),VEIL,{fuel,predators:true,treatments});
Object.assign(run.player,{x:0,y:0,angle:0,vx:0,vy:0,speed:VEIL.driftSpeed});
run.eaters=[{id:7,x:EXPEDITION.eaterContactRadius*.42,y:0,angle:Math.PI,speed:EXPEDITION.eaterSpeed*.8,targetSpeed:EXPEDITION.eaterSpeed,vx:-12,vy:0,phase:.4,flank:0,lead:0,trail:[]}];
Object.assign(run.elementDust,{H:101,C:17,O:9,P:3});
Object.assign(run.collectedElements,{H:10,C:1,O:1,P:3});
run.carriedInsights.push('methane');
run.analysis={id:'water',elapsed:2,requiredDuration:5,progress:.4};

const captureEvents=stepRun(run,{x:1,y:0},1/60);
assert.equal(captureEvents.filter(event=>event.type==='capture').length,1,'Dust Eater contact enters capture exactly once');
assert.equal(run.captured,true);
assert.equal(run.forcedReturn?.eaterId,7);
assert.equal(run.forcedReturn?.presentationStarted,false);
const captureAt=run.captureAt,forcedState=run.forcedReturn,eaterAtCapture={x:run.eaters[0].x,y:run.eaters[0].y};
const playerAtCapture={x:run.player.x,y:run.player.y},cargoAtCapture={...run.elementDust},treatmentsAtCapture={...run.treatments};

run.map.dust.push(
  {id:901,x:run.player.x,y:run.player.y,value:20,kind:'normal',ready:0,angle:0,element:'H'},
  {id:902,x:run.player.x,y:run.player.y,value:1,kind:'rare',ready:0,angle:0,element:'P',rareEcology:true},
);
run.effects.push({x:5,y:5,startX:5,startY:5,life:0,duration:.4,kind:'normal',element:'H',rareEcology:false,side:1,trail:[{x:5,y:5}]});
let repeatedCaptures=0;
for(let i=0;i<18;i++)repeatedCaptures+=stepRun(run,{x:-1,y:1},1/60).filter(event=>event.type==='capture').length;
assert.equal(repeatedCaptures,0,'Sustained contact cannot re-enter forced return');
assert.equal(run.captureAt,captureAt,'Repeated collision cannot reset the capture timer');
assert.equal(run.forcedReturn,forcedState,'Repeated collision preserves the single forced-return state object');
assert.notDeepEqual({x:run.eaters[0].x,y:run.eaters[0].y},eaterAtCapture,'Dust Eater movement continues during presentation');
assert.deepEqual({x:run.player.x,y:run.player.y},playerAtCapture,'Ship movement stays locked during presentation');
assert.deepEqual(run.elementDust,cargoAtCapture,'Resource pickup is locked during presentation');
assert.deepEqual(run.treatments,treatmentsAtCapture,'Hazard treatments do not drain during presentation');
assert.ok(run.effects[0]?.life>0,'Existing cosmetic pickup effects continue during presentation');
assert.equal(run.map.dust[0].ready,0);
assert.equal(run.map.dust[1].ready,0);

const propellantBefore=run.fuel.propellant.amount,shockBefore=run.fuel.shock.amount;
assert.equal(beginBurst(run,()=>true),false,'PULSE/BURST is locked after capture');
assert.equal(beginShock(run,()=>true),false,'SHOCK is locked after capture');
assert.equal(setCombustionHeld(run,true),false,'DRIVE is locked after capture');
assert.equal(run.fuel.propellant.amount,propellantBefore);
assert.equal(run.fuel.shock.amount,shockBefore);
assert.equal(triggerInsight(run,'oxygen',{}),null,'Insight acquisition is locked after capture');
assert.deepEqual(runInsightLossSnapshot(run),['methane','water'],'Only run-local carried/pending Insight is snapshotted for loss');

const units={H:101,C:13,N:5,O:7,P:3,S:2,F:1,Cl:4},expectedLoss=expeditionLoss(units,EXPEDITION.captureLoss);
const resources=createResources({storage:memory()}),settled=resources.settleExpedition(units,0,true);
assert.ok(settled);
assert.equal(settled.rate,EXPEDITION.captureLoss,'Existing forced-return loss percentage remains the settlement authority');
assert.deepEqual(settled.lost,expectedLoss,'Presentation loss can use exactly the same loss calculation as settlement');
assert.deepEqual(expeditionLoss({},EXPEDITION.captureLoss),{H:0,C:0,O:0});

assert.deepEqual(lostCargoParticleCounts({H:3,C:1,O:2}),{H:3,C:1,O:2});
const compressed=lostCargoParticleCounts({H:100,C:50,O:25,P:10});
assert.equal(Object.values(compressed).reduce((sum,n)=>sum+n,0),LOST_CARGO_PARTICLE_CAP,'Large mixed cargo stays within the mobile particle cap');
const particles=createLostCargoParticles({H:100,C:50,O:25,P:10},{x:0,y:0},()=>.5);
assert.equal(particles.length,LOST_CARGO_PARTICLE_CAP);
assert.equal(createLostCargoParticles({H:0,C:0,O:0,P:0},{x:0,y:0}).length,0,'No cargo loss creates no fake resource particles');

const insightParticles=createLostInsightParticles(['methane','methane','water','oxygen','nitrogen','hydrogen'],{x:0,y:0},()=>.5);
assert.equal(insightParticles.length,LOST_INSIGHT_PARTICLE_CAP,'Insight visuals are representative and capped');
assert.ok(insightParticles.every(particle=>particle.icon==='💡'));
assert.equal(createLostInsightParticles([],{x:0,y:0}).length,0,'No Insight loss creates no fake lightbulb');

const attracted=createLostCargoParticles({H:1},{x:0,y:0},()=>.5)[0],target={x:120,y:35};
const startDistance=Math.hypot(attracted.x-target.x,attracted.y-target.y);
for(let i=0;i<30;i++){target.y+=.8;advanceForcedLossParticle(attracted,target,1/60,false);}
const endDistance=Math.hypot(attracted.x-target.x,attracted.y-target.y);
assert.ok(endDistance<startDistance*.45,`Loss particle must turn toward the moving Dust Eater (${startDistance} -> ${endDistance})`);
const reducedParticle=createLostInsightParticles(['methane'],{x:0,y:0},()=>.5)[0];
for(let i=0;i<18;i++)advanceForcedLossParticle(reducedParticle,{x:70,y:0},1/60,true);
assert.ok(reducedParticle.x>20,'Reduced motion keeps a short, readable attraction toward Dust Eater');

console.log('Dust Eater forced-return phase passed: single-entry capture, interaction/pickup/hazard locks, live Eater motion, shared loss authority, capped cargo/Insight visuals and target attraction.');
