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

function nitrogenRun(){
  const config=flightConfig(postCho),map=createUniverse(73,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}}),run=createRun(map,config,{predators:false});
  const start=NITROGEN_ROUTE.points[0];Object.assign(run.player,{x:start.x,y:start.y,angle:start.angle,vx:0,vy:0,speed:0});run.region='nitrogen';return run;
}

test('Nitrogen mainline is N-only and an N contact cannot masquerade as an H pickup in resource state',()=>{
  const run=nitrogenRun(),mainline=run.map.dust.filter(dust=>dust.route===NITROGEN_ROUTE.id);
  assert.ok(mainline.length>0,'Nitrogen mainline must contain collectible dust');
  assert.ok(mainline.every(dust=>dust.element==='N'&&dust.kind==='nitrogen'),'every Nitrogen mainline collectible must be canonical N dust');
  assert.equal(mainline.some(dust=>(dust.element??'H')==='H'),false,'Nitrogen mainline must not contain H dust');
  const dust=mainline[0],beforeH=run.collectedElements.H,beforeN=run.collectedElements.N;Object.assign(run.player,{x:dust.x,y:dust.y,vx:0,vy:0,speed:0});
  const events=stepRun(run,{x:0,y:0},1/60),pickup=events.find(event=>event.type==='pickup');
  assert.ok(pickup);assert.equal(run.collectedElements.H,beforeH,'N contact must not increase H');assert.ok(run.collectedElements.N>beforeN,'N contact must increase N');assert.equal(pickup.elements.H,0);assert.ok(pickup.elements.N>0);
});

test('H-only cargo in Nitrogen FIELD can never satisfy N2 Critical Insight pickup requirement',()=>{
  const resources=createResources({storage:memory()});resources.state.progress.choCompleted=true;
  const runContext={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,collectedElements:{H:99,C:0,N:0,O:0}};
  const blocked=resources.signalClaimability('nitrogen',.11,.23,{runContext});assert.equal(blocked.claimable,false);assert.equal(blocked.critical,true);
  const allowed=resources.signalClaimability('nitrogen',.11,.23,{runContext:{...runContext,collectedElements:{...runContext.collectedElements,N:1}}});assert.equal(allowed.claimable,true);assert.equal(allowed.recipe,'nitrogen');assert.equal(allowed.critical,true);
});

test('FIELD renderer gives N a dedicated visual branch instead of the H fallback',async()=>{
  const source=await readFile(new URL('../src/veil/renderer.js',import.meta.url),'utf8');
  assert.match(source,/nitrogen:'\d+,\d+,\d+'/,'renderer must define a dedicated Nitrogen glow sprite');
  assert.match(source,/element==='N'\?'nitrogen'/,'N dust must select the Nitrogen sprite explicitly');
  assert.match(source,/element==='N'\?'#(?:[0-9a-fA-F]{6})'/,'N dust must use a dedicated core color instead of H core color');
  assert.match(source,/e\.kind==='nitrogen'\?'#(?:[0-9a-fA-F]{6})'/,'N pickup trail must preserve the Nitrogen visual identity');
});
