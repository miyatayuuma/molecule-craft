import assert from 'node:assert/strict';
import {EXPEDITION_CHALLENGES,challengeCenter,challengeWidthAt,recordChallengePassage} from '../src/veil/expedition-challenges.js';
import {createUniverse,environmentAt,FIELD_SIGNALS,animateUniverse} from '../src/veil/universe.js';
import {DEEP_OXYGEN_ROUTES,OXYGEN_ROUTES,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';

const byId=(items,id)=>items.find(item=>item.id===id);
const routeLength=route=>route.knots.slice(1).reduce((sum,[x,y],index)=>{
  const [px,py]=route.knots[index];return sum+Math.hypot(x-px,y-py);
},0);

const pulse=byId(EXPEDITION_CHALLENGES,'pulse'),curve=byId(EXPEDITION_CHALLENGES,'curve'),thermal=byId(EXPEDITION_CHALLENGES,'thermal');
assert.deepEqual({x:pulse.centerX,y:pulse.centerY,bottom:pulse.bottom,top:pulse.top,width:pulse.width},{x:-320,y:-9650,bottom:-9450,top:-9850,width:220});
assert.deepEqual({x:curve.centerX,y:curve.centerY,bottom:curve.bottom,top:curve.top,width:curve.width},{x:100,y:-11450,bottom:-11200,top:-11700,width:240});
assert.deepEqual({x:thermal.centerX,y:thermal.centerY,bottom:thermal.bottom,top:thermal.top,width:thermal.width},{x:760,y:-11300,bottom:-11160,top:-11440,width:260});
assert.deepEqual(pulse.rewards,['dimethyl-ether','ethene','propene']);
assert.deepEqual(curve.rewards,['propane','phenol','formaldehyde']);
assert.deepEqual(thermal.rewards,['ethylene-glycol','n-hexane']);

const network=Object.fromEntries(OXYGEN_ROUTES.map(route=>[route.id,route]));
const deep=Object.fromEntries(DEEP_OXYGEN_ROUTES.map(route=>[route.id,route]));
const overlap=(zone,route)=>Math.abs((oxygenRouteCenterAtY(route,zone.centerY)??Infinity)-challengeCenter(zone,zone.centerY))<zone.width+route.width/2;
assert.ok(overlap(pulse,network['oxygen-shortcut']),'pulse must overlap BURST route');
assert.ok(overlap(curve,deep['oxygen-deep-skill']),'curve must overlap Deep Skill');
assert.ok(overlap(thermal,deep['oxygen-deep-thermal']),'thermal must overlap Deep Thermal');
assert.equal(overlap(pulse,network['oxygen-main']),false);
assert.equal(overlap(pulse,network['oxygen-side']),false);
assert.equal(overlap(curve,deep['oxygen-deep-safe']),false);
assert.equal(overlap(curve,deep['oxygen-deep-thermal']),false);
assert.equal(overlap(thermal,deep['oxygen-deep-safe']),false);
assert.equal(overlap(thermal,deep['oxygen-deep-skill']),false);
assert.equal(challengeWidthAt(curve,curve.centerY),curve.width,'curve keeps its nominal width through the authored center');
assert.equal(challengeWidthAt(curve,curve.top),100,'curve tapers before the shared Frontier merge');
for(let y=curve.bottom;y>=curve.top;y-=25){
  for(const route of [deep['oxygen-deep-safe'],deep['oxygen-deep-thermal']]){
    const routeX=oxygenRouteCenterAtY(route,y);if(routeX===null)continue;
    const clearance=Math.abs(routeX-challengeCenter(curve,y))-challengeWidthAt(curve,y)-route.width/2;
    assert.ok(clearance>0,`curve field must not overlap ${route.id} corridor at y=${y} (clearance ${clearance})`);
  }
}

function passage(zone,route){
  const run={map:{universe:true},player:{x:0,y:zone.bottom+10},events:[]};
  let y=zone.bottom+10;
  while(y>zone.top-10){
    const old={x:run.player.x,y},next=Math.max(zone.top-10,y-25);y=next;
    run.player.x=oxygenRouteCenterAtY(route,y)??route.x;run.player.y=y;
    recordChallengePassage(run,old);
  }
  return run;
}
for(const [zone,route] of [[pulse,network['oxygen-shortcut']],[curve,deep['oxygen-deep-skill']],[thermal,deep['oxygen-deep-thermal']]]){
  const run=passage(zone,route);
  assert.deepEqual(run.events,[{type:'inspiration',rewards:zone.rewards}],`${zone.id} correct-route completion`);
  assert.equal(run.challengeProgress[zone.id]?.complete,true);
}
for(const [zone,route] of [[pulse,network['oxygen-main']],[curve,deep['oxygen-deep-safe']],[thermal,deep['oxygen-deep-skill']]]){
  const run=passage(zone,route);
  assert.equal(run.events.some(event=>event.type==='inspiration'&&event.rewards===zone.rewards),false,`${zone.id} adjacent route must not complete`);
}

const gate=environmentAt({x:-320,y:-9700},.6);
assert.equal(gate.traversableRoutePressure,600,'route-owned pressure stays in the traversable current channel');
assert.equal(gate.pressure,600,'pulse overlay must not weaken or add to the 600 pressure gate');
const pulseOnly=environmentAt({x:-320,y:-9500},.6);
assert.ok(pulseOnly.pressure>0&&pulseOnly.pressure<=410,'pulse periphery retains dynamic challenge pressure');

assert.deepEqual(FIELD_SIGNALS.map(({id,region,complexity,x,y})=>({id,region,complexity,x,y})),[
  {id:'veil',region:'veil',complexity:undefined,x:390,y:-650},
  {id:'carbon',region:'carbon',complexity:undefined,x:840,y:-5660},
  {id:'oxygen-network',region:'oxygen',complexity:'route-choice',x:520,y:-9250},
  {id:'oxygen-deep',region:'oxygen',complexity:'deep',x:-280,y:-11100},
  {id:'oxygen-frontier',region:'frontier',complexity:'frontier',x:100,y:-11620},
]);
assert.equal(FIELD_SIGNALS.some(signal=>signal.x===-610&&signal.y===-8290),false,'legacy single Oxygen signal is removed');
const universe=createUniverse(17,{H:0,C:0,O:0}),same=createUniverse(17,{H:0,C:0,O:0});
assert.deepEqual(universe.signals,same.signals,'signal placement is deterministic for one seed');
assert.equal(universe.signals.length,5);
for(const signal of universe.signals){
  assert.ok(Math.abs(signal.x-signal.anchorX)<=30&&Math.abs(signal.y-signal.anchorY)<=30,`${signal.id} jitter stays near authored anchor`);
}
for(const id of ['veil','carbon','oxygen-network','oxygen-deep','oxygen-frontier'])assert.ok(byId(universe.signals,id),`${id} signal exists`);
{
  const signal=byId(universe.signals,'oxygen-deep'),run={map:universe,time:0,player:{x:signal.x,y:signal.y,boost:0,combustion:false},config:{suctionRadius:80},events:[]};
  animateUniverse(run);const first=[...run.events];animateUniverse(run);
  assert.equal(first.length,1);assert.deepEqual(first[0],{type:'signal',region:'oxygen',roll:signal.roll,choice:signal.choice});
  assert.equal(run.events.length,1,'signal fires once');
}

assert.deepEqual([network['oxygen-shortcut'].lanes,network['oxygen-shortcut'].value],[1,2]);
assert.deepEqual([network['oxygen-main'].lanes,network['oxygen-main'].value],[2,2]);
assert.deepEqual([network['oxygen-side'].lanes,network['oxygen-side'].value],[4,3]);
assert.deepEqual([deep['oxygen-deep-safe'].spacing,deep['oxygen-deep-safe'].lanes,deep['oxygen-deep-safe'].value],[44,2,2]);
assert.deepEqual([deep['oxygen-deep-skill'].spacing,deep['oxygen-deep-skill'].lanes,deep['oxygen-deep-skill'].value],[32,2,2]);
assert.deepEqual([deep['oxygen-deep-thermal'].spacing,deep['oxygen-deep-thermal'].lanes,deep['oxygen-deep-thermal'].value],[36,3,3]);
const baseline=createUniverse(1,{H:0,C:0,O:0}),metrics={};
for(const route of DEEP_OXYGEN_ROUTES){
  const dust=baseline.dust.filter(item=>item.route===route.id),total=dust.reduce((sum,item)=>sum+item.value,0),length=routeLength(route);
  metrics[route.id]={count:dust.length,total,per1000:total/length*1000,elements:new Set(dust.map(item=>item.element))};
  assert.deepEqual([...metrics[route.id].elements].sort(),['C','H','O'],`${route.id} keeps mixed H/C/O`);
}
assert.ok(metrics['oxygen-deep-safe'].per1000<metrics['oxygen-deep-skill'].per1000,'Safe < Skill normalized reward');
assert.ok(metrics['oxygen-deep-skill'].per1000<metrics['oxygen-deep-thermal'].per1000,'Skill < Thermal normalized reward');
assert.ok(metrics['oxygen-deep-thermal'].total>metrics['oxygen-deep-safe'].total,'Thermal total value is highest');
const aggregate=Object.values(metrics).reduce((sum,metric)=>sum+metric.total,0);
assert.ok(aggregate<=840,`Deep aggregate ${aggregate} stays near the 1.75x economy ceiling`);
const depleted=createUniverse(1,{H:100000,C:100000,O:100000});
for(const route of DEEP_OXYGEN_ROUTES){
  assert.deepEqual(depleted.routes.find(item=>item.id===route.id)?.points,baseline.routes.find(item=>item.id===route.id)?.points,`${route.id} geometry is depletion-stable`);
}
assert.deepEqual(depleted.signals.map(({id,x,y,anchorX,anchorY})=>({id,x,y,anchorX,anchorY})),baseline.signals.map(({id,x,y,anchorX,anchorY})=>({id,x,y,anchorX,anchorY})),'signal landmarks are depletion-stable');

const svg=buildFieldMapSvg();
for(const zone of EXPEDITION_CHALLENGES)assert.match(svg,new RegExp(`data-challenge="${zone.id}" data-anchor-x="${zone.centerX}" data-anchor-y="${zone.centerY}"`));
for(const signal of FIELD_SIGNALS)assert.match(svg,new RegExp(`data-signal="${signal.id}"[^>]*data-anchor-x="${signal.x}" data-anchor-y="${signal.y}"`));
assert.match(svg,/data-density-route="oxygen-deep-safe" data-density-tier="medium" data-spacing="44" data-lanes="2" data-value="2"/);
assert.match(svg,/data-density-route="oxygen-deep-skill" data-density-tier="medium-high" data-spacing="32" data-lanes="2" data-value="2"/);
assert.match(svg,/data-density-route="oxygen-deep-thermal" data-density-tier="high-very-high" data-spacing="36" data-lanes="3" data-value="3"/);

console.log('Oxygen FIELD integration passed: challenge alignment/completion, max pressure composition, authored signals, deterministic lifecycle and normalized Deep rewards.');
