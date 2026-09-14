from pathlib import Path


def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

replace('src/veil/map.js',"const DEPLETION_LIMITS=Object.freeze({H:{start:80,full:800},C:{start:40,full:400},O:{start:40,full:400}});","const DEPLETION_LIMITS=Object.freeze({H:{start:120,full:700},C:{start:40,full:400},O:{start:60,full:320}});")

replace('src/veil/oxygen-routes.js',"export const OXYGEN_HARVEST=Object.freeze({sideSpacing:90,eddyAtoms:180});","export const OXYGEN_HARVEST=Object.freeze({sideSpacing:90,eddyAtoms:36});")
replace('src/veil/oxygen-routes.js',"    summary:'広い低圧帯でOを多く拾う支流。',\n    knots:[[120,-8700],[780,-9000],[850,-10350],[120,-10670]],\n    gates:[],pressure:0,lanes:4,value:3},","    summary:'広い低圧帯を通るthermal-oriented支流。採集量ではなく走行特性で選ぶ。',\n    knots:[[120,-8700],[780,-9000],[850,-10350],[120,-10670]],\n    gates:[],pressure:0,lanes:2,value:2},")

replace('src/veil/universe.js',"    if(!keepDepletedSegment(map.depletion.O,seed,'oxygen-rest-harvest',i))continue;","    if(!keepDepletedSegment(map.depletion.O,seed,'oxygen-rest-harvest',i,{optional:true}))continue;")
replace('src/veil/universe.js',"    map.dust.push({id:map.dust.length,x,y,angle:-Math.PI/2,route:'oxygen-rest-harvest',element:'O',kind:'oxygen',value:3,ready:0});","    map.dust.push({id:map.dust.length,x,y,angle:-Math.PI/2,route:'oxygen-rest-harvest',element:'O',kind:'oxygen',value:2,ready:0});")
replace('src/veil/universe.js',"  for(let i=0;i<90;i++){\n    const angle=i*2.399963,radius=Math.sqrt((i+.5)/90)*OXYGEN_REWARD.radius,x=OXYGEN_REWARD.x+Math.cos(angle)*radius,y=OXYGEN_REWARD.y+Math.sin(angle)*radius,element=i%6===0?'C':'O';\n    if(!keepDepletedSegment(map.depletion[element],seed,`oxygen-harvest:${element}`,i))continue;\n    map.dust.push({id:map.dust.length,x,y,angle:-Math.PI/2,route:'oxygen-harvest',element,kind:element==='C'?'carbon':'oxygen',value:3,ready:0});\n  }","  for(let i=0;i<30;i++){\n    const angle=i*2.399963,radius=Math.sqrt((i+.5)/30)*OXYGEN_REWARD.radius,x=OXYGEN_REWARD.x+Math.cos(angle)*radius,y=OXYGEN_REWARD.y+Math.sin(angle)*radius,element=i%6===0?'C':'O';\n    if(!keepDepletedSegment(map.depletion[element],seed,`oxygen-harvest:${element}`,i,{optional:true}))continue;\n    map.dust.push({id:map.dust.length,x,y,angle:-Math.PI/2,route:'oxygen-harvest',element,kind:element==='C'?'carbon':'oxygen',value:2,ready:0});\n  }")
replace('src/veil/universe.js',"  map.labels.push({x:OXYGEN_REWARD.x,y:OXYGEN_REWARD.y,text:'流れの合流点 · Oの集積'});","  map.labels.push({x:OXYGEN_REWARD.x,y:OXYGEN_REWARD.y,text:'流れの合流点 · 少量のO dust'});")

replace('tests/field-map-export.test.mjs',"  assert.deepEqual([routes['oxygen-side'].lanes,routes['oxygen-side'].value],[4,3]);","  assert.deepEqual([routes['oxygen-side'].lanes,routes['oxygen-side'].value],[2,2]);")
replace('tests/field-map-export.test.mjs',"  assert.equal(rest.length,180);\n  assert.ok(rest.every(dust=>dust.value===3));","  assert.equal(rest.length,36);\n  assert.ok(rest.every(dust=>dust.value===2));")

replace('tests/h-economy-balance.test.mjs',"test('C/O economy and route geometry remain outside the H-only balance change',()=>{","test('stock-dependent H/O economy suppresses farming without changing C geometry',()=>{")
replace('tests/h-economy-balance.test.mjs',"    {id:'oxygen-side',lanes:4,value:3},","    {id:'oxygen-side',lanes:2,value:2},")
insert="""

test('H/O stock levels monotonically reduce aggregate and optional reward pockets',()=>{
  const capabilities={combustionDrive:true};
  const levels=[
    {name:'low',H:0,O:0},
    {name:'mid',H:410,O:190},
    {name:'high',H:700,O:320},
  ];
  const report=levels.map(level=>{
    const field=createUniverse(SEED,{H:level.H,C:0,O:level.O},{capabilities});
    const units=element=>elementUnits(field,element);
    return {
      ...level,
      H:units('H'),O:units('O'),
      hRevisit:routeUnits(field,'hydrogen-revisit-pocket','H'),
      oxygenSide:routeUnits(field,'oxygen-side','O'),
      recovery:routeUnits(field,'oxygen-rest-harvest','O'),
      merge:routeUnits(field,'oxygen-harvest','O'),
    };
  });
  assert.ok(report[0].H>report[1].H&&report[1].H>report[2].H,`aggregate H should thin with stock: ${JSON.stringify(report)}`);
  assert.ok(report[0].O>report[1].O&&report[1].O>report[2].O,`aggregate O should thin with stock: ${JSON.stringify(report)}`);
  assert.ok(report[0].hRevisit>report[1].hRevisit&&report[2].hRevisit===0,'high H stock removes optional revisit reward only');
  assert.ok(report[0].oxygenSide>report[1].oxygenSide&&report[2].oxygenSide===0,'high O stock makes side route unattractive as a farm');
  assert.ok(report[0].recovery>0&&report[0].recovery<=72,'recovery remains a modest low-stock refill');
  assert.equal(report[2].recovery,0,'high O stock suppresses recovery farm reward');
  assert.ok(report[0].merge>0&&report[0].merge<60,'merge reward is environmental flavor, not a harvest table');
  assert.equal(report[2].merge,0,'high O stock suppresses merge farm reward');
  assert.ok(inventoryDepletion({H:120},'H')===0&&inventoryDepletion({H:700},'H')===1);
  assert.ok(inventoryDepletion({O:60},'O')===0&&inventoryDepletion({O:320},'O')===1);
  console.log('Task2 H/O stock economy',JSON.stringify(report,null,2));
});
"""
p=Path('tests/h-economy-balance.test.mjs'); text=p.read_text(); anchor="\ntest('stock-dependent H/O economy suppresses farming without changing C geometry',()=>{"
if anchor not in text: raise SystemExit('insert anchor missing')
p.write_text(text.replace(anchor,insert+anchor,1))

print('Task 2 transformations applied')
