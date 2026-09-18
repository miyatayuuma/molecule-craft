import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources} from '../src/veil/resources.js';
import {NITROGEN_ROUTE} from '../src/veil/nitrogen-routes.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const postCho={progress:{choCompleted:true},elements:{H:0,C:0,N:0,O:0},recipes:[]};
function nitrogenRun(){const config=flightConfig(postCho),map=createUniverse(73,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{predators:false});const start=NITROGEN_ROUTE.points[0];Object.assign(run.player,{x:start.x,y:start.y,angle:start.angle,vx:0,vy:0,speed:0});run.region='nitrogen';return run;}

test('Nitrogen FIELD keeps N primary while ambient H/C/O prevents a single-element particle belt',()=>{
  const run=nitrogenRun(),mainline=run.map.dust.filter(dust=>dust.route===NITROGEN_ROUTE.id),ambient=run.map.dust.filter(dust=>dust.ambient);
  assert.ok(mainline.length>0&&mainline.every(dust=>dust.element==='N'&&dust.kind==='nitrogen'));assert.ok(ambient.length>0);assert.ok(new Set(ambient.map(dust=>dust.element)).size>=2);assert.ok(mainline.length>ambient.length);
  const dust=mainline[0],beforeH=run.collectedElements.H,beforeN=run.collectedElements.N;Object.assign(run.player,{x:dust.x,y:dust.y,vx:0,vy:0,speed:0});const events=stepRun(run,{x:0,y:0},1/60),pickup=events.find(event=>event.type==='pickup');assert.ok(pickup);assert.equal(run.collectedElements.H,beforeH);assert.ok(run.collectedElements.N>beforeN);
});

test('H-only cargo in Nitrogen FIELD can never satisfy N2 Critical Insight pickup requirement',()=>{
  const resources=createResources({storage:memory()});resources.state.progress.choCompleted=true;const context={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,collectedElements:{H:99,C:0,N:0,O:0}};
  assert.equal(resources.signalClaimability('nitrogen',.11,.23,{runContext:context}).claimable,false);assert.equal(resources.signalClaimability('nitrogen',.11,.23,{runContext:{...context,collectedElements:{...context.collectedElements,N:1}}}).claimable,true);
});

test('FIELD renderer removes the legacy Nitrogen belt and uses environmental haze plus a Core landmark',async()=>{
  const source=await readFile(new URL('../src/veil/renderer.js',import.meta.url),'utf8');assert.match(source,/nitrogenVisuals/);assert.match(source,/nitrogenVisualEffectiveAt/,'visual hazard density must use the same effective intensity authority as gameplay');assert.match(source,/nitrogenCore/);assert.match(source,/if\(route\.nitrogen===true\)continue/);assert.doesNotMatch(source,/lineWidth=zone\.width\*\.78/);assert.doesNotMatch(source,/worldMultiplier=run\.map\.worldState/,'renderer must not duplicate world hazard multipliers');assert.match(source,/element==='N'\?'nitrogen'/);
});
