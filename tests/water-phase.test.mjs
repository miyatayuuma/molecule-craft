import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSample,boiling,createSample,saturation} from '../src/water-phase.js';
import {createGas,advanceGas} from '../src/water-gas.js';

import {readFileSync} from 'node:fs';
const water=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url))).find(m=>m.id==='water');

test('Steam table checkpoints and fixed-load cooling',()=>{
  for(const [atm,t] of [[.5,81.65],[1,99.97],[3,134.03]])assert.ok(Math.abs(boiling(atm)-t)<.25);
  assert.ok(Math.abs(saturation(90)-.6926)<.001);
  const sample=createGas(water), particles=[...sample.particles];
  const run=seconds=>{for(let i=0;i<seconds*120;i++)advanceGas(sample,1/120);};
  sample.setting=25;run(6);
  assert.equal(sample.vapor,0);assert.equal(sample.pressure,1);
  const liquidHeight=sample.height;
  sample.setting=-10;run(4);
  assert.equal(sample.ice,1);assert.ok(sample.height>liquidHeight);
  const sites=particles.map(p=>({...p}));
  run(.7);
  assert.ok(particles.every((p,i)=>Math.hypot(p.x-sites[i].x,p.y-sites[i].y,p.z-sites[i].z)<.12));
  sample.setting=90;run(5);
  sample.stroke=4;run(1);
  assert.ok(sample.vapor>.35&&sample.vapor<.7);
  assert.ok(Math.abs(sample.pressure-saturation(90))<.002);
  sample.stroke=-2;run(1);
  assert.ok(sample.vapor>0&&sample.vapor<.35);
  sample.stroke=-8;run(1);
  assert.ok(Math.abs(sample.pressure-3)<.001);
  assert.ok(sample.height>liquidHeight*.97);
  assert.ok(particles.every((p,i)=>p===sample.particles[i]));
});

test('Distinct crystal poses, liquid neighbour exchange, reversible capture',()=>{
  const gas=createGas(water);
  const run=t=>{for(let i=0;i<t*120;i++)advanceGas(gas,1/120);};
  gas.setting=25;run(6);
  const neighbours=()=>gas.particles.map(p=>gas.particles.filter(q=>q!==p)
    .sort((a,b)=>distance(p,a)-distance(p,b))[0]);
  const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z);
  const before=neighbours();run(2);
  assert.ok(neighbours().filter((q,i)=>q!==before[i]).length>24);
  assert.ok(gas.particles.some(p=>p.torque.length()>1));
  gas.setting=-2;run(4);
  assert.equal(new Set(gas.particles.map(p=>p.site)).size,72);
  for(const p of gas.particles) {
    assert.ok(distance(p,p.site)<.1);
    assert.ok(p.orientation.angleTo(p.site.orientation)<.04);
  }
  gas.setting=2;run(.45);gas.setting=-2;run(.3);gas.setting=2;run(4);
  assert.ok(gas.particles.every(p=>!p.site && Math.abs(p.orientation.length()-1)<1e-8));
});

test('The dial can hold and reverse both kinds of coexistence',()=>{
  const sample={...createSample(),temperature:0,setting:-10,vapor:0};
  const dt=1/120;
  const run=n=>{for(let i=0;i<n;i++)advanceSample(sample,dt);};
  run(60);
  const frozen=sample.ice;
  assert.ok(frozen>0 && frozen<1);
  sample.setting=0;run(240);
  assert.equal(sample.temperature,0);
  assert.equal(sample.ice,frozen);
  sample.setting=25;run(1);
  assert.ok(sample.ice<frozen);
  sample.setting=-10;run(2);
  assert.ok(sample.ice>frozen);
  sample.setting=160;
  while(sample.vapor<1){
    const before=sample.temperature;
    run(1);
    assert.ok(sample.temperature-before<=62*dt+1e-10);
    if(sample.vapor>0)assert.equal(sample.temperature,boiling(1));
  }
  const plateau=sample.temperature;
  run(1);
  assert.ok(sample.temperature>plateau && sample.temperature-plateau<=62*dt);

  Object.assign(sample,createSample(),{temperature:90,setting:90,vapor:0,stroke:4});
  run(240);
  const fraction=sample.vapor;
  assert.ok(fraction>0 && fraction<1);
  assert.ok(Math.abs(sample.pressure-saturation(90))<.00001);
  run(240);
  assert.equal(sample.vapor,fraction);
  sample.stroke=-1;run(60);
  assert.ok(sample.vapor>0 && sample.vapor<fraction);
  assert.equal(sample.pressure,saturation(90));
});
