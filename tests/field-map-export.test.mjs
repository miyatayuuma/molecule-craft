import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';
import {createFlight,moveFlight} from '../src/veil/engine.js';
import {createUniverse,environmentAt,OXYGEN_ENTRY_KNOTS} from '../src/veil/universe.js';
import {DRIVES,flightConfig} from '../src/veil/growth.js';
import {OXYGEN_JUNCTION,OXYGEN_ROUTES,OXYGEN_VORTEX,OXYGEN_VORTEX_REWARD,oxygenVortexFlowAt} from '../src/veil/oxygen-routes.js';

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
