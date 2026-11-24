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
  assert.equal(particles.length,50);
  assertCrystalFits(s);
});

function assertCrystalFits(sample){
  const {profile}=sample;
  const body=sample.particles[0].body;
  assert.equal(sample.sites.length,profile.count);
  assert.equal(new Set(sample.sites.map(({x,y,z})=>[x,y,z].join(','))).size,profile.count);
  const point=sample.particles[0].force.clone();
  const clusters=[];
  for(const site of sample.sites){
    assert.ok(Math.hypot(site.x,site.z)<=profile.bore-profile.skin);
    assert.ok(site.y>=profile.skin && site.y<=profile.solidHeight-profile.skin);
    const atoms=[];
    for(const atom of body.atoms){
      point.fromArray(atom.positionAngstrom).applyQuaternion(site.orientation).multiplyScalar(profile.scale);
      // Upper bound on rendered atom radius plus a margin for thermal motion.
      assert.ok(Math.hypot(point.x+site.x,point.z+site.z)+.20<profile.bore);
      assert.ok(point.y+site.y>.20 && point.y+site.y+.20<profile.solidHeight);
      const world=point.clone().add(point.clone().set(site.x,site.y,site.z));
      for(const cluster of clusters)for(const other of cluster){
        const heavy=atom.element!=='H' && other.element!=='H';
        assert.ok(world.distanceTo(other.point)>(heavy?2.35:1.50)*profile.scale);
      }
      atoms.push({point:world,element:atom.element});
    }
    clusters.push(atoms);
  }
}

const additions=[
  ['dimethyl-ether',[-39.61,-24.78,-7.59,3.80],-141.5,-150,-30],
  ['acetic-acid',[96.81,118.01,142.15,157.87],16.6,10,110]
];
for(const [id,temperatures,melt,cold,nearBoiling] of additions){
  test(id+' preserves phase balance and its ordered crystal across repeated cycles',()=>{
    const record=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url))).find(m=>m.id===id);
    const s=createGas(record), {profile}=s;
    assert.equal(profile.melt,melt);
    assert.equal(s.phase.gas,1);
    assert.equal(s.pressure,1);
    for(const [i,pressure] of [.5,1,2,3].entries()){
      const boiling=profile.vaporTemperature(pressure);
      assert.ok(Math.abs(boiling-temperatures[i])<.02);
      assert.ok(Math.abs(profile.saturation(boiling)-pressure)<1e-8);
    }
    assertCrystalFits(s);

    const run=(seconds)=>{
      for(let i=0;i<seconds*120;i++){
        advanceGas(s,1/120);
        const {solid,liquid,gas}=s.phase;
        assert.ok(Math.min(solid,liquid,gas)>=-1e-9 && Math.abs(solid+liquid+gas-1)<1e-9);
        assert.ok(s.pressure>=.5 && s.pressure<=3 && s.height>=LOW && s.height<=HIGH+1e-9);
      }
    };
    s.setting=nearBoiling;run(5);
    assert.equal(s.phase.liquid,1);
    s.stroke=3.5;run(1.5);
    assert.ok(s.phase.gas>0 && s.phase.gas<1);
    const vapor=s.phase.gas;
    s.stroke=-1;run(1.5);
    assert.ok(s.phase.gas>0 && s.phase.gas<vapor);
    s.stroke=-5;run(1.5);
    assert.equal(s.phase.liquid,1);
    for(let cycle=0;cycle<2;cycle++){
      s.setting=id==='acetic-acid'?20:-125;run(5);
      assert.equal(s.phase.liquid,1);
      s.setting=cold;run(7);
      assert.equal(s.phase.solid,1);
      assert.equal(new Set(s.particles.map(p=>p.site)).size,profile.count);
      assert.ok(s.particles.every(p=>p.orientation.angleTo(p.site.orientation)<.05
        && Math.hypot(p.x-p.site.x,p.y-p.site.y,p.z-p.site.z)<.085));
      s.setting=melt;run(1);
      assert.equal(s.phase.solid,1);
    }
    s.setting=profile.max;run(12);
    assert.equal(s.phase.gas,1);
    assert.ok(s.particles.every(p=>p.site===null));
  });
}

test('At 25 °C and 1 atm ethanol is liquid while its ether isomer is gas',()=>{
  for(const [id,expected] of [['ethanol',0],['dimethyl-ether',1]]){
    const s=createSample(profiles[id]);
    s.setting=25;
    for(let i=0;i<900;i++)advanceSample(s,1/120);
    assert.equal(s.temperature,25);
    assert.equal(s.pressure,1);
    assert.equal(s.phase.gas,expected);
  }
});

const p35Molecules=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url)));
const p35Boundaries={
  'n-butane':[-138.25,-.49], benzene:[5.5,80.07], cyclohexane:[6.5,80.71],
  oxygen:[-218.8,-182.96], chlorine:[-101,-33.95], nitrogen:[-210,-195.79],
  hydrogen:[-259.2,-252.78], ammonia:[-77.7,-33.32], glycerol:[18,Infinity]
};

function runP35(sample,seconds,advance=advanceSample){
  for(let frame=0;frame<seconds*120;frame++)advance(sample,1/120);
}

test('n-butane compresses through a fixed-temperature coexistence plateau at room temperature',()=>{
  const sample=createSample(profiles['n-butane']);
  sample.stroke=-5;
  runP35(sample,1.5);
  assert.ok(Math.abs(sample.temperature-25)<1e-8);
  assert.ok(Math.abs(sample.pressure-2.4011)<.002);
  assert.ok(sample.phase.gas>.2&&sample.phase.gas<.8);
  const height=sample.height;
  sample.stroke=-3;
  runP35(sample,2);
  assert.equal(sample.phase.liquid,1);
  assert.ok(sample.height<height&&sample.pressure>2.4011);
  sample.stroke=8;
  runP35(sample,2);
  assert.equal(sample.phase.gas,1);
  assert.ok(sample.pressure<2.4);
  assert.ok(Math.abs(sample.temperature-25)<1e-8);
});

test('New chamber boundaries, bounded motion and complete crystal-site capture',()=>{
  for(const [id,[melt,boil]] of Object.entries(p35Boundaries)){
    const profile=profiles[id], sample=createSample(profile);
    assert.equal(profile.melt,melt,id);
    assert.ok(boil===Infinity?profile.vaporTemperature(1)===Infinity:Math.abs(profile.vaporTemperature(1)-boil)<.02,id);
    const particles=createGas(p35Molecules.find(record=>record.id===id));
    assert.equal(particles.sites.length,profile.count,id);
    sample.setting=profile.min;
    runP35(sample,12);
    assert.equal(sample.phase.solid,1,id);
    sample.stroke=-20;
    runP35(sample,2);
    assert.ok(Math.abs(sample.pressure-3)<.001,id);
    sample.setting=profile.max;
    runP35(sample,14);
    assert.equal(sample.phase.gas,profile.liquidOnlyRange?0:1,id);
    sample.stroke=20;
    runP35(sample,2);
    assert.ok(sample.height<=HIGH+1e-8,id);
    assert.ok(sample.height>=LOW,id);
    assert.ok(sample.pressure>=.5&&sample.pressure<=3,id);

    particles.setting=profile.min;
    runP35(particles,10,advanceGas);
    assert.equal(particles.phase.solid,1,id);
    assert.equal(new Set(particles.particles.map(p=>p.site)).size,profile.count,id);
    assert.ok(particles.particles.every(p=>p.y>=profile.skin&&p.y<=particles.height-profile.skin
      && Math.hypot(p.x,p.z)<=profile.bore-profile.skin+1e-8),id);
  }
});

const p36Boundaries={
  'p-xylene':[13.25,138.32],ethylbenzene:[-95,136.16],toluene:[-95.2,110.60],
  phenol:[40.9,181.93],'hydrogen-fluoride':[-83.4,19.52],'hydrogen-chloride':[-114.1,-84.98],
  propane:[-187.6,-42.11],'ethylene-glycol':[-12.9,197.08],'dimethyl-sulfoxide':[18.5,Infinity]
};

const chamber=id=>createGas(p35Molecules.find(molecule=>molecule.id===id));

test('All nine profiles freeze and melt with complete, bounded molecular populations',()=>{
  assert.equal(Object.keys(profiles).length,24);
  for(const [id,[melt,boil]] of Object.entries(p36Boundaries)){
    const s=chamber(id), {profile,particles}=s;
    assert.equal(profile.melt,melt,id);
    assert.equal(Number(profile.vaporTemperature(1).toFixed(2)),boil,id);
    for(const pressure of [.5,1,2,3]){
      if(boil===Infinity)break;
      const temperature=profile.vaporTemperature(pressure);
      assert.ok(Math.abs(profile.saturation(temperature)-pressure)<1e-7,id);
    }
    s.setting=profile.min;
    runP35(s,10,advanceGas);
    assert.equal(s.phase.solid,1,id);
    assert.equal(new Set(particles.map(p=>p.site)).size,profile.count,id);
    assert.ok(particles.every(p=>p.site && Math.hypot(p.x-p.site.x,p.y-p.site.y,p.z-p.site.z)<.12),id);
    s.stroke=-20;
    runP35(s,1,advanceGas);
    assert.ok(Math.abs(s.pressure-3)<.001,id);
    assert.ok(s.height>=LOW && s.height<=HIGH,id);
    s.stroke=20;
    runP35(s,1,advanceGas);
    assert.ok(Math.abs(s.pressure-.5)<.001,id);
    s.setting=melt+3;
    runP35(s,8,advanceGas);
    assert.equal(s.phase.liquid,1,id);
    assert.ok(particles.every(p=>p.site===null && Math.hypot(p.x,p.z)<=profile.bore-profile.skin+1e-8
      && p.y>=profile.skin && p.y<=s.height-profile.skin),id);
    assert.equal(particles.length,profile.count,id);
  }
});

test('The C8H10 isomers differ at 5 °C, with a shared chamber and nearby boiling points',()=>{
  const xylene=chamber('p-xylene'), ethylbenzene=chamber('ethylbenzene');
  assert.equal(xylene.temperature,ethylbenzene.temperature);
  assert.equal(xylene.phase.solid,1);
  assert.equal(ethylbenzene.phase.liquid,1);
  for(const key of ['count','bore','scale'])assert.equal(xylene.profile[key],ethylbenzene.profile[key]);
  assert.ok(Math.abs(xylene.profile.vaporTemperature(1)-ethylbenzene.profile.vaporTemperature(1)-2.16)<.02);
});

test('Propane remains gas at 25 °C and compresses reversibly at −25 °C',()=>{
  const s=createSample(profiles.propane);
  s.stroke=-20;
  runP35(s,2);
  assert.ok(Math.abs(s.pressure-3)<.001);
  assert.equal(s.phase.gas,1);
  s.stroke=20;
  runP35(s,2);
  s.setting=-25;
  runP35(s,4);
  assert.equal(s.phase.gas,1);
  s.stroke=2.68-s.height;
  runP35(s,2);
  assert.ok(Math.abs(s.pressure-2.0077)<.002);
  assert.ok(s.phase.gas>.1 && s.phase.gas<.9);
  s.stroke=-7;
  runP35(s,1);
  assert.equal(s.phase.liquid,1);
  s.stroke=10;
  runP35(s,1);
  assert.equal(s.phase.gas,1);
  assert.equal(s.temperature,-25);
});

test('Fluoride forms unbranched and exchanging liquid links and ordered crystal chains',()=>{
  const hf=chamber('hydrogen-fluoride');
  runP35(hf,2,advanceGas);
  const links=()=>hf.particles.flatMap(p=>p.hydrogenBond?[p.hydrogenBond]:[]);
  const initial=links();
  assert.ok(initial.length>=15);
  assert.equal(initial.length,new Set(initial).size);
  assert.ok(hf.particles.some(p=>p.hydrogenBond?.hydrogenBond?.hydrogenBond));
  runP35(hf,1.5,advanceGas);
  assert.ok(initial.some(p=>!links().includes(p)));
  hf.setting=-95;
  runP35(hf,6,advanceGas);
  assert.ok(hf.particles.filter(p=>p.crystalHydrogenBond).length>=45);
  assert.equal(links().length,0);
});

test('Glycol gains mobility with temperature while DMSO has no hydrogen-association links',()=>{
  const glycol=profiles['ethylene-glycol'].mobility;
  assert.ok(glycol(0)<glycol(20) && glycol(20)<glycol(60) && glycol(60)<1);
  const dmso=chamber('dimethyl-sulfoxide');
  runP35(dmso,1,advanceGas);
  assert.ok(dmso.particles.some(p=>p.torque.length()>0));
  assert.ok(dmso.particles.every(p=>p.force.length()===0 && !p.hydrogenBond));
});
