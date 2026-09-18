import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITION} from '../src/veil/config.js';
import {createRun,stepRun} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources} from '../src/veil/resources.js';
import {createUniverse} from '../src/veil/universe.js';
import {NITROGEN_REGION_BOUNDS} from '../src/veil/nitrogen-config.js';
import {
  NITROGEN_CORE,NITROGEN_HAZARDS,NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,NITROGEN_PULSES,
  NITROGEN_RARE_CL_SITE,NITROGEN_RECOVERY_AREAS,NITROGEN_ROUTE,NITROGEN_ZONES,
  nitrogenHazardSpatialAt,nitrogenZoneAtPoint,
} from '../src/veil/nitrogen-routes.js';
import {RARE_ANOMALIES,installRareSurvey} from '../src/veil/rare-survey.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function routeDistance(p){let best=Infinity;for(let i=0;i<NITROGEN_ROUTE.points.length-1;i++)best=Math.min(best,segmentDistance(p,NITROGEN_ROUTE.points[i],NITROGEN_ROUTE.points[i+1]));return best;}
function routeProgressNear(p){let best={distance:Infinity,index:0};for(const [index,point] of NITROGEN_ROUTE.points.entries()){const d=distance(p,point);if(d<best.distance)best={distance:d,index};}return best.index/Math.max(1,NITROGEN_ROUTE.points.length-1);}
const postCho={progress:{choCompleted:true},elements:{H:0,C:0,N:0,O:0},recipes:['hydrogen','methane','oxygen','water']};

test('Nitrogen v2 is a long open chapter with readable broad phases instead of the legacy narrow corridor',()=>{
  assert.deepEqual(NITROGEN_ZONES.map(zone=>zone.kind),['entry','mid','critical','deep','core']);
  assert.ok(NITROGEN_ZONES.every(zone=>zone.width>=700),'all v2 phases stay broad enough to choose lines through hazards');
  const length=NITROGEN_ROUTE.points.slice(1).reduce((sum,point,index)=>sum+distance(point,NITROGEN_ROUTE.points[index]),0);
  assert.ok(length>7000,`Nitrogen v2 must remain long-form; got ${Math.round(length)}`);
  const xs=NITROGEN_ROUTE.points.map(point=>point.x),ys=NITROGEN_ROUTE.points.map(point=>point.y);
  assert.ok(Math.max(...xs)-Math.min(...xs)>500,'route should drift laterally without becoming a maze');
  assert.ok(Math.max(...ys)-Math.min(...ys)>7000,'Deep Nitrogen must materially extend travel depth');
  for(const point of NITROGEN_ROUTE.points){assert.ok(point.x>=NITROGEN_REGION_BOUNDS.left&&point.x<=NITROGEN_REGION_BOUNDS.right);assert.ok(point.y>=NITROGEN_REGION_BOUNDS.top&&point.y<=NITROGEN_REGION_BOUNDS.bottom);}
  assert.ok(routeProgressNear(NITROGEN_INSIGHT_AREA)>.42&&routeProgressNear(NITROGEN_INSIGHT_AREA)<.58,'N2 Critical Insight remains a natural mid-field side pocket');
  assert.ok(routeProgressNear(NITROGEN_CORE)>.9,'Core stays at the deepest environmental escalation');
});

test('hazard composition, recovery and resources replace the old pulse-belt grammar without hard route fills',()=>{
  const types=new Set(NITROGEN_HAZARDS.map(item=>item.type)),subtypes=new Set(NITROGEN_HAZARDS.map(item=>item.subtype));
  assert.ok(types.has('mechanical')&&types.has('thermal'));for(const subtype of ['pressure','shear','turbulence'])assert.ok(subtypes.has(subtype));
  assert.ok(NITROGEN_PULSES.length>=6&&NITROGEN_PULSES.every(item=>item.type==='mechanical'),'legacy pulse-facing export now represents mechanical environment events only');
  assert.ok(NITROGEN_RECOVERY_AREAS.length>=2);for(const area of NITROGEN_RECOVERY_AREAS)assert.ok(nitrogenZoneAtPoint(area),'recovery remains embedded in the traversable environment');
  assert.ok(routeDistance(NITROGEN_HIGH_DENSITY_POCKET)>140,'high-density N is a deliberate side-line choice');
  assert.ok(routeDistance(NITROGEN_INSIGHT_AREA)>100,'N2 Critical Insight is not an automatic centerline pickup');
  for(const item of NITROGEN_HAZARDS){const center=nitrogenHazardSpatialAt(item,{x:item.x,y:item.y},41),edge=nitrogenHazardSpatialAt(item,{x:item.x+item.radius*.9,y:item.y},41);assert.ok(center>edge&&edge>=0,'hazard strength must fade spatially rather than switch at a hard boundary');}
  const map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});
  assert.equal(map.fields.some(field=>field.kind==='nitrogen-pulse'),false,'Nitrogen v2 must not recreate legacy trigger-volume pulses in map.fields');
  const n=map.dust.filter(dust=>dust.element==='N'),ambient=map.dust.filter(dust=>dust.route?.startsWith('nitrogen-ambient-'));
  assert.ok(n.length>=80&&n.length<=220);assert.ok(ambient.some(dust=>dust.element!=='N'),'Nitrogen remains primary without becoming an artificial N-only particle belt');
});

test('Rare Survey compatibility remains deterministic beyond the Nitrogen resource line',()=>{
  const storage=memory(),resources=installRareSurvey(createResources({storage}));resources.state.progress.choCompleted=true;resources.state.recipes.push('nitrogen','ammonia');resources.save();
  const cl=RARE_ANOMALIES.find(site=>site.id==='rare-cl-nitrogen-pocket');assert.ok(cl);assert.deepEqual({x:cl.x,y:cl.y},{x:NITROGEN_RARE_CL_SITE.x,y:NITROGEN_RARE_CL_SITE.y});
  const launch=seed=>{const fuel=resources.prepareExpedition({region:'nitrogen',rng:()=>.37}),map=createUniverse(seed,resources.state.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});return createRun(map,flightConfig(resources.state),{fuel,predators:false});};
  const collect=(run,id)=>{const site=run.rareSurvey.anomalies.find(item=>item.id===id);assert.ok(site);for(let i=0;i<8&&!site.collected;i++){Object.assign(run.player,{x:site.x,y:site.y,vx:0,vy:0,speed:0,angle:-Math.PI/2});stepRun(run,{x:0,y:0},.15,{})}assert.equal(site.collected,true);};
  const first=launch(71);collect(first,cl.id);const forced=resources.settleExpedition(first.elementDust,first.best,true,{insights:[]});assert.equal(forced.rareSurvey.committed.length,0);assert.deepEqual(forced.rareSurvey.lost.map(item=>item.id),[cl.id]);assert.equal(resources.state.elements.Cl,0);
  const retry=launch(72),same=retry.rareSurvey.anomalies.find(site=>site.id===cl.id);assert.deepEqual({x:same.x,y:same.y},{x:cl.x,y:cl.y});collect(retry,cl.id);const normal=resources.settleExpedition(retry.elementDust,retry.best,false,{insights:[]});assert.deepEqual(normal.rareSurvey.committed.map(item=>item.id),[cl.id]);assert.equal(resources.state.elements.Cl,1);
});

test('Dust Eater remains the global agent lifecycle and stays bounded in expanded Nitrogen space',()=>{
  const config=flightConfig(postCho),map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{predators:true}),start=NITROGEN_ROUTE.points[0];Object.assign(run.player,{x:start.x,y:start.y,vx:0,vy:0,angle:start.angle});
  run.time=EXPEDITION.safeSeconds+.2;run.elementDust.N=1000;stepRun(run,{x:0,y:-1},.15,{});
  assert.ok(run.eaters.length>0,'Nitrogen must continue using the global DUST EATER lifecycle');
  const margin=EXPEDITION.eaterSpawnDistance+100;for(const eater of run.eaters){assert.ok(Number.isFinite(eater.x)&&Number.isFinite(eater.y));assert.ok(eater.x>=run.config.bounds.left-margin&&eater.x<=run.config.bounds.right+margin);assert.ok(eater.y>=run.config.bounds.top-margin&&eater.y<=run.config.bounds.bottom+margin);}
});

console.log('Nitrogen chapter completion passed: long open v2 geometry, hazard-composition difficulty, natural N2/resource side choices, Rare Survey compatibility and bounded DUST EATER lifecycle.');
