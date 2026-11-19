import test from 'node:test';
import {profiles} from '../src/phase-profiles.js';
import assert from 'node:assert/strict';
import {advanceSample,boiling,createSample,HIGH,LOW,saturation} from '../src/water-phase.js';
import {createGas,advanceGas} from '../src/water-gas.js';

import {readFileSync} from 'node:fs';
const water=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url))).find(m=>m.id==='water');

test('Steam table checkpoints and fixed-load cooling',()=>{
  for(const [atm,t] of [[.5,81.65],[1,99.97],[3,134.03]])assert.ok(Math.abs(boiling(atm)-t)<.25);
  assert.ok(Math.abs(saturation(90)-.6926)<.001);
  const sample=createGas(water), particles=[...sample.particles];
  const run=seconds=>{for(let i=0;i<seconds*120;i++)advanceGas(sample,1/120);};
  sample.setting=25;run(6);
  assert.equal(sample.phase.gas,0);assert.equal(sample.pressure,1);
  const liquidHeight=sample.height;
  sample.setting=-10;run(4);
  assert.equal(sample.phase.solid,1);assert.ok(sample.height>liquidHeight);
  const sites=particles.map(p=>({...p}));
  run(.7);
  assert.ok(particles.every((p,i)=>Math.hypot(p.x-sites[i].x,p.y-sites[i].y,p.z-sites[i].z)<.12));
  sample.setting=90;run(5);
  sample.stroke=4;run(1);
  assert.ok(sample.phase.gas>.35&&sample.phase.gas<.7);
  assert.ok(Math.abs(sample.pressure-saturation(90))<.002);
  sample.stroke=-2;run(1);
  assert.ok(sample.phase.gas>0&&sample.phase.gas<.35);
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
  const sample={...createSample(),temperature:0,setting:-10};
  sample.phase.gas=0;
  const dt=1/120;
  const run=n=>{for(let i=0;i<n;i++)advanceSample(sample,dt);};
  run(60);
  const frozen=sample.phase.solid;
  assert.ok(frozen>0 && frozen<1);
  sample.setting=0;run(240);
  assert.equal(sample.temperature,0);
  assert.equal(sample.phase.solid,frozen);
  sample.setting=25;run(1);
  assert.ok(sample.phase.solid<frozen);
  sample.setting=-10;run(2);
  assert.ok(sample.phase.solid>frozen);
  sample.setting=160;
  while(sample.phase.gas<1){
    const before=sample.temperature;
    run(1);
    assert.ok(sample.temperature-before<=62*dt+1e-10);
    if(sample.phase.gas>0)assert.equal(sample.temperature,boiling(1));
  }
  const plateau=sample.temperature;
  run(1);
  assert.ok(sample.temperature>plateau && sample.temperature-plateau<=62*dt);

  Object.assign(sample,createSample(),{temperature:90,setting:90,stroke:4});
  sample.phase.gas=0;run(240);
  const fraction=sample.phase.gas;
  assert.ok(fraction>0 && fraction<1);
  assert.ok(Math.abs(sample.pressure-saturation(90))<.00001);
  run(240);
  assert.equal(sample.phase.gas,fraction);
  sample.stroke=-1;run(60);
  assert.ok(sample.phase.gas>0 && sample.phase.gas<fraction);
  assert.equal(sample.pressure,saturation(90));
});

test('Methane phase I, liquid and real coexistence boundaries',()=>{
  const methane=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url))).find(m=>m.id==='methane');
  const s=createGas(methane), {profile}=s;
  for(const p of [.5,1,2,3]){
    const nist=443.028/(3.9895-Math.log10(1.01325*p))+.49-273.15;
    assert.ok(Math.abs(profile.vaporTemperature(p)-nist)<.2);
    assert.ok(Math.abs(profile.saturation(profile.vaporTemperature(p))-p)<1e-6);
  }
  const run=t=>{for(let i=0;i<t*120;i++)advanceGas(s,1/120);};
  s.setting=-195;run(6.4);
  assert.ok(s.phase.solid>0 && s.phase.solid<1);
  const held=s.phase.solid;s.setting=profile.melt;run(1);
  assert.equal(s.phase.solid,held);
  s.setting=-195;run(4);
  const before=s.particles[0].orientation.clone();run(.5);
  assert.ok(before.angleTo(s.particles[0].orientation)>.01);
  assert.ok(s.particles.every(p=>Math.hypot(p.x-p.site.x,p.y-p.site.y,p.z-p.site.z)<.1));
  s.setting=-165;run(5);assert.equal(s.phase.liquid,1);
  s.stroke=3;run(2);assert.ok(s.phase.gas>0 && s.phase.gas<1);
  assert.equal(s.pressure,profile.saturation(-165));
  s.stroke=-4;run(2);assert.equal(s.phase.liquid,1);
  assert.equal(s.particles.length,60);
});

test('Water and methane stay within chamber limits while heating and cooling at full extension',()=>{
  const dt=1/120, tolerance=1e-9;
  for(const id of ['water','methane']){
    const profile=profiles[id];
    const sample=createSample(profile);
    const step=()=>{
      advanceSample(sample,dt);
      assert.ok(sample.pressure>=.5-tolerance && sample.pressure<=3+tolerance,id);
      assert.ok(sample.height>=LOW-tolerance && sample.height<=HIGH+tolerance,id);
      const shares=Object.values(sample.phase);
      assert.ok(shares.every(share=>share>=0 && share<=1),id);
      assert.ok(Math.abs(shares.reduce((sum,share)=>sum+share,0)-1)<tolerance,id);
    };
    sample.stroke=HIGH;
    for(let i=0;i<120;i++)step();
    assert.ok(Math.abs(sample.height-HIGH)<.0001,id);

    const expandedPressure=sample.pressure;
    sample.setting=profile.max;
    for(let i=0;i<240;i++)step();
    assert.equal(sample.temperature,profile.max,id);
    assert.ok(Math.abs(sample.height-HIGH)<.0001,id);
    assert.ok(sample.pressure>expandedPressure,id);

    sample.setting=profile.start-10;
    for(let i=0;i<480;i++)step();
    assert.equal(sample.temperature,sample.setting,id);
    assert.ok(sample.height>.75*HIGH,id);
    assert.equal(sample.phase.gas,1,id);
  }
});

test('Carbon dioxide has a reversible solid–gas boundary and a Pa-3 crystal',()=>{
  const record=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url)))
    .find(m=>m.id==='carbon-dioxide');
  const s=createGas(record), {profile}=s;
  for(const [p,expected] of [[.5,-86.57],[1,-78.46],[2,-69.66],[3,-64.17]]){
    const t=profile.vaporTemperature(p);
    assert.ok(Math.abs(t-expected)<.01);
    assert.ok(Math.abs(profile.saturation(t)-p)<1e-9);
  }
  const run=(seconds,particles=false)=>{
    for(let i=0;i<seconds*120;i++){
      (particles?advanceGas:advanceSample)(s,1/120);
      assert.equal(s.phase.liquid,0);
      assert.equal(s.phase.gas+s.phase.solid,1);
      assert.ok(s.phase.gas>=0 && s.phase.gas<=1);
      assert.ok(s.pressure>=.5 && s.pressure<=3+1e-10);
      assert.ok(s.height>=LOW && s.height<=HIGH+1e-10);
    }
  };
  s.stroke=HIGH;run(1);
  s.setting=profile.max;run(3);
  assert.ok(Math.abs(s.height-HIGH)<1e-9);
  s.stroke=-HIGH;run(2);
  assert.ok(Math.abs(s.pressure-3)<.0001);
  s.setting=-100;run(3.3);
  assert.ok(Math.abs(s.temperature-profile.vaporTemperature(3))<.001);
  assert.ok(s.phase.gas>0 && s.phase.gas<1);
  const first=s.phase.gas;s.setting=-64;run(1);
  assert.equal(s.phase.gas,first);
  s.setting=-40;run(.5);
  assert.ok(s.phase.gas>first);
  s.setting=-100;run(5,true);
  assert.equal(s.phase.solid,1);
  assert.ok(s.particles.every(p=>p.liquid===0 && p.force.length()===0 && p.torque.length()===0));
  assert.ok(s.particles.every(p=>Math.hypot(p.x-p.site.x,p.y-p.site.y,p.z-p.site.z)<.12
    && p.orientation.angleTo(p.site.orientation)<.08));
  const atomAxis=s.particles[0].force.clone().fromArray(s.particles[0].body.atoms[1].positionAngstrom).normalize();
  const axes=new Set(s.sites.map(site=>atomAxis.clone().applyQuaternion(site.orientation)
    .toArray().map(v=>Math.round(v*Math.sqrt(3))).join(',')));
  assert.equal(axes.size,4);
  assert.ok([...axes].every(axis=>axis.split(',').every(v=>Math.abs(Number(v))===1)));

  s.setting=-80;run(3);assert.equal(s.phase.gas,0);
  s.stroke=4;run(2);
  assert.ok(s.phase.gas>.25 && s.phase.gas<.75);
  assert.ok(Math.abs(s.pressure-profile.saturation(-80))<1e-9);
  const mixed=s.phase.gas;run(1);
  assert.equal(s.phase.gas,mixed);
  s.stroke=-1;run(2);
  assert.ok(s.phase.gas>0 && s.phase.gas<mixed);
  s.stroke=-3;run(1);assert.equal(s.phase.gas,0);
});

test('Ethanol uses a rigid DB model in liquid and measured Pc oxygen chains when frozen',()=>{
  const record=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url)))
    .find(m=>m.id==='ethanol');
  const s=createGas(record), {profile,particles}=s;
  assert.equal(profile.melt,-114);
  for(const [p,expected] of [[.5,61.82],[1,78.42],[2,97.08],[3,109.13]]){
    const t=profile.vaporTemperature(p);
    assert.ok(Math.abs(t-expected)<.01);
    assert.ok(Math.abs(profile.saturation(t)-p)<1e-9);
  }
  const atoms=particles[0].body.atoms;
  assert.equal(atoms.length,9);
  assert.equal(record.bonds.length,8);
  const geometry=atoms.map(({positionAngstrom})=>[...positionAngstrom]);
  const dt=1/120;
  const run=seconds=>{
    for(let i=0;i<Math.round(seconds/dt);i++){
      advanceGas(s,dt);
      const {gas,liquid,solid}=s.phase;
      assert.ok(Math.min(gas,liquid,solid)>=0 && Math.abs(gas+liquid+solid-1)<1e-9);
      assert.ok(s.pressure>=.5 && s.pressure<=3 && s.height>=LOW && s.height<=HIGH+1e-9);
    }
  };
  s.setting=72;run(4);
  assert.equal(s.phase.liquid,1);
  assert.ok(particles.some(p=>p.torque.length()>.1 && p.force.length()>.1));
  s.stroke=3;run(1);
  const vapor=s.phase.gas;
  assert.ok(vapor>.4 && vapor<.8);
  assert.ok(Math.abs(s.pressure-profile.saturation(72))<1e-9);
  s.stroke=-1;run(1);
  assert.ok(s.phase.gas>0 && s.phase.gas<vapor);
  s.stroke=-3;run(1);assert.equal(s.phase.liquid,1);

  s.setting=-130;run(7);
  assert.equal(s.phase.solid,1);
  assert.ok(particles.every(p=>p.orientation.angleTo(p.site.orientation)<.05
    && Math.hypot(p.x-p.site.x,p.y-p.site.y,p.z-p.site.z)<.08));
  const oxygens=s.sites.map(site=>particles[0].force.clone().fromArray(geometry[2]).applyQuaternion(site.orientation)
    .add(particles[0].force.clone().set(site.x,site.y,site.z).divideScalar(profile.scale)));
  for(const expected of [2.716,2.730]){
    assert.ok(oxygens.some(a=>oxygens.some(b=>Math.abs(a.distanceTo(b)-expected)<.002)));
  }
  assert.ok(particles.every(p=>p.body.atoms.every((atom,i)=>
    atom.positionAngstrom.every((coordinate,k)=>coordinate===geometry[i][k]))));

  s.setting=130;run(.9);
  assert.ok(s.phase.solid>0 && s.phase.liquid>0);
  s.setting=130;run(9);
  assert.equal(s.phase.gas,1);
  assert.equal(s.particles,particles);
  assert.equal(particles.length,40);
});
