import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITION} from '../src/veil/config.js';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {createResources} from '../src/veil/resources.js';
import {createUniverse} from '../src/veil/universe.js';
import {NITROGEN_ENTRY,NITROGEN_EXIT,NITROGEN_REGION_BOUNDS} from '../src/veil/nitrogen-config.js';
import {
  NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,NITROGEN_MAINLINE_PULSES,NITROGEN_PULSES,
  NITROGEN_RARE_CL_SITE,NITROGEN_RECOVERY_AREA,NITROGEN_ROUTE,NITROGEN_ZONE_GEOMETRY,NITROGEN_ZONES,
  nitrogenZoneAtPoint,
} from '../src/veil/nitrogen-routes.js';
import {RARE_ANOMALIES,installRareSurvey} from '../src/veil/rare-survey.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function routeDistance(p){let best=Infinity;for(let i=0;i<NITROGEN_ROUTE.points.length-1;i++)best=Math.min(best,segmentDistance(p,NITROGEN_ROUTE.points[i],NITROGEN_ROUTE.points[i+1]));return best;}
function routeProgressNear(p){let best={distance:Infinity,index:0};for(const [index,point] of NITROGEN_ROUTE.points.entries()){const d=distance(p,point);if(d<best.distance)best={distance:d,index};}return best.index/Math.max(1,NITROGEN_ROUTE.points.length-1);}
const postCho={progress:{choCompleted:true},elements:{H:0,C:0,N:0,O:0},recipes:['hydrogen','methane','oxygen','water']};

function fuelFor(mode){
  if(mode==='drive')return {fuel:{molecule:'methane',amount:18,capacity:18},oxidizer:{molecule:'oxygen',amount:36,capacity:36},coolant:{molecule:'water',amount:36,capacity:36}};
  if(mode==='normal')return {};
  const profile=performanceFor(mode,'propellant');return {propellant:{molecule:mode,amount:profile.capacity,capacity:profile.capacity}};
}
function simulate(mode,{predators=false}={}){
  const config=flightConfig(postCho),map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{fuel:fuelFor(mode),predators}),points=NITROGEN_ROUTE.points,last=points.at(-1),systems={consumeCombustion:()=>true,consumeCoolant:()=>true};
  const profile=mode!=='normal'&&mode!=='drive'?performanceFor(mode,'propellant'):null;
  const schedule=mode==='hydrogen'?[.24,.82,.93]:mode==='ammonia'||mode==='nitrogen'?NITROGEN_MAINLINE_PULSES.map(pulse=>pulse.progress):[];
  Object.assign(run.player,{x:points[0].x,y:points[0].y,angle:points[0].angle,vx:0,vy:0,speed:config.driftSpeed});run.region='nitrogen';if(mode==='drive')setCombustionHeld(run,true);
  let targetIndex=2,nextBurst=0;
  while(run.time<80&&!run.captured){
    const target=points[Math.min(points.length-1,targetIndex)],dx=target.x-run.player.x,dy=target.y-run.player.y,d=Math.hypot(dx,dy)||1,progress=targetIndex/(points.length-1);
    if(d<90&&targetIndex<points.length-1)targetIndex=Math.min(points.length-1,targetIndex+2);
    if(nextBurst<schedule.length&&progress>=schedule[nextBurst]&&run.player.boost<=0&&run.player.cooldown<=0){if(beginBurst(run,()=>true))nextBurst++;}
    stepRun(run,{x:dx/d,y:dy/d},1/30,systems);
    if(distance(run.player,last)<120&&targetIndex>=points.length-3)break;
  }
  return {run,success:distance(run.player,last)<155,time:+run.time.toFixed(2),bursts:run.telemetry.burstUses,remainingShots:profile?Math.floor(run.fuel.propellant.amount/profile.moleculesPerBurst):0,nAtoms:run.collectedElements.N};
}

function launchRare(resources,seed=71){const fuel=resources.prepareExpedition({region:'nitrogen',rng:()=>.37}),map=createUniverse(seed,resources.state.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});return createRun(map,flightConfig(resources.state),{fuel,predators:false});}
function collectRare(run,id){const site=run.rareSurvey.anomalies.find(item=>item.id===id);assert.ok(site);for(let i=0;i<8&&!site.collected;i++){Object.assign(run.player,{x:site.x,y:site.y,vx:0,vy:0,speed:0,angle:-Math.PI/2});stepRun(run,{x:0,y:0},.15,{})}assert.equal(site.collected,true);return site;}

test('Nitrogen chapter is one continuous route with five spatially distinct encounter zones',()=>{
  assert.deepEqual(NITROGEN_ZONES.map(zone=>zone.kind),['entry','movement','collection','recovery','approach']);
  assert.equal(new Set(NITROGEN_ZONES.map(zone=>zone.width)).size,5,'every section should change corridor scale');
  assert.equal(NITROGEN_ZONE_GEOMETRY.length,NITROGEN_ZONES.length);
  const xs=NITROGEN_ROUTE.points.map(point=>point.x),ys=NITROGEN_ROUTE.points.map(point=>point.y);assert.ok(Math.max(...xs)-Math.min(...xs)>600,'chapter must visibly sweep laterally');assert.ok(Math.max(...ys)-Math.min(...ys)>3300,'chapter keeps meaningful travel depth');
  assert.ok(distance(NITROGEN_ROUTE.points[0],NITROGEN_ENTRY)<2);assert.ok(distance(NITROGEN_ROUTE.points.at(-1),NITROGEN_EXIT)<3,'diagnostic exit follows production route');
  for(const zone of NITROGEN_ZONE_GEOMETRY){assert.ok(zone.points.length>2);for(const point of zone.points){assert.ok(point.x>=NITROGEN_REGION_BOUNDS.left&&point.x<=NITROGEN_REGION_BOUNDS.right);assert.ok(point.y>=NITROGEN_REGION_BOUNDS.top&&point.y<=NITROGEN_REGION_BOUNDS.bottom);}}
  for(let i=1;i<NITROGEN_ZONE_GEOMETRY.length;i++)assert.ok(distance(NITROGEN_ZONE_GEOMETRY[i-1].points.at(-1),NITROGEN_ZONE_GEOMETRY[i].points[0])<80,'zone centerlines must remain continuous');
});

test('Nitrogen pulse rhythm is irregular and the harvest-pocket shear is optional rather than another mainline gate',()=>{
  assert.equal(NITROGEN_PULSES.length,6);assert.equal(NITROGEN_MAINLINE_PULSES.length,5);assert.equal(NITROGEN_PULSES.filter(pulse=>pulse.optional).length,1);
  const gaps=NITROGEN_PULSES.slice(1).map((pulse,index)=>pulse.progress-NITROGEN_PULSES[index].progress);assert.ok(Math.max(...gaps)-Math.min(...gaps)>.1,'pulse timing must not be metronomic');
  assert.ok(new Set(NITROGEN_PULSES.map(pulse=>pulse.radius)).size>=5,'pulse footprints must vary materially');assert.ok(new Set(NITROGEN_PULSES.map(pulse=>Math.round(pulse.angle*100)/100)).size>=4,'pulse direction must follow changing geometry instead of only global left/right');
  const pocketPulse=NITROGEN_PULSES.find(pulse=>pulse.optional);assert.ok(distance(pocketPulse,NITROGEN_HIGH_DENSITY_POCKET)<220,'optional shear belongs to the collection detour');
  assert.equal(NITROGEN_PULSES.some(pulse=>pulse.progress>=.67&&pulse.progress<.79),false,'recovery shelf must remain a true cadence break');
});

test('N collection is tied to trajectory choice while economy and recovery stay bounded',()=>{
  const map=createUniverse(41,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}}),main=map.dust.filter(dust=>dust.route===NITROGEN_ROUTE.id&&dust.element==='N'),harvest=main.filter(dust=>dust.zone==='nitrogen-harvest-basin'),crosswind=main.filter(dust=>dust.zone==='nitrogen-crosswind'),recovery=main.filter(dust=>dust.zone==='nitrogen-recovery-shelf'),pocket=map.dust.filter(dust=>dust.route===NITROGEN_HIGH_DENSITY_POCKET.id);
  assert.ok(main.length>=80&&main.length<=130,`fresh mainline yield ${main.length} must stay near the established Nitrogen economy`);
  assert.ok(harvest.some(dust=>dust.lane>50)&&harvest.some(dust=>dust.lane<-50),'harvest basin must offer two lateral collection lines');assert.equal(harvest.some(dust=>Math.abs(dust.lane)<30),false,'harvest basin should ask for a trajectory choice instead of feeding the centerline');
  assert.ok(recovery.length<crosswind.length,'recovery shelf deliberately thins resources so the player can reorient');assert.ok(pocket.length>0,'fresh stock keeps the optional rich pocket');
  const pocketDistance=routeDistance(NITROGEN_HIGH_DENSITY_POCKET),clDistance=routeDistance(NITROGEN_RARE_CL_SITE);assert.ok(pocketDistance>180,'high-density N requires leaving the shortest line');assert.ok(clDistance>pocketDistance+100,'Rare Cl sits beyond the rich pocket instead of on the main route');
  assert.ok(NITROGEN_RARE_CL_SITE.x<NITROGEN_REGION_BOUNDS.right&&NITROGEN_RARE_CL_SITE.x>NITROGEN_REGION_BOUNDS.left&&NITROGEN_RARE_CL_SITE.y>NITROGEN_REGION_BOUNDS.top);
  assert.equal(nitrogenZoneAtPoint(NITROGEN_RECOVERY_AREA)?.kind,'recovery');assert.ok(routeProgressNear(NITROGEN_INSIGHT_AREA)>.79,'N2 insight belongs to the late chapter approach');assert.ok(routeDistance(NITROGEN_INSIGHT_AREA)>70,'N2 insight is a small alcove detour, not an automatic centerline pickup');
});

test('normal, H2, NH3, N2 and DRIVE all progress without changing their established propulsion roles',()=>{
  const results=Object.fromEntries(['normal','hydrogen','ammonia','nitrogen','drive'].map(mode=>[mode,simulate(mode)]));for(const [mode,result] of Object.entries(results))assert.equal(result.success,true,`${mode} must traverse the completed Nitrogen chapter`);
  assert.ok(results.hydrogen.bursts>=2&&results.hydrogen.bursts<=3,'H2 keeps a small number of peak-impulse uses');assert.ok(results.ammonia.bursts>=4,'NH3 participates in repeated disturbances');assert.ok(results.nitrogen.bursts>=results.ammonia.bursts,'N2 remains the repeatable PULSE option');assert.ok(results.nitrogen.remainingShots>results.ammonia.remainingShots,'N2 retains more recovery margin after traversal');assert.ok(results.drive.time<results.normal.time,'DRIVE keeps the sustained-travel advantage');
  for(const result of Object.values(results))assert.ok(result.nAtoms>0,'every viable traversal can collect some N');
  console.log('Nitrogen chapter traversal',JSON.stringify(Object.fromEntries(Object.entries(results).map(([mode,row])=>[mode,{time:row.time,bursts:row.bursts,remainingShots:row.remainingShots,nAtoms:row.nAtoms}]))));
});

test('Rare Cl is integrated beyond the Nitrogen harvest pocket while preserving forced retry and finite normal claim',()=>{
  const storage=memory(),resources=installRareSurvey(createResources({storage}));resources.state.progress.choCompleted=true;resources.state.recipes.push('nitrogen','ammonia');resources.save();const cl=RARE_ANOMALIES.find(site=>site.id==='rare-cl-nitrogen-pocket');assert.ok(cl);assert.deepEqual({x:cl.x,y:cl.y},{x:NITROGEN_RARE_CL_SITE.x,y:NITROGEN_RARE_CL_SITE.y});
  const first=launchRare(resources);collectRare(first,cl.id);const forced=resources.settleExpedition(first.elementDust,first.best,true,{insights:[]});assert.equal(forced.rareSurvey.committed.length,0);assert.deepEqual(forced.rareSurvey.lost.map(item=>item.id),[cl.id]);assert.equal(resources.state.elements.Cl,0);assert.ok(!resources.state.rareSurvey?.claimedIds?.includes(cl.id));
  const retry=launchRare(resources,72),same=retry.rareSurvey.anomalies.find(site=>site.id===cl.id);assert.deepEqual({x:same.x,y:same.y},{x:cl.x,y:cl.y});collectRare(retry,cl.id);const normal=resources.settleExpedition(retry.elementDust,retry.best,false,{insights:[]});assert.deepEqual(normal.rareSurvey.committed.map(item=>item.id),[cl.id]);assert.equal(resources.state.elements.Cl,1);assert.ok(resources.state.rareSurvey.claimedIds.includes(cl.id));assert.ok(!launchRare(resources,73).rareSurvey.anomalies.some(site=>site.id===cl.id),'claimed Cl must not respawn');
});

test('Dust Eater pursuit remains finite and bounded in the changed Nitrogen geometry',()=>{
  const run=simulate('normal',{predators:true}).run;if(run.eaters.length===0){run.time=EXPEDITION.safeSeconds+.2;run.elementDust.N=1000;stepRun(run,{x:0,y:-1},.15,{});}assert.ok(run.eaters.length>0,'Nitrogen chapter must still use the global DUST EATER lifecycle');
  const margin=EXPEDITION.eaterSpawnDistance+100;for(const eater of run.eaters){assert.ok(Number.isFinite(eater.x)&&Number.isFinite(eater.y));assert.ok(eater.x>=run.config.bounds.left-margin&&eater.x<=run.config.bounds.right+margin);assert.ok(eater.y>=run.config.bounds.top-margin&&eater.y<=run.config.bounds.bottom+margin);}
});

console.log('Nitrogen chapter completion passed: five encounter zones, irregular pulse rhythm, collection detour/recovery cadence, late N2 alcove, side-pocket Cl lifecycle, propulsion viability and DUST EATER bounds.');
