import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';
import {createFlight,createRun,moveFlight,stepRun} from '../src/veil/engine.js';
import {createUniverse,environmentAt,OXYGEN_ENTRY_KNOTS} from '../src/veil/universe.js';
import {DRIVES,flightConfig} from '../src/veil/growth.js';
import {
  OXYGEN_HARVEST,OXYGEN_JUNCTION,OXYGEN_REWARD,OXYGEN_ROUTES,OXYGEN_VORTEX,OXYGEN_VORTEX_REWARD,
  oxygenPressureAt,oxygenRouteAt,oxygenRouteCenterAtY,oxygenVortexFlowAt,
} from '../src/veil/oxygen-routes.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const script=fileURLToPath(new URL('../scripts/export-field-map.mjs',import.meta.url));
const output=new URL('../docs/maps/current-field.svg',import.meta.url);
const requiredLayers=[
  'layer-grid','layer-regions','layer-geometry','playable-bounds','route-centerlines','route-widths','authored-gates',
  'layer-elements-h','layer-elements-c','layer-elements-o','layer-hazards-fields','layer-hazards-pressure',
  'layer-hazards-challenges','layer-hazards-vortex','layer-hazards-dust-eater','layer-thermal','layer-gameplay',
  'spawn','checkpoints','gates','junctions','rest-stops','rewards','signals','destination','layer-labels',
];

const run=(...args)=>spawnSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8'});

test('FIELD map exporter is deterministic and required layers are present',async()=>{
  const first=buildFieldMapSvg(),second=buildFieldMapSvg();
  assert.equal(first,second);
  for(const id of requiredLayers)assert.match(first,new RegExp(`id="${id}"`),id);
  assert.match(first,/data-left="-1100" data-right="1250" data-top="-12750" data-bottom="500"/);
  assert.match(first,/data-carbon-y="-4390" data-oxygen-y="-7830" data-frontier-y="-11680"/);
  assert.match(first,/element positions are deterministic baseline snapshot, not invariant authored positions/);
  assert.match(first,/environment heat != player thermal state/);
  assert.match(first,/id="h-boundary-current" data-gate="h-boundary" x="300" y="-3940" width="460" height="280"/);
  assert.match(first,/id="h-boundary-gate-marker"[^>]*cx="530" cy="-3800"/);
  assert.match(first,/id="cho-destination" data-radius="95" cx="280" cy="-12470" r="95"/);
  const committed=await readFile(output,'utf8');
  assert.equal(committed,first);
});

test('Oxygen Entry follows the expansion geometry and stays safe-biased through its middle',()=>{
  const entryKnots=[[170,-8090],[420,-8300],[420,-8500],[120,-8700]];
  const routeKnots=[[170,-7750],...entryKnots];
  assert.deepEqual(OXYGEN_ENTRY_KNOTS,entryKnots);
  const route=createUniverse(1,{H:0,C:0,O:0}).routes.find(candidate=>candidate.id==='oxygen-entry');
  assert.ok(route,'oxygen-entry route must exist');
  const distanceToRoute=([x,y])=>Math.min(...route.points.map(point=>Math.hypot(point.x-x,point.y-y)));
  for(const knot of routeKnots)assert.ok(distanceToRoute(knot)<12,`oxygen-entry must pass ${knot.join(',')}`);
  assert.deepEqual([OXYGEN_JUNCTION.x,OXYGEN_JUNCTION.y],entryKnots.at(-1));
  for(const networkRoute of OXYGEN_ROUTES)assert.deepEqual(networkRoute.knots[0],entryKnots.at(-1),`${networkRoute.id} must still start at the existing junction`);

  for(const point of [{x:420,y:-8300},{x:420,y:-8500}]){
    const vortex=oxygenVortexFlowAt({...point,vx:0,vy:0});
    assert.ok(vortex.radius>OXYGEN_VORTEX.influenceRadius,'entry middle must stay outside direct vortex influence');
    assert.ok(vortex.intensity<.02,'entry middle must not inherit strong vortex guidance');
    for(const time of [0,.6,1.2,1.8]){
      const environment=environmentAt(point,time);
      assert.ok(Math.abs(environment.pressure)<25,'entry middle pressure must remain low');
      assert.ok(Math.abs(environment.flowX)<50,'entry middle lateral flow must remain traversable');
      assert.ok(environment.heat<5,'entry middle must not become a thermal introduction');
    }
  }
  assert.deepEqual(OXYGEN_VORTEX_REWARD,{x:OXYGEN_VORTEX.center.x,y:OXYGEN_VORTEX.center.y,radius:72});
});

test('Oxygen Entry remains G1 while COMBUSTION DRIVE makes the travel materially faster',()=>{
  // The current pulse challenge still overlaps the junction by design. Skirt its
  // lower edge here so this test measures Entry traversability without pretending
  // that the later challenge-placement task has already happened.
  const waypoints=[
    ...OXYGEN_ENTRY_KNOTS.slice(1,-1).map(([x,y])=>({x,y})),
    {x:420,y:-8780},{x:120,y:-8780},{...OXYGEN_JUNCTION},
  ];
  const traverse=drive=>{
    const config=flightConfig(),player=createFlight(config),dt=1/60;
    Object.assign(player,{x:170,y:-8090,angle:-Math.PI/2,vx:0,vy:0});
    let index=0;
    for(let frame=0;frame<20/dt;frame++){
      const target=waypoints[index],dx=target.x-player.x,dy=target.y-player.y,distance=Math.hypot(dx,dy);
      if(distance<22){if(index===waypoints.length-1)return frame*dt;index++;continue;}
      player.combustion=drive;player.drive=drive?DRIVES.combustion:null;
      moveFlight(player,{x:dx/distance,y:dy/distance},dt,{config,environment:environmentAt(player,frame*dt)});
    }
    return Infinity;
  };
  const normal=traverse(false),combustion=traverse(true);
  assert.ok(Number.isFinite(normal)&&normal<12,'normal thrust must be able to reach the junction without a capability gate');
  assert.ok(combustion<normal*.7,`COMBUSTION DRIVE should be materially faster (${combustion.toFixed(2)}s vs ${normal.toFixed(2)}s)`);
});

test('Oxygen Network uses the locked three-route geometry and curved membership',()=>{
  const routes=Object.fromEntries(OXYGEN_ROUTES.map(route=>[route.id,route]));
  assert.deepEqual(routes['oxygen-shortcut'].knots,[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]]);
  assert.deepEqual(routes['oxygen-main'].knots,[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]]);
  assert.deepEqual(routes['oxygen-side'].knots,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
  for(const route of Object.values(routes)){
    assert.deepEqual(route.knots[0],[120,-8700]);
    assert.deepEqual(route.knots.at(-1),[120,-10670]);
    assert.equal(route.width,230);
  }
  assert.deepEqual([routes['oxygen-shortcut'].lanes,routes['oxygen-shortcut'].value],[1,2]);
  assert.deepEqual([routes['oxygen-main'].lanes,routes['oxygen-main'].value],[2,2]);
  assert.deepEqual([routes['oxygen-side'].lanes,routes['oxygen-side'].value],[4,3]);

  const samples=[
    ['oxygen-shortcut',-9700,-320],
    ['oxygen-main',-9000,255],
    ['oxygen-side',-9700,816.2962962962963],
    ['oxygen-shortcut',-10450,-182.5],
    ['oxygen-main',-10450,179.23076923076923],
    ['oxygen-side',-10450,621.875],
  ];
  for(const [id,y,x] of samples){
    const route=routes[id];
    assert.ok(Math.abs(oxygenRouteCenterAtY(route,y)-x)<1e-9,`${id} center at ${y}`);
    assert.equal(oxygenRouteAt({x,y})?.id,id,`${id} membership at ${x},${y}`);
  }
  assert.ok(Math.abs(samples[1][2]-routes['oxygen-main'].x)>routes['oxygen-main'].width/2,'DRIVE sample must fail the old fixed route.x test');
  assert.ok(Math.abs(samples[5][2]-routes['oxygen-side'].x)>routes['oxygen-side'].width/2,'THERMAL sample must fail the old fixed route.x test');
});

test('Oxygen Network pressure roles separate BURST, DRIVE and low-pressure routes',()=>{
  const routes=Object.fromEntries(OXYGEN_ROUTES.map(route=>[route.id,route]));
  const burst=routes['oxygen-shortcut'],drive=routes['oxygen-main'],thermal=routes['oxygen-side'];
  assert.deepEqual(burst.gates,[{y:-9700,depth:94,pressure:600}]);
  assert.equal(burst.pressure,0);
  assert.equal(oxygenPressureAt({x:-320,y:-9400}),0,'BURST route outside the chokepoint stays quiet');
  assert.equal(oxygenPressureAt({x:-320,y:-9700}),600,'BURST chokepoint keeps the existing strong pressure');
  assert.equal(oxygenPressureAt({x:-320,y:-9650}),0,'BURST gate remains localized');

  assert.equal(drive.pressure,370);
  assert.deepEqual(drive.restStops,[{x:300,y:-9750,depth:180}]);
  assert.equal(oxygenPressureAt({x:255,y:-9000}),370,'DRIVE route has sustained moderate resistance');
  assert.equal(oxygenPressureAt({x:300,y:-9750}),0,'DRIVE recovery cuts route pressure');
  assert.equal(oxygenPressureAt({x:301,y:-9900}),370,'DRIVE pressure resumes after recovery');

  assert.equal(thermal.pressure,0);
  assert.deepEqual(thermal.gates,[],'THERMAL-oriented route has no legacy four-gate pressure pattern');
  assert.equal(oxygenPressureAt({x:816,y:-9700}),0,'THERMAL-oriented route is low pressure');
  for(const route of [burst,drive,thermal]){
    assert.equal(route.requiredCapability,undefined,'no route becomes a hard capability gate');
    assert.equal(route.requires,undefined,'no capability requirement is introduced');
  }
});

test('Oxygen Network route pressure stays traversable and propulsion keeps a material advantage',()=>{
  const traverse=({x,y,targetY,burst=false,drive=false,maxSeconds=6})=>{
    const config=flightConfig(),fuel=drive?{fuel:{molecule:'methane',amount:18,capacity:18},oxidizer:{molecule:'oxygen',amount:36,capacity:36}}:{},run=createRun(createUniverse(1,{H:0,C:0,O:0}),config,{fuel,predators:false});
    Object.assign(run.player,{x,y,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});run.region='oxygen';
    if(burst){run.player.drive=DRIVES.hydrogen;run.player.boost=DRIVES.hydrogen.boostSeconds;}
    if(drive)run.driveHeld=true;
    const systems=drive?{consumeCombustion:()=>true}:{},dt=1/60;
    for(let frame=0;frame<maxSeconds/dt;frame++){
      stepRun(run,{x:0,y:-1},dt,systems);
      if(run.player.y<=targetY)return run.time;
    }
    return Infinity;
  };
  const shortcutNormal=traverse({x:-320,y:-9600,targetY:-9800,maxSeconds:4}),shortcutBurst=traverse({x:-320,y:-9600,targetY:-9800,burst:true,maxSeconds:4});
  assert.ok(Number.isFinite(shortcutNormal),'normal thrust must cross the localized BURST chokepoint');
  assert.ok(shortcutBurst<shortcutNormal*.7,`BURST must materially ease the chokepoint (${shortcutBurst.toFixed(2)}s vs ${shortcutNormal.toFixed(2)}s)`);
  const mainNormal=traverse({x:300,y:-9000,targetY:-9400}),mainDrive=traverse({x:300,y:-9000,targetY:-9400,drive:true});
  assert.ok(Number.isFinite(mainNormal),'normal thrust must traverse sustained DRIVE-route pressure');
  assert.ok(mainDrive<mainNormal*.6,`COMBUSTION DRIVE must materially improve sustained traversal (${mainDrive.toFixed(2)}s vs ${mainNormal.toFixed(2)}s)`);
});

test('Oxygen main recovery moves the existing harvest pocket without changing its amount or value',()=>{
  const universe=createUniverse(1,{H:0,C:0,O:0}),rest=universe.dust.filter(dust=>dust.route==='oxygen-rest-harvest');
  assert.equal(rest.length,OXYGEN_HARVEST.eddyAtoms);
  assert.equal(rest.length,180);
  assert.ok(rest.every(dust=>dust.value===3));
  assert.ok(rest.every(dust=>Math.hypot(dust.x-300,dust.y+9750)<=56),'rest harvest follows the new recovery center');
  assert.ok(rest.every(dust=>Math.hypot(dust.x-120,dust.y+9700)>100),'rest harvest no longer uses the old hardcoded center');
  assert.deepEqual(OXYGEN_REWARD,{x:120,y:-10720,radius:95},'network merge reward stays unchanged');
  const depth=universe.routes.find(route=>route.id==='oxygen-depth'),distanceToDepth=([x,y])=>Math.min(...depth.points.map(point=>Math.hypot(point.x-x,point.y-y)));
  assert.ok(distanceToDepth([120,-10670])<20,'Deep Oxygen start stays at the network merge');
  assert.ok(distanceToDepth([100,-11830])<20,'Deep Oxygen exit stays unchanged');
});

test('FIELD map renders curved route widths, the single BURST gate and DRIVE recovery from production data',()=>{
  const svg=buildFieldMapSvg();
  assert.match(svg,/data-route-width="oxygen-shortcut" d="M 120 -8700 L -320 -9000 L -320 -10350 L 120 -10670" stroke-width="230"/);
  assert.match(svg,/data-route-width="oxygen-main" d="M 120 -8700 L 300 -9100 L 350 -9600 L 260 -10150 L 120 -10670" stroke-width="230"/);
  assert.match(svg,/data-route-width="oxygen-side" d="M 120 -8700 L 780 -9000 L 850 -10350 L 120 -10670" stroke-width="230"/);
  assert.match(svg,/data-pressure-gate="oxygen-shortcut:0" data-pressure="600" x="-435" y="-9747" width="230" height="94"/);
  assert.doesNotMatch(svg,/data-pressure-gate="oxygen-side:/);
  assert.match(svg,/data-rest-stop="oxygen-main" x="185" y="-9840" width="230" height="180"/);
});

test('DUST EATER and RETURN remain dynamic/global instead of authored points',()=>{
  const svg=buildFieldMapSvg();
  const eaterLayer=svg.match(/<g id="layer-hazards-dust-eater"[\s\S]*?<\/g>/)?.[0]??'';
  assert.match(eaterLayer,/dynamic pursuit hazard \/ no authored map position/);
  assert.doesNotMatch(eaterLayer,/<(?:circle|rect|path|line|polyline|polygon)\b/);
  assert.match(svg,/RETURN: global player action \/ no fixed world position/);
  assert.doesNotMatch(svg,/id="return-(?:point|marker|destination)"/);
});

test('exporter CLI writes successfully and --check accepts the committed SVG',()=>{
  const write=run();
  assert.equal(write.status,0,write.stderr||write.stdout);
  assert.match(write.stdout,/Wrote docs\/maps\/current-field\.svg/);
  const check=run('--check');
  assert.equal(check.status,0,check.stderr||check.stdout);
  assert.match(check.stdout,/FIELD map is current/);
});
